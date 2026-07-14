import { wrap, Remote } from 'comlink';
import { readMobileDb, writeMobileDb } from './mobileFs';

const LS_KEY = 'mistake_note_db';

export interface IDBWorker {
  init(existingData?: Uint8Array): Promise<void>;
  exec(sql: string, params?: any[]): Promise<any>;
  get(sql: string, params?: any[]): Promise<any>;
  all(sql: string, params?: any[]): Promise<any[]>;
  run(sql: string, params?: any[]): Promise<{ changes: number; lastID: number }>;
  exportDb(): Promise<Uint8Array>;
  close(): Promise<void>;
}

let dbWorker: Remote<IDBWorker> | null = null;
let initialized = false;
let initPromise: Promise<Remote<IDBWorker>> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function uint8ArrayToBase64(u8: Uint8Array): string {
  const chars: string[] = [];
  for (let i = 0; i < u8.length; i++) {
    chars.push(String.fromCharCode(u8[i]!));
  }
  return btoa(chars.join(''));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const IDB_NAME = 'mistake_note';
const IDB_STORE = 'kv';
const IDB_VERSION = 1;

async function idbGet(key: string): Promise<Uint8Array | undefined> {
  try {
    const db = await openIdb();
    if (!db) return undefined;
    return new Promise<Uint8Array | undefined>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        const record = req.result;
        if (!record) { resolve(undefined); return; }
        const raw = record.data ?? record;
        if (raw instanceof Uint8Array) { resolve(raw); return; }
        if (raw instanceof ArrayBuffer) { resolve(new Uint8Array(raw)); return; }
        if (Array.isArray(raw)) { resolve(new Uint8Array(raw)); return; }
        resolve(undefined);
      };
      req.onerror = () => resolve(undefined);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return undefined;
  }
}

async function idbSet(key: string, data: Uint8Array): Promise<void> {
  try {
    const db = await openIdb();
    if (!db) return;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put({ key, data });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => resolve();
    });
  } catch {
    // IndexedDB unavailable or quota exceeded — silently no-op
  }
}

function openIdb(): Promise<IDBDatabase | undefined> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve(undefined); return; }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
  });
}

async function loadDbFromDisk(): Promise<Uint8Array | undefined> {
  // Try Capacitor Filesystem first (mobile)
  const mobileDb = await readMobileDb();
  if (mobileDb) return mobileDb;

  // Try Electron IPC (desktop)
  if (window.electronAPI) {
    try {
      const data = await window.electronAPI.readDbFile();
      if (data) return data;
    } catch {
      // electronAPI present but read failed
    }
  }
  // Prefer IndexedDB (web — much larger quota than localStorage)
  const idbData = await idbGet(LS_KEY);
  if (idbData) return idbData;

  // Read-only fallback to localStorage for backward compatibility with old data
  const ls = localStorage.getItem(LS_KEY);
  if (ls) {
    try {
      return base64ToUint8Array(ls);
    } catch {
      localStorage.removeItem(LS_KEY);
    }
  }
  console.warn('No database found on disk or localStorage — will create fresh');
  return undefined;
}

async function saveDbToDisk(data: Uint8Array): Promise<boolean> {
  // Save to IndexedDB (web — much larger quota than localStorage)
  try {
    await idbSet(LS_KEY, data);
  } catch (e) {
    console.warn('IndexedDB save failed:', e);
  }

  // Try Capacitor Filesystem (mobile) — happens after IndexedDB to avoid double-save issue
  const mobileWrote = await writeMobileDb(data);

  // Also save via Electron IPC if available (desktop)
  if (window.electronAPI) {
    try {
      await window.electronAPI.writeDbFile(data);
      return true;
    } catch (e) {
      console.error('Electron IPC save failed:', e);
      return false;
    }
  }
  return mobileWrote;
}

export async function getDb(): Promise<Remote<IDBWorker>> {
  if (dbWorker && initialized) return dbWorker;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const wrk = new Worker(new URL('@/workers/dbWorker.ts', import.meta.url), { type: 'module' });
    dbWorker = wrap<IDBWorker>(wrk);

    const existingData = await loadDbFromDisk();
    await dbWorker.init(existingData);
    initialized = true;
    initPromise = null;

    await initTables(!existingData);
    return dbWorker;
  })();

  return initPromise;
}

export function saveDb(): void {
  if (!dbWorker || !initialized) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      const data = await dbWorker!.exportDb();
      await saveDbToDisk(data);
    } catch (e) {
      console.error('Failed to save database:', e);
    }
  }, 500);
}

async function saveDbNow(): Promise<void> {
  if (!dbWorker || !initialized) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  try {
    const data = await dbWorker!.exportDb();
    await saveDbToDisk(data);
  } catch (e) {
    console.error('Failed to save database:', e);
  }
}

// Flush pending save before app closes (best effort — async IPC may not complete)
window.addEventListener('beforeunload', () => { saveDbNow(); });

async function initTables(isFreshInstall: boolean = true) {
  if (!dbWorker) return;

  // Check current schema version
  const versionRow = await dbWorker.get('PRAGMA user_version');
  const version = versionRow?.user_version ?? 0;

  if (version === 0) {
    // Batch: all CREATE + INDEX in ONE Comlink call
    await dbWorker.exec(`
      CREATE TABLE IF NOT EXISTS mistakes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        image_urls TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        subject TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        answer TEXT DEFAULT '',
        answer_images TEXT NOT NULL DEFAULT '[]',
        difficulty TEXT DEFAULT '0',
        knowledge_points TEXT NOT NULL DEFAULT '[]',
        year TEXT DEFAULT '',
        knowledge_areas TEXT NOT NULL DEFAULT '[]',
        source_paper_type TEXT DEFAULT '',
        source_paper_name TEXT DEFAULT '',
        question_number TEXT DEFAULT '',
        ai_analysis TEXT,
        ocr_text TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        review_count INTEGER NOT NULL DEFAULT 0,
        last_review_at TEXT,
        mastery_level TEXT,
        sm2_data TEXT,
        linked_note_ids TEXT NOT NULL DEFAULT '[]',
        synced INTEGER NOT NULL DEFAULT 0,
        deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL DEFAULT '',
        volume TEXT NOT NULL DEFAULT '',
        chapter TEXT NOT NULL DEFAULT '',
        section TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        is_folder INTEGER NOT NULL DEFAULT 0,
        content TEXT NOT NULL DEFAULT '',
        plain_text TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        knowledge_points TEXT NOT NULL DEFAULT '[]',
        tips TEXT NOT NULL DEFAULT '[]',
        image_urls TEXT NOT NULL DEFAULT '[]',
        linked_mistake_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0,
        deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
      );
      -- CAUTION: When adding new columns here, also add ALTER TABLE migration below (line ~322)
      CREATE TABLE IF NOT EXISTS ai_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'recognition',
        mistake_id TEXT,
        image_data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        result_content TEXT,
        result_difficulty TEXT,
        result_subject TEXT,
        result_knowledge_areas TEXT,
        result_questions TEXT,
        result_knowledge_points TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        processed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS uploaded_images (
        id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        PRIMARY KEY (id, user_id)
      );
      CREATE TABLE IF NOT EXISTS sync_conflicts (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        local_data TEXT,
        remote_data TEXT,
        created_at TEXT NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_mistakes_created ON mistakes(created_at);
      CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
      CREATE INDEX IF NOT EXISTS idx_ai_queue_status ON ai_queue(status);
    `);

    // Only run migrations for existing DBs upgrading to v1
    if (!isFreshInstall) {
      const migrationCols = [
        'ALTER TABLE mistakes ADD COLUMN content TEXT DEFAULT \'\'',
        'ALTER TABLE mistakes ADD COLUMN answer TEXT DEFAULT \'\'',
        'ALTER TABLE mistakes ADD COLUMN answer_images TEXT NOT NULL DEFAULT \'[]\'',
        'ALTER TABLE mistakes ADD COLUMN difficulty TEXT DEFAULT \'0\'',
        'ALTER TABLE mistakes ADD COLUMN knowledge_points TEXT NOT NULL DEFAULT \'[]\'',
        'ALTER TABLE mistakes ADD COLUMN year TEXT DEFAULT \'\'',
        'ALTER TABLE mistakes ADD COLUMN knowledge_area TEXT DEFAULT \'\'',
        'ALTER TABLE mistakes ADD COLUMN knowledge_areas TEXT NOT NULL DEFAULT \'[]\'',
        'ALTER TABLE mistakes ADD COLUMN source_paper_type TEXT DEFAULT \'\'',
        'ALTER TABLE mistakes ADD COLUMN source_paper_name TEXT DEFAULT \'\'',
        'ALTER TABLE mistakes ADD COLUMN question_number TEXT DEFAULT \'\'',
        'ALTER TABLE notes ADD COLUMN subject TEXT DEFAULT \'\'',
        'ALTER TABLE notes ADD COLUMN volume TEXT DEFAULT \'\'',
        'ALTER TABLE notes ADD COLUMN chapter TEXT DEFAULT \'\'',
        'ALTER TABLE notes ADD COLUMN section TEXT DEFAULT \'\'',
        'ALTER TABLE notes ADD COLUMN summary TEXT DEFAULT \'\'',
        'ALTER TABLE notes ADD COLUMN knowledge_points TEXT NOT NULL DEFAULT \'[]\'',
        'ALTER TABLE notes ADD COLUMN tips TEXT NOT NULL DEFAULT \'[]\'',
        'ALTER TABLE notes ADD COLUMN is_folder INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE ai_queue ADD COLUMN result_subject TEXT',
        'ALTER TABLE ai_queue ADD COLUMN result_knowledge_areas TEXT',
        'ALTER TABLE ai_queue ADD COLUMN result_questions TEXT',
        'ALTER TABLE mistakes ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE notes ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0',
      ];
      for (const col of migrationCols) {
        try { await dbWorker.exec(col); } catch { /* column may already exist */ }
      }
    }

    // Bump version only after all migrations succeeded
    await dbWorker.exec('PRAGMA user_version = 1');
  } else if (version === 1) {
    await dbWorker.exec('CREATE TABLE IF NOT EXISTS sync_conflicts (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, local_data TEXT, remote_data TEXT, created_at TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0);');
    await dbWorker.exec('PRAGMA user_version = 2');
  } else if (version === 2) {
    try { await dbWorker.exec("ALTER TABLE ai_queue ADD COLUMN type TEXT NOT NULL DEFAULT 'recognition'"); } catch { /* column may already exist */ }
    await dbWorker.exec('PRAGMA user_version = 3');
  }
  // Future migrations:
  // else if (version < 3) { await dbWorker.execMulti('ALTER ... ADD COLUMN ...'); }
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

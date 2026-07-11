import { wrap, Remote } from 'comlink';

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

declare global {
  interface Window {
    electronAPI?: {
      readDbFile(): Promise<Uint8Array | null>;
      writeDbFile(data: Uint8Array): Promise<void>;
      getDbPath(): Promise<string>;
      exportPdf?(html: string): Promise<boolean>;
      saveImage(dataUrl: string): Promise<string | null>;
      loadImage(name: string): Promise<string | null>;
      deleteImage(name: string): Promise<void>;
    };
  }
}

let dbWorker: Remote<IDBWorker> | null = null;
let initialized = false;

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

async function loadDbFromDisk(): Promise<Uint8Array | undefined> {
  if (window.electronAPI) {
    try {
      const data = await window.electronAPI.readDbFile();
      if (data) return data;
    } catch {
      // electronAPI present but read failed
    }
  }
  const ls = localStorage.getItem(LS_KEY);
  if (ls) {
    try {
      return base64ToUint8Array(ls);
    } catch {
      localStorage.removeItem(LS_KEY);
    }
  }
  return undefined;
}

async function saveDbToDisk(data: Uint8Array): Promise<boolean> {
  // Save to localStorage as base64 (universal fallback)
  try {
    localStorage.setItem(LS_KEY, uint8ArrayToBase64(data));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }

  // Also save via Electron IPC if available
  if (window.electronAPI) {
    try {
      await window.electronAPI.writeDbFile(data);
      return true;
    } catch (e) {
      console.error('Electron IPC save failed:', e);
      return false;
    }
  }
  return false;
}

export async function getDb(): Promise<Remote<IDBWorker>> {
  if (dbWorker && initialized) return dbWorker;

  const wrk = new Worker(new URL('@/workers/dbWorker.ts', import.meta.url), { type: 'module' });
  dbWorker = wrap<IDBWorker>(wrk);

  const existingData = await loadDbFromDisk();
  await dbWorker.init(existingData);
  initialized = true;

  await initTables();
  return dbWorker;
}

export async function saveDb(): Promise<void> {
  if (!dbWorker || !initialized) return;
  try {
    const data = await dbWorker.exportDb();
    await saveDbToDisk(data);
  } catch (e) {
    console.error('Failed to save database:', e);
  }
}

async function initTables() {
  if (!dbWorker) return;

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
      knowledge_area TEXT DEFAULT '',
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
      synced INTEGER NOT NULL DEFAULT 0
    )
  `);

  await dbWorker.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      plain_text TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      image_urls TEXT NOT NULL DEFAULT '[]',
      linked_mistake_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    )
  `);

  await dbWorker.exec(`
    CREATE TABLE IF NOT EXISTS sync_operations (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      timestamp TEXT NOT NULL,
      device_id TEXT NOT NULL DEFAULT '',
      synced INTEGER NOT NULL DEFAULT 0
    )
  `);

  await dbWorker.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `);

  // Migrate: add new columns for older databases
  for (const col of [
    'ALTER TABLE mistakes ADD COLUMN content TEXT DEFAULT \'\'',
    'ALTER TABLE mistakes ADD COLUMN answer TEXT DEFAULT \'\'',
    'ALTER TABLE mistakes ADD COLUMN answer_images TEXT NOT NULL DEFAULT \'[]\'',
    'ALTER TABLE mistakes ADD COLUMN difficulty TEXT DEFAULT \'0\'',
    'ALTER TABLE mistakes ADD COLUMN knowledge_points TEXT NOT NULL DEFAULT \'[]\'',
    'ALTER TABLE mistakes ADD COLUMN year TEXT DEFAULT \'\'',
    'ALTER TABLE mistakes ADD COLUMN knowledge_area TEXT DEFAULT \'\'',
    'ALTER TABLE mistakes ADD COLUMN source_paper_type TEXT DEFAULT \'\'',
    'ALTER TABLE mistakes ADD COLUMN source_paper_name TEXT DEFAULT \'\'',
    'ALTER TABLE mistakes ADD COLUMN question_number TEXT DEFAULT \'\'',
  ]) {
    try { await dbWorker.exec(col); } catch { /* column may already exist */ }
  }

  await dbWorker.exec(`CREATE INDEX IF NOT EXISTS idx_mistakes_created ON mistakes(created_at)`);
  await dbWorker.exec(`CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at)`);
  await dbWorker.exec(`CREATE INDEX IF NOT EXISTS idx_sync_ops_synced ON sync_operations(synced)`);
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

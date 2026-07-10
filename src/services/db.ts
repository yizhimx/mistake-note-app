import { wrap, Remote } from 'comlink';

export interface IDBWorker {
  init(): Promise<void>;
  exec(sql: string, params?: any[]): Promise<any>;
  get(sql: string, params?: any[]): Promise<any>;
  all(sql: string, params?: any[]): Promise<any[]>;
  run(sql: string, params?: any[]): Promise<{ changes: number; lastID: number }>;
  close(): Promise<void>;
}

let dbWorker: Remote<IDBWorker> | null = null;
let initialized = false;

export async function getDb(): Promise<Remote<IDBWorker>> {
  if (dbWorker && initialized) return dbWorker;

  const Worker = new Worker(new URL('@/workers/dbWorker.ts', import.meta.url), { type: 'module' });
  dbWorker = wrap<IDBWorker>(Worker);
  await dbWorker.init();
  initialized = true;

  await initTables();
  return dbWorker;
}

async function initTables() {
  if (!dbWorker) return;

  await dbWorker.exec(`
    CREATE TABLE IF NOT EXISTS mistakes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      image_urls TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      subject TEXT DEFAULT '',
      notes TEXT DEFAULT '',
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

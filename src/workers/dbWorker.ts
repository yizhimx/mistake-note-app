import initSqlJs from 'sql.js';
import { expose } from 'comlink';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
let db: ReturnType<typeof SQL.Database> | null = null;

const dbWorker = {
  async init(existingData?: Uint8Array): Promise<void> {
    SQL = await initSqlJs({
      locateFile: () => wasmUrl,
    });
    db = existingData ? new SQL.Database(existingData) : new SQL.Database();
    db.run('PRAGMA journal_mode=WAL');
  },

  exec(sql: string, params?: any[]): any {
    if (!db) throw new Error('Database not initialized');
    if (params) {
      return db.run(sql, params);
    }
    return db.exec(sql);
  },

  get(sql: string, params?: any[]): any {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare(sql);
    if (params) stmt.bind(params);
    if (stmt.step()) {
      const result = stmt.getAsObject();
      stmt.free();
      return result;
    }
    stmt.free();
    return null;
  },

  all(sql: string, params?: any[]): any[] {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare(sql);
    if (params) stmt.bind(params);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  run(sql: string, params?: any[]): { changes: number; lastID: number } {
    if (!db) throw new Error('Database not initialized');
    db.run(sql, params);
    return {
      changes: db.getRowsModified(),
      lastID: 0,
    };
  },

  exportDb(): Uint8Array {
    if (!db) throw new Error('Database not initialized');
    return db.export();
  },

  close(): void {
    db?.close();
    db = null;
  },
};

expose(dbWorker);

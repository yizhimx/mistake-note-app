import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { expose } from 'comlink';

let db: SqlJsDatabase | null = null;

const dbWorker = {
  async init(): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    });
    db = new SQL.Database();
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

  close(): void {
    db?.close();
    db = null;
  },
};

expose(dbWorker);

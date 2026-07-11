import { getDb, saveDb } from './db';
import type { NoteRecord } from '@/stores/noteStore';

function toDb(row: any): NoteRecord {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject || '',
    volume: row.volume || '',
    chapter: row.chapter || '',
    section: row.section || '',
    summary: row.summary || '',
    isFolder: row.is_folder === 1,
    content: row.content,
    plainText: row.plain_text || '',
    tags: JSON.parse(row.tags || '[]'),
    knowledgePoints: JSON.parse(row.knowledge_points || '[]'),
    tips: JSON.parse(row.tips || '[]'),
    imageUrls: JSON.parse(row.image_urls || '[]'),
    linkedMistakeIds: JSON.parse(row.linked_mistake_ids || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: row.synced === 1,
  };
}

function toDbRow(r: NoteRecord) {
  return [
    r.id,
    r.title,
    r.subject,
    r.volume,
    r.chapter,
    r.section,
    r.summary,
    r.isFolder ? 1 : 0,
    r.content,
    r.plainText,
    JSON.stringify(r.tags),
    JSON.stringify(r.knowledgePoints),
    JSON.stringify(r.tips),
    JSON.stringify(r.imageUrls),
    JSON.stringify(r.linkedMistakeIds),
    r.createdAt,
    r.updatedAt,
    r.synced ? 1 : 0,
  ];
}

export async function fetchNotes(): Promise<NoteRecord[]> {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM notes ORDER BY updated_at DESC');
  return rows.map(toDb);
}

export async function fetchNoteById(id: string): Promise<NoteRecord | null> {
  const db = await getDb();
  const row = await db.get('SELECT * FROM notes WHERE id = ?', [id]);
  return row ? toDb(row) : null;
}

export async function addNote(r: NoteRecord): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO notes (
      id, title, subject, volume, chapter, section, summary, is_folder, content, plain_text,
      tags, knowledge_points, tips, image_urls, linked_mistake_ids, created_at, updated_at, synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    toDbRow(r),
  );
  await saveDb();
}

export async function updateNote(id: string, data: Partial<NoteRecord>): Promise<void> {
  const existing = await fetchNoteById(id);
  if (!existing) return;
  const merged = { ...existing, ...data, updatedAt: new Date().toISOString() };
  const db = await getDb();
  await db.run(
    `UPDATE notes SET
      title=?, subject=?, volume=?, chapter=?, section=?, summary=?, is_folder=?, content=?, plain_text=?,
      tags=?, knowledge_points=?, tips=?, image_urls=?, linked_mistake_ids=?, updated_at=?, synced=?
    WHERE id=?`,
    [
      merged.title, merged.subject, merged.volume, merged.chapter, merged.section,
      merged.summary, merged.isFolder ? 1 : 0, merged.content, merged.plainText,
      JSON.stringify(merged.tags), JSON.stringify(merged.knowledgePoints),
      JSON.stringify(merged.tips), JSON.stringify(merged.imageUrls),
      JSON.stringify(merged.linkedMistakeIds), merged.updatedAt,
      merged.synced ? 1 : 0, id,
    ],
  );
  await saveDb();
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM notes WHERE id = ?', [id]);
  await saveDb();
}

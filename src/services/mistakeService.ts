import { getDb, saveDb } from './db';
import type { MistakeRecord } from '@/stores/mistakeStore';

function toDb(row: any): MistakeRecord {
  return {
    id: row.id,
    title: row.title,
    imageUrls: JSON.parse(row.image_urls || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    subject: row.subject || '',
    notes: row.notes || '',
    answer: row.answer || '',
    answerImages: JSON.parse(row.answer_images || '[]'),
    difficulty: row.difficulty || '',
    knowledgePoints: JSON.parse(row.knowledge_points || '[]'),
    aiAnalysis: row.ai_analysis || null,
    ocrText: row.ocr_text || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewCount: row.review_count || 0,
    lastReviewAt: row.last_review_at || null,
    masteryLevel: row.mastery_level || null,
    sm2Data: row.sm2_data || null,
    linkedNoteIds: JSON.parse(row.linked_note_ids || '[]'),
    synced: row.synced === 1,
  };
}

function toDbRow(r: MistakeRecord) {
  return [
    r.id,
    r.title,
    JSON.stringify(r.imageUrls),
    JSON.stringify(r.tags),
    r.subject,
    r.notes,
    r.answer || '',
    JSON.stringify(r.answerImages || []),
    r.difficulty || '',
    JSON.stringify(r.knowledgePoints || []),
    r.aiAnalysis || null,
    r.ocrText || null,
    r.createdAt,
    r.updatedAt,
    r.reviewCount,
    r.lastReviewAt || null,
    r.masteryLevel || null,
    r.sm2Data || null,
    JSON.stringify(r.linkedNoteIds),
    r.synced ? 1 : 0,
  ];
}

export async function fetchMistakes(): Promise<MistakeRecord[]> {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM mistakes ORDER BY created_at DESC');
  return rows.map(toDb);
}

export async function fetchMistakeById(id: string): Promise<MistakeRecord | null> {
  const db = await getDb();
  const row = await db.get('SELECT * FROM mistakes WHERE id = ?', [id]);
  return row ? toDb(row) : null;
}

export async function addMistake(r: MistakeRecord): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO mistakes (
      id, title, image_urls, tags, subject, notes,
      answer, answer_images, difficulty, knowledge_points,
      ai_analysis, ocr_text, created_at, updated_at,
      review_count, last_review_at, mastery_level, sm2_data,
      linked_note_ids, synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    toDbRow(r),
  );
  await saveDb();
}

export async function updateMistake(id: string, data: Partial<MistakeRecord>): Promise<void> {
  const existing = await fetchMistakeById(id);
  if (!existing) return;
  const merged = { ...existing, ...data, updatedAt: new Date().toISOString() };
  const db = await getDb();
  await db.run(
    `UPDATE mistakes SET
      title=?, image_urls=?, tags=?, subject=?, notes=?,
      answer=?, answer_images=?, difficulty=?, knowledge_points=?,
      ai_analysis=?, ocr_text=?, updated_at=?,
      review_count=?, last_review_at=?, mastery_level=?, sm2_data=?,
      linked_note_ids=?, synced=?
    WHERE id=?`,
    [
      merged.title,
      JSON.stringify(merged.imageUrls),
      JSON.stringify(merged.tags),
      merged.subject,
      merged.notes,
      merged.answer || '',
      JSON.stringify(merged.answerImages || []),
      merged.difficulty || '',
      JSON.stringify(merged.knowledgePoints || []),
      merged.aiAnalysis || null,
      merged.ocrText || null,
      merged.updatedAt,
      merged.reviewCount,
      merged.lastReviewAt || null,
      merged.masteryLevel || null,
      merged.sm2Data || null,
      JSON.stringify(merged.linkedNoteIds),
      merged.synced ? 1 : 0,
      id,
    ],
  );
  await saveDb();
}

export async function deleteMistake(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM mistakes WHERE id = ?', [id]);
  await saveDb();
}

export async function searchMistakes(params: {
  subject?: string;
  tags?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<MistakeRecord[]> {
  const conditions: string[] = [];
  const values: any[] = [];

  if (params.subject) {
    conditions.push('subject = ?');
    values.push(params.subject);
  }
  if (params.tags) {
    conditions.push("tags LIKE ?");
    values.push(`%${params.tags}%`);
  }
  if (params.dateFrom) {
    conditions.push('created_at >= ?');
    values.push(params.dateFrom);
  }
  if (params.dateTo) {
    conditions.push('created_at <= ?');
    values.push(params.dateTo);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const db = await getDb();
  const rows = await db.all(`SELECT * FROM mistakes ${where} ORDER BY created_at DESC`, values);
  return rows.map(toDb);
}

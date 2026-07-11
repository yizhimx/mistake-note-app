import { getDb, saveDb } from './db';
import type { MistakeRecord } from '@/stores/mistakeStore';

function toDb(row: any): MistakeRecord {
  let knowledgeAreas: string[];
  try {
    knowledgeAreas = JSON.parse(row.knowledge_areas || '[]');
    if (!Array.isArray(knowledgeAreas)) knowledgeAreas = [];
  } catch {
    knowledgeAreas = row.knowledge_area ? [row.knowledge_area] : [];
  }
  return {
    id: row.id,
    title: row.title || '',
    content: row.content || '',
    imageUrls: JSON.parse(row.image_urls || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    subject: row.subject || '',
    notes: row.notes || '',
    answer: row.answer || '',
    answerImages: JSON.parse(row.answer_images || '[]'),
    difficulty: parseInt(row.difficulty, 10) || 0,
    knowledgePoints: JSON.parse(row.knowledge_points || '[]'),
    year: row.year || '',
    knowledgeAreas,
    sourcePaperType: row.source_paper_type || '',
    sourcePaperName: row.source_paper_name || '',
    questionNumber: row.question_number || '',
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

function safe(v: any): any {
  return v === undefined ? null : v;
}

function toDbRow(r: MistakeRecord) {
  return [
    safe(r.id),
    safe(r.title),
    safe(r.content),
    safe(JSON.stringify(r.imageUrls)),
    safe(JSON.stringify(r.tags)),
    safe(r.subject),
    safe(r.notes),
    safe(r.answer || ''),
    safe(JSON.stringify(r.answerImages || [])),
    safe(String(r.difficulty || 0)),
    safe(JSON.stringify(r.knowledgePoints || [])),
    safe(r.year || ''),
    safe(JSON.stringify(r.knowledgeAreas || [])),
    safe(r.sourcePaperType || ''),
    safe(r.sourcePaperName || ''),
    safe(r.questionNumber || ''),
    safe(r.aiAnalysis || null),
    safe(r.ocrText || null),
    safe(r.createdAt),
    safe(r.updatedAt),
    safe(r.reviewCount),
    safe(r.lastReviewAt || null),
    safe(r.masteryLevel || null),
    safe(r.sm2Data || null),
    safe(JSON.stringify(r.linkedNoteIds)),
    safe(r.synced ? 1 : 0),
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

const INSERT_COLS = [
  'id', 'title', 'content', 'image_urls', 'tags', 'subject', 'notes',
  'answer', 'answer_images', 'difficulty', 'knowledge_points',
  'year', 'knowledge_areas', 'source_paper_type', 'source_paper_name', 'question_number',
  'ai_analysis', 'ocr_text', 'created_at', 'updated_at',
  'review_count', 'last_review_at', 'mastery_level', 'sm2_data',
  'linked_note_ids', 'synced',
];
const PLACEHOLDERS = INSERT_COLS.map(() => '?').join(', ');

export async function addMistake(r: MistakeRecord): Promise<void> {
  const db = await getDb();
  const values = toDbRow(r);
  const undefIdx = values.findIndex(v => v === undefined);
  if (undefIdx !== -1) {
    console.error('Undefined value at index', undefIdx, 'in toDbRow');
  }
  await db.run(
    `INSERT INTO mistakes (${INSERT_COLS.join(', ')}) VALUES (${PLACEHOLDERS})`,
    values,
  );
  await saveDb();
}

const UPDATE_COLS = [
  'title', 'content', 'image_urls', 'tags', 'subject', 'notes',
  'answer', 'answer_images', 'difficulty', 'knowledge_points',
  'year', 'knowledge_areas', 'source_paper_type', 'source_paper_name', 'question_number',
  'ai_analysis', 'ocr_text', 'updated_at',
  'review_count', 'last_review_at', 'mastery_level', 'sm2_data',
  'linked_note_ids', 'synced',
];

export async function updateMistake(id: string, data: Partial<MistakeRecord>): Promise<void> {
  const existing = await fetchMistakeById(id);
  if (!existing) return;
  const merged = { ...existing, ...data, updatedAt: new Date().toISOString() };
  const db = await getDb();
  const setClause = UPDATE_COLS.map(c => `${c}=?`).join(', ');
  await db.run(
    `UPDATE mistakes SET ${setClause} WHERE id=?`,
    [
      safe(merged.title),
      safe(merged.content),
      safe(JSON.stringify(merged.imageUrls)),
      safe(JSON.stringify(merged.tags)),
      safe(merged.subject),
      safe(merged.notes),
      safe(merged.answer || ''),
      safe(JSON.stringify(merged.answerImages || [])),
      safe(String(merged.difficulty || 0)),
      safe(JSON.stringify(merged.knowledgePoints || [])),
      safe(merged.year || ''),
      safe(JSON.stringify(merged.knowledgeAreas || [])),
      safe(merged.sourcePaperType || ''),
      safe(merged.sourcePaperName || ''),
      safe(merged.questionNumber || ''),
      safe(merged.aiAnalysis || null),
      safe(merged.ocrText || null),
      safe(merged.updatedAt),
      safe(merged.reviewCount),
      safe(merged.lastReviewAt || null),
      safe(merged.masteryLevel || null),
      safe(merged.sm2Data || null),
      safe(JSON.stringify(merged.linkedNoteIds)),
      safe(merged.synced ? 1 : 0),
      safe(id),
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

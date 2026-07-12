import { getDb, saveDb } from './db';

export interface SplitQuestion {
  content: string;
  subject: string;
  difficulty: number;
  knowledgeAreas: string[];
}

export interface AiQueueItem {
  id: string;
  mistakeId: string | null;
  imageData: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  resultContent: string | null;
  resultDifficulty: number | null;
  resultSubject: string | null;
  resultKnowledgeAreas: string[] | null;
  resultQuestions: SplitQuestion[] | null;
  error: string | null;
  createdAt: string;
  processedAt: string | null;
}

function toItem(row: any): AiQueueItem {
  let areas: string[] = [];
  try { areas = JSON.parse(row.result_knowledge_areas || '[]'); } catch { areas = []; }
  return {
    id: row.id,
    mistakeId: row.mistake_id || null,
    imageData: row.image_data || '',
    status: row.status || 'pending',
    resultContent: row.result_content || null,
    resultDifficulty: row.result_difficulty ? parseInt(row.result_difficulty, 10) : null,
    resultSubject: row.result_subject || null,
    resultKnowledgeAreas: areas,
    resultQuestions: row.result_questions ? JSON.parse(row.result_questions) : null,
    error: row.error || null,
    createdAt: row.created_at,
    processedAt: row.processed_at || null,
  };
}

function safe(v: any): any {
  return v === undefined ? null : v;
}

export async function fetchQueueItems(): Promise<AiQueueItem[]> {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM ai_queue ORDER BY created_at DESC');
  return rows.map(toItem);
}

export async function fetchQueueItem(id: string): Promise<AiQueueItem | null> {
  const db = await getDb();
  const row = await db.get('SELECT * FROM ai_queue WHERE id = ?', [id]);
  return row ? toItem(row) : null;
}

export async function addQueueItem(item: AiQueueItem): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO ai_queue (id, mistake_id, image_data, status, result_content, result_difficulty, result_subject, result_knowledge_areas, result_questions, error, created_at, processed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      safe(item.id),
      safe(item.mistakeId),
      safe(item.imageData),
      safe(item.status),
      safe(item.resultContent),
      safe(item.resultDifficulty !== null ? String(item.resultDifficulty) : null),
      safe(item.resultSubject),
      safe(JSON.stringify(item.resultKnowledgeAreas)),
      safe(JSON.stringify(item.resultQuestions)),
      safe(item.error),
      safe(item.createdAt),
      safe(item.processedAt),
    ],
  );
  saveDb();
}

export async function updateQueueItem(id: string, data: Partial<AiQueueItem>): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.status !== undefined) { fields.push('status=?'); values.push(data.status); }
  if (data.resultContent !== undefined) { fields.push('result_content=?'); values.push(data.resultContent); }
  if (data.resultDifficulty !== undefined) { fields.push('result_difficulty=?'); values.push(String(data.resultDifficulty)); }
  if (data.resultSubject !== undefined) { fields.push('result_subject=?'); values.push(data.resultSubject); }
  if (data.resultKnowledgeAreas !== undefined) { fields.push('result_knowledge_areas=?'); values.push(JSON.stringify(data.resultKnowledgeAreas)); }
  if (data.resultQuestions !== undefined) { fields.push('result_questions=?'); values.push(JSON.stringify(data.resultQuestions)); }
  if (data.error !== undefined) { fields.push('error=?'); values.push(data.error); }
  if (data.processedAt !== undefined) { fields.push('processed_at=?'); values.push(data.processedAt); }

  if (fields.length === 0) return;
  values.push(id);
  const db = await getDb();
  await db.run(`UPDATE ai_queue SET ${fields.join(', ')} WHERE id=?`, values);
  saveDb();
}

export async function deleteQueueItem(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM ai_queue WHERE id = ?', [id]);
  saveDb();
}

export async function clearCompletedQueueItems(): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM ai_queue WHERE status IN ('completed', 'failed', 'cancelled')");
  saveDb();
}

export async function deleteQueueItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(', ');
  await db.run(`DELETE FROM ai_queue WHERE id IN (${placeholders})`, ids);
  saveDb();
}

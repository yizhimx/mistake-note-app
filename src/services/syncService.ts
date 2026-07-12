import { getDb, saveDb } from './db';
import { loadImage, saveImageData, extractImageRefs } from '@/services/imageStore';
import { useSyncStore } from '@/stores/syncStore';
import { getSupabaseClient, getCurrentUser } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

let syncTimer: ReturnType<typeof setInterval> | null = null;
const SYNC_INTERVAL = 30000;

export function startSync() {
  if (syncTimer) return;
  syncTimer = setInterval(doSync, SYNC_INTERVAL);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}

export function stopSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
}

function handleOnline() {
  useSyncStore().setOnline(true);
  doSync();
}

function handleOffline() {
  useSyncStore().setOnline(false);
}

export function triggerSync() { doSync(); }

async function doSync() {
  const store = useSyncStore();
  if (!store.isOnline) return;
  if (store.syncState === 'syncing') return;
  store.syncState = 'syncing';

  const supabase = getSupabaseClient();
  if (!supabase) { store.syncState = 'error'; return; }
  const user = getCurrentUser();
  if (!user) { store.syncState = 'idle'; return; }
  store.userEmail = user.email ?? null;

  try {
    await pushUnsynced(supabase);
    await pullRemote(supabase, store.lastSyncAt);
    store.setLastSyncAt(new Date().toISOString());
    store.syncState = 'synced';
  } catch (e) {
    console.warn('Sync failed:', e);
    store.syncState = 'error';
    store.lastError = String(e);
  } finally {
    saveDb();
  }
}

// ── Push local unsynced records to Supabase ──

async function pushUnsynced(supabase: SupabaseClient) {
  const db = await getDb();
  const user = getCurrentUser();

  const mistakes = await db.all('SELECT * FROM mistakes WHERE synced = 0');
  if (mistakes.length > 0) {
    const { error } = await supabase.from('mistakes').upsert(mistakes.map(mistakeRowToSupabase), { onConflict: 'id' });
    if (!error) {
      await db.run('UPDATE mistakes SET synced = 1 WHERE synced = 0');
      if (user) {
        for (const row of mistakes) await uploadLocalImagesForRecord(supabase, row, user.id);
      }
    }
  }

  const notes = await db.all('SELECT * FROM notes WHERE synced = 0');
  if (notes.length > 0) {
    const { error } = await supabase.from('notes').upsert(notes.map(noteRowToSupabase), { onConflict: 'id' });
    if (!error) {
      await db.run('UPDATE notes SET synced = 1 WHERE synced = 0');
      if (user) {
        for (const row of notes) await uploadLocalImagesForRecord(supabase, row, user.id);
      }
    }
  }
}

// ── Pull remote records from Supabase ──

async function pullRemote(supabase: SupabaseClient, lastSyncAt: string | null) {
  const since = lastSyncAt || '1970-01-01T00:00:00.000Z';
  const db = await getDb();

  const { data: remoteMistakes, error: mErr } = await supabase
    .from('mistakes')
    .select('*')
    .gt('updated_at', since);
  if (mErr) throw mErr;
  const user = getCurrentUser();
  for (const row of remoteMistakes || []) {
    await upsertMistakeLocal(db, row);
    if (user) await downloadMissingImagesForRecord(supabase, row, user.id);
  }

  const { data: remoteNotes, error: nErr } = await supabase
    .from('notes')
    .select('*')
    .gt('updated_at', since);
  if (nErr) throw nErr;
  for (const row of remoteNotes || []) {
    await upsertNoteLocal(db, row);
    if (user) await downloadMissingImagesForRecord(supabase, row, user.id);
  }
}

// ── Data mapping helpers ──

function mistakeRowToSupabase(row: any) {
  return {
    id: row.id,
    title: row.title || '',
    content: row.content || '',
    answer: row.answer || '',
    ai_analysis: row.ai_analysis || null,
    ocr_text: row.ocr_text || null,
    subject: row.subject || null,
    notes: row.notes || null,
    difficulty: parseInt(row.difficulty) || 0,
    image_urls: safeJsonParse(row.image_urls, []),
    tags: safeJsonParse(row.tags, []),
    answer_images: safeJsonParse(row.answer_images, []),
    knowledge_points: safeJsonParse(row.knowledge_points, []),
    knowledge_areas: safeJsonParse(row.knowledge_areas, []),
    linked_note_ids: safeJsonParse(row.linked_note_ids, []),
    year: row.year || null,
    source_paper_type: row.source_paper_type || null,
    source_paper_name: row.source_paper_name || null,
    question_number: row.question_number || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    review_count: row.review_count || 0,
    last_review_at: row.last_review_at || null,
    mastery_level: row.mastery_level || null,
    sm2_data: row.sm2_data ? safeJsonParse(row.sm2_data, null) : null,
    deleted: row.deleted === 1 ? 1 : 0,
  };
}

function noteRowToSupabase(row: any) {
  return {
    id: row.id,
    title: row.title || '',
    subject: row.subject || '',
    volume: row.volume || '',
    chapter: row.chapter || '',
    section: row.section || '',
    summary: row.summary || '',
    is_folder: row.is_folder ? 1 : 0,
    content: row.content || '',
    plain_text: row.plain_text || '',
    tags: safeJsonParse(row.tags, []),
    knowledge_points: safeJsonParse(row.knowledge_points, []),
    tips: safeJsonParse(row.tips, []),
    image_urls: safeJsonParse(row.image_urls, []),
    linked_mistake_ids: safeJsonParse(row.linked_mistake_ids, []),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted: row.deleted === 1 ? 1 : 0,
  };
}

async function upsertMistakeLocal(db: any, row: any) {
  if (row.deleted === true || row.deleted === 1 || row.deleted === '1') {
    await db.run('DELETE FROM mistakes WHERE id = ?', [row.id]);
    return;
  }
  const fields = [
    'id','title','content','answer','image_urls','tags','subject','notes',
    'answer_images','difficulty','knowledge_points','year','knowledge_areas',
    'source_paper_type','source_paper_name','question_number','ai_analysis','ocr_text',
    'created_at','updated_at','review_count','last_review_at','mastery_level',
    'sm2_data','linked_note_ids','synced',
  ];
  const vals = fields.map(f => {
    if (f === 'synced') return 1;
    if (f === 'difficulty') return (row.difficulty ?? 0).toString();
    if (['image_urls','tags','answer_images','knowledge_points','knowledge_areas','linked_note_ids'].includes(f)) {
      return JSON.stringify(row[f] ?? []);
    }
    if (f === 'sm2_data') return row[f] ? JSON.stringify(row[f]) : null;
    if (row[f] === undefined || row[f] === null) return null;
    return String(row[f]);
  });
  const q = fields.map(() => '?').join(',');
  await db.run(`INSERT OR REPLACE INTO mistakes (${fields.join(',')}) VALUES (${q})`, vals);
}

async function upsertNoteLocal(db: any, row: any) {
  if (row.deleted === true || row.deleted === 1 || row.deleted === '1') {
    await db.run('DELETE FROM notes WHERE id = ?', [row.id]);
    return;
  }
  const fields = [
    'id','title','subject','volume','chapter','section','summary','is_folder',
    'content','plain_text','tags','knowledge_points','tips','image_urls',
    'linked_mistake_ids','created_at','updated_at','synced',
  ];
  const vals = fields.map(f => {
    if (f === 'synced') return 1;
    if (f === 'is_folder') return row.is_folder ? 1 : 0;
    if (['tags','knowledge_points','tips','image_urls','linked_mistake_ids'].includes(f)) {
      return JSON.stringify(row[f] ?? []);
    }
    if (row[f] === undefined || row[f] === null) return null;
    return String(row[f]);
  });
  const q = fields.map(() => '?').join(',');
  await db.run(`INSERT OR REPLACE INTO notes (${fields.join(',')}) VALUES (${q})`, vals);
}

function safeJsonParse(val: any, fallback: any): any {
  if (val === null || val === undefined) return fallback;
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const header = parts[0] || '';
  const base64 = parts[1] || '';
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}

function blobToFileReader(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function collectImageRefsFromRecord(row: any): string[] {
  const refs = new Set<string>();
  for (const field of ['content', 'answer']) {
    if (row[field]) {
      for (const ref of extractImageRefs(row[field])) {
        if (ref.startsWith('local:')) refs.add(ref);
      }
    }
  }
  for (const jsonField of ['image_urls', 'answer_images']) {
    if (row[jsonField]) {
      try {
        const arr = JSON.parse(row[jsonField]);
        if (Array.isArray(arr)) {
          for (const ref of arr) {
            if (typeof ref === 'string' && ref.startsWith('local:')) refs.add(ref);
          }
        }
      } catch { /* ignore */ }
    }
  }
  return Array.from(refs);
}

async function uploadLocalImagesForRecord(supabase: SupabaseClient, row: any, userId: string): Promise<void> {
  const refs = collectImageRefsFromRecord(row);
  for (const ref of refs) {
    if (!ref.startsWith('local:')) continue;
    const db = await getDb();
    const existing = await db.get('SELECT 1 FROM uploaded_images WHERE id = ? AND user_id = ?', [ref, userId]);
    if (existing) continue;
    const dataUrl = await loadImage(ref);
    if (!dataUrl) continue;
    const filename = ref.replace('local:', '');
    const blob = dataUrlToBlob(dataUrl);
    const { error } = await supabase.storage.from('images').upload(`${userId}/${filename}`, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    });
    if (!error) {
      await db.run('INSERT OR IGNORE INTO uploaded_images (id, user_id) VALUES (?, ?)', [ref, userId]);
    }
  }
}

async function downloadMissingImagesForRecord(supabase: SupabaseClient, row: any, userId: string): Promise<void> {
  const refs = collectImageRefsFromRecord(row);
  for (const ref of refs) {
    if (!ref.startsWith('local:')) continue;
    const existing = await loadImage(ref);
    if (existing) continue;
    const filename = ref.replace('local:', '');
    const { data, error } = await supabase.storage.from('images').download(`${userId}/${filename}`);
    if (error || !data) continue;
    const dataUrl = await blobToFileReader(data);
    if (dataUrl) {
      await saveImageData(ref, dataUrl);
      const db = await getDb();
      await db.run('INSERT OR IGNORE INTO uploaded_images (id, user_id) VALUES (?, ?)', [ref, userId]);
    }
  }
}

import { dataUrlToBlob } from '@/services/imageStore';
import { getDb, saveDb, getSetting, setSetting } from './db';
import { loadImage, saveImage, saveImageData, extractImageRefs } from '@/services/imageStore';
import { isCloudStoreConfigured } from '@/services/cloudStore';
import { useSyncStore } from '@/stores/syncStore';
import { getSupabaseClient, getCurrentUser } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useQuasar } from 'quasar';

export interface ConflictRow {
  id: string;
  entity_type: string;
  entity_id: string;
  local_data: string;
  remote_data: string;
  created_at: string;
  resolved: number;
}

let syncTimer: ReturnType<typeof setInterval> | null = null;
const SYNC_INTERVAL = 30000;

export function startSync() {
  // [CLOUD DISABLED] Temporary no-op for local-only mode.
  // Re-enable: uncomment callers in App.vue/MainLayout.vue and remove the early return below.
  return; /*
  if (syncTimer) return;
  syncTimer = setInterval(doSync, SYNC_INTERVAL);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  */
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

export function triggerSync() {
  // [CLOUD DISABLED] Temporary no-op for local-only mode.
  return; /*
  doSync();
  */
}

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
    await migrateLocalToCloud();
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
      // Upload images BEFORE marking synced — if upload fails, record stays unsynced for retry
      if (user) {
        for (const row of mistakes) await uploadLocalImagesForRecord(supabase, row, user.id);
      }
      await db.run('UPDATE mistakes SET synced = 1 WHERE synced = 0');
    }
  }

  const notes = await db.all('SELECT * FROM notes WHERE synced = 0');
  if (notes.length > 0) {
    const { error } = await supabase.from('notes').upsert(notes.map(noteRowToSupabase), { onConflict: 'id' });
    if (!error) {
      if (user) {
        for (const row of notes) await uploadLocalImagesForRecord(supabase, row, user.id);
      }
      await db.run('UPDATE notes SET synced = 1 WHERE synced = 0');
    }
  }

  // Safety net: retry previously-failed image uploads for ANY record with local: refs
  if (user) {
    const mistakenRows = await db.all(
      `SELECT * FROM mistakes WHERE content LIKE '%local:%' OR answer LIKE '%local:%' OR image_urls LIKE '%local:%' OR answer_images LIKE '%local:%'`
    );
    for (const row of mistakenRows) await uploadLocalImagesForRecord(supabase, row, user.id);
    const noteRows = await db.all(
      `SELECT * FROM notes WHERE content LIKE '%local:%' OR image_urls LIKE '%local:%'`
    );
    for (const row of noteRows) await uploadLocalImagesForRecord(supabase, row, user.id);
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
  // Detect conflict: local has unsynced edits and a remote version arrived
  const existing = await db.get('SELECT * FROM mistakes WHERE id = ?', [row.id]);
  if (existing && existing.synced === 0) {
    await recordConflict(db, 'mistake', row.id, existing, row);
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
  // Detect conflict: local has unsynced edits and a remote version arrived
  const existing = await db.get('SELECT * FROM notes WHERE id = ?', [row.id]);
  if (existing && existing.synced === 0) {
    await recordConflict(db, 'note', row.id, existing, row);
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

/**
 * Migrate existing `local:` image references to `cloud:` references.
 * Uploads each local image to 缤纷云 and replaces the ref in the database.
 * Runs once per sync cycle; idempotent — already-migrated refs are skipped.
 */
async function migrateLocalToCloud() {
  if (!isCloudStoreConfigured()) return;
  // One-time migration guard: skip if already done
  const done = await getSetting('local_migration_done');
  if (done) return;
  const db = await getDb();
  const tables: Array<{ name: string; textCols: string[]; jsonCols: string[] }> = [
    { name: 'mistakes', textCols: ['content', 'answer'], jsonCols: ['image_urls', 'answer_images'] },
    { name: 'notes', textCols: ['content'], jsonCols: ['image_urls'] },
  ];
  for (const table of tables) {
    const allCols = [...table.textCols, ...table.jsonCols];
    const where = allCols.map(c => `${c} LIKE '%local:%'`).join(' OR ');
    const rows = await db.all(`SELECT id, ${allCols.join(',')} FROM ${table.name} WHERE ${where}`);
    for (const row of rows) {
      let changed = false;
      const updates: Record<string, string> = {};
      // Migrate text columns (markdown content/answer)
      for (const col of table.textCols) {
        if (!row[col] || !row[col].includes('local:')) continue;
        const newText = await _migrateText(row[col]);
        if (newText !== row[col]) {
          updates[col] = newText;
          changed = true;
        }
      }
      // Migrate JSON columns (image_urls / answer_images arrays)
      for (const col of table.jsonCols) {
        if (!row[col]) continue;
        try {
          const arr = JSON.parse(row[col]);
          if (!Array.isArray(arr)) continue;
          let arrChanged = false;
          const newArr = await Promise.all(arr.map(async (item: any) => {
            if (typeof item === 'string' && item.startsWith('local:')) {
              const cloudRef = await _migrateSingleRef(item);
              if (cloudRef && cloudRef !== item) { arrChanged = true; return cloudRef; }
            }
            return item;
          }));
          if (arrChanged) {
            updates[col] = JSON.stringify(newArr);
            changed = true;
          }
        } catch { /* ignore parse errors */ }
      }
      if (changed) {
        const setClauses = Object.keys(updates).map(k => `${k}=?`).join(',');
        const values = [...Object.values(updates), row.id];
        await db.run(`UPDATE ${table.name} SET ${setClauses}, synced=0 WHERE id=?`, values);
      }
    }
  }
  await setSetting('local_migration_done', '1');
}

/** Upload a single local: ref to cloud and return the cloud: ref. */
async function _migrateSingleRef(ref: string): Promise<string> {
  if (!ref.startsWith('local:')) return ref;
  const dataUrl = await loadImage(ref);
  if (!dataUrl) return ref;
  try {
    const cloudRef = await saveImage(dataUrl);
    if (cloudRef && cloudRef.startsWith('cloud:')) return cloudRef;
  } catch (e) {
    console.warn('[migrate] upload failed for', ref, e);
  }
  return ref;
}

/** Migrate all local: refs in a text blob to cloud: refs. */
async function _migrateText(text: string): Promise<string> {
  const refs = extractImageRefs(text);
  let result = text;
  for (const ref of refs) {
    if (!ref.startsWith('local:')) continue;
    const cloudRef = await _migrateSingleRef(ref);
    if (cloudRef !== ref) {
      result = result.replaceAll(ref, cloudRef);
    }
  }
  return result;
}


async function uploadLocalImagesForRecord(supabase: SupabaseClient, row: any, userId: string): Promise<void> {
  const refs = collectImageRefsFromRecord(row);
  for (const ref of refs) {
    if (!ref.startsWith('local:')) continue;
    const db = await getDb();
    const existing = await db.get('SELECT 1 FROM uploaded_images WHERE id = ? AND user_id = ?', [ref, userId]);
    if (existing) continue;
    const dataUrl = await loadImage(ref);
    if (!dataUrl) { console.warn('[sync] upload: loadImage failed for', ref); continue; }
    const filename = ref.replace('local:', '');
    const uploadPath = `${userId}/${filename}`;
    console.log('[sync] uploadLocalImagesForRecord:', ref, '→', uploadPath, 'dataUrl length:', dataUrl.length);
    const blob = dataUrlToBlob(dataUrl);
    console.log('[sync] uploading to storage:', uploadPath, 'blob:', blob.type, blob.size);
    const { error } = await supabase.storage.from('images').upload(uploadPath, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    });
    if (!error) {
      console.log('[sync] upload OK:', uploadPath);
      await db.run('INSERT OR IGNORE INTO uploaded_images (id, user_id) VALUES (?, ?)', [ref, userId]);
    } else {
      console.warn(`[sync] upload image failed ${ref} (path=${uploadPath}):`, error.message || error);
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
    const downloadPath = `${userId}/${filename}`;
    console.log('[sync] download attempt:', downloadPath, 'for ref:', ref);
    const { data, error } = await supabase.storage.from('images').download(downloadPath);
    if (error || !data) {
      if (error) console.warn(`[sync] download image FAILED ${ref} (path=${downloadPath}, user=${userId}):`, error.message || error);
      continue;
    }
    console.log('[sync] download OK:', downloadPath);
    const dataUrl = await blobToFileReader(data);
    if (dataUrl) {
      await saveImageData(ref, dataUrl);
      const db = await getDb();
      await db.run('INSERT OR IGNORE INTO uploaded_images (id, user_id) VALUES (?, ?)', [ref, userId]);
    }
  }
}

// ── Conflict detection & resolution ──

/**
 * Record a sync conflict: the local row has unsynced edits (synced = 0) and a
 * remote version arrived. We still apply last-write-wins (remote overwrites local
 * in upsertMistakeLocal/upsertNoteLocal), but we persist BOTH versions here so the
 * user can recover the local edit via the conflict viewer in SettingsPage.
 */
async function recordConflict(db: any, entityType: string, entityId: string, localRow: any, remoteRow: any): Promise<void> {
  const id = `${entityType}:${entityId}`;
  await db.run(
    'INSERT OR REPLACE INTO sync_conflicts (id, entity_type, entity_id, local_data, remote_data, created_at, resolved) VALUES (?, ?, ?, ?, ?, ?, 0)',
    [id, entityType, entityId, JSON.stringify(localRow), JSON.stringify(remoteRow), new Date().toISOString()]
  );
  useSyncStore().addConflict();
  try {
    useQuasar().notify({
      type: 'warning',
      message: `检测到同步冲突：${entityType} ${entityId}，已保留云端版本，可在设置中手动合并`,
      timeout: 4000,
    });
  } catch {
    // useQuasar() may be unavailable outside a component context; the conflict is
    // already recorded and counted, so a missing toast is non-fatal.
  }
}

export async function getConflicts(): Promise<ConflictRow[]> {
  const db = await getDb();
  return db.all('SELECT * FROM sync_conflicts WHERE resolved = 0 ORDER BY created_at DESC');
}

/** Re-apply a previously-conflicted local row with synced = 0 so it gets pushed next. */
async function reinsertLocal(db: any, entityType: string, localRow: any): Promise<void> {
  if (entityType === 'mistake') {
    const fields = [
      'id', 'title', 'content', 'answer', 'image_urls', 'tags', 'subject', 'notes',
      'answer_images', 'difficulty', 'knowledge_points', 'year', 'knowledge_areas',
      'source_paper_type', 'source_paper_name', 'question_number', 'ai_analysis', 'ocr_text',
      'created_at', 'updated_at', 'review_count', 'last_review_at', 'mastery_level',
      'sm2_data', 'linked_note_ids', 'synced',
    ];
    const vals = fields.map((f) => {
      if (f === 'synced') return 0;
      if (f === 'difficulty') return (localRow.difficulty ?? 0).toString();
      if (['image_urls', 'tags', 'answer_images', 'knowledge_points', 'knowledge_areas', 'linked_note_ids'].includes(f)) {
        return JSON.stringify(localRow[f] ?? []);
      }
      if (f === 'sm2_data') return localRow[f] ? JSON.stringify(localRow[f]) : null;
      if (localRow[f] === undefined || localRow[f] === null) return null;
      return String(localRow[f]);
    });
    const q = fields.map(() => '?').join(',');
    await db.run(`INSERT OR REPLACE INTO mistakes (${fields.join(',')}) VALUES (${q})`, vals);
  } else {
    const fields = [
      'id', 'title', 'subject', 'volume', 'chapter', 'section', 'summary', 'is_folder',
      'content', 'plain_text', 'tags', 'knowledge_points', 'tips', 'image_urls',
      'linked_mistake_ids', 'created_at', 'updated_at', 'synced',
    ];
    const vals = fields.map((f) => {
      if (f === 'synced') return 0;
      if (f === 'is_folder') return localRow.is_folder ? 1 : 0;
      if (['tags', 'knowledge_points', 'tips', 'image_urls', 'linked_mistake_ids'].includes(f)) {
        return JSON.stringify(localRow[f] ?? []);
      }
      if (localRow[f] === undefined || localRow[f] === null) return null;
      return String(localRow[f]);
    });
    const q = fields.map(() => '?').join(',');
    await db.run(`INSERT OR REPLACE INTO notes (${fields.join(',')}) VALUES (${q})`, vals);
  }
}

export async function resolveConflict(id: string, action: 'local' | 'remote' | 'dismiss'): Promise<void> {
  const db = await getDb();
  const row = await db.get('SELECT * FROM sync_conflicts WHERE id = ?', [id]);
  if (!row) return;
  if (action === 'local') {
    const localRow = JSON.parse(row.local_data);
    await reinsertLocal(db, row.entity_type, localRow);
  }
  // 'remote' and 'dismiss' need no local change (remote version is already applied for 'remote').
  await db.run('UPDATE sync_conflicts SET resolved = 1 WHERE id = ?', [id]);
  const countRow = await db.get('SELECT COUNT(*) as c FROM sync_conflicts WHERE resolved = 0');
  useSyncStore().setConflictCount((countRow?.c as number) ?? 0);
}

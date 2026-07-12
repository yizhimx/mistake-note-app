-- Supabase schema for MistakeNote cloud sync
-- Run this in Supabase SQL Editor to create the required tables

-- ===== Mistakes table =====
CREATE TABLE IF NOT EXISTS mistakes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  image_urls JSONB NOT NULL DEFAULT '[]',
  tags JSONB NOT NULL DEFAULT '[]',
  subject TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  answer_images JSONB NOT NULL DEFAULT '[]',
  difficulty INTEGER NOT NULL DEFAULT 0,
  knowledge_points JSONB NOT NULL DEFAULT '[]',
  year TEXT DEFAULT NULL,
  knowledge_areas JSONB NOT NULL DEFAULT '[]',
  source_paper_type TEXT DEFAULT NULL,
  source_paper_name TEXT DEFAULT NULL,
  question_number TEXT DEFAULT NULL,
  ai_analysis TEXT DEFAULT NULL,
  ocr_text TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  review_count INTEGER NOT NULL DEFAULT 0,
  last_review_at TIMESTAMPTZ DEFAULT NULL,
  mastery_level TEXT DEFAULT NULL,
  sm2_data JSONB DEFAULT NULL,
  linked_note_ids JSONB NOT NULL DEFAULT '[]',
  deleted INTEGER NOT NULL DEFAULT 0,
  user_id UUID NOT NULL DEFAULT auth.uid()
);

ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mistakes"
  ON mistakes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mistakes"
  ON mistakes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mistakes"
  ON mistakes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mistakes"
  ON mistakes FOR DELETE
  USING (auth.uid() = user_id);

-- ===== Notes table =====
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  volume TEXT NOT NULL DEFAULT '',
  chapter TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  is_folder INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL DEFAULT '',
  plain_text TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]',
  knowledge_points JSONB NOT NULL DEFAULT '[]',
  tips JSONB NOT NULL DEFAULT '[]',
  image_urls JSONB NOT NULL DEFAULT '[]',
  linked_mistake_ids JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted INTEGER NOT NULL DEFAULT 0,
  user_id UUID NOT NULL DEFAULT auth.uid()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notes"
  ON notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes"
  ON notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON notes FOR DELETE
  USING (auth.uid() = user_id);

-- ===== Indexes for sync performance =====
CREATE INDEX IF NOT EXISTS idx_mistakes_updated_at ON mistakes (updated_at);
CREATE INDEX IF NOT EXISTS idx_mistakes_user_id ON mistakes (user_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes (updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes (user_id);

-- ===== Auto-update updated_at =====
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mistakes_updated_at BEFORE UPDATE ON mistakes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== Storage bucket for images =====
-- Run these AFTER the tables above are created (requires supersuer or service_role).
-- You can also create the bucket manually in Supabase Dashboard → Storage → Create bucket 'images' (public = false)
INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'images'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users can read their own images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'images'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users can update their own images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'images'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  )
  WITH CHECK (
    bucket_id = 'images'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users can delete their own images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'images'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- ============================================
-- SUPABASE TABLE SETUP FOR STUDY PLANNER
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Create the study_plans table
CREATE TABLE IF NOT EXISTS study_plans (
  id TEXT PRIMARY KEY DEFAULT 'main',
  plan_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public access (for personal use)
-- Note: For production with multiple users, you'd want to add user authentication
CREATE POLICY "Allow public access to study_plans"
ON study_plans
FOR ALL
USING (true)
WITH CHECK (true);

-- Create an index on updated_at for faster queries
CREATE INDEX IF NOT EXISTS idx_study_plans_updated_at ON study_plans(updated_at);

-- ============================================
-- OPTIONAL: If you already have the storage policies set up,
-- you can skip this section. Otherwise, run these for PDF storage:
-- ============================================

-- Create storage bucket for syllabus PDFs (if not already created)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('syllabus-pdfs', 'syllabus-pdfs', true)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies for syllabus PDFs (if not already created)
-- CREATE POLICY "Allow public uploads to syllabus-pdfs"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'syllabus-pdfs');

-- CREATE POLICY "Allow public reads from syllabus-pdfs"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'syllabus-pdfs');

-- CREATE POLICY "Allow public deletes from syllabus-pdfs"
-- ON storage.objects FOR DELETE
-- USING (bucket_id = 'syllabus-pdfs');

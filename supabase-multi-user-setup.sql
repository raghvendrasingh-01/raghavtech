-- ============================================================
-- MULTI-USER AI STUDY PLANNER - SUPABASE SETUP
-- ============================================================
-- Run this SQL in your Supabase SQL Editor (Dashboard → SQL Editor)
-- This creates a production-grade multi-tenant system with RLS
-- ============================================================

-- ============================================================
-- 1. USER PROFILES TABLE
-- ============================================================
-- Stores user profile data synced from Google OAuth
-- Links to Supabase's built-in auth.users table

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
-- Users can only read their own profile
CREATE POLICY "Users can view own profile" 
    ON public.user_profiles 
    FOR SELECT 
    USING (auth.uid() = id);

-- Users can insert their own profile (on first login)
CREATE POLICY "Users can insert own profile" 
    ON public.user_profiles 
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
    ON public.user_profiles 
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================================
-- 2. STUDY PLANS TABLE (User-Specific)
-- ============================================================
-- Each user has their own study plans
-- Replaces the old shared 'study_plans' table

-- First, drop the old table if it exists (backup data first if needed!)
-- DROP TABLE IF EXISTS public.study_plans;

-- Create new user-specific study plans table
CREATE TABLE IF NOT EXISTS public.user_study_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    plan_data JSONB NOT NULL DEFAULT '{}',
    exam_date DATE,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_study_plans_user_id ON public.user_study_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_study_plans_active ON public.user_study_plans(user_id, is_active);

-- Enable Row Level Security
ALTER TABLE public.user_study_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_study_plans
-- Users can only see their own plans
CREATE POLICY "Users can view own plans" 
    ON public.user_study_plans 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can create their own plans
CREATE POLICY "Users can create own plans" 
    ON public.user_study_plans 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own plans
CREATE POLICY "Users can update own plans" 
    ON public.user_study_plans 
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own plans
CREATE POLICY "Users can delete own plans" 
    ON public.user_study_plans 
    FOR DELETE 
    USING (auth.uid() = user_id);

-- ============================================================
-- 3. AI CHAT HISTORY TABLE (Optional)
-- ============================================================
-- Stores AI conversation history per user

CREATE TABLE IF NOT EXISTS public.chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.user_study_plans(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON public.chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_plan_id ON public.chat_history(plan_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON public.chat_history(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_history
CREATE POLICY "Users can view own chat history" 
    ON public.chat_history 
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat history" 
    ON public.chat_history 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat history" 
    ON public.chat_history 
    FOR DELETE 
    USING (auth.uid() = user_id);

-- ============================================================
-- 4. HELPER FUNCTIONS
-- ============================================================

-- Function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to user_profiles
DROP TRIGGER IF EXISTS set_updated_at_user_profiles ON public.user_profiles;
CREATE TRIGGER set_updated_at_user_profiles
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Apply trigger to user_study_plans
DROP TRIGGER IF EXISTS set_updated_at_user_study_plans ON public.user_study_plans;
CREATE TRIGGER set_updated_at_user_study_plans
    BEFORE UPDATE ON public.user_study_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 5. FUNCTION: Auto-create profile on signup
-- ============================================================
-- This function automatically creates a user_profile when a new user signs up

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 6. GRANT PERMISSIONS
-- ============================================================
-- Grant necessary permissions to authenticated users

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_study_plans TO authenticated;
GRANT ALL ON public.chat_history TO authenticated;

-- ============================================================
-- 7. STORAGE BUCKET RLS (for PDF uploads per user)
-- ============================================================
-- Run these policies in the Supabase Dashboard → Storage → Policies
-- Or via SQL:

-- Create the bucket if it doesn't exist (do this in Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('syllabus-pdfs', 'syllabus-pdfs', false);

-- Storage policies (users can only access their own folder)
-- CREATE POLICY "Users can upload to own folder"
--     ON storage.objects
--     FOR INSERT
--     WITH CHECK (
--         bucket_id = 'syllabus-pdfs' AND
--         auth.uid()::text = (storage.foldername(name))[1]
--     );

-- CREATE POLICY "Users can view own files"
--     ON storage.objects
--     FOR SELECT
--     USING (
--         bucket_id = 'syllabus-pdfs' AND
--         auth.uid()::text = (storage.foldername(name))[1]
--     );

-- CREATE POLICY "Users can delete own files"
--     ON storage.objects
--     FOR DELETE
--     USING (
--         bucket_id = 'syllabus-pdfs' AND
--         auth.uid()::text = (storage.foldername(name))[1]
--     );

-- ============================================================
-- DONE! Your multi-user system is ready.
-- ============================================================

-- VERIFICATION QUERIES (run these to test):
-- 
-- -- Check tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- 
-- -- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- 
-- -- Check policies
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public';

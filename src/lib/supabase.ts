import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration
// These should be set in your .env file:
// VITE_SUPABASE_URL=your-supabase-project-url
// VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isSupabaseConfigured = supabaseUrl && supabaseAnonKey;

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase environment variables are not set. PDF upload will not work. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Create Supabase client with proper auth configuration
// CRITICAL: detectSessionInUrl must be true for OAuth redirects to work
export const supabase: SupabaseClient | null = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Auto-detect OAuth tokens from URL hash after redirect
        detectSessionInUrl: true,
        // Persist session in localStorage
        persistSession: true,
        // Auto-refresh tokens before expiry
        autoRefreshToken: true,
        // Storage key for session
        storageKey: 'study-planner-auth',
      }
    })
  : null;

// ============ TYPE DEFINITIONS ============

// User Profile type (matches database schema)
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// Study Plan type (matches database schema)
export interface StudyPlanDB {
  id: string;
  user_id: string;
  name: string;
  plan_data: StudyPlanData;
  exam_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// The actual plan data stored in JSONB
export interface StudyPlanData {
  subjects: Subject[];
  tasks: Task[];
  dailyStudyTime: number;
  generatedAt: string;
  streak: number;
  lastStudyDate: string;
  totalCompleted: number;
}

// Subject within a plan
export interface Subject {
  id: string;
  name: string;
  topics: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  color: string;
  syllabusPdf?: UploadedPDF;
}

// Task within a plan
export interface Task {
  id: string;
  subjectId: string;
  topic: string;
  duration: number;
  type: 'learn' | 'revision';
  completed: boolean;
  skipped: boolean;
  date: string;
}

// Chat history type
export interface ChatMessage {
  id: string;
  user_id: string;
  plan_id: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Storage bucket name for syllabus PDFs
export const SYLLABUS_BUCKET = 'syllabus-pdfs';

// Types for PDF upload
export interface UploadedPDF {
  name: string;
  url: string;
  path: string;
  uploadedAt: string;
}

export interface PDFUploadResult {
  success: boolean;
  data?: UploadedPDF;
  error?: string;
}

// ============ USER PROFILE FUNCTIONS ============

/**
 * Get the current user's profile
 * RLS ensures only the user's own profile is returned
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    if (!supabase) {
      console.warn('Supabase is not configured');
      return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      // Profile might not exist yet for new users
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Failed to get user profile:', error);
      return null;
    }

    return data as UserProfile;
  } catch (err) {
    console.error('Get user profile error:', err);
    return null;
  }
}

/**
 * Create or update user profile (called after Google login)
 * This is a fallback - the database trigger should handle this automatically
 */
export async function upsertUserProfile(profile: {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}): Promise<UserProfile | null> {
  try {
    if (!supabase) {
      console.warn('Supabase is not configured');
      return null;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name || null,
        avatar_url: profile.avatar_url || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to upsert user profile:', error);
      return null;
    }

    return data as UserProfile;
  } catch (err) {
    console.error('Upsert user profile error:', err);
    return null;
  }
}

// ============ STUDY PLANS FUNCTIONS (Multi-User) ============

/**
 * Get all study plans for the current user
 * RLS automatically filters to only return the user's plans
 */
export async function getUserStudyPlans(): Promise<StudyPlanDB[]> {
  try {
    if (!supabase) {
      console.warn('Supabase is not configured');
      return [];
    }

    const { data, error } = await supabase
      .from('user_study_plans')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to get study plans:', error);
      return [];
    }

    return (data || []) as StudyPlanDB[];
  } catch (err) {
    console.error('Get study plans error:', err);
    return [];
  }
}

/**
 * Get a single study plan by ID
 * RLS ensures user can only access their own plans
 */
export async function getStudyPlanById(planId: string): Promise<StudyPlanDB | null> {
  try {
    if (!supabase) {
      console.warn('Supabase is not configured');
      return null;
    }

    const { data, error } = await supabase
      .from('user_study_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error) {
      console.error('Failed to get study plan:', error);
      return null;
    }

    return data as StudyPlanDB;
  } catch (err) {
    console.error('Get study plan error:', err);
    return null;
  }
}

/**
 * Create a new study plan for the current user
 */
export async function createStudyPlan(plan: {
  name: string;
  plan_data: StudyPlanData;
  exam_date?: string;
}): Promise<StudyPlanDB | null> {
  try {
    if (!supabase) {
      console.warn('Supabase is not configured');
      return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user');
      return null;
    }

    const { data, error } = await supabase
      .from('user_study_plans')
      .insert({
        user_id: user.id,
        name: plan.name,
        plan_data: plan.plan_data,
        exam_date: plan.exam_date || null,
        is_active: false
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create study plan:', error);
      return null;
    }

    return data as StudyPlanDB;
  } catch (err) {
    console.error('Create study plan error:', err);
    return null;
  }
}

/**
 * Update an existing study plan
 * RLS ensures user can only update their own plans
 */
export async function updateStudyPlan(
  planId: string, 
  updates: Partial<{
    name: string;
    plan_data: StudyPlanData;
    exam_date: string;
    is_active: boolean;
  }>
): Promise<StudyPlanDB | null> {
  try {
    if (!supabase) {
      console.warn('Supabase is not configured');
      return null;
    }

    const { data, error } = await supabase
      .from('user_study_plans')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', planId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update study plan:', error);
      return null;
    }

    return data as StudyPlanDB;
  } catch (err) {
    console.error('Update study plan error:', err);
    return null;
  }
}

/**
 * Delete a study plan
 * RLS ensures user can only delete their own plans
 */
export async function deleteStudyPlan(planId: string): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn('Supabase is not configured');
      return false;
    }

    const { error } = await supabase
      .from('user_study_plans')
      .delete()
      .eq('id', planId);

    if (error) {
      console.error('Failed to delete study plan:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Delete study plan error:', err);
    return false;
  }
}

/**
 * Set a plan as active (and deactivate others)
 */
export async function setActivePlan(planId: string): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn('Supabase is not configured');
      return false;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Deactivate all plans for this user
    await supabase
      .from('user_study_plans')
      .update({ is_active: false })
      .eq('user_id', user.id);

    // Activate the selected plan
    const { error } = await supabase
      .from('user_study_plans')
      .update({ is_active: true })
      .eq('id', planId);

    if (error) {
      console.error('Failed to set active plan:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Set active plan error:', err);
    return false;
  }
}

// ============ CHAT HISTORY FUNCTIONS ============

/**
 * Save a chat message
 */
export async function saveChatMessage(message: {
  plan_id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<ChatMessage | null> {
  try {
    if (!supabase) {
      console.warn('Supabase is not configured');
      return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('chat_history')
      .insert({
        user_id: user.id,
        plan_id: message.plan_id || null,
        role: message.role,
        content: message.content,
        metadata: message.metadata || {}
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save chat message:', error);
      return null;
    }

    return data as ChatMessage;
  } catch (err) {
    console.error('Save chat message error:', err);
    return null;
  }
}

/**
 * Get chat history for a plan
 */
export async function getChatHistory(planId?: string, limit = 50): Promise<ChatMessage[]> {
  try {
    if (!supabase) {
      console.warn('Supabase is not configured');
      return [];
    }

    let query = supabase
      .from('chat_history')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (planId) {
      query = query.eq('plan_id', planId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to get chat history:', error);
      return [];
    }

    return (data || []) as ChatMessage[];
  } catch (err) {
    console.error('Get chat history error:', err);
    return [];
  }
}

// ============ PDF UPLOAD FUNCTIONS (User-Scoped) ============

/**
 * Upload a PDF file to Supabase Storage (user-scoped)
 * Files are stored in user-specific folders for RLS
 * @param file - The PDF file to upload
 * @param subjectId - Unique identifier for the subject
 * @returns Upload result with file URL or error
 */
export async function uploadSyllabusPDF(
  file: File,
  subjectId: string
): Promise<PDFUploadResult> {
  try {
    // Check if Supabase is configured
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase is not configured. Please set environment variables.',
      };
    }

    // Get current user for user-scoped storage
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to upload files.',
      };
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return {
        success: false,
        error: 'Only PDF files are allowed',
      };
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size must be less than 10MB',
      };
    }

    // Generate unique filename with user scope
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    // Store in user-specific folder: userId/subjectId/timestamp_filename
    const filePath = `${user.id}/${subjectId}/${timestamp}_${sanitizedFileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(SYLLABUS_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload PDF',
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(SYLLABUS_BUCKET)
      .getPublicUrl(data.path);

    return {
      success: true,
      data: {
        name: file.name,
        url: urlData.publicUrl,
        path: data.path,
        uploadedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    console.error('PDF upload error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred during upload',
    };
  }
}

/**
 * Delete a PDF file from Supabase Storage
 * @param filePath - The path of the file to delete
 * @returns Success status
 */
export async function deleteSyllabusPDF(filePath: string): Promise<boolean> {
  try {
    // Check if Supabase is configured
    if (!supabase) {
      console.warn('Supabase is not configured');
      return false;
    }

    const { error } = await supabase.storage
      .from(SYLLABUS_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Failed to delete PDF:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Delete PDF error:', err);
    return false;
  }
}

// ============ LEGACY COMPATIBILITY LAYER ============
// These functions maintain backward compatibility during migration
// They now use the new user-specific study plans system

// Type for legacy plans storage format
export interface PlansStorageDB {
  plans: unknown[];
  activePlanId: string | null;
}

/**
 * @deprecated Use getUserStudyPlans() and createStudyPlan() instead
 * Legacy save function - now saves to user-specific table
 */
export async function saveStudyPlansToDb(_plansData: PlansStorageDB): Promise<boolean> {
  console.warn('saveStudyPlansToDb is deprecated. Use createStudyPlan/updateStudyPlan instead.');
  // This is now a no-op as we use per-plan storage
  return true;
}

/**
 * @deprecated Use getUserStudyPlans() instead
 * Legacy load function - now loads from user-specific table
 */
export async function loadStudyPlansFromDb(): Promise<PlansStorageDB | null> {
  console.warn('loadStudyPlansFromDb is deprecated. Use getUserStudyPlans() instead.');
  try {
    const plans = await getUserStudyPlans();
    if (plans.length === 0) return null;
    
    // Convert new format to legacy format for backward compatibility
    const activePlan = plans.find(p => p.is_active);
    return {
      plans: plans.map(p => ({
        id: p.id,
        name: p.name,
        ...p.plan_data,
        examDate: p.exam_date,
        generatedAt: p.plan_data.generatedAt || p.created_at
      })),
      activePlanId: activePlan?.id || null
    };
  } catch (err) {
    console.error('Legacy load error:', err);
    return null;
  }
}



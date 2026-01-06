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

// Only create client if credentials are available, otherwise use a null placeholder
export const supabase: SupabaseClient | null = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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

/**
 * Upload a PDF file to Supabase Storage
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

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${subjectId}/${timestamp}_${sanitizedFileName}`;

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

// ============ STUDY PLANS DATABASE FUNCTIONS ============

// Type for study plans storage (matches the component's PlansStorage interface)
export interface PlansStorageDB {
  plans: unknown[];
  activePlanId: string | null;
}

/**
 * Save study plans to database
 * @param plansData - The plans storage object to save
 * @returns Success status
 */
export async function saveStudyPlansToDb(plansData: PlansStorageDB): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn('Supabase is not configured');
      return false;
    }

    // Upsert with a fixed ID (since we only need one record for personal use)
    const { error } = await supabase
      .from('study_plans')
      .upsert({
        id: 'main',
        plan_data: plansData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (error) {
      console.error('Failed to save study plans:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Save study plans error:', err);
    return false;
  }
}

/**
 * Load study plans from database
 * @returns Plans storage object or null if not found
 */
export async function loadStudyPlansFromDb(): Promise<PlansStorageDB | null> {
  try {
    if (!supabase) {
      console.warn('Supabase is not configured');
      return null;
    }

    const { data, error } = await supabase
      .from('study_plans')
      .select('plan_data')
      .eq('id', 'main')
      .single();

    if (error) {
      // PGRST116 = no rows found, which is expected for first-time users
      if (error.code !== 'PGRST116') {
        console.error('Failed to load study plans:', error);
      }
      return null;
    }

    return data?.plan_data as PlansStorageDB || null;
  } catch (err) {
    console.error('Load study plans error:', err);
    return null;
  }
}


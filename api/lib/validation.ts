/**
 * =====================================================
 * Validation Utilities - Input Sanitization & Checks
 * =====================================================
 * 
 * Provides robust validation for file uploads and user input.
 * Essential for security and preventing malformed requests.
 * 
 * @author Portfolio Project
 * @version 2.0.0
 */

import type { ParsedFile, FileValidationOptions, ValidationResult, SplitOptions, PageRange } from '../types';
import { ErrorCodes } from '../types';

// =====================================================
// CONSTANTS
// =====================================================

/**
 * Vercel free tier limits
 * Conservative limits to ensure reliable operation
 */
export const LIMITS = {
  MAX_FILE_SIZE: 4 * 1024 * 1024,        // 4 MB per file
  MAX_TOTAL_SIZE: 10 * 1024 * 1024,      // 10 MB total
  MAX_FILES: 20,                          // Maximum files for merge
  MIN_FILES_FOR_MERGE: 2,                 // Minimum files for merge
  MAX_PAGES_FOR_SPLIT: 100,               // Maximum pages to split
} as const;

/**
 * Allowed PDF MIME types
 */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/x-pdf',
];

/**
 * PDF file signature (magic bytes)
 */
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

// =====================================================
// FILE VALIDATION
// =====================================================

/**
 * Validate a single file against specified criteria
 * 
 * @param file - Parsed file to validate
 * @param options - Validation options
 * @returns Validation result with error details if invalid
 */
export function validateFile(
  file: ParsedFile,
  options: FileValidationOptions = {}
): ValidationResult {
  const {
    maxSize = LIMITS.MAX_FILE_SIZE,
    allowedTypes = ALLOWED_MIME_TYPES,
  } = options;

  // Check file exists and has content
  if (!file || !file.buffer || file.buffer.length === 0) {
    return {
      valid: false,
      error: 'File is empty or corrupted',
      code: ErrorCodes.NO_FILES_PROVIDED,
    };
  }

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File "${file.originalFilename}" exceeds maximum size of ${maxSizeMB} MB`,
      code: ErrorCodes.FILE_TOO_LARGE,
    };
  }

  // Check MIME type
  const isValidMimeType = allowedTypes.some(type => 
    file.mimetype.toLowerCase().includes(type.toLowerCase()) ||
    type.toLowerCase().includes(file.mimetype.toLowerCase())
  );

  if (!isValidMimeType) {
    return {
      valid: false,
      error: `Invalid file type "${file.mimetype}". Only PDF files are allowed.`,
      code: ErrorCodes.INVALID_FILE_TYPE,
    };
  }

  // Check file extension
  const extension = file.originalFilename.split('.').pop()?.toLowerCase();
  if (extension !== 'pdf') {
    return {
      valid: false,
      error: `Invalid file extension ".${extension}". Only .pdf files are allowed.`,
      code: ErrorCodes.INVALID_FILE_TYPE,
    };
  }

  // Validate PDF magic bytes (file signature)
  if (!isPDFBuffer(file.buffer)) {
    return {
      valid: false,
      error: `File "${file.originalFilename}" is not a valid PDF document`,
      code: ErrorCodes.INVALID_FILE_TYPE,
    };
  }

  return { valid: true };
}

/**
 * Validate multiple files for merge operation
 * 
 * @param files - Array of parsed files
 * @returns Validation result
 */
export function validateFilesForMerge(files: ParsedFile[]): ValidationResult {
  // Check minimum file count
  if (!files || files.length < LIMITS.MIN_FILES_FOR_MERGE) {
    return {
      valid: false,
      error: `At least ${LIMITS.MIN_FILES_FOR_MERGE} PDF files are required for merging`,
      code: ErrorCodes.INSUFFICIENT_FILES,
    };
  }

  // Check maximum file count
  if (files.length > LIMITS.MAX_FILES) {
    return {
      valid: false,
      error: `Maximum ${LIMITS.MAX_FILES} files allowed. You provided ${files.length} files.`,
      code: ErrorCodes.TOO_MANY_FILES,
    };
  }

  // Calculate total size
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > LIMITS.MAX_TOTAL_SIZE) {
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);
    const maxSizeMB = (LIMITS.MAX_TOTAL_SIZE / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Total file size (${totalSizeMB} MB) exceeds maximum of ${maxSizeMB} MB`,
      code: ErrorCodes.FILE_TOO_LARGE,
    };
  }

  // Validate each file individually
  for (const file of files) {
    const result = validateFile(file);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

/**
 * Validate a single file for split/compress operations
 * 
 * @param file - Parsed file to validate
 * @returns Validation result
 */
export function validateSingleFile(file: ParsedFile | undefined): ValidationResult {
  if (!file) {
    return {
      valid: false,
      error: 'No file provided. Please upload a PDF file.',
      code: ErrorCodes.NO_FILES_PROVIDED,
    };
  }

  return validateFile(file);
}

// =====================================================
// PAGE RANGE VALIDATION
// =====================================================

/**
 * Parse and validate page range string
 * Supports formats: "1,3,5", "1-5", "1,3-5,7"
 * 
 * @param rangeStr - Page range string
 * @param totalPages - Total pages in the PDF
 * @returns Parsed split options or error
 */
export function parsePageRange(
  rangeStr: string | undefined,
  totalPages: number
): { valid: boolean; options?: SplitOptions; error?: string } {
  // If no range specified, return all pages
  if (!rangeStr || rangeStr.trim() === '' || rangeStr.toLowerCase() === 'all') {
    return {
      valid: true,
      options: { all: true },
    };
  }

  const pages = new Set<number>();
  const parts = rangeStr.split(',').map(p => p.trim());

  for (const part of parts) {
    // Handle range (e.g., "1-5")
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end)) {
        return {
          valid: false,
          error: `Invalid page range "${part}". Use format like "1-5"`,
        };
      }

      if (start < 1 || end < 1) {
        return {
          valid: false,
          error: 'Page numbers must be greater than 0',
        };
      }

      if (start > end) {
        return {
          valid: false,
          error: `Invalid range "${part}". Start page must be less than or equal to end page.`,
        };
      }

      if (end > totalPages) {
        return {
          valid: false,
          error: `Page ${end} exceeds total pages (${totalPages})`,
        };
      }

      for (let i = start; i <= end; i++) {
        pages.add(i);
      }
    } else {
      // Handle single page number
      const page = parseInt(part, 10);

      if (isNaN(page)) {
        return {
          valid: false,
          error: `Invalid page number "${part}"`,
        };
      }

      if (page < 1) {
        return {
          valid: false,
          error: 'Page numbers must be greater than 0',
        };
      }

      if (page > totalPages) {
        return {
          valid: false,
          error: `Page ${page} exceeds total pages (${totalPages})`,
        };
      }

      pages.add(page);
    }
  }

  // Check if too many pages requested
  if (pages.size > LIMITS.MAX_PAGES_FOR_SPLIT) {
    return {
      valid: false,
      error: `Too many pages requested (${pages.size}). Maximum is ${LIMITS.MAX_PAGES_FOR_SPLIT} pages.`,
    };
  }

  return {
    valid: true,
    options: {
      pages: Array.from(pages).sort((a, b) => a - b),
    },
  };
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Check if buffer contains valid PDF magic bytes
 * 
 * @param buffer - File buffer to check
 * @returns True if buffer starts with PDF signature
 */
export function isPDFBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return buffer.slice(0, 4).equals(PDF_MAGIC_BYTES);
}

/**
 * Sanitize filename for safe download
 * 
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  const baseName = filename.split(/[/\\]/).pop() || 'file';
  
  // Remove or replace dangerous characters
  const sanitized = baseName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // Replace dangerous chars
    .replace(/\.{2,}/g, '.')                   // Remove multiple dots
    .replace(/^\.+/, '')                       // Remove leading dots
    .trim();

  // Ensure .pdf extension
  if (!sanitized.toLowerCase().endsWith('.pdf')) {
    return sanitized + '.pdf';
  }

  return sanitized || 'document.pdf';
}

/**
 * Format bytes to human-readable string
 * 
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Calculate compression ratio percentage
 * 
 * @param originalSize - Original file size in bytes
 * @param newSize - New file size in bytes
 * @returns Compression percentage (positive = smaller)
 */
export function calculateCompressionRatio(originalSize: number, newSize: number): number {
  if (originalSize === 0) return 0;
  return Math.round((1 - newSize / originalSize) * 100);
}

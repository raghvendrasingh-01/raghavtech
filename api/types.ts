/**
 * =====================================================
 * PDF Tools API - Type Definitions
 * =====================================================
 * 
 * Centralized TypeScript types for the PDF processing API.
 * Ensures type safety across all serverless functions.
 * 
 * @author Portfolio Project
 * @version 2.0.0
 */

import type { IncomingMessage, ServerResponse } from 'http';

// =====================================================
// VERCEL REQUEST/RESPONSE TYPES
// =====================================================

/**
 * Extended Vercel request interface with parsed body and files
 */
export interface VercelRequest extends IncomingMessage {
  query: Record<string, string | string[]>;
  cookies: Record<string, string>;
  body: any;
}

/**
 * Extended Vercel response interface with helper methods
 */
export interface VercelResponse extends ServerResponse {
  status: (statusCode: number) => VercelResponse;
  json: (body: any) => void;
  send: (body: any) => void;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

/**
 * Standard health check response structure
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  platform: string;
  timestamp: string;
  capabilities: string[];
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: string;
  timestamp: string;
}

/**
 * Standard success response structure
 */
export interface SuccessResponse {
  success: true;
  message: string;
  data?: any;
  timestamp: string;
}

// =====================================================
// FILE PROCESSING TYPES
// =====================================================

/**
 * Parsed file from multipart form data
 */
export interface ParsedFile {
  fieldName: string;
  originalFilename: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

/**
 * Result of parsing multipart form data
 */
export interface ParsedFormData {
  files: ParsedFile[];
  fields: Record<string, string>;
}

/**
 * PDF processing result
 */
export interface PDFProcessingResult {
  success: boolean;
  outputBuffer: Buffer;
  originalSize: number;
  newSize: number;
  message: string;
  filename: string;
}

// =====================================================
// VALIDATION TYPES
// =====================================================

/**
 * File validation options
 */
export interface FileValidationOptions {
  maxSize?: number;           // Max file size in bytes
  minFiles?: number;          // Minimum number of files required
  maxFiles?: number;          // Maximum number of files allowed
  allowedTypes?: string[];    // Allowed MIME types
  allowedExtensions?: string[]; // Allowed file extensions
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

// =====================================================
// SPLIT OPTIONS TYPES
// =====================================================

/**
 * Page range specification for splitting
 */
export interface PageRange {
  start: number;
  end: number;
}

/**
 * Split operation options
 */
export interface SplitOptions {
  pages?: number[];        // Specific pages to extract
  ranges?: PageRange[];    // Page ranges to extract
  all?: boolean;           // Extract all pages individually
}

// =====================================================
// API ERROR CODES
// =====================================================

/**
 * Standardized error codes for consistent error handling
 */
export const ErrorCodes = {
  // Validation errors (400)
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  NO_FILES_PROVIDED: 'NO_FILES_PROVIDED',
  INSUFFICIENT_FILES: 'INSUFFICIENT_FILES',
  TOO_MANY_FILES: 'TOO_MANY_FILES',
  INVALID_PAGE_RANGE: 'INVALID_PAGE_RANGE',
  
  // Processing errors (500)
  PDF_PROCESSING_ERROR: 'PDF_PROCESSING_ERROR',
  PDF_PARSE_ERROR: 'PDF_PARSE_ERROR',
  PDF_MERGE_ERROR: 'PDF_MERGE_ERROR',
  PDF_SPLIT_ERROR: 'PDF_SPLIT_ERROR',
  PDF_COMPRESS_ERROR: 'PDF_COMPRESS_ERROR',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  FORM_PARSE_ERROR: 'FORM_PARSE_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

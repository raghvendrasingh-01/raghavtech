/**
 * =====================================================
 * Response Helpers - Standardized API Responses
 * =====================================================
 * 
 * Provides consistent response formatting across all API endpoints.
 * Implements best practices for HTTP status codes and headers.
 * 
 * @author Portfolio Project
 * @version 2.0.0
 */

import type { VercelResponse, ErrorResponse, SuccessResponse, ErrorCode } from '../types';

// =====================================================
// CONSTANTS
// =====================================================

/**
 * CORS headers for cross-origin requests
 * Configured for production security while allowing legitimate requests
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Expose-Headers': 'X-Original-Size, X-New-Size, X-Message, Content-Disposition',
};

// =====================================================
// RESPONSE HELPERS
// =====================================================

/**
 * Send a successful JSON response
 * 
 * @param res - Vercel response object
 * @param data - Response data
 * @param statusCode - HTTP status code (default: 200)
 */
export function sendSuccess(
  res: VercelResponse,
  message: string,
  data?: any,
  statusCode: number = 200
): void {
  const response: SuccessResponse = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...CORS_HEADERS,
  });
  res.end(JSON.stringify(response));
}

/**
 * Send an error JSON response
 * 
 * @param res - Vercel response object
 * @param error - Error message
 * @param code - Error code for client handling
 * @param statusCode - HTTP status code (default: 400)
 * @param details - Additional error details
 */
export function sendError(
  res: VercelResponse,
  error: string,
  code: ErrorCode | string,
  statusCode: number = 400,
  details?: string
): void {
  const response: ErrorResponse = {
    success: false,
    error,
    code,
    details,
    timestamp: new Date().toISOString(),
  };

  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...CORS_HEADERS,
  });
  res.end(JSON.stringify(response));
}

/**
 * Send a PDF file as downloadable response
 * 
 * @param res - Vercel response object
 * @param buffer - PDF file buffer
 * @param filename - Suggested download filename
 * @param metadata - Additional metadata to include in headers
 */
export function sendPDF(
  res: VercelResponse,
  buffer: Buffer,
  filename: string,
  metadata?: {
    originalSize?: number;
    newSize?: number;
    message?: string;
  }
): void {
  const headers: Record<string, string> = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': buffer.length.toString(),
    ...CORS_HEADERS,
  };

  // Add optional metadata headers
  if (metadata?.originalSize !== undefined) {
    headers['X-Original-Size'] = metadata.originalSize.toString();
  }
  if (metadata?.newSize !== undefined) {
    headers['X-New-Size'] = metadata.newSize.toString();
  }
  if (metadata?.message) {
    headers['X-Message'] = metadata.message;
  }

  res.writeHead(200, headers);
  res.end(buffer);
}

/**
 * Send a ZIP file as downloadable response
 * 
 * @param res - Vercel response object
 * @param buffer - ZIP file buffer
 * @param filename - Suggested download filename
 * @param metadata - Additional metadata to include in headers
 */
export function sendZIP(
  res: VercelResponse,
  buffer: Buffer,
  filename: string,
  metadata?: {
    fileCount?: number;
    message?: string;
  }
): void {
  const headers: Record<string, string> = {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': buffer.length.toString(),
    ...CORS_HEADERS,
  };

  if (metadata?.fileCount !== undefined) {
    headers['X-File-Count'] = metadata.fileCount.toString();
  }
  if (metadata?.message) {
    headers['X-Message'] = metadata.message;
  }

  res.writeHead(200, headers);
  res.end(buffer);
}

/**
 * Handle CORS preflight OPTIONS request
 * 
 * @param res - Vercel response object
 */
export function handleCORS(res: VercelResponse): void {
  res.writeHead(204, {
    ...CORS_HEADERS,
    'Content-Length': '0',
  });
  res.end();
}

/**
 * Send method not allowed response
 * 
 * @param res - Vercel response object
 * @param allowed - Array of allowed HTTP methods
 */
export function sendMethodNotAllowed(res: VercelResponse, allowed: string[]): void {
  res.writeHead(405, {
    'Content-Type': 'application/json',
    'Allow': allowed.join(', '),
    ...CORS_HEADERS,
  });
  res.end(JSON.stringify({
    success: false,
    error: 'Method not allowed',
    code: 'METHOD_NOT_ALLOWED',
    allowed,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * =====================================================
 * PDF Merge API Endpoint
 * =====================================================
 * 
 * POST /api/merge
 * 
 * Merges multiple PDF files into a single document.
 * Accepts multipart/form-data with multiple 'files' fields.
 * 
 * @author Portfolio Project
 * @version 2.0.0
 * 
 * @example Request
 * ```
 * const formData = new FormData();
 * formData.append('files', file1);
 * formData.append('files', file2);
 * 
 * const response = await fetch('/api/merge', {
 *   method: 'POST',
 *   body: formData
 * });
 * 
 * if (response.ok) {
 *   const blob = await response.blob();
 *   // Download or process the merged PDF
 * }
 * ```
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseFormData, isMultipartFormData } from './lib/form-parser';
import { validateFilesForMerge, formatBytes } from './lib/validation';
import { mergePDFs } from './lib/pdf-utils';
import { 
  sendPDF, 
  sendError, 
  handleCORS, 
  sendMethodNotAllowed 
} from './lib/response';
import { ErrorCodes } from './types';

// =====================================================
// HANDLER
// =====================================================

/**
 * Merge PDF endpoint handler
 * 
 * @param req - Vercel request object
 * @param res - Vercel response object
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    handleCORS(res);
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    sendMethodNotAllowed(res, ['POST', 'OPTIONS']);
    return;
  }

  try {
    // Verify content type
    if (!isMultipartFormData(req)) {
      sendError(
        res,
        'Content-Type must be multipart/form-data',
        ErrorCodes.FORM_PARSE_ERROR,
        400
      );
      return;
    }

    // Parse uploaded files
    const { files } = await parseFormData(req);

    // Validate files for merge operation
    const validation = validateFilesForMerge(files);
    if (!validation.valid) {
      sendError(
        res,
        validation.error || 'Validation failed',
        validation.code || ErrorCodes.INVALID_FILE_TYPE,
        400
      );
      return;
    }

    // Perform PDF merge
    const result = await mergePDFs(files);

    // Log success for debugging (visible in Vercel logs)
    console.log(`[MERGE] Successfully merged ${files.length} PDFs: ${formatBytes(result.originalSize)} → ${formatBytes(result.newSize)}`);

    // Send merged PDF as response
    sendPDF(res, result.outputBuffer, result.filename, {
      originalSize: result.originalSize,
      newSize: result.newSize,
      message: result.message,
    });

  } catch (error) {
    // Log error for debugging
    console.error('[MERGE] Error:', error);

    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';

    sendError(
      res,
      errorMessage,
      ErrorCodes.PDF_MERGE_ERROR,
      500,
      'Please ensure all files are valid PDFs and try again'
    );
  }
}

// =====================================================
// VERCEL CONFIG
// =====================================================

/**
 * Vercel serverless function configuration
 * 
 * - maxDuration: Maximum execution time (10s for free tier)
 * - memory: Memory allocation (1024MB max for free tier)
 */
export const config = {
  api: {
    bodyParser: false, // Disable body parsing, we use busboy
  },
};

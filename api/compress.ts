/**
 * =====================================================
 * PDF Compress API Endpoint
 * =====================================================
 * 
 * POST /api/compress
 * 
 * Compresses a PDF to reduce file size.
 * Uses pdf-lib optimization techniques:
 * - Object stream compression
 * - Removing unused objects
 * - Optimizing document structure
 * 
 * Note: Heavy compression (image downsampling) would require
 * additional libraries. This provides structural optimization.
 * 
 * @author Portfolio Project
 * @version 2.0.0
 * 
 * @example Request
 * ```
 * const formData = new FormData();
 * formData.append('file', pdfFile);
 * 
 * const response = await fetch('/api/compress', {
 *   method: 'POST',
 *   body: formData
 * });
 * 
 * if (response.ok) {
 *   const blob = await response.blob();
 *   // Download compressed PDF
 * }
 * ```
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseFormData, isMultipartFormData } from './lib/form-parser';
import { validateSingleFile, formatBytes, calculateCompressionRatio } from './lib/validation';
import { compressPDF } from './lib/pdf-utils';
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
 * Compress PDF endpoint handler
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

    // Get the first file
    const file = files.find(f => f.fieldName === 'file') || files[0];

    // Validate the file
    const validation = validateSingleFile(file);
    if (!validation.valid) {
      sendError(
        res,
        validation.error || 'Validation failed',
        validation.code || ErrorCodes.INVALID_FILE_TYPE,
        400
      );
      return;
    }

    // Compress the PDF
    const result = await compressPDF(file);

    // Calculate compression stats
    const ratio = calculateCompressionRatio(result.originalSize, result.newSize);

    // Log success
    console.log(`[COMPRESS] ${file.originalFilename}: ${formatBytes(result.originalSize)} → ${formatBytes(result.newSize)} (${ratio}% reduction)`);

    // Send compressed PDF as response
    sendPDF(res, result.outputBuffer, result.filename, {
      originalSize: result.originalSize,
      newSize: result.newSize,
      message: result.message,
    });

  } catch (error) {
    // Log error for debugging
    console.error('[COMPRESS] Error:', error);

    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';

    sendError(
      res,
      errorMessage,
      ErrorCodes.PDF_COMPRESS_ERROR,
      500,
      'Please ensure the file is a valid PDF and try again'
    );
  }
}

// =====================================================
// VERCEL CONFIG
// =====================================================

/**
 * Vercel serverless function configuration
 */
export const config = {
  api: {
    bodyParser: false, // Disable body parsing, we use busboy
  },
};

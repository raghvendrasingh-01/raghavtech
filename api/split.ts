/**
 * =====================================================
 * PDF Split API Endpoint
 * =====================================================
 * 
 * POST /api/split
 * 
 * Splits a PDF into individual pages, returned as a ZIP file.
 * Supports optional page selection via 'pages' field.
 * 
 * @author Portfolio Project
 * @version 2.0.0
 * 
 * @example Request - Split all pages
 * ```
 * const formData = new FormData();
 * formData.append('file', pdfFile);
 * 
 * const response = await fetch('/api/split', {
 *   method: 'POST',
 *   body: formData
 * });
 * ```
 * 
 * @example Request - Split specific pages
 * ```
 * const formData = new FormData();
 * formData.append('file', pdfFile);
 * formData.append('pages', '1,3,5-7'); // Pages 1, 3, 5, 6, 7
 * 
 * const response = await fetch('/api/split', {
 *   method: 'POST',
 *   body: formData
 * });
 * ```
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseFormData, isMultipartFormData } from './lib/form-parser';
import { validateSingleFile, parsePageRange, formatBytes } from './lib/validation';
import { splitPDF, getPDFPageCount } from './lib/pdf-utils';
import { 
  sendZIP,
  sendError, 
  handleCORS, 
  sendMethodNotAllowed 
} from './lib/response';
import { ErrorCodes } from './types';
import JSZip from 'jszip';

// =====================================================
// HANDLER
// =====================================================

/**
 * Split PDF endpoint handler
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

    // Parse uploaded files and fields
    const { files, fields } = await parseFormData(req);

    // Get the first file (split works on single PDF)
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

    // Get total page count
    const totalPages = await getPDFPageCount(file.buffer);

    // Parse page range parameter
    const pagesParam = fields.pages || fields.page;
    const pageRangeResult = parsePageRange(pagesParam, totalPages);

    if (!pageRangeResult.valid) {
      sendError(
        res,
        pageRangeResult.error || 'Invalid page range',
        ErrorCodes.INVALID_PAGE_RANGE,
        400
      );
      return;
    }

    // Determine which pages to extract
    const pagesToExtract = pageRangeResult.options?.pages || undefined;

    // Split the PDF
    const { pages } = await splitPDF(file, pagesToExtract);

    // Create ZIP file containing all pages
    const zip = new JSZip();
    
    for (const page of pages) {
      zip.file(page.filename, page.outputBuffer);
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // Generate output filename
    const baseFilename = file.originalFilename.replace(/\.pdf$/i, '');
    const zipFilename = `${baseFilename}_pages.zip`;

    // Log success
    console.log(`[SPLIT] Split ${file.originalFilename} into ${pages.length} pages (${formatBytes(zipBuffer.length)})`);

    // Send ZIP file as response
    sendZIP(res, zipBuffer, zipFilename, {
      fileCount: pages.length,
      message: `Successfully split into ${pages.length} pages`,
    });

  } catch (error) {
    // Log error for debugging
    console.error('[SPLIT] Error:', error);

    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';

    sendError(
      res,
      errorMessage,
      ErrorCodes.PDF_SPLIT_ERROR,
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

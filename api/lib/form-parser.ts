/**
 * =====================================================
 * Form Data Parser - Multipart File Upload Handler
 * =====================================================
 * 
 * Parses multipart/form-data for file uploads without external dependencies.
 * Uses Busboy for efficient streaming parsing.
 * 
 * @author Portfolio Project
 * @version 2.0.0
 */

import type { IncomingMessage } from 'http';
import Busboy from 'busboy';
import type { ParsedFile, ParsedFormData } from '../types';
import { LIMITS } from './validation';

// =====================================================
// FORM DATA PARSING
// =====================================================

/**
 * Parse multipart form data from incoming request
 * 
 * @param req - Incoming HTTP request
 * @returns Parsed files and fields
 * 
 * @example
 * const { files, fields } = await parseFormData(req);
 * console.log(`Received ${files.length} files`);
 */
export function parseFormData(req: IncomingMessage): Promise<ParsedFormData> {
  return new Promise((resolve, reject) => {
    const files: ParsedFile[] = [];
    const fields: Record<string, string> = {};
    
    // Track total size for limit checking
    let totalSize = 0;

    try {
      const busboy = Busboy({
        headers: req.headers,
        limits: {
          fileSize: LIMITS.MAX_FILE_SIZE,
          files: LIMITS.MAX_FILES,
          fields: 10,
        },
      });

      // Handle file uploads
      busboy.on('file', (fieldName: string, fileStream: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
        const { filename, mimeType } = info;
        const chunks: Buffer[] = [];

        fileStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          totalSize += chunk.length;

          // Check total size limit
          if (totalSize > LIMITS.MAX_TOTAL_SIZE) {
            fileStream.resume(); // Drain the stream
            reject(new Error(`Total upload size exceeds ${LIMITS.MAX_TOTAL_SIZE / (1024 * 1024)} MB limit`));
          }
        });

        fileStream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          
          files.push({
            fieldName,
            originalFilename: filename || 'unknown.pdf',
            mimetype: mimeType || 'application/pdf',
            buffer,
            size: buffer.length,
          });
        });

        fileStream.on('error', (error: Error) => {
          reject(new Error(`File upload error: ${error.message}`));
        });
      });

      // Handle regular form fields
      busboy.on('field', (fieldName: string, value: string) => {
        fields[fieldName] = value;
      });

      // Handle parsing completion
      busboy.on('close', () => {
        resolve({ files, fields });
      });

      // Handle parsing errors
      busboy.on('error', (error: Error) => {
        reject(new Error(`Form parsing error: ${error.message}`));
      });

      // Pipe request to busboy
      req.pipe(busboy);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parsing error';
      reject(new Error(`Failed to initialize form parser: ${message}`));
    }
  });
}

/**
 * Check if request content type is multipart form data
 * 
 * @param req - Incoming HTTP request
 * @returns True if content type is multipart/form-data
 */
export function isMultipartFormData(req: IncomingMessage): boolean {
  const contentType = req.headers['content-type'] || '';
  return contentType.toLowerCase().includes('multipart/form-data');
}

/**
 * Get content length from request headers
 * 
 * @param req - Incoming HTTP request
 * @returns Content length in bytes, or 0 if not specified
 */
export function getContentLength(req: IncomingMessage): number {
  const contentLength = req.headers['content-length'];
  return contentLength ? parseInt(contentLength, 10) : 0;
}

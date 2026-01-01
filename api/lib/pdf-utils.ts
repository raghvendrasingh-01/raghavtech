/**
 * =====================================================
 * PDF Processing Utilities - Core PDF Operations
 * =====================================================
 * 
 * Uses pdf-lib (open-source, MIT licensed) for PDF manipulation.
 * pdf-lib is browser-compatible and works great in serverless.
 * 
 * @author Portfolio Project
 * @version 2.0.0
 * @see https://pdf-lib.js.org/
 */

import { PDFDocument } from 'pdf-lib';
import type { PDFProcessingResult, ParsedFile } from '../types';

// =====================================================
// PDF MERGE
// =====================================================

/**
 * Merge multiple PDF files into a single document
 * 
 * @param files - Array of PDF file buffers
 * @returns Processing result with merged PDF buffer
 * 
 * @example
 * const result = await mergePDFs([buffer1, buffer2, buffer3]);
 * if (result.success) {
 *   // result.outputBuffer contains the merged PDF
 * }
 */
export async function mergePDFs(files: ParsedFile[]): Promise<PDFProcessingResult> {
  try {
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();
    
    let totalOriginalSize = 0;
    let totalPages = 0;

    // Process each PDF file
    for (const file of files) {
      totalOriginalSize += file.size;

      // Load the source PDF
      const sourcePdf = await PDFDocument.load(file.buffer, {
        // Ignore encryption for read-only operations
        ignoreEncryption: true,
      });

      // Copy all pages from source to merged document
      const pageIndices = sourcePdf.getPageIndices();
      const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
      
      // Add copied pages to the merged document
      copiedPages.forEach((page) => {
        mergedPdf.addPage(page);
      });

      totalPages += pageIndices.length;
    }

    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save({
      // Optimize for smaller file size
      useObjectStreams: true,
    });

    const outputBuffer = Buffer.from(mergedPdfBytes);

    return {
      success: true,
      outputBuffer,
      originalSize: totalOriginalSize,
      newSize: outputBuffer.length,
      message: `Successfully merged ${files.length} PDFs (${totalPages} total pages)`,
      filename: 'merged_document.pdf',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`PDF merge failed: ${errorMessage}`);
  }
}

// =====================================================
// PDF SPLIT
// =====================================================

/**
 * Split a PDF into individual pages
 * 
 * @param file - Source PDF file buffer
 * @param pageNumbers - Optional array of specific page numbers to extract (1-indexed)
 * @returns Array of processing results, one per page
 * 
 * @example
 * // Split all pages
 * const pages = await splitPDF(buffer);
 * 
 * // Split specific pages
 * const selectedPages = await splitPDF(buffer, [1, 3, 5]);
 */
export async function splitPDF(
  file: ParsedFile,
  pageNumbers?: number[]
): Promise<{ pages: PDFProcessingResult[]; totalPages: number }> {
  try {
    // Load the source PDF
    const sourcePdf = await PDFDocument.load(file.buffer, {
      ignoreEncryption: true,
    });

    const totalPages = sourcePdf.getPageCount();
    
    // Determine which pages to extract
    const pagesToExtract = pageNumbers 
      ? pageNumbers.filter(p => p >= 1 && p <= totalPages)
      : Array.from({ length: totalPages }, (_, i) => i + 1);

    const results: PDFProcessingResult[] = [];

    // Extract each page as a separate PDF
    for (const pageNum of pagesToExtract) {
      const newPdf = await PDFDocument.create();
      
      // Copy the specific page (pageNum is 1-indexed, array is 0-indexed)
      const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNum - 1]);
      newPdf.addPage(copiedPage);

      // Save the single-page PDF
      const pdfBytes = await newPdf.save({
        useObjectStreams: true,
      });

      const outputBuffer = Buffer.from(pdfBytes);
      const baseFilename = file.originalFilename.replace(/\.pdf$/i, '');

      results.push({
        success: true,
        outputBuffer,
        originalSize: file.size,
        newSize: outputBuffer.length,
        message: `Extracted page ${pageNum}`,
        filename: `${baseFilename}_page_${pageNum}.pdf`,
      });
    }

    return {
      pages: results,
      totalPages,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`PDF split failed: ${errorMessage}`);
  }
}

/**
 * Get the number of pages in a PDF
 * 
 * @param buffer - PDF file buffer
 * @returns Number of pages
 */
export async function getPDFPageCount(buffer: Buffer): Promise<number> {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return pdf.getPageCount();
}

// =====================================================
// PDF COMPRESS
// =====================================================

/**
 * Compress a PDF to reduce file size
 * 
 * Note: pdf-lib provides basic optimization through object streams.
 * For heavy compression (image downsampling, etc.), you'd need
 * additional libraries like sharp, but those increase bundle size.
 * 
 * @param file - Source PDF file buffer
 * @returns Processing result with compressed PDF buffer
 * 
 * @example
 * const result = await compressPDF(buffer);
 * console.log(`Reduced from ${result.originalSize} to ${result.newSize}`);
 */
export async function compressPDF(file: ParsedFile): Promise<PDFProcessingResult> {
  try {
    // Load the source PDF
    const sourcePdf = await PDFDocument.load(file.buffer, {
      ignoreEncryption: true,
    });

    // Create a new optimized PDF by copying all pages
    // This removes unused objects and optimizes the structure
    const optimizedPdf = await PDFDocument.create();
    
    const pageIndices = sourcePdf.getPageIndices();
    const copiedPages = await optimizedPdf.copyPages(sourcePdf, pageIndices);
    
    copiedPages.forEach((page) => {
      optimizedPdf.addPage(page);
    });

    // Copy metadata
    const sourceInfo = sourcePdf.getTitle();
    if (sourceInfo) optimizedPdf.setTitle(sourceInfo);

    const author = sourcePdf.getAuthor();
    if (author) optimizedPdf.setAuthor(author);

    const subject = sourcePdf.getSubject();
    if (subject) optimizedPdf.setSubject(subject);

    // Save with compression options
    const compressedBytes = await optimizedPdf.save({
      useObjectStreams: true,     // Compress objects into streams
      addDefaultPage: false,       // Don't add unnecessary blank page
    });

    const outputBuffer = Buffer.from(compressedBytes);
    const originalSize = file.size;
    const newSize = outputBuffer.length;
    
    // Calculate compression ratio
    const ratio = originalSize > 0 
      ? Math.round((1 - newSize / originalSize) * 100) 
      : 0;

    // Prepare output filename
    const baseFilename = file.originalFilename.replace(/\.pdf$/i, '');

    return {
      success: true,
      outputBuffer,
      originalSize,
      newSize,
      message: ratio > 0 
        ? `Compressed successfully (${ratio}% reduction)` 
        : 'PDF optimized (minimal compression achieved)',
      filename: `${baseFilename}_compressed.pdf`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`PDF compression failed: ${errorMessage}`);
  }
}

// =====================================================
// PDF UTILITIES
// =====================================================

/**
 * Validate that a buffer contains a valid PDF
 * 
 * @param buffer - File buffer to validate
 * @returns True if valid PDF, false otherwise
 */
export async function isValidPDF(buffer: Buffer): Promise<boolean> {
  try {
    await PDFDocument.load(buffer, { ignoreEncryption: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get PDF metadata
 * 
 * @param buffer - PDF file buffer
 * @returns PDF metadata object
 */
export async function getPDFMetadata(buffer: Buffer): Promise<{
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  creationDate?: Date;
  modificationDate?: Date;
}> {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  
  return {
    pageCount: pdf.getPageCount(),
    title: pdf.getTitle(),
    author: pdf.getAuthor(),
    subject: pdf.getSubject(),
    creator: pdf.getCreator(),
    creationDate: pdf.getCreationDate(),
    modificationDate: pdf.getModificationDate(),
  };
}

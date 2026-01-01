/**
 * =====================================================
 * Health Check API Endpoint
 * =====================================================
 * 
 * GET /api
 * 
 * Returns API health status and available capabilities.
 * Used by frontend to verify backend availability.
 * 
 * @author Portfolio Project
 * @version 2.0.0
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// =====================================================
// API METADATA
// =====================================================

const API_VERSION = '2.0.0';
const PLATFORM = 'vercel-nodejs';

/**
 * Available PDF processing capabilities
 */
const CAPABILITIES = [
  'merge',      // Merge multiple PDFs
  'split',      // Split PDF into pages
  'compress',   // Compress PDF file size
];

/**
 * API limits information
 */
const LIMITS = {
  maxFileSize: '4 MB',
  maxTotalSize: '10 MB',
  maxFiles: 20,
  timeout: '10 seconds',
};

// =====================================================
// CORS HEADERS
// =====================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Expose-Headers': 'X-Original-Size, X-New-Size, X-Message',
};

// =====================================================
// HANDLER
// =====================================================

/**
 * Health check endpoint handler
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
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.writeHead(405, {
      'Content-Type': 'application/json',
      'Allow': 'GET, OPTIONS',
      ...CORS_HEADERS,
    });
    res.end(JSON.stringify({
      success: false,
      error: 'Method not allowed',
      allowed: ['GET', 'OPTIONS'],
    }));
    return;
  }

  // Return health check response
  const response = {
    status: 'healthy',
    version: API_VERSION,
    platform: PLATFORM,
    timestamp: new Date().toISOString(),
    capabilities: CAPABILITIES,
    limits: LIMITS,
    endpoints: {
      health: 'GET /api',
      merge: 'POST /api/merge',
      split: 'POST /api/split',
      compress: 'POST /api/compress',
    },
  };

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    ...CORS_HEADERS,
  });
  res.end(JSON.stringify(response));
}

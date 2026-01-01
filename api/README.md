# 📄 PDF Tools Backend - Vercel Serverless API

A **production-ready, portfolio-quality** PDF processing backend built with Node.js serverless functions for Vercel's free tier. This API provides PDF merge, split, and compression capabilities using the open-source `pdf-lib` library.

## 🏗️ Architecture

```
api/
├── index.ts          # Health check & API info endpoint (GET /api)
├── merge.ts          # Merge multiple PDFs (POST /api/merge)
├── split.ts          # Split PDF into pages (POST /api/split)
├── compress.ts       # Compress PDF file size (POST /api/compress)
├── types.ts          # TypeScript type definitions
├── tsconfig.json     # TypeScript configuration for API
├── README.md         # This documentation
└── lib/
    ├── pdf-utils.ts  # Core PDF processing with pdf-lib
    ├── form-parser.ts # Multipart form data parsing (file uploads)
    ├── response.ts   # Standardized API response helpers
    └── validation.ts # Input validation & file sanitization
```

## 🚀 API Endpoints

### `GET /api`
Health check endpoint to verify API status and capabilities.

**Response:**
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "platform": "vercel-nodejs",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "capabilities": ["merge", "split", "compress"],
  "limits": {
    "maxFileSize": "4 MB",
    "maxTotalSize": "10 MB",
    "maxFiles": 20,
    "timeout": "10 seconds"
  }
}
```

---

### `POST /api/merge`
Merge multiple PDF files into a single document.

**Request:** `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | File[] | Yes | Multiple PDF files (minimum 2) |

**Response:** Binary PDF file with custom headers:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="merged_document.pdf"
X-Original-Size: 1234567  (total original size in bytes)
X-New-Size: 1234567       (merged file size in bytes)
X-Message: "Successfully merged 3 PDFs (15 total pages)"
```

**Example (JavaScript/TypeScript):**
```typescript
const formData = new FormData();
formData.append('files', file1);
formData.append('files', file2);
formData.append('files', file3);

const response = await fetch('/api/merge', {
  method: 'POST',
  body: formData
});

if (response.ok) {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  // Trigger download or display
}
```

---

### `POST /api/split`
Split a PDF into individual pages (returned as ZIP file).

**Request:** `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Single PDF file to split |
| `pages` | String | No | Page selection (e.g., "1,3,5-7" or "all") |

**Response:** Binary ZIP file containing individual PDF pages:
```
Content-Type: application/zip
Content-Disposition: attachment; filename="document_pages.zip"
X-File-Count: 10
X-Message: "Successfully split into 10 pages"
```

**Page Selection Examples:**
- `"all"` or empty - Extract all pages
- `"1,3,5"` - Extract pages 1, 3, and 5
- `"1-5"` - Extract pages 1 through 5
- `"1,3-5,7"` - Extract pages 1, 3, 4, 5, and 7

**Example:**
```typescript
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('pages', '1-5'); // Optional: specific pages

const response = await fetch('/api/split', {
  method: 'POST',
  body: formData
});

if (response.ok) {
  const blob = await response.blob();
  // blob is a ZIP file containing individual PDF pages
}
```

---

### `POST /api/compress`
Compress PDF to reduce file size using structural optimization.

**Request:** `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Single PDF file to compress |

**Response:** Binary compressed PDF file:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="document_compressed.pdf"
X-Original-Size: 5000000
X-New-Size: 3500000
X-Message: "Compressed successfully (30% reduction)"
```

**Note:** Compression uses `pdf-lib`'s structural optimization (object streams, removing unused objects). For heavy compression with image downsampling, additional libraries would be needed, which exceeds Vercel free tier limits.

---

## 📊 HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Operation completed successfully |
| 204 | No Content | CORS preflight response |
| 400 | Bad Request | Invalid input, wrong file type, validation error |
| 405 | Method Not Allowed | Wrong HTTP method used |
| 413 | Payload Too Large | File exceeds size limit |
| 500 | Internal Server Error | Processing failed |

## ⚠️ Vercel Free Tier Limits

| Limit | Value | Notes |
|-------|-------|-------|
| Execution Time | 10 seconds | Max processing time per request |
| Memory | 1024 MB | Max memory allocation |
| Payload Size | ~4.5 MB | After base64 encoding |
| **Recommended File Size** | ≤ 3 MB | For reliable operation |

## 🛡️ Security Features

1. **File Type Validation** - Only `.pdf` files accepted
2. **Magic Bytes Check** - Validates actual PDF content, not just extension
3. **Size Limits** - Enforced at multiple levels
4. **Filename Sanitization** - Removes dangerous characters
5. **In-Memory Processing** - No files stored on server
6. **CORS Configured** - Cross-origin requests handled properly

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Run Vercel dev server (simulates serverless functions)
npx vercel dev

# Or run your Vite frontend separately
npm run dev
```

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `pdf-lib` | ^1.17.1 | PDF manipulation (MIT licensed) |
| `busboy` | ^1.6.0 | Multipart form parsing |
| `jszip` | ^3.10.1 | Creating ZIP archives |
| `@vercel/node` | ^3.0.0 | Vercel Node.js runtime |

## 🚀 Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Vercel automatically detects and deploys:
   - Frontend: Vite build to `dist/`
   - API: `/api` folder as serverless functions

**vercel.json Configuration:**
```json
{
  "functions": {
    "api/**/*.ts": {
      "runtime": "@vercel/node@3.0.0",
      "maxDuration": 10,
      "memory": 1024
    }
  }
}
```

## 🎯 Portfolio Showcase Points

- ✅ **Zero Cost** - Runs entirely on Vercel free tier
- ✅ **No External APIs** - Uses open-source pdf-lib library
- ✅ **Production-Ready** - Proper error handling, validation, TypeScript
- ✅ **Scalable** - Serverless architecture auto-scales
- ✅ **Secure** - In-memory processing, file validation
- ✅ **Well-Documented** - Clear API documentation and code comments
- ✅ **Modern Stack** - TypeScript, ESM, latest Node.js features

## 📝 Error Response Format

All errors return consistent JSON:
```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": "Additional context (optional)",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

**Error Codes:**
- `INVALID_FILE_TYPE` - Not a PDF file
- `FILE_TOO_LARGE` - Exceeds size limit
- `NO_FILES_PROVIDED` - No files uploaded
- `INSUFFICIENT_FILES` - Merge requires ≥2 files
- `INVALID_PAGE_RANGE` - Bad page selection for split
- `PDF_PROCESSING_ERROR` - Processing failed

---

*Built with ❤️ as a portfolio demonstration project*

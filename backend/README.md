# Smart PDF Converter - Backend

A FastAPI backend for PDF processing operations.

## Quick Start

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the Server

```bash
python main.py
# Or with uvicorn directly:
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: `http://localhost:8000`

### 4. API Documentation

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/upload` | POST | Upload single PDF |
| `/upload/multiple` | POST | Upload multiple PDFs |
| `/convert/pdf-to-word` | POST | Convert PDF to Word |
| `/convert/pdf-to-image` | POST | Convert PDF to images |
| `/merge` | POST | Merge multiple PDFs |
| `/compress` | POST | Compress PDF |
| `/download/{filename}` | GET | Download processed file |
| `/cleanup` | DELETE | Clear temporary files |

## Features

- ✅ PDF to Word conversion (requires pdf2docx)
- ✅ PDF to Image conversion (PNG format)
- ✅ Merge multiple PDFs
- ✅ Compress PDF files
- ✅ Automatic file cleanup
- ✅ CORS enabled for frontend integration

## File Limits

- Maximum file size: 50MB
- Files auto-deleted after 1 hour

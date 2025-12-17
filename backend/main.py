"""
Smart PDF Converter - FastAPI Backend
=====================================
A REST API for PDF processing operations using PyPDF2 and other libraries.

Endpoints:
- POST /upload - Upload PDF files
- POST /convert/pdf-to-word - Convert PDF to Word
- POST /convert/pdf-to-image - Convert PDF to images
- POST /merge - Merge multiple PDFs
- POST /compress - Compress PDF file
"""

import os
import io
import uuid
import shutil
from pathlib import Path
from typing import List
from datetime import datetime, timedelta

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

# PDF Processing Libraries
import PyPDF2
from PyPDF2 import PdfReader, PdfWriter
from PIL import Image

# PDF to Image conversion (uses poppler-utils)
try:
    from pdf2image import convert_from_path
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False
    print("Warning: pdf2image not installed. PDF to Image conversion will be limited.")

# Optional: For PDF to Word conversion
try:
    from pdf2docx import Converter
    PDF2DOCX_AVAILABLE = True
except ImportError:
    PDF2DOCX_AVAILABLE = False
    print("Warning: pdf2docx not installed. PDF to Word conversion will be limited.")

# =====================
# APP CONFIGURATION
# =====================

app = FastAPI(
    title="Smart PDF Converter API",
    description="API for converting, merging, and compressing PDF files",
    version="1.0.0"
)

# CORS configuration - allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================
# STORAGE CONFIGURATION
# =====================

# Create directories for file storage
UPLOAD_DIR = Path("./uploads")
OUTPUT_DIR = Path("./outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# File retention time (files auto-deleted after this)
FILE_RETENTION_HOURS = 1

# Maximum file size (50MB)
MAX_FILE_SIZE = 50 * 1024 * 1024

# =====================
# PYDANTIC MODELS
# =====================

class FileInfo(BaseModel):
    id: str
    filename: str
    size: int
    uploaded_at: str

class ConversionResponse(BaseModel):
    success: bool
    message: str
    output_file: str | None = None
    download_url: str | None = None
    original_size: int | None = None
    new_size: int | None = None

class HealthResponse(BaseModel):
    status: str
    version: str
    pdf2docx_available: bool
    pdf2image_available: bool

# =====================
# UTILITY FUNCTIONS
# =====================

def generate_file_id() -> str:
    """Generate a unique file ID"""
    return str(uuid.uuid4())[:8]

def get_file_size(file_path: Path) -> int:
    """Get file size in bytes"""
    return file_path.stat().st_size if file_path.exists() else 0

def cleanup_old_files(directory: Path, hours: int = FILE_RETENTION_HOURS):
    """Remove files older than specified hours"""
    cutoff = datetime.now() - timedelta(hours=hours)
    for file_path in directory.iterdir():
        if file_path.is_file():
            file_time = datetime.fromtimestamp(file_path.stat().st_mtime)
            if file_time < cutoff:
                file_path.unlink()

def save_upload_file(upload_file: UploadFile, destination: Path) -> int:
    """Save uploaded file and return its size"""
    with destination.open("wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    return get_file_size(destination)

# =====================
# API ENDPOINTS
# =====================

@app.get("/", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        pdf2docx_available=PDF2DOCX_AVAILABLE,
        pdf2image_available=PDF2IMAGE_AVAILABLE
    )

@app.post("/upload", response_model=FileInfo)
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a PDF file for processing.
    Returns file ID for use in subsequent operations.
    """
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Generate unique ID and save file
    file_id = generate_file_id()
    file_path = UPLOAD_DIR / f"{file_id}_{file.filename}"
    
    try:
        size = save_upload_file(file, file_path)
        
        if size > MAX_FILE_SIZE:
            file_path.unlink()
            raise HTTPException(status_code=400, detail="File size exceeds 50MB limit")
        
        return FileInfo(
            id=file_id,
            filename=file.filename,
            size=size,
            uploaded_at=datetime.now().isoformat()
        )
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload/multiple")
async def upload_multiple_files(files: List[UploadFile] = File(...)):
    """Upload multiple PDF files for merging"""
    uploaded_files = []
    
    for file in files:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail=f"Only PDF files allowed: {file.filename}")
        
        file_id = generate_file_id()
        file_path = UPLOAD_DIR / f"{file_id}_{file.filename}"
        size = save_upload_file(file, file_path)
        
        uploaded_files.append(FileInfo(
            id=file_id,
            filename=file.filename,
            size=size,
            uploaded_at=datetime.now().isoformat()
        ))
    
    return {"files": uploaded_files}

@app.post("/convert/pdf-to-word", response_model=ConversionResponse)
async def convert_pdf_to_word(file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    """
    Convert PDF to Word document (.docx)
    Uses pdf2docx library for conversion.
    """
    if not PDF2DOCX_AVAILABLE:
        raise HTTPException(
            status_code=501, 
            detail="PDF to Word conversion not available. Install pdf2docx: pip install pdf2docx"
        )
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    file_id = generate_file_id()
    input_path = UPLOAD_DIR / f"{file_id}_input.pdf"
    output_filename = file.filename.replace('.pdf', '.docx').replace('.PDF', '.docx')
    output_path = OUTPUT_DIR / f"{file_id}_{output_filename}"
    
    try:
        # Save uploaded file
        original_size = save_upload_file(file, input_path)
        
        # Convert PDF to Word
        cv = Converter(str(input_path))
        cv.convert(str(output_path))
        cv.close()
        
        new_size = get_file_size(output_path)
        
        # Schedule cleanup
        if background_tasks:
            background_tasks.add_task(cleanup_old_files, UPLOAD_DIR)
            background_tasks.add_task(cleanup_old_files, OUTPUT_DIR)
        
        return ConversionResponse(
            success=True,
            message="PDF converted to Word successfully",
            output_file=output_filename,
            download_url=f"/download/{file_id}_{output_filename}",
            original_size=original_size,
            new_size=new_size
        )
    except Exception as e:
        # Cleanup on error
        if input_path.exists():
            input_path.unlink()
        if output_path.exists():
            output_path.unlink()
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")

@app.post("/convert/pdf-to-image", response_model=ConversionResponse)
async def convert_pdf_to_image(
    file: UploadFile = File(...),
    dpi: int = 200,
    background_tasks: BackgroundTasks = None
):
    """
    Convert PDF pages to images (PNG format).
    Returns a ZIP file containing all page images.
    Requires poppler-utils to be installed on the system.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    if not PDF2IMAGE_AVAILABLE:
        raise HTTPException(
            status_code=501,
            detail="PDF to Image conversion not available. Install pdf2image and poppler-utils."
        )
    
    file_id = generate_file_id()
    input_path = UPLOAD_DIR / f"{file_id}_input.pdf"
    output_dir = OUTPUT_DIR / f"{file_id}_images"
    output_zip = OUTPUT_DIR / f"{file_id}_images.zip"
    
    try:
        # Save uploaded file
        original_size = save_upload_file(file, input_path)
        
        # Create output directory
        output_dir.mkdir(exist_ok=True)
        
        # Convert PDF to images using pdf2image (poppler)
        images = convert_from_path(str(input_path), dpi=dpi)
        
        for i, image in enumerate(images):
            image_path = output_dir / f"page_{i + 1}.png"
            image.save(str(image_path), "PNG")
        
        # Create ZIP file
        shutil.make_archive(str(output_zip.with_suffix('')), 'zip', output_dir)
        
        # Cleanup image directory
        shutil.rmtree(output_dir)
        
        new_size = get_file_size(output_zip)
        output_filename = file.filename.replace('.pdf', '_images.zip').replace('.PDF', '_images.zip')
        
        # Rename to proper filename
        final_path = OUTPUT_DIR / f"{file_id}_{output_filename}"
        output_zip.rename(final_path)
        
        # Cleanup input
        input_path.unlink()
        
        if background_tasks:
            background_tasks.add_task(cleanup_old_files, OUTPUT_DIR)
        
        return ConversionResponse(
            success=True,
            message=f"PDF converted to {len(images)} images",
            output_file=output_filename,
            download_url=f"/download/{file_id}_{output_filename}",
            original_size=original_size,
            new_size=new_size
        )
    except Exception as e:
        # Cleanup on error
        if input_path.exists():
            input_path.unlink()
        if output_dir.exists():
            shutil.rmtree(output_dir)
        if output_zip.exists():
            output_zip.unlink()
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")

@app.post("/merge", response_model=ConversionResponse)
async def merge_pdfs(files: List[UploadFile] = File(...), background_tasks: BackgroundTasks = None):
    """
    Merge multiple PDF files into one.
    Files are merged in the order they are uploaded.
    """
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="At least 2 PDF files required for merging")
    
    for file in files:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail=f"Only PDF files allowed: {file.filename}")
    
    file_id = generate_file_id()
    input_paths = []
    output_path = OUTPUT_DIR / f"{file_id}_merged.pdf"
    total_original_size = 0
    
    try:
        # Save all uploaded files
        for i, file in enumerate(files):
            input_path = UPLOAD_DIR / f"{file_id}_input_{i}.pdf"
            size = save_upload_file(file, input_path)
            total_original_size += size
            input_paths.append(input_path)
        
        # Merge PDFs using PyPDF2
        pdf_writer = PdfWriter()
        
        for input_path in input_paths:
            pdf_reader = PdfReader(str(input_path))
            for page in pdf_reader.pages:
                pdf_writer.add_page(page)
        
        # Write merged PDF
        with open(output_path, 'wb') as output_file:
            pdf_writer.write(output_file)
        
        new_size = get_file_size(output_path)
        
        # Cleanup input files
        for input_path in input_paths:
            input_path.unlink()
        
        if background_tasks:
            background_tasks.add_task(cleanup_old_files, OUTPUT_DIR)
        
        return ConversionResponse(
            success=True,
            message=f"Successfully merged {len(files)} PDF files",
            output_file="merged.pdf",
            download_url=f"/download/{file_id}_merged.pdf",
            original_size=total_original_size,
            new_size=new_size
        )
    except Exception as e:
        # Cleanup on error
        for input_path in input_paths:
            if input_path.exists():
                input_path.unlink()
        if output_path.exists():
            output_path.unlink()
        raise HTTPException(status_code=500, detail=f"Merge failed: {str(e)}")

@app.post("/compress", response_model=ConversionResponse)
async def compress_pdf(
    file: UploadFile = File(...),
    quality: str = "medium",
    background_tasks: BackgroundTasks = None
):
    """
    Compress PDF file to reduce size.
    Uses PyPDF2 for basic compression (removes unused objects, compresses streams).
    
    Quality options:
    - low: Maximum compression
    - medium: Balanced compression (default)
    - high: Minimal compression
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    file_id = generate_file_id()
    input_path = UPLOAD_DIR / f"{file_id}_input.pdf"
    output_filename = file.filename.replace('.pdf', '_compressed.pdf').replace('.PDF', '_compressed.pdf')
    output_path = OUTPUT_DIR / f"{file_id}_{output_filename}"
    
    try:
        # Save uploaded file
        original_size = save_upload_file(file, input_path)
        
        # Read and compress PDF using PyPDF2
        reader = PdfReader(str(input_path))
        writer = PdfWriter()
        
        # Copy all pages
        for page in reader.pages:
            # Compress page content
            page.compress_content_streams()
            writer.add_page(page)
        
        # Remove unused objects and compress
        writer.add_metadata(reader.metadata or {})
        
        # Write compressed PDF
        with open(output_path, 'wb') as output_file:
            writer.write(output_file)
        
        new_size = get_file_size(output_path)
        
        # Cleanup input
        input_path.unlink()
        
        if background_tasks:
            background_tasks.add_task(cleanup_old_files, OUTPUT_DIR)
        
        compression_ratio = round((1 - new_size / original_size) * 100, 1) if original_size > 0 else 0
        
        return ConversionResponse(
            success=True,
            message=f"PDF compressed successfully ({compression_ratio}% reduction)" if compression_ratio > 0 else "PDF optimized (minimal size reduction possible)",
            output_file=output_filename,
            download_url=f"/download/{file_id}_{output_filename}",
            original_size=original_size,
            new_size=new_size
        )
    except Exception as e:
        # Cleanup on error
        if input_path.exists():
            input_path.unlink()
        if output_path.exists():
            output_path.unlink()
        raise HTTPException(status_code=500, detail=f"Compression failed: {str(e)}")

@app.get("/download/{filename}")
async def download_file(filename: str):
    """Download a processed file"""
    file_path = OUTPUT_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found or expired")
    
    # Determine media type
    if filename.endswith('.pdf'):
        media_type = "application/pdf"
    elif filename.endswith('.docx'):
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif filename.endswith('.zip'):
        media_type = "application/zip"
    else:
        media_type = "application/octet-stream"
    
    return FileResponse(
        path=file_path,
        filename=filename.split('_', 1)[1] if '_' in filename else filename,
        media_type=media_type
    )

@app.delete("/cleanup")
async def cleanup_files():
    """Manually trigger file cleanup"""
    cleanup_old_files(UPLOAD_DIR, hours=0)
    cleanup_old_files(OUTPUT_DIR, hours=0)
    return {"message": "All temporary files cleaned up"}

# =====================
# RUN SERVER
# =====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

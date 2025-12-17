"""
Smart PDF Converter - Vercel Serverless API
============================================
Main entry point for Vercel Python serverless functions.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List
import io
import uuid
import zipfile
from datetime import datetime

# PDF Processing
import PyPDF2
from PyPDF2 import PdfReader, PdfWriter

# =====================
# APP CONFIGURATION
# =====================

app = FastAPI(
    title="Smart PDF Converter API",
    description="Serverless API for PDF processing on Vercel",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================
# PYDANTIC MODELS
# =====================

class HealthResponse(BaseModel):
    status: str
    version: str
    platform: str

class ConversionResponse(BaseModel):
    success: bool
    message: str
    filename: str | None = None
    original_size: int | None = None
    new_size: int | None = None

# =====================
# UTILITY FUNCTIONS
# =====================

def format_file_size(bytes: int) -> str:
    """Format bytes to human readable string"""
    if bytes == 0:
        return "0 Bytes"
    k = 1024
    sizes = ["Bytes", "KB", "MB", "GB"]
    i = 0
    while bytes >= k and i < len(sizes) - 1:
        bytes /= k
        i += 1
    return f"{bytes:.2f} {sizes[i]}"

# =====================
# API ENDPOINTS
# =====================

@app.get("/api")
@app.get("/api/")
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        platform="vercel"
    )

@app.post("/api/merge")
async def merge_pdfs(files: List[UploadFile] = File(...)):
    """
    Merge multiple PDF files into one.
    Returns the merged PDF as a downloadable file.
    """
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="At least 2 PDF files required for merging")
    
    for file in files:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail=f"Only PDF files allowed: {file.filename}")
    
    try:
        pdf_writer = PdfWriter()
        total_original_size = 0
        
        for file in files:
            content = await file.read()
            total_original_size += len(content)
            
            pdf_reader = PdfReader(io.BytesIO(content))
            for page in pdf_reader.pages:
                pdf_writer.add_page(page)
        
        # Write merged PDF to bytes
        output_buffer = io.BytesIO()
        pdf_writer.write(output_buffer)
        output_buffer.seek(0)
        merged_content = output_buffer.getvalue()
        
        return Response(
            content=merged_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=merged_document.pdf",
                "X-Original-Size": str(total_original_size),
                "X-New-Size": str(len(merged_content)),
                "X-Message": f"Successfully merged {len(files)} PDF files"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Merge failed: {str(e)}")

@app.post("/api/compress")
async def compress_pdf(file: UploadFile = File(...)):
    """
    Compress PDF file to reduce size.
    Returns the compressed PDF as a downloadable file.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        content = await file.read()
        original_size = len(content)
        
        # Read and compress PDF using PyPDF2
        reader = PdfReader(io.BytesIO(content))
        writer = PdfWriter()
        
        # Copy all pages with compression
        for page in reader.pages:
            page.compress_content_streams()
            writer.add_page(page)
        
        # Copy metadata
        if reader.metadata:
            writer.add_metadata(reader.metadata)
        
        # Write compressed PDF to bytes
        output_buffer = io.BytesIO()
        writer.write(output_buffer)
        output_buffer.seek(0)
        compressed_content = output_buffer.getvalue()
        
        new_size = len(compressed_content)
        compression_ratio = round((1 - new_size / original_size) * 100, 1) if original_size > 0 else 0
        
        output_filename = file.filename.replace('.pdf', '_compressed.pdf').replace('.PDF', '_compressed.pdf')
        
        return Response(
            content=compressed_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={output_filename}",
                "X-Original-Size": str(original_size),
                "X-New-Size": str(new_size),
                "X-Message": f"PDF compressed successfully ({compression_ratio}% reduction)" if compression_ratio > 0 else "PDF optimized"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compression failed: {str(e)}")

@app.post("/api/convert/pdf-to-image")
async def convert_pdf_to_image(file: UploadFile = File(...)):
    """
    Convert PDF to images (limited on serverless - returns page count info).
    For full conversion, use local backend.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        content = await file.read()
        reader = PdfReader(io.BytesIO(content))
        page_count = len(reader.pages)
        
        # On serverless, we can't easily do image conversion without additional deps
        # Return info about the PDF instead
        raise HTTPException(
            status_code=501, 
            detail=f"PDF to Image conversion requires local backend. This PDF has {page_count} pages."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading PDF: {str(e)}")

@app.post("/api/convert/pdf-to-word")
async def convert_pdf_to_word(file: UploadFile = File(...)):
    """
    Convert PDF to Word (not available on serverless).
    """
    raise HTTPException(
        status_code=501,
        detail="PDF to Word conversion requires local backend with pdf2docx library."
    )

# For Vercel
handler = app

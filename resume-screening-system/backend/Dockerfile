FROM python:3.12-slim

# Set environment variables for better Python and memory behavior
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies (required for some Python packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# First, install the CPU-only PyTorch to heavily reduce memory usage and image size
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Then, install the rest of the requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the actual application code
COPY ./app ./app

# Expose the port Koyeb (or Render) expects
EXPOSE $PORT

# Start the application
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT

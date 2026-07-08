# Pulse API — container image (works on Render, Koyeb, Fly, Cloud Run, etc.)
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first for better layer caching.
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e .

COPY app ./app

EXPOSE 8000
# $PORT is provided by most PaaS platforms; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

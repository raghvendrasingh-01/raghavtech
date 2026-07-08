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

EXPOSE 8080
# Cloud Run defaults to 8080. Hardcoding it avoids shell variable expansion issues.
CMD exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8080

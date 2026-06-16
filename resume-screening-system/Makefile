# Convenience commands for the AI Resume Screening System.
# Usage: `make <target>`

BACKEND := backend
FRONTEND := frontend
PY := $(BACKEND)/venv/bin/python

.PHONY: help backend frontend test install-dev install-frontend lint build clean

help:
	@echo "Targets:"
	@echo "  backend          Run the FastAPI dev server on :8000"
	@echo "  frontend         Run the Vite dev server on :5173"
	@echo "  test             Run the backend pytest suite (needs 'make install-dev' first)"
	@echo "  install-dev      Install backend dev/test deps (pytest, httpx)"
	@echo "  install-frontend Install frontend npm dependencies"
	@echo "  lint             Lint the frontend"
	@echo "  build            Production-build the frontend"
	@echo "  clean            Remove build/cache artifacts"

backend:
	cd $(BACKEND) && ./venv/bin/python -m uvicorn app.main:app --reload --port 8000

frontend:
	cd $(FRONTEND) && npm run dev

test:
	cd $(BACKEND) && ./venv/bin/python -m pytest

install-dev:
	cd $(BACKEND) && ./venv/bin/python -m pip install -r requirements-dev.txt

install-frontend:
	cd $(FRONTEND) && npm install

lint:
	cd $(FRONTEND) && npm run lint

build:
	cd $(FRONTEND) && npm run build

clean:
	rm -rf $(FRONTEND)/dist
	find $(BACKEND) -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -rf $(BACKEND)/.pytest_cache

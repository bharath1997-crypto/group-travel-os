SHELL := /bin/bash

PYTHON := python3
PIP := pip3
API_DIR := apps/api
WEB_DIR := apps/web
WORKER_DIR := workers/pdf
VENV := .venv
ACT := source $(VENV)/bin/activate

.PHONY: setup dev:web dev:api test:api export:sample deploy:web clean env

env:
	@[ -f .env.shared ] || cp /dev/null .env.shared
	@[ -f .env.web.local ] || cp /dev/null .env.web.local
	@[ -f .env.api.local ] || cp /dev/null .env.api.local

setup: ## Install web deps and api deps
    @echo "==> Setting up web (pnpm)"
    cd $(WEB_DIR) && corepack enable && corepack prepare pnpm@9.12.1 --activate && pnpm install || true
    @echo "==> Setting up api (venv or user site)"
    @if [ ! -d $(VENV) ]; then \
        if $(PYTHON) -m venv $(VENV) >/dev/null 2>&1; then \
            echo "Created venv"; \
        else \
            echo "Warning: venv unavailable, will install to user site"; \
        fi; \
    fi
    @if [ -x $(VENV)/bin/pip ]; then \
        . $(VENV)/bin/activate && pip install --upgrade pip && pip install -r $(API_DIR)/requirements.txt; \
    else \
        $(PIP) install --user -r $(API_DIR)/requirements.txt; \
    fi

DEV_HOST ?= 0.0.0.0

dev: dev:api dev:web

dev:api: ## Run FastAPI dev server
    @if [ -x $(VENV)/bin/uvicorn ]; then \
        $(VENV)/bin/uvicorn apps.api.main:app --reload --host $(DEV_HOST) --port 8000; \
    else \
        uvicorn apps.api.main:app --reload --host $(DEV_HOST) --port 8000; \
    fi

dev:web: ## Run Next.js dev server
	cd $(WEB_DIR) && pnpm dev

test:api: ## Curl /health
    @curl -sSf http://localhost:8000/health | jq . || curl -sSf http://localhost:8000/health

export:sample: ## Generate a sample PDF to /tmp
    @PYTHONPATH=storyboard $(PYTHON) -c 'from workers.pdf.export import build_pdf; plan={"title":"Sample","style":"educational","pages":[{"page":1,"panels":[{"i":1,"caption":"A","dialogue":"Hello"},{"i":2,"caption":"B","dialogue":"World"},{"i":3,"caption":"C","dialogue":"!"},{"i":4,"caption":"D","dialogue":"Bye"}]}]}; out="/tmp/storyboard_sample.pdf"; build_pdf(plan, out); print(out)'
    @ls -l /tmp/storyboard_sample.pdf

deploy:web:
	@echo "Stub: Deploy web via Vercel CLI (requires secrets)"

clean:
	rm -rf $(VENV)
	rm -rf $(WEB_DIR)/node_modules
	rm -rf $(WEB_DIR)/.next

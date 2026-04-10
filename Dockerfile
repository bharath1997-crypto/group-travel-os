FROM python:3.13-slim

WORKDIR /app

# Compilers for any packages that fall back to source builds (e.g. grpcio) on the build image.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

# Production deps only — omit pyright/pytest stack (heavy; breaks or slows Cloud Build).
COPY requirements-prod.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements-prod.txt

COPY . .

EXPOSE 8080

# Cloud Run sets PORT; default 8080 for local `docker run`.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]

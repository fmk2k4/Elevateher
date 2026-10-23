#!/usr/bin/env bash
set -e

echo "Running database migrations..."
if ! python /app/scripts/apply_migrations.py; then
    if [ "${ENVIRONMENT:-development}" = "production" ]; then
        echo "CRITICAL: Database migrations failed in production. Halting startup."
        exit 1
    else
        echo "Warning: Database migrations had errors in development mode, continuing with caution..."
    fi
fi

echo "Starting FastAPI server..."
WORKERS="${UVICORN_WORKERS:-2}"

if [ "${ENVIRONMENT:-development}" = "production" ]; then
    # Production: multiple workers, no reload
    exec uvicorn main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --workers "${WORKERS}" \
        --loop uvloop \
        --access-log
else
    # Development / staging: single worker with hot reload
    exec uvicorn main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --reload
fi

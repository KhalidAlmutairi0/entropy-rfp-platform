#!/bin/sh
set -e

if [ "$SERVICE_TYPE" = "worker" ]; then
    echo "Starting Celery worker..."
    exec python -m celery -A core.celery_app worker --loglevel=info --concurrency=2 --pool=solo
fi

echo "Setting up database..."
python create_tables.py

echo "Running database seed..."
python seed.py

echo "Starting server..."
exec uvicorn main:app --host 0.0.0.0 --port 8000

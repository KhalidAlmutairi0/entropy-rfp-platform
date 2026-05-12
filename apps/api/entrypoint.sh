#!/bin/sh
set -e

echo "Setting up database..."
python create_tables.py

echo "Running database seed..."
python seed.py

echo "Starting server..."
exec uvicorn main:app --host 0.0.0.0 --port 8000

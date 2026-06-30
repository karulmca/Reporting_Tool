#!/bin/bash
# Quick start for BlueBolt Innovation Tracker (React UI)
# Starts the FastAPI backend (:8080) in the background and the React dev
# server (:5173). The React app proxies /api calls to the backend.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "BlueBolt Innovation Tracker - Quick Start"
echo "=========================================="

# --- Backend --------------------------------------------------------------
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then python -m venv .venv; fi
if [ -f ".venv/Scripts/python.exe" ]; then PY=".venv/Scripts/python.exe"; else PY=".venv/bin/python"; fi
"$PY" -m pip install -q -r requirements.txt
echo "Starting backend on http://localhost:8080 ..."
"$PY" main.py &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null' EXIT

# --- Frontend -------------------------------------------------------------
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then npm install; fi
echo "Starting React dev server on http://localhost:5173 ..."
npm run dev

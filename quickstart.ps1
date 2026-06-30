# PowerShell Quick Start for BlueBolt Innovation Tracker (React UI)
# Run: .\quickstart.ps1
#
# Starts the FastAPI backend (:8080) in a background window and the React
# dev server (:5173). The React app proxies /api calls to the backend.

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "BlueBolt Innovation Tracker - Quick Start" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

$root = $PSScriptRoot

if (-not (Test-Path "$root\backend") -or -not (Test-Path "$root\frontend")) {
    Write-Host "X Run this from the project root (backend/ and frontend/ expected)." -ForegroundColor Red
    exit 1
}

# --- Backend -------------------------------------------------------------
Write-Host "Setting up backend..." -ForegroundColor Yellow
Set-Location "$root\backend"
if (-not (Test-Path ".venv")) { python -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install -q -r requirements.txt
Write-Host "Starting backend on http://localhost:8080 ..." -ForegroundColor Green
Start-Process -FilePath ".\.venv\Scripts\python.exe" -ArgumentList "main.py" -WorkingDirectory "$root\backend"

# --- Frontend ------------------------------------------------------------
Write-Host "Setting up frontend..." -ForegroundColor Yellow
Set-Location "$root\frontend"
if (-not (Test-Path "node_modules")) { npm install }

Start-Job -ScriptBlock { Start-Sleep -Seconds 4; Start-Process "http://localhost:5173" } | Out-Null

Write-Host ""
Write-Host "Starting React dev server on http://localhost:5173 ..." -ForegroundColor Cyan
Write-Host "(Press CTRL+C to stop the frontend; close the backend window to stop the API)" -ForegroundColor Gray
Write-Host ""
npm run dev

# OUR 911

OUR 911 is a health hackathon project with a React/Vite frontend and a modular
Flask REST API. This repository contains the project foundation only; feature
modules have not been implemented.

## Requirements

- Node.js 18 or newer and npm
- Python 3.9 or newer

## Backend setup

In PowerShell, from the repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
python run.py
```

The API starts at `http://127.0.0.1:5000`. Its health endpoint is
`http://127.0.0.1:5000/api/health`.

If PowerShell prevents virtual-environment activation, either enable script
execution for your user according to your organization's policy or invoke
`.venv\Scripts\python.exe` directly for the pip install and run commands.

## Frontend setup

Open a second PowerShell terminal from the repository root:

```powershell
cd frontend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run dev
```

Vite prints the local development URL, usually `http://localhost:5173`.
`VITE_API_BASE_URL` in `frontend/.env` controls the API URL used by the Axios
client; its default points to the local Flask backend.

## Verify the setup

With the backend running, request the health endpoint:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

Build the frontend in another terminal:

```powershell
cd frontend
npm run build
```

## Project layout

- `frontend/` — Vite, React, Tailwind CSS, routing, and the shared Axios client.
- `backend/run.py` — local Flask development entry point.
- `backend/app/__init__.py` — Flask application factory and extension setup.
- `backend/app/config.py` — environment-based configuration and SQLite default.
- `backend/app/extensions.py` — shared SQLAlchemy and JWT extension instances.
- `backend/app/routes/health.py` — `GET /api/health` endpoint.
- `backend/tests/` — backend API smoke test.

The SQLite database is configured at `backend/instance/our911.db` by default
and is ignored by git. It is created when database tables are first used.
Copy the relevant `.env.example` to `.env` and set unique secret values before
using this project beyond local development. Never commit `.env` files or real
user data.

# OUR 911

**One unified response.** OUR 911 is an integrated emergency response and
life-saving service platform. **Every second matters. Every life counts.**
It provides
first-aid guidance, private incident reporting, aggregate health insights,
voluntary donor coordination, and a campus health facility directory. It is
**not** an ambulance dispatch application.

## Technology

- React, Vite, Tailwind CSS, React Router, Axios, and Chart.js
- Flask REST API, Flask-SQLAlchemy, Flask-JWT-Extended, SQLite
- Render web service and static site deployment configuration

## Local development (Windows PowerShell)

From the repository root:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
```

In the first terminal, start the API:

```powershell
Set-Location backend
& "..\.venv\Scripts\python.exe" run.py
```

The API listens on `http://127.0.0.1:5000`; its health check is
`http://127.0.0.1:5000/api/health`.

In a second terminal from the repository root:

```powershell
if (-not (Test-Path frontend\.env)) { Copy-Item frontend\.env.example frontend\.env }
Set-Location frontend
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). The SQLite database is
stored in `backend/instance/our911.db` unless `DATABASE_URL` is set. Startup
creates missing tables and applies additive SQLite column updates without
deleting existing records.

### Accounts and roles

Public registration creates student accounts. Create or promote a trusted
staff account from a backend terminal with:

```powershell
& "..\.venv\Scripts\python.exe" -m flask --app run:app create-user
```

The command prompts for name, email, role, and a hidden password. It supports
`admin`, `health_personnel`, and `student`; do not share administrator access.

## Application modules

1. **Welcome and Dashboard** — sign in, create an account, continue with email,
   or continue as a guest. The dashboard loads report, donor and facility
   counts from the database and shows private recent activity to signed-in users.
2. **First Aid Companion** — quick reference guidance for burns, bleeding,
   fainting, choking, and possible fractures. It is not a substitute for
   emergency services or professional training.
3. **Incident Reporting** — signed-in users submit and track their own reports;
   guests can submit an emergency report without an account but cannot retrieve
   or track it. Reports can include browser GPS coordinates or a manually
   entered location. Approved responders review the queue, accept or reject
   reports, record status history and notes; administrators can assign reports.
   Staff can configure campus location choices.
4. **Health Intelligence** — staff-only statistics, categories, trends, and
   frequent locations computed from incident records. No reporter identity,
   contact information, or confidential incident description is included.
5. **DamuConnect** — volunteers manage their donor availability; authenticated
   users can submit and track requests. Donor contact is restricted to
   authorized health staff. Search results are preliminary discovery, not
   blood compatibility guidance.
6. **Health Facility Directory** — public search and details; administrators
   manage records. Facilities are not seeded with fictional names or contacts,
   and unverified records are labelled.
7. **Emergency SOS and contacts** — the dashboard SOS action confirms intent,
   requests GPS permission and submits a high-priority incident, with manual
   location fallback. Verified emergency contacts use telephone links. Kenya's
   general emergency numbers 999 and 112 are preconfigured; other ambulance
   and facility contacts must be independently verified by an administrator.
   OUR 911 is not a dispatch service; call emergency services directly for
   immediate danger.
8. **Unified role-based operations** — the same dashboard serves normal users,
   approved emergency responders and administrators. Administrators manage
   responder approval, user roles, incident assignment and verified contacts
   from `/admin`. Server-side authorization protects administrative and
   responder operations.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `GET|PATCH /api/auth/me`,
  `POST /api/auth/change-password`
- `GET /api/health`
- `GET|POST /api/incidents`, `POST /api/incidents/guest`,
  `GET /api/incidents/mine`, `GET /api/incidents/<id>`,
  `PATCH /api/incidents/<id>/status`, `GET /api/incidents/queue`,
  `POST /api/incidents/<id>/accept|reject|assign`
- `GET /api/emergency-contacts` (verified active contacts only)
- `GET|POST /api/admin/contacts`, `PATCH|DELETE /api/admin/contacts/<id>`,
  `GET /api/admin/users`, `PATCH /api/admin/users/<id>`,
  `GET /api/admin/summary`
- `GET /api/notifications`, `PATCH /api/notifications/<id>/read`
- `GET|POST /api/campus-zones`
- `GET /api/intelligence/summary` (admin or health personnel)
- `GET /api/facilities/summary`, `GET|POST /api/facilities`,
  `GET|PATCH|DELETE /api/facilities/<id>`
- `GET /api/damu/summary`
- `GET /api/damu/donors/me`, `POST /api/damu/donors`,
  `PATCH /api/damu/donors/me`
- `GET /api/damu/admin/donors` (admin or health personnel)
- `GET|POST /api/damu/requests`,
  `PATCH /api/damu/requests/<id>/status`,
  `GET|POST /api/damu/requests/<id>/matches`,
  `PATCH /api/damu/matches/<id>`

Protected endpoints require the valid login access token in the request
authentication header. Access tokens expire after 30 minutes. Donor contact
information and incident identities are only returned to the relevant account
owner or authorized staff.

## Tests and build

From the repository root:

```powershell
Set-Location backend
& "..\.venv\Scripts\python.exe" -m unittest discover -s tests -v
Set-Location ..\frontend
npm run build
```

## Deploy to Render

The repository includes [render.yaml](./render.yaml) for a Flask API web
service and a Vite static site. Review the blueprint before creating the
services. In Render:

1. Create a Blueprint deployment from this repository and review both services.
2. The API service uses a persistent disk at `/var/data`; SQLite is suitable
   here for a small, single-instance hackathon deployment. Do not remove the
   disk or use SQLite for horizontally scaled instances.
3. Set API `CORS_ORIGINS` to the exact deployed frontend origin, for example
   `https://our-911-frontend.onrender.com`.
4. Set the static service build variable `VITE_API_BASE_URL` to
   `https://<your-api-service>.onrender.com/api`.
5. Render generates `SECRET_KEY` and `JWT_SECRET_KEY` from the blueprint.
   Keep both private and rotate them if exposed.
6. After the API deploys, open its Shell and create the first staff account:
   `flask --app run:app create-user`.

The persistent disk keeps the SQLite data across restarts, but it does not
replace backups. The application initializes tables and additive columns at
startup, including a data-preserving rebuild to permit anonymous incident
reports; it does not provide a general-purpose schema migration history.

## Environment variables

Backend settings are documented in `backend/.env.example`: `SECRET_KEY`,
`JWT_SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS`, and `FLASK_DEBUG`.
`frontend/.env.example` contains `VITE_API_BASE_URL`. Never commit `.env` files,
real user data, or production secrets.

Google OAuth and email password-reset delivery are not configured. The Google
sign-in option is intentionally unavailable until a real OAuth provider and
server-side credentials are configured. Enabling it requires registering an
OAuth client, storing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as private
backend environment variables, and registering the API callback URL (for
example, `https://<api-service>/api/auth/google/callback`) with Google. The
backend must validate the provider response before issuing OUR 911 tokens; this
callback is not currently implemented. The forgot-password page directs users
to an administrator instead of pretending to send a reset email. Email sign-in
uses the existing email/password flow; magic-link email delivery is not set up.

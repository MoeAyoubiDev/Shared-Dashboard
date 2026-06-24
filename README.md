# Shared Dashboard

A multi-user web app for tracking your company's deployed projects and their
login credentials. Built with **Next.js (App Router)** and **PostgreSQL**.

## Features

- 🔐 **Multi-user login** — email + password, bcrypt-hashed account passwords,
  JWT session in an httpOnly cookie.
- 👥 **User types** — **Trainer** (manager) and **Trainee** (worker):
  - **Trainers** create projects, **assign trainees**, manage users, and view
    every project's status. They see a project's **deployment link only once it
    is `Deployed`** and have **no access to stored credentials**.
  - **Trainees** see and fully manage the projects **assigned to them** (URL,
    credentials, status, delete) and are auto-assigned to projects they create.
- 📋 **Shared project table** — Project, URL (clickable), Responsible person,
  Username, Password, **Status**. Full CRUD + live search by project or
  responsible person.
- 🔁 **Many-to-many ownership** — a project can belong to one or more trainees.
- 🚦 **Status workflow** — `Pending → Developing → Testing → Deployed`. Trainees
  update status (inline or in the edit form).
- 🔒 **Credential encryption at rest** — site usernames and passwords are
  encrypted with **AES-256-GCM**; the key lives in an environment variable.
  Passwords are masked in the UI with a per-row reveal toggle and are only
  decrypted on explicit request by an assigned trainee.
- 📊 **Excel export** — download the current (or filtered) view as `.xlsx`
  (trainees export full credentials; trainers export oversight columns only).

## Tech stack

| Layer     | Choice                                  |
| --------- | --------------------------------------- |
| Framework | Next.js 15 (App Router, API routes)     |
| Database  | PostgreSQL (`pg`)                       |
| Auth      | JWT (`jose`) in httpOnly cookie         |
| Hashing   | bcryptjs (account passwords)            |
| Encryption| AES-256-GCM via Node `crypto` (site creds) |
| Export    | ExcelJS                                 |

---

## Setup

### 1. Prerequisites

- Node.js 18+ (tested on Node 22)
- A running PostgreSQL database

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Then edit `.env`. Generate the two secrets:

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# CREDENTIAL_ENCRYPTION_KEY (must be 64 hex chars = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set `DATABASE_URL` to point at your PostgreSQL instance.

> ⚠️ **Keep `CREDENTIAL_ENCRYPTION_KEY` safe and back it up.** If it changes,
> previously stored site credentials can no longer be decrypted.

### 4. Run database migrations

```bash
npm run migrate
```

### 5. Create the first trainer (manager) account

```bash
node scripts/create-trainer.mjs trainer@company.com "Trainer Name" "a-strong-password"
```

The trainer can then create trainees and assign projects from **Manage users**.

### 6. Run

**Development:**

```bash
npm run dev
```

**Production:**

```bash
npm run build
npm start
```

The server listens on `PORT` (default `3000`). Override it:

```bash
PORT=8080 npm start
```

Log in at `http://localhost:3000` (or your configured host/port). Trainers can
create more users (trainers or trainees) from **Manage users**.

---

## Deployment behind nginx

The app is a standard Next.js server and works behind a reverse proxy. When
serving over HTTPS, set `SECURE_COOKIES=true` in `.env` so the session cookie
is marked `Secure`.

Example nginx site config:

```nginx
server {
    listen 80;
    server_name dashboard.company.com;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
    }
}
```

Terminate TLS at nginx, point it at the Next.js port, and run the Node process
under a supervisor (systemd, pm2, etc.).

---

## Environment variables

See [`.env.example`](./.env.example). Required:

| Variable                    | Purpose                                            |
| --------------------------- | -------------------------------------------------- |
| `PORT`                      | Port the server listens on (default 3000)          |
| `DATABASE_URL`              | PostgreSQL connection string                       |
| `JWT_SECRET`                | Signs session tokens (long random string)          |
| `CREDENTIAL_ENCRYPTION_KEY` | 32-byte (64 hex) AES key for site credentials      |
| `SECURE_COOKIES`            | `true` in production over HTTPS                     |

---

## Security notes

- **Account passwords** (for logging into this dashboard) are hashed with
  bcrypt — never stored or recoverable in plaintext.
- **Site credentials** (the Username/Password columns) are encrypted at rest
  with AES-256-GCM. The decrypted password is exposed only via the per-row
  reveal endpoint and the Excel export, and only to a **trainee assigned to that
  project** — trainers never receive credentials.
- Session cookies are `httpOnly` + `SameSite=Lax`; set `SECURE_COOKIES=true`
  behind HTTPS.
- Never commit your real `.env` file (it is git-ignored).

## Project structure

```
db/schema.sql                PostgreSQL schema (users, projects, project_users)
scripts/migrate.mjs          Apply schema
scripts/create-trainer.mjs   Seed a trainer (manager) account
src/lib/                     db pool, crypto, session, auth, projects helpers
src/middleware.ts            Route protection
src/app/api/                 REST endpoints (auth, projects, status, users, export)
src/app/                     Pages (login, dashboard, admin)
src/components/              React UI (Dashboard, ProjectModal,
                             TrainerProjectModal, UserAdmin)
```

## Permissions summary

| Action                         | Trainer            | Trainee (assigned)  |
| ------------------------------ | ------------------ | ------------------- |
| View projects                  | All                | Assigned only       |
| See credentials                | No                 | Yes                 |
| See deployment link            | Only when Deployed | Yes                 |
| Create project                 | Yes (+ assign)     | Yes (auto-assigned) |
| Edit details / credentials     | No                 | Yes                 |
| Update status                  | No                 | Yes                 |
| Delete project                 | Yes                | Yes                 |
| Assign trainees / manage users | Yes                | No                  |

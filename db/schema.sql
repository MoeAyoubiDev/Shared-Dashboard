-- Shared Dashboard schema (PostgreSQL)
-- Run with: npm run migrate   (idempotent — safe to re-run)

-- ── Application users ────────────────────────────────────────────────
-- People who log into THIS dashboard.
--   user_type 'trainer' = manager (assigns trainees, manages users, oversight)
--   user_type 'trainee' = worker  (assigned to projects, does the work)
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,                  -- bcrypt hash of the dashboard login password
  user_type     TEXT NOT NULL DEFAULT 'trainee'
                CHECK (user_type IN ('trainer', 'trainee')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upgrade path from the earlier role-based schema (admin/user -> trainer/trainee).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type TEXT;
    UPDATE users
       SET user_type = CASE WHEN role = 'admin' THEN 'trainer' ELSE 'trainee' END
     WHERE user_type IS NULL;
    ALTER TABLE users ALTER COLUMN user_type SET DEFAULT 'trainee';
    ALTER TABLE users ALTER COLUMN user_type SET NOT NULL;
    ALTER TABLE users DROP COLUMN role;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_user_type_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_user_type_check CHECK (user_type IN ('trainer', 'trainee'));
  END IF;
END $$;

-- Username-based login: add a unique username, make email optional.
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
UPDATE users SET username = split_part(email, '@', 1)
  WHERE username IS NULL AND email IS NOT NULL AND email <> '';
UPDATE users SET username = 'user' || id WHERE username IS NULL;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key') THEN
    ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
  END IF;
END $$;

-- ── Tracked deployed projects ────────────────────────────────────────
-- site_username_encrypted / site_password_encrypted hold AES-256-GCM
-- encrypted credentials for the OTHER deployed site (never plaintext).
CREATE TABLE IF NOT EXISTS projects (
  id                       SERIAL PRIMARY KEY,
  name                     TEXT NOT NULL,
  url                      TEXT,
  responsible_person       TEXT,
  site_username_encrypted  TEXT,
  site_password_encrypted  TEXT,
  status                   TEXT NOT NULL DEFAULT 'Pending',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Track who created each project (for the "My projects" view).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by INTEGER
  REFERENCES users(id) ON DELETE SET NULL;

-- Add status to older installs and enforce the allowed workflow values.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pending';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_status_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_status_check
      CHECK (status IN ('Pending', 'Developing', 'Testing', 'Deployed'));
  END IF;
END $$;

-- ── Project ↔ user assignments (many-to-many) ────────────────────────
-- A project can belong to one or more users (typically trainees).
CREATE TABLE IF NOT EXISTS project_users (
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- Indexes for search/filter and assignment lookups.
CREATE INDEX IF NOT EXISTS idx_projects_name        ON projects (lower(name));
CREATE INDEX IF NOT EXISTS idx_projects_responsible ON projects (lower(responsible_person));
CREATE INDEX IF NOT EXISTS idx_project_users_user   ON project_users (user_id);

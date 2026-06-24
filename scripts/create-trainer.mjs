import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

// Usage: node scripts/create-trainer.mjs <username> <name> <password> [email]
// Creates (or upgrades) a TRAINER (manager) account. Idempotent on username.
// Trainers manage users and assign trainees to projects.

const [, , username, name, password, email] = process.argv;

if (!username || !name || !password) {
  console.error(
    'Usage: node scripts/create-trainer.mjs <username> <name> <password> [email]'
  );
  process.exit(1);
}
if (password.length < 8) {
  console.error('✗ Password must be at least 8 characters.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('✗ DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(
    `INSERT INTO users (username, email, name, password_hash, user_type)
     VALUES ($1, $2, $3, $4, 'trainer')
     ON CONFLICT (username)
     DO UPDATE SET name = EXCLUDED.name,
                   email = EXCLUDED.email,
                   password_hash = EXCLUDED.password_hash,
                   user_type = 'trainer'`,
    [username, email ?? null, name, hash]
  );
  console.log(`✓ Trainer account ready: ${username}`);
} catch (err) {
  console.error('✗ Failed to create trainer:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}

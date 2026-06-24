import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const names = [
  'joseph',
  'miladi',
  'reem',
  'peter',
  'elie',
  'sarah',
  'perla',
  'patrik',
  'joseph 2',
  'charbel',
  'ahmad',
];

// Unambiguous charset (no O/0/I/l/1).
const charset = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genPassword(len = 12) {
  let s = '';
  for (let i = 0; i < len; i++) s += charset[crypto.randomInt(charset.length)];
  return s;
}
function baseUsername(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function usernameExists(u) {
  const { rows } = await pool.query(
    'select 1 from users where lower(username) = lower($1)',
    [u]
  );
  return rows.length > 0;
}

const results = [];
try {
  for (const name of names) {
    const base = baseUsername(name);
    let candidate = base;
    let n = 1;
    while (await usernameExists(candidate)) {
      n++;
      candidate = base + n;
    }
    const password = genPassword(12);
    const hash = bcrypt.hashSync(password, 12);
    await pool.query(
      `INSERT INTO users (username, email, name, password_hash, user_type)
       VALUES ($1, $2, $3, $4, 'trainee')`,
      [candidate, null, name, hash]
    );
    results.push({ name, username: candidate, password });
  }
  console.log('=== CREATED ACCOUNTS ===');
  console.log('NAME|USERNAME|PASSWORD');
  for (const r of results) {
    console.log(`${r.name}|${r.username}|${r.password}`);
  }
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}

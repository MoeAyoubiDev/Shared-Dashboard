import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import {
  createToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from '@/lib/session';

interface UserRow {
  id: number;
  username: string;
  name: string;
  password_hash: string;
  user_type: 'trainer' | 'trainee';
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Username and password are required' },
      { status: 400 }
    );
  }

  const { rows } = await query<UserRow>(
    'SELECT id, username, name, password_hash, user_type FROM users WHERE lower(username) = lower($1)',
    [username]
  );
  const user = rows[0];

  // Constant-ish work to avoid trivial user-enumeration timing.
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');

  if (!user || !ok) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await createToken({
    userId: user.id,
    username: user.username,
    name: user.name,
    userType: user.user_type,
  });

  const res = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      userType: user.user_type,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.SECURE_COOKIES === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

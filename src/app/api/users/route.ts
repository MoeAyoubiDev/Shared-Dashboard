import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireTrainer, hashPassword, HttpError } from '@/lib/auth';
import { errorResponse, str } from '@/lib/api';

interface UserRow {
  id: number;
  username: string;
  email: string | null;
  name: string;
  user_type: 'trainer' | 'trainee';
  created_at: Date;
}

function toDto(u: UserRow) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
    userType: u.user_type,
    createdAt: u.created_at,
  };
}

// GET /api/users?type=trainee  — list dashboard users (trainer only).
export async function GET(req: NextRequest) {
  try {
    await requireTrainer();
    const type = req.nextUrl.searchParams.get('type');

    let rows: UserRow[];
    if (type === 'trainee' || type === 'trainer') {
      ({ rows } = await query<UserRow>(
        'SELECT id, username, email, name, user_type, created_at FROM users WHERE user_type = $1 ORDER BY name ASC',
        [type]
      ));
    } else {
      ({ rows } = await query<UserRow>(
        'SELECT id, username, email, name, user_type, created_at FROM users ORDER BY created_at ASC'
      ));
    }
    return NextResponse.json({ users: rows.map(toDto) });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/users  — create a dashboard user (trainer only).
export async function POST(req: NextRequest) {
  try {
    await requireTrainer();
    const body = await req.json().catch(() => null);

    const username = str(body?.username);
    const email = str(body?.email); // optional
    const name = str(body?.name);
    const password = typeof body?.password === 'string' ? body.password : '';
    const userType = body?.userType === 'trainer' ? 'trainer' : 'trainee';

    if (!username || !name || !password) {
      throw new HttpError(400, 'Username, name and password are required');
    }
    if (password.length < 8) {
      throw new HttpError(400, 'Password must be at least 8 characters');
    }

    const passwordHash = await hashPassword(password);

    try {
      const { rows } = await query<UserRow>(
        `INSERT INTO users (username, email, name, password_hash, user_type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, email, name, user_type, created_at`,
        [username, email, name, passwordHash, userType]
      );
      return NextResponse.json({ user: toDto(rows[0]) }, { status: 201 });
    } catch (e: unknown) {
      if (typeof e === 'object' && e && 'code' in e && e.code === '23505') {
        throw new HttpError(409, 'That username already exists');
      }
      throw e;
    }
  } catch (err) {
    return errorResponse(err);
  }
}

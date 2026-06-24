import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { errorResponse } from '@/lib/api';

interface Row {
  id: number;
  username: string;
  name: string;
  user_type: 'trainer' | 'trainee';
}

// GET /api/users/search?q=  — find users by @username or name, for adding
// collaborators to a project. Available to any authenticated user; returns
// only public directory fields (no email, no credentials).
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().replace(/^@/, '');
    if (q.length < 1) {
      return NextResponse.json({ users: [] });
    }
    const { rows } = await query<Row>(
      `SELECT id, username, name, user_type
         FROM users
        WHERE lower(username) LIKE lower($1) OR lower(name) LIKE lower($1)
        ORDER BY (lower(username) = lower($2)) DESC, username ASC
        LIMIT 10`,
      [`%${q}%`, q]
    );
    return NextResponse.json({
      users: rows.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        userType: u.user_type,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import {
  requireSession,
  verifyPassword,
  hashPassword,
  HttpError,
} from '@/lib/auth';
import { errorResponse } from '@/lib/api';

// POST /api/auth/change-password  — logged-in user changes their own password.
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => null);
    const currentPassword =
      typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword =
      typeof body?.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || !newPassword) {
      throw new HttpError(400, 'Current and new password are required');
    }
    if (newPassword.length < 8) {
      throw new HttpError(400, 'New password must be at least 8 characters');
    }

    const { rows } = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [session.userId]
    );
    if (rows.length === 0) throw new HttpError(404, 'User not found');

    const ok = await verifyPassword(currentPassword, rows[0].password_hash);
    if (!ok) throw new HttpError(401, 'Current password is incorrect');

    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      newHash,
      session.userId,
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

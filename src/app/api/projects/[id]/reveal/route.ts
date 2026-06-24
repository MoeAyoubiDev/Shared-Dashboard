import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireSession, HttpError } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { decrypt } from '@/lib/crypto';

// GET /api/projects/:id/reveal
// Decrypts and returns the stored site password.
// Policy: any authenticated dashboard user may reveal credentials.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'Invalid project id');
    }

    const { rows } = await query<{ site_password_encrypted: string | null }>(
      'SELECT site_password_encrypted FROM projects WHERE id = $1',
      [id]
    );
    if (rows.length === 0) throw new HttpError(404, 'Project not found');

    const password = rows[0].site_password_encrypted
      ? decrypt(rows[0].site_password_encrypted)
      : '';

    return NextResponse.json({ password });
  } catch (err) {
    return errorResponse(err);
  }
}

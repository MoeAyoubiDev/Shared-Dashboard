import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireTrainer, HttpError } from '@/lib/auth';
import { errorResponse } from '@/lib/api';

// DELETE /api/users/:id  — delete a dashboard user (trainer only).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireTrainer();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'Invalid user id');
    }
    if (id === admin.userId) {
      throw new HttpError(400, 'You cannot delete your own account');
    }

    const { rowCount } = await query('DELETE FROM users WHERE id = $1', [id]);
    if (!rowCount) throw new HttpError(404, 'User not found');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireSession, HttpError } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import {
  assertCanMutate,
  getProjectRow,
  toProjectDto,
  isValidStatus,
} from '@/lib/projects';

// PATCH /api/projects/:id/status  — quick inline status change.
// Trainers are view-only on project status, so this is trainee-only.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const viewer = await requireSession();
    if (viewer.userType !== 'trainee') {
      throw new HttpError(403, 'Only trainees can change a project status');
    }
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'Invalid project id');
    }
    await assertCanMutate(viewer, id);

    const body = await req.json().catch(() => null);
    if (!isValidStatus(body?.status)) {
      throw new HttpError(400, 'Invalid status');
    }

    await query(
      'UPDATE projects SET status = $1, updated_at = now() WHERE id = $2',
      [body.status, id]
    );

    const row = await getProjectRow(id);
    return NextResponse.json({
      project: row ? toProjectDto(row, viewer) : null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireSession, HttpError } from '@/lib/auth';
import { errorResponse, str } from '@/lib/api';
import { encrypt } from '@/lib/crypto';
import {
  assertCanMutate,
  getProjectRow,
  setAssignments,
  toProjectDto,
  isValidStatus,
} from '@/lib/projects';

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid project id');
  }
  return id;
}

// PUT /api/projects/:id  — update a project.
//   Trainee (assigned): name, url, responsible, username/password, status.
//   Trainer: name + assignedUserIds (assignment management; no work fields).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const viewer = await requireSession();
    const id = parseId((await params).id);
    await assertCanMutate(viewer, id);

    const body = await req.json().catch(() => null);
    const name = str(body?.name);
    if (!name) throw new HttpError(400, 'Project name is required');

    if (viewer.userType === 'trainer') {
      await query('UPDATE projects SET name = $1, updated_at = now() WHERE id = $2', [
        name,
        id,
      ]);
      if (Array.isArray(body?.assignedUserIds)) {
        const ids = body.assignedUserIds.map(Number).filter(Number.isFinite);
        await setAssignments(id, ids);
      }
    } else {
      const url = str(body?.url);
      const usernameEnc = encrypt(
        typeof body?.username === 'string' ? body.username : ''
      );
      const passwordProvided = typeof body?.password === 'string';
      const passwordEnc = passwordProvided ? encrypt(body.password) : null;

      if (body?.status !== undefined && !isValidStatus(body.status)) {
        throw new HttpError(400, 'Invalid status');
      }
      const status = isValidStatus(body?.status) ? body.status : null;

      await query(
        `UPDATE projects SET
           name = $1,
           url = $2,
           site_username_encrypted = $3,
           site_password_encrypted = CASE WHEN $4 THEN $5 ELSE site_password_encrypted END,
           status = COALESCE($6, status),
           updated_at = now()
         WHERE id = $7`,
        [
          name,
          url,
          usernameEnc || null,
          passwordProvided,
          passwordEnc || null,
          status,
          id,
        ]
      );

      // Trainees may add/remove collaborators (@mention). The acting trainee
      // always stays assigned so they can't lock themselves out.
      if (Array.isArray(body?.assignedUserIds)) {
        const ids = body.assignedUserIds.map(Number).filter(Number.isFinite);
        await setAssignments(id, [viewer.userId, ...ids]);
      }
    }

    const row = await getProjectRow(id);
    return NextResponse.json({
      project: row ? toProjectDto(row, viewer) : null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/projects/:id  — trainer any project; trainee only assigned ones.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const viewer = await requireSession();
    const id = parseId((await params).id);
    await assertCanMutate(viewer, id);
    await query('DELETE FROM projects WHERE id = $1', [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

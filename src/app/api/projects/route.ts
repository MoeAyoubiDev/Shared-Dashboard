import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireSession, HttpError } from '@/lib/auth';
import { errorResponse, str } from '@/lib/api';
import { encrypt } from '@/lib/crypto';
import {
  fetchProjects,
  getProjectRow,
  setAssignments,
  toProjectDto,
  isValidStatus,
} from '@/lib/projects';

// GET /api/projects?q=  — list projects visible to the viewer.
// Trainees see only their assigned projects; trainers see all.
export async function GET(req: NextRequest) {
  try {
    const viewer = await requireSession();
    const q = req.nextUrl.searchParams.get('q') ?? undefined;
    const scope =
      req.nextUrl.searchParams.get('scope') === 'mine' ? 'mine' : undefined;
    const projects = await fetchProjects(viewer, q, scope);
    return NextResponse.json({ projects });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/projects  — create a project.
//   Trainee: full details; auto-assigned to the creator.
//   Trainer: name + assignedUserIds (sets up the project for trainees).
export async function POST(req: NextRequest) {
  try {
    const viewer = await requireSession();
    const body = await req.json().catch(() => null);

    const name = str(body?.name);
    if (!name) throw new HttpError(400, 'Project name is required');

    let newId: number;

    if (viewer.userType === 'trainer') {
      const url = str(body?.url);
      const { rows } = await query<{ id: number }>(
        `INSERT INTO projects (name, url, status, created_by)
         VALUES ($1, $2, 'Pending', $3) RETURNING id`,
        [name, url, viewer.userId]
      );
      newId = rows[0].id;
      const ids = Array.isArray(body?.assignedUserIds)
        ? body.assignedUserIds.map(Number).filter(Number.isFinite)
        : [];
      await setAssignments(newId, ids);
    } else {
      const url = str(body?.url);
      const status = isValidStatus(body?.status) ? body.status : 'Pending';
      const usernameEnc = encrypt(
        typeof body?.username === 'string' ? body.username : ''
      );
      const passwordEnc = encrypt(
        typeof body?.password === 'string' ? body.password : ''
      );
      const { rows } = await query<{ id: number }>(
        `INSERT INTO projects
           (name, url, site_username_encrypted, site_password_encrypted, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [name, url, usernameEnc || null, passwordEnc || null, status, viewer.userId]
      );
      newId = rows[0].id;
      // The creating trainee owns the project; any @mentioned collaborators
      // are added too (creator always kept assigned).
      const extra = Array.isArray(body?.assignedUserIds)
        ? body.assignedUserIds.map(Number).filter(Number.isFinite)
        : [];
      await setAssignments(newId, [viewer.userId, ...extra]);
    }

    const row = await getProjectRow(newId);
    return NextResponse.json(
      { project: row ? toProjectDto(row, viewer) : null },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}

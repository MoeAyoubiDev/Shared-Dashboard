import { query } from './db';
import { decrypt } from './crypto';
import { HttpError } from './auth';
import type { SessionPayload } from './session';

export const PROJECT_STATUSES = [
  'Pending',
  'Developing',
  'Testing',
  'Deployed',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export function isValidStatus(value: unknown): value is ProjectStatus {
  return (
    typeof value === 'string' &&
    (PROJECT_STATUSES as readonly string[]).includes(value)
  );
}

export interface AssignedUser {
  id: number;
  username: string;
  name: string;
}

export interface ProjectRow {
  id: number;
  name: string;
  url: string | null;
  responsible_person: string | null;
  site_username_encrypted: string | null;
  site_password_encrypted: string | null;
  status: ProjectStatus;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
  assigned_users: AssignedUser[];
}

const SELECT_PROJECT = `
  SELECT p.*, COALESCE(
    (SELECT json_agg(json_build_object('id', u.id, 'username', u.username, 'name', u.name) ORDER BY u.name)
       FROM project_users pu
       JOIN users u ON u.id = pu.user_id
      WHERE pu.project_id = p.id),
    '[]'::json
  ) AS assigned_users
  FROM projects p`;

/**
 * Shape a row for the client based on who is viewing.
 *  - Everyone can see all projects and reveal credentials.
 *  - The deployment link is shown to trainees always, and to trainers only
 *    once the project is Deployed (oversight rule).
 *  - canEdit marks projects the viewer may modify (admin / creator / member).
 */
export function toProjectDto(row: ProjectRow, viewer: SessionPayload) {
  const isTrainee = viewer.userType === 'trainee';
  const deployed = row.status === 'Deployed';
  const assigned = row.assigned_users ?? [];
  const canEdit =
    viewer.userType === 'trainer' ||
    row.created_by === viewer.userId ||
    assigned.some((u) => u.id === viewer.userId);
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    url: isTrainee ? row.url : deployed ? row.url : null,
    username: row.site_username_encrypted
      ? decrypt(row.site_username_encrypted)
      : '',
    hasPassword: Boolean(row.site_password_encrypted),
    assignedUsers: assigned,
    canEdit,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Raw rows, scoped to the viewer: trainees see only assigned projects.
 * scope='mine' further restricts to projects the viewer is assigned to or
 * created (the "My projects" view).
 */
export async function fetchProjectRows(
  viewer: SessionPayload,
  q?: string,
  scope?: 'mine'
): Promise<ProjectRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  // Everyone can see all projects by default. "My projects" (scope=mine)
  // narrows to the projects the viewer created or is assigned to.
  if (scope === 'mine') {
    params.push(viewer.userId);
    const a = params.length;
    params.push(viewer.userId);
    const b = params.length;
    where.push(
      `(EXISTS (SELECT 1 FROM project_users pum
                 WHERE pum.project_id = p.id AND pum.user_id = $${a})
        OR p.created_by = $${b})`
    );
  }
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    const i = params.length;
    // Search by project name or by an assigned collaborator (@username / name).
    where.push(
      `(lower(p.name) LIKE lower($${i})
        OR EXISTS (
          SELECT 1 FROM project_users pu2
            JOIN users u2 ON u2.id = pu2.user_id
           WHERE pu2.project_id = p.id
             AND (lower(u2.username) LIKE lower($${i}) OR lower(u2.name) LIKE lower($${i}))
        ))`
    );
  }

  const sql = `${SELECT_PROJECT}${
    where.length ? ` WHERE ${where.join(' AND ')}` : ''
  } ORDER BY p.name ASC`;
  const { rows } = await query<ProjectRow>(sql, params);
  return rows;
}

export async function fetchProjects(
  viewer: SessionPayload,
  q?: string,
  scope?: 'mine'
) {
  const rows = await fetchProjectRows(viewer, q, scope);
  return rows.map((r) => toProjectDto(r, viewer));
}

export async function getProjectRow(id: number): Promise<ProjectRow | null> {
  const { rows } = await query<ProjectRow>(
    `${SELECT_PROJECT} WHERE p.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function isAssigned(
  projectId: number,
  userId: number
): Promise<boolean> {
  const { rows } = await query(
    'SELECT 1 FROM project_users WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );
  return rows.length > 0;
}

/**
 * Authorization for mutating a project:
 *  - trainers may manage any project,
 *  - trainees may act only on projects they are assigned to.
 * Throws 404 if the project does not exist, 403 if not permitted.
 */
export async function assertCanMutate(
  viewer: SessionPayload,
  projectId: number
): Promise<void> {
  const { rows } = await query<{ created_by: number | null }>(
    'SELECT created_by FROM projects WHERE id = $1',
    [projectId]
  );
  if (rows.length === 0) throw new HttpError(404, 'Project not found');
  // Allowed: trainers (admin), the project creator, and assigned collaborators.
  if (viewer.userType === 'trainer') return;
  if (rows[0].created_by === viewer.userId) return;
  if (!(await isAssigned(projectId, viewer.userId))) {
    throw new HttpError(403, 'Only the creator or assigned members can edit this project');
  }
}

/** Replace a project's trainee assignments with the given set. */
export async function setAssignments(
  projectId: number,
  userIds: number[]
): Promise<void> {
  const unique = [...new Set(userIds.filter((n) => Number.isInteger(n) && n > 0))];
  await query('DELETE FROM project_users WHERE project_id = $1', [projectId]);
  for (const uid of unique) {
    await query(
      `INSERT INTO project_users (project_id, user_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [projectId, uid]
    );
  }
}

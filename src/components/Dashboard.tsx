'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionPayload } from '@/lib/session';
import ProjectModal from './ProjectModal';
import TrainerProjectModal from './TrainerProjectModal';
import ChangePasswordModal from './ChangePasswordModal';

export const STATUSES = ['Pending', 'Developing', 'Testing', 'Deployed'] as const;
export type Status = (typeof STATUSES)[number];

export interface AssignedUser {
  id: number;
  username: string;
  name: string;
}

export interface Project {
  id: number;
  name: string;
  status: Status;
  url: string | null;
  username: string;
  hasPassword: boolean;
  assignedUsers: AssignedUser[];
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`status status-${status}`}>{status}</span>;
}

export default function Dashboard({ user }: { user: SessionPayload }) {
  const isTrainer = user.userType === 'trainer';

  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [revealed, setRevealed] = useState<Record<number, string>>({});
  // Trainee directory (for trainer assignment UI).
  const [trainees, setTrainees] = useState<AssignedUser[]>([]);
  // 'all' (trainers only) vs 'mine' (projects I created / am assigned to).
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [pwOpen, setPwOpen] = useState(false);

  const load = useCallback(async (q: string, sc: 'all' | 'mine') => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (sc === 'mine') params.set('scope', 'mine');
      const qs = params.toString();
      const res = await fetch(`/api/projects${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Failed to load projects');
      const data = await res.json();
      setProjects(data.projects);
      setRevealed({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search, scope), 250);
    return () => clearTimeout(t);
  }, [search, scope, load]);

  // Trainers need the trainee list to assign people to projects.
  useEffect(() => {
    if (!isTrainer) return;
    fetch('/api/users?type=trainee')
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) =>
        setTrainees(
          (d.users ?? []).map(
            (u: { id: number; username: string; name: string }) => ({
              id: u.id,
              username: u.username,
              name: u.name,
            })
          )
        )
      )
      .catch(() => setTrainees([]));
  }, [isTrainer]);

  async function reveal(id: number) {
    if (revealed[id] !== undefined) {
      setRevealed((r) => {
        const next = { ...r };
        delete next[id];
        return next;
      });
      return;
    }
    const res = await fetch(`/api/projects/${id}/reveal`);
    if (!res.ok) return;
    const data = await res.json();
    setRevealed((r) => ({ ...r, [id]: data.password ?? '' }));
  }

  async function updateStatus(p: Project, status: Status) {
    const res = await fetch(`/api/projects/${p.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setProjects((list) =>
        list.map((x) => (x.id === p.id ? { ...x, status } : x))
      );
    } else {
      alert('Failed to update status');
    }
  }

  async function remove(p: Project) {
    if (!confirm(`Delete project "${p.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/projects/${p.id}`, { method: 'DELETE' });
    if (res.ok) load(search, scope);
    else alert('Failed to delete project');
  }

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(p: Project) {
    setEditing(p);
    setModalOpen(true);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (scope === 'mine') params.set('scope', 'mine');
    const qs = params.toString();
    return `/api/export${qs ? `?${qs}` : ''}`;
  }, [search, scope]);

  const colSpan = isTrainer ? 7 : 6;

  return (
    <>
      <div className="topbar">
        <h1>Shared Dashboard</h1>
        <div className="right">
          <span>
            {user.name} <span className="tag">{user.userType}</span>
          </span>
          {isTrainer && <a href="/admin">Manage users</a>}
          <button className="secondary" onClick={() => setPwOpen(true)}>
            Change password
          </button>
          <button className="secondary" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>

      <div className="container">
        <div className="toolbar">
          <input
            className="search"
            placeholder="Search projects or @collaborators…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <a href={exportUrl}>
            <button className="secondary" type="button">
              Export to Excel
            </button>
          </a>
          <button type="button" onClick={openAdd}>
            + Add project
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="tabs">
          <button
            type="button"
            className={`tab ${scope === 'all' ? 'active' : ''}`}
            onClick={() => setScope('all')}
          >
            All projects
          </button>
          <button
            type="button"
            className={`tab ${scope === 'mine' ? 'active' : ''}`}
            onClick={() => setScope('mine')}
          >
            My projects
          </button>
        </div>

        <div className="panel">
          <table>
            <thead>
              {isTrainer ? (
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Deployment link</th>
                  <th>Username</th>
                  <th>Password</th>
                  <th>Assigned trainees</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              ) : (
                <tr>
                  <th>Project</th>
                  <th>URL</th>
                  <th>Username</th>
                  <th>Password</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="empty">
                    Loading…
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="empty">
                    {scope === 'mine'
                      ? 'You are not on any projects yet. Create one, or get added by a teammate via @mention.'
                      : 'No projects yet. Click “Add project” to create one.'}
                  </td>
                </tr>
              ) : isTrainer ? (
                projects.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td>
                      {p.status === 'Deployed' && p.url ? (
                        <a href={p.url} target="_blank" rel="noopener noreferrer">
                          {p.url}
                        </a>
                      ) : (
                        <span className="muted">
                          {p.status === 'Deployed' ? '—' : 'Not deployed'}
                        </span>
                      )}
                    </td>
                    <td>
                      {p.username ? (
                        <span className="cred">{p.username}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {p.hasPassword ? (
                        <span className="cred">
                          <span>
                            {revealed[p.id] !== undefined
                              ? revealed[p.id] || '(empty)'
                              : '••••••••'}
                          </span>
                          <button
                            className="link"
                            type="button"
                            onClick={() => reveal(p.id)}
                          >
                            {revealed[p.id] !== undefined ? 'Hide' : 'Show'}
                          </button>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {p.assignedUsers.length ? (
                        <div className="assignees">
                          {p.assignedUsers.map((u) => (
                            <span
                              key={u.id}
                              className="assignee-chip"
                              title={u.name}
                            >
                              @{u.username}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="link"
                          type="button"
                          onClick={() => openEdit(p)}
                        >
                          Manage
                        </button>
                        <button
                          className="link danger"
                          type="button"
                          onClick={() => remove(p)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                projects.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noopener noreferrer">
                          {p.url}
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {p.username ? (
                        <span className="cred">{p.username}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {p.hasPassword ? (
                        <span className="cred">
                          <span>
                            {revealed[p.id] !== undefined
                              ? revealed[p.id] || '(empty)'
                              : '••••••••'}
                          </span>
                          <button
                            className="link"
                            type="button"
                            onClick={() => reveal(p.id)}
                          >
                            {revealed[p.id] !== undefined ? 'Hide' : 'Show'}
                          </button>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {p.canEdit ? (
                        <select
                          className="status-select"
                          value={p.status}
                          onChange={(e) =>
                            updateStatus(p, e.target.value as Status)
                          }
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge status={p.status} />
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {p.canEdit ? (
                          <>
                            <button
                              className="link"
                              type="button"
                              onClick={() => openEdit(p)}
                            >
                              Edit
                            </button>
                            <button
                              className="link danger"
                              type="button"
                              onClick={() => remove(p)}
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen &&
        (isTrainer ? (
          <TrainerProjectModal
            project={editing}
            trainees={trainees}
            onClose={() => setModalOpen(false)}
            onSaved={() => {
              setModalOpen(false);
              load(search, scope);
            }}
          />
        ) : (
          <ProjectModal
            project={editing}
            onClose={() => setModalOpen(false)}
            onSaved={() => {
              setModalOpen(false);
              load(search, scope);
            }}
          />
        ))}

      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
    </>
  );
}

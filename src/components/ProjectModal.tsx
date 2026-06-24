'use client';

import { useState } from 'react';
import { STATUSES, type Project, type Status } from './Dashboard';
import UserPicker, { type PickUser } from './UserPicker';

interface Props {
  project: Project | null; // null = create
  onClose: () => void;
  onSaved: () => void;
}

export default function ProjectModal({ project, onClose, onSaved }: Props) {
  const isEdit = project !== null;
  const [name, setName] = useState(project?.name ?? '');
  const [url, setUrl] = useState(project?.url ?? '');
  const [username, setUsername] = useState(project?.username ?? '');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>(project?.status ?? 'Pending');
  const [collaborators, setCollaborators] = useState<PickUser[]>(
    project?.assignedUsers ?? []
  );
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    setSaving(true);
    try {
      // On edit, only send `password` when the user typed a new one so the
      // existing stored password is preserved otherwise.
      const payload: Record<string, unknown> = {
        name,
        url,
        username,
        status,
        assignedUserIds: collaborators.map((c) => c.id),
      };
      if (!isEdit || password !== '') {
        payload.password = password;
      }

      const res = await fetch(
        isEdit ? `/api/projects/${project!.id}` : '/api/projects',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to save');
        return;
      }
      onSaved();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
      >
        <header>{isEdit ? 'Edit project' : 'Add project'}</header>
        <div className="body">
          {error && <div className="error">{error}</div>}

          <div className="field">
            <label htmlFor="name">Project *</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="url">URL</label>
            <input
              id="url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="username">Username (for the deployed site)</label>
            <input
              id="username"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">
              Password (for the deployed site)
              {isEdit && ' — leave blank to keep current'}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEdit ? '••••••••' : ''}
              />
              <button
                type="button"
                className="secondary"
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Team — add people working on this project</label>
            <UserPicker value={collaborators} onChange={setCollaborators} />
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
              You stay on the project automatically. Mention teammates by name
              or @username.
            </p>
          </div>
        </div>
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </button>
        </footer>
      </form>
    </div>
  );
}

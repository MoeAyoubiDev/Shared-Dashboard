'use client';

import { useState } from 'react';
import type { AssignedUser, Project } from './Dashboard';

interface Props {
  project: Project | null; // null = create
  trainees: AssignedUser[];
  onClose: () => void;
  onSaved: () => void;
}

// Trainer view: set up a project (name) and assign trainees.
// Trainers do not edit work fields (URL, credentials, status).
export default function TrainerProjectModal({
  project,
  trainees,
  onClose,
  onSaved,
}: Props) {
  const isEdit = project !== null;
  const [name, setName] = useState(project?.name ?? '');
  const [selected, setSelected] = useState<Set<number>>(
    new Set(project?.assignedUsers.map((u) => u.id) ?? [])
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        assignedUserIds: [...selected],
      };
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
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <header>{isEdit ? 'Manage project' : 'Add project'}</header>
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
            <label>Assign trainees</label>
            {trainees.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                No trainees yet. Create some from “Manage users”.
              </p>
            ) : (
              <div className="checklist">
                {trainees.map((t) => (
                  <label key={t.id}>
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggle(t.id)}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {isEdit && (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Trainees fill in the URL, credentials and update the status.
            </p>
          )}
        </div>
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
          </button>
        </footer>
      </form>
    </div>
  );
}

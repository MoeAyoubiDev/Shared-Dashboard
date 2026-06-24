'use client';

import { useCallback, useEffect, useState } from 'react';

interface AppUser {
  id: number;
  username: string;
  email: string | null;
  name: string;
  userType: 'trainer' | 'trainee';
  createdAt: string;
}

export default function UserAdmin({
  currentUserId,
}: {
  currentUserId: number;
}) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // new-user form
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<'trainee' | 'trainer'>('trainee');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password, userType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to create user');
        return;
      }
      setName('');
      setUsername('');
      setPassword('');
      setUserType('trainee');
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(u: AppUser) {
    if (!confirm(`Delete user ${u.email}?`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    if (res.ok) load();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to delete user');
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Manage Users</h1>
        <div className="right">
          <a href="/">Back to dashboard</a>
        </div>
      </div>

      <div className="container">
        {error && <div className="error">{error}</div>}

        <div className="panel" style={{ marginBottom: 24 }}>
          <form
            onSubmit={createUser}
            style={{
              padding: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
              alignItems: 'end',
            }}
          >
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="field">
              <label>Password (min 8)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="field">
              <label>Type</label>
              <select
                value={userType}
                onChange={(e) =>
                  setUserType(e.target.value as 'trainee' | 'trainer')
                }
              >
                <option value="trainee">Trainee</option>
                <option value="trainer">Trainer</option>
              </select>
            </div>
            <button type="submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add user'}
            </button>
          </form>
        </div>

        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="empty">
                    Loading…
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.username}</td>
                    <td>
                      {u.userType === 'trainer' ? (
                        <span className="tag">trainer</span>
                      ) : (
                        'trainee'
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {u.id === currentUserId ? (
                          <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                            (you)
                          </span>
                        ) : (
                          <button
                            className="danger"
                            type="button"
                            onClick={() => remove(u)}
                          >
                            Delete
                          </button>
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
    </>
  );
}

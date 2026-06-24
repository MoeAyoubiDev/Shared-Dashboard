'use client';

import { useEffect, useRef, useState } from 'react';

export interface PickUser {
  id: number;
  username: string;
  name: string;
}

interface Props {
  value: PickUser[];
  onChange: (next: PickUser[]) => void;
  /** Optionally hide one user (e.g. the current user) from search results. */
  excludeId?: number;
}

// Social-style @mention picker: type a name or @username, pick from the
// dropdown to add a collaborator chip.
export default function UserPicker({ value, onChange, excludeId }: Props) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<PickUser[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (text.trim().length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(text)}`
        );
        const data = await res.json().catch(() => ({ users: [] }));
        const chosen = new Set(value.map((v) => v.id));
        setResults(
          (data.users ?? []).filter(
            (u: PickUser) => !chosen.has(u.id) && u.id !== excludeId
          )
        );
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function add(u: PickUser) {
    onChange([...value, u]);
    setText('');
    setResults([]);
    setOpen(false);
  }
  function remove(id: number) {
    onChange(value.filter((v) => v.id !== id));
  }

  return (
    <div className="mention" ref={boxRef}>
      {value.length > 0 && (
        <div className="chips">
          {value.map((u) => (
            <span key={u.id} className="chip">
              @{u.username}
              <button
                type="button"
                className="chip-x"
                onClick={() => remove(u.id)}
                aria-label={`Remove ${u.username}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="mention-input-wrap">
        <input
          value={text}
          placeholder="Type a name or @username…"
          autoComplete="off"
          onChange={(e) => setText(e.target.value.replace(/^@/, ''))}
          onFocus={() => {
            if (results.length) setOpen(true);
          }}
        />
        {open && (
          <div className="mention-dropdown">
            {loading && <div className="mention-option muted">Searching…</div>}
            {!loading &&
              results.map((u) => (
                <button
                  type="button"
                  key={u.id}
                  className="mention-option"
                  onClick={() => add(u)}
                >
                  <span className="mention-username">@{u.username}</span>
                  <span className="mention-name">{u.name}</span>
                </button>
              ))}
            {!loading && results.length === 0 && (
              <div className="mention-option muted">No matches</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

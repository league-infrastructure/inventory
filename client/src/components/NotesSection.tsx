import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';

interface Note {
  id: number;
  text: string;
  user: { id: number; displayName: string };
  createdAt: string;
  updatedAt: string;
}

interface NotesSectionProps {
  objectType: 'Kit' | 'Pack' | 'Computer';
  objectId: number;
}

export default function NotesSection({ objectType, objectId }: NotesSectionProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const newRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  function loadNotes() {
    fetch(`/api/notes?objectType=${objectType}&objectId=${objectId}`)
      .then((r) => r.json())
      .then(setNotes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadNotes();
  }, [objectType, objectId]);

  useEffect(() => {
    if (adding && newRef.current) newRef.current.focus();
  }, [adding]);

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus();
  }, [editingId]);

  async function handleAdd() {
    if (!newText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectType, objectId, text: newText.trim() }),
      });
      if (res.ok) {
        setNewText('');
        setAdding(false);
        loadNotes();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: number) {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        loadNotes();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConfirmDeleteId(null);
        loadNotes();
      }
    } finally {
      setSaving(false);
    }
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
          >
            <Plus size={14} /> Add Note
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg">
          <textarea
            ref={newRef}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Write a note..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white resize-y"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd();
              if (e.key === 'Escape') { setAdding(false); setNewText(''); }
            }}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleAdd}
              disabled={saving || !newText.trim()}
              className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setAdding(false); setNewText(''); }}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-xs text-gray-400">Loading notes...</p>}

      {!loading && notes.length === 0 && !adding && (
        <p className="text-xs text-gray-400 italic">No notes yet.</p>
      )}

      <div className="space-y-2">
        {notes.map((note) => (
          <div key={note.id} className="p-3 bg-white border border-gray-200 rounded-lg">
            {editingId === note.id ? (
              <>
                <textarea
                  ref={editRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white resize-y"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleUpdate(note.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleUpdate(note.id)}
                    disabled={saving || !editText.trim()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
                  >
                    <Check size={12} /> Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 cursor-pointer"
                  >
                    <X size={12} /> Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.text}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">
                    {note.user.displayName} &middot; {formatDate(note.createdAt)}
                    {note.updatedAt !== note.createdAt && ' (edited)'}
                  </span>
                  <div className="flex items-center gap-2">
                    {confirmDeleteId === note.id ? (
                      <>
                        <span className="text-xs text-red-600">Delete?</span>
                        <button
                          onClick={() => handleDelete(note.id)}
                          disabled={saving}
                          className="text-xs text-red-600 font-medium hover:underline cursor-pointer"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-gray-500 hover:underline cursor-pointer"
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingId(note.id); setEditText(note.text); }}
                          className="text-gray-400 hover:text-gray-600 cursor-pointer"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(note.id)}
                          className="text-gray-400 hover:text-red-600 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

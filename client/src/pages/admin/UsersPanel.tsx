import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Save, X, UserPlus, Shield } from 'lucide-react';
import { USER_ROLES, ROLE_BADGE_STYLES } from '../../lib/roles';

interface User {
  id: number;
  googleId: string | null;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    custodiedKits: number;
    custodiedComputers: number;
    transfers: number;
  };
}

const roleBadge = (role: string) =>
  ROLE_BADGE_STYLES[role as keyof typeof ROLE_BADGE_STYLES] || 'bg-gray-50 text-gray-700';

export default function UsersPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ displayName: '', email: '', role: '' });

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', displayName: '', role: 'INSTRUCTOR' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  function loadUsers() {
    setLoading(true);
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false));
  }

  function startEdit(user: User) {
    setEditingId(user.id);
    setEditForm({ displayName: user.displayName, email: user.email, role: user.role });
    setFormError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setFormError('');
  }

  async function saveEdit(id: number) {
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to update user');
      } else {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));
        setEditingId(null);
      }
    } catch {
      setFormError('Network error');
    }
    setSaving(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create user');
      } else {
        setUsers((prev) => [...prev, data].sort((a, b) => a.displayName.localeCompare(b.displayName)));
        setCreateForm({ email: '', displayName: '', role: 'INSTRUCTOR' });
        setShowCreate(false);
      }
    } catch {
      setFormError('Network error');
    }
    setSaving(false);
  }

  async function toggleAdmin(user: User) {
    const newRole = user.role === 'ADMIN' ? 'INSTRUCTOR' : 'ADMIN';
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: user.displayName, email: user.email, role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...data } : u)));
      }
    } catch { /* ignore */ }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete user');
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== id));
      }
    } catch {
      alert('Network error');
    }
  }

  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold text-gray-900">Users</h1>
        <button
          onClick={() => { setShowCreate(!showCreate); setFormError(''); }}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-md border-none cursor-pointer hover:bg-primary-hover"
        >
          <UserPlus size={14} />
          New User
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Manage user accounts, roles, and permissions. Users with the <strong>Admin</strong> role can access this panel without the admin password.
      </p>

      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Create User</h3>
          <form onSubmit={handleCreate} className="flex flex-wrap gap-2 items-end">
            <label className="flex-1 min-w-[200px]">
              <span className="text-xs text-gray-500">Email</span>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="user@jointheleague.org"
                className="block w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md"
                required
              />
            </label>
            <label className="flex-1 min-w-[150px]">
              <span className="text-xs text-gray-500">Display Name</span>
              <input
                value={createForm.displayName}
                onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                placeholder="Optional"
                className="block w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md"
              />
            </label>
            <label>
              <span className="text-xs text-gray-500">Role</span>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                className="block px-3 py-1.5 text-sm border border-gray-300 rounded-md"
              >
                {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <div className="flex gap-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-md border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
              >
                <Plus size={14} />
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-md border-none cursor-pointer hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
          {formError && editingId === null && (
            <div className="mt-2 px-3 py-2 rounded bg-red-50 text-red-700 text-sm border border-red-200">
              {formError}
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : users.length === 0 ? (
          <p className="text-gray-400 text-sm">No users found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-semibold text-gray-700">Name</th>
                <th className="text-left py-2 font-semibold text-gray-700">Email</th>
                <th className="text-left py-2 font-semibold text-gray-700 w-32">Role</th>
                <th className="text-center py-2 font-semibold text-gray-700 w-16">
                  <span className="inline-flex items-center gap-1"><Shield size={12} />Admin</span>
                </th>
                <th className="text-left py-2 font-semibold text-gray-700 w-20">Linked</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100">
                  {editingId === u.id ? (
                    <>
                      <td className="py-2 pr-2">
                        <input
                          value={editForm.displayName}
                          onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          className="px-2 py-1 text-sm border border-gray-300 rounded"
                        >
                          {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="checkbox"
                          checked={editForm.role === 'ADMIN'}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.checked ? 'ADMIN' : 'INSTRUCTOR' })}
                          className="w-4 h-4 cursor-pointer accent-purple-600"
                        />
                      </td>
                      <td></td>
                      <td className="py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => saveEdit(u.id)}
                            disabled={saving}
                            className="text-green-600 hover:text-green-800 bg-transparent border-none cursor-pointer p-1"
                            title="Save"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-gray-500 hover:text-gray-700 bg-transparent border-none cursor-pointer p-1"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        {formError && editingId === u.id && (
                          <div className="mt-1 text-xs text-red-600">{formError}</div>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2">{u.displayName}</td>
                      <td className="py-2 text-gray-600 text-xs">{u.email}</td>
                      <td className="py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${roleBadge(u.role)}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="checkbox"
                          checked={u.role === 'ADMIN'}
                          onChange={() => toggleAdmin(u)}
                          className="w-4 h-4 cursor-pointer accent-purple-600"
                        />
                      </td>
                      <td className="py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          u.googleId ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {u.googleId ? 'Google' : 'No'}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(u)}
                            className="text-gray-500 hover:text-blue-600 bg-transparent border-none cursor-pointer p-1"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="text-gray-400 hover:text-red-600 bg-transparent border-none cursor-pointer p-1"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-gray-500 text-xs mt-4">
        "Linked" indicates whether the user has logged in via Google OAuth. Unlinked users will be matched by email on first Google login.
      </p>
    </div>
  );
}

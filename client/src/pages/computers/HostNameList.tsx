import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { useTableSort } from '../../lib/useTableSort';
import SortableHeader from '../../components/SortableHeader';

interface HostName {
  id: number;
  name: string;
  scheme: string | null;
  computerId: number | null;
  computer: { id: number; model: string | null } | null;
  _status: 'Assigned' | 'Available';
}

export default function HostNameList() {
  const [hostNames, setHostNames] = useState<HostName[]>([]);
  const [schemes, setSchemes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ name: string; scheme: string }>({ name: '', scheme: '' });
  const [editError, setEditError] = useState<string | null>(null);

  const { processed: sorted, sort, toggleSort, filters, setFilter } = useTableSort<HostName>(hostNames, { key: 'name', direction: 'asc' });

  function buildRow(h: { id: number; name: string; scheme?: string | null; computerId: number | null; computer: { id: number; model: string | null } | null }): HostName {
    return {
      id: h.id,
      name: h.name,
      scheme: h.scheme ?? null,
      computerId: h.computerId,
      computer: h.computer,
      _status: h.computerId ? 'Assigned' : 'Available',
    };
  }

  function fetchSchemes() {
    fetch('/api/hostnames/schemes')
      .then((r) => {
        if (!r.ok) return;
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setSchemes(data);
      })
      .catch(() => { /* non-fatal */ });
  }

  useEffect(() => {
    fetch('/api/hostnames')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load host names');
        return r.json();
      })
      .then((data: { id: number; name: string; scheme?: string | null; computerId: number | null; computer: { id: number; model: string | null } | null }[]) => {
        setHostNames(data.map(buildRow));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    fetchSchemes();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const res = await fetch('/api/hostnames', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.status === 409) {
      setAddError('A host name with that name already exists.');
      return;
    }
    if (!res.ok) {
      const data = await res.json();
      setAddError(data.error || 'Failed to add host name');
      return;
    }
    const created = await res.json();
    setHostNames((prev) => [...prev, buildRow({ ...created, computer: null })]);
    setNewName('');
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/hostnames/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setHostNames((prev) => prev.filter((h) => h.id !== id));
    }
  }

  function handleEditStart(row: HostName) {
    setEditId(row.id);
    setEditValues({ name: row.name, scheme: row.scheme ?? '' });
    setEditError(null);
  }

  function handleEditCancel() {
    setEditId(null);
    setEditError(null);
  }

  async function handleEditSave(id: number) {
    setEditError(null);
    const res = await fetch(`/api/hostnames/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editValues.name.trim(),
        scheme: editValues.scheme.trim() || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEditError(data.error || 'Failed to save');
      return;
    }
    const updated = await res.json();
    setHostNames((prev) => prev.map((h) => (h.id === id ? buildRow({ ...updated, computer: h.computer }) : h)));
    setEditId(null);
    fetchSchemes();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Host Names</h1>
        <Link to="/computers" className="text-sm text-primary hover:underline">
          &larr; Back to Computers
        </Link>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 mb-2">
        <input
          placeholder="New host name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          required
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg border-none cursor-pointer hover:bg-primary-hover"
        >
          <Plus size={16} />
          Add
        </button>
      </form>
      {addError && <p className="text-red-600 text-sm mb-4">{addError}</p>}

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && hostNames.length === 0 && (
        <p className="text-gray-500 text-sm">No host names found.</p>
      )}

      {hostNames.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <datalist id="scheme-datalist">
            {schemes.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <SortableHeader
                  label="Name"
                  sortKey="name"
                  currentSort={sort}
                  onSort={toggleSort}
                  filterValue={filters['name']}
                  onFilter={setFilter}
                />
                <SortableHeader
                  label="Scheme"
                  sortKey="scheme"
                  currentSort={sort}
                  onSort={toggleSort}
                  filterValue={filters['scheme']}
                  onFilter={setFilter}
                  filterMode="discrete"
                  discreteOptions={schemes}
                />
                <SortableHeader
                  label="Status"
                  sortKey="_status"
                  currentSort={sort}
                  onSort={toggleSort}
                  filterValue={filters['_status']}
                  onFilter={setFilter}
                  filterMode="discrete"
                  discreteOptions={['Assigned', 'Available']}
                />
                <SortableHeader
                  label="Assigned Computer"
                  sortKey="computer.model"
                  currentSort={sort}
                  onSort={toggleSort}
                  filterValue={filters['computer.model']}
                  onFilter={setFilter}
                />
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((h) =>
                editId === h.id ? (
                  <tr key={h.id} className="border-b border-gray-100 bg-blue-50">
                    <td className="px-4 py-2">
                      <input
                        value={editValues.name}
                        onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave(h.id);
                          if (e.key === 'Escape') handleEditCancel();
                        }}
                      />
                      {editError && <p className="text-red-600 text-xs mt-1">{editError}</p>}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editValues.scheme}
                        onChange={(e) => setEditValues((v) => ({ ...v, scheme: e.target.value }))}
                        list="scheme-datalist"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="scheme (optional)"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave(h.id);
                          if (e.key === 'Escape') handleEditCancel();
                        }}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                          h._status === 'Assigned'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {h._status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">—</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          className="text-green-600 hover:text-green-800 bg-transparent border-none cursor-pointer p-1"
                          onClick={() => handleEditSave(h.id)}
                          title="Save"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          className="text-gray-500 hover:text-gray-700 bg-transparent border-none cursor-pointer p-1"
                          onClick={handleEditCancel}
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <button
                        className="font-medium text-gray-900 bg-transparent border-none cursor-pointer p-0 hover:text-primary text-left w-full"
                        onClick={() => handleEditStart(h)}
                        title="Click to edit"
                      >
                        {h.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{h.scheme ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                          h._status === 'Assigned'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {h._status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {h.computer ? (
                        <Link to={`/computers/${h.computer.id}`} className="text-primary hover:underline">
                          {h.computer.model || `Computer #${h.computer.id}`}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {!h.computerId && (
                        <button
                          className="text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer p-1"
                          onClick={() => handleDelete(h.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

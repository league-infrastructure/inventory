import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useTableSort } from '../../lib/useTableSort';
import SortableHeader from '../../components/SortableHeader';

interface HostName {
  id: number;
  name: string;
  computerId: number | null;
  computer: { id: number; model: string | null } | null;
}

export default function HostNameList() {
  const [hostNames, setHostNames] = useState<HostName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const { processed: sorted, sort, toggleSort, filters, setFilter } = useTableSort(hostNames, { key: 'name', direction: 'asc' });

  useEffect(() => {
    fetch('/api/hostnames')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load host names');
        return r.json();
      })
      .then(setHostNames)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
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
    setHostNames((prev) => [...prev, { ...created, computer: null }]);
    setNewName('');
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/hostnames/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setHostNames((prev) => prev.filter((h) => h.id !== id));
    }
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <SortableHeader label="Name" sortKey="name" currentSort={sort} onSort={toggleSort} filterValue={filters['name']} onFilter={setFilter} />
                <SortableHeader label="Status" sortKey="computerId" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Assigned Computer" sortKey="computer.model" currentSort={sort} onSort={toggleSort} filterValue={filters['computer.model']} onFilter={setFilter} />
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((h) => (
                <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{h.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                        h.computerId
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {h.computerId ? 'Assigned' : 'Available'}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

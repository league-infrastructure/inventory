import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTableSort } from '../../lib/useTableSort';
import SortableHeader from '../../components/SortableHeader';

interface Computer {
  id: number;
  model: string | null;
  disposition: string;
  hostName: { name: string } | null;
  site: { id: number; name: string } | null;
  kit: { id: number; name: string } | null;
}

import { INACTIVE_DISPOSITIONS, dispositionClasses } from '../../lib/dispositions';

export default function InactiveComputers() {
  const navigate = useNavigate();
  const [computers, setComputers] = useState<Computer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { processed: sorted, sort, toggleSort, filters, setFilter } = useTableSort(computers, { key: 'hostName.name', direction: 'asc' });

  useEffect(() => {
    setLoading(true);
    // Fetch all computers and filter client-side for inactive dispositions
    fetch('/api/computers')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load computers');
        return r.json();
      })
      .then((data: Computer[]) => {
        setComputers(data.filter((c) => (INACTIVE_DISPOSITIONS as readonly string[]).includes(c.disposition)));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleRestore(id: number) {
    fetch(`/api/computers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disposition: 'ACTIVE' }),
    })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to restore computer');
        setComputers((prev) => prev.filter((c) => c.id !== id));
      })
      .catch((err) => setError(err.message));
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inactive Computers</h1>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && computers.length === 0 && (
        <p className="text-gray-500 text-sm">No inactive computers found.</p>
      )}

      {computers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <SortableHeader label="Host Name" sortKey="hostName.name" currentSort={sort} onSort={toggleSort} filterValue={filters['hostName.name']} onFilter={setFilter} />
                <SortableHeader label="Model" sortKey="model" currentSort={sort} onSort={toggleSort} filterValue={filters['model']} onFilter={setFilter} />
                <SortableHeader label="Disposition" sortKey="disposition" currentSort={sort} onSort={toggleSort} filterValue={filters['disposition']} onFilter={setFilter} />
                <SortableHeader label="Site" sortKey="site.name" currentSort={sort} onSort={toggleSort} filterValue={filters['site.name']} onFilter={setFilter} className="hidden sm:table-cell" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer opacity-60"
                  onClick={() => navigate(`/computers/${c.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-400">
                    {c.hostName?.name || `#${c.id}`}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{c.model || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${dispositionClasses(c.disposition)}`}>
                      {c.disposition.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{c.site?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors border-none cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(c.id);
                      }}
                    >
                      Restore
                    </button>
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

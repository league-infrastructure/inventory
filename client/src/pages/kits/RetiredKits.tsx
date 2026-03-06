import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTableSort } from '../../lib/useTableSort';
import SortableHeader from '../../components/SortableHeader';

type ContainerType = 'BAG' | 'LARGE_TOTE' | 'SMALL_TOTE' | 'DUFFEL';

const CONTAINER_TYPE_LABELS: Record<ContainerType, string> = {
  BAG: 'Bag',
  LARGE_TOTE: 'Large Tote',
  SMALL_TOTE: 'Small Tote',
  DUFFEL: 'Duffel',
};

interface Kit {
  id: number;
  number: number;
  containerType: ContainerType;
  name: string;
  status: string;
  site: { id: number; name: string };
}

function kitDisplayName(kit: Kit): string {
  return `${CONTAINER_TYPE_LABELS[kit.containerType] || kit.containerType} ${kit.number} — ${kit.name}`;
}

export default function RetiredKits() {
  const navigate = useNavigate();
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { processed: sorted, sort, toggleSort, filters, setFilter } = useTableSort(kits, { key: 'name', direction: 'asc' });

  useEffect(() => {
    setLoading(true);
    fetch('/api/kits?status=RETIRED')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load kits');
        return r.json();
      })
      .then((data: Kit[]) => setKits(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleRestore(id: number) {
    fetch(`/api/kits/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to restore kit');
        setKits((prev) => prev.filter((k) => k.id !== id));
      })
      .catch((err) => setError(err.message));
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Retired Kits</h1>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && kits.length === 0 && (
        <p className="text-gray-500 text-sm">No retired kits found.</p>
      )}

      {kits.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <SortableHeader label="Name" sortKey="name" currentSort={sort} onSort={toggleSort} filterValue={filters['name']} onFilter={setFilter} />
                <SortableHeader label="Site" sortKey="site.name" currentSort={sort} onSort={toggleSort} filterValue={filters['site.name']} onFilter={setFilter} />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((kit) => (
                <tr
                  key={kit.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer opacity-60"
                  onClick={() => navigate(`/kits/${kit.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-400">{kitDisplayName(kit)}</td>
                  <td className="px-4 py-3 text-gray-400">{kit.site.name}</td>
                  <td className="px-4 py-3">
                    <button
                      className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors border-none cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(kit.id);
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

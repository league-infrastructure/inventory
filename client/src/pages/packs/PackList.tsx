import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTableSort } from '../../lib/useTableSort';
import SortableHeader from '../../components/SortableHeader';

interface Item {
  id: number;
  name: string;
  type: string;
  expectedQuantity: number | null;
}

interface Pack {
  id: number;
  name: string;
  description: string | null;
  qrCode: string | null;
  kitId: number;
  createdAt: string;
  updatedAt: string;
  kit: { id: number; name: string };
  items: Item[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function PackList() {
  const navigate = useNavigate();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { processed: sorted, sort, toggleSort, filters, setFilter } = useTableSort(packs, { key: 'name', direction: 'asc' });

  useEffect(() => {
    fetch('/api/packs')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load packs');
        return r.json();
      })
      .then(setPacks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function itemSummary(items: Item[]): string {
    if (items.length === 0) return 'Empty';
    return items.map((i) => {
      const qty = i.expectedQuantity != null ? `${i.expectedQuantity}x ` : '';
      return `${qty}${i.name}`;
    }).join(', ');
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Packs</h1>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && packs.length === 0 && (
        <p className="text-gray-500 text-sm">No packs found.</p>
      )}

      {packs.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <SortableHeader label="Name" sortKey="name" currentSort={sort} onSort={toggleSort} filterValue={filters['name']} onFilter={setFilter} />
                <SortableHeader label="Kit" sortKey="kit.name" currentSort={sort} onSort={toggleSort} filterValue={filters['kit.name']} onFilter={setFilter} />
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Contents</th>
                <SortableHeader label="Created" sortKey="createdAt" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Last Updated" sortKey="updatedAt" currentSort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((pack) => (
                <tr
                  key={pack.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/kits/${pack.kit.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{pack.name}</td>
                  <td className="px-4 py-3 text-gray-600">{pack.kit.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-xs">
                    {itemSummary(pack.items)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(pack.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(pack.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

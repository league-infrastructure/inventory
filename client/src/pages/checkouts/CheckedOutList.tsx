import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTableSort } from '../../lib/useTableSort';
import SortableHeader from '../../components/SortableHeader';

interface Checkout {
  id: number;
  checkedOutAt: string;
  kit: { id: number; name: string };
  user: { id: number; displayName: string };
}

export default function CheckedOutList() {
  const navigate = useNavigate();
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { processed: sorted, sort, toggleSort, filters, setFilter } = useTableSort(checkouts, { key: 'kit.name', direction: 'asc' });

  useEffect(() => {
    fetch('/api/checkouts')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load checkouts');
        return r.json();
      })
      .then(setCheckouts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Checked Out Kits</h1>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && checkouts.length === 0 && (
        <p className="text-gray-500 text-sm">No kits currently checked out.</p>
      )}

      {checkouts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <SortableHeader label="Kit Name" sortKey="kit.name" currentSort={sort} onSort={toggleSort} filterValue={filters['kit.name']} onFilter={setFilter} />
                <SortableHeader label="Checked Out By" sortKey="user.displayName" currentSort={sort} onSort={toggleSort} filterValue={filters['user.displayName']} onFilter={setFilter} />
                <SortableHeader label="Checkout Time" sortKey="checkedOutAt" currentSort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((checkout) => (
                <tr
                  key={checkout.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/kits/${checkout.kit.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{checkout.kit.name}</td>
                  <td className="px-4 py-3 text-gray-600">{checkout.user.displayName}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(checkout.checkedOutAt).toLocaleString()}
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

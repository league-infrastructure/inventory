import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';

interface InventoryAgeRow {
  type: 'kit' | 'computer';
  id: number;
  name: string;
  lastInventoried: string | null;
  daysSinceInventory: number | null;
}

function ageBadge(days: number | null) {
  if (days === null) return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Never</span>;
  if (days > 90) return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">{days}d</span>;
  if (days > 30) return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">{days}d</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">{days}d</span>;
}

export default function InventoryAgeReport() {
  const [rows, setRows] = useState<InventoryAgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'kit' | 'computer'>('all');

  useEffect(() => {
    fetch('/api/reports/inventory-age')
      .then((r) => r.ok ? r.json() : [])
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.type === filter);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="text-primary" size={24} />
        <h1 className="text-2xl font-bold">Inventory Age Report</h1>
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'kit', 'computer'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-sm ${filter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {f === 'all' ? 'All' : f === 'kit' ? 'Kits' : 'Computers'}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}

      {!loading && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Last Inventoried</th>
                <th className="px-4 py-2 text-left">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => (
                <tr key={`${r.type}-${r.id}`}>
                  <td className="px-4 py-2 capitalize">{r.type}</td>
                  <td className="px-4 py-2">
                    <Link
                      to={r.type === 'kit' ? `/kits/${r.id}` : `/computers/${r.id}`}
                      className="text-primary hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {r.lastInventoried ? new Date(r.lastInventoried).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-2">{ageBadge(r.daysSinceInventory)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

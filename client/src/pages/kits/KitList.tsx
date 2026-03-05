import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

interface Kit {
  id: number;
  name: string;
  status: string;
  qrCode: string | null;
  site: { id: number; name: string };
}

export default function KitList() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  useEffect(() => {
    setLoading(true);
    const params = statusFilter ? `?status=${statusFilter}` : '';
    fetch(`/api/kits${params}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load kits');
        return r.json();
      })
      .then(setKits)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kits</h1>
        <Link
          to="/kits/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg no-underline hover:bg-primary-hover transition-colors"
        >
          <Plus size={16} />
          New Kit
        </Link>
      </div>

      <div className="mb-4">
        <label className="text-sm text-gray-600">
          Status:{' '}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ml-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="RETIRED">Retired</option>
          </select>
        </label>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && kits.length === 0 && (
        <p className="text-gray-500 text-sm">No kits found.</p>
      )}

      {kits.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Site</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {kits.map((kit) => (
                <tr key={kit.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/kits/${kit.id}`} className="text-primary hover:underline">
                      {kit.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{kit.site.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                        kit.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {kit.status}
                    </span>
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

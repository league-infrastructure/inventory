import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Tags } from 'lucide-react';

interface Computer {
  id: number;
  model: string | null;
  disposition: string;
  hostName: { name: string } | null;
  site: { id: number; name: string } | null;
  kit: { id: number; name: string } | null;
}

const DISPOSITIONS = [
  'ACTIVE', 'LOANED', 'NEEDS_REPAIR', 'IN_REPAIR',
  'SCRAPPED', 'LOST', 'DECOMMISSIONED',
];

function dispositionClasses(d: string): string {
  switch (d) {
    case 'ACTIVE': return 'bg-green-100 text-green-700';
    case 'LOANED': return 'bg-blue-100 text-blue-700';
    case 'NEEDS_REPAIR': return 'bg-amber-100 text-amber-700';
    case 'IN_REPAIR': return 'bg-orange-100 text-orange-700';
    case 'SCRAPPED': return 'bg-gray-100 text-gray-600';
    case 'LOST': return 'bg-red-100 text-red-700';
    case 'DECOMMISSIONED': return 'bg-gray-100 text-gray-500';
    default: return 'bg-gray-100 text-gray-600';
  }
}

export default function ComputerList() {
  const [computers, setComputers] = useState<Computer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispositionFilter, setDispositionFilter] = useState('ACTIVE');

  useEffect(() => {
    setLoading(true);
    const params = dispositionFilter ? `?disposition=${dispositionFilter}` : '';
    fetch(`/api/computers${params}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load computers');
        return r.json();
      })
      .then(setComputers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dispositionFilter]);

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Computers</h1>
        <div className="flex gap-2">
          <Link
            to="/hostnames"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg no-underline hover:bg-gray-700 transition-colors"
          >
            <Tags size={16} />
            Host Names
          </Link>
          <Link
            to="/computers/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg no-underline hover:bg-primary-hover transition-colors"
          >
            <Plus size={16} />
            New Computer
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <label className="text-sm text-gray-600">
          Disposition:{' '}
          <select
            value={dispositionFilter}
            onChange={(e) => setDispositionFilter(e.target.value)}
            className="ml-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="">All</option>
            {DISPOSITIONS.map((d) => (
              <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && computers.length === 0 && (
        <p className="text-gray-500 text-sm">No computers found.</p>
      )}

      {computers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Host Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Model</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Disposition</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden sm:table-cell">Site</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden sm:table-cell">Kit</th>
              </tr>
            </thead>
            <tbody>
              {computers.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/computers/${c.id}`} className="text-primary hover:underline">
                      {c.hostName?.name || `#${c.id}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.model || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${dispositionClasses(c.disposition)}`}>
                      {c.disposition.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{c.site?.name || '—'}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {c.kit ? <Link to={`/kits/${c.kit.id}`} className="text-primary hover:underline">{c.kit.name}</Link> : '—'}
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

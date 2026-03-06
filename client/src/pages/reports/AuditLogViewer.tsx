import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditRecord {
  id: number;
  userId: number | null;
  userName: string | null;
  objectType: string;
  objectId: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  source: string;
  createdAt: string;
}

interface AuditPage {
  records: AuditRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AuditLogViewer() {
  const [data, setData] = useState<AuditPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    objectType: '',
    userId: '',
    field: '',
    startDate: '',
    endDate: '',
  });
  const [page, setPage] = useState(1);

  async function fetchData(p = page) {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(p));
    params.set('pageSize', '50');
    if (filters.objectType) params.set('objectType', filters.objectType);
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.field) params.set('field', filters.field);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);

    try {
      const res = await fetch(`/api/reports/audit-log?${params}`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { fetchData(1); setPage(1); }, [filters]);
  useEffect(() => { fetchData(); }, [page]);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Audit Log</h1>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
        <select
          value={filters.objectType}
          onChange={(e) => setFilters({ ...filters, objectType: e.target.value })}
          className="border rounded px-2 py-1.5 text-sm"
        >
          <option value="">All Types</option>
          {['Kit', 'Pack', 'Item', 'Computer', 'HostName', 'Site', 'Checkout'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Field..."
          value={filters.field}
          onChange={(e) => setFilters({ ...filters, field: e.target.value })}
          className="border rounded px-2 py-1.5 text-sm"
        />
        <input
          type="text"
          placeholder="User ID"
          value={filters.userId}
          onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
          className="border rounded px-2 py-1.5 text-sm"
        />
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          className="border rounded px-2 py-1.5 text-sm"
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          className="border rounded px-2 py-1.5 text-sm"
        />
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}

      {data && (
        <>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Time</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Object</th>
                  <th className="px-3 py-2 text-left">Field</th>
                  <th className="px-3 py-2 text-left">Old</th>
                  <th className="px-3 py-2 text-left">New</th>
                  <th className="px-3 py-2 text-left">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.records.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{r.userName || '-'}</td>
                    <td className="px-3 py-2">{r.objectType} #{r.objectId}</td>
                    <td className="px-3 py-2">{r.field}</td>
                    <td className="px-3 py-2 text-red-600 max-w-32 truncate">{r.oldValue || '-'}</td>
                    <td className="px-3 py-2 text-green-600 max-w-32 truncate">{r.newValue || '-'}</td>
                    <td className="px-3 py-2">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-gray-500">{data.total} records</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm">Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

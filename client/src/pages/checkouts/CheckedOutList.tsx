import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import SortableHeader from '../../components/SortableHeader';
import { useTableSort } from '../../lib/useTableSort';

interface TransferredData {
  kits: {
    id: number;
    number: number;
    name: string;
    site: { id: number; name: string } | null;
    custodian: { id: number; displayName: string } | null;
  }[];
  computers: {
    id: number;
    model: string | null;
    hostName: { name: string } | null;
    site: { id: number; name: string } | null;
    custodian: { id: number; displayName: string } | null;
  }[];
}

interface UnifiedRow {
  id: number;
  type: 'Kit' | 'Computer';
  name: string;
  _custodian: string;
  _site: string;
  link: string;
}

export default function CheckedOutList() {
  const navigate = useNavigate();
  const [data, setData] = useState<TransferredData>({ kits: [], computers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/transfers/out')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load transfers');
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const rows: UnifiedRow[] = useMemo(() => {
    const kitRows: UnifiedRow[] = data.kits.map((kit) => ({
      id: kit.id,
      type: 'Kit',
      name: `#${kit.number}: ${kit.name}`,
      _custodian: kit.custodian?.displayName ?? '—',
      _site: kit.site?.name ?? '—',
      link: `/kits/${kit.id}`,
    }));
    const computerRows: UnifiedRow[] = data.computers.map((c) => ({
      id: c.id,
      type: 'Computer',
      name: c.hostName?.name || c.model || `Computer #${c.id}`,
      _custodian: c.custodian?.displayName ?? '—',
      _site: c.site?.name ?? '—',
      link: `/computers/${c.id}`,
    }));
    return [...kitRows, ...computerRows];
  }, [data]);

  const { processed, sort, toggleSort, filters, setFilter } = useTableSort(rows, { key: 'name', direction: 'asc' });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Transferred Out {!loading && <span className="text-gray-400 font-normal text-lg">({processed.length})</span>}
        </h1>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && rows.length === 0 && (
        <p className="text-gray-500 text-sm">No items currently transferred out.</p>
      )}

      {!loading && rows.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <SortableHeader
                  label="Type"
                  sortKey="type"
                  currentSort={sort}
                  onSort={toggleSort}
                  filterValue={filters.type}
                  onFilter={setFilter}
                />
                <SortableHeader
                  label="Name"
                  sortKey="name"
                  currentSort={sort}
                  onSort={toggleSort}
                  filterValue={filters.name}
                  onFilter={setFilter}
                />
                <SortableHeader
                  label="Custodian"
                  sortKey="_custodian"
                  currentSort={sort}
                  onSort={toggleSort}
                  filterValue={filters._custodian}
                  onFilter={setFilter}
                />
                <SortableHeader
                  label="Site"
                  sortKey="_site"
                  currentSort={sort}
                  onSort={toggleSort}
                  filterValue={filters._site}
                  onFilter={setFilter}
                />
              </tr>
            </thead>
            <tbody>
              {processed.map((row) => (
                <tr
                  key={`${row.type}-${row.id}`}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(row.link)}
                >
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                      row.type === 'Kit' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-3 text-gray-600">{row._custodian}</td>
                  <td className="px-4 py-3 text-gray-600">{row._site}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

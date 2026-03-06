import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Tags, ArrowRightLeft, User, Building2, Archive } from 'lucide-react';
import { useTableSort } from '../../lib/useTableSort';
import SortableHeader from '../../components/SortableHeader';
import TransferModal from '../../components/TransferModal';

interface Computer {
  id: number;
  model: string | null;
  disposition: string;
  hostName: { name: string } | null;
  site: { id: number; name: string } | null;
  kit: { id: number; name: string } | null;
  custodian: { id: number; displayName: string } | null;
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
  const navigate = useNavigate();
  const [computers, setComputers] = useState<Computer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispositionFilter, setDispositionFilter] = useState('ACTIVE');
  const [transferComputerId, setTransferComputerId] = useState<number | null>(null);

  const computersWithWhere = useMemo(() => computers.map((c) => ({
    ...c,
    _where: c.custodian ? `1:${c.custodian.displayName}` : c.kit ? `2:Kit: ${c.kit.name}` : c.site ? `3:${c.site.name}` : '4:',
    _whereDisplay: c.custodian?.displayName ?? (c.kit ? `Kit: ${c.kit.name}` : c.site?.name ?? null),
    _whereType: c.custodian ? 'person' as const : c.kit ? 'kit' as const : c.site ? 'site' as const : null,
  })), [computers]);

  const { processed: sorted, sort, toggleSort, filters, setFilter } = useTableSort(computersWithWhere, { key: 'hostName.name', direction: 'asc' });

  function loadComputers() {
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
  }

  useEffect(() => { loadComputers(); }, [dispositionFilter]);

  function handleTransferClick(e: React.MouseEvent, computer: Computer) {
    e.stopPropagation();
    if (computer.kit) return; // Can't transfer computers in a kit
    setTransferComputerId(computer.id);
  }

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
                <SortableHeader label="Host Name" sortKey="hostName.name" currentSort={sort} onSort={toggleSort} filterValue={filters['hostName.name']} onFilter={setFilter} />
                <SortableHeader label="Model" sortKey="model" currentSort={sort} onSort={toggleSort} filterValue={filters['model']} onFilter={setFilter} />
                <SortableHeader label="Disposition" sortKey="disposition" currentSort={sort} onSort={toggleSort} filterValue={filters['disposition']} onFilter={setFilter} />
                <SortableHeader label="Where" sortKey="_where" currentSort={sort} onSort={toggleSort} filterValue={filters['_whereDisplay']} onFilter={(_, v) => setFilter('_whereDisplay', v)} className="hidden sm:table-cell" />
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 hidden sm:table-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/computers/${c.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {c.hostName?.name || `#${c.id}`}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.model || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${dispositionClasses(c.disposition)}`}>
                      {c.disposition.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {c._whereType === 'person' ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium">
                        <User size={14} className="shrink-0" />
                        {c._whereDisplay}
                      </span>
                    ) : c._whereType === 'kit' ? (
                      <span className="inline-flex items-center gap-1.5 text-gray-500">
                        <Archive size={14} className="shrink-0 text-gray-400" />
                        {c._whereDisplay}
                      </span>
                    ) : c._whereType === 'site' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 size={14} className="shrink-0 text-gray-400" />
                        {c._whereDisplay}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {!c.kit && (
                      <button
                        onClick={(e) => handleTransferClick(e, c)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100"
                        title="Transfer"
                      >
                        <ArrowRightLeft size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {transferComputerId && (
        <TransferModal
          objectType="Computer"
          objectId={transferComputerId}
          onClose={() => setTransferComputerId(null)}
          onComplete={loadComputers}
        />
      )}
    </div>
  );
}

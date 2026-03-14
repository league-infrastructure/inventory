import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Tags, ArrowRightLeft, User, Building2, Archive, Printer, X } from 'lucide-react';
import { useTableSort } from '../../lib/useTableSort';
import SortableHeader from '../../components/SortableHeader';
import TransferModal from '../../components/TransferModal';

interface Computer {
  id: number;
  model: string | null;
  disposition: string;
  updatedAt: string;
  hostName: { name: string } | null;
  site: { id: number; name: string } | null;
  kit: { id: number; name: string } | null;
  custodian: { id: number; displayName: string } | null;
}

import { DISPOSITIONS, dispositionClasses } from '../../lib/dispositions';

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ComputerList() {
  const navigate = useNavigate();
  const [computers, setComputers] = useState<Computer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispositionFilter, setDispositionFilter] = useState('ACTIVE');
  const [transferComputerId, setTransferComputerId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const enriched = useMemo(() => computers.map((c) => ({
    ...c,
    _custodian: c.custodian?.displayName ?? '',
    _location: c.site?.name ?? '',
    _kit: c.kit?.name ?? '',
  })), [computers]);

  const { processed: sorted, sort, toggleSort, filters, setFilter } = useTableSort(enriched, { key: 'hostName.name', direction: 'asc' });

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

  useEffect(() => { loadComputers(); setSelectedIds(new Set()); }, [dispositionFilter]);

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (prev.size === sorted.length) return new Set();
      return new Set(sorted.map((c) => c.id));
    });
  }

  function handlePrintSingle(e: React.MouseEvent, computerId: number) {
    e.stopPropagation();
    window.open(`/api/labels/computer/${computerId}/compact`, '_blank');
  }

  async function handleBatchPrint() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    // Open window immediately (synchronous with click) to avoid popup blocker
    const pdfWindow = window.open('', '_blank');
    try {
      const res = await fetch('/api/labels/computers/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ computerIds: ids }),
      });
      if (!res.ok) throw new Error('Failed to generate labels');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (pdfWindow) {
        pdfWindow.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    } catch (e: any) {
      if (pdfWindow) pdfWindow.close();
      setError(e.message);
    }
  }

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
                <th className="px-2 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={sorted.length > 0 && selectedIds.size === sorted.length}
                    onChange={toggleSelectAll}
                    className="cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
                <SortableHeader label="Host Name" sortKey="hostName.name" currentSort={sort} onSort={toggleSort} filterValue={filters['hostName.name']} onFilter={setFilter} />
                <SortableHeader label="Model" sortKey="model" currentSort={sort} onSort={toggleSort} filterValue={filters['model']} onFilter={setFilter} />
                <SortableHeader label="Disposition" sortKey="disposition" currentSort={sort} onSort={toggleSort} filterValue={filters['disposition']} onFilter={setFilter} />
                <SortableHeader label="Custodian" sortKey="_custodian" currentSort={sort} onSort={toggleSort} filterValue={filters['_custodian']} onFilter={setFilter} className="hidden sm:table-cell" />
                <SortableHeader label="Location" sortKey="_location" currentSort={sort} onSort={toggleSort} filterValue={filters['_location']} onFilter={setFilter} className="hidden sm:table-cell" />
                <SortableHeader label="Kit" sortKey="_kit" currentSort={sort} onSort={toggleSort} filterValue={filters['_kit']} onFilter={setFilter} className="hidden sm:table-cell" />
                <SortableHeader label="Last Updated" sortKey="updatedAt" currentSort={sort} onSort={toggleSort} className="hidden sm:table-cell" />
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
                  <td className="px-2 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-pointer"
                    />
                  </td>
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
                    {c.custodian ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium">
                        <User size={14} className="shrink-0" />
                        {c.custodian.displayName}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {c.site ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 size={14} className="shrink-0 text-gray-400" />
                        {c.site.name}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {c.kit ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Archive size={14} className="shrink-0 text-gray-400" />
                        {c.kit.name}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell" title={c.updatedAt ? new Date(c.updatedAt).toLocaleString() : ''}>
                    {c.updatedAt ? formatUpdatedAt(c.updatedAt) : '—'}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => handlePrintSingle(e, c.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-gray-50 text-gray-700 border border-gray-200 cursor-pointer hover:bg-gray-100"
                        title="Print Label"
                      >
                        <Printer size={12} />
                      </button>
                      {!c.kit && (
                        <button
                          onClick={(e) => handleTransferClick(e, c)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100"
                          title="Transfer"
                        >
                          <ArrowRightLeft size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-white border border-gray-300 rounded-xl shadow-lg">
          <span className="text-sm font-medium text-gray-700">{selectedIds.size} selected</span>
          <button
            onClick={handleBatchPrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover"
          >
            <Printer size={14} />
            Print Labels
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-sm text-gray-500 cursor-pointer hover:text-gray-700 bg-transparent border-none"
            title="Clear selection"
          >
            <X size={14} />
          </button>
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

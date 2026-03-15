import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ClipboardCheck, Check, ArrowRightLeft, User, Building2 } from 'lucide-react';
import { useTableSort } from '../../lib/useTableSort';
import SortableHeader from '../../components/SortableHeader';
import InventoryCheckModal from '../../components/InventoryCheckModal';
import TransferModal from '../../components/TransferModal';
import type { ContainerType } from '../../lib/containers';
import { CONTAINER_TYPE_LABELS } from '../../lib/containers';

interface Kit {
  id: number;
  number: number;
  containerType: ContainerType;
  name: string;
  status: string;
  qrCode: string | null;
  createdAt: string;
  updatedAt: string;
  lastInventoried: string | null;
  site: { id: number; name: string } | null;
  custodian: { id: number; displayName: string } | null;
  category: { id: number; name: string } | null;
}

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

function kitDisplayName(kit: Kit): string {
  return `${CONTAINER_TYPE_LABELS[kit.containerType] || kit.containerType} ${kit.number} — ${kit.name}`;
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export default function KitList() {
  const navigate = useNavigate();
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingKitId, setCheckingKitId] = useState<number | null>(null);
  const [transferKitId, setTransferKitId] = useState<number | null>(null);
  const [justChecked, setJustChecked] = useState<Set<number>>(new Set());
  const [inventoryInterval, setInventoryInterval] = useState(60);

  const kitsWithColumns = useMemo(() => kits.map((kit) => ({
    ...kit,
    _custodian: kit.custodian?.displayName ?? '',
    _location: kit.site?.name ?? '',
    _category: kit.category?.name ?? '',
    _container: CONTAINER_TYPE_LABELS[kit.containerType] || kit.containerType,
  })), [kits]);

  const { processed: sorted, sort, toggleSort, filters, setFilter } = useTableSort(kitsWithColumns, { key: 'number', direction: 'asc' });

  const loadKits = useCallback(() => {
    setLoading(true);
    fetch('/api/kits?status=ACTIVE')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load kits');
        return r.json();
      })
      .then(setKits)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadKits(); }, [loadKits]);

  useEffect(() => {
    fetch('/api/settings/inventory-interval')
      .then((r) => r.ok ? r.json() : { days: 60 })
      .then((data) => setInventoryInterval(data.days));
  }, []);

  function needsInventory(kit: Kit): boolean {
    const days = daysSince(kit.lastInventoried);
    return days === null || days > inventoryInterval;
  }

  function handleInventoryClick(e: React.MouseEvent, kitId: number) {
    e.stopPropagation();
    setCheckingKitId(kitId);
  }

  function handleTransferClick(e: React.MouseEvent, kitId: number) {
    e.stopPropagation();
    setTransferKitId(kitId);
  }

  function handleCheckComplete() {
    setJustChecked((prev) => new Set(prev).add(checkingKitId!));
    loadKits();
  }

  const checkingKit = kits.find((k) => k.id === checkingKitId);

  return (
    <div className="max-w-5xl">
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
                <SortableHeader label="#" sortKey="number" currentSort={sort} onSort={toggleSort} filterValue={filters['number']} onFilter={setFilter} />
                <SortableHeader label="Category" sortKey="_category" currentSort={sort} onSort={toggleSort} filterValue={filters['_category']} onFilter={setFilter} />
                <SortableHeader label="Container" sortKey="_container" currentSort={sort} onSort={toggleSort} filterValue={filters['_container']} onFilter={setFilter} />
                <SortableHeader label="Description" sortKey="name" currentSort={sort} onSort={toggleSort} filterValue={filters['name']} onFilter={setFilter} />
                <SortableHeader label="Custodian" sortKey="_custodian" currentSort={sort} onSort={toggleSort} filterValue={filters['_custodian']} onFilter={setFilter} />
                <SortableHeader label="Location" sortKey="_location" currentSort={sort} onSort={toggleSort} filterValue={filters['_location']} onFilter={setFilter} />
                <SortableHeader label="Last Inventory" sortKey="lastInventoried" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Last Updated" sortKey="updatedAt" currentSort={sort} onSort={toggleSort} className="hidden sm:table-cell" />
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((kit) => {
                const checked = justChecked.has(kit.id);
                const needs = needsInventory(kit) && !checked;
                return (
                  <tr
                    key={kit.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/kits/${kit.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{kit.number}</td>
                    <td className="px-4 py-3 text-gray-600">{kit._category || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{kit._container}</td>
                    <td className="px-4 py-3 text-gray-900">{kit.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {kit._custodian ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium">
                          <User size={14} className="shrink-0" />
                          {kit._custodian}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {kit._location ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 size={14} className="shrink-0 text-gray-400" />
                          {kit._location}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {kit.lastInventoried
                        ? new Date(kit.lastInventoried).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell" title={kit.updatedAt ? new Date(kit.updatedAt).toLocaleString() : ''}>
                      {kit.updatedAt ? formatUpdatedAt(kit.updatedAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleTransferClick(e, kit.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100"
                          title="Transfer"
                        >
                          <ArrowRightLeft size={12} />
                        </button>
                        {checked ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <Check size={14} /> Done
                          </span>
                        ) : needs ? (
                          <button
                            onClick={(e) => handleInventoryClick(e, kit.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-amber-100 text-amber-700 border border-amber-300 cursor-pointer hover:bg-amber-200"
                            title="Inventory check overdue"
                          >
                            <ClipboardCheck size={12} />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {daysSince(kit.lastInventoried)}d
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {checkingKitId && checkingKit && (
        <InventoryCheckModal
          kitId={checkingKitId}
          kitName={kitDisplayName(checkingKit)}
          onClose={() => setCheckingKitId(null)}
          onComplete={handleCheckComplete}
        />
      )}

      {transferKitId && (
        <TransferModal
          objectType="Kit"
          objectId={transferKitId}
          onClose={() => setTransferKitId(null)}
          onComplete={loadKits}
        />
      )}
    </div>
  );
}

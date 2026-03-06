import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ClipboardCheck, Check } from 'lucide-react';
import { useTableSort } from '../../lib/useTableSort';
import SortableHeader from '../../components/SortableHeader';
import InventoryCheckModal from '../../components/InventoryCheckModal';

type ContainerType = 'BAG' | 'LARGE_TOTE' | 'SMALL_TOTE' | 'DUFFEL';

const CONTAINER_TYPE_LABELS: Record<ContainerType, string> = {
  BAG: 'Bag',
  LARGE_TOTE: 'Large Tote',
  SMALL_TOTE: 'Small Tote',
  DUFFEL: 'Duffel',
};

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
}

function kitDisplayName(kit: Kit): string {
  return `${CONTAINER_TYPE_LABELS[kit.containerType] || kit.containerType} ${kit.number} — ${kit.name}`;
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function needsInventory(kit: Kit): boolean {
  const days = daysSince(kit.lastInventoried);
  return days === null || days > 30;
}

export default function KitList() {
  const navigate = useNavigate();
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingKitId, setCheckingKitId] = useState<number | null>(null);
  const [justChecked, setJustChecked] = useState<Set<number>>(new Set());
  const { processed: sorted, sort, toggleSort, filters, setFilter } = useTableSort(kits, { key: 'name', direction: 'asc' });

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

  function handleInventoryClick(e: React.MouseEvent, kitId: number) {
    e.stopPropagation();
    setCheckingKitId(kitId);
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
                <SortableHeader label="Name" sortKey="name" currentSort={sort} onSort={toggleSort} filterValue={filters['name']} onFilter={setFilter} />
                <SortableHeader label="Where" sortKey="site.name" currentSort={sort} onSort={toggleSort} filterValue={filters['site.name']} onFilter={setFilter} />
                <SortableHeader label="Status" sortKey="status" currentSort={sort} onSort={toggleSort} filterValue={filters['status']} onFilter={setFilter} />
                <SortableHeader label="Created" sortKey="createdAt" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Updated" sortKey="updatedAt" currentSort={sort} onSort={toggleSort} />
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">Inventory</th>
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
                    <td className="px-4 py-3 font-medium text-gray-900">{kitDisplayName(kit)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {kit.custodian ? (
                        <span className="text-amber-600 font-medium">{kit.custodian.displayName}</span>
                      ) : kit.site?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                        {kit.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(kit.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(kit.updatedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-center">
                      {checked ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                          <Check size={14} /> Done
                        </span>
                      ) : needs ? (
                        <button
                          onClick={(e) => handleInventoryClick(e, kit.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-amber-100 text-amber-700 border border-amber-300 cursor-pointer hover:bg-amber-200"
                        >
                          <ClipboardCheck size={13} /> Check
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {daysSince(kit.lastInventoried)}d ago
                        </span>
                      )}
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
    </div>
  );
}

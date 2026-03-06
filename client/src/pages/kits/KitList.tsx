import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTableSort } from '../../lib/useTableSort';
import SortableHeader from '../../components/SortableHeader';

type ContainerType = 'BAG' | 'LARGE_TOTE' | 'SMALL_TOTE' | 'DUFFEL';

const CONTAINER_TYPE_LABELS: Record<ContainerType, string> = {
  BAG: 'Bag',
  LARGE_TOTE: 'Large Tote',
  SMALL_TOTE: 'Small Tote',
  DUFFEL: 'Duffel',
};

interface Checkout {
  id: number;
  kitId: number;
  user: { displayName: string };
}

interface Kit {
  id: number;
  number: number;
  containerType: ContainerType;
  name: string;
  status: string;
  qrCode: string | null;
  site: { id: number; name: string };
  _checkedOutBy?: string;
}

function kitDisplayName(kit: Kit): string {
  return `${CONTAINER_TYPE_LABELS[kit.containerType] || kit.containerType} ${kit.number} — ${kit.name}`;
}

export default function KitList() {
  const navigate = useNavigate();
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { processed: sorted, sort, toggleSort, filters, setFilter } = useTableSort(kits, { key: 'name', direction: 'asc' });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/kits?status=ACTIVE').then((r) => {
        if (!r.ok) throw new Error('Failed to load kits');
        return r.json();
      }),
      fetch('/api/checkouts?status=open').then((r) => r.ok ? r.json() : []),
    ])
      .then(([kitData, checkouts]: [Kit[], Checkout[]]) => {
        const coByKit = new Map(checkouts.map((c) => [c.kitId, c.user.displayName]));
        setKits(kitData.map((k) => ({ ...k, _checkedOutBy: coByKit.get(k.id) })));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
              </tr>
            </thead>
            <tbody>
              {sorted.map((kit) => (
                <tr
                  key={kit.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/kits/${kit.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{kitDisplayName(kit)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {kit._checkedOutBy ? (
                      <span className="text-amber-600 font-medium">{kit._checkedOutBy}</span>
                    ) : kit.site.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
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

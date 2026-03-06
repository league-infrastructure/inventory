import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';

interface CheckoutItem {
  checkoutId: number;
  kitId: number;
  kitNumber: number;
  kitName: string;
  checkedOutAt: string;
}

export default function CheckedOutByPerson() {
  const [data, setData] = useState<Record<string, CheckoutItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports/checked-out-by-person')
      .then((r) => r.ok ? r.json() : {})
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const people = Object.entries(data);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Users className="text-primary" size={24} />
        <h1 className="text-2xl font-bold">Checked Out by Person</h1>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}

      {!loading && people.length === 0 && (
        <p className="text-sm text-gray-500">No kits are currently checked out.</p>
      )}

      {people.map(([name, items]) => (
        <div key={name} className="mb-6">
          <h2 className="text-lg font-semibold mb-2">{name} ({items.length})</h2>
          <div className="bg-white rounded-lg shadow divide-y">
            {items.map((co) => (
              <div key={co.checkoutId} className="flex items-center justify-between px-4 py-3">
                <div>
                  <Link to={`/kits/${co.kitId}`} className="font-medium text-primary hover:underline">
                    Kit #{co.kitNumber}: {co.kitName}
                  </Link>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(co.checkedOutAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

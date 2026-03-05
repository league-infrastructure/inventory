import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Checkout {
  id: number;
  checkedOutAt: string;
  kit: { id: number; name: string };
  user: { id: number; displayName: string };
  destinationSite: { id: number; name: string };
}

export default function CheckedOutList() {
  const navigate = useNavigate();
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/checkouts')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load checkouts');
        return r.json();
      })
      .then(setCheckouts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Checked Out Kits</h1>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && checkouts.length === 0 && (
        <p className="text-gray-500 text-sm">No kits currently checked out.</p>
      )}

      {checkouts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Kit Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Checked Out By</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Destination Site</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Checkout Time</th>
              </tr>
            </thead>
            <tbody>
              {checkouts.map((checkout) => (
                <tr
                  key={checkout.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/kits/${checkout.kit.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{checkout.kit.name}</td>
                  <td className="px-4 py-3 text-gray-600">{checkout.user.displayName}</td>
                  <td className="px-4 py-3 text-gray-600">{checkout.destinationSite.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(checkout.checkedOutAt).toLocaleString()}
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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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

  const totalItems = data.kits.length + data.computers.length;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transferred Out</h1>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && totalItems === 0 && (
        <p className="text-gray-500 text-sm">No items currently transferred out.</p>
      )}

      {data.kits.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-2">Kits ({data.kits.length})</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500">Kit</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Custodian</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Site</th>
                </tr>
              </thead>
              <tbody>
                {data.kits.map((kit) => (
                  <tr
                    key={kit.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/kits/${kit.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">Kit #{kit.number}: {kit.name}</td>
                    <td className="px-4 py-3 text-gray-600">{kit.custodian?.displayName ?? 'Admin'}</td>
                    <td className="px-4 py-3 text-gray-600">{kit.site?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data.computers.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-2">Computers ({data.computers.length})</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500">Computer</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Custodian</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Site</th>
                </tr>
              </thead>
              <tbody>
                {data.computers.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/computers/${c.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{c.hostName?.name || c.model || `Computer #${c.id}`}</td>
                    <td className="px-4 py-3 text-gray-600">{c.custodian?.displayName ?? 'Admin'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.site?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

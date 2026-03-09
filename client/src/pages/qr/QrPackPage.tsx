import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQrAuth } from './useQrAuth';
import QrSignIn from './QrSignIn';
import ReportIssueAction from './actions/ReportIssueAction';
import AddPhotoAction from './actions/AddPhotoAction';

interface Pack {
  id: number;
  name: string;
  description: string | null;
  imageId: number | null;
  kit: { id: number; number: number; name: string };
  items: { id: number; name: string; type: string; expectedQuantity: number }[];
}

export default function QrPackPage() {
  const { id } = useParams();
  const { user, loading: authLoading, signInUrl } = useQrAuth();
  const [pack, setPack] = useState<Pack | null>(null);
  const [error, setError] = useState('');

  function loadPack() {
    fetch(`/api/packs/${id}`)
      .then((r) => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(setPack)
      .catch(() => setError('Pack not found'));
  }

  useEffect(() => {
    if (user) loadPack();
  }, [user, id]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>;
  }

  if (!user) {
    return <QrSignIn signInUrl={signInUrl} title={`Pack #${id}`} subtitle="Sign in to view this pack." />;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-red-600">{error}</p></div>;
  }

  if (!pack) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading pack...</p></div>;
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {pack.imageId && (
        <img
          src={`/api/images/${pack.imageId}`}
          alt={pack.name}
          className="w-full h-48 object-contain bg-white rounded-xl border border-gray-200 mb-4"
        />
      )}
      <div className="text-center mb-6">
        <p className="text-sm text-gray-400 uppercase tracking-wider">Pack</p>
        <h1 className="text-2xl font-bold text-gray-900">{pack.name}</h1>
        {pack.description && <p className="text-sm text-gray-500 mt-1">{pack.description}</p>}
      </div>

      {/* Parent kit link */}
      <Link
        to={`/qr/k/${pack.kit.id}`}
        className="block bg-white rounded-xl border border-gray-200 p-4 mb-4 no-underline hover:bg-gray-50"
      >
        <p className="text-xs text-gray-400 uppercase tracking-wider">Part of Kit</p>
        <p className="text-lg font-bold text-gray-900">#{pack.kit.number} — {pack.kit.name}</p>
        <p className="text-xs text-primary mt-1">Go to kit for check-in/out →</p>
      </Link>

      {/* Items list */}
      {pack.items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Items</p>
          <ul className="space-y-1">
            {pack.items.map((item) => (
              <li key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.name}</span>
                <span className="text-gray-400">
                  {item.type === 'COUNTED' ? `×${item.expectedQuantity}` : 'consumable'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3 mb-6">
        <ReportIssueAction objectType="Pack" objectId={pack.id} />
        <AddPhotoAction objectType="Pack" objectId={pack.id} onDone={loadPack} />
      </div>

      <div className="text-center">
        <Link to={`/kits/${pack.kit.id}`} className="text-sm text-primary hover:underline">
          View full details
        </Link>
      </div>
    </div>
  );
}

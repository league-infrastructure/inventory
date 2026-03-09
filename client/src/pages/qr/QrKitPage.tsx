import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQrAuth } from './useQrAuth';
import QrSignIn from './QrSignIn';
import CheckOutAction from './actions/CheckOutAction';
import CheckInAction from './actions/CheckInAction';
import ReportIssueAction from './actions/ReportIssueAction';
import AddPhotoAction from './actions/AddPhotoAction';

interface Kit {
  id: number;
  number: number;
  name: string;
  imageId: number | null;
  custodian: { id: number; displayName: string } | null;
  site: { id: number; name: string } | null;
  disposition: string;
}

export default function QrKitPage() {
  const { id } = useParams();
  const { user, loading: authLoading, signInUrl } = useQrAuth();
  const [kit, setKit] = useState<Kit | null>(null);
  const [error, setError] = useState('');

  function loadKit() {
    fetch(`/api/kits/${id}`)
      .then((r) => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(setKit)
      .catch(() => setError('Kit not found'));
  }

  useEffect(() => {
    if (user) loadKit();
  }, [user, id]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>;
  }

  if (!user) {
    return <QrSignIn signInUrl={signInUrl} title={`Kit #${id}`} subtitle="Sign in to view and manage this kit." />;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-red-600">{error}</p></div>;
  }

  if (!kit) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading kit...</p></div>;
  }

  const isCheckedOut = !!kit.custodian;

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {/* Item identity */}
      {kit.imageId && (
        <img
          src={`/api/images/${kit.imageId}`}
          alt={kit.name}
          className="w-full h-48 object-contain bg-white rounded-xl border border-gray-200 mb-4"
        />
      )}
      <div className="text-center mb-6">
        <p className="text-sm text-gray-400 uppercase tracking-wider">Kit</p>
        <h1 className="text-3xl font-bold text-gray-900">#{kit.number}</h1>
        <p className="text-lg text-gray-700">{kit.name}</p>
      </div>

      {/* Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Status</span>
          <span className="font-medium">{kit.disposition}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Custodian</span>
          <span className="font-medium">{kit.custodian?.displayName || '—'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Site</span>
          <span className="font-medium">{kit.site?.name || '—'}</span>
        </div>
      </div>

      {/* Primary actions */}
      <div className="space-y-3 mb-6">
        {isCheckedOut ? (
          <CheckInAction objectType="Kit" objectId={kit.id} onDone={loadKit} />
        ) : (
          <CheckOutAction objectType="Kit" objectId={kit.id} userId={user.id} userName={user.displayName} onDone={loadKit} />
        )}
      </div>

      {/* Secondary actions */}
      <div className="space-y-3 mb-6">
        <ReportIssueAction objectType="Kit" objectId={kit.id} />
        <AddPhotoAction objectType="Kit" objectId={kit.id} onDone={loadKit} />
      </div>

      {/* Link to desktop */}
      <div className="text-center">
        <Link to={`/kits/${id}`} className="text-sm text-primary hover:underline">
          View full details
        </Link>
      </div>
    </div>
  );
}

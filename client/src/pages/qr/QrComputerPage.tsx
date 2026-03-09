import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQrAuth } from './useQrAuth';
import QrSignIn from './QrSignIn';
import TransferAction from './actions/TransferAction';
import ReportIssueAction from './actions/ReportIssueAction';
import AddPhotoAction from './actions/AddPhotoAction';

interface Computer {
  id: number;
  model: string;
  serialNumber: string | null;
  imageId: number | null;
  disposition: string;
  custodian: { id: number; displayName: string } | null;
  site: { id: number; name: string } | null;
  hostName: { id: number; name: string } | null;
}

export default function QrComputerPage() {
  const { id } = useParams();
  const { user, loading: authLoading, signInUrl } = useQrAuth();
  const [computer, setComputer] = useState<Computer | null>(null);
  const [error, setError] = useState('');

  function loadComputer() {
    fetch(`/api/computers/${id}`)
      .then((r) => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(setComputer)
      .catch(() => setError('Computer not found'));
  }

  useEffect(() => {
    if (user) loadComputer();
  }, [user, id]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>;
  }

  if (!user) {
    return <QrSignIn signInUrl={signInUrl} title={`Computer #${id}`} subtitle="Sign in to view and manage this computer." />;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-red-600">{error}</p></div>;
  }

  if (!computer) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading computer...</p></div>;
  }

  const displayName = computer.hostName?.name || computer.model || `Computer #${computer.id}`;

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {computer.imageId && (
        <img
          src={`/api/images/${computer.imageId}`}
          alt={displayName}
          className="w-full h-48 object-contain bg-white rounded-xl border border-gray-200 mb-4"
        />
      )}
      <div className="text-center mb-6">
        <p className="text-sm text-gray-400 uppercase tracking-wider">Computer</p>
        <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
        {computer.serialNumber && <p className="text-xs text-gray-400 mt-1">S/N: {computer.serialNumber}</p>}
      </div>

      {/* Current status */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Custodian</span>
          <span className="font-medium">{computer.custodian?.displayName || 'Admin'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Site</span>
          <span className="font-medium">{computer.site?.name || '—'}</span>
        </div>
      </div>

      {/* Transfer action */}
      <div className="mb-6">
        <TransferAction
          objectType="Computer"
          objectId={computer.id}
          userId={user.id}
          userName={user.displayName}
          currentCustodian={computer.custodian}
          currentSite={computer.site}
          onDone={loadComputer}
        />
      </div>

      <div className="space-y-3 mb-6">
        <ReportIssueAction objectType="Computer" objectId={computer.id} />
        <AddPhotoAction objectType="Computer" objectId={computer.id} onDone={loadComputer} />
      </div>

      <div className="text-center">
        <Link to={`/computers/${id}`} className="text-sm text-primary hover:underline">
          View full details
        </Link>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';

interface QrInfo {
  type: string;
  id: number;
  name: string;
  qrDataUrl?: string;
}

export default function QrLanding() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [info, setInfo] = useState<QrInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const isKit = location.pathname.startsWith('/k/');
  const isComputer = location.pathname.startsWith('/c/');
  const typePrefix = isKit ? 'k' : isComputer ? 'c' : 'p';
  const detailPath = isKit ? `/kits/${id}` : isComputer ? `/computers/${id}` : `/packs/${id}`;

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (r.ok) {
          navigate(detailPath, { replace: true });
        } else {
          setCheckingAuth(false);
        }
      })
      .catch(() => setCheckingAuth(false));
  }, [navigate, detailPath]);

  useEffect(() => {
    if (checkingAuth) return;
    fetch(`/api/qr/${typePrefix}/${id}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => { if (data) setInfo(data); })
      .catch(() => setNotFound(true));
  }, [id, typePrefix, checkingAuth]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Not Found</h1>
          <p className="text-gray-500">This QR code does not match any inventory item.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-sm w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">LAP Inventory</h1>
        {info && (
          <div className="bg-white border border-gray-200 rounded-xl p-8">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{info.type}</p>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{info.name}</h2>
            <p className="text-gray-500 text-sm mb-6">Sign in to view full details.</p>
            <a
              href="/api/auth/google"
              className="inline-block px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium no-underline hover:bg-primary-hover transition-colors"
            >
              Sign in with Google
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

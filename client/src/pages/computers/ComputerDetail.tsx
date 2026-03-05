import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';

interface ComputerData {
  id: number;
  serialNumber: string | null;
  serviceTag: string | null;
  model: string | null;
  defaultUsername: string | null;
  defaultPassword: string | null;
  disposition: string;
  dateReceived: string | null;
  lastInventoried: string | null;
  notes: string | null;
  qrCode: string | null;
  hostName: { id: number; name: string } | null;
  site: { id: number; name: string } | null;
  kit: { id: number; name: string } | null;
}

const DISPOSITIONS = [
  'ACTIVE', 'LOANED', 'NEEDS_REPAIR', 'IN_REPAIR',
  'SCRAPPED', 'LOST', 'DECOMMISSIONED',
];

function dispositionClasses(d: string): string {
  switch (d) {
    case 'ACTIVE': return 'bg-green-100 text-green-700';
    case 'LOANED': return 'bg-blue-100 text-blue-700';
    case 'NEEDS_REPAIR': return 'bg-amber-100 text-amber-700';
    case 'IN_REPAIR': return 'bg-orange-100 text-orange-700';
    case 'SCRAPPED': return 'bg-gray-100 text-gray-600';
    case 'LOST': return 'bg-red-100 text-red-700';
    case 'DECOMMISSIONED': return 'bg-gray-100 text-gray-500';
    default: return 'bg-gray-100 text-gray-600';
  }
}

export default function ComputerDetailPage() {
  const { id } = useParams();
  const [computer, setComputer] = useState<ComputerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/computers/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Computer not found');
        return r.json();
      })
      .then(setComputer)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    fetch(`/api/qr/c/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.qrDataUrl) setQrDataUrl(data.qrDataUrl); })
      .catch(() => {});
  }, [id]);

  async function handleDispositionChange(disposition: string) {
    const res = await fetch(`/api/computers/${id}/disposition`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disposition }),
    });
    if (res.ok) {
      const updated = await res.json();
      setComputer((prev) => prev ? { ...prev, disposition: updated.disposition } : prev);
    }
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!computer) return null;

  const displayName = computer.hostName?.name || computer.model || `Computer #${computer.id}`;

  const fields = [
    { label: 'Host Name', value: computer.hostName?.name },
    { label: 'Model', value: computer.model },
    { label: 'Serial Number', value: computer.serialNumber },
    { label: 'Service Tag', value: computer.serviceTag },
    { label: 'Default Username', value: computer.defaultUsername },
    { label: 'Default Password', value: computer.defaultPassword },
    { label: 'Site', value: computer.site?.name, link: '/sites' },
    { label: 'Kit', value: computer.kit?.name, link: computer.kit ? `/kits/${computer.kit.id}` : undefined },
    { label: 'Date Received', value: computer.dateReceived ? new Date(computer.dateReceived).toLocaleDateString() : null },
    { label: 'Last Inventoried', value: computer.lastInventoried ? new Date(computer.lastInventoried).toLocaleDateString() : null },
    { label: 'Notes', value: computer.notes },
  ];

  return (
    <div className="max-w-3xl">
      <Link to="/computers" className="text-sm text-primary hover:underline">
        &larr; Back to Computers
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${dispositionClasses(computer.disposition)}`}>
            {computer.disposition.replace(/_/g, ' ')}
          </span>
        </div>
        <Link
          to={`/computers/${computer.id}/edit`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-white no-underline hover:bg-primary-hover"
        >
          <Pencil size={14} /> Edit
        </Link>
      </div>

      {qrDataUrl && (
        <div className="flex items-center gap-4 mb-6 p-4 bg-white border border-gray-200 rounded-lg">
          <img src={qrDataUrl} alt="QR Code" className="w-24 h-24" />
          <code className="text-xs text-gray-500">{computer.qrCode}</code>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8">
        <table className="w-full text-sm">
          <tbody>
            {fields.map((f) => (
              <tr key={f.label} className="border-b border-gray-100 last:border-b-0">
                <td className="px-4 py-3 font-medium text-gray-500 w-[35%]">{f.label}</td>
                <td className="px-4 py-3 text-gray-900">
                  {f.link && f.value ? (
                    <Link to={f.link} className="text-primary hover:underline">{f.value}</Link>
                  ) : (
                    f.value || <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Change Disposition</h3>
        <div className="flex flex-wrap gap-2">
          {DISPOSITIONS.map((d) => (
            <button
              key={d}
              className={`text-xs px-3 py-1.5 rounded-lg border-none cursor-pointer font-medium transition-colors ${
                d === computer.disposition
                  ? dispositionClasses(d)
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              onClick={() => handleDispositionChange(d)}
              disabled={d === computer.disposition}
            >
              {d.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

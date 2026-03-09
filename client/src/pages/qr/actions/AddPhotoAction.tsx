import { useState, useRef } from 'react';
import { Camera } from 'lucide-react';

interface Props {
  objectType: 'Kit' | 'Computer' | 'Pack';
  objectId: number;
  onDone: () => void;
}

export default function AddPhotoAction({ objectType, objectId, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('objectType', objectType);
      formData.append('objectId', String(objectId));
      const res = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(data.error || 'Upload failed');
      }
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onDone(); }, 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (success) {
    return (
      <div className="w-full py-3 rounded-xl bg-green-100 text-green-700 text-center font-medium text-sm">
        Photo added
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold border border-gray-200 cursor-pointer hover:bg-gray-200 disabled:opacity-50"
      >
        <Camera size={16} />
        {busy ? 'Uploading...' : 'Add Photo'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      {error && <p className="text-red-600 text-sm mt-2 text-center">{error}</p>}
    </div>
  );
}

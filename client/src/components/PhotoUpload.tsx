import { useState, useRef } from 'react';
import { Camera, Trash2, Upload, Link as LinkIcon } from 'lucide-react';

interface PhotoUploadProps {
  objectType: 'Computer' | 'Kit' | 'Pack';
  objectId: number;
  imageId: number | null;
  onUpdate: () => void;
  compact?: boolean;
}

export default function PhotoUpload({ objectType, objectId, imageId, onUpdate, compact }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
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
      onUpdate();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleLinkUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!urlValue.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch('/api/images/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlValue.trim(), objectType, objectId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Link failed' }));
        throw new Error(data.error || 'Link failed');
      }
      setUrlValue('');
      setShowUrlInput(false);
      onUpdate();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!imageId || !confirm('Remove this photo?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/images/${imageId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(data.error || 'Delete failed');
      }
      onUpdate();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2">
        {imageId ? (
          <>
            <img
              src={`/api/images/${imageId}`}
              alt={`${objectType} photo`}
              className="w-8 h-8 rounded object-cover border border-gray-200"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0.5"
              title="Replace photo"
            >
              <Upload size={12} />
            </button>
            <button
              onClick={handleDelete}
              className="text-gray-400 hover:text-red-600 bg-transparent border-none cursor-pointer p-0.5"
              title="Remove photo"
            >
              <Trash2 size={12} />
            </button>
          </>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded text-gray-500 bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            title="Add photo"
          >
            <Camera size={12} />
            {uploading ? 'Uploading...' : 'Photo'}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        {error && <span className="text-red-600 text-xs">{error}</span>}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Camera size={16} className="text-gray-400" />
        Photo
      </h2>
      {imageId ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <img
            src={`/api/images/${imageId}`}
            alt={`${objectType} photo`}
            className="w-full max-h-80 object-contain bg-gray-50"
          />
          <div className="flex gap-2 p-2 border-t border-gray-100">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-700 border-none cursor-pointer hover:bg-gray-200 disabled:opacity-50"
            >
              <Upload size={12} />
              {uploading ? 'Uploading...' : 'Replace'}
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-red-50 text-red-700 border-none cursor-pointer hover:bg-red-100"
            >
              <Trash2 size={12} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex-1 flex flex-col items-center gap-2 py-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 cursor-pointer hover:border-gray-400 hover:text-gray-500 bg-transparent disabled:opacity-50"
            >
              <Camera size={28} />
              <span className="text-sm">{uploading ? 'Uploading...' : 'Upload Photo'}</span>
            </button>
            <button
              onClick={() => setShowUrlInput(!showUrlInput)}
              disabled={uploading}
              className="flex flex-col items-center gap-2 py-6 px-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 cursor-pointer hover:border-gray-400 hover:text-gray-500 bg-transparent disabled:opacity-50"
            >
              <LinkIcon size={28} />
              <span className="text-sm">Link URL</span>
            </button>
          </div>
          {showUrlInput && (
            <form onSubmit={handleLinkUrl} className="flex gap-2 mt-2">
              <input
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md"
                required
              />
              <button
                type="submit"
                disabled={uploading || !urlValue.trim()}
                className="px-3 py-1.5 text-sm bg-primary text-white rounded-md border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
              >
                {uploading ? 'Linking...' : 'Link'}
              </button>
              <button
                type="button"
                onClick={() => { setShowUrlInput(false); setUrlValue(''); }}
                className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-md border-none cursor-pointer hover:bg-gray-200"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}

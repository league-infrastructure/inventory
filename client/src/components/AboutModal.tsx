import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function AboutModal({ onClose }: Props) {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    fetch('/api/admin/env')
      .then((r) => r.json())
      .then((d) => setVersion(d.version ?? ''))
      .catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 z-10">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
          onClick={onClose}
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <img
            src="https://images.jointheleague.org/logos/clearRobotRing4.png"
            alt="League Robot"
            className="w-20 h-20 mb-4"
          />
          <h2 className="text-lg font-bold text-gray-900 mb-1">Inventory</h2>
          {version && <p className="text-xs text-gray-400 mb-1">v{version}</p>}
          <p className="text-sm text-gray-500 mb-4">
            The League administration application
          </p>

          <div className="text-sm text-gray-700 space-y-1 mb-4">
            <p>Built by <strong>Eric Busboom</strong></p>
            <p className="text-gray-500">March 2026</p>
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p>
              <a href="mailto:eric.busboom@jointheleague.org" className="text-primary hover:text-primary-hover no-underline">
                eric.busboom@jointheleague.org
              </a>
            </p>
            <p>
              <a href="mailto:eric@busboom.org" className="text-primary hover:text-primary-hover no-underline">
                eric@busboom.org
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

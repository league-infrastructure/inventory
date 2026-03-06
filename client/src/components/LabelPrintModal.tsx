import { useState } from 'react';
import { Printer, X } from 'lucide-react';

interface Pack {
  id: number;
  name: string;
}

interface Props {
  kitId: number;
  kitName: string;
  packs: Pack[];
  onClose: () => void;
}

export default function LabelPrintModal({ kitId, kitName, packs, onClose }: Props) {
  const [includeKit, setIncludeKit] = useState(true);
  const [selectedPacks, setSelectedPacks] = useState<Set<number>>(new Set(packs.map((p) => p.id)));
  const [generating, setGenerating] = useState(false);

  function selectAll() {
    setIncludeKit(true);
    setSelectedPacks(new Set(packs.map((p) => p.id)));
  }

  function clearAll() {
    setIncludeKit(false);
    setSelectedPacks(new Set());
  }

  function togglePack(packId: number) {
    setSelectedPacks((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) {
        next.delete(packId);
      } else {
        next.add(packId);
      }
      return next;
    });
  }

  async function handlePrint() {
    setGenerating(true);
    try {
      const packIds = Array.from(selectedPacks);
      const res = await fetch(`/api/labels/kit/${kitId}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packIds }),
      });
      if (!res.ok) throw new Error('Failed to generate labels');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } catch (e) {
      console.error('Label generation failed:', e);
    }
    setGenerating(false);
  }

  const totalSelected = (includeKit ? 1 : 0) + selectedPacks.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Print Labels</h2>
          <button
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            className="px-3 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700 border-none cursor-pointer hover:bg-gray-200"
            onClick={selectAll}
          >
            Select All
          </button>
          <button
            className="px-3 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700 border-none cursor-pointer hover:bg-gray-200"
            onClick={clearAll}
          >
            Clear All
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
          <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={includeKit}
              onChange={() => setIncludeKit(!includeKit)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-900">Kit #{kitName} (kit label)</span>
          </label>

          {packs.map((pack) => (
            <label key={pack.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPacks.has(pack.id)}
                onChange={() => togglePack(pack.id)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">{pack.name}</span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <span className="text-sm text-gray-500">{totalSelected} label{totalSelected !== 1 ? 's' : ''} selected</span>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-500 text-white border-none cursor-pointer hover:bg-gray-600"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
              onClick={handlePrint}
              disabled={generating || totalSelected === 0}
            >
              <Printer size={14} />
              {generating ? 'Generating...' : 'Print'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

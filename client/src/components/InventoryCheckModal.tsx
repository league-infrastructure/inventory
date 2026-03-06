import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface Item {
  id: number;
  name: string;
  type: string;
  expectedQuantity: number | null;
}

interface Pack {
  id: number;
  name: string;
  description: string | null;
  items: Item[];
}

interface Computer {
  id: number;
  serialNumber: string | null;
  model: string | null;
  hostName: { name: string } | null;
}

interface CheckLine {
  id: number;
  objectType: string;
  objectId: number;
  expectedValue: string | null;
  actualValue: string | null;
  hasDiscrepancy: boolean;
}

interface InventoryCheck {
  id: number;
  kitId: number | null;
  userId: number;
  notes: string | null;
  createdAt: string;
  user: { id: number; displayName: string };
  lines: CheckLine[];
  discrepancyCount?: number;
}

interface Props {
  kitId: number;
  kitName: string;
  onClose: () => void;
  onComplete: () => void;
}

export default function InventoryCheckModal({ kitId, kitName, onClose, onComplete }: Props) {
  const [loading, setLoading] = useState(true);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [computers, setComputers] = useState<Computer[]>([]);
  const [activeCheck, setActiveCheck] = useState<InventoryCheck | null>(null);
  const [lineValues, setLineValues] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InventoryCheck | null>(null);

  useEffect(() => {
    // Fetch kit detail and start the check
    Promise.all([
      fetch(`/api/kits/${kitId}`).then((r) => r.json()),
      fetch(`/api/inventory-checks/kit/${kitId}`, { method: 'POST' }).then((r) => {
        if (!r.ok) throw new Error('Failed to start check');
        return r.json();
      }),
    ])
      .then(([kit, check]: [any, InventoryCheck]) => {
        setPacks(kit.packs || []);
        setComputers(kit.computers || []);
        setActiveCheck(check);
        const values: Record<number, string> = {};
        for (const line of check.lines) {
          values[line.id] = line.expectedValue || '';
        }
        setLineValues(values);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [kitId]);

  // Build lookup maps
  const itemMap = new Map<number, { item: Item; packName: string }>();
  for (const pack of packs) {
    for (const item of pack.items) {
      itemMap.set(item.id, { item, packName: pack.name });
    }
  }
  const computerMap = new Map<number, Computer>();
  for (const c of computers) {
    computerMap.set(c.id, c);
  }

  async function submitCheck() {
    if (!activeCheck) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory-checks/${activeCheck.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notes || null,
          lines: Object.entries(lineValues).map(([id, actualValue]) => ({
            id: parseInt(id, 10),
            actualValue,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit check');
      }
      const checkResult: InventoryCheck = await res.json();
      setResult(checkResult);
    } catch (e: any) {
      setError(e.message);
    }
    setSubmitting(false);
  }

  function handleDone() {
    onComplete();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Inventory Check — {kitName}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && <p className="text-sm text-gray-500">Starting inventory check...</p>}
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

          {/* Check form */}
          {activeCheck && !result && (
            <>
              {packs.filter((p) => p.items.length > 0).map((pack) => {
                const packLines = activeCheck.lines.filter(
                  (l) => l.objectType === 'Item' && pack.items.some((i) => i.id === l.objectId)
                );
                if (packLines.length === 0) return null;
                return (
                  <div key={pack.id} className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">{pack.name}</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-500">Item</th>
                          <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-500 w-24">Expected</th>
                          <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-500 w-28">Actual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packLines.map((line) => {
                          const info = itemMap.get(line.objectId);
                          const isCounted = info?.item.type === 'COUNTED';
                          return (
                            <tr key={line.id} className="border-b border-gray-100">
                              <td className="py-1.5 px-2">{info?.item.name || `Item #${line.objectId}`}</td>
                              <td className="py-1.5 px-2 text-gray-500">{line.expectedValue}</td>
                              <td className="py-1.5 px-2">
                                {isCounted ? (
                                  <input
                                    type="number"
                                    min={0}
                                    value={lineValues[line.id] || ''}
                                    onChange={(e) => setLineValues((prev) => ({ ...prev, [line.id]: e.target.value }))}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                ) : (
                                  <select
                                    value={lineValues[line.id] || ''}
                                    onChange={(e) => setLineValues((prev) => ({ ...prev, [line.id]: e.target.value }))}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                  >
                                    <option value="present">Present</option>
                                    <option value="absent">Absent</option>
                                  </select>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}

              {activeCheck.lines.filter((l) => l.objectType === 'Computer').length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Computers</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-500">Computer</th>
                        <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-500 w-28">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCheck.lines.filter((l) => l.objectType === 'Computer').map((line) => {
                        const comp = computerMap.get(line.objectId);
                        return (
                          <tr key={line.id} className="border-b border-gray-100">
                            <td className="py-1.5 px-2">{comp?.hostName?.name || comp?.model || `Computer #${line.objectId}`}</td>
                            <td className="py-1.5 px-2">
                              <select
                                value={lineValues[line.id] || ''}
                                onChange={(e) => setLineValues((prev) => ({ ...prev, [line.id]: e.target.value }))}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                              >
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Add any notes about this check..."
                />
              </div>
            </>
          )}

          {/* Result */}
          {result && (
            <div className={`border rounded-lg p-4 ${result.discrepancyCount ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                {result.discrepancyCount ? (
                  <>
                    <AlertTriangle size={16} className="text-amber-600" />
                    <span className="text-sm font-medium text-amber-700">
                      {result.discrepancyCount} discrepanc{result.discrepancyCount === 1 ? 'y' : 'ies'} found
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-medium text-green-700">All items accounted for</span>
                )}
              </div>
              {result.lines.filter((l) => l.hasDiscrepancy).map((line) => {
                const info = line.objectType === 'Item' ? itemMap.get(line.objectId) : null;
                const comp = line.objectType === 'Computer' ? computerMap.get(line.objectId) : null;
                const name = info?.item.name || comp?.hostName?.name || comp?.model || `${line.objectType} #${line.objectId}`;
                return (
                  <p key={line.id} className="text-sm text-amber-800 ml-6">
                    <strong>{name}</strong>: expected {line.expectedValue}, found {line.actualValue}
                  </p>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
          {!result ? (
            <>
              <button
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 border-none cursor-pointer hover:bg-gray-200"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
                onClick={submitCheck}
                disabled={submitting || loading}
              >
                {submitting ? 'Submitting...' : 'Submit Check'}
              </button>
            </>
          ) : (
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover"
              onClick={handleDone}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

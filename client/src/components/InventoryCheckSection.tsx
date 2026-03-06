import { useState, useEffect } from 'react';
import { ClipboardCheck, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

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
  packs: Pack[];
  computers: Computer[];
}

export default function InventoryCheckSection({ kitId, packs, computers }: Props) {
  const [checking, setChecking] = useState(false);
  const [activeCheck, setActiveCheck] = useState<InventoryCheck | null>(null);
  const [lineValues, setLineValues] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<InventoryCheck[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/inventory-checks/history/kit/${kitId}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setHistory)
      .catch(() => {});
  }, [kitId, submitted]);

  async function startCheck() {
    setError(null);
    setChecking(true);
    try {
      const res = await fetch(`/api/inventory-checks/kit/${kitId}`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start check');
      }
      const check: InventoryCheck = await res.json();
      setActiveCheck(check);
      // Pre-fill with expected values
      const values: Record<number, string> = {};
      for (const line of check.lines) {
        values[line.id] = line.expectedValue || '';
      }
      setLineValues(values);
      setNotes('');
      setSubmitted(false);
    } catch (e: any) {
      setError(e.message);
      setChecking(false);
    }
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
      const result: InventoryCheck = await res.json();
      setActiveCheck(result);
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    }
    setSubmitting(false);
  }

  function cancelCheck() {
    setChecking(false);
    setActiveCheck(null);
    setSubmitted(false);
  }

  function closeCheck() {
    setChecking(false);
    setActiveCheck(null);
    setSubmitted(false);
  }

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

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Inventory Check</h2>
        {!checking && (
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover"
            onClick={startCheck}
          >
            <ClipboardCheck size={14} /> Start Check
          </button>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {checking && activeCheck && !submitted && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {/* Group items by pack */}
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

          {/* Computers */}
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

          {/* Notes */}
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

          <div className="flex gap-2">
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
              onClick={submitCheck}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Check'}
            </button>
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-500 text-white border-none cursor-pointer hover:bg-gray-600"
              onClick={cancelCheck}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Submitted result */}
      {submitted && activeCheck && (
        <div className={`border rounded-lg p-4 ${activeCheck.discrepancyCount ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            {activeCheck.discrepancyCount ? (
              <>
                <AlertTriangle size={16} className="text-amber-600" />
                <span className="text-sm font-medium text-amber-700">
                  {activeCheck.discrepancyCount} discrepanc{activeCheck.discrepancyCount === 1 ? 'y' : 'ies'} found
                </span>
              </>
            ) : (
              <span className="text-sm font-medium text-green-700">All items accounted for</span>
            )}
          </div>
          {activeCheck.lines.filter((l) => l.hasDiscrepancy).map((line) => {
            const info = line.objectType === 'Item' ? itemMap.get(line.objectId) : null;
            const comp = line.objectType === 'Computer' ? computerMap.get(line.objectId) : null;
            const name = info?.item.name || comp?.hostName?.name || comp?.model || `${line.objectType} #${line.objectId}`;
            return (
              <p key={line.id} className="text-sm text-amber-800 ml-6">
                <strong>{name}</strong>: expected {line.expectedValue}, found {line.actualValue}
              </p>
            );
          })}
          <button
            className="mt-3 px-4 py-2 text-sm font-medium rounded-lg bg-gray-500 text-white border-none cursor-pointer hover:bg-gray-600"
            onClick={closeCheck}
          >
            Close
          </button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-4">
          <button
            className="flex items-center gap-1 text-sm font-semibold text-gray-700 bg-transparent border-none cursor-pointer hover:text-gray-900"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Check History ({history.length})
          </button>
          {showHistory && (
            <div className="mt-2 bg-white border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Date</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">User</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Discrepancies</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((check) => (
                    <tr key={check.id} className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-600">
                        {new Date(check.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2">{check.user.displayName}</td>
                      <td className="px-4 py-2">
                        {check.discrepancyCount ? (
                          <span className="text-amber-600 font-medium">{check.discrepancyCount}</span>
                        ) : (
                          <span className="text-green-600">None</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{check.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

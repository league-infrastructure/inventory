import { useState } from 'react';
import { Download, Upload, FileSpreadsheet, Check, X } from 'lucide-react';

interface ImportDiffRow {
  sheet: string;
  id: number | null;
  action: 'create' | 'update' | 'skip';
  fields: { field: string; oldValue: string | null; newValue: string | null }[];
  name: string;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export default function ImportExport() {
  const [diffs, setDiffs] = useState<ImportDiffRow[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    const res = await fetch('/api/export');
    if (!res.ok) {
      setError('Export failed');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-export-${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import/preview', { method: 'POST', body: formData });
      if (!res.ok) {
        setError('Failed to parse file');
        return;
      }
      const data = await res.json();
      setDiffs(data);
    } catch {
      setError('Failed to upload file');
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!diffs) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/import/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diffs }),
      });
      if (!res.ok) {
        setError('Import failed');
        return;
      }
      const data = await res.json();
      setResult(data);
      setDiffs(null);
    } catch {
      setError('Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Import &amp; Export</h1>

      {/* Export section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Download className="text-primary" size={24} />
          <h2 className="text-lg font-semibold">Export Inventory</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Download a complete Excel spreadsheet of all sites, kits, packs, items, and computers.
        </p>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
        >
          <FileSpreadsheet size={16} />
          Download Excel
        </button>
      </div>

      {/* Import section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Upload className="text-primary" size={24} />
          <h2 className="text-lg font-semibold">Import from Excel</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Upload a modified Excel file to preview and apply changes to kits and items.
        </p>

        <input
          type="file"
          accept=".xlsx"
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover"
        />

        {loading && <p className="mt-4 text-sm text-gray-500">Processing...</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {/* Diff preview */}
        {diffs && diffs.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2">Preview Changes ({diffs.length} rows)</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Sheet</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Action</th>
                    <th className="px-3 py-2 text-left">Fields</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {diffs.map((d, i) => (
                    <tr key={i} className={d.action === 'skip' ? 'bg-gray-50 text-gray-400' : ''}>
                      <td className="px-3 py-2">{d.sheet}</td>
                      <td className="px-3 py-2">{d.name}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          d.action === 'create' ? 'bg-green-100 text-green-800' :
                          d.action === 'update' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {d.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {d.fields.map(f => f.field).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleApply}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Check size={16} />
                Apply Changes
              </button>
              <button
                onClick={() => setDiffs(null)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                <X size={16} />
                Cancel
              </button>
            </div>
          </div>
        )}

        {diffs && diffs.length === 0 && (
          <p className="mt-4 text-sm text-gray-500">No changes detected in the uploaded file.</p>
        )}

        {/* Import result */}
        {result && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-sm font-semibold text-green-800 mb-2">Import Complete</h3>
            <p className="text-sm text-green-700">
              Created: {result.created} | Updated: {result.updated} | Skipped: {result.skipped}
            </p>
            {result.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-red-700">Errors:</p>
                <ul className="text-sm text-red-600 list-disc list-inside">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

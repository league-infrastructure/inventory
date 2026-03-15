import { useState, useEffect } from 'react';
import { Download, Upload, FileSpreadsheet, FileJson, Check, X, Database, Trash2, RotateCcw, HardDrive, Cloud } from 'lucide-react';

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

interface BackupInfo {
  filename: string;
  size: number;
  createdAt: string;
  location: 'local' | 's3' | 'both';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportExport() {
  const [diffs, setDiffs] = useState<ImportDiffRow[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CSV computer import state
  const [csvResult, setCsvResult] = useState<ImportResult | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Backup state
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  useEffect(() => { loadBackups(); }, []);

  async function loadBackups() {
    try {
      const res = await fetch('/api/admin/backups');
      if (res.ok) setBackups(await res.json());
    } catch { /* ignore */ }
  }

  async function handleExcelExport() {
    const res = await fetch('/api/export');
    if (!res.ok) { setError('Export failed'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-export-${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleJsonExport() {
    const res = await fetch('/api/export/json');
    if (!res.ok) { setError('Export failed'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-export-${new Date().toISOString().split('T')[0]}.json`;
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
      if (!res.ok) { setError('Failed to parse file'); return; }
      setDiffs(await res.json());
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
      if (!res.ok) { setError('Import failed'); return; }
      setResult(await res.json());
      setDiffs(null);
    } catch {
      setError('Import failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBackup() {
    setBackupLoading(true);
    setBackupError(null);
    setBackupMessage(null);
    try {
      const res = await fetch('/api/admin/backups', { method: 'POST' });
      if (!res.ok) throw new Error('Backup failed');
      const info = await res.json();
      setBackupMessage(`Backup created: ${info.filename} (${formatBytes(info.size)})`);
      loadBackups();
    } catch (e: any) {
      setBackupError(e.message);
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestore(filename: string) {
    if (confirmRestore !== filename) {
      setConfirmRestore(filename);
      return;
    }
    setBackupLoading(true);
    setBackupError(null);
    setConfirmRestore(null);
    try {
      const res = await fetch('/api/admin/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      if (!res.ok) throw new Error('Restore failed');
      setBackupMessage(`Database restored from ${filename}`);
    } catch (e: any) {
      setBackupError(e.message);
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleDeleteBackup(filename: string) {
    try {
      const res = await fetch(`/api/admin/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (res.ok) loadBackups();
    } catch { /* ignore */ }
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
          Download a complete inventory dump in Excel or JSON format.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleExcelExport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
          >
            <FileSpreadsheet size={16} />
            Download Excel
          </button>
          <button
            onClick={handleJsonExport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
          >
            <FileJson size={16} />
            Download JSON
          </button>
        </div>
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

      {/* CSV Computer Import section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Upload className="text-primary" size={24} />
          <h2 className="text-lg font-semibold">Import Computers from CSV</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Upload a CSV file with the same columns as the Computers sheet in the Excel export.
          Rows with an ID column will update existing computers; rows without an ID will create new ones.
        </p>

        <input
          type="file"
          accept=".csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setCsvError(null);
            setCsvResult(null);
            setCsvLoading(true);
            const formData = new FormData();
            formData.append('file', file);
            try {
              const res = await fetch('/api/import/computers-csv', { method: 'POST', body: formData });
              if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Import failed');
              }
              setCsvResult(await res.json());
            } catch (err: any) {
              setCsvError(err.message);
            } finally {
              setCsvLoading(false);
              e.target.value = '';
            }
          }}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover"
        />

        {csvLoading && <p className="mt-4 text-sm text-gray-500">Importing...</p>}
        {csvError && <p className="mt-4 text-sm text-red-600">{csvError}</p>}

        {csvResult && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-sm font-semibold text-green-800 mb-2">Import Complete</h3>
            <p className="text-sm text-green-700">
              Created: {csvResult.created} | Updated: {csvResult.updated} | Skipped: {csvResult.skipped}
            </p>
            {csvResult.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-red-700">Errors:</p>
                <ul className="text-sm text-red-600 list-disc list-inside">
                  {csvResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Database backup section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="text-primary" size={24} />
          <h2 className="text-lg font-semibold">Database Backup</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Create and manage PostgreSQL database backups using pg_dump.
        </p>

        <button
          onClick={handleCreateBackup}
          disabled={backupLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
        >
          <Database size={16} />
          {backupLoading ? 'Creating...' : 'Create Backup'}
        </button>

        {backupError && <p className="mt-3 text-sm text-red-600">{backupError}</p>}
        {backupMessage && <p className="mt-3 text-sm text-green-600">{backupMessage}</p>}

        {backups.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2">Backups ({backups.length})</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Filename</th>
                    <th className="px-3 py-2 text-left">Size</th>
                    <th className="px-3 py-2 text-left">Created</th>
                    <th className="px-3 py-2 text-center" title="Local"><HardDrive size={14} className="inline text-gray-400" /></th>
                    <th className="px-3 py-2 text-center" title="S3"><Cloud size={14} className="inline text-gray-400" /></th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {backups.map((b) => (
                    <tr key={b.filename}>
                      <td className="px-3 py-2 font-mono text-xs">{b.filename}</td>
                      <td className="px-3 py-2 text-gray-500">{formatBytes(b.size)}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{new Date(b.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 text-center">
                        {(b.location === 'local' || b.location === 'both') ? (
                          <Check size={14} className="inline text-green-500" />
                        ) : (
                          <X size={14} className="inline text-gray-300" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {(b.location === 's3' || b.location === 'both') ? (
                          <Check size={14} className="inline text-green-500" />
                        ) : (
                          <X size={14} className="inline text-gray-300" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRestore(b.filename)}
                            disabled={backupLoading}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border cursor-pointer disabled:opacity-50 ${
                              confirmRestore === b.filename
                                ? 'bg-red-100 text-red-700 border-red-300'
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            <RotateCcw size={12} />
                            {confirmRestore === b.filename ? 'Confirm?' : 'Restore'}
                          </button>
                          <div className="w-8">
                            {!b.filename.startsWith('daily-') && !b.filename.startsWith('weekly-') && (
                              <button
                                onClick={() => handleDeleteBackup(b.filename)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-gray-50 text-gray-500 border border-gray-200 cursor-pointer hover:bg-gray-100"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {backups.length === 0 && !backupLoading && (
          <p className="mt-4 text-sm text-gray-500">No backups found.</p>
        )}
      </div>
    </div>
  );
}

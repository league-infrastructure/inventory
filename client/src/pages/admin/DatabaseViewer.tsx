import { useEffect, useState } from 'react';

interface TableMeta { name: string; rowCount: number; }
interface Column { name: string; type: string; nullable: boolean; }
interface TableData { columns: Column[]; rows: Record<string, unknown>[]; total: number; page: number; limit: number; }

function CellValue({ value }: { value: unknown }) {
  if (value === null) return <span className="text-gray-400 italic">null</span>;
  if (typeof value === 'object') {
    return (
      <details>
        <summary className="cursor-pointer text-gray-500 text-xs">JSON</summary>
        <pre className="text-xs max-w-sm overflow-auto mt-1">{JSON.stringify(value, null, 2)}</pre>
      </details>
    );
  }
  return <>{String(value)}</>;
}

export default function DatabaseViewer() {
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/db/tables')
      .then((r) => r.json())
      .then(setTables)
      .catch(() => setError('Failed to load tables'));
  }, []);

  useEffect(() => {
    if (!selected) { setTableData(null); return; }
    setLoading(true);
    fetch(`/api/admin/db/tables/${encodeURIComponent(selected)}?page=${page}&limit=20`)
      .then((r) => r.json())
      .then((d) => { setTableData(d); setLoading(false); })
      .catch(() => { setError('Failed to load table data'); setLoading(false); });
  }, [selected, page]);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  const totalPages = tableData ? Math.ceil(tableData.total / tableData.limit) : 0;

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Database</h1>

      <div className="flex gap-6">
        <div className="w-48 shrink-0">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tables</h3>
          {tables.map((t) => (
            <div
              key={t.name}
              onClick={() => { setSelected(t.name); setPage(1); }}
              className={`px-3 py-2 rounded-lg cursor-pointer text-sm mb-0.5 ${
                selected === t.name ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.name}
              <span className="text-gray-400 ml-1 text-xs">({t.rowCount})</span>
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0 overflow-auto">
          {!selected && <p className="text-gray-500 text-sm">Select a table to view its records.</p>}
          {selected && loading && <p className="text-gray-500 text-sm">Loading...</p>}
          {selected && tableData && (
            <>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{selected} ({tableData.total} rows)</h3>
              {tableData.rows.length === 0 ? (
                <p className="text-gray-500 text-sm">No records</p>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {tableData.columns.map((col) => (
                          <th key={col.name} className="text-left px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">
                            {col.name}
                            <span className="text-gray-400 ml-1 font-normal">{col.type}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.rows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          {tableData.columns.map((col) => (
                            <td key={col.name} className="px-3 py-1.5 align-top">
                              <CellValue value={row[col.name]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center gap-3 mt-3">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="px-3 py-1 text-sm rounded border border-gray-300 bg-white cursor-pointer disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    className="px-3 py-1 text-sm rounded border border-gray-300 bg-white cursor-pointer disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

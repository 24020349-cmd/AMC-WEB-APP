import { useEffect, useState } from 'react';

interface CsvEditorModalProps {
  isOpen: boolean;
  projectName: string;
  csvFile: string | null;
  onClose: () => void;
  onSaved: (headers: string[]) => void;
}

export function CsvEditorModal({ isOpen, projectName, csvFile, onClose, onSaved }: CsvEditorModalProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !projectName || !csvFile) return;
    setLoading(true);
    setError('');
    fetch(`http://localhost:8000/api/projects/${encodeURIComponent(projectName)}/csv?file=${encodeURIComponent(csvFile)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).detail || 'Unable to load CSV file');
        return response.json();
      })
      .then((data) => {
        setHeaders(data.headers || []);
        setRows(data.rows || []);
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [isOpen, projectName, csvFile]);

  if (!isOpen) return null;

  const updateHeader = (column: number, value: string) => setHeaders((current) => current.map((header, index) => index === column ? value : header));
  const updateCell = (row: number, column: number, value: string) => setRows((current) => current.map((item, rowIndex) => rowIndex === row ? item.map((cell, columnIndex) => columnIndex === column ? value : cell) : item));
  const addRow = () => setRows((current) => [...current, headers.map(() => '')]);
  const addColumn = () => {
    setHeaders((current) => [...current, `field_${current.length + 1}`]);
    setRows((current) => current.map((row) => [...row, '']));
  };
  const removeRow = (row: number) => setRows((current) => current.filter((_, index) => index !== row));

  const save = async () => {
    if (!csvFile) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(projectName)}/csv?file=${encodeURIComponent(csvFile)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers, rows }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Unable to save CSV file');
      onSaved(data.headers);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save CSV file');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="csv-editor-overlay" role="dialog" aria-modal="true" aria-label="Edit students list">
      <section className="csv-editor-modal">
        <header className="csv-editor-header">
          <div><strong>Edit students list</strong><span>{csvFile || ''}</span></div>
          <button className="btn" onClick={onClose}>Cancel</button>
        </header>
        {loading ? <div className="csv-editor-empty">Loading list…</div> : (
          <>
            {error && <div className="csv-editor-error">{error}</div>}
            <div className="csv-editor-table-wrap">
              <table className="csv-editor-table">
                <thead><tr>{headers.map((header, index) => <th key={index}><input value={header} onChange={(event) => updateHeader(index, event.target.value)} aria-label={`Column ${index + 1}`} /></th>)}<th></th></tr></thead>
                <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, columnIndex) => <td key={columnIndex}><input value={row[columnIndex] || ''} onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)} /></td>)}<td><button className="csv-remove-row" onClick={() => removeRow(rowIndex)} aria-label="Delete row">×</button></td></tr>)}</tbody>
              </table>
            </div>
            <footer className="csv-editor-footer">
              <div><button className="btn" onClick={addRow}>Add student</button><button className="btn" onClick={addColumn}>Add column</button></div>
              <button className="btn btn-primary" onClick={save} disabled={saving || headers.length === 0}>{saving ? 'Saving…' : 'Save'}</button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

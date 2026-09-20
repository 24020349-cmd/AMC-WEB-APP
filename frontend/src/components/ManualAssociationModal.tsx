import { useEffect, useState } from 'react';

interface Paper {
  student: number;
  page: number;
  copy: number;
  name_image: string | null;
  manual: string | null;
}

interface ManualAssociationModalProps {
  isOpen: boolean;
  projectName: string;
  csvFile: string | null;
  primaryKey: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function ManualAssociationModal({ isOpen, projectName, csvFile, primaryKey, onClose, onUpdated }: ManualAssociationModalProps) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [values, setValues] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen || !projectName || !csvFile || !primaryKey) return;
    setLoading(true);
    setSearchQuery('');
    fetch(`http://localhost:8000/api/projects/${encodeURIComponent(projectName)}/manual_association?file=${encodeURIComponent(csvFile)}&primary_key=${encodeURIComponent(primaryKey)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).detail || 'Unable to load manual association');
        return response.json();
      })
      .then((data) => {
        setPapers(data.papers || []);
        setValues(data.values || []);
        setSelectedIndex(0);
      })
      .catch((error) => alert(error.message))
      .finally(() => setLoading(false));
  }, [isOpen, projectName, csvFile, primaryKey]);

  if (!isOpen) return null;
  const selectedPaper = papers[selectedIndex];

  const filteredValues = values.filter((v) =>
    v.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredValues.length === 1) {
      saveValue(filteredValues[0]);
      setSearchQuery('');
    }
  };

  const saveValue = async (value: string | null, advance = true) => {
    if (!selectedPaper || !primaryKey) return;
    const response = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(projectName)}/manual_association`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student: selectedPaper.student,
        page: selectedPaper.page,
        copy: selectedPaper.copy,
        primary_key: primaryKey,
        value,
      }),
    });
    if (!response.ok) {
      alert('Could not save the manual association.');
      return;
    }
    setPapers((current) => current.map((paper, index) => index === selectedIndex ? { ...paper, manual: value } : paper));
    onUpdated();
    if (advance && selectedIndex < papers.length - 1) setSelectedIndex(selectedIndex + 1);
  };

  return (
    <div className="manual-association-overlay" role="dialog" aria-modal="true" aria-label="Manual association">
      <section className="manual-association-modal">
        <header className="manual-association-header">
          <strong>Manual association</strong>
          <button className="manual-quit-button" onClick={onClose}>Quit</button>
        </header>
        {!csvFile || !primaryKey ? (
          <div className="manual-association-empty">Choose a students list and primary key before starting manual association.</div>
        ) : loading ? (
          <div className="manual-association-empty">Loading scanned name fields…</div>
        ) : papers.length === 0 ? (
          <div className="manual-association-empty">No scanned name fields are available. Run data capture first.</div>
        ) : (
          <div className="manual-association-content">
            <div className="manual-association-left">
              <div className="sheet-title">Sheet {selectedIndex + 1}</div>
              <div className="namefield-preview">
                {selectedPaper?.name_image ? (
                  <img src={`http://localhost:8000/api/projects/${encodeURIComponent(projectName)}/manual_namefield?student=${selectedPaper.student}&page=${selectedPaper.page}&copy=${selectedPaper.copy}`} alt={`Name field for sheet ${selectedIndex + 1}`} />
                ) : <span>No name field image</span>}
              </div>
              <div className="manual-navigation">
                <button className="marking-button" onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))} disabled={selectedIndex === 0}>‹</button>
                <span>{selectedPaper?.student}/{selectedPaper?.page}</span>
                <button className="marking-button" onClick={() => setSelectedIndex(Math.min(papers.length - 1, selectedIndex + 1))} disabled={selectedIndex === papers.length - 1}>›</button>
              </div>
              <div className="manual-actions">
                <button className="marking-button" onClick={() => saveValue(null, false)} disabled={!selectedPaper?.manual}>Clear</button>
                <button className="marking-button" onClick={() => saveValue('Unknown')}><span>⊗</span>Unknown</button>
              </div>

              {/* Quick Search / Filter Bar */}
              <div style={{ margin: '8px 0', display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Tìm kiếm / Lọc nhanh học sinh..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    style={{
                      width: '100%',
                      padding: '5px 26px 5px 8px',
                      fontSize: 12,
                      border: '1px solid #aaa',
                      borderRadius: 4,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: 6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#888',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 'bold',
                        padding: 0,
                      }}
                      title="Xóa tìm kiếm"
                    >
                      ×
                    </button>
                  )}
                </div>
                <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>
                  {filteredValues.length}/{values.length}
                </span>
              </div>

              <div className="manual-value-grid">
                {filteredValues.map((value) => (
                  <button key={value} className={`manual-value ${selectedPaper?.manual === value ? 'selected' : ''}`} onClick={() => saveValue(value)}>
                    {value}
                  </button>
                ))}
                {filteredValues.length === 0 && (
                  <div style={{ fontSize: 12, color: '#888', padding: 8, fontStyle: 'italic', textAlign: 'center', gridColumn: '1 / -1' }}>
                    Không tìm thấy học sinh phù hợp
                  </div>
                )}
              </div>
            </div>
            <div className="manual-association-table-wrap">
              <table className="manual-association-table">
                <thead><tr><th>copy</th><th>auto</th><th>manual</th></tr></thead>
                <tbody>
                  {papers.map((paper, index) => (
                    <tr key={`${paper.student}-${paper.page}-${paper.copy}`} className={index === selectedIndex ? 'selected' : ''} onClick={() => setSelectedIndex(index)}>
                      <td>{paper.student}</td><td></td><td>{paper.manual || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

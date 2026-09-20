import React, { useState, useEffect } from 'react';
import '../index.css';

interface FailedScan {
  filename: string;
  scan: string;
  date: string;
  timestamp: number;
  has_preprocessed?: boolean;
}

interface UnrecognizedScansModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  onScanDeleted?: () => void;
}

export const UnrecognizedScansModal: React.FC<UnrecognizedScansModalProps> = ({
  isOpen,
  onClose,
  projectName,
  onScanDeleted
}) => {
  const [scans, setScans] = useState<FailedScan[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const [isListExpanded, setIsListExpanded] = useState(true);

  const fetchScans = () => {
    if (!projectName) return;
    setLoading(true);
    fetch(`http://localhost:8000/api/projects/${encodeURIComponent(projectName)}/unrecognized_scans`, {
      cache: 'no-store'
    })
      .then(res => res.json())
      .then(data => {
        const list = data.scans || [];
        setScans(list);
        if (list.length > 0 && selectedIndex >= list.length) {
          setSelectedIndex(list.length - 1);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching unrecognized scans:", err);
        setScans([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen && projectName) {
      setSelectedIndex(0);
      fetchScans();
    }
  }, [isOpen, projectName]);

  const selectedScan = scans.length > 0 && selectedIndex >= 0 && selectedIndex < scans.length ? scans[selectedIndex] : null;

  const handlePreprocess = async () => {
    if (!selectedScan || isPreprocessing || !projectName) return;
    setIsPreprocessing(true);
    try {
      const res = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(projectName)}/unrecognized_scan_preprocess?filename=${encodeURIComponent(selectedScan.filename)}`, {
        method: 'POST'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Preprocess failed");
      }
      const now = Date.now();
      setScans(prev => prev.map((s, idx) => idx === selectedIndex ? { ...s, has_preprocessed: true, timestamp: now } : s));
    } catch (err: any) {
      console.error("Error preprocessing scan:", err);
      alert("Lỗi khi tiền xử lý chẩn đoán trang scan: " + (err.message || err));
    } finally {
      setIsPreprocessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedScan || deleting) return;
    const confirmDelete = window.confirm(`Bạn có chắc chắn muốn xóa trang quét "${selectedScan.scan}" này không?`);
    if (!confirmDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(projectName)}/unrecognized_scan?filename=${encodeURIComponent(selectedScan.filename)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        throw new Error("Failed to delete scan");
      }
      
      const newScans = scans.filter((_, idx) => idx !== selectedIndex);
      setScans(newScans);
      if (selectedIndex >= newScans.length) {
        setSelectedIndex(Math.max(0, newScans.length - 1));
      }
      if (onScanDeleted) {
        onScanDeleted();
      }
    } catch (err) {
      console.error("Error deleting scan:", err);
      alert("Không thể xóa trang scan này. Vui lòng thử lại.");
    } finally {
      setDeleting(false);
    }
  };

  const handlePrev = () => {
    if (selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex < scans.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div 
        className="modal" 
        style={{ 
          width: selectedScan?.has_preprocessed ? '1100px' : '900px', 
          maxWidth: '96vw', 
          height: '88vh', 
          maxHeight: '88vh', 
          display: 'flex', 
          flexDirection: 'column',
          background: '#f8f9fa',
          transition: 'width 0.2s ease-in-out'
        }}
      >
        {/* Header */}
        <div 
          className="modal-header" 
          style={{ 
            padding: '10px 16px', 
            borderBottom: '1px solid var(--border-color)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: '#e5e7eb'
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '15px' }}>Unrecognized scans</span>
          <button 
            onClick={onClose} 
            className="btn-icon" 
            style={{ border: 'none', background: 'none', fontSize: '16px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 12, gap: 10 }}>
          {/* Section 1: Scans list */}
          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #d1d5db', borderRadius: 4, background: 'white' }}>
            <div 
              style={{ 
                padding: '6px 10px', 
                background: '#f3f4f6', 
                borderBottom: '1px solid #e5e7eb', 
                fontWeight: 600, 
                fontSize: 13, 
                display: 'flex', 
                alignItems: 'center', 
                cursor: 'pointer' 
              }}
              onClick={() => setIsListExpanded(!isListExpanded)}
            >
              <span style={{ marginRight: 6 }}>{isListExpanded ? '▾' : '▸'}</span>
              <span>Scans list</span>
              <span style={{ fontWeight: 'normal', color: '#6b7280', marginLeft: 8, fontSize: 12 }}>
                ({scans.length} {scans.length === 1 ? 'scan' : 'scans'})
              </span>
            </div>

            {isListExpanded && (
              <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#4b5563' }}>
                      <th style={{ padding: '6px 12px', fontWeight: 600 }}>scan</th>
                      <th style={{ padding: '6px 12px', fontWeight: 600, width: '180px' }}>date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={2} style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>
                          Đang tải danh sách trang lỗi...
                        </td>
                      </tr>
                    ) : scans.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>
                          Không có trang scan nào bị lỗi nhận diện.
                        </td>
                      </tr>
                    ) : (
                      scans.map((item, idx) => {
                        const isSelected = idx === selectedIndex;
                        return (
                          <tr
                            key={idx}
                            onClick={() => setSelectedIndex(idx)}
                            style={{
                              borderBottom: '1px solid #f3f4f6',
                              background: isSelected ? '#0078d4' : 'transparent',
                              color: isSelected ? 'white' : '#1f2937',
                              cursor: 'pointer',
                              userSelect: 'none'
                            }}
                          >
                            <td style={{ padding: '5px 12px', fontFamily: 'monospace', fontSize: '12px' }}>
                              {item.scan}
                              {item.has_preprocessed && (
                                <span style={{ marginLeft: 8, padding: '1px 6px', fontSize: 10, borderRadius: 3, background: isSelected ? '#22c55e' : '#e0f2fe', color: isSelected ? 'white' : '#0369a1' }}>
                                  preprocessed
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '5px 12px' }}>
                              {item.date}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action Bar between list and preview */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, alignItems: 'center' }}>
            <button
              className="btn"
              style={{ padding: '4px 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, cursor: (!selectedScan || isPreprocessing) ? 'not-allowed' : 'pointer' }}
              title="Preprocess (Tiền xử lý chẩn đoán hình ảnh)"
              disabled={!selectedScan || isPreprocessing}
              onClick={handlePreprocess}
            >
              {isPreprocessing ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                  <span style={{ fontSize: 12 }}>Đang chẩn đoán...</span>
                </>
              ) : (
                <>
                  ⚙
                  <span style={{ fontSize: 12 }}>Preprocess</span>
                </>
              )}
            </button>
            <button
              className="btn"
              style={{ padding: '4px 10px', fontSize: 13, color: '#dc2626' }}
              title="Xóa trang scan lỗi này"
              disabled={!selectedScan || deleting || isPreprocessing}
              onClick={handleDelete}
            >
              ⓧ
            </button>
            <button
              className="btn"
              style={{ padding: '4px 10px', fontSize: 13 }}
              title="Trang trước"
              disabled={selectedIndex <= 0}
              onClick={handlePrev}
            >
              ▲
            </button>
            <button
              className="btn"
              style={{ padding: '4px 10px', fontSize: 13 }}
              title="Trang tiếp theo"
              disabled={selectedIndex >= scans.length - 1}
              onClick={handleNext}
            >
              ▼
            </button>
          </div>

          {/* Section 2: Scans viewer (Side-by-side when preprocessed) */}
          <div style={{ flex: 1, display: 'flex', gap: 10, minHeight: 0 }}>
            {/* Original Scan Pane */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', overflow: 'hidden', minWidth: 0 }}>
              <div style={{ padding: '6px 12px', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Original scan {selectedScan ? `(${selectedScan.scan})` : ''}</span>
              </div>
              
              <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 12, background: '#525659' }}>
                {selectedScan ? (
                  <img
                    src={`http://localhost:8000/api/projects/${encodeURIComponent(projectName)}/unrecognized_scan_image?filename=${encodeURIComponent(selectedScan.filename)}&t=${selectedScan.timestamp}`}
                    alt="Original Scan"
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      background: 'white'
                    }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div style={{ color: '#d1d5db', padding: 40, textAlign: 'center' }}>
                    Không có trang scan nào được chọn.
                  </div>
                )}
              </div>
            </div>

            {/* Preprocessed Scan Pane (shows when preprocessed) */}
            {selectedScan?.has_preprocessed && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', overflow: 'hidden', minWidth: 0 }}>
                <div style={{ padding: '6px 12px', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Preprocessed</span>
                  <span style={{ fontSize: 11, fontWeight: 'normal', color: '#16a34a' }}>● Dấu nhận diện & mã nhị phân</span>
                </div>
                
                <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 12, background: '#525659' }}>
                  <img
                    src={`http://localhost:8000/api/projects/${encodeURIComponent(projectName)}/unrecognized_diagnostic_image?filename=${encodeURIComponent(selectedScan.filename)}&t=${selectedScan.timestamp}`}
                    alt="Preprocessed Diagnostic Scan"
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      background: 'white'
                    }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

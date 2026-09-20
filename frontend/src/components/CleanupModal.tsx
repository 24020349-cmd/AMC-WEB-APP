import React, { useState, useEffect } from 'react';
import '../index.css';

interface CleanupInfo {
  size_bytes: number;
  size_str: string;
}

interface CleanupResponse {
  zooms: CleanupInfo;
  layout_reports: CleanupInfo;
  annotated_pages: CleanupInfo;
}

interface CleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
}

export const CleanupModal: React.FC<CleanupModalProps> = ({ isOpen, onClose, projectName }) => {
  const [info, setInfo] = useState<CleanupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [checkedZooms, setCheckedZooms] = useState(false);
  const [checkedLayout, setCheckedLayout] = useState(false);
  const [checkedAnnotated, setCheckedAnnotated] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'zooms' | 'layout_reports' | 'annotated_pages'>('zooms');
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (isOpen && projectName) {
      setLoading(true);
      setCheckedZooms(false);
      setCheckedLayout(false);
      setCheckedAnnotated(false);
      setActiveTab('zooms');
      
      fetch(`http://localhost:8000/api/projects/${encodeURIComponent(projectName)}/cleanup_info`, {
        cache: 'no-store'
      })
        .then(async (res) => {
          if (!res.ok) {
             const text = await res.text();
             throw new Error(text);
          }
          return res.json();
        })
        .then((data: CleanupResponse) => {
          setInfo(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch cleanup info", err);
          setInfo(null);
          setLoading(false);
        });
    }
  }, [isOpen, projectName]);

  if (!isOpen) return null;

  const handleRemove = async () => {
    if (!checkedZooms && !checkedLayout && !checkedAnnotated) {
      onClose();
      return;
    }
    
    setIsRemoving(true);
    try {
      const res = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(projectName)}/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zooms: checkedZooms,
          layout_reports: checkedLayout,
          annotated_pages: checkedAnnotated
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Cleanup failed");
      }
      alert("Cleanup successful!");
      onClose();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsRemoving(false);
    }
  };

  const descriptions = {
    zooms: "boxes images are extracted from the scans while processing automatic data capture. They can be removed if you don't plan to use the zooms dialog to check and correct boxes categorization. They can be recovered processing again automatic data capture from the same scans.",
    layout_reports: "these images are intended to show how the corner marks have been recognized and positioned on the scans. They can be safely removed once the scans are known to be well-recognized. They can be recovered processing again automatic data capture from the same scans.",
    annotated_pages: "jpeg annotated pages are made before beeing assembled to PDF annotated files. They can safely be removed, and will be recovered automatically the next time annotation will be requested."
  };

  const renderTab = (id: 'zooms' | 'layout_reports' | 'annotated_pages', label: string, checked: boolean, setChecked: (val: boolean) => void) => {
    const itemInfo = info ? info[id] : null;
    const isDisabled = itemInfo ? itemInfo.size_bytes === 0 : true;
    const isActive = activeTab === id;

    return (
      <div 
        onClick={() => setActiveTab(id)}
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          background: isActive ? '#f0f0f0' : 'transparent',
          borderRight: isActive ? '3px solid #3b82f6' : '3px solid transparent',
          color: isDisabled ? '#999' : '#333'
        }}
      >
        <input 
          type="checkbox" 
          checked={checked} 
          disabled={isDisabled}
          onChange={(e) => setChecked(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          style={{ marginRight: 12, cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        />
        <span>{label}</span>
      </div>
    );
  };

  const hasCheckedAny = checkedZooms || checkedLayout || checkedAnnotated;

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal" style={{ width: 600, borderRadius: 6, overflow: 'hidden', border: '1px solid #aaa6a1', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', background: '#f5f4f2', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ background: '#e5e2df', borderBottom: '1px solid #bdb8b2', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{fontWeight: 700, fontSize: 13, flex: 1, textAlign: 'center', color: '#333'}}>Cleanup</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, padding: 0, color: '#333', fontWeight: 'bold' }}>×</button>
        </div>

        {/* Top Text */}
        <div style={{ padding: '12px 16px', fontSize: 13, color: '#333', borderBottom: '1px solid #ccc' }}>
          To save disk space, you can remove some intermediate files from your project directory.
        </div>

        {/* Content Area */}
        <div style={{ display: 'flex', height: 180, background: '#e5e2df' }}>
          
          {/* Left Menu */}
          <div style={{ width: 180, borderRight: '1px solid #ccc', background: '#e5e2df', paddingTop: 8 }}>
            {renderTab('zooms', 'zooms', checkedZooms, setCheckedZooms)}
            {renderTab('layout_reports', 'layout reports', checkedLayout, setCheckedLayout)}
            {renderTab('annotated_pages', 'annotated pages', checkedAnnotated, setCheckedAnnotated)}
          </div>
          
          {/* Right Description */}
          <div style={{ flex: 1, padding: '12px 16px', background: 'white', fontSize: 13, color: '#333', lineHeight: '1.4' }}>
            {loading ? (
              <div>Loading info...</div>
            ) : (
              <div>
                <div style={{ marginBottom: 12 }}>
                  {descriptions[activeTab]}
                </div>
                <div>
                  Total size of concerned files: {info && info[activeTab] ? info[activeTab].size_str : '0'}
                </div>
                {!info && (
                  <div style={{ color: 'red', marginTop: 8 }}>
                    Failed to load size info from server.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', background: '#f5f4f2', display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid #ccc' }}>
          <button onClick={onClose} style={{ padding: '6px 16px', background: '#f5f4f2', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', color: '#333' }}>
            Cancel
          </button>
          <button 
            onClick={handleRemove} 
            disabled={isRemoving || !hasCheckedAny} 
            style={{ padding: '6px 16px', background: hasCheckedAny ? '#dc2626' : '#e5e5e5', border: '1px solid', borderColor: hasCheckedAny ? '#b91c1c' : '#ccc', borderRadius: 4, cursor: hasCheckedAny ? 'pointer' : 'not-allowed', color: hasCheckedAny ? 'white' : '#999', opacity: isRemoving ? 0.7 : 1 }}
          >
            {isRemoving ? 'Removing...' : 'Remove selected files'}
          </button>
        </div>

      </div>
    </div>
  );
};

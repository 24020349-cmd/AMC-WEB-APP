import React, { useState, useEffect } from 'react';
import '../index.css';

interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
}

export const SaveAsTemplateModal: React.FC<SaveAsTemplateModalProps> = ({ isOpen, onClose, projectName }) => {
  const [fileName, setFileName] = useState('');
  const [shortName, setShortName] = useState('');
  const [description, setDescription] = useState('');
  const [includedFiles, setIncludedFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFileName(projectName || '');
      setShortName(projectName || '');
      setDescription('');
      setIncludedFiles(['options.xml', `${projectName || 'source'}.tex`]);
      setSelectedFile(null);
    }
  }, [isOpen, projectName]);

  if (!isOpen) return null;

  const handleAddFile = () => {
    const file = window.prompt("Enter file name to include (e.g., logo.png):");
    if (file && !includedFiles.includes(file.trim())) {
      setIncludedFiles([...includedFiles, file.trim()]);
    }
  };

  const handleDeleteFile = () => {
    if (selectedFile) {
      setIncludedFiles(includedFiles.filter(f => f !== selectedFile));
      setSelectedFile(null);
    }
  };

  const handleSave = async () => {
    if (!fileName || !shortName) {
      alert("File name and Short name are required.");
      return;
    }
    setIsExporting(true);
    try {
      const res = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(projectName)}/export_template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: fileName,
          short_name: shortName,
          description: description,
          included_files: includedFiles
        })
      });
      
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
      
      alert("Template exported successfully to 'models' directory!");
      onClose();
    } catch (err) {
      alert(`Failed to export template: ${err}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal" style={{ width: 450, borderRadius: 6, overflow: 'hidden', border: '1px solid #aaa6a1', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', background: '#f5f4f2' }}>
        <div style={{ background: '#e5e2df', borderBottom: '1px solid #bdb8b2', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{fontWeight: 700, fontSize: 13, flex: 1, textAlign: 'center', color: '#333'}}>Save as a template</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, padding: 0, color: '#333', fontWeight: 'bold' }}>×</button>
        </div>
        
        <div style={{ padding: '16px', fontSize: 13, color: '#333' }}>
          <div style={{ marginBottom: 12 }}>To make a new template from your project, describe it below:</div>
          
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ width: 100 }}>File name:</label>
            <input 
              type="text" 
              value={fileName} 
              onChange={e => setFileName(e.target.value)} 
              style={{ flex: 1, padding: '4px', border: '1px solid #3b82f6', borderRadius: 2, outline: 'none', boxShadow: '0 0 0 1px rgba(59,130,246,0.3)' }} 
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ width: 100 }}>Short name:</label>
            <input 
              type="text" 
              value={shortName} 
              onChange={e => setShortName(e.target.value)} 
              style={{ flex: 1, padding: '4px', border: '1px solid #ccc', borderRadius: 2, outline: 'none' }} 
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
            <label style={{ width: 100 }}>Description:</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              style={{ flex: 1, padding: '4px', border: '1px solid #ccc', borderRadius: 2, height: 70, resize: 'vertical', outline: 'none' }} 
            />
          </div>
          
          <div style={{ marginBottom: 4 }}>Included files:</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 4 }}>
              <button onClick={handleAddFile} style={{ padding: '3px 16px', background: '#f0f0f0', border: '1px solid #c9c5c0', borderRadius: 3, cursor: 'pointer' }}>Add</button>
              <button onClick={handleDeleteFile} disabled={!selectedFile} style={{ padding: '3px 16px', background: '#f0f0f0', border: '1px solid #c9c5c0', borderRadius: 3, cursor: selectedFile ? 'pointer' : 'not-allowed', opacity: selectedFile ? 1 : 0.6 }}>Delete</button>
            </div>
            <div style={{ background: 'white', border: '1px solid #c9c5c0', height: 100, overflowY: 'auto' }}>
              {includedFiles.map(file => (
                <div 
                  key={file} 
                  onClick={() => setSelectedFile(file)}
                  style={{ 
                    padding: '2px 8px', 
                    background: selectedFile === file ? '#3b82f6' : 'transparent', 
                    color: selectedFile === file ? 'white' : 'black', 
                    cursor: 'default',
                    userSelect: 'none'
                  }}
                >
                  {file}
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button onClick={onClose} style={{ padding: '5px 24px', background: '#f0f0f0', border: '1px solid #c9c5c0', borderRadius: 3, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={isExporting} style={{ padding: '5px 24px', background: '#f0f0f0', border: '1px solid #c9c5c0', borderRadius: 3, cursor: 'pointer' }}>
              {isExporting ? 'Saving...' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

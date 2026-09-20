import React, { useState, useEffect } from 'react';
import '../index.css';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState('template'); // 'template', 'file', 'empty'
  const [fileContent, setFileContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [existingProjects, setExistingProjects] = useState<string[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setName('');
      setError('');
      fetch('http://localhost:8000/api/projects/')
        .then(res => res.json())
        .then(data => setExistingProjects(data.map((p: any) => p.name)))
        .catch(err => console.error(err));
        
      fetch('http://localhost:8000/api/projects/templates')
        .then(res => res.json())
        .then(data => setTemplates(data))
        .catch(err => console.error(err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setFileContent(evt.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleArchiveUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setArchiveFile(e.target.files?.[0] || null);
  };

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    
    try {
      let res;
      if (sourceType === 'archive') {
        const formData = new FormData();
        formData.append('name', name.trim());
        if (archiveFile) formData.append('file', archiveFile);
        
        res = await fetch('http://localhost:8000/api/projects/from_archive', {
          method: 'POST',
          body: formData
        });
      } else {
        const payload = {
          name: name.trim(),
          source_type: sourceType,
          template_name: sourceType === 'template' ? selectedTemplate : undefined,
          file_content: sourceType === 'file' ? fileContent : undefined
        };

        res = await fetch('http://localhost:8000/api/projects/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create project');
      }
      
      onCreated(data.name);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForwardStep1 = () => {
    if (!name.trim()) return;
    setStep(2);
  };

  const handleForwardStep2 = () => {
    if (sourceType === 'template') {
      setStep(3);
    } else {
      // Empty or File goes straight to creation
      handleCreate();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{width: step === 3 ? 600 : 400}}>
        
        {/* HEADER */}
        <div className="modal-header">
          <button className="btn" onClick={step === 1 ? onClose : () => setStep(step - 1)}>
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> {step === 1 ? 'Cancel' : 'Back'}
          </button>
          
          <h3 className="modal-title" style={{margin: '0 auto'}}>
            {step === 1 ? 'New AMC project' : step === 2 ? 'Source file' : 'Template selection'}
          </h3>
          
          {step === 1 && (
            <button className="btn btn-primary" onClick={handleForwardStep1} disabled={!name.trim()}>
              Forward
            </button>
          )}
          {step === 2 && (
            <button className="btn btn-primary" onClick={handleForwardStep2} disabled={(sourceType === 'file' && !fileContent) || (sourceType === 'archive' && !archiveFile)}>
              {sourceType === 'template' ? 'Forward' : 'Apply'}
            </button>
          )}
          {step === 3 && (
            <button className="btn btn-primary" onClick={handleCreate} disabled={loading || !selectedTemplate}>
              Apply
            </button>
          )}
        </div>

        {/* BODY */}
        <div className="modal-body" style={{background: '#f8f9fa', padding: step === 3 ? 0 : 16}}>
          {error && <div style={{color: 'white', background: 'var(--danger-color)', padding: 8, marginBottom: 8, borderRadius: 4, fontSize: 13}}>{error}</div>}

          {step === 1 && (
            <>
              <div style={{textAlign: 'center', marginBottom: 8}}>Existing projects:</div>
              <div style={{background: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', padding: 8, marginBottom: 16}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#339af0" stroke="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> 
                  MC-Projects
                </div>
                <div style={{display: 'flex', flexWrap: 'wrap', gap: 12, borderTop: '1px solid #eee', paddingTop: 8, maxHeight: 150, overflowY: 'auto'}}>
                  <div className="project-item disabled" style={{padding: 4}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#a5d8ff" stroke="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> ..
                  </div>
                  {existingProjects.map(p => (
                    <div key={p} className="project-item disabled" style={{padding: 4}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg> {p}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{textAlign: 'center', marginBottom: 8, fontWeight: 600}}>Create an new project:</div>
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <label style={{whiteSpace: 'nowrap'}}>Project name:</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
              </div>
            </>
          )}

          {step === 2 && (
            <div style={{background: 'white', border: '1px solid var(--border-color)', borderRadius: 4}}>
              <div style={{padding: 12, textAlign: 'center', borderBottom: '1px solid var(--border-color)', fontSize: 13}}>
                A multiple choice project is mainly made of a source file, which describes the questionnaire.<br/>
                <b>Please choose your situation:</b>
              </div>
              
              <label style={{display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #eee', cursor: 'pointer', background: sourceType === 'template' ? '#f1f8ff' : 'transparent'}}>
                <input type="radio" name="sourceType" checked={sourceType === 'template'} onChange={() => setSourceType('template')} style={{marginTop: 4}}/>
                <div>
                  <div style={{fontWeight: 600}}>Template</div>
                  <div style={{fontSize: 13, color: '#555'}}>You did not write any description of the questionnaire, and want to start from a template.</div>
                </div>
              </label>
              
              <label style={{display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #eee', cursor: 'pointer', background: sourceType === 'file' ? '#f1f8ff' : 'transparent'}}>
                <input type="radio" name="sourceType" checked={sourceType === 'file'} onChange={() => setSourceType('file')} style={{marginTop: 4}}/>
                <div>
                  <div style={{fontWeight: 600}}>File</div>
                  <div style={{fontSize: 13, color: '#555'}}>You already wrote a questionnaire description, and want to use it for this project.</div>
                  {sourceType === 'file' && (
                    <input type="file" accept=".tex,.txt" onChange={handleFileUpload} style={{marginTop: 8, fontSize: 13}} />
                  )}
                </div>
              </label>

              <label style={{display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #eee', cursor: 'pointer', background: sourceType === 'empty' ? '#f1f8ff' : 'transparent'}}>
                <input type="radio" name="sourceType" checked={sourceType === 'empty'} onChange={() => setSourceType('empty')} style={{marginTop: 4}}/>
                <div>
                  <div style={{fontWeight: 600}}>Empty</div>
                  <div style={{fontSize: 13, color: '#555'}}>You want to write the description from zero.</div>
                </div>
              </label>

              <label style={{display: 'flex', gap: 12, padding: 12, cursor: 'pointer', background: sourceType === 'archive' ? '#f1f8ff' : 'transparent'}}>
                <input type="radio" name="sourceType" checked={sourceType === 'archive'} onChange={() => setSourceType('archive')} style={{marginTop: 4}}/>
                <div>
                  <div style={{fontWeight: 600}}>Archive</div>
                  <div style={{fontSize: 13, color: '#555'}}>You have a .tgz or .zip file containing the questionnaire and other related stuff.</div>
                  {sourceType === 'archive' && (
                    <input type="file" accept=".zip,.tar.gz,.tgz" onChange={handleArchiveUpload} style={{marginTop: 8, fontSize: 13}} />
                  )}
                </div>
              </label>
            </div>
          )}

          {step === 3 && (
            <div style={{display: 'flex', height: 300, background: 'white'}}>
              <div style={{width: 250, borderRight: '1px solid var(--border-color)', overflowY: 'auto'}}>
                <div style={{padding: '4px 8px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 'bold'}}>template</div>
                {templates.map(tpl => (
                  <div 
                    key={tpl} 
                    onClick={() => setSelectedTemplate(tpl)}
                    style={{
                      padding: '8px 16px', 
                      paddingLeft: 32,
                      fontSize: 13,
                      cursor: 'pointer', 
                      background: selectedTemplate === tpl ? 'var(--primary-color)' : 'transparent',
                      color: selectedTemplate === tpl ? 'white' : 'inherit'
                    }}
                  >
                    {tpl}
                  </div>
                ))}
              </div>
              <div style={{flex: 1, padding: 16, fontSize: 13}}>
                {selectedTemplate ? `This group contains LaTeX files given as examples in AMC Documentation. You have selected: ${selectedTemplate}.` : 'Please select a template from the left list.'}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

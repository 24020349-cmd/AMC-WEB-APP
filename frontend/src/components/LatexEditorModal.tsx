import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import '../index.css';

interface LatexEditorModalProps {
  isOpen: boolean;
  projectName: string;
  requestedFormat?: string;
  onClose: () => void;
}

export const LatexEditorModal: React.FC<LatexEditorModalProps> = ({ isOpen, projectName, requestedFormat, onClose }) => {
  const [content, setContent] = useState('');
  const [fileFormat, setFileFormat] = useState('latex');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileLog, setCompileLog] = useState<string | null>(null);
  const [compileSuccess, setCompileSuccess] = useState<boolean | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [compileLog]);

  useEffect(() => {
    if (isOpen && projectName) {
      // Fetch initial content
      const fmt = requestedFormat || '';
      fetch(`http://localhost:8000/api/projects/${projectName}/source${fmt ? `?format=${fmt}` : ''}`)
        .then(res => res.json())
        .then(data => {
          setContent(data.content || '');
          setFileFormat(requestedFormat || data.format || 'latex');
          setLastSaved(new Date());
          setCompileLog(null);
          setCompileSuccess(null);
        })
        .catch(err => console.error('Failed to load source:', err));
    }
  }, [isOpen, projectName, requestedFormat]);

  const handleEditorChange = (value: string | undefined) => {
    const newContent = value || '';
    setContent(newContent);

    // Debounce save (wait 1.5s after typing stops)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(newContent);
    }, 1500);
  };

  const handleCompile = async () => {
    setIsCompiling(true);
    setCompileLog("Compiling...");
    setCompileSuccess(null);
    try {
      // First save if needed, but we assume it's saved by the save button or auto-save
      await saveContent(content);
      const res = await fetch(`http://localhost:8000/api/projects/${projectName}/compile_log`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        setCompileSuccess(false);
        setCompileLog("Server Error: " + (data.detail || JSON.stringify(data)));
      } else {
        setCompileSuccess(data.success);
        setCompileLog(data.log || "No output.");
      }
    } catch (err) {
      setCompileSuccess(false);
      setCompileLog(err instanceof Error ? err.message : "Failed to compile.");
    } finally {
      setIsCompiling(false);
    }
  };

  const saveContent = async (text: string) => {
    try {
      await fetch(`http://localhost:8000/api/projects/${projectName}/source`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, format: fileFormat })
      });
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save source:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: '#1e1e1e', zIndex: 9999, display: 'flex', flexDirection: 'column'
    }}>
      {/* Editor Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: '#2d2d2d', color: '#ccc',
        borderBottom: '1px solid #444', fontSize: 13
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <button className="btn" style={{background: 'transparent', color: '#ccc', borderColor: '#555'}} onClick={() => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveContent(content).then(onClose);
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Back
          </button>
          
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <span style={{fontWeight: 600, color: 'white'}}>{projectName}.{fileFormat === 'txt' ? 'txt' : 'tex'}</span>
          </div>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <span style={{color: isSaving ? '#e6ca73' : '#73e689'}}>
            {isSaving ? 'Saving...' : lastSaved ? `Saved at ${lastSaved.toLocaleTimeString()}` : ''}
          </span>
          <button className="btn" style={{background: '#007acc', color: 'white'}} onClick={handleCompile} disabled={isCompiling}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> 
            {isCompiling ? 'Compiling...' : 'Compile / View Log'}
          </button>
          <button className="btn btn-primary" onClick={() => saveContent(content)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save
          </button>
        </div>
      </div>

      {/* Editor Layout mimicking AMC desktop (Sidebar + Main) */}
      <div style={{display: 'flex', flex: 1, overflow: 'hidden'}}>
        
        {/* Structure Sidebar */}
        <div style={{width: 250, background: '#252526', borderRight: '1px solid #444', color: '#ccc', padding: 12, fontSize: 13, display: 'flex', flexDirection: 'column'}}>
          <div style={{textTransform: 'uppercase', fontSize: 11, fontWeight: 'bold', marginBottom: 12, letterSpacing: 1}}>Structure</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', color: 'white'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            {projectName}.{fileFormat === 'txt' ? 'txt' : 'tex'}
          </div>
          <div style={{paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 6}}>
            <div style={{cursor: 'pointer', color: '#aaa'}}>LABELS</div>
            <div style={{cursor: 'pointer', color: '#aaa'}}>BLOCKS</div>
          </div>
        </div>

        {/* Monaco Editor & Terminal */}
        <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
          <div style={{flex: 1, minHeight: 0}}>
            <Editor
              height="100%"
              theme="vs-dark"
              language={fileFormat === 'txt' ? 'plaintext' : 'latex'}
              value={content}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                padding: { top: 16 }
              }}
            />
          </div>
          
          {/* Terminal / Log pane */}
          <div style={{
            height: compileLog ? '30%' : '0%', 
            minHeight: compileLog ? '150px' : '0px', 
            background: '#1e1e1e', 
            borderTop: '1px solid #444', 
            display: compileLog ? 'flex' : 'none', 
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '4px 12px', background: '#2d2d2d', color: '#ccc', fontSize: 12, 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid #333'
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <span>Terminal Output</span>
                {compileSuccess !== null && (
                  <span style={{color: compileSuccess ? '#73e689' : '#e67373'}}>
                    ({compileSuccess ? 'Success' : 'Failed'})
                  </span>
                )}
              </div>
              <button className="btn btn-icon" onClick={() => setCompileLog(null)} style={{padding: 2, height: 'auto'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{
              flex: 1, overflowY: 'auto', padding: 12, color: '#ccc', 
              fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap'
            }}>
              {compileLog}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

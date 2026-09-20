import React, { useState, useEffect } from 'react';
import '../index.css';

interface Project {
  name: string;
  path: string;
}

interface ManageProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectAction?: () => void; // Callback to refresh main UI if needed
}

export const ManageProjectsModal: React.FC<ManageProjectsModalProps> = ({ isOpen, onClose, onProjectAction }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  
  // Cleanup modal states (We can move cleanup logic here too if requested, but for now we focus on Rename/Clone/Delete as per the UI image, wait, cleanup is in the project menu. I'll add cleanup back where it belongs later).

  const refreshProjects = () => {
    setLoading(true);
    fetch('http://localhost:8000/api/projects/')
      .then(res => res.json())
      .then(data => {
        setProjects(data);
        if (selectedProject && !data.find((p: any) => p.name === selectedProject)) {
          setSelectedProject(null);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      refreshProjects();
      setSelectedProject(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (!selectedProject) return;
    if (!window.confirm(`Are you sure you want to permanently delete project '${selectedProject}'?`)) return;
    
    try {
      const res = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(selectedProject)}`, {
        method: 'DELETE'
      });
      const text = await res.text();
      if (!res.ok) {
        try {
          const json = JSON.parse(text);
          throw new Error(json.detail || 'Delete failed');
        } catch(e) {
          throw new Error(text);
        }
      }
      refreshProjects();
      if (onProjectAction) onProjectAction();
    } catch (err) {
      alert(`Error deleting project: ${err}`);
    }
  };

  const handleRename = async () => {
    if (!selectedProject) return;
    const newName = window.prompt(`Enter new name for project '${selectedProject}':`, selectedProject);
    if (!newName || newName === selectedProject) return;

    try {
      const res = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(selectedProject)}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newName)
      });
      const text = await res.text();
      if (!res.ok) {
        try {
          const json = JSON.parse(text);
          throw new Error(json.detail || 'Rename failed');
        } catch(e) {
          throw new Error(text);
        }
      }
      setSelectedProject(newName);
      refreshProjects();
      if (onProjectAction) onProjectAction();
    } catch (err) {
      alert(`Error renaming project: ${err}`);
    }
  };

  const handleClone = async () => {
    if (!selectedProject) return;
    const newName = window.prompt(`Enter name for the new copy of '${selectedProject}':`, `${selectedProject}_copy`);
    if (!newName) return;

    try {
      const res = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(selectedProject)}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newName)
      });
      if (!res.ok) throw new Error(await res.text());
      setSelectedProject(newName);
      refreshProjects();
      if (onProjectAction) onProjectAction();
    } catch (err) {
      alert(`Error cloning project: ${err}`);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal" style={{ width: 450, borderRadius: 6, overflow: 'hidden', border: '1px solid #aaa6a1', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
        <div style={{ background: '#e5e2df', borderBottom: '1px solid #bdb8b2', padding: '8px 12px', display: 'flex', alignItems: 'center' }}>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f5f4f2', border: '1px solid #c9c5c0', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 13, marginRight: 16 }}>
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
             Back
          </button>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#333' }}>AMC projects management</h3>
        </div>
        
        <div style={{ padding: '16px', background: '#f5f4f2' }}>
          <div style={{ fontSize: 13, marginBottom: 4, textAlign: 'center' }}>Projects management:</div>
          <div style={{ background: 'white', border: '1px solid #c9c5c0', borderRadius: 4, padding: 8, minHeight: 180 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: 4, marginBottom: 12, fontSize: 13 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#3b82f6" stroke="#3b82f6" strokeWidth="1"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                MC-Projects
             </div>
             
             {loading ? (
                <div style={{ padding: 12, fontSize: 13, color: '#666' }}>Loading projects...</div>
             ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                   {projects.length === 0 ? <div style={{ fontSize: 13, color: '#999', padding: 12 }}>No projects found.</div> : null}
                   {projects.map(proj => (
                     <div 
                        key={proj.name} 
                        onClick={() => setSelectedProject(proj.name)}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 6, 
                          padding: '4px 8px', 
                          cursor: 'pointer', 
                          borderRadius: 4,
                          background: selectedProject === proj.name ? '#3b82f6' : 'transparent',
                          color: selectedProject === proj.name ? 'white' : '#333',
                          fontSize: 13
                        }}
                     >
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill={selectedProject === proj.name ? 'white' : '#3b82f6'} stroke={selectedProject === proj.name ? 'white' : '#3b82f6'} strokeWidth="1"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="3" style={{ position: 'absolute', bottom: -2, right: -2, background: 'white', borderRadius: '50%' }}><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </div>
                        {proj.name}
                     </div>
                   ))}
                </div>
             )}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
             <button 
                onClick={handleRename}
                disabled={!selectedProject}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', background: '#f5f4f2', border: '1px solid #c9c5c0', borderRadius: 4, cursor: selectedProject ? 'pointer' : 'not-allowed', opacity: selectedProject ? 1 : 0.6, fontSize: 13, color: '#333' }}
             >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Rename
             </button>
             <button 
                onClick={handleClone}
                disabled={!selectedProject}
                style={{ padding: '6px 24px', background: '#f5f4f2', border: '1px solid #c9c5c0', borderRadius: 4, cursor: selectedProject ? 'pointer' : 'not-allowed', opacity: selectedProject ? 1 : 0.6, fontSize: 13, color: '#333' }}
             >
                Clone
             </button>
             <button 
                onClick={handleDelete}
                disabled={!selectedProject}
                style={{ padding: '6px 24px', background: '#d32f2f', border: '1px solid #b71c1c', borderRadius: 4, color: 'white', cursor: selectedProject ? 'pointer' : 'not-allowed', opacity: selectedProject ? 1 : 0.6, fontSize: 13 }}
             >
                Delete
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

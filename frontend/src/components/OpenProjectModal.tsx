import React, { useState } from 'react';
import '../index.css';

interface Project {
  name: string;
  path: string;
}

interface OpenProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (proj: Project) => void;
}

export const OpenProjectModal: React.FC<OpenProjectModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('http://localhost:8000/api/projects/')
        .then(res => res.json())
        .then(data => {
          setProjects(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Open AMC Project</h3>
          <button className="btn btn-icon" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <input 
            type="text" 
            className="input-field search-input" 
            placeholder="Search projects..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {loading ? (
            <div>Loading projects...</div>
          ) : (
            <div className="project-list">
              {filtered.length === 0 ? <div style={{padding: 12}}>No projects found.</div> : null}
              {filtered.map(proj => (
                <div key={proj.name} className="project-item" onClick={() => onSelect(proj)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  <div>
                    <div style={{fontWeight: 600}}>{proj.name}</div>
                    <div style={{fontSize: 12, color: 'var(--text-muted)'}}>{proj.path}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

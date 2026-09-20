import { useState, useEffect } from 'react';

interface ManualCaptureModalProps {
  isOpen: boolean;
  projectName: string;
  onClose: () => void;
}

export default function ManualCaptureModal({ isOpen, projectName, onClose }: ManualCaptureModalProps) {
  const [pages, setPages] = useState<any[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [boxes, setBoxes] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && projectName) {
      fetch(`http://localhost:8000/api/projects/${projectName}/manual_pages`)
        .then(res => res.json())
        .then(data => {
          setPages(data.pages || []);
          if (data.pages && data.pages.length > 0) {
            setSelectedPageIndex(0);
          }
        })
        .catch(err => console.error(err));
    }
  }, [isOpen, projectName]);

  useEffect(() => {
    if (isOpen && projectName && pages.length > 0 && selectedPageIndex >= 0) {
      const pageInfo = pages[selectedPageIndex];
      setImageUrl(`http://localhost:8000/api/projects/${projectName}/subject_page?page=${pageInfo.subjectpage}&t=${new Date().getTime()}`);
      
      // Fetch layout
      fetch(`http://localhost:8000/api/projects/${projectName}/manual_layout?student=${pageInfo.student}&page=${pageInfo.page}`)
        .then(res => res.json())
        .then(data => setBoxes(data.boxes || []))
        .catch(err => console.error(err));
        
      // Fetch states
      fetch(`http://localhost:8000/api/projects/${projectName}/capture_zone_state?student=${pageInfo.student}&page=${pageInfo.page}&copy=0`)
        .then(res => res.json())
        .then(data => setStates(data.states || []))
        .catch(err => console.error(err));
    }
  }, [isOpen, projectName, selectedPageIndex, pages]);

  if (!isOpen) return null;

  const currentPage = pages[selectedPageIndex];
  if (!currentPage) {
    return (
      <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
        <div style={{background: 'white', padding: 20, borderRadius: 4}}>
          <p>No layout pages found for this project. Please run Layout detection in Preparation tab.</p>
          <button onClick={onClose} className="btn">Close</button>
        </div>
      </div>
    );
  }

  const handleToggle = (question: number, answer: number) => {
    const existingState = states.find(s => s.id_a === question && s.id_b === answer);
    const isCurrentlyChecked = existingState ? (existingState.manual >= 0 ? existingState.manual > 0 : existingState.black >= existingState.total / 2) : false;
    const newChecked = !isCurrentlyChecked;
    
    // Optimistic update
    const newStates = [...states];
    const idx = newStates.findIndex(s => s.id_a === question && s.id_b === answer);
    if (idx >= 0) {
      newStates[idx].manual = newChecked ? 1.0 : 0.0;
    } else {
      newStates.push({ id_a: question, id_b: answer, manual: newChecked ? 1.0 : 0.0, black: -1, total: -1, type: 4 });
    }
    setStates(newStates);

    fetch(`http://localhost:8000/api/projects/${projectName}/capture_zone_toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student: currentPage.student,
        page: currentPage.page,
        copy: 0,
        question,
        answer,
        checked: newChecked
      })
    }).catch(err => {
      console.error(err);
      alert('Failed to toggle capture state');
    });
  };

  return (
    <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#f0f0f0', zIndex: 1000, display: 'flex', flexDirection: 'column'}}>
      <div style={{background: 'white', borderBottom: '1px solid #ccc', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <button className="btn" onClick={onClose}>Close</button>
          <span style={{fontWeight: 'bold'}}>Paper data capture</span>
        </div>
        
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <button className="btn" onClick={() => setSelectedPageIndex(Math.max(0, selectedPageIndex - 1))} disabled={selectedPageIndex === 0}>
            {'<'}
          </button>
          <select 
            value={selectedPageIndex} 
            onChange={(e) => setSelectedPageIndex(parseInt(e.target.value))}
            style={{padding: '4px 8px'}}
          >
            {pages.map((p, i) => (
              <option key={i} value={i}>{`${p.student}/${p.page}`}</option>
            ))}
          </select>
          <button className="btn" onClick={() => setSelectedPageIndex(Math.min(pages.length - 1, selectedPageIndex + 1))} disabled={selectedPageIndex === pages.length - 1}>
            {'>'}
          </button>
        </div>
      </div>
      
      <div style={{flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 20, background: '#e0e0e0'}}>
        <div style={{
          position: 'relative', 
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)', 
          background: 'white', 
          maxWidth: '100%', 
          display: 'inline-block',
          lineHeight: 0 // Prevents bottom margin gap on img
        }}>
          {imageUrl && (
            <img 
              src={imageUrl} 
              alt="Subject Page" 
              style={{
                display: 'block', 
                maxHeight: '80vh', 
                maxWidth: '100%',
                width: 'auto',
                height: 'auto'
              }} 
            />
          )}
          
          {boxes.length === 0 && (
            <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, border: '4px solid rgba(0,255,0,0.5)', pointerEvents: 'none'}} />
          )}

          {boxes.map((box, i) => {
            const state = states.find(s => s.id_a === box.question && s.id_b === box.answer);
            let isChecked = false;
            if (state) {
              if (state.manual >= 0) isChecked = state.manual > 0;
              else if (state.total > 0) isChecked = state.black >= state.total / 2;
            }
            
            return (
              <div
                key={i}
                onClick={() => handleToggle(box.question, box.answer)}
                style={{
                  position: 'absolute',
                  top: `${(box.ymin / currentPage.height) * 100}%`,
                  left: `${(box.xmin / currentPage.width) * 100}%`,
                  width: `${((box.xmax - box.xmin) / currentPage.width) * 100}%`,
                  height: `${((box.ymax - box.ymin) / currentPage.height) * 100}%`,
                  border: isChecked ? '2px solid red' : '2px solid transparent',
                  backgroundColor: isChecked ? 'rgba(255,0,0,0.4)' : 'rgba(0,0,255,0.1)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { if (!isChecked) e.currentTarget.style.border = '2px solid blue'; }}
                onMouseLeave={(e) => { if (!isChecked) e.currentTarget.style.border = '2px solid transparent'; }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

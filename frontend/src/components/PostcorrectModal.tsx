import React, { useState, useEffect } from 'react';
import '../index.css';

export interface PostcorrectSheet {
  student: number;
  copy: number;
  name_image?: string | null;
}

interface PostcorrectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  sheets?: PostcorrectSheet[];
  defaultStudent?: number;
  defaultCopy?: number;
  defaultSetMultiple?: boolean;
  onApply: (student: number, copy: number, setMultiple: boolean) => Promise<void> | void;
}

export const PostcorrectModal: React.FC<PostcorrectModalProps> = ({
  isOpen,
  onClose,
  projectName,
  sheets = [],
  defaultStudent = 1,
  defaultCopy = 0,
  defaultSetMultiple = true,
  onApply,
}) => {
  const [student, setStudent] = useState<number>(defaultStudent);
  const [copy, setCopy] = useState<number>(defaultCopy);
  const [setMultiple, setSetMultiple] = useState<boolean>(defaultSetMultiple);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setStudent(defaultStudent);
      setCopy(defaultCopy);
      setSetMultiple(defaultSetMultiple);
      setImageLoaded(false);
      setImageError(false);
      setIsSubmitting(false);
    }
  }, [isOpen, defaultStudent, defaultCopy, defaultSetMultiple]);

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [student, copy]);

  if (!isOpen) return null;

  // Find index in sheets list if available
  const currentIndex = sheets.findIndex(
    (s) => s.student === student && s.copy === copy
  );

  const handlePrev = () => {
    if (sheets.length > 0) {
      if (currentIndex > 0) {
        setStudent(sheets[currentIndex - 1].student);
        setCopy(sheets[currentIndex - 1].copy);
      } else if (currentIndex === -1) {
        setStudent(sheets[0].student);
        setCopy(sheets[0].copy);
      } else {
        // wrap to end
        setStudent(sheets[sheets.length - 1].student);
        setCopy(sheets[sheets.length - 1].copy);
      }
    } else {
      setStudent((prev) => Math.max(1, prev - 1));
    }
  };

  const handleNext = () => {
    if (sheets.length > 0) {
      if (currentIndex >= 0 && currentIndex < sheets.length - 1) {
        setStudent(sheets[currentIndex + 1].student);
        setCopy(sheets[currentIndex + 1].copy);
      } else if (currentIndex === -1) {
        setStudent(sheets[0].student);
        setCopy(sheets[0].copy);
      } else {
        // wrap to start
        setStudent(sheets[0].student);
        setCopy(sheets[0].copy);
      }
    } else {
      setStudent((prev) => prev + 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onApply(student, copy, setMultiple);
    } catch (err) {
      console.error("Postcorrect apply failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewUrl = `http://localhost:8000/api/projects/${encodeURIComponent(
    projectName
  )}/manual_namefield?student=${student}&copy=${copy}`;

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div
        className="modal"
        style={{
          width: 540,
          borderRadius: 6,
          overflow: 'hidden',
          border: '1px solid #aaa6a1',
          boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
          background: '#f5f4f2',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Title Bar */}
        <div
          style={{
            background: '#e5e2df',
            borderBottom: '1px solid #bdb8b2',
            padding: '6px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, flex: 1, textAlign: 'center', color: '#333' }}>
            Post-correction
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              padding: 0,
              color: '#333',
              fontWeight: 'bold',
            }}
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Prompt instruction */}
          <div style={{ fontSize: 13, color: '#333', lineHeight: 1.4 }}>
            Please enter the teacher score sheet number and copy number to get the correct answers from:
          </div>

          {/* Stepper / Controls Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '10px 14px',
              background: '#eae7e4',
              borderRadius: 5,
              border: '1px solid #d2ceca',
            }}
          >
            <button
              type="button"
              className="btn"
              onClick={handlePrev}
              disabled={isSubmitting}
              title="Previous sheet"
              style={{
                width: 32,
                height: 28,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: 16,
              }}
            >
              ‹
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span>sheet</span>
              <input
                type="number"
                min={1}
                value={student}
                onChange={(e) => setStudent(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={isSubmitting}
                style={{
                  width: 65,
                  padding: '3px 6px',
                  border: '1px solid #999',
                  borderRadius: 3,
                  textAlign: 'center',
                  background: 'white',
                  fontSize: 13,
                }}
              />
            </div>

            <span style={{ color: '#888', fontWeight: 'bold' }}>/</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span>copy</span>
              <input
                type="number"
                min={0}
                value={copy}
                onChange={(e) => setCopy(Math.max(0, parseInt(e.target.value) || 0))}
                disabled={isSubmitting}
                style={{
                  width: 55,
                  padding: '3px 6px',
                  border: '1px solid #999',
                  borderRadius: 3,
                  textAlign: 'center',
                  background: 'white',
                  fontSize: 13,
                }}
              />
            </div>

            <button
              type="button"
              className="btn"
              onClick={handleNext}
              disabled={isSubmitting}
              title="Next sheet"
              style={{
                width: 32,
                height: 28,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: 16,
              }}
            >
              ›
            </button>

            {sheets.length > 0 && (
              <select
                value={currentIndex >= 0 ? `${student}:${copy}` : ''}
                onChange={(e) => {
                  const [s, c] = e.target.value.split(':').map(Number);
                  setStudent(s);
                  setCopy(c);
                }}
                disabled={isSubmitting}
                style={{
                  marginLeft: 8,
                  fontSize: 12,
                  padding: '3px 6px',
                  border: '1px solid #aaa',
                  borderRadius: 3,
                  background: 'white',
                }}
                title="Select from captured sheets"
              >
                {currentIndex === -1 && <option value="">Custom ({student}/{copy})</option>}
                {sheets.map((sh) => (
                  <option key={`${sh.student}:${sh.copy}`} value={`${sh.student}:${sh.copy}`}>
                    Sheet {sh.student}{sh.copy > 0 ? ` (copy ${sh.copy})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Checkbox option */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                fontSize: 13,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={setMultiple}
                onChange={(e) => setSetMultiple(e.target.checked)}
                disabled={isSubmitting}
                style={{ marginTop: 2 }}
              />
              <span style={{ fontWeight: 500 }}>Guess simple/multiple status</span>
            </label>
            <div style={{ fontSize: 11, color: '#666', marginLeft: 24, lineHeight: 1.3 }}>
              Sets type of all questions for which 2 or more answers are ticked on the teacher answer sheet to multiple.
            </div>
          </div>

          {/* Handwriting / Namefield Image Preview Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 12, color: '#555', fontWeight: 600 }}>
              Sheet identification preview:
            </div>
            <div
              style={{
                minHeight: 120,
                maxHeight: 180,
                border: '1px solid #ccc',
                background: '#fff',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 6,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {!imageError ? (
                <img
                  src={previewUrl}
                  alt={`Teacher sheet ${student}`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 160,
                    objectFit: 'contain',
                    display: imageLoaded ? 'block' : 'none',
                  }}
                />
              ) : null}

              {!imageLoaded && !imageError && (
                <div style={{ color: '#888', fontSize: 12 }}>Loading preview...</div>
              )}

              {imageError && (
                <div style={{ color: '#888', fontSize: 12, fontStyle: 'italic', textAlign: 'center' }}>
                  No namefield zone found for sheet {student} (copy {copy})
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Buttons */}
        <div
          style={{
            background: '#e5e2df',
            borderTop: '1px solid #bdb8b2',
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={isSubmitting}
            style={{ minWidth: 80, padding: '5px 14px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              minWidth: 80,
              padding: '5px 16px',
              backgroundColor: '#0078d4',
              color: 'white',
              border: '1px solid #005a9e',
              fontWeight: 600,
            }}
          >
            {isSubmitting ? 'Scoring...' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
};

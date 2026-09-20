import React, { useState, useEffect } from 'react';
import '../index.css';

export interface MarksRow {
  exam: string;
  student: number;
  copy: number;
  mark: string;
  is_teacher: boolean;
  scores: Record<string, string>;
}

export interface MarksMean {
  exam: string;
  mark: string;
  scores: Record<string, string>;
}

export interface MarksData {
  columns: string[];
  rows: MarksRow[];
  mean: MarksMean | null;
}

interface MarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
}

export const MarksModal: React.FC<MarksModalProps> = ({
  isOpen,
  onClose,
  projectName,
}) => {
  const [data, setData] = useState<MarksData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && projectName) {
      setLoading(true);
      setError(null);
      fetch(
        `http://localhost:8000/api/projects/${encodeURIComponent(
          projectName
        )}/marks_table`,
        { cache: 'no-store' }
      )
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to fetch marks data');
          }
          return res.json();
        })
        .then((result: MarksData) => {
          setData(result);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching marks table:', err);
          setError(err.message);
          setLoading(false);
        });
    }
  }, [isOpen, projectName]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 800,
          maxWidth: '92vw',
          maxHeight: '85vh',
          borderRadius: 6,
          overflow: 'hidden',
          border: '1px solid #aaa6a1',
          boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header Bar matching AMC Desktop */}
        <div
          style={{
            background: '#e5e2df',
            borderBottom: '1px solid #bdb8b2',
            padding: '6px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              flex: 1,
              textAlign: 'center',
              color: '#333',
              marginLeft: 60,
            }}
          >
            Marks
          </div>
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{
              background: '#0078d4',
              color: 'white',
              border: '1px solid #005a9e',
              borderRadius: 4,
              padding: '3px 16px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>

        {/* Modal Body / Table View */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 0,
            background: '#ffffff',
          }}
        >
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#666', fontSize: 13 }}>
              Loading marks table...
            </div>
          ) : error ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#a80000', fontSize: 13 }}>
              {error}
            </div>
          ) : !data || data.rows.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#888', fontSize: 13 }}>
              No marks available. Please mark the examination first.
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
                textAlign: 'left',
              }}
            >
              <thead>
                <tr
                  style={{
                    background: '#f8f9fa',
                    borderBottom: '1px solid #d2ceca',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <th
                    style={{
                      padding: '7px 12px',
                      fontWeight: 600,
                      color: '#495057',
                      borderRight: '1px solid #e2e0dd',
                      minWidth: 70,
                    }}
                  >
                    Exam
                  </th>
                  <th
                    style={{
                      padding: '7px 12px',
                      fontWeight: 600,
                      color: '#495057',
                      borderRight: '1px solid #e2e0dd',
                      minWidth: 70,
                    }}
                  >
                    Mark
                  </th>
                  {data.columns.map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '7px 12px',
                        fontWeight: 600,
                        color: '#495057',
                        borderRight: '1px solid #e2e0dd',
                        minWidth: 65,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, idx) => (
                  <tr
                    key={`${row.student}:${row.copy}`}
                    style={{
                      borderBottom: '1px solid #eceae7',
                      background: row.is_teacher
                        ? '#caec87'
                        : idx % 2 === 0
                        ? '#ffffff'
                        : '#faf9f8',
                    }}
                    title={row.is_teacher ? 'Teacher answer sheet' : undefined}
                  >
                    <td
                      style={{
                        padding: '6px 12px',
                        borderRight: '1px solid #eceae7',
                        fontWeight: row.is_teacher ? 600 : 'normal',
                      }}
                    >
                      {row.exam}
                    </td>
                    <td
                      style={{
                        padding: '6px 12px',
                        borderRight: '1px solid #eceae7',
                        fontWeight: 600,
                      }}
                    >
                      {row.mark}
                    </td>
                    {data.columns.map((col) => (
                      <td
                        key={col}
                        style={{
                          padding: '6px 12px',
                          borderRight: '1px solid #eceae7',
                        }}
                      >
                        {row.scores[col] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Final Mean Row */}
                {data.mean && (
                  <tr
                    style={{
                      background: '#ffffff',
                      borderTop: '2px solid #ccc',
                      borderBottom: '1px solid #ccc',
                      fontWeight: 600,
                    }}
                  >
                    <td
                      style={{
                        padding: '7px 12px',
                        borderRight: '1px solid #eceae7',
                        color: '#111',
                      }}
                    >
                      {data.mean.exam}
                    </td>
                    <td
                      style={{
                        padding: '7px 12px',
                        borderRight: '1px solid #eceae7',
                        color: '#111',
                      }}
                    >
                      {data.mean.mark}
                    </td>
                    {data.columns.map((col) => (
                      <td
                        key={col}
                        style={{
                          padding: '7px 12px',
                          borderRight: '1px solid #eceae7',
                          color: '#111',
                        }}
                      >
                        {data.mean?.scores[col] ?? ''}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

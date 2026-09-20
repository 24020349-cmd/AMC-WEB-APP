import React, { useState, useEffect } from 'react';
import '../index.css';

interface ChooseColumnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableCsvHeaders: string[];
  initialSelectedColumns: string[];
  onSave: (columns: string[]) => void;
}

export const ChooseColumnsModal: React.FC<ChooseColumnsModalProps> = ({
  isOpen,
  onClose,
  availableCsvHeaders,
  initialSelectedColumns,
  onSave,
}) => {
  // Built-in special columns in AMC
  const defaultSpecialColumns = [
    '<student copy>',
    '<student identifier>',
    '<full name>',
  ];

  // Combine special columns and CSV headers
  const getAllAvailable = () => {
    const list = [...defaultSpecialColumns];
    for (const h of availableCsvHeaders) {
      if (!list.includes(h)) {
        list.push(h);
      }
    }
    return list;
  };

  // State: all ordered columns, and which ones are checked/selected
  const [columnsList, setColumnsList] = useState<string[]>([]);
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      const all = getAllAvailable();
      let initCols = initialSelectedColumns.length > 0 ? initialSelectedColumns : defaultSpecialColumns;
      
      // Order list: put selected first in their selected order, then the unselected remaining
      const ordered: string[] = [];
      const initSet = new Set<string>();
      for (const c of initCols) {
        if (all.includes(c)) {
          ordered.push(c);
          initSet.add(c);
        }
      }
      for (const c of all) {
        if (!ordered.includes(c)) {
          ordered.push(c);
        }
      }

      setColumnsList(ordered);
      setSelectedSet(initSet.size > 0 ? initSet : new Set(defaultSpecialColumns));
      setSelectedIndex(null);
    }
  }, [isOpen, availableCsvHeaders, initialSelectedColumns]);

  if (!isOpen) return null;

  const handleToggleSelect = (col: string) => {
    const next = new Set(selectedSet);
    if (next.has(col)) {
      next.delete(col);
    } else {
      next.add(col);
    }
    setSelectedSet(next);
  };

  const handleMoveUp = () => {
    if (selectedIndex === null || selectedIndex <= 0) return;
    const nextList = [...columnsList];
    const temp = nextList[selectedIndex - 1];
    nextList[selectedIndex - 1] = nextList[selectedIndex];
    nextList[selectedIndex] = temp;
    setColumnsList(nextList);
    setSelectedIndex(selectedIndex - 1);
  };

  const handleMoveDown = () => {
    if (selectedIndex === null || selectedIndex >= columnsList.length - 1) return;
    const nextList = [...columnsList];
    const temp = nextList[selectedIndex + 1];
    nextList[selectedIndex + 1] = nextList[selectedIndex];
    nextList[selectedIndex] = temp;
    setColumnsList(nextList);
    setSelectedIndex(selectedIndex + 1);
  };

  const handleUndo = () => {
    const all = getAllAvailable();
    const initCols = initialSelectedColumns.length > 0 ? initialSelectedColumns : defaultSpecialColumns;
    const ordered: string[] = [];
    const initSet = new Set<string>();
    for (const c of initCols) {
      if (all.includes(c)) {
        ordered.push(c);
        initSet.add(c);
      }
    }
    for (const c of all) {
      if (!ordered.includes(c)) {
        ordered.push(c);
      }
    }
    setColumnsList(ordered);
    setSelectedSet(initSet);
    setSelectedIndex(null);
  };

  const handleOk = () => {
    // Return the columns that are checked, in the current list order
    const result = columnsList.filter((c) => selectedSet.has(c));
    onSave(result.length > 0 ? result : defaultSpecialColumns);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1250 }} onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          borderRadius: 6,
          overflow: 'hidden',
          border: '1px solid #aaa6a1',
          boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          background: '#f5f4f2',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Title Bar matching AMC Desktop dialog */}
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
          <button
            type="button"
            className="btn"
            onClick={handleUndo}
            style={{
              padding: '3px 12px',
              fontSize: 12,
              background: '#ffffff',
              border: '1px solid #c2beb9',
              borderRadius: 3,
            }}
          >
            Undo
          </button>

          <div style={{ fontWeight: 700, fontSize: 13, color: '#333' }}>
            Choose columns to export
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOk}
            style={{
              padding: '3px 16px',
              fontSize: 12,
              fontWeight: 600,
              background: '#0078d4',
              color: '#ffffff',
              border: '1px solid #005a9e',
              borderRadius: 3,
            }}
          >
            OK
          </button>
        </div>

        {/* Subtitle / Instruction */}
        <div style={{ padding: '12px 14px 6px', fontSize: 12, color: '#333' }}>
          Order and select the columns to include in the exported file:
        </div>

        {/* Table / List View */}
        <div style={{ padding: '6px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              border: '1px solid #d2ceca',
              borderRadius: 3,
              background: '#ffffff',
              maxHeight: 280,
              overflowY: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr
                  style={{
                    background: '#f8f8f8',
                    borderBottom: '1px solid #e0deda',
                    textAlign: 'left',
                  }}
                >
                  <th style={{ width: 34, padding: '4px 8px', textAlign: 'center' }}></th>
                  <th style={{ padding: '4px 8px', fontWeight: 600, color: '#555' }}>
                    column
                  </th>
                </tr>
              </thead>
              <tbody>
                {columnsList.map((col, idx) => {
                  const isChecked = selectedSet.has(col);
                  const isRowActive = selectedIndex === idx;

                  return (
                    <tr
                      key={col}
                      onClick={() => setSelectedIndex(idx)}
                      onDoubleClick={() => handleToggleSelect(col)}
                      style={{
                        borderBottom: '1px solid #f0eeeB',
                        cursor: 'pointer',
                        background: isRowActive
                          ? '#0078d4'
                          : isChecked
                          ? '#f0f7ff'
                          : '#ffffff',
                        color: isRowActive ? '#ffffff' : '#333333',
                        userSelect: 'none',
                      }}
                    >
                      <td
                        style={{
                          padding: '4px 8px',
                          textAlign: 'center',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelect(col);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(col)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td
                        style={{
                          padding: '4px 8px',
                          fontFamily: 'inherit',
                        }}
                      >
                        {col}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Reordering Controls and Hint */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11,
              color: '#666',
            }}
          >
            <span>
              {selectedSet.size} of {columnsList.length} columns selected
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn"
                onClick={handleMoveUp}
                disabled={selectedIndex === null || selectedIndex === 0}
                style={{ padding: '2px 10px', fontSize: 11 }}
                title="Move selected column up"
              >
                ▲ Up
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleMoveDown}
                disabled={
                  selectedIndex === null || selectedIndex === columnsList.length - 1
                }
                style={{ padding: '2px 10px', fontSize: 11 }}
                title="Move selected column down"
              >
                ▼ Down
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

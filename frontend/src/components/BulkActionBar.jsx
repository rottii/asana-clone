import React, { useState, useRef, useEffect } from 'react';

export default function BulkActionBar({ selectedCount, sections, projectMembers, onAction, onClearSelection }) {
  const [openMenu, setOpenMenu] = useState(null); // 'assign' | 'date' | 'section' | null
  const [dateValue, setDateValue] = useState('');
  const barRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    if (openMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenu]);

  if (selectedCount === 0) return null;

  const handleAction = (action, payload) => {
    onAction(action, payload);
    setOpenMenu(null);
  };

  return (
    <div className="bulk-action-bar-ignore-click" style={styles.overlay}>
      <div ref={barRef} style={styles.bar}>
        {/* Selection count + close */}
        <div style={styles.countSection}>
          <button onClick={onClearSelection} style={styles.closeBtn} title="Deselect all">✕</button>
          <span style={styles.countText}>{selectedCount} task{selectedCount !== 1 ? 's' : ''} selected</span>
        </div>

        <div style={styles.divider} />

        {/* Mark Complete */}
        <button
          style={styles.actionBtn}
          onClick={() => handleAction('complete', { isCompleted: true })}
          title="Mark complete"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Complete</span>
        </button>

        {/* Mark Incomplete */}
        <button
          style={styles.actionBtn}
          onClick={() => handleAction('complete', { isCompleted: false })}
          title="Mark incomplete"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>
          <span>Incomplete</span>
        </button>

        <div style={styles.divider} />

        {/* Assign */}
        <div style={{ position: 'relative' }}>
          <button
            style={styles.actionBtn}
            onClick={() => setOpenMenu(openMenu === 'assign' ? null : 'assign')}
            title="Assign to"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>Assign</span>
          </button>
          {openMenu === 'assign' && (
            <div style={styles.dropdownMenu}>
              <button style={styles.dropdownItem} onClick={() => handleAction('assign', { assigneeId: null })}>
                <span style={{ color: 'var(--text-tertiary)' }}>Unassigned</span>
              </button>
              {(projectMembers || []).map(m => {
                const member = m.user || m;
                return (
                  <button key={member.id} style={styles.dropdownItem} onClick={() => handleAction('assign', { assigneeId: member.id })}>
                    <div style={styles.avatar}>{(member.name || '?')[0].toUpperCase()}</div>
                    <span>{member.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Due Date */}
        <div style={{ position: 'relative' }}>
          <button
            style={styles.actionBtn}
            onClick={() => setOpenMenu(openMenu === 'date' ? null : 'date')}
            title="Set due date"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Due date</span>
          </button>
          {openMenu === 'date' && (
            <div style={{ ...styles.dropdownMenu, padding: '0.75rem' }}>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                style={styles.dateInput}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  style={{ ...styles.dropdownActionBtn, backgroundColor: 'var(--accent-primary)', color: '#fff' }}
                  onClick={() => { if (dateValue) handleAction('dueDate', { dueDate: dateValue }); }}
                >
                  Apply
                </button>
                <button
                  style={styles.dropdownActionBtn}
                  onClick={() => handleAction('dueDate', { dueDate: null })}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Move to Section */}
        <div style={{ position: 'relative' }}>
          <button
            style={styles.actionBtn}
            onClick={() => setOpenMenu(openMenu === 'section' ? null : 'section')}
            title="Move to section"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            <span>Move</span>
          </button>
          {openMenu === 'section' && (
            <div style={styles.dropdownMenu}>
              {(sections || []).map(sec => (
                <button key={sec.id} style={styles.dropdownItem} onClick={() => handleAction('move', { sectionId: sec.id })}>
                  {sec.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={styles.divider} />

        {/* Delete */}
        <button
          style={{ ...styles.actionBtn, color: '#F87171' }}
          onClick={() => {
            if (window.confirm(`Delete ${selectedCount} task${selectedCount !== 1 ? 's' : ''}? This cannot be undone.`)) {
              handleAction('delete', {});
            }
          }}
          title="Delete selected"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    animation: 'bulkBarSlideUp 0.25s ease-out',
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#1F2937',
    borderRadius: '12px',
    padding: '6px 12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  countSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingRight: '4px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#9CA3AF',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '4px 6px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: '#E5E7EB',
    fontSize: '0.85rem',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  divider: {
    width: '1px',
    height: '24px',
    backgroundColor: 'rgba(255,255,255,0.15)',
    margin: '0 4px',
    flexShrink: 0,
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: 'none',
    color: '#D1D5DB',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: '500',
    padding: '6px 10px',
    borderRadius: '6px',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.15s',
  },
  dropdownMenu: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '8px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    padding: '4px',
    minWidth: '180px',
    maxHeight: '250px',
    overflowY: 'auto',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 12px',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    textAlign: 'left',
  },
  avatar: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    backgroundColor: '#6366F1',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.65rem',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  dateInput: {
    width: '100%',
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  dropdownActionBtn: {
    flex: 1,
    padding: '6px 0',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
};

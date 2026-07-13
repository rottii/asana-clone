import React from 'react';

const COLORS = [
  '#4F46E5', // Indigo
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#14B8A6', // Teal
];

const ICONS = [
  '📋', '🌟', '🚀', '🎯', '💡', '🔥', '🎉', '🛠️', '💻', '📈', '✅', '📁', '📊', '🤝', '⚡'
];

export default function IconColorPicker({ 
  selectedColor, 
  setSelectedColor, 
  selectedIcon, 
  setSelectedIcon, 
  onClose 
}) {
  return (
    <div style={styles.container} onClick={e => e.stopPropagation()}>
      <div style={styles.header}>
        <span style={styles.title}>Project Icon & Color</span>
        {onClose && (
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.label}>Colors</div>
        <div style={styles.grid}>
          {COLORS.map(c => (
            <div 
              key={c}
              onClick={() => setSelectedColor(c)}
              style={{
                ...styles.colorItem,
                backgroundColor: c,
                border: selectedColor === c ? '2px solid var(--text-primary)' : '2px solid transparent',
              }}
            />
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.label}>Icons</div>
        <div style={styles.grid}>
          {ICONS.map(i => (
            <div 
              key={i}
              onClick={() => setSelectedIcon(i)}
              style={{
                ...styles.iconItem,
                backgroundColor: selectedIcon === i ? '#F3F4F6' : 'transparent',
                borderColor: selectedIcon === i ? 'var(--text-secondary)' : 'transparent'
              }}
            >
              {i}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    width: '260px',
    padding: '12px',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px'
  },
  title: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: 0
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    fontWeight: '500'
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  colorItem: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    cursor: 'pointer',
    boxSizing: 'border-box'
  },
  iconItem: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    borderRadius: '4px',
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'all 0.1s'
  }
};

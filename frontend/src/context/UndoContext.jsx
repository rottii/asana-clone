import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const UndoContext = createContext();

export const useUndo = () => {
  return useContext(UndoContext);
};

export const UndoProvider = ({ children }) => {
  const [undoAction, setUndoAction] = useState(null);
  const undoActionRef = useRef(null);
  const timeoutRef = useRef(null);

  const showUndo = ({ message, onUndo, onCommit = null, timeoutMs = 5000 }) => {
    if (undoActionRef.current?.onCommit) {
      undoActionRef.current.onCommit();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const newUndoAction = { message, onUndo, onCommit };
    setUndoAction(newUndoAction);
    undoActionRef.current = newUndoAction;

    timeoutRef.current = setTimeout(() => {
      if (undoActionRef.current?.onCommit) {
        undoActionRef.current.onCommit();
      }
      setUndoAction(null);
      undoActionRef.current = null;
    }, timeoutMs);
  };

  const handleUndo = () => {
    if (!undoActionRef.current) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (undoActionRef.current.onUndo) {
      undoActionRef.current.onUndo();
    }
    
    setUndoAction(null);
    undoActionRef.current = null;
  };

  const handleClose = () => {
    if (!undoActionRef.current) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (undoActionRef.current.onCommit) {
      undoActionRef.current.onCommit();
    }
    
    setUndoAction(null);
    undoActionRef.current = null;
  };

  return (
    <UndoContext.Provider value={{ showUndo }}>
      {children}
      {undoAction && (
        <div style={styles.toastContainer}>
          <div style={styles.toast}>
            <span style={styles.message}>{undoAction.message}</span>
            <div style={styles.actions}>
              <button style={styles.undoBtn} onClick={handleUndo}>Undo</button>
              <button style={styles.closeBtn} onClick={handleClose}>✕</button>
            </div>
          </div>
        </div>
      )}
    </UndoContext.Provider>
  );
};

const styles = {
  toastContainer: {
    position: 'fixed',
    bottom: '24px',
    left: '24px',
    zIndex: 9999,
    animation: 'undoSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: '#1E1E20',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: '8px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    minWidth: '280px',
    justifyContent: 'space-between',
  },
  message: {
    fontSize: '0.9rem',
    fontWeight: '500',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  undoBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-primary, #6366F1)',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.9rem',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#9CA3AF',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'background-color 0.2s, color 0.2s',
  }
};

// Add animation styles dynamically if not present
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes undoSlideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
}

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';

export default function QuickAddTaskModal({ projects, token, onClose, onTaskCreated }) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [loading, setLoading] = useState(false);

  // When project changes, reset section
  useEffect(() => {
    setSectionId('');
  }, [projectId]);

  const selectedProject = projects.find(p => p.id === projectId);
  const sections = selectedProject?.sections || [];

  // Automatically select the first section if a project is selected
  useEffect(() => {
    if (sections.length > 0 && !sectionId) {
      // Sort sections by order
      const sortedSections = [...sections].sort((a, b) => a.order - b.order);
      setSectionId(sortedSections[0].id);
    }
  }, [sections, sectionId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !sectionId) return;

    setLoading(true);
    try {
      const response = await apiFetch('/api/projects/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: title.trim(), sectionId })
      });
      const data = await response.json();
      if (response.ok) {
        if (onTaskCreated) onTaskCreated(data);
        onClose();
      } else {
        alert(data.error || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Quick Add Task</h2>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Task Name</label>
            <input 
              type="text" 
              style={styles.input} 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="E.g. Draft Q3 Report"
              autoFocus
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Project</label>
            <select 
              style={styles.select} 
              value={projectId} 
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">Select a project</option>
              {projects.filter(p => p.status !== 'MY_TASKS').map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {projectId && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Section</label>
              <select 
                style={styles.select} 
                value={sectionId} 
                onChange={(e) => setSectionId(e.target.value)}
              >
                {sections.length === 0 && <option value="">No sections found</option>}
                {[...sections].sort((a,b) => a.order - b.order).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={styles.footer}>
            <button type="button" style={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button 
              type="submit" 
              style={{ ...styles.submitBtn, opacity: (!title.trim() || !sectionId || loading) ? 0.5 : 1 }} 
              disabled={!title.trim() || !sectionId || loading}
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999
  },
  modal: {
    backgroundColor: 'var(--bg-primary)', borderRadius: '8px', padding: '0',
    width: '400px', maxWidth: '90vw', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    display: 'flex', flexDirection: 'column'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)'
  },
  title: { margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer',
    color: 'var(--text-secondary)'
  },
  form: { padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  label: { fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-secondary)' },
  input: {
    padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px',
    fontSize: '0.95rem', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)'
  },
  select: {
    padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px',
    fontSize: '0.95rem', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)'
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem'
  },
  cancelBtn: {
    padding: '0.5rem 1rem', background: 'var(--bg-secondary)', border: 'none',
    borderRadius: '4px', cursor: 'pointer', fontWeight: '500', color: 'var(--text-primary)'
  },
  submitBtn: {
    padding: '0.5rem 1rem', background: 'var(--accent-primary)', border: 'none',
    borderRadius: '4px', cursor: 'pointer', fontWeight: '500', color: '#FFF'
  }
};

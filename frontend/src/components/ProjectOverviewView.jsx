import React, { useState } from 'react';

export default function ProjectOverviewView({ selectedProject, projectRole, isReadOnly, token, onUpdate }) {
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descInput, setDescInput] = useState(selectedProject.description || '');

  const handleSaveDescription = async () => {
    if (isReadOnly) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ description: descInput.trim() })
      });
      const data = await response.json();
      if (response.ok && onUpdate) {
        onUpdate(data);
      }
      setIsEditingDesc(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Members list calculation
  const members = [
    { ...selectedProject.owner, role: 'Owner' },
    ...(selectedProject.members || []).map(m => ({ ...m.user, role: m.role }))
  ];

  return (
    <div style={styles.overviewContainer}>
      <div style={styles.mainContent}>
        {/* Project Details Section */}
        <div style={styles.sectionCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ ...styles.sectionTitle, marginBottom: 0 }}>Project description</h2>
            {!isReadOnly && selectedProject.description && !isEditingDesc && (
              <button style={styles.editBtn} onClick={() => { setDescInput(selectedProject.description); setIsEditingDesc(true); }}>Edit</button>
            )}
          </div>
          <div style={styles.descriptionBox}>
            {isEditingDesc ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <textarea 
                  style={{ width: '100%', minHeight: '100px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontFamily: 'inherit', fontSize: '0.95rem' }}
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  placeholder="What's this project about?"
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button style={styles.cancelBtn} onClick={() => { setIsEditingDesc(false); setDescInput(selectedProject.description || ''); }}>Cancel</button>
                  <button style={styles.saveBtn} onClick={handleSaveDescription}>Save</button>
                </div>
              </div>
            ) : selectedProject.description ? (
              <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: '1.5' }}>{selectedProject.description}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 0', color: '#9CA3AF' }}>
                <span style={{ fontSize: '2rem', marginBottom: '1rem' }}>📝</span>
                <p>Welcome your team and set the tone for how you'll work together in this project.</p>
                {!isReadOnly && <button style={styles.addDescriptionBtn} onClick={() => { setDescInput(''); setIsEditingDesc(true); }}>Add description</button>}
              </div>
            )}
          </div>
        </div>

        {/* Key Resources Section */}
        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>Key resources</h2>
          <div style={styles.resourcesGrid}>
            <div style={styles.resourceItem}>
              <div style={styles.resourceIcon}>📎</div>
              <div>
                <div style={styles.resourceName}>Project Brief</div>
                <div style={styles.resourceMeta}>Created by {selectedProject.owner?.name}</div>
              </div>
            </div>
            {!isReadOnly && (
              <div style={{ ...styles.resourceItem, ...styles.resourceItemAdd }}>
                <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>+</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Add resource</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={styles.sidePanel}>
        {/* Status Update Section */}
        <div style={styles.sideSection}>
          <h3 style={styles.sideSectionTitle}>Project status</h3>
          <div style={styles.statusBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={styles.statusDot}></div>
              <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>On track</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Everything is running smoothly. Last updated today.</p>
            {!isReadOnly && <button style={styles.updateStatusBtn}>Update status</button>}
          </div>
        </div>

        {/* Project Roles / Members */}
        <div style={styles.sideSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={styles.sideSectionTitle}>Project roles</h3>
            {!isReadOnly && <span style={styles.addMemberLink}>Add member</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {members.map((member, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={styles.avatarCircle}>{member.name?.[0]?.toUpperCase() || '?'}</div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>{member.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{member.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overviewContainer: { display: 'flex', gap: '2rem', padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto', backgroundColor: 'var(--bg-secondary)' },
  mainContent: { flex: 2, display: 'flex', flexDirection: 'column', gap: '2rem' },
  sidePanel: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' },
  sectionCard: { backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  sectionTitle: { fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: 0 },
  descriptionBox: { minHeight: '150px' },
  addDescriptionBtn: { backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-primary)', cursor: 'pointer', marginTop: '1rem' },
  resourcesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' },
  resourceItem: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', transition: 'border-color 0.2s' },
  resourceItemAdd: { borderStyle: 'dashed', justifyContent: 'center', backgroundColor: 'var(--bg-tertiary)' },
  resourceIcon: { fontSize: '1.5rem' },
  resourceName: { fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)' },
  resourceMeta: { fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' },
  sideSection: { backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  sideSectionTitle: { fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 },
  statusBox: { marginTop: '1rem' },
  statusDot: { width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--accent-success)' },
  updateStatusBtn: { width: '100%', backgroundColor: 'var(--bg-tertiary)', border: 'none', borderRadius: '6px', padding: '0.5rem', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-primary)', cursor: 'pointer' },
  addMemberLink: { fontSize: '0.85rem', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: '500' },
  avatarCircle: { width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#EC4899', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 'bold' },
  saveBtn: { backgroundColor: 'var(--accent-primary)', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.85rem', fontWeight: '500', color: '#FFF', cursor: 'pointer' },
  cancelBtn: { backgroundColor: 'transparent', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-secondary)', cursor: 'pointer' },
  editBtn: { backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-primary)', cursor: 'pointer' }
};

import React, { useState, useRef, useEffect } from 'react';
import RichTextEditor from './RichTextEditor';

const statusConfig = {
  NONE: { color: 'var(--text-tertiary)', label: 'Set status', desc: 'No status set. Click to update.' },
  ON_TRACK: { color: 'var(--accent-success)', label: 'On track', desc: 'Everything is running smoothly.' },
  AT_RISK: { color: '#F59E0B', label: 'At risk', desc: 'There are some concerns.' },
  OFF_TRACK: { color: 'var(--accent-danger)', label: 'Off track', desc: 'Requires immediate attention.' },
  ON_HOLD: { color: 'var(--text-secondary)', label: 'On hold', desc: 'Project is paused.' },
  COMPLETE: { color: 'var(--accent-primary)', label: 'Complete', desc: 'Project is finished.' }
};

export default function ProjectOverviewView({ selectedProject, projectRole, isReadOnly, token, onUpdate, onOpenShareModal }) {
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descInput, setDescInput] = useState(selectedProject.description || '');
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef(null);

  const [isEditingGithub, setIsEditingGithub] = useState(false);
  const [githubInput, setGithubInput] = useState(selectedProject.githubRepo || '');
  const [githubDetails, setGithubDetails] = useState(null);

  useEffect(() => {
    if (selectedProject.githubRepo && !isEditingGithub) {
      let repoPath = selectedProject.githubRepo.replace('https://github.com/', '').trim();
      fetch(`https://api.github.com/repos/${repoPath}`)
        .then(res => res.json())
        .then(data => {
          if (data && !data.message) {
            setGithubDetails(data);
          }
        })
        .catch(err => console.error(err));
    }
  }, [selectedProject.githubRepo, isEditingGithub]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) {
        setIsStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUpdateStatus = async (newStatus) => {
    if (isReadOnly) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (response.ok && onUpdate) {
        onUpdate(data);
      }
      setIsStatusMenuOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

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

  const handleSaveGithub = async () => {
    if (isReadOnly) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ githubRepo: githubInput.trim() })
      });
      const data = await response.json();
      if (response.ok && onUpdate) {
        onUpdate(data);
      }
      setIsEditingGithub(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Format roles from UPPERCASE to Title Case
  const formatRole = (role) => {
    if (!role) return '';
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

  // Members list calculation
  const allMembers = [
    { ...selectedProject.owner, role: 'Owner' },
    ...(selectedProject.members || []).map(m => ({ ...m.user, role: formatRole(m.role) }))
  ];
  
  // Deduplicate by user id so the owner isn't listed twice
  const members = allMembers.filter((member, index, self) => 
    index === self.findIndex((t) => t.id === member.id)
  );

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
                <RichTextEditor
                  value={descInput}
                  onChange={setDescInput}
                  users={members}
                  minHeight="100px"
                />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button style={styles.cancelBtn} onClick={() => { setIsEditingDesc(false); setDescInput(selectedProject.description || ''); }}>Cancel</button>
                  <button style={styles.saveBtn} onClick={handleSaveDescription}>Save</button>
                </div>
              </div>
            ) : selectedProject.description ? (
              <div className="rich-text-content" style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: '1.5' }} dangerouslySetInnerHTML={{ __html: selectedProject.description }} />
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

        {/* GitHub Integration Section */}
        <div style={styles.sectionCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ ...styles.sectionTitle, marginBottom: 0 }}>GitHub Integration</h2>
            {!isReadOnly && selectedProject.githubRepo && !isEditingGithub && (
              <button style={styles.editBtn} onClick={() => { setGithubInput(selectedProject.githubRepo); setIsEditingGithub(true); }}>Edit</button>
            )}
          </div>
          <div style={styles.descriptionBox}>
            {isEditingGithub ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="e.g. koala73/worldmonitor or https://github.com/koala73/worldmonitor"
                  value={githubInput}
                  onChange={(e) => setGithubInput(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button style={styles.cancelBtn} onClick={() => { setIsEditingGithub(false); setGithubInput(selectedProject.githubRepo || ''); }}>Cancel</button>
                  <button style={styles.saveBtn} onClick={handleSaveGithub}>Save</button>
                </div>
              </div>
            ) : selectedProject.githubRepo ? (
              githubDetails ? (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px', backgroundColor: 'var(--bg-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <img src={githubDetails.owner?.avatar_url} alt="Owner Avatar" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                    <a href={githubDetails.html_url} target="_blank" rel="noreferrer" style={{ color: '#0969da', fontWeight: '600', fontSize: '1.1rem', textDecoration: 'none' }}>
                      {githubDetails.full_name}
                    </a>
                    <span style={{ padding: '2px 7px', fontSize: '0.75rem', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '2em', marginLeft: '4px' }}>
                      {githubDetails.private ? 'Private' : 'Public'}
                    </span>
                  </div>
                  {githubDetails.description && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                      {githubDetails.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {githubDetails.language && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f1e05a' }}></span>
                        {githubDetails.language}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path></svg>
                      {githubDetails.stargazers_count}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"></path></svg>
                      {githubDetails.forks_count}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-primary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.25 2.25 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 7.425A3.155 3.155 0 0012.75 12h.75a.75.75 0 01.75.75v.5a.75.75 0 01-.75.75H12a4.655 4.655 0 01-4.655-4.655V5.372a2.25 2.25 0 111.5 0v3.983c0 .713.273 1.398.75 1.916V7.425z"></path>
                  </svg>
                  <span>{selectedProject.githubRepo}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginLeft: '8px' }}>(Loading GitHub data...)</span>
                </div>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 0', color: '#9CA3AF' }}>
                <span style={{ fontSize: '2rem', marginBottom: '1rem' }}>🐙</span>
                <p>Connect a GitHub repository to enable Auto-Code AI features.</p>
                {!isReadOnly && <button style={styles.addDescriptionBtn} onClick={() => { setGithubInput(''); setIsEditingGithub(true); }}>Connect Repository</button>}
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
              <div style={{ ...styles.statusDot, backgroundColor: statusConfig[selectedProject.status || 'NONE'].color }}></div>
              <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>{statusConfig[selectedProject.status || 'NONE'].label}</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{statusConfig[selectedProject.status || 'NONE'].desc}</p>
            {!isReadOnly && (
              <div style={{ position: 'relative' }} ref={statusMenuRef}>
                <button 
                  style={styles.updateStatusBtn} 
                  onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                >
                  Update status
                </button>
                {isStatusMenuOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', width: '200px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, display: 'flex', flexDirection: 'column', padding: '8px 0' }}>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => handleUpdateStatus(key)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: config.color }}></div>
                        {config.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Project Roles / Members */}
        <div style={styles.sideSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={styles.sideSectionTitle}>Project roles</h3>
            {!isReadOnly && <span style={styles.addMemberLink} onClick={onOpenShareModal}>Add member</span>}
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

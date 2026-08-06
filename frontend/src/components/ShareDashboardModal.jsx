import React, { useState } from 'react';
import { apiFetch } from '../api';

export default function ShareDashboardModal({ project, token, onClose, onProjectUpdated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isPublic = project.isPublicDashboard;
  const publicToken = project.publicToken;
  const publicLink = publicToken ? `${window.location.origin}/public/dashboard/projects/${publicToken}` : '';

  const handleGenerateLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/projects/${project.id}/public-link`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        onProjectUpdated(data);
      } else {
        setError(data.error || 'Failed to generate link');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/projects/${project.id}/public-link`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        onProjectUpdated(data);
      } else {
        setError(data.error || 'Failed to revoke link');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Share Dashboard</h2>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.content}>
          <p style={styles.description}>
            Create a public, read-only link to share this project's dashboard with external customers or stakeholders without requiring them to log in.
          </p>

          {error && <div style={styles.error}>{error}</div>}

          {isPublic && publicToken ? (
            <div style={styles.linkContainer}>
              <div style={styles.statusBadge}>Link Active</div>
              <div style={styles.linkRow}>
                <input type="text" readOnly value={publicLink} style={styles.linkInput} />
                <button 
                  onClick={handleCopy} 
                  style={{
                    ...styles.copyBtn, 
                    backgroundColor: copied ? 'var(--accent-success)' : 'var(--accent-primary)'
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <button onClick={handleRevokeLink} disabled={loading} style={styles.revokeBtn}>
                {loading ? 'Disabling...' : 'Disable Public Link'}
              </button>
            </div>
          ) : (
            <div style={styles.linkContainer}>
              <button onClick={handleGenerateLink} disabled={loading} style={styles.generateBtn}>
                {loading ? 'Generating...' : 'Generate Public Link'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 },
  modal: { backgroundColor: 'var(--bg-primary)', borderRadius: '8px', width: '500px', maxWidth: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' },
  closeBtn: { background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' },
  content: { padding: '1.5rem' },
  description: { color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' },
  error: { color: 'var(--accent-danger)', marginBottom: '1rem', fontSize: '0.9rem' },
  linkContainer: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  statusBadge: { alignSelf: 'flex-start', backgroundColor: 'var(--accent-success)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' },
  linkRow: { display: 'flex', gap: '0.5rem' },
  linkInput: { flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' },
  copyBtn: { padding: '0.5rem 1rem', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  revokeBtn: { alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline', padding: 0, marginTop: '0.5rem' },
  generateBtn: { width: '100%', padding: '0.75rem', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }
};

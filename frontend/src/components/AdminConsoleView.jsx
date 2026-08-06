import React, { useState, useEffect } from 'react';
import UserAvatar from './UserAvatar';
import { apiFetch } from '../api';

const styles = {
  container: {
    padding: '2rem 3rem',
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box'
  },
  header: {
    marginBottom: '2rem'
  },
  title: {
    fontSize: '2rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: '0 0 0.5rem 0'
  },
  subtitle: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    margin: 0
  },
  card: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    overflow: 'hidden'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left'
  },
  th: {
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--border-color)',
    color: 'var(--text-secondary)',
    fontWeight: '500',
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  td: {
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--border-color)',
    verticalAlign: 'middle'
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem'
  },
  name: {
    fontWeight: '500',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    marginBottom: '0.2rem'
  },
  email: {
    color: 'var(--text-secondary)',
    fontSize: '0.85rem'
  },
  select: {
    padding: '0.5rem',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
    cursor: 'pointer'
  },
  removeBtn: {
    padding: '0.5rem 1rem',
    backgroundColor: 'transparent',
    color: '#ef4444',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  removeBtnDisabled: {
    padding: '0.5rem 1rem',
    backgroundColor: 'transparent',
    color: 'var(--text-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    fontSize: '0.85rem',
    cursor: 'not-allowed',
    fontWeight: '500'
  },
  errorBox: {
    padding: '1rem',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    borderRadius: '8px',
    marginBottom: '1rem',
    border: '1px solid #f87171'
  },
  loadingBox: {
    padding: '2rem',
    textAlign: 'center',
    color: 'var(--text-secondary)'
  }
};

export default function AdminConsoleView({ workspaceId, token, currentUser }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMembers();
  }, [workspaceId]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/api/workspaces/${workspaceId}/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch members');
      setMembers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await apiFetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setMembers(members.map(m => m.userId === userId ? { ...m, role: newRole } : m));
    } catch (err) {
      alert(`Error updating role: ${err.message}`);
    }
  };

  const handleRemoveMember = async (userId, userName) => {
    if (userName === 'yourself') {
      if (!window.confirm(`Are you sure you want to leave this workspace? You will lose access to all projects and teams.`)) return;
    } else {
      if (!window.confirm(`Are you sure you want to remove ${userName} from the workspace? They will lose access to all projects and teams.`)) return;
    }
    
    try {
      const res = await apiFetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setMembers(members.filter(m => m.userId !== userId));
    } catch (err) {
      alert(`Error removing member: ${err.message}`);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!window.confirm("WARNING: Are you absolutely sure you want to delete this entire workspace? This will permanently delete all projects, teams, tasks, and data within it. This action CANNOT be undone.")) return;
    
    try {
      const res = await apiFetch(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      alert("Workspace deleted successfully. Please refresh the page.");
      window.location.reload();
    } catch (err) {
      alert(`Error deleting workspace: ${err.message}`);
    }
  };

  if (loading) return <div style={styles.loadingBox}>Loading admin console...</div>;
  if (error) return (
    <div style={styles.container}>
      <div style={styles.errorBox}>
        <strong>Access Denied:</strong> {error}
      </div>
    </div>
  );

  const myMemberRecord = members.find(m => m.userId === currentUser?.id);
  const oldestAdmin = [...members].filter(m => m.role === 'ADMIN').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
  const isOriginalAdmin = oldestAdmin && myMemberRecord && oldestAdmin.userId === myMemberRecord.userId;

  return (
    <div style={styles.container}>
      <div style={{ ...styles.header, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={styles.title}>Admin Console</h1>
          <p style={styles.subtitle}>Manage workspace members, guests, and their permissions.</p>
        </div>
        
        {isOriginalAdmin ? (
          <button 
            onClick={handleDeleteWorkspace}
            style={{
              backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px',
              padding: '8px 16px', fontSize: '0.9rem', fontWeight: '500', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
          >
            🗑️ Delete Workspace
          </button>
        ) : null}
      </div>

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Member</th>
              <th style={styles.th}>Role</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map(member => {
              const isMe = member.userId === currentUser?.id;
              
              // Protect older admins from being modified by newer admins
              const isOlderAdmin = !isMe && myMemberRecord && member.role === 'ADMIN' && new Date(member.createdAt) < new Date(myMemberRecord.createdAt);
              const isControlDisabled = isMe || isOlderAdmin;
              
              return (
                <tr key={member.userId}>
                  <td style={styles.td}>
                    <div style={styles.memberRow}>
                      <UserAvatar name={member.user?.name} size={40} />
                      <div>
                        <div style={styles.name}>
                          {member.user?.name} {isMe && '(You)'} {isOlderAdmin && '(Creator)'}
                        </div>
                        <div style={styles.email}>{member.user?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <select 
                      style={isControlDisabled ? { ...styles.select, cursor: 'not-allowed' } : styles.select} 
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                      disabled={isControlDisabled}
                      title={isOlderAdmin ? "You cannot modify the role of an admin who joined before you" : ""}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MEMBER">Member</option>
                      <option value="GUEST">Guest</option>
                    </select>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <button 
                      style={isControlDisabled && !isMe ? { ...styles.removeBtn, cursor: 'not-allowed' } : styles.removeBtn}
                      disabled={isControlDisabled && !isMe}
                      onClick={() => handleRemoveMember(member.userId, isMe ? 'yourself' : member.user?.name)}
                      onMouseEnter={(e) => { if (!isControlDisabled || isMe) e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                      onMouseLeave={(e) => { if (!isControlDisabled || isMe) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      title={isOlderAdmin ? "You cannot remove an admin who joined before you" : ""}
                    >
                      {isMe ? 'Leave' : 'Remove'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

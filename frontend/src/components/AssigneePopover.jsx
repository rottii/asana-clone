import { useState, useEffect } from 'react'

export default function AssigneePopover({ task, token, coords, project, onAssigneeUpdated }) {
  const [searchQuery, setSearchQuery] = useState('')

  const users = (() => {
    if (!project) return [];
    const members = project.members?.map(m => m.user) || [];
    if (project.owner && !members.find(u => u.id === project.owner.id)) {
      members.push(project.owner);
    }
    return members;
  })();

  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  }

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelectUser = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ assigneeId: userId })
      })
      const updatedTask = await response.json()

      if (!response.ok) {
        alert(updatedTask.error || "Bu işlemi yapmak için yetkiniz yok.");
        return;
      }

      onAssigneeUpdated(task.id, updatedTask)
    } catch (err) { console.error(err) }
  }

  return (
    <div 
      style={{ 
        ...styles.popover, 
        top: coords.top !== undefined ? `${coords.top}px` : 'auto', 
        bottom: coords.bottom !== undefined ? `${coords.bottom}px` : 'auto', 
        left: `${coords.left}px` 
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={styles.headerRow}>
        <span style={styles.titleLabel}>Assign To Project Member</span>
      </div>

      <div style={styles.searchContainer}>
        <input 
          type="text" 
          placeholder="Teammate ara..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
          autoFocus
        />
        {searchQuery && <span onClick={() => setSearchQuery('')} style={styles.clearCross}>×</span>}
      </div>

      <div style={styles.usersList}>
        {filteredUsers.length > 0 ? (
          filteredUsers.map(user => (
            <div 
              key={user.id} 
              onClick={() => handleSelectUser(user.id)}
              style={{
                ...styles.userItem,
                backgroundColor: task.assigneeId === user.id ? '#F3F4F6' : 'transparent'
              }}
            >
              <div style={styles.avatarCircle}>{getInitials(user.name)}</div>
              <div style={styles.userInfo}>
                <div style={styles.userName}>{user.name}</div>
                <div style={styles.userEmail}>{user.email}</div>
              </div>
            </div>
          ))
        ) : (
          <div style={styles.noResult}>Atanabilir yetkili üye bulunamadı</div>
        )}
      </div>

      <div style={styles.footerRow}>
        <button onClick={() => handleSelectUser(null)} style={styles.unassignBtn}>Remove Assignee</button>
      </div>
    </div>
  )
}

const styles = {
  popover: { position: 'fixed', backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100005, padding: '0.75rem 0', width: '280px', boxSizing: 'border-box' },
  headerRow: { padding: '0 1rem 0.5rem 1rem', display: 'flex', justifyContent: 'space-between' },
  titleLabel: { color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '600' },
  searchContainer: { padding: '0 1rem 0.75rem 1rem', position: 'relative', display: 'flex', alignItems: 'center' },
  searchInput: { width: '100%', backgroundColor: 'var(--bg-secondary)', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '0.4rem 2rem 0.4rem 0.6rem', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' },
  clearCross: { position: 'absolute', right: '1.5rem', color: '#9CA3AF', cursor: 'pointer', fontSize: '1.1rem' },
  usersList: { maxHeight: '200px', overflowY: 'auto', borderTop: '1px solid #E5E7EB', paddingTop: '0.25rem' },
  userItem: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', cursor: 'pointer', transition: 'background-color 0.15s' },
  avatarCircle: { width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#4F46E5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' },
  userInfo: { display: 'flex', flexDirection: 'column' },
  userName: { color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: '500' },
  userEmail: { color: 'var(--text-secondary)', fontSize: '0.75rem' },
  noResult: { color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' },
  footerRow: { borderTop: '1px solid #E5E7EB', marginTop: '0.25rem', padding: '0.5rem 1rem 0 1rem', display: 'flex', justifyContent: 'flex-end' },
  unassignBtn: { background: 'none', border: 'none', color: '#EF4444', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '500' }
}

import { useState, useEffect } from 'react'
import UserAvatar from './UserAvatar'

export default function ShareProjectModal({ project, token, currentUser, onClose, onProjectUpdated }) {
  const [emailInput, setEmailInput] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [activeMenuMemberId, setActiveMenuMemberId] = useState(null)
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const closeMenu = () => setActiveMenuMemberId(null)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!emailInput.trim()) return
    setInviteMessage('')
    try {
      const response = await fetch(`http://localhost:5001/api/projects/${project.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: emailInput.trim() })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      onProjectUpdated(data)
      setEmailInput('')
      setInviteMessage('User added successfully!')
    } catch (err) { setInviteMessage(err.message) }
  }

  const handleUpdateRole = async (userId, newRole) => {
    try {
      let response;
      if (newRole === 'REMOVE') {
        response = await fetch(`http://localhost:5001/api/projects/${project.id}/members/${userId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })
      } else {
        response = await fetch(`http://localhost:5001/api/projects/${project.id}/members`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ userId, role: newRole })
        })
      }
      
      const data = await response.json()
      onProjectUpdated(data)
      setActiveMenuMemberId(null)
    } catch (err) { console.error(err) }
  }

  const handleOpenRoleMenu = (e, memberId) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuCoords({ top: rect.bottom + 5, left: rect.left - 180 }) 
    setActiveMenuMemberId(activeMenuMemberId === memberId ? null : memberId)
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  }

  const formatRoleText = (role) => {
    if (!role) return ''
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
  }

  const isProjectAdmin = project?.ownerId === currentUser?.id || 
                         project?.members?.find(m => m.user?.id === currentUser?.id)?.role === 'ADMIN';

  return (
    <div style={styles.backdrop} onClick={() => { setActiveMenuMemberId(null); onClose(); }}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Share "{project.name}"</h2>
          <button onClick={onClose} style={styles.closeXBtn}>×</button>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={styles.sectionLabel}>Invite with email</label>
          <form onSubmit={handleInvite} style={styles.inviteFormRow}>
            <div style={styles.inputWrapper}>
              <input 
                type="email" 
                placeholder="Add members by name or email..." 
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                style={styles.inviteInput}
                required
              />
            </div>
            <button type="submit" style={styles.inviteBtn}>Invite</button>
          </form>
          {inviteMessage && <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: inviteMessage.includes('başarıyla') ? 'green' : 'red' }}>{inviteMessage}</p>}
        </div>

        <div>
          <label style={styles.sectionLabel}>Who has access</label>
          <div style={styles.accessListContainer}>

            {/* Proje Sahibi */}
            <div style={styles.accessItemRow}>
              <UserAvatar name={project.owner?.name || 'Admin'} size={32} style={{ marginRight: '1rem' }} />
              <div style={styles.memberInfoBlock}>
                <div style={styles.memberNameText}>{project.owner?.name} {currentUser && project.ownerId === currentUser.id ? '(You)' : ''}</div>
                <div style={styles.memberEmailText}>{project.owner?.email}</div>
              </div>
              <span style={styles.roleAdminText}>Project admin</span>
            </div>

            {/* Dinamik Eklenen Üyeler (Defansif Koruma Eklendi) */}
            {project.members?.filter(m => m?.user?.id !== project.owner?.id).map(membership => {
              if (!membership || !membership.user) return null; // Veri bozuksa render etme, çökme önle!
              return (
                <div key={membership.user.id} style={styles.accessItemRow}>
                  <UserAvatar name={membership.user.name} size={32} style={{ marginRight: '1rem' }} />
                  <div style={styles.memberInfoBlock}>
                    <div style={styles.memberNameText}>{membership.user.name} {currentUser && membership.user.id === currentUser.id ? '(You)' : ''}</div>
                    <div style={styles.memberEmailText}>{membership.user.email}</div>
                  </div>
                  
                  {isProjectAdmin || (currentUser && membership.user.id === currentUser.id) ? (
                    <span 
                      onClick={(e) => handleOpenRoleMenu(e, membership.user.id)} 
                      style={styles.roleTriggerText}
                    >
                      {formatRoleText(membership.role)} ▼
                    </span>
                  ) : (
                    <span style={styles.roleReadOnlyText}>
                      {formatRoleText(membership.role)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ROL DEĞİŞTİRME POPOVER'I */}
        {activeMenuMemberId && (
          <div 
            style={{ ...styles.roleMenuPopover, top: `${menuCoords.top}px`, left: `${menuCoords.left}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* KENDİM HARİÇ BİRİYSE TÜM ROLLERİ GÖSTER */}
            {currentUser && activeMenuMemberId !== currentUser.id && (
              <>
                <div onClick={() => handleUpdateRole(activeMenuMemberId, 'EDITOR')} style={styles.menuItemRow}>
                  <div style={styles.tickCell}>{project.members?.find(m => m.user?.id === activeMenuMemberId)?.role === 'EDITOR' ? '✓' : ''}</div>
                  <div>
                    <div style={styles.itemTitle}>Editor</div>
                    <div style={styles.itemDesc}>Can add, edit, and delete anything in the project.</div>
                  </div>
                </div>

                <div onClick={() => handleUpdateRole(activeMenuMemberId, 'COMMENTER')} style={styles.menuItemRow}>
                  <div style={styles.tickCell}>{project.members?.find(m => m.user?.id === activeMenuMemberId)?.role === 'COMMENTER' ? '✓' : ''}</div>
                  <div>
                    <div style={styles.itemTitle}>Commenter 🔒</div>
                    <div style={styles.itemDesc}>Can comment, but can't edit anything in the project.</div>
                  </div>
                </div>

                <div onClick={() => handleUpdateRole(activeMenuMemberId, 'VIEWER')} style={styles.menuItemRow}>
                  <div style={styles.tickCell}>{project.members?.find(m => m.user?.id === activeMenuMemberId)?.role === 'VIEWER' ? '✓' : ''}</div>
                  <div>
                    <div style={styles.itemTitle}>Viewer 🔒</div>
                    <div style={styles.itemDesc}>Can view, but can't add comments or edit the project.</div>
                  </div>
                </div>

                <div style={styles.divider}></div>
              </>
            )}

            {/* SADECE AYRILMA / ÇIKARMA SEÇENEĞİ */}
            <div 
              onClick={() => handleUpdateRole(activeMenuMemberId, 'REMOVE')}
              style={{ ...styles.menuItemRow, color: '#EF4444' }}
            >
              <div style={styles.tickCell}>🚫</div>
              <div>
                <div style={{ ...styles.itemTitle, color: '#EF4444' }}>
                  {currentUser && activeMenuMemberId === currentUser.id ? 'Leave project' : 'Remove from project'}
                </div>
                <div style={styles.itemDesc}>
                  {currentUser && activeMenuMemberId === currentUser.id 
                    ? 'You will lose access to this project.' 
                    : "Will lose all direct access to this project's board."}
                </div>
              </div>
            </div>

          </div>
        )}

        <div style={styles.modalFooter}>
          <button type="button" onClick={() => alert('Link copied!')} style={styles.copyLinkBtn}>🔗 Copy project link</button>
        </div>

      </div>
    </div>
  )
}

const styles = {
  backdrop: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100005 },
  modalBox: { backgroundColor: 'var(--bg-primary)', width: '460px', maxWidth: '95%', borderRadius: '12px', boxShadow: '0 20px 25px rgba(0,0,0,0.1)', padding: '1.25rem', boxSizing: 'border-box', fontFamily: 'system-ui', position: 'relative' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' },
  modalTitle: { margin: 0, fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)' },
  closeXBtn: { background: 'none', border: 'none', fontSize: '1.6rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 },
  sectionLabel: { display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' },
  inviteFormRow: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
  inputWrapper: { flex: 1, border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-primary)' },
  inviteInput: { width: '100%', border: 'none', padding: '0.5rem', fontSize: '0.85rem', outline: 'none', borderRadius: '6px', boxSizing: 'border-box', background: 'transparent', color: 'var(--text-primary)' },
  inviteBtn: { backgroundColor: 'var(--accent-primary)', color: '#FFF', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' },
  accessListContainer: { display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: '8px' },
  accessItemRow: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  avatarCircle: { width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#EC4899', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' },
  memberInfoBlock: { flex: 1, display: 'flex', flexDirection: 'column' },
  memberNameText: { fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-primary)' },
  memberEmailText: { fontSize: '0.7rem', color: 'var(--text-secondary)' },
  roleAdminText: { fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '500', paddingRight: '0.25rem' },
  roleTriggerText: { fontSize: '0.8rem', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: '600', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)' },
  roleReadOnlyText: { fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '500', padding: '0.2rem 0.5rem' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' },
  copyLinkBtn: { background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' },
  roleMenuPopover: { position: 'fixed', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', zIndex: 10001, width: '250px', boxSizing: 'border-box', padding: '0.25rem 0' },
  menuItemRow: { display: 'flex', gap: '0.5rem', padding: '0.5rem 0.75rem', cursor: 'pointer', transition: 'background-color 0.15s' },
  tickCell: { width: '16px', display: 'flex', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent-primary)', marginTop: '1px' },
  itemTitle: { fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '1px' },
  itemDesc: { fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.3' },
  divider: { height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }
}

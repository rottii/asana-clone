import { useState } from 'react'
import TaskCard from './TaskCard'

export default function KanbanColumn({ section, token, isVirtualGrouping, customFieldSettings, projectMembers, onTaskUpdate, onTaskContextMenu, onOpenApprovalMenu, onDeleteSection, onRenameSection, onGeneralDrop, onOpenPopover, onOpenTaskPane, projectRole, handleLiveTaskSwap, draggingTaskId, setDraggingTaskId, draggableSection, onDragStartSection, onDragEndSection, setLastInteractedSectionId, setLastInteractedTaskId }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState(section.name)

  const isReadOnly = projectRole === 'VIEWER' || projectRole === 'COMMENTER';

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (isReadOnly) return
    if (!newTaskTitle.trim()) return
    try {
      const response = await fetch('http://localhost:5001/api/projects/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: newTaskTitle, sectionId: section.id })
      })
      const data = await response.json()
      if (!response.ok) { alert(data.error); return; }
      onTaskUpdate(data.id, data, 'create', section.id)
      setNewTaskTitle('')
    } catch (err) { console.error(err) }
  }

  const submitRename = () => {
    setIsEditingName(false);
    if (editNameValue.trim() !== section.name) {
      if (onRenameSection) onRenameSection(section.id, editNameValue);
    }
  };

  return (
    <div 
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { 
        e.stopPropagation();
        if (!isVirtualGrouping) onGeneralDrop(e, section.id); 
      }}
      style={styles.kanbanColumn}
    >
      {/* Sütun Başlığı */}
      <div 
        className="section-header"
        draggable={draggableSection}
        onDragStart={onDragStartSection}
        onDragEnd={onDragEndSection}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', position: 'relative', cursor: isReadOnly || isEditingName || isVirtualGrouping ? 'default' : 'move', flexShrink: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          {isEditingName ? (
            <input 
              autoFocus 
              value={editNameValue} 
              onChange={e => setEditNameValue(e.target.value)} 
              onBlur={submitRename}
              onKeyDown={e => e.key === 'Enter' && submitRename()}
              style={{ ...styles.miniInput, flex: 1 }}
            />
          ) : (
            <h3 
              onClick={() => { if (!isReadOnly && !isVirtualGrouping) setIsEditingName(true); }}
              style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 'bold', cursor: (!isReadOnly && !isVirtualGrouping) ? 'text' : 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {section.name}
            </h3>
          )}
          {!isEditingName && <span style={styles.taskCountBadge}>{section.tasks?.length || 0}</span>}
        </div>
        
        {/* Sadece yetkili kullanıcılar sütun yönetim menüsünü görebilir */}
        {!isReadOnly && !isEditingName && !isVirtualGrouping && (
          <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen) }} style={styles.threeDotButton}>⋮</button>
        )}
        
        {isMenuOpen && (
          <div style={styles.dropdownMenu} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setIsEditingName(true); setIsMenuOpen(false) }} style={styles.dropdownItem}>Yeniden Adlandır</button>
            <button onClick={() => { onDeleteSection(section.id); setIsMenuOpen(false) }} style={styles.dropdownItemDelete}>Bölümü Sil</button>
          </div>
        )}
      </div>

      {/* SADECE GÖREV KARTLARININ KAYDIRILDIĞI SCROLL ALANI */}
      <div className="kanban-task-list" style={styles.taskListContainer}>
        {section.tasks?.map(task => (
          <div 
            key={task.id} 
            style={{ width: '248px', flexShrink: 0 }}
            onClickCapture={() => {
              if (setLastInteractedSectionId) setLastInteractedSectionId(section.id);
              if (setLastInteractedTaskId) setLastInteractedTaskId(task.id);
            }}
          >
            <TaskCard 
              task={task} 
              token={token} 
              onTaskUpdate={onTaskUpdate} 
              onTaskContextMenu={onTaskContextMenu} 
              onOpenApprovalMenu={onOpenApprovalMenu}
              onOpenPopover={onOpenPopover}
              onOpenTaskPane={onOpenTaskPane}
              isVirtualGrouping={isVirtualGrouping}
              customFieldSettings={customFieldSettings}
              projectMembers={projectMembers}
              projectRole={projectRole} // Karta kadar yetki delegasyonu
              handleLiveTaskSwap={handleLiveTaskSwap}
              draggingTaskId={draggingTaskId}
              setDraggingTaskId={setDraggingTaskId}
            />
          </div>
        ))}
      </div>

      {/* Sadece yetkili kullanıcılar hızlı görev ekleme alanını görür */}
      {!isReadOnly && !isVirtualGrouping ? (
        <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0, marginTop: 'auto' }}>
          <input type="text" placeholder="+ Add task..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} style={styles.miniInput} required />
          <button type="submit" style={styles.miniButton}>Add</button>
        </form>
      ) : isReadOnly ? (
        <div style={styles.readOnlyFooter}>👁️ Read Only Mode</div>
      ) : null}
    </div>
  )
}

const styles = {
  kanbanColumn: { backgroundColor: 'var(--bg-tertiary)', width: '280px', minWidth: '280px', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '100%', boxSizing: 'border-box' },
  taskListContainer: { display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', flex: 1, overflowY: 'auto', overflowX: 'hidden', marginRight: '-8px', paddingRight: '8px' },
  taskCountBadge: { backgroundColor: 'var(--border-color)', color: 'var(--text-primary)', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '10px', fontWeight: 'bold' },
  threeDotButton: { background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0 0.5rem' },
  dropdownMenu: { position: 'absolute', top: '100%', right: 0, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 10, padding: '0.25rem', minWidth: '120px' },
  dropdownItem: { width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', textAlign: 'left', marginBottom: '2px' },
  dropdownItemDelete: { width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'transparent', color: 'var(--accent-danger)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', textAlign: 'left' },
  miniInput: { padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' },
  miniButton: { padding: '0.4rem', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' },
  readOnlyFooter: { textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: '600', padding: '0.5rem 0', borderTop: '1px dashed var(--border-color)', marginTop: 'auto' }
}

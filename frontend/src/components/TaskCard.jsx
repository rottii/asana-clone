import React, { useState, useEffect, useRef } from 'react'
import AddFieldModal from './AddFieldModal'

let globalLastDragY = 0;

export default function TaskCard({ task, token, isVirtualGrouping, customFieldSettings, onTaskUpdate, onTaskContextMenu, onOpenPopover, onOpenTaskPane, projectRole, handleLiveTaskSwap, draggingTaskId, setDraggingTaskId }) {
  const [openFieldMenuId, setOpenFieldMenuId] = useState(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isEditingMode, setIsEditingMode] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title || '')
  const textareaRef = useRef(null)

  useEffect(() => {
    if (isEditingMode && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [isEditingMode]);

  const handleTitleSave = async () => {
    if (isReadOnly) return;
    if (editTitle !== task.title) {
      try {
        const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ title: editTitle })
        });
        const data = await response.json();
        if (response.ok) {
          onTaskUpdate(task.id, data);
        }
      } catch (err) { console.error(err); }
    }
    // We don't exit edit mode immediately on blur, maybe they want to edit fields.
    // Actually, let's keep edit mode until they click outside the card.
  };

  const getLikedTasks = () => {
    try { return JSON.parse(localStorage.getItem(`likedTasks`) || '[]'); } catch (e) { return []; }
  };
  const [isLiked, setIsLiked] = useState(() => getLikedTasks().includes(task.id));
  const cardRef = useRef(null)

  const isReadOnly = projectRole === 'VIEWER' || projectRole === 'COMMENTER';

  const getParsedCustomFields = (fields) => {
    if (!fields) return {};
    if (typeof fields === 'string') {
      try { return JSON.parse(fields); } catch (e) { return {}; }
    }
    return fields;
  };

  const handleDirectFieldUpdate = async (fieldId, value) => {
    if (isReadOnly) return;
    const bodyData = {};
    const parsedFields = getParsedCustomFields(task.customFields);
    parsedFields[fieldId] = value;
    bodyData.customFields = JSON.stringify(parsedFields);

    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(bodyData)
      });
      const data = await response.json();
      if (response.ok) {
        onTaskUpdate(task.id, data);
        setOpenFieldMenuId(null);
      } else {
        alert(data.error || "Update failed.");
      }
    } catch (err) { console.error(err); }
  };

  const handleToggleComplete = async (e) => {
    if (e) e.stopPropagation();
    if (isReadOnly) { alert("Bu projede sadece okuma yetkiniz var."); return; }

    if (!task.isCompleted) {
      const activeBlockers = task.blockedBy?.filter(dep => !dep.blockingTask?.isCompleted) || [];
      if (activeBlockers.length > 0) {
        if (!window.confirm("This task is blocked by another task. Are you sure you want to complete it?")) {
          return;
        }
      }
    }

    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isCompleted: !task.isCompleted })
      })
      const data = await response.json()
      if (!response.ok) { alert(data.error || "Yetki yok."); return; }
      onTaskUpdate(task.id, data)
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (e.target.closest('.dropdownMenu') || e.target.closest('[class*="popover"]')) return;
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        setOpenFieldMenuId(null);
        setIsEditingMode(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openFieldMenuId, task.id, isEditingMode]);

  const handleLikeToggle = async (e) => {
    e.stopPropagation();
    if (isReadOnly) return;
    try {
      const currentlyLiked = isLiked;
      const newLikes = currentlyLiked ? Math.max(0, (task.likes || 0) - 1) : (task.likes || 0) + 1;
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ likes: newLikes })
      })
      const data = await response.json()
      if (!response.ok) { alert(data.error || "Yetki yok."); return; }
      
      const newLikedState = !currentlyLiked;
      setIsLiked(newLikedState);
      const likedTasks = getLikedTasks();
      if (newLikedState) {
          localStorage.setItem(`likedTasks`, JSON.stringify([...likedTasks, task.id]));
      } else {
          localStorage.setItem(`likedTasks`, JSON.stringify(likedTasks.filter(id => id !== task.id)));
      }
      onTaskUpdate(task.id, data)
    } catch (err) { console.error(err) }
  }


  const handleOpenDatePicker = (e) => {
    if (isReadOnly) { alert("Görüntüleyiciler görev tarihlerini değiştiremez."); return; }
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    let coords = { left: rect.left };
    if (rect.bottom > window.innerHeight - 300) {
      coords.bottom = window.innerHeight - rect.top;
    } else {
      coords.top = rect.bottom + 5;
    }
    onOpenPopover('date', task, coords)
  }

  const handleOpenAssignee = (e) => {
    if (isReadOnly) { alert("Görüntüleyiciler görev atamalarını değiştiremez."); return; }
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    let coords = { left: rect.left };
    if (rect.bottom > window.innerHeight - 300) {
      coords.bottom = window.innerHeight - rect.top;
    } else {
      coords.top = rect.bottom + 5;
    }
    onOpenPopover('assignee', task, coords)
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  }

  const formatFriendlyDateRange = (start, end) => {
    if (!start && !end) return "📅 Tarih Yok"
    const fmt = (str) => { if (!str) return ''; const d = new Date(str); return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}` }
    return start && !end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
  }

  const getPriorityStyle = (level) => {
    switch(level) {
      case 'HIGH': return { backgroundColor: '#FEE2E2', color: '#991B1B' }
      case 'LOW': return { backgroundColor: '#CCFBF1', color: '#115E59' }
      default: return { backgroundColor: '#FEF3C7', color: '#92400E' }
    }
  }

  return (
    <div 
      ref={cardRef}
      data-task-id={task.id}
      draggable={!isReadOnly && !isVirtualGrouping && !isEditingMode}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragStart={isEditingMode ? undefined : (e) => {
        e.stopPropagation()
        e.dataTransfer.setData('drag-type', 'task')
        e.dataTransfer.setData('task-id', task.id)
        if (setDraggingTaskId) setDraggingTaskId(task.id);
      }}
      onDragEnd={isEditingMode ? undefined : (e) => {
        e.stopPropagation();
        if (setDraggingTaskId) setDraggingTaskId(null);
      }}
      onDragOver={isEditingMode ? undefined : (e) => {
        e.preventDefault();
        if (draggingTaskId && draggingTaskId !== task.id && !isVirtualGrouping) {
          const draggedEl = document.querySelector(`[data-task-id="${draggingTaskId}"]`);
          if (!draggedEl) return;
          
          const draggedRect = draggedEl.getBoundingClientRect();
          const targetRect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - targetRect.top;
          
          const isDraggingDown = draggedRect.top < targetRect.top;
          
          const extra = Math.max(0, targetRect.height - draggedRect.height);

          if (isDraggingDown) {
            if (y > extra) {
              if (handleLiveTaskSwap) handleLiveTaskSwap(draggingTaskId, task.id);
            }
          } else {
            if (y < targetRect.height - extra) {
              if (handleLiveTaskSwap) handleLiveTaskSwap(draggingTaskId, task.id);
            }
          }
        }
      }}
      // --- TARAYICI SAĞ TIK MENÜSÜNÜ ENGELLEYEN SİHİRLİ DÜZELTME ---
      onContextMenu={(e) => {
        e.preventDefault(); // Tarayıcı menüsünü tamamen kapatır
        onTaskContextMenu(e, task.id); // Bizim yazdığımız özel silme menüsünü açar
      }}
      style={{
        ...styles.taskCard,
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        boxShadow: isEditingMode ? '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)' : '0 1px 3px rgba(0,0,0,0.05)',
        zIndex: (openFieldMenuId || isEditingMode) ? 100 : 1,
        cursor: isEditingMode ? 'default' : 'pointer',
        opacity: (task.isCompleted && !isEditingMode) ? 0.6 : 1,
        position: 'relative',
        WebkitUserDrag: isEditingMode ? 'none' : 'element',
        userDrag: isEditingMode ? 'none' : 'element'
      }}
      onClick={(e) => {
        if (!e.defaultPrevented && !isEditingMode) {
          onOpenTaskPane(task.id);
        }
        setOpenFieldMenuId(null); // Click outside closes menu
      }}
    >

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
          <input type="checkbox" checked={task.isCompleted || false} onChange={handleToggleComplete} disabled={isReadOnly} onClick={(e) => e.stopPropagation()} style={styles.checkbox} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {isEditingMode ? (
              <input
                type="text"
                ref={textareaRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleTitleSave();
                  }
                }}
                style={{ 
                  width: '100%', border: 'none', outline: 'none', 
                  fontSize: '0.95rem', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: '500',
                  padding: 0, margin: 0, overflow: 'hidden', height: '1.35rem', lineHeight: '1.4', background: 'transparent',
                  userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text', position: 'relative', zIndex: 10
                }}
              />
            ) : (
              <h4 style={{ ...styles.lightTitle, textDecoration: task.isCompleted ? 'line-through' : 'none' }}>{task.title}</h4>
            )}
          </div>
        </div>
        
        {(isHovered && !isEditingMode && !isReadOnly) && (
          <button 
            style={{
              position: 'absolute', top: '0.5rem', right: '0.5rem',
              background: 'none', border: '1px solid var(--border-color)', cursor: 'pointer', padding: '0.4rem', 
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '6px', backgroundColor: 'var(--bg-primary)'
            }}
            title="Edit inline"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setEditTitle(task.title);
              setIsEditingMode(true);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
            </svg>
          </button>
        )}
      </div>

      <div style={{ 
        display: 'flex', 
        flexDirection: isEditingMode ? 'column' : 'row',
        flexWrap: isEditingMode ? 'nowrap' : 'wrap', 
        alignItems: 'flex-start',
        gap: '0.5rem', 
        marginTop: '0.75rem' 
      }}>



        {customFieldSettings?.map(cf => {
          const parsedFields = getParsedCustomFields(task.customFields);
          const value = parsedFields[cf.id];
          const isEmpty = !value || (typeof value === 'string' && value.trim() === '');
          
          if (isEmpty && !isEditingMode) return null;
            
          const opt = cf.options?.find(o => (o.value || o.label) === value);
          const displayValue = opt ? (opt.label || opt.value) : (isEmpty ? `Set ${cf.title}` : value);
          const badgeStyle = opt?.color ? { ...styles.staticCustomBadge, backgroundColor: opt.color, color: 'var(--text-primary)', border: 'none' } : styles.staticCustomBadge;
          
          return (
            <div key={cf.id} style={{ position: 'relative' }}>
              <span 
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!isReadOnly && (cf.type === 'SELECT' || cf.type === 'single-select')) setOpenFieldMenuId(openFieldMenuId === cf.id ? null : cf.id); }}
                style={{ ...badgeStyle, cursor: (!isReadOnly && (cf.type === 'SELECT' || cf.type === 'single-select')) ? 'pointer' : 'default', opacity: isEmpty ? 0.7 : 1, border: isEmpty ? '1px dashed var(--border-color)' : badgeStyle.border }}
              >
                {displayValue}
              </span>
              {openFieldMenuId === cf.id && (cf.type === 'SELECT' || cf.type === 'single-select') && (
                <div style={styles.dropdownMenu} onClick={(e) => e.stopPropagation()}>
                  <div style={{ padding: '4px 8px', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', marginBottom: '2px' }}>{cf.title}</div>
                  {cf.options?.map(o => (
                    <button 
                      key={o.id}
                      onClick={() => { handleDirectFieldUpdate(cf.id, o.label || o.value); setOpenFieldMenuId(null); }}
                      style={{...styles.dropdownItem, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '4px 8px'}}
                    >
                       <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: o.color || '#E0E7FF', display: 'inline-block', flexShrink: 0 }}></div>
                       <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label || o.value}</span>
                    </button>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }}></div>
                  <button onClick={() => { handleDirectFieldUpdate(cf.id, ''); setOpenFieldMenuId(null); }} style={{...styles.dropdownItem, padding: '4px 8px', color: 'var(--text-secondary)'}}>Clear value</button>
                </div>
              )}
            </div>
          );
        })}

        {task.tags && task.tags.map(tag => (
          <span key={tag.id} title={tag.name} style={{ color: tag.color, fontSize: '0.75rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path></svg>
          </span>
        ))}
        
        {isEditingMode && !isReadOnly && (
          <button 
            style={{ ...styles.addFieldDashedBtn, display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.25rem' }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              window.dispatchEvent(new CustomEvent('openAddFieldModal'));
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add field
          </button>
        )}
      </div>

      <div style={{ ...styles.bottomActionBar, borderTop: 'none', paddingTop: '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div onClick={handleOpenAssignee} style={{ cursor: isReadOnly ? 'default' : 'pointer' }}>
            {task.assignee ? <div style={styles.avatarCircleFilled}>{getInitials(task.assignee.name)}</div> : <div style={styles.avatarCircleEmpty}>👤</div>}
          </div>
          <div onClick={handleOpenDatePicker} style={{ ...styles.dateBadgeTrigger, backgroundColor: (task.startDate || task.dueDate) ? ((task.dueDate && new Date(task.dueDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && !task.isCompleted) ? 'var(--accent-danger)' : 'var(--bg-tertiary)') : 'transparent', color: (task.startDate || task.dueDate) ? ((task.dueDate && new Date(task.dueDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && !task.isCompleted) ? '#FFF' : 'var(--accent-primary)') : 'var(--text-secondary)', border: '1px dashed var(--border-color)', cursor: isReadOnly ? 'default' : 'pointer' }}>
            {formatFriendlyDateRange(task.startDate, task.dueDate)}
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {task.attachments?.length > 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                📎 {task.attachments.length}
              </span>
            )}
            <span 
              onClick={handleLikeToggle}
              style={{ ...styles.likeIconPlaceholder, cursor: isReadOnly ? 'default' : 'pointer', opacity: (isLiked || task.likes > 0) ? 1 : 0.3, color: isLiked ? '#4F46E5' : 'inherit' }}
            >
              👍 {task.likes > 0 ? task.likes : ''}
            </span>
        </div>
      </div>
    </div>
  )
}

const styles = { taskCard: { padding: '1rem', borderRadius: '10px', border: '1px solid', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', width: '100%', position: 'relative' }, checkbox: { cursor: 'pointer', width: '16px', height: '16px', marginTop: '3px' }, pencilButton: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', opacity: 0.5 }, lightTitle: { margin: 0, color: 'var(--text-primary)', fontWeight: '500', fontSize: '0.95rem', lineHeight: '1.4', wordBreak: 'break-word' }, lightTitleInput: { width: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: '500', outline: 'none', resize: 'none', padding: '0.3rem', boxSizing: 'border-box' }, lightDescriptionInput: { width: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-secondary)', fontSize: '0.85rem', outline: 'none', padding: '0.3rem', boxSizing: 'border-box' }, priorityBadgeSelect: { border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', fontWeight: '600', outline: 'none' }, staticBadge: { borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', fontWeight: '600' }, staticCustomBadge: { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', border: '1px solid var(--border-color)' }, interactiveCustomBadge: { backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '6px', padding: '3px 6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', border: '1px solid var(--border-color)' }, badgeInlineInput: { background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.75rem', width: '40px', outline: 'none' }, removeBadgeCross: { cursor: 'pointer', color: 'var(--accent-danger)', fontWeight: 'bold', fontSize: '0.85rem' }, addFieldDashedBtn: { background: 'none', border: '1px dashed var(--text-tertiary)', color: 'var(--text-secondary)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }, bottomActionBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem', width: '100%' }, avatarCircleFilled: { width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#D946EF', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold' }, avatarCircleEmpty: { width: '22px', height: '22px', borderRadius: '50%', border: '1px dashed var(--text-tertiary)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }, dateBadgeTrigger: { display: 'inline-block', padding: '0.2rem 0.5rem', fontSize: '0.75rem', fontWeight: '500', borderRadius: '6px', whiteSpace: 'nowrap' }, likeIconPlaceholder: { fontSize: '0.85rem', opacity: 0.3 }, lightCancelBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer' }, lightSaveBtn: { backgroundColor: 'var(--accent-primary)', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', padding: '0.3rem 0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }, dropdownMenu: { position: 'absolute', top: '100%', left: 0, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 50, padding: '0.25rem', minWidth: '120px', marginTop: '4px' }, dropdownItem: { width: '100%', backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500', textAlign: 'left', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '0.4rem' } }

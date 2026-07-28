import React, { useState, useEffect, useRef } from 'react'
import AddFieldModal from './AddFieldModal'
import { getParsedTaskCustomFields, getParsedGithubPRs, getGithubPRStatusLabel, getGithubPRStatusColor } from '../utils/customFields';

let globalLastDragY = 0;

export default function TaskCard({ task, token, isVirtualGrouping, customFieldSettings, projectMembers, onTaskUpdate, onTaskContextMenu, onOpenApprovalMenu, onOpenPopover, onOpenTaskPane, projectRole, handleLiveTaskSwap, draggingTaskId, setDraggingTaskId, fieldConfig }) {
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

  const handleDirectFieldUpdate = async (fieldId, value) => {
    if (isReadOnly) return;
    const bodyData = {};
    const parsedFields = getParsedTaskCustomFields(task.customFields);
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

  const handleApprovalStatusChange = async (e, status) => {
    e.stopPropagation();
    if (isReadOnly) return;
    try {
      const isCompleted = status === 'APPROVED' || status === 'REJECTED';
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ approvalStatus: status, isCompleted })
      });
      const data = await response.json();
      if (response.ok) {
        onTaskUpdate(task.id, data);
      } else {
        alert(data.error || "Update failed.");
      }
    } catch (err) { console.error(err); }
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (e.target.closest('.dropdownMenu') || e.target.closest('[class*="popover"]')) return;

      // If clicked on the scrollbar of the task list container, do not close
      if (e.target.classList && e.target.classList.contains('kanban-task-list')) {
        if (e.offsetX > e.target.clientWidth || e.offsetY > e.target.clientHeight) {
          return;
        }
      }

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
    if (!start && !end) return "📅 No Date"
    const fmt = (str) => { if (!str) return ''; const d = new Date(str); return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}` }
    return start && !end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
  }

  const getParsedGithubPRs = (prs) => {
    if (!prs) return [];
    if (typeof prs === 'string') {
      try { return JSON.parse(prs); } catch (e) { return []; }
    }
    return prs;
  };
  const githubPRsCount = getParsedGithubPRs(task.githubPRs).length;
  const attachmentsCount = task.attachments?.length || 0;
  const totalFilesCount = attachmentsCount + githubPRsCount;

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
      onContextMenu={(e) => {
        e.preventDefault();
        onTaskContextMenu(e, task.id);
      }}
      style={{
        ...styles.cardContainer,
        ...styles.taskCard,
        backgroundColor: 'var(--bg-primary)',
        border: `1px solid ${isHovered ? '#9CA3AF' : 'var(--border-color)'}`,
        boxShadow: isEditingMode ? '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)' : '0 1px 3px rgba(0,0,0,0.05)',
        zIndex: (openFieldMenuId || isEditingMode) ? 100 : 1,
        cursor: isEditingMode ? 'default' : 'pointer',
        opacity: (task.isCompleted && !isEditingMode && !openFieldMenuId) ? 0.6 : 1,
        position: 'relative',
        transition: 'border-color 0.15s ease',
        WebkitUserDrag: isEditingMode ? 'none' : 'element',
        userDrag: isEditingMode ? 'none' : 'element'
      }}
      onClick={(e) => {
        if (!e.defaultPrevented && !isEditingMode) {
          onOpenTaskPane(task.id);
        }
        setOpenFieldMenuId(null);
      }}
    >

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
          {task.type === 'APPROVAL' ? (
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: '18px', height: '18px', borderRadius: '4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px',
                  cursor: isReadOnly ? 'default' : 'pointer',
                  backgroundColor: task.approvalStatus === 'APPROVED' ? 'var(--accent-success)' : task.approvalStatus === 'REJECTED' ? 'var(--accent-danger)' : task.approvalStatus === 'CHANGES_REQUESTED' ? '#F59E0B' : 'transparent',
                  border: task.approvalStatus === 'PENDING' || !task.approvalStatus ? '1px solid var(--text-tertiary)' : 'none',
                  color: task.approvalStatus === 'PENDING' || !task.approvalStatus ? 'var(--text-secondary)' : '#fff',
                }}
                title={task.approvalStatus || 'PENDING'}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (!isReadOnly && onOpenApprovalMenu) {
                    onOpenApprovalMenu(e, task);
                  }
                }}
              >
                {task.approvalStatus === 'APPROVED' ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : task.approvalStatus === 'REJECTED' ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> : task.approvalStatus === 'CHANGES_REQUESTED' ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.67-5.67"></path></svg> : <span style={{ fontSize: '12px', lineHeight: 1 }}>⚖️</span>}
              </div>
            </div>
          ) : task.type === 'MILESTONE' ? (
            <div
              onClick={(e) => { e.stopPropagation(); if (!isReadOnly) handleToggleComplete(); }}
              style={{
                width: '12px', height: '12px', flexShrink: 0, cursor: isReadOnly ? 'default' : 'pointer',
                transform: 'rotate(45deg)', marginTop: '4px',
                backgroundColor: task.isCompleted ? 'var(--accent-success)' : 'transparent',
                border: task.isCompleted ? '2px solid var(--accent-success)' : '2px solid #6366F1',
              }}
              title="Milestone"
            />
          ) : (
            <div
              onClick={(e) => { e.stopPropagation(); if (!isReadOnly) handleToggleComplete(); }}
              style={{
                width: '18px', height: '18px', borderRadius: '50%', border: '1px solid',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isReadOnly ? 'default' : 'pointer', flexShrink: 0, marginTop: '2px',
                borderColor: task.isCompleted ? 'var(--accent-success)' : 'var(--text-tertiary)',
                backgroundColor: task.isCompleted ? 'var(--accent-success)' : 'transparent',
                color: '#fff',
              }}
            >
              {task.isCompleted && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
            </div>
          )}
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



        {(() => {
          const activeFields = fieldConfig && fieldConfig.length > 0 
            ? fieldConfig.filter(f => f.visible).map(f => customFieldSettings?.find(c => c.id === f.id)).filter(Boolean)
            : customFieldSettings;

          return activeFields?.map(cf => {
          const parsedFields = getParsedTaskCustomFields(task.customFields);
          const value = parsedFields[cf.id];
          const cfType = cf.type || 'single-select';

          let isEmpty = !value || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
          if (cfType === 'github_pr') {
            isEmpty = getParsedGithubPRs(task.githubPRs).length === 0;
          }

          if (isEmpty && !isEditingMode) return null;

          // SINGLE-SELECT
          if (cfType === 'SELECT' || cfType === 'single-select') {
            const opt = cf.options?.find(o => (o.value || o.label) === value);
            const displayValue = opt ? (opt.label || opt.value) : (isEmpty ? `Set ${cf.title}` : value);
            const badgeStyle = opt?.color ? { ...styles.staticCustomBadge, backgroundColor: opt.color, color: 'var(--text-primary)', border: 'none' } : styles.staticCustomBadge;
            return (
              <div key={cf.id} style={{ position: 'relative' }}>
                <span
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!isReadOnly) setOpenFieldMenuId(openFieldMenuId === cf.id ? null : cf.id); }}
                  style={{ ...badgeStyle, cursor: !isReadOnly ? 'pointer' : 'default', opacity: isEmpty ? 0.7 : 1, border: isEmpty ? '1px dashed var(--border-color)' : badgeStyle.border }}
                >
                  {displayValue}
                </span>
                {openFieldMenuId === cf.id && (
                  <div style={styles.dropdownMenu} onClick={(e) => e.stopPropagation()}>
                    <div style={{ padding: '4px 8px', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', marginBottom: '2px' }}>{cf.title}</div>
                    {cf.options?.map(o => (
                      <button
                        key={o.id}
                        onClick={() => { handleDirectFieldUpdate(cf.id, o.label || o.value); setOpenFieldMenuId(null); }}
                        style={{ ...styles.dropdownItem, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '4px 8px' }}
                      >
                        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: o.color || '#E0E7FF', display: 'inline-block', flexShrink: 0 }}></div>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label || o.value}</span>
                      </button>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }}></div>
                    <button onClick={() => { handleDirectFieldUpdate(cf.id, ''); setOpenFieldMenuId(null); }} style={{ ...styles.dropdownItem, padding: '4px 8px', color: 'var(--text-secondary)' }}>Clear value</button>
                  </div>
                )}
              </div>
            );
          }

          // MULTI-SELECT
          if (cfType === 'multi-select') {
            const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);
            if (selectedValues.length === 0 && !isEditingMode) return null;
            return (
              <div key={cf.id} style={{ position: 'relative' }}>
                <div onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!isReadOnly) setOpenFieldMenuId(openFieldMenuId === cf.id ? null : cf.id); }} style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', cursor: !isReadOnly ? 'pointer' : 'default' }}>
                  {selectedValues.length > 0 ? selectedValues.map(sv => {
                    const opt = cf.options?.find(o => (o.label || o.value) === sv);
                    return (
                      <span key={sv} style={{ ...styles.staticCustomBadge, backgroundColor: opt?.color || '#E0E7FF', color: 'var(--text-primary)', border: 'none', fontSize: '0.65rem', padding: '1px 6px' }}>
                        {sv}
                      </span>
                    );
                  }) : (
                    <span style={{ ...styles.staticCustomBadge, opacity: 0.7, border: '1px dashed var(--border-color)' }}>Set {cf.title}</span>
                  )}
                </div>
                {openFieldMenuId === cf.id && (
                  <div style={styles.dropdownMenu} onClick={(e) => e.stopPropagation()}>
                    <div style={{ padding: '4px 8px', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', marginBottom: '2px' }}>{cf.title}</div>
                    {cf.options?.map(o => {
                      const label = o.label || o.value;
                      const isSelected = selectedValues.includes(label);
                      return (
                        <button
                          key={o.id}
                          onClick={() => {
                            const newVals = isSelected ? selectedValues.filter(v => v !== label) : [...selectedValues, label];
                            handleDirectFieldUpdate(cf.id, newVals);
                          }}
                          style={{ ...styles.dropdownItem, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '4px 8px', backgroundColor: isSelected ? 'var(--bg-secondary)' : 'transparent' }}
                        >
                          <div style={{ width: 12, height: 12, borderRadius: '3px', border: isSelected ? 'none' : '1px solid #D1D5DB', backgroundColor: isSelected ? '#4F46E5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '8px', color: '#fff' }}>
                            {isSelected && '✓'}
                          </div>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: o.color || '#E0E7FF', display: 'inline-block', flexShrink: 0 }}></div>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                        </button>
                      );
                    })}
                    <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }}></div>
                    <button onClick={() => { handleDirectFieldUpdate(cf.id, []); setOpenFieldMenuId(null); }} style={{ ...styles.dropdownItem, padding: '4px 8px', color: 'var(--text-secondary)' }}>Clear all</button>
                  </div>
                )}
              </div>
            );
          }

          // DATE
          if (cfType === 'date') {
            if (!value && !isEditingMode) return null;
            const formatted = value ? new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' }) : `Set ${cf.title}`;
            return (
              <span
                key={cf.id}
                onClick={(e) => {
                  e.stopPropagation(); e.preventDefault();
                  if (!isReadOnly) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const coords = { left: rect.left };
                    if (rect.bottom > window.innerHeight - 300) {
                      coords.bottom = window.innerHeight - rect.top;
                    } else {
                      coords.top = rect.bottom + 5;
                    }
                    onOpenPopover('custom-date', task, coords, { customFieldId: cf.id });
                  }
                }}
                style={{ ...styles.staticCustomBadge, opacity: value ? 1 : 0.7, cursor: !isReadOnly ? 'pointer' : 'default', border: !value ? '1px dashed var(--border-color)' : styles.staticCustomBadge.border }}
              >
                📅 {formatted}
              </span>
            );
          }

          // PEOPLE
          if (cfType === 'people') {
            const selectedPeople = Array.isArray(value) ? value : (value ? [value] : []);
            if (selectedPeople.length === 0 && !isEditingMode) return null;
            return (
              <div key={cf.id} style={{ position: 'relative' }}>
                <div onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!isReadOnly) setOpenFieldMenuId(openFieldMenuId === cf.id ? null : cf.id); }} style={{ display: 'flex', gap: '2px', cursor: !isReadOnly ? 'pointer' : 'default' }}>
                  {selectedPeople.length > 0 ? selectedPeople.slice(0, 3).map((uid, i) => (
                    <span key={uid} style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#4F46E5', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 'bold', marginLeft: i > 0 ? '-4px' : '0', border: '1px solid var(--bg-primary)' }}>
                      {projectMembers?.find(m => m.user?.id === uid)?.user?.name?.charAt(0).toUpperCase() || '?'}
                    </span>
                  )) : (
                    <span style={{ ...styles.staticCustomBadge, opacity: 0.7, border: '1px dashed var(--border-color)' }}>Set {cf.title}</span>
                  )}
                  {selectedPeople.length > 3 && <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>+{selectedPeople.length - 3}</span>}
                </div>
                {openFieldMenuId === cf.id && (
                  <div style={styles.dropdownMenu} onClick={(e) => e.stopPropagation()}>
                    <div style={{ padding: '4px 8px', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', marginBottom: '2px' }}>People</div>
                    {projectMembers?.map(m => {
                      const uid = m.user?.id;
                      const isSelected = selectedPeople.includes(uid);
                      return (
                        <button
                          key={uid}
                          onClick={() => {
                            if (!uid) return;
                            const newVals = isSelected ? selectedPeople.filter(v => v !== uid) : [...selectedPeople, uid];
                            handleDirectFieldUpdate(cf.id, newVals);
                          }}
                          style={{ ...styles.dropdownItem, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '4px 8px', backgroundColor: isSelected ? 'var(--bg-secondary)' : 'transparent' }}
                        >
                          <div style={{ width: 12, height: 12, borderRadius: '3px', border: isSelected ? 'none' : '1px solid #D1D5DB', backgroundColor: isSelected ? '#4F46E5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '8px', color: '#fff' }}>
                            {isSelected && '✓'}
                          </div>
                          <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#4F46E5', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', fontWeight: 'bold', flexShrink: 0 }}>
                            {m.user?.name?.charAt(0).toUpperCase() || '?'}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.user?.name || m.user?.email}</span>
                        </button>
                      );
                    })}
                    <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }}></div>
                    <button onClick={() => { handleDirectFieldUpdate(cf.id, []); setOpenFieldMenuId(null); }} style={{ ...styles.dropdownItem, padding: '4px 8px', color: 'var(--text-secondary)' }}>Clear all</button>
                  </div>
                )}
              </div>
            );
          }

          // NUMBER
          if (cfType === 'number') {
            if ((!value && value !== 0) && !isEditingMode) return null;
            if (openFieldMenuId === cf.id && !isReadOnly) {
              return (
                <input
                  key={cf.id}
                  autoFocus
                  type="number"
                  defaultValue={value}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    handleDirectFieldUpdate(cf.id, e.target.value ? Number(e.target.value) : '');
                    setOpenFieldMenuId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleDirectFieldUpdate(cf.id, e.target.value ? Number(e.target.value) : '');
                      setOpenFieldMenuId(null);
                    }
                  }}
                  style={{ background: 'var(--bg-primary)', border: '1px solid #4F46E5', borderRadius: '4px', fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: 'var(--text-primary)', outline: 'none', fontWeight: '500', maxWidth: '80px', fontFamily: 'monospace' }}
                />
              );
            }
            const fmt = cf.numberFormat || 'plain';
            const num = Number(value);
            let displayNum = value;
            if (!isNaN(num) && value !== '') {
              if (fmt === 'currency') displayNum = `$${num.toLocaleString()}`;
              else if (fmt === 'percent') displayNum = `${num}%`;
              else displayNum = num.toLocaleString();
            } else if (!value && value !== 0) {
              displayNum = `Set ${cf.title}`;
            }
            return (
              <span key={cf.id} onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!isReadOnly) setOpenFieldMenuId(cf.id); }} style={{ ...styles.staticCustomBadge, fontFamily: 'monospace', cursor: !isReadOnly ? 'pointer' : 'default', border: (!value && value !== 0) ? '1px dashed var(--border-color)' : styles.staticCustomBadge.border, opacity: (!value && value !== 0) ? 0.7 : 1 }}>
                {displayNum}
              </span>
            );
          }

          // TEXT
          if (cfType === 'text') {
            if (!value && !isEditingMode) return null;
            if (openFieldMenuId === cf.id && !isReadOnly) {
              return (
                <input
                  key={cf.id}
                  autoFocus
                  type="text"
                  defaultValue={value}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    handleDirectFieldUpdate(cf.id, e.target.value);
                    setOpenFieldMenuId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleDirectFieldUpdate(cf.id, e.target.value);
                      setOpenFieldMenuId(null);
                    }
                  }}
                  style={{ background: 'var(--bg-primary)', border: '1px solid #4F46E5', borderRadius: '4px', fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: 'var(--text-primary)', outline: 'none', fontWeight: '500', maxWidth: '120px' }}
                />
              );
            }
            return (
              <span key={cf.id} onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!isReadOnly) setOpenFieldMenuId(cf.id); }} style={{ ...styles.staticCustomBadge, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: !isReadOnly ? 'pointer' : 'default', border: !value ? '1px dashed var(--border-color)' : styles.staticCustomBadge.border, opacity: !value ? 0.7 : 1 }}>
                {value || `Set ${cf.title}`}
              </span>
            );
          }

          // ID
          if (cfType === 'id') {
            const idVal = value || task.id?.slice(-6).toUpperCase();
            return (
              <span key={cf.id} style={{ ...styles.staticCustomBadge, fontFamily: 'monospace', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                {idVal}
              </span>
            );
          }

          // GITHUB_PR
          if (cfType === 'github_pr') {
            const prs = getParsedGithubPRs(task.githubPRs);
            if (prs.length === 0 && !isEditingMode) return null;
            if (prs.length === 0 && isEditingMode) return <span key={cf.id} style={{ ...styles.staticCustomBadge, opacity: 0.7 }}>🐙 GitHub PR</span>;

            const firstPr = prs[0];
            let statusColor = getGithubPRStatusColor(firstPr);
            let label = getGithubPRStatusLabel(firstPr);

            if (prs.length > 1) label += ` (+${prs.length - 1})`;

            return (
              <span key={cf.id} style={{ ...styles.staticCustomBadge, backgroundColor: 'transparent', color: statusColor, border: `1px solid ${statusColor}`, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.25 2.25 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 7.425A3.155 3.155 0 0012.75 12h.75a.75.75 0 01.75.75v.5a.75.75 0 01-.75.75H12a4.655 4.655 0 01-4.655-4.655V5.372a2.25 2.25 0 111.5 0v3.983c0 .713.273 1.398.75 1.916V7.425z"></path>
                </svg>
                {label}
              </span>
            );
          }

          // TIMER
          if (cfType === 'timer') {
            const timerData = (typeof value === 'object' && value !== null) ? value : { elapsed: 0, running: false, lastStart: null };
            const elapsed = timerData.elapsed || 0;
            const isRunning = timerData.running || false;
            if (elapsed === 0 && !isRunning && !isEditingMode) return null;

            const formatTime = (secs) => {
              const h = Math.floor(secs / 3600);
              const m = Math.floor((secs % 3600) / 60);
              return `${h}h ${m}m`;
            };

            return (
              <div key={cf.id} style={{ position: 'relative' }}>
                <span onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!isReadOnly) setOpenFieldMenuId(openFieldMenuId === cf.id ? null : cf.id); }} style={{ ...styles.staticCustomBadge, fontFamily: 'monospace', color: isRunning ? '#10B981' : 'var(--text-primary)', cursor: !isReadOnly ? 'pointer' : 'default', border: (elapsed === 0 && !isRunning) ? '1px dashed var(--border-color)' : styles.staticCustomBadge.border, opacity: (elapsed === 0 && !isRunning) ? 0.7 : 1 }}>
                  ⏱ {elapsed === 0 && !isRunning ? `Set ${cf.title}` : formatTime(elapsed)}
                </span>
                {openFieldMenuId === cf.id && !isReadOnly && (
                  <div style={{ ...styles.dropdownMenu, padding: '4px' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        if (isRunning) {
                          const now = Math.floor(Date.now() / 1000);
                          const addedTime = timerData.lastStart ? now - timerData.lastStart : 0;
                          handleDirectFieldUpdate(cf.id, { running: false, elapsed: elapsed + addedTime, lastStart: null });
                        } else {
                          handleDirectFieldUpdate(cf.id, { running: true, elapsed, lastStart: Math.floor(Date.now() / 1000) });
                        }
                        setOpenFieldMenuId(null);
                      }}
                      style={{ ...styles.dropdownItem, padding: '4px 8px', color: isRunning ? '#EF4444' : '#10B981', fontWeight: 'bold' }}
                    >
                      {isRunning ? '⏹ Stop Timer' : '▶ Start Timer'}
                    </button>
                    {elapsed > 0 && !isRunning && (
                      <button onClick={() => { handleDirectFieldUpdate(cf.id, { running: false, elapsed: 0, lastStart: null }); setOpenFieldMenuId(null); }} style={{ ...styles.dropdownItem, padding: '4px 8px', color: 'var(--text-secondary)' }}>Reset</button>
                    )}
                  </div>
                )}
              </div>
            );
          }

          // FORMULA (read-only)
          if (cfType === 'formula') {
            if (!value && !isEditingMode) return null;
            return (
              <span key={cf.id} style={{ ...styles.staticCustomBadge, fontStyle: 'italic' }}>
                {value || '—'}
              </span>
            );
          }

          return null;
        })})()}

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
          <div onClick={handleOpenDatePicker} style={{ ...styles.dateBadgeTrigger, backgroundColor: (task.startDate || task.dueDate) ? ((task.dueDate && new Date(task.dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && !task.isCompleted) ? 'var(--accent-danger)' : 'var(--bg-tertiary)') : 'transparent', color: (task.startDate || task.dueDate) ? ((task.dueDate && new Date(task.dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && !task.isCompleted) ? '#FFF' : 'var(--accent-primary)') : 'var(--text-secondary)', border: '1px dashed var(--border-color)', cursor: isReadOnly ? 'default' : 'pointer' }}>
            {formatFriendlyDateRange(task.startDate, task.dueDate)}
            {task.isRecurring && <span style={{ marginLeft: '4px' }} title="Recurring Task">🔁</span>}
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {totalFilesCount > 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              📎 {totalFilesCount}
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

const styles = { taskCard: { padding: '1rem', borderRadius: '10px', border: '1px solid', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', width: '100%', position: 'relative' }, checkbox: { cursor: 'pointer', width: '16px', height: '16px', marginTop: '3px' }, pencilButton: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', opacity: 0.5 }, lightTitle: { margin: 0, color: 'var(--text-primary)', fontWeight: '500', fontSize: '0.95rem', lineHeight: '1.4', wordBreak: 'break-word' }, lightTitleInput: { width: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: '500', outline: 'none', resize: 'none', padding: '0.3rem', boxSizing: 'border-box' }, lightDescriptionInput: { width: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-secondary)', fontSize: '0.85rem', outline: 'none', padding: '0.3rem', boxSizing: 'border-box' }, staticBadge: { borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', fontWeight: '600' }, staticCustomBadge: { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', border: '1px solid var(--border-color)' }, interactiveCustomBadge: { backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '6px', padding: '3px 6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', border: '1px solid var(--border-color)' }, badgeInlineInput: { background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.75rem', width: '40px', outline: 'none' }, removeBadgeCross: { cursor: 'pointer', color: 'var(--accent-danger)', fontWeight: 'bold', fontSize: '0.85rem' }, addFieldDashedBtn: { background: 'none', border: '1px dashed var(--text-tertiary)', color: 'var(--text-secondary)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }, bottomActionBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem', width: '100%' }, avatarCircleFilled: { width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#D946EF', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold' }, avatarCircleEmpty: { width: '22px', height: '22px', borderRadius: '50%', border: '1px dashed var(--text-tertiary)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }, dateBadgeTrigger: { display: 'inline-block', padding: '0.2rem 0.5rem', fontSize: '0.75rem', fontWeight: '500', borderRadius: '6px', whiteSpace: 'nowrap' }, likeIconPlaceholder: { fontSize: '0.85rem', opacity: 0.3 }, lightCancelBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer' }, lightSaveBtn: { backgroundColor: 'var(--accent-primary)', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', padding: '0.3rem 0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }, dropdownMenu: { position: 'absolute', top: '100%', left: 0, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 50, padding: '0.25rem', minWidth: '120px', marginTop: '4px' }, dropdownItem: { width: '100%', backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500', textAlign: 'left', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '0.4rem' } }

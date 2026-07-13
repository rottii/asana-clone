import React, { useState, useEffect } from 'react';
import RichTextEditor from './RichTextEditor';

export default function TaskDetailPane({ task, selectedProject, onClose, onTaskUpdate, token, projectRole, customFieldSettings, onOpenPopover }) {
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
  });
  const [openFieldMenuId, setOpenFieldMenuId] = useState(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInputValue, setTagInputValue] = useState('');
  const [tagColorValue, setTagColorValue] = useState('#3B82F6');
  const [availableTags, setAvailableTags] = useState([]);

  const isReadOnly = projectRole === 'VIEWER' || projectRole === 'COMMENTER';

  useEffect(() => {
    if (task) {
      setEditForm({
        title: task.title || '',
        description: task.description || '',
      });
    }
  }, [task]);

  useEffect(() => {
    if (showTagInput) {
      fetch('http://localhost:5001/api/tags', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableTags(data);
      })
      .catch(console.error);
    }
  }, [showTagInput, token]);

  useEffect(() => {
    if (!openFieldMenuId) return;
    const handleClickOutside = (e) => {
      if (e.target.closest('.dropdownMenu') || e.target.closest('[class*="popover"]')) return;
      setOpenFieldMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openFieldMenuId]);

  if (!task) return null;

  const handleSave = async (field, value) => {
    if (isReadOnly) return;
    
    // Only save if changed
    if (field === 'title' && value === task.title) return;
    if (field === 'description' && value === task.description) return;

    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ [field]: value })
      });
      const data = await response.json();
      if (response.ok) {
        onTaskUpdate(task.id, data);
      } else {
        alert(data.error || 'Failed to update task');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleComplete = async () => {
    if (isReadOnly) return;
    
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
      });
      const data = await response.json();
      if (response.ok) {
        onTaskUpdate(task.id, data);
      }
    } catch (err) {
      console.error(err);
    }
  };

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

  const handleOpenDatePicker = (e) => {
    if (isReadOnly || !onOpenPopover) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    onOpenPopover('date', task, { left: rect.left, top: rect.bottom + 5 });
  };

  const handleOpenAssignee = (e) => {
    if (isReadOnly || !onOpenPopover) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    onOpenPopover('assignee', task, { left: rect.left, top: rect.bottom + 5 });
  };

  const formatFriendlyDateRange = (start, end) => {
    if (!start && !end) return "No due date";
    const fmt = (str) => { if (!str) return ''; const d = new Date(str); return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}` }
    return start && !end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
  };

  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (isReadOnly || !newSubtaskTitle.trim()) return;
    try {
      const response = await fetch('http://localhost:5001/api/projects/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: newSubtaskTitle, sectionId: task.sectionId, parentId: task.id })
      });
      const data = await response.json();
      if (response.ok) {
        setNewSubtaskTitle('');
        const updatedTask = { ...task, subtasks: [...(task.subtasks || []), data] };
        onTaskUpdate(task.id, updatedTask);
      }
    } catch (err) { console.error(err); }
  };

  const handleToggleSubtaskComplete = async (subtaskId, isCompleted) => {
    if (isReadOnly) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${subtaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isCompleted: !isCompleted })
      });
      const data = await response.json();
      if (response.ok) {
        const updatedSubtasks = task.subtasks.map(st => st.id === subtaskId ? { ...st, isCompleted: !isCompleted } : st);
        onTaskUpdate(task.id, { ...task, subtasks: updatedSubtasks });
      }
    } catch (err) { console.error(err); }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (isReadOnly || !newCommentText.trim()) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text: newCommentText })
      });
      const data = await response.json();
      if (response.ok) {
        setNewCommentText('');
        const updatedTask = { ...task, comments: [...(task.comments || []), data] };
        onTaskUpdate(task.id, updatedTask);
      }
    } catch (err) { console.error(err); }
  };

  const handleAddTag = async (e) => {
    e.preventDefault();
    if (isReadOnly || !tagInputValue.trim()) return;
    try {
      const tagRes = await fetch('http://localhost:5001/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: tagInputValue.trim(), color: tagColorValue })
      });
      const tagData = await tagRes.json();
      const tagId = tagData.id || tagData.tag?.id;

      if (tagId) {
        const projectId = task.projectId || (selectedProject && selectedProject.id) || task.section?.projectId;
        const assignRes = await fetch(`http://localhost:5001/api/projects/${projectId}/tasks/${task.id}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ tagId })
        });
        const updatedTask = await assignRes.json();
        if (assignRes.ok) {
          onTaskUpdate(task.id, updatedTask);
          setTagInputValue('');
          setShowTagInput(false);
        }
      }
    } catch (err) { console.error(err); }
  };

  const handleAssignExistingTag = async (tagId) => {
    if (isReadOnly) return;
    try {
      const projectId = task.projectId || (selectedProject && selectedProject.id) || task.section?.projectId;
      const assignRes = await fetch(`http://localhost:5001/api/projects/${projectId}/tasks/${task.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tagId })
      });
      const updatedTask = await assignRes.json();
      if (assignRes.ok) {
        onTaskUpdate(task.id, updatedTask);
        setTagInputValue('');
        setShowTagInput(false);
      }
    } catch (err) { console.error(err); }
  };

  const handleRemoveTag = async (tagId) => {
    if (isReadOnly) return;
    try {
      const projectId = task.projectId || (selectedProject && selectedProject.id) || task.section?.projectId;
      const res = await fetch(`http://localhost:5001/api/projects/${projectId}/tasks/${task.id}/tags/${tagId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const updatedTask = await res.json();
      if (res.ok) {
        onTaskUpdate(task.id, updatedTask);
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteComment = async (commentId) => {
    if (isReadOnly) return;
    if (!window.confirm("Yorumu silmek istediğinize emin misiniz?")) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const updatedComments = task.comments.filter(c => c.id !== commentId);
        onTaskUpdate(task.id, { ...task, comments: updatedComments });
      } else {
        const data = await response.json();
        alert(data.error || "Silinemedi");
      }
    } catch (err) { console.error(err); }
  };

  const parsedFields = getParsedCustomFields(task.customFields);

  const activeBlockedBy = task.blockedBy?.filter(dep => !dep.blockingTask?.isCompleted) || [];
  const activeBlocking = task.blocking?.filter(dep => !dep.blockedByTask?.isCompleted) || [];

  return (
    <>
      <div style={styles.pane}>
        <div style={styles.header}>
          <button 
            style={{ ...styles.completeBtn, backgroundColor: task.isCompleted ? 'var(--accent-success)' : 'transparent', color: task.isCompleted ? '#FFF' : 'var(--text-primary)' }} 
            onClick={handleToggleComplete}
            disabled={isReadOnly}
          >
            {task.isCompleted ? '✓ Completed' : '✓ Mark complete'}
          </button>
          <div style={styles.headerActions}>
            <button style={styles.iconBtn} onClick={onClose}>×</button>
          </div>
        </div>

        <div style={styles.body}>
          <input 
            type="text" 
            style={{ ...styles.titleInput, textDecoration: task.isCompleted ? 'line-through' : 'none' }}
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            onBlur={() => handleSave('title', editForm.title)}
            readOnly={isReadOnly}
            placeholder="Write a task name"
          />

          <div style={styles.fieldsGrid}>
            <div style={styles.fieldRow}>
              <div style={styles.fieldLabel}>Assignee</div>
              <div style={{ ...styles.fieldValue, cursor: isReadOnly ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={handleOpenAssignee}>
                <span style={{ color: 'var(--text-tertiary)' }}>👤</span>
                <span style={{ color: task.assignee ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{task.assignee ? task.assignee.name : 'No assignee'}</span>
              </div>
            </div>

            <div style={styles.fieldRow}>
              <div style={styles.fieldLabel}>Due date</div>
              <div style={{ ...styles.fieldValue, cursor: isReadOnly ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={handleOpenDatePicker}>
                <span style={{ color: 'var(--text-tertiary)' }}>📅</span>
                <span style={{ color: (task.startDate || task.dueDate) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {formatFriendlyDateRange(task.startDate, task.dueDate)}
                </span>
              </div>
            </div>

            <div style={styles.fieldRow}>
              <div style={styles.fieldLabel}>Dependencies</div>
              <div style={styles.fieldValue}>
                {(!activeBlockedBy.length && !activeBlocking.length) ? (
                  <div style={{ color: 'var(--text-secondary)' }}>Add dependencies</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {activeBlockedBy.map(dep => (
                      <div key={dep.id} style={styles.dependencyItem}>
                        <span style={styles.dependencyType}>Blocked by:</span> 
                        {dep.blockingTask?.title || 'Task'}
                      </div>
                    ))}
                    {activeBlocking.map(dep => (
                      <div key={dep.id} style={styles.dependencyItem}>
                        <span style={styles.dependencyType}>Blocking:</span> 
                        {dep.blockedByTask?.title || 'Task'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={styles.fieldRow}>
              <div style={styles.fieldLabel}>Tags</div>
              <div style={styles.fieldValue}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                  {task.tags && task.tags.map(tag => (
                    <span key={tag.id} style={{ color: tag.color, fontSize: '0.85rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path></svg> {tag.name}
                      {!isReadOnly && <span style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => handleRemoveTag(tag.id)}>×</span>}
                    </span>
                  ))}
                  {!isReadOnly && (
                    <div style={{ position: 'relative' }}>
                      {!showTagInput ? (
                        <span style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }} onClick={() => setShowTagInput(true)}>+ Add Tag</span>
                      ) : (
                        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: '8px', zIndex: 100, width: '200px' }}>
                          {availableTags.length > 0 && (
                            <div style={{ marginBottom: '8px', maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {availableTags.filter(t => !task.tags?.find(tt => tt.id === t.id) && t.name.toLowerCase().includes(tagInputValue.toLowerCase())).map(tag => (
                                <div 
                                  key={tag.id} 
                                  onClick={() => handleAssignExistingTag(tag.id)}
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px', cursor: 'pointer', borderRadius: '4px' }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill={tag.color} style={{ flexShrink: 0 }}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path></svg>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{tag.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <form onSubmit={handleAddTag} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: availableTags.length > 0 ? '1px solid var(--border-color)' : 'none', paddingTop: availableTags.length > 0 ? '8px' : '0' }}>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <input type="text" value={tagInputValue} onChange={e => setTagInputValue(e.target.value)} placeholder="New tag name..." style={{ border: '1px solid var(--border-color)', borderRadius: '4px', outline: 'none', background: 'transparent', flex: 1, fontSize: '0.8rem', padding: '4px', color: 'var(--text-primary)' }} autoFocus />
                              <input type="color" value={tagColorValue} onChange={e => setTagColorValue(e.target.value)} style={{ width: '24px', height: '24px', border: 'none', padding: 0, cursor: 'pointer' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                              <button type="button" onClick={() => setShowTagInput(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 6px' }}>Cancel</button>
                              <button type="submit" style={{ background: 'var(--accent-primary)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 8px' }}>Create</button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ ...styles.fieldRow, flexDirection: 'column', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)', marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '500', color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Projects <span style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '0 0.4rem', borderRadius: '4px', fontSize: '0.75rem' }}>1</span> <span style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: '1' }}>+</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>▼</span>
                {selectedProject ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#34D399' }}></div>
                    <span style={{ color: 'var(--text-primary)' }}>{selectedProject.name}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>Configuration ⌄</span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>No project</span>
                )}
              </div>
            </div>

            {customFieldSettings?.map((cf) => {
              const value = parsedFields[cf.id] || '';
              const opt = cf.options?.find(o => (o.value || o.label) === value);
              const displayValue = opt ? (opt.label || opt.value) : (value || '—');
              return (
                <div key={cf.id} style={{ ...styles.fieldRow, borderBottom: '1px solid var(--border-color)', padding: '0.6rem 0', minHeight: '32px' }}>
                  <div style={{ ...styles.fieldLabel, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="8 10 12 14 16 10"></polyline></svg>
                    {cf.title}
                  </div>
                  <div style={{ ...styles.fieldValue, position: 'relative', paddingLeft: '0.5rem', borderLeft: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', height: '100%' }}>
                    {(cf.type === 'SELECT' || cf.type === 'single-select') ? (
                      <>
                        <span 
                          onClick={(e) => { e.stopPropagation(); if (!isReadOnly) setOpenFieldMenuId(openFieldMenuId === cf.id ? null : cf.id); }}
                          style={{ cursor: isReadOnly ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: (value && opt?.color) ? opt.color : 'transparent', color: value ? 'var(--text-primary)' : 'var(--text-secondary)', padding: value ? '0.2rem 0.5rem' : '0', borderRadius: '4px', fontSize: '0.85rem' }}
                        >
                          {displayValue}
                        </span>
                        {openFieldMenuId === cf.id && (
                          <div style={styles.dropdownMenu} className="dropdownMenu" onClick={(e) => e.stopPropagation()}>
                            <div style={{ padding: '4px 8px', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', marginBottom: '2px' }}>{cf.title}</div>
                            {cf.options?.map(o => (
                              <button 
                                key={o.id}
                                onClick={() => handleDirectFieldUpdate(cf.id, o.label || o.value)}
                                style={{...styles.dropdownItem, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '4px 8px'}}
                              >
                                <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: o.color || '#E0E7FF', display: 'inline-block', flexShrink: 0 }}></div>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label || o.value}</span>
                              </button>
                            ))}
                            <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }}></div>
                            <button onClick={() => handleDirectFieldUpdate(cf.id, '')} style={{...styles.dropdownItem, padding: '4px 8px', color: 'var(--text-secondary)'}}>Clear value</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <input 
                        type="text" 
                        value={value} 
                        placeholder="—" 
                        readOnly={isReadOnly} 
                        onChange={e => {
                          const newFields = { ...parsedFields, [cf.id]: e.target.value };
                          setEditForm({ ...editForm, _cfForceUpdate: Date.now() }); // Force render
                          task.customFields = JSON.stringify(newFields); // Optimistic local
                        }}
                        onBlur={e => handleDirectFieldUpdate(cf.id, e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleDirectFieldUpdate(cf.id, e.target.value)}
                        style={{ ...styles.inlineInput, color: value ? 'var(--text-primary)' : 'var(--text-secondary)' }} 
                      />
                    )}
                  </div>
                </div>
              );
            })}

            <div style={{ marginTop: '0.5rem', color: '#4F46E5', fontSize: '0.85rem', cursor: 'pointer' }}>Hide custom fields</div>

          </div>

            <div style={styles.descriptionSection}>
              <div style={styles.descriptionLabel}>Description</div>
              {!isReadOnly ? (
                <RichTextEditor
                  value={editForm.description}
                  onChange={val => setEditForm({ ...editForm, description: val })}
                  onBlur={() => handleSave('description', editForm.description)}
                  users={selectedProject?.members?.map(m => m.user) || []}
                  minHeight="150px"
                />
              ) : (
                <div className="rich-text-content" style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }} dangerouslySetInnerHTML={{ __html: editForm.description || '<p>No description</p>' }} />
              )}
            </div>

          {/* SUBTASKS SECTION */}
          <div style={styles.subtasksSection}>
            <div style={styles.sectionTitle}>Subtasks</div>
            <div style={styles.subtaskList}>
              {task.subtasks?.map(st => (
                <div key={st.id} style={styles.subtaskItem}>
                  <input type="checkbox" checked={st.isCompleted} onChange={() => handleToggleSubtaskComplete(st.id, st.isCompleted)} disabled={isReadOnly} style={{ cursor: 'pointer' }} />
                  <span style={{ textDecoration: st.isCompleted ? 'line-through' : 'none', color: st.isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)', flex: 1, fontSize: '0.9rem' }}>{st.title}</span>
                </div>
              ))}
            </div>
            {!isReadOnly && (
              <form onSubmit={handleAddSubtask} style={styles.subtaskForm}>
                <input type="text" value={newSubtaskTitle} onChange={e => setNewSubtaskTitle(e.target.value)} placeholder="Add a subtask..." style={styles.subtaskInput} />
              </form>
            )}
          </div>

          {/* COMMENTS SECTION */}
          <div style={styles.commentsSection}>
            <div style={styles.sectionTitle}>Comments & Activity</div>
            <div style={styles.commentList}>
              {task.comments?.map(c => (
                <div key={c.id} style={styles.commentItem}>
                  <div style={styles.commentAvatar}>{c.user?.name?.charAt(0).toUpperCase() || '?'}</div>
                  <div style={styles.commentContent}>
                    <div style={styles.commentHeader}>
                      <span style={styles.commentAuthor}>{c.user?.name || 'Unknown'}</span>
                      <span style={styles.commentTime}>
                        {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                      <div className="rich-text-content" style={styles.commentText} dangerouslySetInnerHTML={{ __html: c.text }} />
                  </div>
                  {!isReadOnly && (
                    <button onClick={() => handleDeleteComment(c.id)} style={styles.commentDeleteBtn} title="Delete comment">×</button>
                  )}
                </div>
              ))}
            </div>
                     {!isReadOnly && (
                <div style={styles.commentForm}>
                  <div style={styles.commentAvatarCurrentUser}>ME</div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <RichTextEditor
                      value={newCommentText}
                      onChange={val => setNewCommentText(val)}
                      users={selectedProject?.members?.map(m => m.user) || []}
                      minHeight="60px"
                    />
                    <button onClick={handleAddComment} style={{ ...styles.saveBtn, alignSelf: 'flex-end', padding: '6px 12px', fontSize: '0.85rem' }}>
                      Comment
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  pane: { position: 'fixed', top: '52px', right: 0, bottom: 0, width: '600px', backgroundColor: 'var(--bg-primary)', boxShadow: '-4px 0 15px rgba(0,0,0,0.05)', zIndex: 10001, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', animation: 'slideIn 0.2s ease-out' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)' },
  completeBtn: { padding: '0.4rem 1rem', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: '0.2s' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  iconBtn: { background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0 0.5rem' },
  body: { flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  titleInput: { width: '100%', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-primary)', border: 'none', outline: 'none', backgroundColor: 'transparent' },
  fieldsGrid: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' },
  fieldRow: { display: 'flex', alignItems: 'center', padding: '0.5rem 0', minHeight: '32px' },
  fieldLabel: { width: '160px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' },
  fieldValue: { flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' },
  divider: { height: '1px', backgroundColor: 'var(--border-color)', margin: '0.5rem 0' },
  inlineInput: { background: 'none', border: '1px solid transparent', color: 'var(--text-primary)', fontSize: '0.85rem', width: '100%', outline: 'none', padding: '0' },
  descriptionSection: { marginTop: '1.5rem' },
  descriptionLabel: { fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' },
  descriptionInput: { width: '100%', border: 'none', padding: '0', fontSize: '0.9rem', color: 'var(--text-primary)', background: 'transparent', outline: 'none', resize: 'vertical', minHeight: '150px' },
  footer: { padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: 'var(--bg-secondary)' },
  cancelBtn: { padding: '0.5rem 1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', fontWeight: '500', cursor: 'pointer' },
  saveBtn: { padding: '0.5rem 1.5rem', backgroundColor: 'var(--accent-primary)', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' },
  projectPill: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.5rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '500' },
  projectSquare: { width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#34D399' },
  dependencyItem: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-primary)' },
  dependencyType: { color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '500' },
  dropdownMenu: { position: 'absolute', top: '100%', left: 0, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 50, padding: '0.25rem', minWidth: '120px', marginTop: '4px' },
  dropdownItem: { width: '100%', backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500', textAlign: 'left', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '0.4rem' },
  subtasksSection: { marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' },
  sectionTitle: { fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '1rem' },
  subtaskList: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' },
  subtaskItem: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' },
  subtaskForm: { display: 'flex', alignItems: 'center', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' },
  subtaskInput: { border: 'none', outline: 'none', width: '100%', fontSize: '0.9rem', background: 'transparent', color: 'var(--text-primary)' },
  commentsSection: { marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' },
  commentList: { display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' },
  commentItem: { display: 'flex', gap: '0.75rem' },
  commentAvatar: { width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '0.85rem', flexShrink: 0 },
  commentAvatarCurrentUser: { width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--accent-success)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '0.85rem', flexShrink: 0 },
  commentContent: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  commentHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  commentAuthor: { fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-primary)' },
  commentTime: { fontSize: '0.75rem', color: 'var(--text-secondary)' },
  commentText: { fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.4' },
  commentDeleteBtn: { background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1rem', padding: '0 0.25rem' },
  commentForm: { display: 'flex', gap: '0.75rem', alignItems: 'flex-start' },
  commentInput: { flex: 1, padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.9rem', resize: 'vertical', outline: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)' }
};

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { getParsedTaskCustomFields, getParsedGithubPRs, getGithubPRStatusColor, getGithubPRStatusLabel } from '../utils/customFields';
import UserAvatar from './UserAvatar';
import AddFieldModal from './AddFieldModal'

export default function ProjectListView({
  selectedProject,
  groupedSections,
  isVirtualGrouping,
  isReadOnly,
  token,
  lastInteractedSectionId,
  setLastInteractedSectionId,
  lastInteractedTaskId,
  setLastInteractedTaskId,
  draggingTaskId,
  setDraggingTaskId,
  draggingSectionId,       // YENİ
  setDraggingSectionId,    // YENİ
  handleLiveSectionSwap,   // YENİ
  handleFinalSectionMove,  // YENİ
  handleLiveTaskSwap,
  applyTaskFilter,
  applyTaskSort,
  handleSortOptionClick,
  activeSorts,
  handleTaskUpdate,
  handleGeneralDrop,
  handleToggleTaskCompleteInline,
  handleOpenPopoverInline,
  formatFriendlyDate,
  onTaskContextMenu,
  onOpenApprovalMenu,
  onRenameSection,
  onDeleteSection,
  onOpenTaskPane,
  syncProjectStates,
  handleTopAddTaskGlobal,
  selectedTaskIds,
  setSelectedTaskIds,
  onTaskSelect,
  activeTaskPaneId,
  onMarqueeMouseDown
}) {
  const [collapsedSections, setCollapsedSections] = useState({})
  const [quickTaskInputs, setQuickTaskInputs] = useState({})
  const [editingSectionId, setEditingSectionId] = useState(null)
  const [editSectionNameValue, setEditSectionNameValue] = useState('')
  const [openSectionMenuId, setOpenSectionMenuId] = useState(null)
  const [showAddFieldMenu, setShowAddFieldMenu] = useState(false)
  const [openCellMenuId, setOpenCellMenuId] = useState(null)
  const [openApprovalMenuTaskId, setOpenApprovalMenuTaskId] = useState(null)
  const [menuPosition, setMenuPosition] = useState('bottom')
  const [editingFieldOptions, setEditingFieldOptions] = useState(false)
  const [dragTargetTaskId, setDragTargetTaskId] = useState(null)

  const handleOpenCellMenu = (e, menuId) => {
    document.body.click();
    e.stopPropagation();
    const isOpen = openCellMenuId === menuId;
    closeAllMenus();
    if (!isOpen) {
      if (e.clientY > window.innerHeight - 250) {
        setMenuPosition('top');
      } else {
        setMenuPosition('bottom');
      }
      setOpenCellMenuId(menuId);
    }
  };
  const [fieldTitle, setFieldTitle] = useState('Effort level');

  const [fieldOptionsList, setFieldOptionsList] = useState([]);
  const [customFields, setCustomFields] = useState([]);

  useEffect(() => {
    if (selectedProject) {
      if (selectedProject.customFieldSettings && Array.isArray(selectedProject.customFieldSettings)) {
        setCustomFields(selectedProject.customFieldSettings);
      } else {
        setCustomFields([]);
      }
    }
  }, [selectedProject]);

  const handleSaveProjectSettings = async (updates) => {
    try {
      const response = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (response.ok) {
        const updatedProject = await response.json();
        if (syncProjectStates) syncProjectStates(updatedProject);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
  const [draggingOptionId, setDraggingOptionId] = useState(null);
  const [hoveredColumnName, setHoveredColumnName] = useState(null);
  const [openColumnMenuName, setOpenColumnMenuName] = useState(null);

  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editTaskTitleValue, setEditTaskTitleValue] = useState('')
  const [editCursorPos, setEditCursorPos] = useState(null)
  const inputRef = useRef(null)

  useLayoutEffect(() => {
    if (editingTaskId && inputRef.current && editCursorPos !== null) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(editCursorPos, editCursorPos);
    }
  }, [editingTaskId, editCursorPos]);

  const closeAllMenus = () => {
    setOpenSectionMenuId(null);
    setShowAddFieldMenu(false);
    setOpenCellMenuId(null);
    setOpenColumnMenuName(null);
    setOpenApprovalMenuTaskId(null);
  };

  const [colWidths, setColWidths] = useState({
    name: 300,
    assignee: 150,
    dueDate: 150
  });
  const [resizingCol, setResizingCol] = useState(null);
  const resizeRef = useRef({ startX: 0, startWidth: 0 });

  useEffect(() => {
    if (!resizingCol) return;

    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e) => {
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = Math.max(50, resizeRef.current.startWidth + delta);
      setColWidths(prev => ({ ...prev, [resizingCol]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingCol(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol]);

  const handleResizeStart = (e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(colId);
    resizeRef.current = { startX: e.clientX, startWidth: colWidths[colId] || 140 };
  };

  const [columnOrder, setColumnOrder] = useState(['assignee', 'dueDate']);
  const [draggingColId, setDraggingColId] = useState(null);
  const [hiddenFields, setHiddenFields] = useState([]);

  useEffect(() => {
    setColumnOrder(prev => {
      const isMyTasks = selectedProject?.status === 'MY_TASKS';
      const base = isMyTasks ? ['projects', 'assignee', 'dueDate'] : ['assignee', 'dueDate'];
      const filteredBase = base.filter(f => !hiddenFields.includes(f));
      const cfs = customFields.map(cf => cf.id);
      const allExpected = [...filteredBase, ...cfs];
      const newOrder = prev.filter(id => allExpected.includes(id));
      const missing = allExpected.filter(id => !prev.includes(id));
      if (missing.length > 0 || newOrder.length !== allExpected.length) {
        return [...newOrder, ...missing];
      }
      return prev;
    });
  }, [customFields, selectedProject?.status, hiddenFields]);

  const [dropTargetCol, setDropTargetCol] = useState({ id: null, position: null });

  const handleColDragStart = (e, colId) => {
    setDraggingColId(colId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColDragOver = (e, targetColId) => {
    e.preventDefault();
    if (!draggingColId || draggingColId === targetColId) {
      if (dropTargetCol.id) setDropTargetCol({ id: null, position: null });
      return;
    }

    const isLastCol = columnOrder[columnOrder.length - 1] === targetColId;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX;
    const isRightHalf = mouseX > rect.left + rect.width / 2;

    let newPos = 'left';
    if (isLastCol && isRightHalf) {
      newPos = 'right';
    } else if (isRightHalf && !isLastCol) {
      // If hovering right half of a column that is NOT the last, 
      // we actually want to show the indicator on the LEFT edge of the NEXT column
      const targetIndex = columnOrder.indexOf(targetColId);
      const nextColId = columnOrder[targetIndex + 1];
      if (nextColId && nextColId !== draggingColId) {
        if (dropTargetCol.id !== nextColId || dropTargetCol.position !== 'left') {
          setDropTargetCol({ id: nextColId, position: 'left' });
        }
        return;
      }
    }

    if (dropTargetCol.id !== targetColId || dropTargetCol.position !== newPos) {
      setDropTargetCol({ id: targetColId, position: newPos });
    }
  };

  const handleColDrop = (e, targetColId) => {
    e.preventDefault();
    if (!draggingColId || !dropTargetCol.id) {
      setDraggingColId(null);
      setDropTargetCol({ id: null, position: null });
      return;
    }
    setColumnOrder(prev => {
      const newOrder = [...prev];
      const fromIndex = newOrder.indexOf(draggingColId);
      newOrder.splice(fromIndex, 1);

      let toIndex = newOrder.indexOf(dropTargetCol.id);
      if (dropTargetCol.position === 'right') {
        toIndex += 1;
      }
      newOrder.splice(toIndex, 0, draggingColId);
      return newOrder;
    });

    setDraggingColId(null);
    setDropTargetCol({ id: null, position: null });
  };

  const handleColDragEnd = () => {
    setDraggingColId(null);
    setDropTargetCol({ id: null, position: null });
  };

  useEffect(() => {
    window.addEventListener('click', closeAllMenus);
    return () => window.removeEventListener('click', closeAllMenus);
  }, []);

  const handleApprovalStatusChangeInline = async (e, task, status) => {
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
        handleTaskUpdate(task.id, data);
        setOpenApprovalMenuTaskId(null);
      } else {
        alert(data.error || "Update failed.");
      }
    } catch (err) { console.error(err); }
  }

  const handleCreateQuickTask = async (sectionId) => {
    const title = quickTaskInputs[sectionId];
    if (isReadOnly || !title || !title.trim()) return;
    try {
      const response = await fetch('http://localhost:5001/api/projects/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), sectionId })
      })
      const data = await response.json()
      if (response.ok) {
        handleTaskUpdate(data.id, data, 'create', sectionId)
        setQuickTaskInputs({ ...quickTaskInputs, [sectionId]: '' })
      }
    } catch (err) { console.error(err) }
  }

  const submitRename = (section) => {
    if (onRenameSection && editSectionNameValue.trim() !== section.name) {
      onRenameSection(section.id, editSectionNameValue);
    }
    setEditingSectionId(null);
  };

  const submitTaskRename = async (task, sectionId) => {
    if (isReadOnly || !editTaskTitleValue.trim() || editTaskTitleValue.trim() === task.title) {
      setEditingTaskId(null);
      return;
    }
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: editTaskTitleValue.trim() })
      });
      const data = await response.json();
      if (response.ok) {
        handleTaskUpdate(task.id, data, 'edit', sectionId);
      }
    } catch (err) { console.error(err); }
    setEditingTaskId(null);
  };

  const handleTaskCustomFieldUpdate = async (taskId, sectionId, fieldId, value) => {
    if (isReadOnly) return;
    try {
      const taskObj = selectedProject.sections.find(s => s.id === sectionId)?.tasks.find(t => t.id === taskId);
      let currentCustomFields = {};
      if (typeof taskObj?.customFields === 'string') {
        try { currentCustomFields = JSON.parse(taskObj.customFields); } catch (e) { }
      } else if (taskObj?.customFields) {
        currentCustomFields = taskObj.customFields;
      }
      const newCustomFields = { ...currentCustomFields, [fieldId]: value };

      const response = await fetch(`http://localhost:5001/api/projects/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ customFields: newCustomFields })
      });
      const data = await response.json();
      if (response.ok) {
        handleTaskUpdate(taskId, data, 'edit', sectionId);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const handleAddFieldModal = () => setIsAddFieldModalOpen(true);
    window.addEventListener('openAddFieldModal', handleAddFieldModal);
    return () => window.removeEventListener('openAddFieldModal', handleAddFieldModal);
  }, []);


  const handleDeleteField = (fieldTitleToDelete) => {
    if (fieldTitleToDelete === 'Name' || fieldTitleToDelete === 'Assignee' || fieldTitleToDelete === 'Due date') {
      return;
    }

    const newCustomFields = customFields.filter(cf => cf.title !== fieldTitleToDelete);
    setCustomFields(newCustomFields);
    handleSaveProjectSettings({ customFieldSettings: newCustomFields });
    setEditingFieldOptions(false);
    setOpenColumnMenuName(null);
  };

  const renderColumnDropdownMenu = (colName) => {
    const titles = { name: 'Name', assignee: 'Assignee', dueDate: 'Due date', projects: 'Projects' };
    return (
      <div style={styles.columnDropdownMenu} onClick={(e) => e.stopPropagation()}>
        {(colName !== 'name' && colName !== 'assignee' && colName !== 'dueDate' && colName !== 'projects') && (
          <button onClick={() => {
            setEditingFieldOptions(true);
            setFieldTitle(titles[colName] || colName);
            const cf = customFields.find(f => f.title === (titles[colName] || colName));
            setFieldOptionsList(cf?.options || []);
            closeAllMenus();
          }} style={styles.dropdownItem}>✏️ Edit field</button>
        )}
        <button style={styles.dropdownItem}>⚖️ Field access and permissions <span style={{ float: 'right' }}>{'>'}</span></button>
        <div style={styles.menuDivider}></div>
        <button style={styles.dropdownItem}>≡ Filter</button>
        <button style={styles.dropdownItem}>⊞ Group <span style={{ float: 'right' }}>{'>'}</span></button>
        <button onClick={() => { handleSortOptionClick && handleSortOptionClick(titles[colName] || colName); closeAllMenus(); }} style={styles.dropdownItem}>Sort</button>
        <div style={styles.menuDivider}></div>
        <button onClick={() => { setShowAddFieldMenu(true); setOpenColumnMenuName(null); }} style={styles.dropdownItem}>+ Add column</button>
        <button style={styles.dropdownItem}>↔ Move column <span style={{ float: 'right' }}>{'>'}</span></button>
        <button style={styles.dropdownItem}>👁️ Hide column</button>
        <div style={styles.menuDivider}></div>
        <button style={styles.dropdownItem}>✨ AI auto-fill</button>
        <div style={styles.menuDivider}></div>
        {(colName !== 'name' && colName !== 'assignee' && colName !== 'dueDate' && colName !== 'projects') && (
          <button onClick={(e) => { e.stopPropagation(); handleDeleteField(titles[colName] || colName); }} style={{ ...styles.dropdownItemDelete, padding: '0.5rem 0.75rem', marginTop: 0 }}>🗑️ Delete field</button>
        )}
      </div>
    );
  };

  const handleDragStartOption = (e, id) => {
    setDraggingOptionId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverOption = (e, targetId) => {
    e.preventDefault();
    if (!draggingOptionId || draggingOptionId === targetId) return;
    const sourceIndex = fieldOptionsList.findIndex(o => o.id === draggingOptionId);
    const targetIndex = fieldOptionsList.findIndex(o => o.id === targetId);
    const newList = [...fieldOptionsList];
    const [removed] = newList.splice(sourceIndex, 1);
    newList.splice(targetIndex, 0, removed);
    setFieldOptionsList(newList);
  };

  const handleDragEndOption = () => {
    setDraggingOptionId(null);
  };

  const handleAddOption = () => {
    setFieldOptionsList([...fieldOptionsList, { id: Date.now().toString(), label: '', color: '#FDBA74', icon: '▼' }]);
  };

  const handleRemoveOption = (id) => {
    setFieldOptionsList(fieldOptionsList.filter(o => o.id !== id));
  };

  const handleOptionLabelChange = (id, newLabel) => {
    setFieldOptionsList(fieldOptionsList.map(o => o.id === id ? { ...o, label: newLabel } : o));
  };

  const renderTaskRow = (task, sectionId) => {
    return (
      <div
        key={task.id}
        onClickCapture={(e) => {
          let handled = false;
          if (onTaskSelect) {
            handled = onTaskSelect(e, task.id);
          }
          if (handled) {
            e.stopPropagation();
            e.preventDefault();
          }

          setLastInteractedSectionId(sectionId);
          if (setLastInteractedTaskId) setLastInteractedTaskId(task.id);
        }}
        data-task-id={task.id}
        className={`list-view-task-row ${(selectedTaskIds?.has(task.id) || activeTaskPaneId === task.id) ? 'selected' : ''}`}
        style={{
          ...styles.taskDataTableRow,
          position: 'relative',
          zIndex: (openApprovalMenuTaskId === task.id || (openCellMenuId && openCellMenuId.startsWith(`${task.id}-`))) ? 9999 : 0,
          opacity: draggingTaskId === task.id ? 0.4 : 1,
          borderTop: dragTargetTaskId === task.id ? '2px solid var(--accent-primary)' : 'none'
        }}
        onContextMenu={(e) => { e.preventDefault(); onTaskContextMenu(e, task.id); }}
        onDragOver={(e) => {
          e.preventDefault();
          if (draggingTaskId && draggingTaskId !== task.id && !isVirtualGrouping) {
            const isMultiDrag = selectedTaskIds && selectedTaskIds.size > 1 && selectedTaskIds.has(draggingTaskId);
            if (isMultiDrag) {
              setDragTargetTaskId(task.id);
            } else {
              if (handleLiveTaskSwap) handleLiveTaskSwap(draggingTaskId, task.id);
            }
          }
        }}
        onDragLeave={() => setDragTargetTaskId(null)}
        onDrop={(e) => { 
          e.stopPropagation();
          setDragTargetTaskId(null);
          if (!isVirtualGrouping) handleGeneralDrop(e, sectionId, task.id); 
        }}
      >
        <div
          draggable={!isReadOnly && !isVirtualGrouping}
          onDragStart={(e) => {
            e.stopPropagation();
            setDraggingTaskId(task.id);
            e.dataTransfer.setData('drag-type', 'task');
            e.dataTransfer.setData('task-id', task.id);

            const ghostEl = document.getElementById('asana-drag-ghost-preview-card');
            if (ghostEl) {
              if (selectedTaskIds && selectedTaskIds.size > 1 && selectedTaskIds.has(task.id)) {
                ghostEl.textContent = `${selectedTaskIds.size} tasks`;
              } else {
                ghostEl.textContent = task.title;
              }
              e.dataTransfer.setDragImage(ghostEl, 20, 15);
            }
          }}
          onDragEnd={() => {
            setDraggingTaskId(null);
            setDragTargetTaskId(null);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          style={styles.drag6DotHandleCellTask}
        >
          ⋮⋮
        </div>

        {/* Hücre 1: Checkbox & Başlık */}
        <div
          style={{ ...styles.gridBodyCell, width: colWidths.name, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '1rem', cursor: 'pointer', overflow: openApprovalMenuTaskId === task.id ? 'visible' : 'hidden', position: openApprovalMenuTaskId === task.id ? 'relative' : 'static', zIndex: openApprovalMenuTaskId === task.id ? 9999 : 'auto' }}
          onClick={(e) => {
            if (onOpenTaskPane) onOpenTaskPane(task.id);
          }}
        >
          {task.type === 'APPROVAL' ? (
            <div style={{ position: 'relative', zIndex: openApprovalMenuTaskId === task.id ? 9999 : 'auto' }}>
              <div
                style={{
                  width: '18px', height: '18px', borderRadius: '4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: isReadOnly ? 'default' : 'pointer', flexShrink: 0,
                  backgroundColor: task.approvalStatus === 'APPROVED' ? 'var(--accent-success)' : task.approvalStatus === 'REJECTED' ? 'var(--accent-danger)' : task.approvalStatus === 'CHANGES_REQUESTED' ? '#F59E0B' : 'transparent',
                  border: task.approvalStatus === 'PENDING' || !task.approvalStatus ? '1px solid var(--text-tertiary)' : 'none',
                  color: task.approvalStatus === 'PENDING' || !task.approvalStatus ? 'var(--text-secondary)' : '#fff',
                }}
                title={task.approvalStatus || 'PENDING'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isReadOnly && onOpenApprovalMenu) {
                    closeAllMenus();
                    onOpenApprovalMenu(e, task);
                  }
                }}
              >
                {task.approvalStatus === 'APPROVED' ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : task.approvalStatus === 'REJECTED' ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> : task.approvalStatus === 'CHANGES_REQUESTED' ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.67-5.67"></path></svg> : <span style={{ fontSize: '12px', lineHeight: 1 }}>⚖️</span>}
              </div>
            </div>
          ) : task.type === 'MILESTONE' ? (
            <div
              onClick={(e) => { e.stopPropagation(); if (!isReadOnly) handleToggleTaskCompleteInline(task, sectionId); }}
              style={{
                width: '12px', height: '12px', flexShrink: 0, cursor: isReadOnly ? 'default' : 'pointer',
                transform: 'rotate(45deg)',
                backgroundColor: task.isCompleted ? 'var(--accent-success)' : 'transparent',
                border: task.isCompleted ? '2px solid var(--accent-success)' : '2px solid #6366F1',
              }}
              title="Milestone"
            />
          ) : (
            <div
              onClick={(e) => { e.stopPropagation(); if (!isReadOnly) handleToggleTaskCompleteInline(task, sectionId); }}
              style={{
                width: '18px', height: '18px', borderRadius: '50%', border: '1px solid',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isReadOnly ? 'default' : 'pointer', flexShrink: 0,
                borderColor: task.isCompleted ? 'var(--accent-success)' : 'var(--text-tertiary)',
                backgroundColor: task.isCompleted ? 'var(--accent-success)' : 'transparent',
                color: '#fff',
              }}
            >
              {task.isCompleted && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
            </div>
          )}

          {editingTaskId === task.id ? (
            <input
              ref={editingTaskId === task.id ? inputRef : null}
              type="text"
              value={editTaskTitleValue}
              autoFocus
              onChange={(e) => setEditTaskTitleValue(e.target.value)}
              onBlur={() => submitTaskRename(task, sectionId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  submitTaskRename(task, sectionId);
                  if (handleTopAddTaskGlobal) handleTopAddTaskGlobal();
                }
                if (e.key === 'Escape') setEditingTaskId(null);
              }}
              style={{
                minWidth: '200px',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                padding: '0',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                border: 'none',
                outline: 'none'
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (!isReadOnly) {
                  let offset = null;
                  if (document.caretRangeFromPoint) {
                    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                    if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
                      offset = range.startOffset;
                    }
                  } else if (document.caretPositionFromPoint) {
                    const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
                    if (pos && pos.offsetNode.nodeType === Node.TEXT_NODE) {
                      offset = pos.offset;
                    }
                  }
                  setEditCursorPos(offset !== null ? offset : task.title.length);
                  setEditingTaskId(task.id);
                  setEditTaskTitleValue(task.title);
                }
                if (onOpenTaskPane) onOpenTaskPane(task.id);
              }}
              style={{ fontSize: '0.85rem', color: 'var(--text-primary)', textDecoration: task.isCompleted ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: isReadOnly ? 'default' : 'text', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {task.title}
              {task.tags && task.tags.map(tag => (
                <span key={tag.id} style={{ color: tag.color, fontSize: '0.75rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path></svg> {tag.name}
                </span>
              ))}
            </span>
          )}
        </div>

        {/* Data Cells (Dynamic based on columnOrder) */}
        {columnOrder.map(colId => {
          if (colId === 'assignee') {
            return (
              <div key="assignee" style={{ ...styles.gridBodyCell, width: colWidths.assignee, flexShrink: 0, cursor: isReadOnly ? 'default' : 'pointer' }} onClick={(e) => !isReadOnly && handleOpenPopoverInline(e, 'assignee', task, sectionId)}>
                {task.assignee ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden', height: '24px' }}>
                    <UserAvatar name={task.assignee.name} size={24} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.assignee.name}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', height: '24px' }}>
                    <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>👤 Unassigned</span>
                  </div>
                )}
              </div>
            );
          } else if (colId === 'dueDate') {
            return (
              <div key="dueDate" style={{ ...styles.gridBodyCell, width: colWidths.dueDate, flexShrink: 0, cursor: isReadOnly ? 'default' : 'pointer', color: (task.dueDate && new Date(task.dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && !task.isCompleted) ? '#EF4444' : '#4F46E5', fontSize: '0.8rem', fontWeight: '500' }} onClick={(e) => !isReadOnly && handleOpenPopoverInline(e, 'date', task, sectionId)}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatFriendlyDate(task.startDate, task.dueDate)}</span>
              </div>
            );
          } else if (colId === 'projects') {
            const taskProjectNames = [];
            if (task.section?.project && task.section.project.status !== 'MY_TASKS') {
              taskProjectNames.push(task.section.project.name);
            }
            if (task.secondaryProjects) {
              task.secondaryProjects.forEach(sp => {
                if (sp.project && sp.project.status !== 'MY_TASKS' && sp.project.id !== selectedProject?.id) {
                  taskProjectNames.push(sp.project.name);
                }
              });
            }
            const uniqueTaskProjects = [...new Set(taskProjectNames)];
            
            return (
              <div key="projects" style={{ ...styles.gridBodyCell, width: colWidths.projects || 140, flexShrink: 0, cursor: isReadOnly ? 'default' : 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem' }} onClick={(e) => !isReadOnly && handleOpenPopoverInline(e, 'projects', task, sectionId)}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {uniqueTaskProjects.length > 0 ? uniqueTaskProjects.join(', ') : '—'}
                </span>
              </div>
            );
          } else {
            const cf = customFields.find(f => f.id === colId);
            if (!cf) return null;
            let parsedFields = {};
            if (typeof task.customFields === 'string') {
              try { parsedFields = JSON.parse(task.customFields); } catch (e) { }
            } else if (task.customFields) {
              parsedFields = task.customFields;
            }

            return (
              <div key={cf.id} style={{ ...styles.gridBodyCell, width: colWidths[cf.id] || 140, flexShrink: 0, position: 'relative', cursor: (isReadOnly || cf.type === 'id' || cf.type === 'formula' || cf.type === 'github_pr') ? 'default' : 'pointer', overflow: 'visible' }} onClick={(e) => {
                if (isReadOnly || cf.type === 'id' || cf.type === 'formula' || cf.type === 'github_pr') return;
                if (cf.type === 'date') {
                  if (handleOpenPopoverInline) handleOpenPopoverInline(e, 'custom-date', task, sectionId, { customFieldId: cf.id });
                } else {
                  handleOpenCellMenu(e, `${task.id}-${cf.id}`);
                }
              }}>
                {(() => {
                  const val = parsedFields[cf.id];

                  if (cf.type === 'id') {
                    const idValue = val || task.id?.slice(-6).toUpperCase();
                    return <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{idValue}</span>;
                  }
                  if (cf.type === 'formula') {
                    return <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{val || '—'}</span>;
                  }

                  if (cf.type === 'github_pr') {
                    const prs = getParsedGithubPRs(task.githubPRs);
                    if (prs.length === 0) return <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>—</span>;

                    const firstPr = prs[0];
                    let statusColor = getGithubPRStatusColor(firstPr);
                    let label = getGithubPRStatusLabel(firstPr);

                    if (prs.length > 1) label += ` (+${prs.length - 1})`;

                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill={statusColor} style={{ flexShrink: 0 }}>
                          <path fillRule="evenodd" d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.25 2.25 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 7.425A3.155 3.155 0 0012.75 12h.75a.75.75 0 01.75.75v.5a.75.75 0 01-.75.75H12a4.655 4.655 0 01-4.655-4.655V5.372a2.25 2.25 0 111.5 0v3.983c0 .713.273 1.398.75 1.916V7.425z"></path>
                        </svg>
                        <a href={firstPr.html_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--text-primary)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={e => e.stopPropagation()}>
                          {label}
                        </a>
                      </div>
                    );
                  }

                  if (!val && cf.type !== 'timer') return null;

                  if (cf.type === 'SELECT' || cf.type === 'single-select') {
                    const opt = cf.options?.find(o => (o.label || o.value) === val);
                    const displayValue = opt ? (opt.label || opt.value) : val;
                    const displayColor = opt ? opt.color : '#F3F4F6';
                    return (
                      <span style={{ fontSize: '0.75rem', fontWeight: '500', padding: '2px 8px', borderRadius: '4px', backgroundColor: displayColor, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {displayValue}
                      </span>
                    );
                  } else if (cf.type === 'MULTI_SELECT' || cf.type === 'multi-select') {
                    const selectedValues = Array.isArray(val) ? val : [val];
                    return (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap', overflow: 'hidden' }}>
                        {selectedValues.map((v, i) => {
                          const opt = cf.options?.find(o => (o.label || o.value) === v);
                          const displayColor = opt ? opt.color : '#F3F4F6';
                          return (
                            <span key={i} style={{ fontSize: '0.75rem', fontWeight: '500', padding: '2px 8px', borderRadius: '4px', backgroundColor: displayColor, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                              {opt ? (opt.label || opt.value) : v}
                            </span>
                          );
                        })}
                      </div>
                    );
                  } else if (cf.type === 'people') {
                    const selectedPeople = Array.isArray(val) ? val : [val];
                    const members = selectedProject?.members?.map(m => m.user) || [];
                    return (
                      <div style={{ display: 'flex', gap: '4px', overflow: 'hidden' }}>
                        {selectedPeople.map((uid, i) => {
                          const member = members.find(m => m.id === uid);
                          return (
                            <div key={i} title={member?.name || 'Unknown'}>
                              <UserAvatar name={member?.name} size={20} />
                            </div>
                          );
                        })}
                      </div>
                    );
                  } else if (cf.type === 'timer') {
                    const timerData = (typeof val === 'object' && val !== null) ? val : { running: false, elapsed: 0, lastStart: null };
                    const elapsed = timerData.elapsed || 0;
                    const h = Math.floor(elapsed / 3600);
                    const m = Math.floor((elapsed % 3600) / 60);
                    const s = elapsed % 60;
                    return <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{`${h}h ${m}m ${s}s`}</span>;
                  } else if (cf.type === 'date') {
                    const formatted = val ? new Date(val).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
                    return <span>{formatted}</span>;
                  } else if (typeof val === 'object') {
                    return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{JSON.stringify(val)}</span>;
                  }

                  return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(val)}</span>;
                })()}
                {openCellMenuId === `${task.id}-${cf.id}` && (
                  <div style={{ ...styles.cellDropdownMenu, ...(menuPosition === 'top' ? { bottom: '100%', top: 'auto', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }) }} onClick={(e) => e.stopPropagation()}>
                    {(cf.type === 'SELECT' || cf.type === 'single-select' || cf.type === 'MULTI_SELECT' || cf.type === 'multi-select') && (() => {
                      const isMulti = cf.type === 'MULTI_SELECT' || cf.type === 'multi-select';
                      const val = parsedFields[cf.id];
                      const selectedValues = Array.isArray(val) ? val : (val ? [val] : []);

                      const validOptionValues = (cf.options || []).map(o => o.label || o.value);
                      const orphanedValues = selectedValues.filter(v => !validOptionValues.includes(v));

                      const allOptionsToRender = [
                        ...(cf.options || []),
                        ...orphanedValues.map(v => ({ id: `orphan-${v}`, label: v, color: '#F3F4F6' }))
                      ];

                      return allOptionsToRender.map(o => {
                        const isSelected = selectedValues.includes(o.label || o.value);

                        return (
                          <button
                            key={o.id}
                            onClick={() => {
                              if (isMulti) {
                                let newArr = [...selectedValues];
                                if (isSelected) newArr = newArr.filter(v => v !== (o.label || o.value));
                                else newArr.push(o.label || o.value);
                                handleTaskCustomFieldUpdate(task.id, sectionId, cf.id, newArr);
                              } else {
                                handleTaskCustomFieldUpdate(task.id, sectionId, cf.id, o.label);
                                setOpenCellMenuId(null);
                              }
                            }}
                            style={{ ...styles.dropdownItem, color: 'var(--text-primary)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: isSelected ? 'var(--bg-secondary)' : 'transparent' }}
                          >
                            {isMulti && (
                              <div style={{ width: '14px', height: '14px', border: '1px solid var(--border-color)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? 'var(--accent-primary)' : 'transparent' }}>
                                {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                              </div>
                            )}
                            <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: o.color || '#E0E7FF', flexShrink: 0 }}></div>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label || o.value}</span>
                          </button>
                        );
                      });
                    })()}
                    {cf.type === 'people' && (
                      <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
                        <div style={{ padding: '0 8px 4px', fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '600' }}>SELECT PEOPLE</div>
                        {(selectedProject?.members?.map(m => m.user) || []).map(m => {
                          const val = parsedFields[cf.id];
                          const selectedPeople = Array.isArray(val) ? val : (val ? [val] : []);
                          const isSelected = selectedPeople.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              onClick={() => {
                                let newArr = [...selectedPeople];
                                if (isSelected) newArr = newArr.filter(id => id !== m.id);
                                else newArr.push(m.id);
                                handleTaskCustomFieldUpdate(task.id, sectionId, cf.id, newArr);
                              }}
                              style={{ ...styles.dropdownItem, display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: isSelected ? 'var(--bg-secondary)' : 'transparent' }}
                            >
                              <div style={{ width: '14px', height: '14px', border: '1px solid var(--border-color)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? 'var(--accent-primary)' : 'transparent' }}>
                                {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                              </div>
                              <UserAvatar name={m.name} size={20} />
                              <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{m.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {(cf.type === 'text' || cf.type === 'number') && (
                      <div style={{ padding: '8px' }}>
                        <input
                          autoFocus
                          type={cf.type === 'number' ? 'number' : 'text'}
                          defaultValue={parsedFields[cf.id] || ''}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleTaskCustomFieldUpdate(task.id, sectionId, cf.id, e.target.value);
                              setOpenCellMenuId(null);
                            }
                          }}
                          placeholder={`Enter ${cf.title}...`}
                          style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)', boxSizing: 'border-box' }}
                        />
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px', textAlign: 'right' }}>Press Enter to save</div>
                      </div>
                    )}
                    {cf.type === 'timer' && (
                      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(() => {
                          const timerData = (typeof parsedFields[cf.id] === 'object' && parsedFields[cf.id] !== null) ? parsedFields[cf.id] : { running: false, elapsed: 0, lastStart: null };
                          const elapsed = timerData.elapsed || 0;
                          const isRunning = timerData.running || false;
                          const h = Math.floor(elapsed / 3600);
                          const m = Math.floor((elapsed % 3600) / 60);
                          const s = elapsed % 60;
                          return (
                            <>
                              <div style={{ fontSize: '1rem', fontFamily: 'monospace', textAlign: 'center', color: isRunning ? '#10B981' : 'var(--text-primary)' }}>
                                {`${h}h ${m}m ${s}s`}
                              </div>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => {
                                    if (isRunning) {
                                      const now = Math.floor(Date.now() / 1000);
                                      const added = timerData.lastStart ? now - timerData.lastStart : 0;
                                      handleTaskCustomFieldUpdate(task.id, sectionId, cf.id, { running: false, elapsed: elapsed + added, lastStart: null });
                                    } else {
                                      handleTaskCustomFieldUpdate(task.id, sectionId, cf.id, { running: true, elapsed, lastStart: Math.floor(Date.now() / 1000) });
                                    }
                                  }}
                                  style={{ padding: '4px 12px', border: 'none', borderRadius: '4px', backgroundColor: isRunning ? '#FEF2F2' : '#ECFDF5', color: isRunning ? '#EF4444' : '#10B981', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                  {isRunning ? 'Pause' : 'Start'}
                                </button>
                                <button
                                  onClick={() => handleTaskCustomFieldUpdate(task.id, sectionId, cf.id, { running: false, elapsed: 0, lastStart: null })}
                                  style={{ padding: '4px 12px', border: 'none', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                >
                                  Reset
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid #E5E7EB', margin: '4px 0' }}></div>
                    <button onClick={() => { handleTaskCustomFieldUpdate(task.id, sectionId, cf.id, ''); setOpenCellMenuId(null); }} style={{ ...styles.dropdownItem, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      Clear value
                    </button>
                    <button onClick={() => { setFieldTitle(cf.title); setFieldOptionsList(cf.options || []); setEditingFieldOptions(true); setOpenCellMenuId(null); }} style={{ ...styles.dropdownItem, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '1rem' }}>✏️</span> Edit field
                    </button>
                  </div>
                )}
              </div>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div style={styles.listSpreadsheetWrapper} onMouseDown={onMarqueeMouseDown}>
      {resizingCol && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, cursor: 'col-resize' }} />
      )}
      {editingFieldOptions && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: '500' }}>✏️ Edit field</h2>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Created by Iboro, 8 Jul</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                  <span style={{ fontSize: '1rem' }}>👥</span> Manage access
                </button>
                <button onClick={() => setEditingFieldOptions(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Field title <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
                <input
                  type="text"
                  value={fieldTitle}
                  onChange={(e) => setFieldTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.9rem', color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)', boxSizing: 'border-box', outlineColor: 'var(--accent-primary)' }}
                />
              </div>
              <div style={{ width: '150px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Field type</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)', fontSize: '0.9rem', paddingTop: '0.4rem' }}>
                  <span>⊖</span> Single-select
                </div>
              </div>
            </div>

            <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', padding: 0, fontSize: '0.85rem', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ fontSize: '1rem' }}>+</span> Add description
            </button>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Options <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {fieldOptionsList.map((opt) => (
                  <div
                    key={opt.id}
                    draggable
                    onDragStart={(e) => handleDragStartOption(e, opt.id)}
                    onDragOver={(e) => handleDragOverOption(e, opt.id)}
                    onDragEnd={handleDragEndOption}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: draggingOptionId === opt.id ? 0.5 : 1, padding: '0.2rem 0' }}
                  >
                    <div style={{ cursor: 'grab', color: 'var(--text-tertiary)', padding: '0 0.2rem', display: 'flex', alignItems: 'center', userSelect: 'none', fontSize: '1.2rem' }}>⋮⋮</div>
                    <input
                      type="color"
                      value={opt.color || '#E0E7FF'}
                      onChange={(e) => setFieldOptionsList(fieldOptionsList.map(o => o.id === opt.id ? { ...o, color: e.target.value } : o))}
                      style={{ width: 24, height: 24, border: 'none', padding: 0, backgroundColor: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                      title="Choose color"
                    />
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => handleOptionLabelChange(opt.id, e.target.value)}
                      placeholder="Type an option name"
                      style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.9rem', color: 'var(--text-primary)', padding: '0.2rem 0', backgroundColor: 'transparent' }}
                    />
                    <button onClick={() => handleRemoveOption(opt.id)} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={handleAddOption} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', padding: 0, fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '1rem' }}>+</span> Add an option
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                Add to My workspace's field library
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                Notify collaborators when this field's value is changed
              </label>
            </div>

            <div style={{ borderTop: '1px solid #E5E7EB', margin: '0 -1.5rem 1rem -1.5rem' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', color: '#EF4444', border: '1px solid #FCA5A5', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }} onClick={() => handleDeleteField(fieldTitle)}>Delete field</button>
              <button style={{ padding: '0.5rem 1rem', backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }} onClick={() => {

                const newCustomFields = customFields.map(cf => cf.title === fieldTitle ? { ...cf, options: fieldOptionsList } : cf);
                setCustomFields(newCustomFields);
                handleSaveProjectSettings({ customFieldSettings: newCustomFields });
                setEditingFieldOptions(false);
              }}>Save changes</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ minWidth: 'max-content', flex: 1 }}>
        {/* Grid Tablo Başlık Sütunları */}
        <div style={styles.listTableHeaderRow}>
          <div style={{ width: '32px', flexShrink: 0, boxSizing: 'border-box' }} />
          <div
            style={{ ...styles.gridHeaderCell, width: colWidths.name, flexShrink: 0, paddingLeft: '42px', position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onMouseEnter={() => setHoveredColumnName('name')}
            onMouseLeave={() => setHoveredColumnName(null)}
            onClick={(e) => {
              handleSortOptionClick && handleSortOptionClick('Alphabetical')
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: '0.5rem' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: activeSorts?.find(s => s.field === 'Alphabetical') ? '700' : '500' }}>
                Name {activeSorts?.find(s => s.field === 'Alphabetical') && (activeSorts.find(s => s.field === 'Alphabetical').direction === 'asc' ? '↑' : '↓')}
              </span>
            </div>
            {(hoveredColumnName === 'name' || openColumnMenuName === 'name') && (
              <button onClick={(e) => { document.body.click(); e.stopPropagation(); const isOpen = openColumnMenuName === 'name'; closeAllMenus(); if (!isOpen) setOpenColumnMenuName('name'); }} style={styles.columnHeaderMenuBtn}>▼</button>
            )}
            {openColumnMenuName === 'name' && renderColumnDropdownMenu('name')}
            <div style={styles.resizeHandle} onMouseDown={(e) => handleResizeStart(e, 'name')} onClick={(e) => e.stopPropagation()} />
          </div>
          {columnOrder.map(colId => {
            let title = '';
            let menuName = colId;

            if (colId === 'assignee') title = 'Assignee';
            else if (colId === 'dueDate') title = 'Due date';
            else if (colId === 'projects') title = 'Projects';
            else {
              const cf = customFields.find(f => f.id === colId);
              if (cf) {
                title = cf.title;
                menuName = cf.title;
              } else {
                return null;
              }
            }

            return (
              <div
                key={colId}
                draggable
                onDragStart={(e) => handleColDragStart(e, colId)}
                onDragOver={(e) => handleColDragOver(e, colId)}
                onDrop={(e) => handleColDrop(e, colId)}
                onDragEnd={handleColDragEnd}
                onClick={() => handleSortOptionClick && handleSortOptionClick(title)}
                style={{ ...styles.gridHeaderCell, width: colWidths[colId] || 140, flexShrink: 0, position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: draggingColId === colId ? 0.5 : 1, cursor: draggingColId === colId ? 'grabbing' : 'pointer', boxShadow: dropTargetCol.id === colId ? (dropTargetCol.position === 'left' ? 'inset 3px 0 0 #4F46E5' : 'inset -3px 0 0 #4F46E5') : 'none' }}
                onMouseEnter={() => setHoveredColumnName(menuName)}
                onMouseLeave={() => setHoveredColumnName(null)}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, pointerEvents: 'none', fontWeight: activeSorts?.find(s => s.field === title) ? '700' : '500' }}>
                  {title} {activeSorts?.find(s => s.field === title) && (activeSorts.find(s => s.field === title).direction === 'asc' ? '↑' : '↓')}
                </span>
                {(hoveredColumnName === menuName || openColumnMenuName === menuName) && (
                  <button onClick={(e) => { document.body.click(); e.stopPropagation(); const isOpen = openColumnMenuName === menuName; closeAllMenus(); if (!isOpen) setOpenColumnMenuName(menuName); }} style={styles.columnHeaderMenuBtn}>▼</button>
                )}
                {openColumnMenuName === menuName && renderColumnDropdownMenu(menuName)}
                <div style={styles.resizeHandle} onMouseDown={(e) => handleResizeStart(e, colId)} onClick={(e) => e.stopPropagation()} />
              </div>
            );
          })}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '200px', flexShrink: 0, position: 'relative', borderBottom: '1px solid var(--border-color)' }}>
            <button onClick={(e) => { document.body.click(); e.stopPropagation(); const isOpen = showAddFieldMenu; closeAllMenus(); setShowAddFieldMenu(!isOpen); }} style={{ ...styles.addFieldButton, width: '40px' }} title="Add column">
              +
            </button>
            {showAddFieldMenu && (
              <div style={styles.addFieldMenu} onClick={(e) => e.stopPropagation()}>
                <div style={styles.addFieldMenuHeader}>Field types</div>
                <button onClick={() => { setIsAddFieldModalOpen(true); setShowAddFieldMenu(false); }} style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>⊘</span> Single-select</button>
                <button onClick={() => { setIsAddFieldModalOpen(true); setShowAddFieldMenu(false); }} style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>☑</span> Multi-select</button>
                <button onClick={() => { setIsAddFieldModalOpen(true); setShowAddFieldMenu(false); }} style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>📅</span> Date</button>
                <button onClick={() => { setIsAddFieldModalOpen(true); setShowAddFieldMenu(false); }} style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>👤</span> People</button>
                <button onClick={() => { setIsAddFieldModalOpen(true); setShowAddFieldMenu(false); }} style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>A</span> Text</button>
                <button onClick={() => { setIsAddFieldModalOpen(true); setShowAddFieldMenu(false); }} style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>#</span> Number</button>
                <button onClick={() => { setIsAddFieldModalOpen(true); setShowAddFieldMenu(false); }} style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>fx</span> Formula</button>
                <button onClick={() => { setIsAddFieldModalOpen(true); setShowAddFieldMenu(false); }} style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>🆔</span> ID</button>
                <button onClick={() => { setIsAddFieldModalOpen(true); setShowAddFieldMenu(false); }} style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>⏱</span> Timer</button>
              </div>
            )}
          </div>
        </div>

        {/* Bölümler ve Görevler Gövdesi */}
        <div style={styles.listSpreadsheetBody}>
          {(groupedSections || selectedProject.sections)?.map((section, idx) => {
            const filteredTasks = groupedSections ? section.tasks : (applyTaskSort ? applyTaskSort(applyTaskFilter(section.tasks)) : applyTaskFilter(section.tasks))
            const isCollapsed = collapsedSections[section.id]
            const isEditing = editingSectionId === section.id

            return (
              <div
                key={section.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  opacity: draggingSectionId === section.id ? 0.4 : 1
                }}
                onClickCapture={() => setLastInteractedSectionId(section.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggingSectionId && draggingSectionId !== section.id && !isVirtualGrouping) {
                    const sortedSections = [...(selectedProject.sections || [])].sort((a, b) => a.order - b.order);
                    handleLiveSectionSwap(draggingSectionId, section.id);
                  }
                }}
                onDrop={(e) => { if (!isVirtualGrouping) handleGeneralDrop(e, section.id); }}
              >
                {/* BÖLÜM (SECTION) BAÅžLIK SATIRI */}
                <div className="list-section-header" style={{ ...styles.sectionAccordionRow, position: 'relative', zIndex: openSectionMenuId === section.id ? 50 : 1 }}>
                  <div
                    className="drag6DotHandleCell"
                    draggable={!isReadOnly && !isEditing && !isVirtualGrouping}
                    onDragStart={(e) => {
                      setDraggingSectionId(section.id);
                      e.dataTransfer.setData('drag-type', 'section');
                      e.dataTransfer.setData('section-id', section.id);

                      const ghostEl = document.getElementById('asana-drag-ghost-preview-card');
                      if (ghostEl) {
                        ghostEl.textContent = section.name;
                        e.dataTransfer.setDragImage(ghostEl, 20, 15);
                      }
                    }}
                    onDragEnd={() => {
                      handleFinalSectionMove();
                      setDraggingSectionId(null);
                    }}
                    style={styles.drag6DotHandleCell}
                  >
                    ⋮⋮
                  </div>

                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, cursor: isEditing ? 'default' : 'pointer' }}
                    onClick={() => !isEditing && setCollapsedSections({ ...collapsedSections, [section.id]: !isCollapsed })}
                  >
                    <span style={styles.accordionArrowIcon}>{isCollapsed ? '▶' : '▼'}</span>

                    {isEditing ? (
                      <input
                        autoFocus
                        value={editSectionNameValue}
                        onChange={(e) => setEditSectionNameValue(e.target.value)}
                        onBlur={() => submitRename(section)}
                        onKeyDown={(e) => e.key === 'Enter' && submitRename(section)}
                        style={styles.sectionRenameInput}
                      />
                    ) : (
                      <span style={styles.sectionTitleText}>{section.name}</span>
                    )}

                    {!isEditing && <span style={styles.sectionTaskCountBadge}>{filteredTasks.length}</span>}

                    {/* THREE DOTS MENU */}
                    {!isReadOnly && !isEditing && !isVirtualGrouping && (
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); const isOpen = openSectionMenuId === section.id; closeAllMenus(); if (!isOpen) setOpenSectionMenuId(section.id); }}
                          style={styles.threeDotButton}
                        >
                          ⋮
                        </button>
                        {openSectionMenuId === section.id && (
                          <div style={{ ...styles.dropdownMenu, top: '100%', left: '0', right: 'auto', marginTop: '4px' }}>
                            <button onClick={() => { setEditingSectionId(section.id); setEditSectionNameValue(section.name); setOpenSectionMenuId(null); }} style={styles.dropdownItem}>Rename Section</button>
                            <button onClick={() => { if (onDeleteSection) onDeleteSection(section.id); setOpenSectionMenuId(null); }} style={styles.dropdownItemDelete}>Delete Section</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                  {/* Görev Satırları Gövdesi */}
                  {!isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {section.subgroups ? (
                        section.subgroups.map(subgroup => (
                          <div key={subgroup.id}>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 1rem', backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', userSelect: 'none', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              <span style={{ fontSize: '1rem', marginRight: '0.5rem' }}>↳</span>
                              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>{subgroup.name}</span>
                              <span style={{ backgroundColor: 'var(--border-color)', color: 'var(--text-primary)', borderRadius: '10px', padding: '1px 6px', fontSize: '0.7rem', marginLeft: '0.4rem', fontWeight: '600' }}>{subgroup.tasks.length}</span>
                            </div>
                            {subgroup.tasks.map(t => renderTaskRow(t, section.id))}
                          </div>
                        ))
                      ) : (
                        filteredTasks.map(t => renderTaskRow(t, section.id))
                      )}
                      {/* Satır İçi Hızlı Görev Ekleme */}
                      {!isReadOnly && !isVirtualGrouping && (
                        <div
                          style={{ ...styles.quickAddTaskRowList, cursor: 'text' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLastInteractedSectionId(section.id);
                            const inp = document.getElementById(`quick-add-${section.id}`);
                            if (inp) inp.focus();
                          }}
                        >
                          <span style={{ paddingLeft: '3.5rem', color: '#9CA3AF', fontSize: '0.85rem' }}>+</span>
                          <input
                            id={`quick-add-${section.id}`}
                            type="text"
                            placeholder="Add task..."
                            value={quickTaskInputs[section.id] || ''}
                            onChange={(e) => setQuickTaskInputs({ ...quickTaskInputs, [section.id]: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateQuickTask(section.id)}
                            onFocus={() => setLastInteractedSectionId(section.id)}
                            style={styles.quickAddTaskInpCell}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )
          })}
                {isAddFieldModalOpen && (
                  <AddFieldModal
                    onClose={() => setIsAddFieldModalOpen(false)}
                    onCreateField={(fieldData) => {
                      const newField = {
                        id: Date.now().toString(),
                        ...fieldData,
                        title: fieldData.title || 'Unnamed Field',
                      };
                      const newCustomFields = [...customFields, newField];
                      setCustomFields(newCustomFields);
                      handleSaveProjectSettings({ customFieldSettings: newCustomFields });
                      setIsAddFieldModalOpen(false);
                    }}
                  />
                )}
              </div>
      </div>
      </div>
      )
}

      const styles = {
        listSpreadsheetWrapper: {flex: 1, overflow: 'auto', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' },
      listTableHeaderRow: {display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', flexShrink: 0, borderLeft: '3px solid transparent' },
      gridHeaderCell: {boxSizing: 'border-box', padding: '0.6rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', borderRight: '1px solid var(--border-color)' },
      sectionAccordionRow: {display: 'flex', alignItems: 'center', padding: '0.4rem 1rem', backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', userSelect: 'none', cursor: 'pointer' },
      accordionArrowIcon: {fontSize: '0.7rem', color: 'var(--text-primary)', width: '12px' },
      sectionTitleText: {fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' },
      sectionTaskCountBadge: {backgroundColor: 'var(--border-color)', color: 'var(--text-primary)', borderRadius: '10px', padding: '1px 6px', fontSize: '0.7rem', marginLeft: '0.4rem', fontWeight: '600' },
      taskDataTableRow: {display: 'flex', borderBottom: '1px solid var(--bg-tertiary)', transition: 'background-color 0.1s, opacity 0.15s ease', userSelect: 'none' },
      gridBodyCell: {boxSizing: 'border-box', padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', borderRight: '1px solid var(--bg-tertiary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      listAvatarIcon: {width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold' },
      quickAddTaskRowList: {display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--bg-tertiary)', padding: '0.35rem 0' },
      quickAddTaskInpCell: {flex: 1, border: 'none', outline: 'none', fontSize: '0.85rem', color: 'var(--text-primary)', padding: '0.2rem 0', backgroundColor: 'transparent' },
      drag6DotHandleCell: {boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', color: 'var(--text-tertiary)', cursor: 'grab', fontSize: '0.85rem', fontWeight: 'bold', userSelect: 'none', marginRight: '0.4rem' },
      drag6DotHandleCellTask: {boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', color: 'var(--border-color)', cursor: 'grab', fontSize: '0.85rem', fontWeight: 'bold', userSelect: 'none' },
      sectionRenameInput: {flex: 1, border: '1px solid var(--accent-primary)', borderRadius: '4px', outline: 'none', padding: '2px 6px', fontSize: '0.9rem', fontWeight: '600', backgroundColor: 'transparent', color: 'var(--text-primary)' },
      threeDotButton: {background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0 0.5rem' },
      dropdownMenu: {position: 'absolute', top: '100%', right: '1rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 10, padding: '0.25rem', minWidth: '150px' },
      dropdownItem: {width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', textAlign: 'left', marginBottom: '2px' },
      dropdownItemDelete: {width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'transparent', color: 'var(--accent-danger)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', textAlign: 'left' },
      resizeHandle: {position: 'absolute', right: -2, top: 0, bottom: 0, width: '5px', cursor: 'col-resize', zIndex: 10 },
      addFieldButton: {background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
      addFieldMenu: {position: 'absolute', top: '100%', left: 0, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 50, minWidth: '200px', padding: '0.5rem 0', maxHeight: '350px', overflowY: 'auto' },
      addFieldMenuHeader: {padding: '0.5rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' },
      addFieldMenuItem: {display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.5rem 1rem', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)', textAlign: 'left' },
      fieldMenuIcon: {fontSize: '1rem', color: 'var(--text-secondary)', width: '20px', textAlign: 'center' },
      addFieldMenuShowMore: {padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--accent-primary)', cursor: 'pointer', marginTop: '0.5rem' },
      cellDropdownMenu: {position: 'absolute', left: 0, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 60, padding: '0.25rem', minWidth: '150px', display: 'flex', flexDirection: 'column', maxHeight: '250px', overflowY: 'auto' },
      columnDropdownMenu: {position: 'absolute', top: '100%', left: 0, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 60, padding: '0.25rem 0', minWidth: '240px', display: 'flex', flexDirection: 'column', fontWeight: 'normal', textTransform: 'none' },
      columnHeaderMenuBtn: {background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1rem', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '0.5rem', lineHeight: 1 },
      menuDivider: {borderTop: '1px solid var(--border-color)', margin: '4px 0' },
      modalOverlay: {position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
      modalContent: {backgroundColor: 'var(--bg-primary)', borderRadius: '8px', padding: '1.5rem', width: '550px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }
}






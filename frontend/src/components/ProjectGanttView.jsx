import React, { useMemo, useState, useEffect, useRef } from 'react';

export default function ProjectGanttView({ 
  selectedProject, handleTaskUpdate, onOpenTaskPane, token, isReadOnly, applyTaskFilter, applyTaskSort,
  draggingTaskId, setDraggingTaskId, handleLiveTaskSwap, handleGeneralDrop,
  draggingSectionId, setDraggingSectionId, handleLiveSectionSwap, handleFinalSectionMove
}) {
  const [dragState, setDragState] = useState(null); 
  const [connectingTask, setConnectingTask] = useState(null);
  const [hoveredTaskId, setHoveredTaskId] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const scrollContainerRef = useRef(null);
  const sidebarScrollRef = useRef(null);
  const svgRef = useRef(null);
  const sidebarRef = useRef(null);
  const hasDraggedRef = useRef(false);
  const DAY_WIDTH = 40;

  const [collapsedSections, setCollapsedSections] = useState({});
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskTitleValue, setEditTaskTitleValue] = useState('');
  const [editCursorPos, setEditCursorPos] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editingTaskId && inputRef.current && editCursorPos !== null) {
      inputRef.current.focus();
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(editCursorPos, editCursorPos);
        }
      }, 0);
    }
  }, [editingTaskId, editCursorPos]);

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

  const toggleSection = (sectionId) => {
    setCollapsedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };


  const { start, days, sectionData, rawTasks, dependencyLines, totalHeight } = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 30);
    startDate.setHours(0,0,0,0);
    const totalDays = 120;
    
    const daysArr = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      daysArr.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        timestamp: d.getTime(),
        isToday: d.toDateString() === today.toDateString()
      });
    }

    const sections = [];
    const rawMap = {};
    const titleMap = {};
    (selectedProject.sections || []).forEach(section => {
      section.tasks?.forEach(task => {
        titleMap[task.id] = task.title;
      });
    });

    (selectedProject.sections || []).forEach(section => {
      let filteredTasks = applyTaskFilter ? applyTaskFilter(section.tasks) : section.tasks;
      filteredTasks = applyTaskSort ? applyTaskSort(filteredTasks) : filteredTasks;

      const tasksWithPos = [];
      filteredTasks?.forEach(task => {
        // Ensure task has dates for the timeline, otherwise default to today
        let tStart = task.startDate ? new Date(task.startDate) : (task.dueDate ? new Date(task.dueDate) : new Date(today));
        let tEnd = task.dueDate ? new Date(task.dueDate) : (task.startDate ? new Date(task.startDate) : new Date(today));
        tStart.setHours(0,0,0,0);
        tEnd.setHours(0,0,0,0);

        const offsetMs = tStart.getTime() - startDate.getTime();
        const offsetDays = Math.round(offsetMs / (1000 * 60 * 60 * 24));
        const durationMs = tEnd.getTime() - tStart.getTime();
        const durationDays = task.type === 'MILESTONE' ? 1 : Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)) + 1);

        const taskData = {
          ...task,
          isMilestone: task.type === 'MILESTONE',
          left: offsetDays * DAY_WIDTH,
          width: durationDays * DAY_WIDTH,
          formattedDueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'
        };

        if (dragState && dragState.taskId === task.id) {
          if (dragState.type === 'LEFT') {
            taskData.left += dragState.deltaX;
            taskData.width -= dragState.deltaX;
          } else if (dragState.type === 'RIGHT') {
            taskData.width += dragState.deltaX;
          } else if (dragState.type === 'MOVE') {
            taskData.left += dragState.deltaX;
          }
          taskData.width = Math.max(taskData.width, 10);
        }

        // Parse blockers
        let blockersStr = '';
        if (task.blockedBy && task.blockedBy.length > 0) {
          blockersStr = task.blockedBy.map(b => titleMap[b.blockingId] || 'Task').join(', ');
        }
        taskData.blockersStr = blockersStr;

        rawMap[task.id] = taskData;
        tasksWithPos.push(taskData);
      });

      sections.push({
        ...section,
        tasks: tasksWithPos
      });
    });

    let currentY = 0;
    sections.forEach(group => {
      currentY += 36; // section header row
      if (!collapsedSections[group.id]) {
        group.tasks.forEach(t => {
          t.yCenter = currentY + 18; // center of task row
          rawMap[t.id].yCenter = t.yCenter;
          currentY += 36;
        });
      }
    });

    const lines = [];
    Object.values(rawMap).forEach(t => {
      t.blockedBy?.forEach(dep => {
        const blockingTask = rawMap[dep.blockingId];
        if (blockingTask && blockingTask.yCenter !== undefined) {
          lines.push({
            id: dep.id,
            taskId: t.id,
            x1: blockingTask.left + blockingTask.width,
            y1: blockingTask.yCenter,
            x2: t.left,
            y2: t.yCenter
          });
        }
      });
    });

    return { start: startDate, days: daysArr, sectionData: sections, rawTasks: rawMap, dependencyLines: lines, totalHeight: currentY };
  }, [selectedProject, applyTaskFilter, applyTaskSort, dragState, collapsedSections]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragState) {
        const deltaX = e.clientX - dragState.startX;
        setDragState(prev => ({ ...prev, deltaX }));
        if (Math.abs(deltaX) > 3) hasDraggedRef.current = true;
      }
      if (connectingTask && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    };

    const handleMouseUp = async () => {
      if (dragState) {
        const deltaDays = Math.round(dragState.deltaX / DAY_WIDTH);
        if (deltaDays !== 0) {
          const t = rawTasks[dragState.taskId];
          let newStart = t.startDate ? new Date(t.startDate) : (t.dueDate ? new Date(t.dueDate) : new Date());
          let newEnd = t.dueDate ? new Date(t.dueDate) : (t.startDate ? new Date(t.startDate) : new Date());

          if (dragState.type === 'LEFT') {
            newStart.setDate(newStart.getDate() + deltaDays);
            if (newStart > newEnd) newStart = newEnd;
          } else if (dragState.type === 'RIGHT') {
            newEnd.setDate(newEnd.getDate() + deltaDays);
            if (newEnd < newStart) newEnd = newStart;
          } else if (dragState.type === 'MOVE') {
            newStart.setDate(newStart.getDate() + deltaDays);
            newEnd.setDate(newEnd.getDate() + deltaDays);
          }

          if (handleTaskUpdate && !isReadOnly) {
            try {
              const response = await fetch(`http://localhost:5001/api/projects/tasks/${t.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                  startDate: newStart.toISOString().split('T')[0], 
                  dueDate: newEnd.toISOString().split('T')[0] 
                })
              });
              const data = await response.json();
              if (response.ok) handleTaskUpdate(t.id, data);
            } catch (err) { console.error(err); }
          }
        }
        setDragState(null);
        setTimeout(() => { hasDraggedRef.current = false; }, 50);
      }
      
      if (connectingTask) {
        setConnectingTask(null);
      }
    };

    if (dragState || connectingTask) {
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.userSelect = '';
    }
    return () => {
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, connectingTask, rawTasks, token, handleTaskUpdate, isReadOnly]);

  const handleCreateDependency = async (blockedById, blockingId) => {
    if (blockedById === blockingId) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${blockedById}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ blockingId })
      });
      const data = await response.json();
      if (response.ok && handleTaskUpdate) handleTaskUpdate(blockedById, data);
    } catch (err) { console.error(err); }
  };

  const handleDeleteDependency = async (taskId, dependencyId) => {
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${taskId}/dependencies/${dependencyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && handleTaskUpdate) handleTaskUpdate(taskId, data);
    } catch (err) { console.error(err); }
  };

  const handleToggleComplete = async (e, task) => {
    e.stopPropagation();
    if (isReadOnly) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isCompleted: !task.isCompleted })
      });
      const data = await response.json();
      if (response.ok && handleTaskUpdate) {
        handleTaskUpdate(task.id, data);
      }
    } catch (err) { console.error(err); }
  };

  const goToday = (smooth = true) => {
    if (scrollContainerRef.current) {
      const todayIdx = days.findIndex(d => d.isToday);
      if (todayIdx !== -1) {
        scrollContainerRef.current.scrollTo({ left: Math.max(0, todayIdx * DAY_WIDTH - 200), behavior: smooth ? 'smooth' : 'auto' });
      }
    }
  };

  const scrollLeftBtn = () => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollBy({ left: -400, behavior: 'smooth' });
  };

  const scrollRightBtn = () => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollBy({ left: 400, behavior: 'smooth' });
  };

  useEffect(() => {
    // Jump to today immediately on first mount
    const timer = setTimeout(() => {
      goToday(false);
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onGoToday = () => goToday();
    const onScrollLeft = () => scrollLeftBtn();
    const onScrollRight = () => scrollRightBtn();

    window.addEventListener('timeline-go-today', onGoToday);
    window.addEventListener('timeline-scroll-left', onScrollLeft);
    window.addEventListener('timeline-scroll-right', onScrollRight);

    return () => {
      window.removeEventListener('timeline-go-today', onGoToday);
      window.removeEventListener('timeline-scroll-left', onScrollLeft);
      window.removeEventListener('timeline-scroll-right', onScrollRight);
    };
  }, [days]);

  useEffect(() => {
    const adjustSidebarPadding = () => {
      if (scrollContainerRef.current && sidebarScrollRef.current) {
        const hScrollbarHeight = scrollContainerRef.current.offsetHeight - scrollContainerRef.current.clientHeight;
        sidebarScrollRef.current.style.paddingBottom = `${100 + hScrollbarHeight}px`;
      }
    };
    
    adjustSidebarPadding();
    window.addEventListener('resize', adjustSidebarPadding);
    return () => window.removeEventListener('resize', adjustSidebarPadding);
  }, []);

  const handleTimelineScroll = (e) => {
    if (sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollTop = e.target.scrollTop;
    }
  };

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    
    const handleWheel = (e) => {
      e.preventDefault(); // Prevent native scroll conflict
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop += e.deltaY;
      }
    };
    
    sidebar.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      sidebar.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.layoutWrapper}>
        
        {/* Left Sidebar (Table) */}
        <div style={styles.sidebar} ref={sidebarRef}>
          <div style={styles.sidebarHeader}>
            <div style={{ ...styles.tableCol, flex: 2 }}>Name</div>
            <div style={{ ...styles.tableCol, flex: 1 }}>Due Date</div>
            <div style={{ ...styles.tableCol, flex: 1 }}>Blocked By</div>
          </div>
          <div style={styles.sidebarContent} ref={sidebarScrollRef}>
            {sectionData.map((section, sIdx) => (
              <div 
                key={section.id}
                style={{ display: 'flex', flexDirection: 'column', opacity: draggingSectionId === section.id ? 0.4 : 1 }}
              >
                <div 
                  style={styles.sectionHeaderRow}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggingSectionId && draggingSectionId !== section.id) {
                      if (handleLiveSectionSwap) handleLiveSectionSwap(draggingSectionId, section.id);
                    }
                  }}
                  onDrop={(e) => { if (handleGeneralDrop) handleGeneralDrop(e, section.id); }}
                >
                  <div
                    draggable={!isReadOnly}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      if (setDraggingSectionId) setDraggingSectionId(section.id);
                      e.dataTransfer.setData('drag-type', 'section');
                      e.dataTransfer.setData('section-id', section.id);
                    }}
                    onDragEnd={() => {
                      if (setDraggingSectionId) setDraggingSectionId(null);
                      if (handleFinalSectionMove) handleFinalSectionMove();
                    }}
                    style={styles.drag6DotHandleCellSection}
                  >
                    ⋮⋮
                  </div>
                  <div style={{ ...styles.sectionTitle, cursor: 'pointer' }} onClick={() => toggleSection(section.id)}>
                    {collapsedSections[section.id] ? '▶' : '▼'} {section.name}
                  </div>
                </div>
                {!collapsedSections[section.id] && section.tasks.map(task => (
                  <div 
                    key={task.id} 
                    style={{
                      ...styles.taskTableRow,
                      opacity: draggingTaskId === task.id ? 0.4 : 1,
                    }}
                    onClick={() => {
                      if (onOpenTaskPane) onOpenTaskPane(task.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggingTaskId && draggingTaskId !== task.id) {
                        if (handleLiveTaskSwap) handleLiveTaskSwap(draggingTaskId, task.id);
                      }
                    }}
                    onDrop={(e) => { if (handleGeneralDrop) handleGeneralDrop(e, section.id, task.id); }}
                  >
                    <div
                      draggable={!isReadOnly}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        if (setDraggingTaskId) setDraggingTaskId(task.id);
                        e.dataTransfer.setData('drag-type', 'task');
                        e.dataTransfer.setData('task-id', task.id);
                        const ghostEl = document.getElementById('asana-drag-ghost-preview-card');
                        if (ghostEl) {
                          ghostEl.textContent = task.title;
                          e.dataTransfer.setDragImage(ghostEl, 20, 15);
                        }
                      }}
                      onDragEnd={() => { if (setDraggingTaskId) setDraggingTaskId(null); }}
                      style={styles.drag6DotHandleCellTask}
                    >
                      ⋮⋮
                    </div>
                    <div style={{ ...styles.tableCol, flex: 2, paddingLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span 
                        onClick={(e) => { e.stopPropagation(); handleToggleComplete(e, task); }}
                        style={{ 
                          color: task.isCompleted ? '#10B981' : task.isMilestone ? '#6366F1' : '#D1D5DB',
                          cursor: isReadOnly ? 'default' : 'pointer',
                          display: 'inline-flex', alignItems: 'center', flexShrink: 0
                        }}
                      >
                        {task.isMilestone ? (
                          <span style={{ display: 'inline-block', width: '10px', height: '10px', transform: 'rotate(45deg)', backgroundColor: task.isCompleted ? '#10B981' : 'transparent', border: task.isCompleted ? '2px solid #10B981' : '2px solid #6366F1' }} />
                        ) : (
                          '✓'
                        )}
                      </span>
                      {editingTaskId === task.id ? (
                        <input
                          ref={editingTaskId === task.id ? inputRef : null}
                          type="text"
                          value={editTaskTitleValue}
                          autoFocus
                          onChange={(e) => setEditTaskTitleValue(e.target.value)}
                          onBlur={() => submitTaskRename(task, section.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitTaskRename(task, section.id);
                            if (e.key === 'Escape') setEditingTaskId(null);
                          }}
                          style={{
                            flex: 1, minWidth: 0,
                            fontSize: '0.85rem', fontFamily: 'inherit',
                            padding: '0', backgroundColor: 'transparent',
                            color: 'var(--text-primary)', border: 'none', outline: 'none'
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
                                if (range && range.startContainer.nodeType === Node.TEXT_NODE) offset = range.startOffset;
                              } else if (document.caretPositionFromPoint) {
                                const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
                                if (pos && pos.offsetNode.nodeType === Node.TEXT_NODE) offset = pos.offset;
                              }
                              setEditCursorPos(offset !== null ? offset : task.title.length);
                              setEditingTaskId(task.id);
                              setEditTaskTitleValue(task.title);
                            }
                            if (onOpenTaskPane) onOpenTaskPane(task.id);
                          }}
                          style={{ 
                            flex: 1, minWidth: 0, cursor: isReadOnly ? 'default' : 'text',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            textDecoration: task.isCompleted ? 'line-through' : 'none',
                            color: task.isCompleted ? '#9CA3AF' : '#111827'
                          }}
                        >
                          {task.title}
                        </span>
                      )}
                    </div>
                    <div style={{ ...styles.tableCol, flex: 1, color: '#6B7280', minWidth: 0 }}>{task.formattedDueDate}</div>
                    <div style={{ ...styles.tableCol, flex: 1, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                      {task.blockersStr || '-'}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Right Scrollable Timeline Grid */}
        <div style={styles.timelineScrollArea} ref={scrollContainerRef} onScroll={handleTimelineScroll}>
          <div style={{ width: days.length * DAY_WIDTH, position: 'relative' }}>
            
            {/* Timeline Header */}
            <div style={styles.timelineHeader}>
              {days.map((d, i) => (
                <div key={i} style={{ ...styles.dayHeaderCell, width: DAY_WIDTH, borderBottom: d.isToday ? '3px solid #10B981' : '1px solid #E5E7EB' }}>
                  <div style={{ fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase' }}>{d.dayName}</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: d.isToday ? '700' : '500', color: d.isToday ? '#10B981' : '#111827' }}>
                    {d.dayNum}
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline Content */}
            <div style={styles.timelineContent}>
              <style>{`
                .dependency-line-group .delete-btn { opacity: 0; pointer-events: none; }
                .dependency-line-group:hover .delete-btn { opacity: 1; pointer-events: auto; }
                .dependency-line-group:hover .line-path { stroke: #EF4444 !important; }
              `}</style>
              
              <svg ref={svgRef} style={{ position: 'absolute', top: 0, left: 0, width: days.length * DAY_WIDTH, height: totalHeight, pointerEvents: 'none', zIndex: 4 }}>
                {dependencyLines.map(line => {
                  const generateOrthogonalPath = (x1, y1, x2, y2) => {
                    const r = 5;
                    const dirY = y2 > y1 ? 1 : -1;
                    const midX = x1 + 10;
                    
                    if (x2 >= midX) {
                      const rX = Math.min(r, (x2 - midX));
                      const rY = Math.min(r, Math.abs(y2 - y1) / 2);
                      return `M ${x1} ${y1} L ${midX - r} ${y1} Q ${midX} ${y1}, ${midX} ${y1 + rY * dirY} L ${midX} ${y2 - rY * dirY} Q ${midX} ${y2}, ${midX + rX} ${y2} L ${x2} ${y2}`;
                    } else {
                      const midX1 = x1 + 10;
                      const midY = (y1 + y2) / 2;
                      const midX2 = x2 - 10;
                      const r1 = Math.min(r, Math.abs(midY - y1) / 2);
                      const r2 = Math.min(r, Math.abs(midY - y2) / 2);
                      return `M ${x1} ${y1} L ${midX1 - r} ${y1} Q ${midX1} ${y1}, ${midX1} ${y1 + r1 * dirY} L ${midX1} ${midY - r1 * dirY} Q ${midX1} ${midY}, ${midX1 - r} ${midY} L ${midX2 + r} ${midY} Q ${midX2} ${midY}, ${midX2} ${midY + r2 * dirY} L ${midX2} ${y2 - r2 * dirY} Q ${midX2} ${y2}, ${midX2 + r} ${y2} L ${x2} ${y2}`;
                    }
                  };

                  const pathData = generateOrthogonalPath(line.x1, line.y1, line.x2, line.y2);
                  let btnX, btnY;
                  if (line.x2 >= line.x1 + 10) {
                    btnX = (line.x1 + 10 + line.x2) / 2;
                    btnY = line.y2;
                  } else {
                    btnX = (line.x1 + line.x2) / 2;
                    btnY = (line.y1 + line.y2) / 2;
                  }
                  
                  return (
                    <g key={line.id} className="dependency-line-group" style={{ cursor: 'pointer', pointerEvents: 'auto' }}>
                      <path d={pathData} stroke="transparent" strokeWidth="15" fill="none" />
                      <path className="line-path" d={pathData} stroke="#9CA3AF" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" style={{ transition: 'stroke 0.2s' }} />
                      <g className="delete-btn" style={{ transition: 'opacity 0.2s', transformOrigin: `${btnX}px ${btnY}px` }} onClick={(e) => { e.stopPropagation(); handleDeleteDependency(line.taskId, line.id); }}>
                        <circle cx={btnX} cy={btnY} r="8" fill="#EF4444" />
                        <text x={btnX} y={btnY + 1} fill="white" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="central">×</text>
                      </g>
                    </g>
                  );
                })}
                {connectingTask && rawTasks[connectingTask.id] && rawTasks[connectingTask.id].yCenter !== undefined && (() => {
                  const cTask = rawTasks[connectingTask.id];
                  const startX = connectingTask.isStart ? cTask.left : cTask.left + cTask.width;
                  const cp1X = connectingTask.isStart ? startX - 30 : startX + 30;
                  const cp2X = connectingTask.isStart ? mousePos.x + 30 : mousePos.x - 30;
                  return (
                    <path d={`M ${startX} ${cTask.yCenter} C ${cp1X} ${cTask.yCenter}, ${cp2X} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`} stroke="#4F46E5" strokeWidth="2" strokeDasharray="4" fill="none" />
                  );
                })()}
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#9CA3AF" />
                  </marker>
                </defs>
              </svg>

              <div style={styles.gridLinesContainer}>
                {days.map((d, i) => (
                  <div key={i} style={{ ...styles.gridLine, left: i * DAY_WIDTH, backgroundColor: d.isToday ? 'rgba(16, 185, 129, 0.1)' : 'transparent', borderLeft: d.dayName === 'Mon' ? '1px solid #E5E7EB' : '1px dashed #F3F4F6' }}></div>
                ))}
              </div>

              {sectionData.map((section, sIdx) => (
                <React.Fragment key={section.id}>
                  {/* Section Spacer in Grid */}
                  <div style={{ height: '36px', minHeight: '36px', maxHeight: '36px', display: 'flex', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', boxSizing: 'border-box' }}></div>
                  
                  {/* Task Bars */}
                  {section.tasks.map(task => (
                    <div key={task.id} style={styles.taskBarRow} onMouseEnter={() => setHoveredTaskId(task.id)} onMouseLeave={() => setHoveredTaskId(null)}>
                      {task.isMilestone ? (
                        /* Milestone diamond */
                        <div 
                          data-task-id={task.id}
                          style={{ ...styles.taskBar, left: task.left, width: DAY_WIDTH, backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', paddingLeft: '4px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (hasDraggedRef.current) return;
                            if (onOpenTaskPane) onOpenTaskPane(task.id);
                          }}
                          onMouseUp={(e) => {
                            if (connectingTask && connectingTask.id !== task.id) {
                              e.stopPropagation();
                              if (connectingTask.isStart) {
                                handleCreateDependency(connectingTask.id, task.id);
                              } else {
                                handleCreateDependency(task.id, connectingTask.id);
                              }
                              setConnectingTask(null);
                            }
                          }}
                        >
                          {/* Connector node LEFT */}
                          <div style={{ ...styles.connectorNodeLeft, opacity: hoveredTaskId === task.id ? 1 : 0 }} onMouseDown={(e) => { 
                            e.stopPropagation(); 
                            if (svgRef.current) {
                              const rect = svgRef.current.getBoundingClientRect();
                              setConnectingTask({ id: task.id, isStart: true });
                              setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                            }
                          }}>
                            <div style={styles.connectorLineLeft} />
                          </div>

                          <div 
                            onMouseDown={(e) => { if(!isReadOnly){ e.stopPropagation(); setDragState({ taskId: task.id, type: 'MOVE', startX: e.clientX, deltaX: 0 });} }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'grab', flex: 1 }}
                          >
                            <div style={{
                              width: '14px', height: '14px', flexShrink: 0,
                              transform: 'rotate(45deg)',
                              backgroundColor: task.isCompleted ? '#D1D5DB' : '#6366F1',
                              border: '2px solid rgba(0,0,0,0.15)',
                            }} />
                            {/* Title removed for cleaner Gantt UI */}
                          </div>

                          {/* Connector node RIGHT */}
                          <div style={{ ...styles.connectorNodeRight, opacity: hoveredTaskId === task.id ? 1 : 0 }} onMouseDown={(e) => { 
                            e.stopPropagation(); 
                            if (svgRef.current) {
                              const rect = svgRef.current.getBoundingClientRect();
                              setConnectingTask({ id: task.id, isStart: false });
                              setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                            }
                          }}>
                            <div style={styles.connectorLineRight} />
                          </div>
                        </div>
                      ) : (
                        /* Normal task bar */
                        <div 
                          data-task-id={task.id}
                          style={{ ...styles.taskBar, left: task.left, width: Math.max(task.width, 10), backgroundColor: task.isCompleted ? '#D1D5DB' : '#6366F1' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (hasDraggedRef.current) return;
                            if (onOpenTaskPane) onOpenTaskPane(task.id);
                          }}
                          onMouseUp={(e) => {
                            if (connectingTask && connectingTask.id !== task.id) {
                              e.stopPropagation();
                              if (connectingTask.isStart) {
                                handleCreateDependency(connectingTask.id, task.id);
                              } else {
                                handleCreateDependency(task.id, connectingTask.id);
                              }
                              setConnectingTask(null);
                            }
                          }}
                        >
                          {/* Connector node LEFT */}
                          <div style={{ ...styles.connectorNodeLeft, opacity: hoveredTaskId === task.id ? 1 : 0 }} onMouseDown={(e) => {
                            e.stopPropagation();
                            if (svgRef.current) {
                              const rect = svgRef.current.getBoundingClientRect();
                              setConnectingTask({ id: task.id, isStart: true });
                              setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                            }
                          }}>
                            <div style={styles.connectorLineLeft} />
                          </div>

                          {!isReadOnly && (
                            <div style={{ ...styles.dragHandle, left: 0 }} onMouseDown={(e) => { e.stopPropagation(); setDragState({ taskId: task.id, type: 'LEFT', startX: e.clientX, deltaX: 0 }); }} />
                          )}
                          
                          <div 
                            style={styles.taskBarContent} 
                            onMouseDown={(e) => { if(!isReadOnly){ e.stopPropagation(); setDragState({ taskId: task.id, type: 'MOVE', startX: e.clientX, deltaX: 0 });} }}
                          >
                            {/* Title removed for cleaner Gantt UI */}
                          </div>

                          {!isReadOnly && (
                            <div style={{ ...styles.dragHandle, right: 0 }} onMouseDown={(e) => { e.stopPropagation(); setDragState({ taskId: task.id, type: 'RIGHT', startX: e.clientX, deltaX: 0 }); }} />
                          )}

                          {/* Connector node RIGHT */}
                          <div style={{ ...styles.connectorNodeRight, opacity: hoveredTaskId === task.id ? 1 : 0 }} onMouseDown={(e) => { 
                            e.stopPropagation(); 
                            if (svgRef.current) {
                              const rect = svgRef.current.getBoundingClientRect();
                              setConnectingTask({ id: task.id, isStart: false });
                              setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                            }
                          }}>
                            <div style={styles.connectorLineRight} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#FFF',
    overflow: 'hidden'
  },
  layoutWrapper: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  },
  sidebar: {
    width: '450px',
    borderRight: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-primary)',
    zIndex: 10
  },
  sidebarHeader: {
    height: '60px',
    minHeight: '60px',
    maxHeight: '60px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    padding: '0',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    boxSizing: 'border-box'
  },
  tableCol: {
    padding: '0 0.75rem',
    boxSizing: 'border-box'
  },
  sidebarContent: {
    flex: 1,
    overflowY: 'hidden',
    overflowX: 'hidden',
    paddingBottom: '100px'
  },
  sectionHeaderRow: {
    height: '36px',
    minHeight: '36px',
    maxHeight: '36px',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    padding: '0 0.75rem',
    boxSizing: 'border-box'
  },
  sectionTitle: {
    fontWeight: '600',
    color: 'var(--text-primary)',
    fontSize: '0.9rem'
  },
  taskTableRow: {
    height: '36px',
    minHeight: '36px',
    maxHeight: '36px',
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-color)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    backgroundColor: 'var(--bg-primary)',
    boxSizing: 'border-box'
  },
  drag6DotHandleCellTask: {
    width: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9CA3AF',
    cursor: 'grab',
    fontSize: '0.9rem',
    flexShrink: 0
  },
  drag6DotHandleCellSection: {
    width: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9CA3AF',
    cursor: 'grab',
    fontSize: '0.9rem',
    flexShrink: 0
  },
  timelineScrollArea: {
    flex: 1,
    overflowX: 'auto',
    overflowY: 'auto',
    backgroundColor: 'var(--bg-secondary)'
  },
  timelineHeader: {
    height: '60px',
    minHeight: '60px',
    maxHeight: '60px',
    display: 'flex',
    backgroundColor: 'var(--bg-primary)',
    borderBottom: '1px solid var(--border-color)',
    position: 'sticky',
    top: 0,
    zIndex: 20,
    boxSizing: 'border-box'
  },
  dayHeaderCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box'
  },
  timelineContent: {
    position: 'relative',
    paddingBottom: '100px'
  },
  gridLinesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    pointerEvents: 'none'
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '40px',
    boxSizing: 'border-box'
  },
  taskBarRow: {
    position: 'relative',
    height: '36px',
    minHeight: '36px',
    maxHeight: '36px',
    display: 'flex',
    borderBottom: '1px solid var(--border-color)',
    boxSizing: 'border-box'
  },
  taskBar: {
    position: 'absolute',
    top: '6px',
    height: '24px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    userSelect: 'none',
    zIndex: 5
  },
  taskBarContent: {
    flex: 1,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    overflow: 'hidden',
    cursor: 'grab'
  },
  taskTitleTruncated: {
    fontSize: '0.75rem',
    color: '#FFF',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  dragHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '10px',
    cursor: 'col-resize',
    zIndex: 10
  },
  connectorNodeLeft: {
    position: 'absolute',
    left: '-16px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-primary)',
    border: '2px solid var(--text-tertiary)',
    cursor: 'crosshair',
    transition: 'opacity 0.2s',
    zIndex: 15,
    pointerEvents: 'auto'
  },
  connectorLineLeft: {
    position: 'absolute',
    right: '-6px',
    top: '3px',
    width: '6px',
    height: '2px',
    backgroundColor: 'var(--text-tertiary)'
  },
  connectorNodeRight: {
    position: 'absolute',
    right: '-16px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-primary)',
    border: '2px solid var(--text-tertiary)',
    cursor: 'crosshair',
    transition: 'opacity 0.2s',
    zIndex: 15,
    pointerEvents: 'auto'
  },
  connectorLineRight: {
    position: 'absolute',
    left: '-6px',
    top: '3px',
    width: '6px',
    height: '2px',
    backgroundColor: 'var(--text-tertiary)'
  }
};

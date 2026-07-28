import React, { useMemo, useState, useEffect, useRef } from 'react';

export default function ProjectTimelineView({ 
  selectedProject, applyTaskFilter, applyTaskSort, onOpenTaskPane, handleTaskUpdate, token, 
  onRenameSection, onDeleteSection, isReadOnly,
  draggingSectionId, setDraggingSectionId, handleLiveSectionSwap, handleFinalSectionMove
}) {
  const [dragState, setDragState] = useState(null); 
  const [connectingTask, setConnectingTask] = useState(null); 
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [visibleMonth, setVisibleMonth] = useState('');
  
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editSectionNameValue, setEditSectionNameValue] = useState('');
  const [openSectionMenuId, setOpenSectionMenuId] = useState(null);

  useEffect(() => {
    const closeMenu = () => setOpenSectionMenuId(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const svgRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const hasDraggedRef = useRef(false);
  const hasScrolledRef = useRef(false);
  const DAY_WIDTH = 40;
  const HEADER_HEIGHT = 65; 

  const { startDate, days, tasksRenderData, rawTasks, dependencyLines, totalHeight } = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 60); // Start 60 days ago
    start.setHours(0,0,0,0);
    const totalDays = 180; // Total 180 days (approx 6 months)
    
    const daysArr = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      daysArr.push({
        date: d,
        dateStr: d.toDateString(),
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        timestamp: d.getTime(),
        isToday: d.toDateString() === today.toDateString()
      });
    }

    const renderData = [];
    const allTasksMap = {};

    selectedProject.sections?.forEach(sec => {
      let filteredTasks = applyTaskFilter ? applyTaskFilter(sec.tasks) : sec.tasks;
      filteredTasks = applyTaskSort ? applyTaskSort(filteredTasks) : filteredTasks;
      const tasksWithPos = [];
      
      filteredTasks?.forEach(task => {
        if (!task.dueDate && !task.startDate) return;
        
        let tStart = task.startDate ? new Date(task.startDate) : new Date(task.dueDate);
        let tEnd = task.dueDate ? new Date(task.dueDate) : new Date(task.startDate);

        const offsetMs = tStart.getTime() - start.getTime();
        let offsetDays = offsetMs / (1000 * 60 * 60 * 24);
        const durationMs = tEnd.getTime() - tStart.getTime();
        let durationDays = task.type === 'MILESTONE' ? 1 : Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)) + 1);

        const taskData = {
          ...task,
          isMilestone: task.type === 'MILESTONE',
          left: offsetDays * DAY_WIDTH,
          width: durationDays * DAY_WIDTH,
          color: getSectionColor(sec.id),
          sectionId: sec.id
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

        tasksWithPos.push(taskData);
        allTasksMap[task.id] = taskData;
      });

      renderData.push({ section: sec, tasks: tasksWithPos });
    });

    let currentY = 0;
    renderData.forEach(group => {
      currentY += 24; 
      const secHeight = Math.max(80, group.tasks.length * 32 + 32);
      group.height = secHeight + 24; 
      
      group.tasks.forEach((t, idx) => {
        t.yCenter = currentY + idx * 32 + 14; 
        allTasksMap[t.id].yCenter = t.yCenter;
      });
      currentY += secHeight;
    });

    const lines = [];
    Object.values(allTasksMap).forEach(t => {
      t.blockedBy?.forEach(dep => {
        const blockingTask = allTasksMap[dep.blockingId];
        if (blockingTask) {
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

    return { startDate: start, days: daysArr, tasksRenderData: renderData, rawTasks: allTasksMap, dependencyLines: lines, totalHeight: currentY + 40 };
  }, [selectedProject, applyTaskFilter, dragState]);

  useEffect(() => {
    if (scrollContainerRef.current && !hasScrolledRef.current && days.length > 0) {
      const todayIdx = days.findIndex(d => d.isToday);
      if (todayIdx !== -1) {
        scrollContainerRef.current.scrollLeft = Math.max(0, todayIdx * DAY_WIDTH - 300);
        hasScrolledRef.current = true;
        setVisibleMonth(new Date(days[todayIdx].timestamp).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
      }
    }
  }, [days]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    const visibleIdx = Math.floor(scrollLeft / DAY_WIDTH) + 3; 
    if (days[visibleIdx]) {
      const d = new Date(days[visibleIdx].timestamp);
      setVisibleMonth(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    }
  };

  const goToday = () => {
    if (scrollContainerRef.current) {
      const todayIdx = days.findIndex(d => d.isToday);
      if (todayIdx !== -1) {
        scrollContainerRef.current.scrollTo({ left: Math.max(0, todayIdx * DAY_WIDTH - 300), behavior: 'smooth' });
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
    const handleMouseMove = (e) => {
      if (dragState) {
        const deltaX = e.clientX - dragState.startX;
        setDragState(prev => ({ ...prev, deltaX }));
        if (Math.abs(deltaX) > 3) {
          hasDraggedRef.current = true;
        }
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
          let newStart = t.startDate ? new Date(t.startDate) : new Date(t.dueDate);
          let newEnd = t.dueDate ? new Date(t.dueDate) : new Date(t.startDate);

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

          if (handleTaskUpdate) {
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
              if (response.ok) {
                handleTaskUpdate(t.id, data);
              }
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
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, connectingTask, rawTasks, DAY_WIDTH, handleTaskUpdate, token]);

  const [hoveredTaskId, setHoveredTaskId] = useState(null);

  const handleCreateDependency = async (blockedById, blockingId) => {
    if (blockedById === blockingId) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${blockedById}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ blockingId })
      });
      const data = await response.json();
      if (response.ok && handleTaskUpdate) {
        handleTaskUpdate(blockedById, data);
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteDependency = async (taskId, dependencyId) => {
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${taskId}/dependencies/${dependencyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && handleTaskUpdate) {
        handleTaskUpdate(taskId, data);
      }
    } catch (err) { console.error(err); }
  };

  const submitRename = (section) => {
    if (onRenameSection && editSectionNameValue.trim() !== section.name) {
      onRenameSection(section.id, editSectionNameValue);
    }
    setEditingSectionId(null);
  };

  const TRACK_WIDTH = days.length * DAY_WIDTH;

  return (
    <div style={styles.container}>
      <div style={{ ...styles.timelineWrapper, overflowX: draggingSectionId ? 'hidden' : 'auto' }} ref={scrollContainerRef} onScroll={handleScroll}>
        <div style={styles.gridContainer}>
          <div style={{ ...styles.headerRow, height: HEADER_HEIGHT }}>
            <div style={styles.sectionHeaderPlaceholder}></div>
            <div style={{ ...styles.datesTrack, width: TRACK_WIDTH }}>
              {days.map((d, i) => (
                <div key={i} style={{ ...styles.dateHeaderCell, width: DAY_WIDTH, backgroundColor: d.isToday ? '#EEF2FF' : 'transparent' }}>
                  <span style={{ ...styles.dayName, color: d.isToday ? '#4F46E5' : 'var(--text-secondary)' }}>{d.dayName.charAt(0)}</span>
                  <span style={{ ...styles.dayNum, color: d.isToday ? '#4F46E5' : 'var(--text-primary)' }}>{d.dayNum}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.bodyRows}>
            <style>{`
              .dependency-line-group .delete-btn { opacity: 0; pointer-events: none; }
              .dependency-line-group:hover .delete-btn { opacity: 1; pointer-events: auto; }
              .dependency-line-group:hover .line-path { stroke: #EF4444 !important; }
              .timeline-section-row .section-controls { opacity: 0; transition: opacity 0.2s; }
              .timeline-section-row:hover .section-controls { opacity: 1; }
            `}</style>
            {/* SVG Overlay directly aligned with tasks Track, using absolute positioning relative to bodyRows offset by 200px left */}
            <svg ref={svgRef} style={{ ...styles.svgLayer, width: TRACK_WIDTH, height: totalHeight }}>
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
                    <path 
                      d={pathData} 
                      stroke="transparent" 
                      strokeWidth="15" 
                      fill="none" 
                    />
                    <path 
                      className="line-path"
                      d={pathData} 
                      stroke="#9CA3AF" 
                      strokeWidth="2" 
                      fill="none" 
                      markerEnd="url(#arrowhead)"
                      style={{ transition: 'stroke 0.2s' }}
                    />
                    <g 
                      className="delete-btn" 
                      style={{ transition: 'opacity 0.2s', transformOrigin: `${btnX}px ${btnY}px` }}
                      onClick={(e) => { e.stopPropagation(); handleDeleteDependency(line.taskId, line.id); }}
                    >
                      <circle cx={btnX} cy={btnY} r="8" fill="#EF4444" />
                      <text x={btnX} y={btnY + 1} fill="white" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="central">×</text>
                    </g>
                  </g>
                );
              })}
              {connectingTask && rawTasks[connectingTask.id] && (() => {
                const cTask = rawTasks[connectingTask.id];
                const startX = connectingTask.isStart ? cTask.left : cTask.left + cTask.width;
                const cp1X = connectingTask.isStart ? startX - 30 : startX + 30;
                const cp2X = connectingTask.isStart ? mousePos.x + 30 : mousePos.x - 30;
                return (
                  <path 
                    d={`M ${startX} ${cTask.yCenter} C ${cp1X} ${cTask.yCenter}, ${cp2X} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`} 
                    stroke="#4F46E5" strokeWidth="2" strokeDasharray="4" fill="none" 
                  />
                );
              })()}
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#9CA3AF" />
                </marker>
              </defs>
            </svg>

            {tasksRenderData.map(group => {
              const isEditing = editingSectionId === group.section.id;
              const isDraggingThis = draggingSectionId === group.section.id;
              
              return (
              <div 
                key={group.section.id} 
                className="timeline-section-row"
                style={{ ...styles.sectionGroup, height: group.height, opacity: isDraggingThis ? 0.4 : 1 }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggingSectionId && draggingSectionId !== group.section.id && handleLiveSectionSwap) {
                    const draggingIndex = tasksRenderData.findIndex(g => g.section.id === draggingSectionId);
                    const hoverIndex = tasksRenderData.findIndex(g => g.section.id === group.section.id);
                    
                    const rect = e.currentTarget.getBoundingClientRect();
                    const hoverMiddleY = (rect.bottom - rect.top) / 2;
                    const hoverClientY = e.clientY - rect.top;

                    if (draggingIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
                    if (draggingIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

                    handleLiveSectionSwap(draggingSectionId, group.section.id);
                  }
                }}
              >
                <div style={{ ...styles.sectionLabelColumn, zIndex: openSectionMenuId === group.section.id ? 50 : 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%', gap: '4px' }}>
                    
                    {/* Drag Handle & Collapse Icon */}
                    <div 
                      className="section-controls"
                      style={{ display: 'flex', alignItems: 'center', color: '#9CA3AF', cursor: 'grab', paddingRight: '4px' }}
                      draggable={!isReadOnly && !isEditing}
                      onDragStart={(e) => {
                        if (setDraggingSectionId) setDraggingSectionId(group.section.id);
                        e.dataTransfer.setData('drag-type', 'section');
                        e.dataTransfer.setData('section-id', group.section.id);
                        
                        const ghostEl = document.getElementById('asana-drag-ghost-preview-card');
                        if (ghostEl) {
                          ghostEl.textContent = group.section.name;
                          e.dataTransfer.setDragImage(ghostEl, 20, 15);
                        }
                      }}
                      onDragEnd={() => {
                        if (handleFinalSectionMove) handleFinalSectionMove();
                        if (setDraggingSectionId) setDraggingSectionId(null);
                      }}
                    >
                      <span style={{ fontSize: '1.2rem', lineHeight: 1, letterSpacing: '-2px' }}>⋮⋮</span>
                    </div>
                    
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', flexShrink: 0, marginTop: '2px' }}>▼</span>

                    {isEditing ? (
                      <input 
                        autoFocus
                        value={editSectionNameValue}
                        onChange={(e) => setEditSectionNameValue(e.target.value)}
                        onBlur={() => submitRename(group.section)}
                        onKeyDown={(e) => e.key === 'Enter' && submitRename(group.section)}
                        style={styles.sectionRenameInput}
                      />
                    ) : (
                      <div style={{ ...styles.sectionLabel, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {group.section.name}
                      </div>
                    )}

                    {/* THREE DOTS MENU */}
                    {!isReadOnly && !isEditing && (
                      <div className="section-controls" style={{ marginLeft: 'auto', position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setOpenSectionMenuId(openSectionMenuId === group.section.id ? null : group.section.id); }} 
                          style={{ ...styles.threeDotButton, opacity: openSectionMenuId === group.section.id ? 1 : undefined }}
                        >
                          •••
                        </button>
                        {openSectionMenuId === group.section.id && (
                          <div style={{ ...styles.dropdownMenu, top: '100%', left: '0', right: 'auto' }}>
                            <button onClick={() => { setEditingSectionId(group.section.id); setEditSectionNameValue(group.section.name); setOpenSectionMenuId(null); }} style={styles.dropdownItem}>Rename Section</button>
                            <button onClick={() => { if(onDeleteSection) onDeleteSection(group.section.id); setOpenSectionMenuId(null); }} style={styles.dropdownItemDelete}>Delete Section</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ ...styles.tasksTrack, width: TRACK_WIDTH }}>
                  {days.map((d, i) => (
                    <div key={i} style={{ ...styles.gridLineVertical, left: i * DAY_WIDTH, backgroundColor: d.isToday ? '#EEF2FF' : '#F3F4F6', width: d.isToday ? DAY_WIDTH : 1, zIndex: d.isToday ? 0 : 0 }} />
                  ))}
                  
                  <div style={styles.tasksArea}>
                    {group.tasks.map((t, idx) => {
                      return (
                        <div 
                          key={t.id} 
                          data-task-id={t.id}
                          onMouseEnter={() => setHoveredTaskId(t.id)}
                          onMouseLeave={() => setHoveredTaskId(null)}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (hasDraggedRef.current) return;
                            onOpenTaskPane && onOpenTaskPane(t.id); 
                          }}
                          onMouseUp={(e) => {
                            if (connectingTask && connectingTask.id !== t.id) {
                              e.stopPropagation();
                              if (connectingTask.isStart) {
                                handleCreateDependency(connectingTask.id, t.id);
                              } else {
                                handleCreateDependency(t.id, connectingTask.id);
                              }
                              setConnectingTask(null);
                            }
                          }}
                          style={{
                            ...styles.taskBarWrapper,
                            left: t.left,
                            width: Math.max(t.width - 4, DAY_WIDTH - 4),
                            top: idx * 32 + 24, // Relative top positioning inside section
                          }}
                        >
                          {/* Connector node LEFT (for receiving dependencies) */}
                          <div 
                            className="dependency-node"
                            style={{ ...styles.connectorNodeLeft, opacity: hoveredTaskId === t.id ? 1 : 0 }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (svgRef.current) {
                                const rect = svgRef.current.getBoundingClientRect();
                                setConnectingTask({
                                  id: t.id,
                                  isStart: true,
                                  x: e.clientX - rect.left,
                                  y: e.clientY - rect.top
                                });
                                setMousePos({
                                  x: e.clientX - rect.left,
                                  y: e.clientY - rect.top
                                });
                              }
                            }}
                          >
                            <div style={styles.connectorLineLeft} />
                          </div>

                          {!t.isMilestone && (
                            <div
                              className="drag-handle"
                              onMouseDown={(e) => { e.stopPropagation(); setDragState({ taskId: t.id, type: 'LEFT', startX: e.clientX, deltaX: 0 }); }}
                              style={{ ...styles.dragHandleLeft, opacity: hoveredTaskId === t.id ? 1 : 0 }}
                            >||</div>
                          )}
                          
                          {t.isMilestone ? (
                            <div 
                              onMouseDown={(e) => { e.stopPropagation(); setDragState({ taskId: t.id, type: 'MOVE', startX: e.clientX, deltaX: 0 }); }}
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'grab', flex: 1, height: '100%', paddingLeft: '4px' }}
                            >
                              <div style={{
                                width: '14px', height: '14px', flexShrink: 0,
                                transform: 'rotate(45deg)',
                                backgroundColor: t.isCompleted ? '#10B981' : t.color,
                                border: '2px solid rgba(0,0,0,0.15)',
                              }} />
                              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: t.isCompleted ? 'line-through' : 'none' }}>{t.title}</span>
                            </div>
                          ) : (
                            <div 
                              onMouseDown={(e) => { e.stopPropagation(); setDragState({ taskId: t.id, type: 'MOVE', startX: e.clientX, deltaX: 0 }); }}
                              style={{
                                ...styles.taskBar,
                                backgroundColor: t.isCompleted ? '#F3F4F6' : t.color,
                                color: t.isCompleted ? '#9CA3AF' : 'var(--text-primary)',
                                textDecoration: t.isCompleted ? 'line-through' : 'none',
                                border: '1px solid rgba(0,0,0,0.1)',
                              }}
                            >
                              {t.title}
                            </div>
                          )}

                          {!t.isMilestone && (
                            <div
                              className="drag-handle"
                              onMouseDown={(e) => { e.stopPropagation(); setDragState({ taskId: t.id, type: 'RIGHT', startX: e.clientX, deltaX: 0 }); }}
                              style={{ ...styles.dragHandleRight, opacity: hoveredTaskId === t.id ? 1 : 0 }}
                            >||</div>
                          )}
                          
                          {/* Connector node RIGHT (for creating dependencies) */}
                          <div 
                            className="dependency-node"
                            style={{ ...styles.connectorNodeRight, opacity: hoveredTaskId === t.id ? 1 : 0 }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (svgRef.current) {
                                const rect = svgRef.current.getBoundingClientRect();
                                setConnectingTask({
                                  id: t.id,
                                  isStart: false,
                                  x: e.clientX - rect.left,
                                  y: e.clientY - rect.top
                                });
                                setMousePos({
                                  x: e.clientX - rect.left,
                                  y: e.clientY - rect.top
                                });
                              }
                            }}
                          >
                            <div style={styles.connectorLineRight} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function getSectionColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#FEE2E2', '#FEF3C7', '#D1FAE5', '#DBEAFE', '#F3E8FF', '#FCE7F3'];
  return colors[Math.abs(hash) % colors.length];
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, backgroundColor: 'var(--bg-primary)', overflow: 'hidden', userSelect: 'none' },
  timelineWrapper: { flex: 1, overflow: 'auto', minHeight: 0 },
  gridContainer: { display: 'flex', flexDirection: 'column', minWidth: 'min-content', position: 'relative' },
  headerRow: { display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10, boxSizing: 'border-box' },
  sectionHeaderPlaceholder: { width: '200px', flexShrink: 0, borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', position: 'sticky', left: 0, zIndex: 11 },
  datesTrack: { display: 'flex', flexShrink: 0 },
  dateHeaderCell: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border-color)', boxSizing: 'border-box' },
  dayName: { fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' },
  dayNum: { fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '500' },
  bodyRows: { display: 'flex', flexDirection: 'column', position: 'relative', paddingBottom: '40px' },
  svgLayer: { position: 'absolute', top: 0, left: 200, pointerEvents: 'none', zIndex: 2 },
  sectionGroup: { display: 'flex', borderBottom: '1px solid var(--border-color)', boxSizing: 'border-box' },
  sectionLabelColumn: { width: '200px', flexShrink: 0, borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', padding: '1rem', position: 'sticky', left: 0, zIndex: 5, boxSizing: 'border-box' },
  sectionLabel: { fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', height: '100%' },
  tasksTrack: { position: 'relative', display: 'flex', flexShrink: 0, boxSizing: 'border-box' },
  gridLineVertical: { position: 'absolute', top: 0, bottom: 0, width: '1px', backgroundColor: 'var(--bg-tertiary)', zIndex: 0 },
  tasksArea: { position: 'relative', width: '100%', height: '100%', zIndex: 3, pointerEvents: 'none' },
  taskBarWrapper: { position: 'absolute', height: '28px', display: 'flex', alignItems: 'stretch', cursor: 'pointer', zIndex: 5, pointerEvents: 'auto' },
  taskBar: { flex: 1, borderRadius: '4px', padding: '0 20px', fontSize: '0.75rem', fontWeight: '500', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', userSelect: 'none', position: 'relative' },
  dragHandleLeft: { width: '12px', cursor: 'ew-resize', position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 2, backgroundColor: 'rgba(79, 70, 229, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '8px', opacity: 0, transition: 'opacity 0.2s', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px' },
  dragHandleRight: { width: '12px', cursor: 'ew-resize', position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 2, backgroundColor: 'rgba(79, 70, 229, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '8px', opacity: 0, transition: 'opacity 0.2s', borderTopRightRadius: '4px', borderBottomRightRadius: '4px' },
  connectorNodeLeft: { width: '10px', height: '10px', backgroundColor: '#3B82F6', borderRadius: '50%', position: 'absolute', left: '-15px', top: '-15px', cursor: 'crosshair', opacity: 0, transition: '0.2s', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  connectorNodeRight: { width: '10px', height: '10px', backgroundColor: '#3B82F6', borderRadius: '50%', position: 'absolute', right: '-15px', bottom: '-15px', cursor: 'crosshair', opacity: 0, transition: '0.2s', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  connectorLineLeft: { width: '20px', height: '10px', position: 'absolute', top: '4px', left: '4px', borderTop: '2px solid #3B82F6', borderRight: '2px solid #3B82F6', borderTopRightRadius: '4px' },
  connectorLineRight: { width: '20px', height: '10px', position: 'absolute', bottom: '4px', right: '4px', borderBottom: '2px solid #3B82F6', borderLeft: '2px solid #3B82F6', borderBottomLeftRadius: '4px' },
  sectionRenameInput: { width: '100%', border: '1px solid var(--accent-primary)', borderRadius: '4px', outline: 'none', padding: '2px 6px', fontSize: '0.85rem', fontWeight: '600', boxSizing: 'border-box', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' },
  threeDotButton: { background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0 0.5rem', marginLeft: 'auto' },
  dropdownMenu: { position: 'absolute', top: '100%', left: '1rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 10, padding: '0.25rem', minWidth: '150px' },
  dropdownItem: { width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', textAlign: 'left', marginBottom: '2px' },
  dropdownItemDelete: { width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'transparent', color: 'var(--accent-danger)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', textAlign: 'left' }
};

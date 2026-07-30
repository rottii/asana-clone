import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import UserAvatar from './UserAvatar';

export default function ProjectWorkloadView({ 
  selectedProject, handleTaskUpdate, onOpenTaskPane, token, isReadOnly
}) {
  const [capacityLimit, setCapacityLimit] = useState(3);
  const [expandedAssignees, setExpandedAssignees] = useState({});
  const [dragState, setDragState] = useState(null); 
  const scrollContainerRef = useRef(null);
  const hasDraggedRef = useRef(false);
  const DAY_WIDTH = 40;
  const HEADER_HEIGHT = 60;
  const ASSIGNEE_WIDTH = 250;

  const toggleExpand = (assigneeName) => {
    setExpandedAssignees(prev => ({ ...prev, [assigneeName]: !prev[assigneeName] }));
  };

  const { start, days, assigneeData, rawTasks } = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 30); // 30 days ago
    startDate.setHours(0,0,0,0);
    const totalDays = 120; // 4 months
    
    const daysArr = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      daysArr.push({
        date: d,
        dateStr: d.toISOString().split('T')[0], // yyyy-mm-dd
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        timestamp: d.getTime(),
        isToday: d.toDateString() === today.toDateString()
      });
    }

    const assigneeMap = {};
    const rawMap = {};

    (selectedProject.sections || []).forEach(section => {
      (section.tasks || []).forEach(task => {
        if (task.isCompleted) return;
        if (!task.startDate && !task.dueDate) return;

        rawMap[task.id] = task;

        const assigneeName = task.assignee?.name || 'Unassigned';
        if (!assigneeMap[assigneeName]) {
          assigneeMap[assigneeName] = { 
            name: assigneeName, 
            avatar: assigneeName !== 'Unassigned' ? assigneeName[0].toUpperCase() : '?',
            tasks: [],
            dailyCounts: Array(totalDays).fill(0)
          };
        }

        let tStart = task.startDate ? new Date(task.startDate) : new Date(task.dueDate);
        let tEnd = task.dueDate ? new Date(task.dueDate) : new Date(task.startDate);
        tStart.setHours(0,0,0,0);
        tEnd.setHours(0,0,0,0);

        // Find intersecting days for this task
        const offsetMs = tStart.getTime() - startDate.getTime();
        const offsetDays = Math.round(offsetMs / (1000 * 60 * 60 * 24));
        const durationMs = tEnd.getTime() - tStart.getTime();
        const durationDays = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)) + 1);

        const taskData = {
          ...task,
          left: offsetDays * DAY_WIDTH,
          width: durationDays * DAY_WIDTH,
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

        assigneeMap[assigneeName].tasks.push(taskData);

        // Calculate overlap for capacity (ignore drag state for capacity rendering to avoid flicker)
        for (let i = 0; i < totalDays; i++) {
          const currentDay = daysArr[i].timestamp;
          if (currentDay >= tStart.getTime() && currentDay <= tEnd.getTime()) {
            assigneeMap[assigneeName].dailyCounts[i]++;
          }
        }
      });
    });

    const data = Object.values(assigneeMap).sort((a, b) => {
      if (a.name === 'Unassigned') return 1;
      if (b.name === 'Unassigned') return -1;
      return a.name.localeCompare(b.name);
    });

    return { start: startDate, days: daysArr, assigneeData: data, rawTasks: rawMap };
  }, [selectedProject, dragState]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragState) {
        const deltaX = e.clientX - dragState.startX;
        setDragState(prev => ({ ...prev, deltaX }));
        if (Math.abs(deltaX) > 3) hasDraggedRef.current = true;
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
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, rawTasks, token, handleTaskUpdate, isReadOnly]);

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

  const sidebarScrollRef = useRef(null);

  const handleTimelineScroll = (e) => {
    if (sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const handleSidebarWheel = (e) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop += e.deltaY;
    }
  };

  const portalTarget = document.getElementById('timeline-topbar-portal');

  return (
    <div style={styles.container}>
      {portalTarget && createPortal(
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Team Workload</h2>
          <div style={styles.capacityControl}>
            <label style={{ fontSize: '0.85rem', color: '#6B7280' }}>Capacity limit:</label>
            <input 
              type="number" 
              value={capacityLimit} 
              onChange={(e) => setCapacityLimit(Math.max(1, parseInt(e.target.value) || 1))}
              style={styles.capacityInput}
              min="1"
            />
            <span style={{ fontSize: '0.85rem', color: '#6B7280' }}>tasks/day</span>
          </div>
        </div>,
        portalTarget
      )}

      <div style={styles.layoutWrapper}>
        
        {/* Left Sidebar (Assignees) */}
        <div style={styles.sidebar} onWheel={handleSidebarWheel}>
          <div style={styles.sidebarHeader}>Assignee</div>
          <div style={styles.sidebarContent} ref={sidebarScrollRef}>
            {assigneeData.length === 0 && <div style={styles.emptyState}>No scheduled tasks</div>}
            
            {assigneeData.map((assignee, idx) => (
              <div key={idx} style={styles.assigneeGroupSidebar}>
                <div 
                  style={styles.assigneeMainRowSidebar}
                  onClick={() => toggleExpand(assignee.name)}
                >
                  <span style={{ ...styles.chevron, transform: expandedAssignees[assignee.name] ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
                  <UserAvatar name={assignee.name} size={24} style={{ marginRight: '8px' }} />
                  <span style={styles.assigneeName}>{assignee.name}</span>
                </div>
                {expandedAssignees[assignee.name] && (
                  <div style={{ ...styles.expandedTasksSidebar, height: assignee.tasks.length * 32 }}>
                    {assignee.tasks.map(task => (
                      <div key={task.id} style={styles.taskLabelRow}>
                        {task.title}
                      </div>
                    ))}
                  </div>
                )}
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
              {/* Background Grid Lines */}
              <div style={styles.gridLinesContainer}>
                {days.map((d, i) => (
                  <div key={i} style={{ ...styles.gridLine, left: i * DAY_WIDTH, backgroundColor: d.isToday ? 'rgba(16, 185, 129, 0.1)' : 'transparent', borderLeft: d.dayName === 'Mon' ? '1px solid #E5E7EB' : '1px dashed #F3F4F6' }}></div>
                ))}
              </div>

              {assigneeData.map((assignee, idx) => (
                <div key={idx} style={styles.assigneeGroupTimeline}>
                  {/* Summary Row (Line Graph) */}
                  <div style={styles.assigneeMainRowTimeline}>
                    {(() => {
                      const points = assignee.dailyCounts.map((count, dayIdx) => {
                        const x = dayIdx * DAY_WIDTH + (DAY_WIDTH / 2);
                        const y = count === 0 ? 44 : Math.max(10, 44 - count * 12);
                        return { x, y, count, dayIdx };
                      });

                      if (points.length === 0) return null;

                      const firstY = points[0].y;
                      const lastY = points[points.length - 1].y;
                      const linePoints = `0,${firstY} ${points.map(p => `${p.x},${p.y}`).join(' ')} ${days.length * DAY_WIDTH},${lastY}`;
                      const polyPoints = `0,44 ${linePoints} ${days.length * DAY_WIDTH},44`;

                      return (
                        <>
                          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                            <polygon points={polyPoints} fill="#EEF2FF" />
                            <polyline points={linePoints} fill="none" stroke="#818CF8" strokeWidth="2" />
                          </svg>

                          {points.map((p, i) => {
                            if (p.count === 0) return null;
                            const isOverloaded = p.count > capacityLimit;
                            return (
                              <div key={i} style={{
                                position: 'absolute',
                                left: p.dayIdx * DAY_WIDTH,
                                width: DAY_WIDTH,
                                top: p.y - 8,
                                textAlign: 'center',
                                fontSize: '0.75rem',
                                color: isOverloaded ? '#EF4444' : '#6B7280',
                                fontWeight: isOverloaded ? 'bold' : '500',
                                pointerEvents: 'none'
                              }}>
                                {p.count}
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>

                  {/* Expanded Tasks (Gantt Bars) */}
                  {expandedAssignees[assignee.name] && (
                    <div style={{ ...styles.expandedTasksTimeline, height: assignee.tasks.length * 32 }}>
                      {assignee.tasks.map((task, tIdx) => (
                        <div key={task.id} style={{ ...styles.taskBarRow, top: tIdx * 32 }}>
                          <div 
                            data-task-id={task.id}
                            style={{ ...styles.taskBar, left: task.left, width: Math.max(task.width, 10), backgroundColor: task.isCompleted ? '#D1D5DB' : '#6366F1' }}
                            onClick={() => {
                              if (!hasDraggedRef.current && onOpenTaskPane) onOpenTaskPane(task.id);
                            }}
                          >
                            {!isReadOnly && (
                              <div style={{ ...styles.dragHandle, left: 0 }} onMouseDown={(e) => { e.stopPropagation(); setDragState({ taskId: task.id, type: 'LEFT', startX: e.clientX, deltaX: 0 }); }} />
                            )}
                            
                            <div 
                              style={styles.taskBarContent} 
                              onMouseDown={(e) => { if(!isReadOnly){ e.stopPropagation(); setDragState({ taskId: task.id, type: 'MOVE', startX: e.clientX, deltaX: 0 });} }}
                            >
                              <span style={styles.taskTitleTruncated}>{task.title}</span>
                            </div>

                            {!isReadOnly && (
                              <div style={{ ...styles.dragHandle, right: 0 }} onMouseDown={(e) => { e.stopPropagation(); setDragState({ taskId: task.id, type: 'RIGHT', startX: e.clientX, deltaX: 0 }); }} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
    backgroundColor: 'var(--bg-primary)',
    overflow: 'hidden'
  },
  toolbar: {
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-secondary)'
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: 0
  },
  capacityControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--bg-primary)',
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    border: '1px solid var(--border-color)'
  },
  capacityInput: {
    width: '40px',
    border: 'none',
    borderBottom: '1px solid var(--border-color)',
    textAlign: 'center',
    outline: 'none',
    fontSize: '0.9rem',
    fontWeight: '600',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)'
  },
  todayBtn: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    padding: '0.25rem 0.75rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontWeight: '500'
  },
  layoutWrapper: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  },
  sidebar: {
    width: '250px',
    borderRight: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-primary)',
    zIndex: 10
  },
  sidebarHeader: {
    height: '60px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 1rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase'
  },
  sidebarContent: {
    flex: 1,
    overflowY: 'hidden',
    overflowX: 'hidden'
  },
  assigneeGroupSidebar: {
    borderBottom: '1px solid var(--border-color)'
  },
  assigneeMainRowSidebar: {
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 1rem',
    cursor: 'pointer',
    gap: '0.5rem',
    backgroundColor: 'var(--bg-primary)',
    transition: 'background-color 0.1s'
  },
  chevron: {
    fontSize: '0.7rem',
    color: 'var(--text-tertiary)',
    transition: 'transform 0.2s',
    display: 'inline-block',
    width: '12px'
  },
  avatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-primary)',
    color: '#FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontWeight: 'bold'
  },
  assigneeName: {
    fontSize: '0.9rem',
    fontWeight: '500',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  expandedTasksSidebar: {
    backgroundColor: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border-color)'
  },
  taskLabelRow: {
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 1rem 0 3rem', // indented
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    borderBottom: '1px solid var(--border-color)'
  },
  emptyState: {
    padding: '2rem 1rem',
    color: 'var(--text-tertiary)',
    fontSize: '0.85rem',
    fontStyle: 'italic'
  },
  timelineScrollArea: {
    flex: 1,
    overflowX: 'auto',
    overflowY: 'auto',
    backgroundColor: 'var(--bg-secondary)'
  },
  timelineHeader: {
    height: '60px',
    display: 'flex',
    backgroundColor: 'var(--bg-primary)',
    borderBottom: '1px solid var(--border-color)',
    position: 'sticky',
    top: 0,
    zIndex: 5
  },
  dayHeaderCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box'
  },
  timelineContent: {
    position: 'relative'
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
    width: '40px', // DAY_WIDTH
    boxSizing: 'border-box'
  },
  assigneeGroupTimeline: {
    borderBottom: '1px solid var(--border-color)',
    position: 'relative',
    zIndex: 2
  },
  assigneeMainRowTimeline: {
    height: '44px',
    position: 'relative'
  },
  heatmapCell: {
    position: 'absolute',
    top: '4px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    borderRadius: '4px',
    boxSizing: 'border-box',
    border: '1px solid #FFF'
  },
  expandedTasksTimeline: {
    position: 'relative',
    borderTop: '1px solid var(--border-color)'
  },
  taskBarRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '32px',
    borderBottom: '1px solid var(--border-color)'
  },
  taskBar: {
    position: 'absolute',
    top: '4px',
    height: '24px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cursor: 'pointer'
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
  }
};

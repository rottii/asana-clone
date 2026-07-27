import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function ProjectCalendarView({ selectedProject, applyTaskFilter, applyTaskSort, onOpenTaskPane, handleTaskUpdate, token }) {
  const containerRef = useRef(null);
  const [visibleMonth, setVisibleMonth] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const { weeks, todayWeekIndex } = useMemo(() => {
    // Generate 52 weeks in the past and 104 weeks in the future
    const startObj = new Date();
    startObj.setDate(startObj.getDate() - (52 * 7));
    startObj.setDate(startObj.getDate() - startObj.getDay()); // Go to previous Sunday
    startObj.setHours(0,0,0,0);

    const totalWeeks = 156; // 3 years
    const days = [];
    
    let todayIdx = 0;
    const todayStr = new Date().toDateString();

    for (let i = 0; i < totalWeeks * 7; i++) {
      const d = new Date(startObj);
      d.setDate(d.getDate() + i);
      
      const isFirstDay = d.getDate() === 1;
      const monthStr = monthNames[d.getMonth()];
      const dayLabel = isFirstDay ? `1 ${monthStr}` : d.getDate();
      const isToday = d.toDateString() === todayStr;

      days.push({
         date: d,
         day: dayLabel,
         isToday: isToday,
         monthName: monthStr,
         year: d.getFullYear()
      });
    }

    const allTasks = [];
    selectedProject.sections?.forEach(sec => {
      let filteredTasks = applyTaskFilter ? applyTaskFilter(sec.tasks) : sec.tasks;
      filteredTasks = applyTaskSort ? applyTaskSort(filteredTasks) : filteredTasks;
      filteredTasks?.forEach(t => {
        if (t.startDate || t.dueDate) {
          const sDate = t.startDate ? new Date(t.startDate) : new Date(t.dueDate);
          const eDate = t.dueDate ? new Date(t.dueDate) : new Date(t.startDate);
          sDate.setHours(0,0,0,0);
          eDate.setHours(0,0,0,0);
          if (eDate < sDate) eDate.setTime(sDate.getTime());
          allTasks.push({ ...t, sectionColor: getSectionColor(sec.id), sDate, eDate });
        }
      });
    });

    const weeksData = [];
    for (let i = 0; i < days.length; i += 7) {
      const weekDaysArr = days.slice(i, i + 7);
      const weekStart = weekDaysArr[0].date;
      const weekEnd = weekDaysArr[6].date;
      
      if (weekDaysArr.some(d => d.isToday)) {
        todayIdx = weeksData.length;
      }
      
      const weekTasks = allTasks.filter(t => t.sDate <= weekEnd && t.eDate >= weekStart);
      
      weekTasks.sort((a, b) => {
        if (a.sDate.getTime() !== b.sDate.getTime()) return a.sDate - b.sDate;
        return (b.eDate - b.sDate) - (a.eDate - a.sDate);
      });

      const slots = [];
      const taskBars = [];
      
      weekTasks.forEach(task => {
        let startCol = 0;
        let endCol = 6;
        for (let c = 0; c < 7; c++) {
          if (weekDaysArr[c].date.getTime() === task.sDate.getTime()) startCol = c;
          if (weekDaysArr[c].date.getTime() === task.eDate.getTime()) endCol = c;
        }
        if (task.sDate < weekStart) startCol = 0;
        if (task.eDate > weekEnd) endCol = 6;
        
        let slot = 0;
        while (slots[slot] !== undefined && slots[slot] >= startCol) {
          slot++;
        }
        slots[slot] = endCol;
        
        taskBars.push({ task, startCol, endCol, slot });
      });
      
      const maxSlot = taskBars.reduce((max, t) => Math.max(max, t.slot), -1);
      // Give each week row a minimum height of 120px to look spacious
      const contentHeight = Math.max(120, 35 + (maxSlot + 1) * 28 + 10);

      weeksData.push({ 
        days: weekDaysArr, 
        taskBars, 
        contentHeight,
        majorMonth: weekDaysArr[0].monthName,
        majorYear: weekDaysArr[0].year
      });
    }

    return { weeks: weeksData, todayWeekIndex: todayIdx };
  }, [selectedProject, applyTaskFilter]);

  const hasScrolledRef = useRef(false);

  // Scroll to today on initial mount
  useEffect(() => {
    if (containerRef.current && !hasScrolledRef.current && weeks.length > 0) {
      const todayEl = containerRef.current.querySelector('.is-today-week');
      if (todayEl) {
        todayEl.scrollIntoView({ behavior: 'auto', block: 'center' });
        hasScrolledRef.current = true;
      }
    }
  }, [weeks]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollY = containerRef.current.scrollTop;
    const weekNodes = containerRef.current.children;
    for (let i = 0; i < weekNodes.length; i++) {
      const node = weekNodes[i];
      if (node.offsetTop + node.clientHeight > scrollY + 50) {
        const m = node.getAttribute('data-month');
        const y = node.getAttribute('data-year');
        if (m && y) setVisibleMonth(`${m} ${y}`);
        break;
      }
    }
  };

  const goToday = () => {
    if (containerRef.current) {
      const todayEl = containerRef.current.querySelector('.is-today-week');
      if (todayEl) {
        todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const scrollUp = () => {
    if (containerRef.current) containerRef.current.scrollBy({ top: -400, behavior: 'smooth' });
  };

  const scrollDown = () => {
    if (containerRef.current) containerRef.current.scrollBy({ top: 400, behavior: 'smooth' });
  };

  useEffect(() => {
    const onGoToday = () => goToday();
    const onScrollLeft = () => scrollUp(); // Map Left to Up for vertical calendar
    const onScrollRight = () => scrollDown(); // Map Right to Down for vertical calendar

    window.addEventListener('timeline-go-today', onGoToday);
    window.addEventListener('timeline-scroll-left', onScrollLeft);
    window.addEventListener('timeline-scroll-right', onScrollRight);

    return () => {
      window.removeEventListener('timeline-go-today', onGoToday);
      window.removeEventListener('timeline-scroll-left', onScrollLeft);
      window.removeEventListener('timeline-scroll-right', onScrollRight);
    };
  }, []);

  useEffect(() => {
    if (!visibleMonth && weeks[todayWeekIndex]) {
      setVisibleMonth(`${weeks[todayWeekIndex].majorMonth} ${weeks[todayWeekIndex].majorYear}`);
    }
  }, [weeks, todayWeekIndex, visibleMonth]);

  const handleDragStart = (e, task, weekDays, startCol, endCol) => {
    setTimeout(() => setIsDragging(true), 0);
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const visualSpanDays = endCol - startCol + 1;
    const dayWidth = rect.width / visualSpanDays;
    let segmentGrabbedIndex = Math.floor(offsetX / dayWidth);
    if (segmentGrabbedIndex < 0) segmentGrabbedIndex = 0;
    if (segmentGrabbedIndex >= visualSpanDays) segmentGrabbedIndex = visualSpanDays - 1;

    const absoluteGrabbedDate = new Date(weekDays[startCol].date);
    absoluteGrabbedDate.setDate(absoluteGrabbedDate.getDate() + segmentGrabbedIndex);

    e.dataTransfer.setData('application/json', JSON.stringify({
      taskId: task.id,
      originalStart: task.sDate.getTime(),
      originalEnd: task.eDate.getTime(),
      grabbedDate: absoluteGrabbedDate.getTime(),
      hasStartDate: !!task.startDate,
      hasDueDate: !!task.dueDate
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e, targetDate) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = '';
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;
    
    try {
      const data = JSON.parse(dataStr);
      
      // Calculate diff in exact days to avoid daylight saving time bugs
      const shiftDays = Math.round((targetDate.getTime() - data.grabbedDate) / 86400000);
      if (shiftDays === 0) return;

      const newStart = new Date(data.originalStart);
      newStart.setDate(newStart.getDate() + shiftDays);
      
      const newEnd = new Date(data.originalEnd);
      newEnd.setDate(newEnd.getDate() + shiftDays);

      const toLocalISOString = (d) => {
        const pad = n => n < 10 ? '0' + n : n;
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T00:00:00.000Z';
      };

      const updates = {};
      if (data.hasStartDate) updates.startDate = toLocalISOString(newStart);
      if (data.hasDueDate) updates.dueDate = toLocalISOString(newEnd);

      if (token) {
        const response = await fetch(`http://localhost:5001/api/projects/tasks/${data.taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(updates)
        });
        
        if (response.ok) {
          const updatedTask = await response.json();
          if (handleTaskUpdate) {
            handleTaskUpdate(data.taskId, updatedTask);
          }
        } else {
          console.error('Failed to update task dates');
        }
      }
    } catch (err) {
      console.error('Drop error', err);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    if (!e.currentTarget.dataset.originalBg) {
      e.currentTarget.dataset.originalBg = e.currentTarget.style.backgroundColor || 'var(--bg-primary)';
    }
    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; // Highlight
  };

  const handleDragLeave = (e) => {
    e.currentTarget.style.backgroundColor = e.currentTarget.dataset.originalBg || 'var(--bg-primary)';
  };

  const portalTarget = document.getElementById('timeline-topbar-portal');

  return (
    <div style={styles.calendarContainer}>
      {portalTarget && createPortal(
        <>
          <div style={styles.navGroup}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>{visibleMonth}</h2>
          </div>
          <button style={styles.filterBtn}>Weekend</button>
        </>,
        portalTarget
      )}

      <div style={styles.calendarGridContainer}>
        {/* Weekday headers */}
        <div style={styles.weekdaysRow}>
          {weekDays.map(d => <div key={d} style={styles.weekdayLabel}>{d}</div>)}
        </div>
        
        {/* Continuous Weeks Rows */}
        <div style={styles.weeksContainer} ref={containerRef} onScroll={handleScroll}>
          {weeks.map((week, wIdx) => {
            const hasToday = week.days.some(d => d.isToday);
            return (
              <div 
                key={wIdx} 
                className={hasToday ? 'is-today-week' : ''}
                data-month={week.majorMonth}
                data-year={week.majorYear}
                style={{ ...styles.weekRow, height: `${week.contentHeight}px` }}
              >
                {/* Background day cells layer */}
                <div style={styles.daysBackgroundGrid}>
                  {week.days.map((d, dIdx) => (
                    <div 
                      key={dIdx} 
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, d.date)}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      style={{ ...styles.dayCell, backgroundColor: d.isToday ? 'var(--bg-secondary)' : 'var(--bg-primary)' }}
                    >
                      <div style={d.isToday ? styles.todayNumber : styles.dayNumber}>{d.day}</div>
                    </div>
                  ))}
                </div>
                
                {/* Absolute tasks layer */}
                {week.taskBars.map(({ task, startCol, endCol, slot }, tIdx) => {
                  const isStart = task.sDate.getTime() >= week.days[0].date.getTime();
                  const isEnd = task.eDate.getTime() <= week.days[6].date.getTime();
                  
                  return (
                    <div 
                      key={tIdx} 
                      data-task-id={task.id}
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, task, week.days, startCol, endCol)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => { e.stopPropagation(); onOpenTaskPane && onOpenTaskPane(task.id); }}
                      style={{ 
                        ...styles.taskBar, 
                        pointerEvents: isDragging ? 'none' : 'auto',
                        backgroundColor: task.isCompleted ? '#E5E7EB' : task.sectionColor,
                        color: task.isCompleted ? '#9CA3AF' : 'var(--text-primary)',
                        textDecoration: task.isCompleted ? 'line-through' : 'none',
                        left: `calc(${startCol * (100/7)}% + 6px)`,
                        width: `calc(${(endCol - startCol + 1) * (100/7)}% - 12px)`,
                        top: `${35 + slot * 28}px`,
                        borderTopLeftRadius: isStart ? '12px' : '0',
                        borderBottomLeftRadius: isStart ? '12px' : '0',
                        borderTopRightRadius: isEnd ? '12px' : '0',
                        borderBottomRightRadius: isEnd ? '12px' : '0',
                      }}
                    >
                      {task.assignee && (
                        <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#4F46E5', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 'bold', marginRight: '6px', flexShrink: 0 }}>
                          {task.assignee.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>
                        {task.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getSectionColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#DBEAFE', '#FCE7F3', '#D1FAE5', '#FEF3C7', '#F3E8FF', '#FEE2E2'];
  return colors[Math.abs(hash) % colors.length];
}

const styles = {
  calendarContainer: { display: 'flex', flexDirection: 'column', height: '100%', flex: 1, backgroundColor: 'var(--bg-primary)', padding: '1.5rem', boxSizing: 'border-box', minHeight: 0 },
  headerControls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 },
  todayBtn: { padding: '0.4rem 1rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', color: 'var(--text-primary)' },
  navGroup: { display: 'flex', alignItems: 'center', gap: '1rem' },
  iconBtn: { background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px' },
  monthTitle: { margin: 0, fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)', minWidth: '150px', textAlign: 'center' },
  filterBtn: { padding: '0.4rem 1rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', color: 'var(--text-primary)' },
  calendarGridContainer: { flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' },
  weekdaysRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', flexShrink: 0 },
  weekdayLabel: { padding: '0.5rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' },
  weeksContainer: { flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)', overflowY: 'auto' },
  weekRow: { display: 'flex', flexDirection: 'column', position: 'relative', borderBottom: '1px solid var(--border-color)', flexShrink: 0 },
  daysBackgroundGrid: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' },
  dayCell: { display: 'flex', flexDirection: 'column', padding: '0.4rem', borderRight: '1px solid var(--border-color)', boxSizing: 'border-box', transition: 'background-color 0.2s' },
  dayNumber: { alignSelf: 'flex-start', fontSize: '0.85rem', color: 'var(--text-primary)', padding: '0.2rem', marginBottom: '0.25rem', fontWeight: '500' },
  todayNumber: { alignSelf: 'flex-start', fontSize: '0.85rem', color: '#FFF', backgroundColor: 'var(--accent-primary)', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.25rem', fontWeight: 'bold' },
  taskBar: { position: 'absolute', height: '24px', fontSize: '0.75rem', fontWeight: '500', padding: '0 8px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', cursor: 'pointer', zIndex: 10, boxSizing: 'border-box', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
};

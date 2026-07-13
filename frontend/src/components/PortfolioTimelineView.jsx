import React, { useMemo, useRef, useEffect, useState } from 'react';
import './PortfolioTimelineView.css';

const MONTH_WIDTH = 150;
const TOTAL_MONTHS = 18; // 6 months past, 12 months future

// Colors for random assignment
const PROJECT_COLORS = [
  '#A7F3D0', // light green
  '#C7D2FE', // light indigo
  '#FDE68A', // light yellow
  '#FECACA', // light red
  '#E9D5FF', // light purple
  '#BAE6FD', // light sky
  '#FED7AA', // light orange
  '#FBCFE8', // light pink
  '#D9F99D', // light lime
  '#99F6E4', // light teal
];

const ICON_COLORS = [
  '#059669', // dark green
  '#4F46E5', // dark indigo
  '#D97706', // dark yellow/amber
  '#DC2626', // dark red
  '#7E22CE', // dark purple
  '#0284C7', // dark sky
  '#EA580C', // dark orange
  '#DB2777', // dark pink
  '#65A30D', // dark lime
  '#0D9488', // dark teal
];

export default function PortfolioTimelineView({ projectsList, token, setDetails, user }) {
  const scrollRef = useRef(null);
  const leftPaneRef = useRef(null);
  const [dragState, setDragState] = useState(null);

  const handleLeftScroll = (e) => {
    if (scrollRef.current && scrollRef.current.scrollTop !== e.target.scrollTop) {
      scrollRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const handleRightScroll = (e) => {
    if (leftPaneRef.current && leftPaneRef.current.scrollTop !== e.target.scrollTop) {
      leftPaneRef.current.scrollTop = e.target.scrollTop;
    }
  };
  const [localProjects, setLocalProjects] = useState([]);

  useEffect(() => {
    setLocalProjects(projectsList);
  }, [projectsList]);

  // Calculate months and quarters
  const { months, quarters, startDate, totalWidth } = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 6, 1);
    
    const calculatedMonths = [];
    let currentQuarter = null;
    const calculatedQuarters = [];
    
    for (let i = 0; i < TOTAL_MONTHS; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const mName = d.toLocaleString('en-US', { month: 'long' });
      const year = d.getFullYear();
      const monthNum = d.getMonth(); // 0-11
      const qNum = Math.floor(monthNum / 3) + 1;
      const qName = `Q${qNum} ${year}`;
      
      calculatedMonths.push({
        date: d,
        name: mName,
        year: year,
        days: new Date(year, monthNum + 1, 0).getDate()
      });
      
      if (!currentQuarter || currentQuarter.name !== qName) {
        if (currentQuarter) {
          calculatedQuarters.push(currentQuarter);
        }
        currentQuarter = { name: qName, width: MONTH_WIDTH, monthCount: 1 };
      } else {
        currentQuarter.width += MONTH_WIDTH;
        currentQuarter.monthCount += 1;
      }
    }
    if (currentQuarter) calculatedQuarters.push(currentQuarter);
    
    return {
      months: calculatedMonths,
      quarters: calculatedQuarters,
      startDate: start,
      totalWidth: TOTAL_MONTHS * MONTH_WIDTH
    };
  }, []);

  // Center timeline on today
  useEffect(() => {
    if (scrollRef.current) {
      const today = new Date();
      const msSinceStart = today.getTime() - startDate.getTime();
      const daysSinceStart = msSinceStart / (1000 * 60 * 60 * 24);
      // approximate 30 days per month
      const pxPerDay = MONTH_WIDTH / 30;
      const scrollPos = (daysSinceStart * pxPerDay) - (scrollRef.current.clientWidth / 2);
      scrollRef.current.scrollLeft = Math.max(0, scrollPos);
    }
  }, [startDate]);

  // Map projects to timeline bars
  const timelineProjects = useMemo(() => {
    return localProjects.map((project, index) => {
      let pStart = project.startDate ? new Date(project.startDate) : null;
      let pDue = project.dueDate ? new Date(project.dueDate) : null;
      
      // Fallback to tasks dates
      if (!pStart || !pDue) {
        let minDate = null;
        let maxDate = null;
        if (project.sections) {
          project.sections.forEach(sec => {
            if (sec.tasks) {
              sec.tasks.forEach(t => {
                const ts = t.startDate ? new Date(t.startDate) : (t.dueDate ? new Date(t.dueDate) : null);
                const td = t.dueDate ? new Date(t.dueDate) : (t.startDate ? new Date(t.startDate) : null);
                if (ts && (!minDate || ts < minDate)) minDate = ts;
                if (td && (!maxDate || td > maxDate)) maxDate = td;
              });
            }
          });
        }
        if (!pStart && minDate) pStart = minDate;
        if (!pDue && maxDate) pDue = maxDate;
      }
      
      // Ultimate fallback
      if (!pStart) pStart = new Date(project.createdAt);
      if (!pDue) {
        pDue = new Date(pStart);
        pDue.setDate(pDue.getDate() + 14); // default 2 weeks
      }
      
      // Calculate position
      const msSinceStart = pStart.getTime() - startDate.getTime();
      const msDuration = pDue.getTime() - pStart.getTime();
      
      // average px per ms across the timeline
      const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
      const pxPerMs = MONTH_WIDTH / msPerMonth;
      
      let left = msSinceStart * pxPerMs;
      let width = Math.max(msDuration * pxPerMs, 40); // min width 40px

      if (dragState && dragState.projectId === project.id) {
        if (dragState.type === 'MOVE') {
          left += dragState.deltaX;
        } else if (dragState.type === 'LEFT') {
          left += dragState.deltaX;
          width -= dragState.deltaX;
        } else if (dragState.type === 'RIGHT') {
          width += dragState.deltaX;
        }
        width = Math.max(width, 40);
        
        // Re-calculate pStart and pDue for the tooltip and persistence
        pStart = new Date(startDate.getTime() + (left / pxPerMs));
        pDue = new Date(startDate.getTime() + ((left + width) / pxPerMs));
      }
      
      // Random colors based on project id
      const colorIndex = project.id ? (project.id.charCodeAt(0) + project.id.charCodeAt(project.id.length-1)) % PROJECT_COLORS.length : index % PROJECT_COLORS.length;
      
      const ownerInitials = project.owner && project.owner.name 
        ? project.owner.name.substring(0, 2).toUpperCase() 
        : 'U';
        
      // Status string
      let statusStr = project.status || 'No recent updates';
      if (statusStr === 'NONE') statusStr = 'No recent updates';
      
      return {
        ...project,
        pStart,
        pDue,
        left,
        width,
        barColor: PROJECT_COLORS[colorIndex],
        iconColor: ICON_COLORS[colorIndex],
        ownerInitials,
        statusStr
      };
    });
  }, [localProjects, startDate, dragState]);
  
  // Calculate today's line
  const todayLeft = useMemo(() => {
    const today = new Date();
    const msSinceStart = today.getTime() - startDate.getTime();
    const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
    const pxPerMs = MONTH_WIDTH / msPerMonth;
    return msSinceStart * pxPerMs;
  }, [startDate]);

  const timelineProjectsRef = useRef(timelineProjects);
  useEffect(() => {
    timelineProjectsRef.current = timelineProjects;
  }, [timelineProjects]);

  // Handle Dragging
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragState) return;
      const deltaX = e.clientX - dragState.startMouseX;
      setDragState(prev => ({ ...prev, deltaX }));
    };

    const handleMouseUp = (e) => {
      if (!dragState) return;
      
      const currentProjects = timelineProjectsRef.current;
      const updatedProject = currentProjects.find(p => p.id === dragState.projectId);
      
      if (updatedProject) {
        // Optimistic UI update so it doesn't snap back while fetching
        setLocalProjects(prev => prev.map(p => 
          p.id === updatedProject.id ? { 
            ...p, 
            startDate: updatedProject.pStart.toISOString(), 
            dueDate: updatedProject.pDue.toISOString() 
          } : p
        ));

        fetch(`http://localhost:5001/api/projects/${dragState.projectId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            startDate: updatedProject.pStart.toISOString(),
            dueDate: updatedProject.pDue.toISOString()
          })
        })
        .then(res => res.json())
        .then(data => {
          if (!data.error && setDetails) {
            setDetails(prev => ({
              ...prev,
              projectsList: prev.projectsList.map(p => 
                p.id === updatedProject.id ? { 
                  ...p, 
                  startDate: updatedProject.pStart.toISOString(), 
                  dueDate: updatedProject.pDue.toISOString() 
                } : p
              )
            }));
          }
        })
        .catch(err => console.error(err));
      }
      
      setDragState(null);
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, token, setDetails]);

  const handleMouseDown = (e, projectId, type, p) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent native drag behavior
    
    // Check if user is authorized to edit this project (must be owner)
    if (user && p.ownerId !== user.id) {
      return;
    }

    setDragState({
      projectId,
      type,
      startMouseX: e.clientX,
      deltaX: 0
    });
  };

  const formatDateStr = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="portfolio-timeline-container">
      <div className="pt-main-area">
        {/* Left Pane */}
        <div className="pt-left-pane" ref={leftPaneRef} onScroll={handleLeftScroll}>
          <div className="pt-header-row">
            <div className="pt-col-header pt-col-name">Name</div>
            <div className="pt-col-header pt-col-owner">Owner</div>
            <div className="pt-col-header pt-col-status">Status</div>
          </div>
          {timelineProjects.map(p => (
            <div className="pt-project-row" key={p.id}>
              <div className="pt-cell pt-col-name">
                <div className="pt-project-icon" style={{ backgroundColor: p.iconColor }}>≡</div>
                <span style={{ fontWeight: 500 }}>{p.name}</span>
              </div>
              <div className="pt-cell pt-col-owner">
                <div className="pt-owner-avatar">{p.ownerInitials}</div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {p.owner ? p.owner.name : 'Unknown'}
                </span>
              </div>
              <div className="pt-cell pt-col-status">
                <div className={`pt-status-badge ${p.statusStr.toLowerCase().includes('track') ? 'pt-status-green' : 'pt-status-none'}`}>
                  <span style={{ fontSize: '10px' }}>{p.statusStr.toLowerCase().includes('track') ? '●' : '○'}</span>
                  <span>{p.statusStr}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right Pane (Timeline) */}
        <div className="pt-right-pane" ref={scrollRef} onScroll={handleRightScroll}>
          <div className="pt-timeline-header-container" style={{ width: totalWidth }}>
            <div className="pt-quarters-row">
              {quarters.map((q, i) => (
                <div key={i} className="pt-quarter-cell" style={{ width: q.width }}>
                  {q.name}
                </div>
              ))}
            </div>
            <div className="pt-months-row">
              {months.map((m, i) => (
                <div key={i} className="pt-month-cell" style={{ width: MONTH_WIDTH }}>
                  {m.name}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-timeline-grid-container" style={{ width: totalWidth }}>
            <div className="pt-grid-background">
              {months.map((m, i) => (
                <div key={i} className="pt-grid-line" style={{ width: MONTH_WIDTH }}></div>
              ))}
            </div>
            
            {/* Today Line */}
            {todayLeft >= 0 && todayLeft <= totalWidth && (
              <div className="pt-today-line" style={{ left: todayLeft }}>
                <div className="pt-today-indicator"></div>
              </div>
            )}

            {/* Project Bars */}
            {timelineProjects.map(p => {
              const isDragging = dragState && dragState.projectId === p.id;
              return (
                <div className="pt-timeline-row" key={p.id}>
                  <div 
                    className={`pt-project-bar ${isDragging ? 'dragging' : ''}`}
                    style={{ left: p.left, width: p.width, backgroundColor: p.barColor }}
                    onMouseDown={(e) => handleMouseDown(e, p.id, 'MOVE', p)}
                  >
                  <div 
                    className="pt-drag-handle-left" 
                    onMouseDown={(e) => handleMouseDown(e, p.id, 'LEFT', p)}
                  />
                  {dragState && dragState.projectId === p.id && (
                    <div className="pt-drag-tooltip">
                      {formatDateStr(p.pStart)} - {formatDateStr(p.pDue)}
                    </div>
                  )}
                  <div className="pt-project-bar-content">
                    <div className="pt-owner-avatar" style={{ width: '18px', height: '18px', fontSize: '8px' }}>
                      {p.ownerInitials}
                    </div>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.owner ? p.owner.name : 'Unknown'}
                    </span>
                  </div>
                  <div 
                    className="pt-drag-handle-right" 
                    onMouseDown={(e) => handleMouseDown(e, p.id, 'RIGHT', p)}
                  />
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

import React, { useState, useMemo } from 'react'

export default function Dashboard({ user, projects, setProjects, setSelectedProject, token, handleLogout, setActiveView }) {
  const [newProjectName, setNewProjectName] = useState('')
  const [activeTab, setActiveTab] = useState('Upcoming')

  const handleCreateProject = async () => {
    if (setActiveView) {
      setActiveView('create_project');
    }
  }

  // --- Dynamic Greeting & Date ---
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const hour = today.getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';

  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProjects = safeProjects.filter(p => !p.isArchived);

  // --- EXTRACT ALL TASKS ---
  const allTasks = [];
  safeProjects.forEach(p => {
    p.sections?.forEach(s => {
      s.tasks?.forEach(t => {
        allTasks.push({ ...t, projectName: p.name });
      })
    })
  });

  // --- MY TASKS ---
  const myAllTasks = allTasks.filter(t => t.assigneeId === user.id);
  
  const now = new Date();
  now.setHours(0,0,0,0);

  const myCompleted = myAllTasks.filter(t => t.isCompleted);
  const myIncomplete = myAllTasks.filter(t => !t.isCompleted);
  const myOverdue = myIncomplete.filter(t => t.dueDate && new Date(t.dueDate) < now);
  const myUpcoming = myIncomplete.filter(t => !t.dueDate || new Date(t.dueDate) >= now);

  let displayedMyTasks = myUpcoming;
  if (activeTab.startsWith('Overdue')) displayedMyTasks = myOverdue;
  if (activeTab === 'Completed') displayedMyTasks = myCompleted;

  // --- TASKS I'VE ASSIGNED (Assigned to others) ---
  const assignedToOthers = allTasks.filter(t => t.assigneeId && t.assigneeId !== user.id);

  // --- PEOPLE STATS ---
  const peopleMap = {};
  allTasks.forEach(t => {
    if (t.assigneeId && t.assigneeId !== user.id && t.assignee) {
      if (!peopleMap[t.assigneeId]) {
        peopleMap[t.assigneeId] = { id: t.assigneeId, user: t.assignee, overdue: 0, completed: 0, upcoming: 0 };
      }
      if (t.isCompleted) {
        peopleMap[t.assigneeId].completed++;
      } else if (t.dueDate && new Date(t.dueDate) < now) {
        peopleMap[t.assigneeId].overdue++;
      } else {
        peopleMap[t.assigneeId].upcoming++;
      }
    }
  });
  const peopleList = Object.values(peopleMap);

  const handleToggleComplete = async (e, task) => {
    e.stopPropagation();

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
      if (response.ok) {
        setProjects(projects.map(p => ({
          ...p,
          sections: p.sections?.map(s => ({
            ...s,
            tasks: s.tasks?.map(t => t.id === task.id ? data : t)
          }))
        })));
      }
    } catch (err) { console.error(err) }
  };

  const formatFriendlyDate = (dueDate) => {
    if (!dueDate) return 'No due date';
    const date = new Date(dueDate);
    date.setHours(0,0,0,0);
    const diffDays = Math.round((date - now) / 86400000);
    if (diffDays === 0) return { text: 'Today', color: '#10B981' };
    if (diffDays === -1) return { text: 'Yesterday', color: '#EF4444' };
    if (diffDays === 1) return { text: 'Tomorrow', color: 'var(--text-secondary)' };
    if (diffDays > 1 && diffDays < 7) {
      return { text: date.toLocaleDateString('en-US', { weekday: 'long' }), color: 'var(--text-secondary)' };
    }
    if (diffDays < -1) return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: '#EF4444' };
    return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'var(--text-secondary)' };
  }

  const formatTaskRange = (start, due) => {
    if (!start && !due) return 'icon';
    if (!start && due) return new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (start && !due) return new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const s = new Date(start);
    const d = new Date(due);
    if (s.getMonth() === d.getMonth()) {
      return `${s.getDate()} - ${d.getDate()} ${s.toLocaleDateString('en-US', { month: 'short' })}`;
    }
    return `${s.getDate()} ${s.toLocaleDateString('en-US', { month: 'short' })} - ${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
  }

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerDate}>{dateStr}</div>
          <h1 style={styles.headerGreeting}>{greeting}, {user?.name || 'User'}</h1>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.headerBtn}>My week <span style={{fontSize:'0.6rem'}}>▼</span></button>
          <button style={styles.headerBtn}><span style={{color:'var(--accent-success)'}}>✓</span> {myCompleted.length} tasks completed</button>
          <button style={styles.headerBtn}>👥 {peopleList.length} collaborators</button>
          <button style={{...styles.headerBtn, backgroundColor:'var(--bg-tertiary)'}}>⚙ Customize</button>
        </div>
      </div>

      {/* 2x2 GRID */}
      <div style={styles.grid}>
        
        {/* WIDGET 1: MY TASKS */}
        <div style={styles.widgetCard}>
          <div style={styles.widgetHeader}>
            <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
              <div style={styles.userAvatarInitials}>{user?.name ? user.name.substring(0,2).toUpperCase() : 'AK'}</div>
              <h2 style={styles.widgetTitle}>My tasks <span style={{fontSize:'1rem', color:'var(--text-tertiary)'}}>🔒</span></h2>
            </div>
            <button style={styles.menuBtn}>•••</button>
          </div>
          
          <div style={styles.tabsRow}>
            {['Upcoming', `Overdue (${myOverdue.length})`, 'Completed'].map(tab => (
              <div 
                key={tab} 
                onClick={() => setActiveTab(tab)}
                style={{...styles.tabItem, borderBottom: activeTab === tab ? '2px solid var(--text-primary)' : '2px solid transparent', color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)'}}
              >
                {tab}
              </div>
            ))}
          </div>
          
          <div style={styles.widgetBody}>
            <div style={styles.createTaskRow}>+ Create task</div>
            
            {displayedMyTasks.length === 0 && <div style={{padding:'1rem 0', color:'var(--text-secondary)', fontSize:'0.9rem'}}>No tasks in this category.</div>}
            
            {displayedMyTasks.map((t, idx) => (
              <div key={t.id} style={{...styles.taskRow, borderTop: idx !== 0 ? '1px solid var(--border-color)' : 'none'}}>
                <div style={styles.taskRowLeft}>
                  <div 
                    style={{...styles.taskCheckbox, backgroundColor: t.isCompleted ? 'var(--accent-success)' : 'transparent', border: `1px solid ${t.isCompleted ? 'var(--accent-success)' : 'var(--border-color)'}`, color: t.isCompleted ? '#FFF' : 'var(--border-color)', cursor: 'pointer'}}
                    onClick={(e) => handleToggleComplete(e, t)}
                  >✓</div>
                  <span style={{...styles.taskTitle, textDecoration: t.isCompleted ? 'line-through' : 'none', color: t.isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)'}}>{t.title}</span>
                </div>
                <div style={styles.taskRowRight}>
                  <div style={styles.projectPill}><div style={{width:8, height:8, borderRadius:2, backgroundColor:'#34D399', marginRight:4}}/>{t.projectName}</div>
                  <div style={styles.taskDate}>{formatTaskRange(t.startDate, t.dueDate) === 'icon' ? '📅' : formatTaskRange(t.startDate, t.dueDate)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WIDGET 2: PROJECTS */}
        <div style={styles.widgetCard}>
          <div style={styles.widgetHeader}>
            <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
              <h2 style={styles.widgetTitle}>Projects</h2>
              <span style={{fontSize:'0.85rem', color:'var(--text-secondary)', cursor:'pointer', marginTop:'4px'}}>Recents <span style={{fontSize:'0.6rem'}}>▼</span></span>
            </div>
            <button style={styles.menuBtn}>•••</button>
          </div>
          
          <div style={styles.widgetBodyProjects}>
            
            {/* Create Project Card */}
            <div style={styles.createProjectCard} onClick={handleCreateProject}>
              <div style={styles.dashedSquare}>+</div>
              <span style={styles.createProjectText}>Create project</span>
            </div>

            {/* Actual Projects from Database */}
            {activeProjects.map(p => (
              <div key={p.id} style={styles.projectCard} onClick={() => setSelectedProject(p)}>
                <div style={{...styles.projectIconSquare, backgroundColor: p.color || '#4F46E5'}}>
                  <span style={{color: '#FFF', fontSize:'1.2rem'}}>{p.icon || '📋'}</span>
                </div>
                <div style={styles.projectCardText}>
                  <div style={styles.projectName}>{p.name}</div>
                  <div style={styles.projectSub}>{p.sections?.reduce((acc, sec) => acc + (sec.tasks?.length || 0), 0) || 0} tasks</div>
                </div>
              </div>
            ))}

          </div>
        </div>

        {/* WIDGET 3: TASKS I'VE ASSIGNED */}
        <div style={styles.widgetCard}>
          <div style={styles.widgetHeader}>
            <div>
              <h2 style={styles.widgetTitle}>Tasks I've assigned</h2>
              <div style={styles.widgetSubtitle}>Track work you've delegated so you can see what needs prioritizing</div>
            </div>
            <button style={styles.menuBtn}>•••</button>
          </div>
          
          <div style={styles.widgetBody}>
            {assignedToOthers.length === 0 && <div style={{padding:'1rem 0', color:'var(--text-secondary)', fontSize:'0.9rem'}}>No delegated tasks found.</div>}
            {assignedToOthers.slice(0, 5).map((t, idx) => {
              const status = formatFriendlyDate(t.dueDate);
              return (
                <div key={t.id} style={{...styles.assignedRow, opacity: t.isCompleted ? 0.5 : 1, borderTop: idx !== 0 ? '1px solid var(--border-color)' : 'none'}}>
                  <div style={styles.assignedRowLeft}>
                    <div 
                      style={{...styles.taskCheckbox, backgroundColor: t.isCompleted ? 'var(--accent-success)' : 'transparent', border: `1px solid ${t.isCompleted ? 'var(--accent-success)' : 'var(--border-color)'}`, color: t.isCompleted ? '#FFF' : 'var(--border-color)', cursor: 'pointer'}}
                      onClick={(e) => handleToggleComplete(e, t)}
                    >✓</div>
                    <span style={{...styles.assignedTaskTitle, textDecoration: t.isCompleted ? 'line-through' : 'none'}}>{t.title}</span>
                  </div>
                  <div style={styles.assignedRowRight}>
                    <span style={{fontSize:'0.8rem', color: t.isCompleted ? 'var(--text-tertiary)' : status.color}}>{t.isCompleted ? 'Completed' : status.text}</span>
                    <div style={{...styles.miniAvatar, color:'var(--text-primary)'}}>{t.assignee?.name ? t.assignee.name.substring(0,2).toUpperCase() : '👤'}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{marginTop:'auto', paddingTop:'1rem'}}>
            <button style={styles.outlineBtn}>Invite a teammate</button>
          </div>
        </div>

        {/* WIDGET 4: PEOPLE */}
        <div style={styles.widgetCard}>
          <div style={styles.widgetHeader}>
            <div>
              <h2 style={styles.widgetTitle}>People</h2>
              <div style={styles.widgetSubtitle}>See who's on track and who needs support at a glance.</div>
            </div>
            <button style={styles.menuBtn}>•••</button>
          </div>
          
          <div style={styles.widgetBody}>
            {peopleList.length === 0 && <div style={{padding:'1rem 0', color:'var(--text-secondary)', fontSize:'0.9rem'}}>No collaborators found.</div>}
            {peopleList.map((p, idx) => (
              <div key={p.id} style={{...styles.peopleRow}}>
                <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                  <div style={{...styles.miniAvatar, color:'var(--text-primary)'}}>{p.user?.name ? p.user.name.substring(0,2).toUpperCase() : '👤'}</div>
                  <div style={styles.blurredBar}>
                    {/* Basic visual bar logic representing workload */}
                    <div style={{display:'flex', height:'100%', borderRadius:'6px', overflow:'hidden'}}>
                      {p.overdue > 0 && <div style={{width: `${(p.overdue/(p.overdue+p.completed+p.upcoming))*100}%`, backgroundColor:'var(--accent-danger)'}}></div>}
                      {p.completed > 0 && <div style={{width: `${(p.completed/(p.overdue+p.completed+p.upcoming))*100}%`, backgroundColor:'var(--accent-success)'}}></div>}
                      {p.upcoming > 0 && <div style={{width: `${(p.upcoming/(p.overdue+p.completed+p.upcoming))*100}%`, backgroundColor:'var(--border-color)'}}></div>}
                    </div>
                  </div>
                </div>
                <div style={styles.peopleStats}>
                  <span style={{color: p.overdue > 0 ? 'var(--accent-danger)' : 'var(--text-tertiary)'}}>{p.overdue} overdue</span>
                  <span style={{color: p.completed > 0 ? 'var(--accent-success)' : 'var(--text-tertiary)'}}>{p.completed} completed</span>
                  <span style={{color:'var(--text-tertiary)'}}>{p.upcoming} upcoming</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{marginTop:'auto', paddingTop:'1rem'}}>
            <button style={styles.outlineBtn}>Invite a teammate</button>
          </div>
        </div>

      </div>
    </div>
  )
}

const styles = {
  container: { backgroundColor: 'var(--bg-secondary)', minHeight: '100vh', padding: '2rem 3rem 6rem 3rem', fontFamily: 'system-ui', boxSizing: 'border-box', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' },
  headerDate: { fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' },
  headerGreeting: { fontSize: '2rem', fontWeight: '400', margin: 0, color: 'var(--text-primary)' },
  headerActions: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  headerBtn: { padding: '0.4rem 0.8rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' },
  
  widgetCard: { backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '1.5rem', paddingRight: '1rem', display: 'flex', flexDirection: 'column', height: '400px' },
  widgetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  widgetTitle: { fontSize: '1.25rem', fontWeight: '400', margin: 0, color: 'var(--text-primary)' },
  widgetSubtitle: { fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' },
  menuBtn: { background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.5rem' },
  userAvatarInitials: { width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FBCFE8', color: '#BE185D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: '600' },
  
  tabsRow: { display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem' },
  tabItem: { paddingBottom: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', fontWeight: '500' },
  
  widgetBody: { display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, paddingRight: '0.5rem' },
  createTaskRow: { padding: '0.75rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer' },
  
  taskRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0' },
  taskRowLeft: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  taskCheckbox: { width: '18px', height: '18px', border: '1px solid var(--border-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text-tertiary)' },
  taskTitle: { fontSize: '0.9rem', color: 'var(--text-primary)' },
  taskRowRight: { display: 'flex', alignItems: 'center', gap: '1rem' },
  projectPill: { display: 'flex', alignItems: 'center', backgroundColor: '#A7F3D0', color: '#065F46', fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '12px' },
  taskDate: { fontSize: '0.8rem', color: 'var(--text-secondary)', width: '60px', textAlign: 'right' },

  widgetBodyProjects: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.5rem', overflowY: 'auto', flex: 1, alignContent: 'start', paddingRight: '0.5rem' },
  createProjectCard: { display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' },
  dashedSquare: { width: '48px', height: '48px', border: '1px dashed var(--text-tertiary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '1.5rem' },
  createProjectText: { fontSize: '0.9rem', color: 'var(--text-primary)' },
  
  projectCard: { display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' },
  projectIconSquare: { width: '48px', height: '48px', backgroundColor: '#6EE7B7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  projectCardText: { display: 'flex', flexDirection: 'column' },
  projectName: { fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '500' },
  projectSub: { fontSize: '0.8rem', color: 'var(--text-secondary)' },

  assignedRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0' },
  assignedRowLeft: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  assignedTaskTitle: { fontSize: '0.9rem', color: 'var(--text-primary)' },
  assignedRowRight: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  miniAvatar: { width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' },

  peopleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0' },
  blurredBar: { width: '120px', height: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' },
  peopleStats: { display: 'flex', gap: '0.75rem', fontSize: '0.8rem' },

  outlineBtn: { padding: '0.4rem 1rem', border: '1px solid var(--border-color)', backgroundColor: 'transparent', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '500' }
}

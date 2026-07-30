import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts'
import UserAvatar from './UserAvatar'
import './Dashboard.css'

// ========================
// WIDGET REGISTRY
// ========================
const WIDGET_REGISTRY = [
  { type: 'my-tasks', label: 'My tasks', icon: '✓', color: '#FBCFE8', description: 'View your upcoming, overdue, and completed tasks' },
  { type: 'projects', label: 'Projects', icon: '📁', color: '#BFDBFE', description: 'See your recent projects at a glance' },
  { type: 'assigned-tasks', label: "Tasks I've assigned", icon: '📤', color: '#FDE68A', description: 'Track work you\'ve delegated' },
  { type: 'people', label: 'People', icon: '👥', color: '#D1FAE5', description: 'See who\'s on track and who needs support' },
  { type: 'notepad', label: 'Notepad', icon: '📝', color: '#E9D5FF', description: 'Personal scratchpad for quick notes' },
  { type: 'goals', label: 'Goals', icon: '🎯', color: '#FECACA', description: 'Track progress on team and company goals' },
  { type: 'charts', label: 'Charts', icon: '📊', color: '#CFFAFE', description: 'Visualize task data with charts' },
  { type: 'draft-comments', label: 'Draft comments', icon: '💬', color: '#FED7AA', description: 'Saved draft comments from tasks' },
  { type: 'forms', label: 'Forms', icon: '📋', color: '#C7D2FE', description: 'Quick access to your project forms' },
]

const DEFAULT_LAYOUT = [
  { id: 'my-tasks', type: 'my-tasks', colSpan: 1, rowSpan: 1 },
  { id: 'projects', type: 'projects', colSpan: 1, rowSpan: 1 },
  { id: 'assigned-tasks', type: 'assigned-tasks', colSpan: 1, rowSpan: 1 },
  { id: 'people', type: 'people', colSpan: 1, rowSpan: 1 },
]

export default function Dashboard({ user, projects, setProjects, setSelectedProject, token, handleLogout, setActiveView }) {
  // --- Layout State ---
  const [widgetLayout, setWidgetLayout] = useState(DEFAULT_LAYOUT)
  const [notepadContent, setNotepadContent] = useState('')
  const [layoutLoaded, setLayoutLoaded] = useState(false)

  // --- Drag State ---
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  // --- UI State ---
  const [showWidgetPicker, setShowWidgetPicker] = useState(false)
  const [openMenu, setOpenMenu] = useState(null)
  const [activeTab, setActiveTab] = useState('Upcoming')
  const [chartTab, setChartTab] = useState('by-project')

  // --- Refs ---
  const saveTimerRef = useRef(null)
  const notepadTimerRef = useRef(null)
  const menuRef = useRef(null)

  // ========================
  // LOAD LAYOUT FROM SERVER
  // ========================
  useEffect(() => {
    if (!token) return
    fetch('http://localhost:5001/api/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.layout && Array.isArray(data.layout) && data.layout.length > 0) {
          setWidgetLayout(data.layout)
        }
        if (data.notepad) {
          setNotepadContent(data.notepad)
        }
        setLayoutLoaded(true)
      })
      .catch(err => {
        console.error('Failed to load dashboard layout:', err)
        setLayoutLoaded(true)
      })
  }, [token])

  // ========================
  // SAVE LAYOUT TO SERVER (debounced)
  // ========================
  const saveLayout = useCallback((layout) => {
    if (!token) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      fetch('http://localhost:5001/api/dashboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ layout })
      }).catch(err => console.error('Failed to save layout:', err))
    }, 500)
  }, [token])

  const saveNotepad = useCallback((text) => {
    if (!token) return
    clearTimeout(notepadTimerRef.current)
    notepadTimerRef.current = setTimeout(() => {
      fetch('http://localhost:5001/api/dashboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ notepad: text })
      }).catch(err => console.error('Failed to save notepad:', err))
    }, 1000)
  }, [token])

  // ========================
  // DATA EXTRACTION
  // ========================
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const hour = today.getHours()
  let greeting = 'Good evening'
  if (hour < 12) greeting = 'Good morning'
  else if (hour < 18) greeting = 'Good afternoon'

  const safeProjects = Array.isArray(projects) ? projects : []
  const activeProjects = safeProjects.filter(p => !p.isArchived && p.status !== 'MY_TASKS')

  const allTasks = useMemo(() => {
    const tasksMap = new Map()
    safeProjects.forEach(p => {
      if (p.isTemplate) return;
      
      p.sections?.forEach(s => {
        s.tasks?.forEach(t => {
          if (t.section?.project?.isTemplate) return;
          if (t.secondaryProjects?.some(sp => sp.project?.isTemplate)) return;
          
          if (!tasksMap.has(t.id)) {
             tasksMap.set(t.id, { ...t, projectName: p.name, projectColor: p.color || '#4F46E5' })
          }
        })
      })
    })
    return Array.from(tasksMap.values())
  }, [safeProjects])

  const now = useMemo(() => {
    const d = new Date()
    d.setHours(0,0,0,0)
    return d
  }, [])

  const myAllTasks = allTasks.filter(t => t.assigneeId === user.id)
  const myCompleted = myAllTasks.filter(t => t.isCompleted)
  const myIncomplete = myAllTasks.filter(t => !t.isCompleted)
  const myOverdue = myIncomplete.filter(t => t.dueDate && new Date(t.dueDate) < now)
  const myUpcoming = myIncomplete.filter(t => !t.dueDate || new Date(t.dueDate) >= now)

  let displayedMyTasks = myUpcoming
  if (activeTab.startsWith('Overdue')) displayedMyTasks = myOverdue
  if (activeTab === 'Completed') displayedMyTasks = myCompleted

  const assignedToOthers = allTasks.filter(t => t.assigneeId && t.assigneeId !== user.id)

  const peopleMap = {}
  allTasks.forEach(t => {
    if (t.assigneeId && t.assigneeId !== user.id && t.assignee) {
      if (!peopleMap[t.assigneeId]) {
        peopleMap[t.assigneeId] = { id: t.assigneeId, user: t.assignee, overdue: 0, completed: 0, upcoming: 0 }
      }
      if (t.isCompleted) {
        peopleMap[t.assigneeId].completed++
      } else if (t.dueDate && new Date(t.dueDate) < now) {
        peopleMap[t.assigneeId].overdue++
      } else {
        peopleMap[t.assigneeId].upcoming++
      }
    }
  })
  const peopleList = Object.values(peopleMap)

  // ========================
  // CHART DATA
  // ========================
  const chartDataByProject = useMemo(() => {
    const map = {}
    safeProjects.forEach(p => {
      let total = 0, completed = 0
      p.sections?.forEach(s => {
        s.tasks?.forEach(t => {
          total++
          if (t.isCompleted) completed++
        })
      })
      if (total > 0) {
        map[p.name] = { name: p.name.length > 14 ? p.name.substring(0,12) + '..' : p.name, total, completed, incomplete: total - completed }
      }
    })
    return Object.values(map).slice(0, 8)
  }, [safeProjects])

  const chartDataByStatus = useMemo(() => {
    const completed = allTasks.filter(t => t.isCompleted).length
    const overdue = allTasks.filter(t => !t.isCompleted && t.dueDate && new Date(t.dueDate) < now).length
    const upcoming = allTasks.filter(t => !t.isCompleted && (!t.dueDate || new Date(t.dueDate) >= now)).length
    return [
      { name: 'Completed', value: completed, color: '#10B981' },
      { name: 'Overdue', value: overdue, color: '#EF4444' },
      { name: 'Upcoming', value: upcoming, color: '#6366F1' },
    ].filter(d => d.value > 0)
  }, [allTasks, now])

  const chartDataCompletionTrend = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0,0,0,0)
      const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' })
      const completedOnDay = allTasks.filter(t => {
        if (!t.completedAt) return false
        const ct = new Date(t.completedAt)
        ct.setHours(0,0,0,0)
        return ct.getTime() === d.getTime()
      }).length
      const createdOnDay = allTasks.filter(t => {
        if (!t.createdAt) return false
        const ct = new Date(t.createdAt)
        ct.setHours(0,0,0,0)
        return ct.getTime() === d.getTime()
      }).length
      days.push({ name: dayStr, completed: completedOnDay, created: createdOnDay })
    }
    return days
  }, [allTasks])

  // ========================
  // GOALS DATA
  // ========================
  const [goalsData, setGoalsData] = useState([])
  useEffect(() => {
    if (!token) return
    fetch('http://localhost:5001/api/goals', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setGoalsData(data)
      })
      .catch(() => {})
  }, [token])

  // ========================
  // HANDLERS
  // ========================
  const handleToggleComplete = async (e, task) => {
    e.stopPropagation()
    if (!task.isCompleted) {
      const activeBlockers = task.blockedBy?.filter(dep => !dep.blockingTask?.isCompleted) || []
      if (activeBlockers.length > 0) {
        if (!window.confirm("This task is blocked by another task. Are you sure you want to complete it?")) {
          return
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
        })))
      }
    } catch (err) { console.error(err) }
  }

  const handleCreateProject = () => {
    if (setActiveView) setActiveView('create_project')
  }

  const formatFriendlyDate = (dueDate) => {
    if (!dueDate) return 'No due date'
    const date = new Date(dueDate)
    date.setHours(0,0,0,0)
    const diffDays = Math.round((date - now) / 86400000)
    if (diffDays === 0) return { text: 'Today', color: '#10B981' }
    if (diffDays === -1) return { text: 'Yesterday', color: '#EF4444' }
    if (diffDays === 1) return { text: 'Tomorrow', color: 'var(--text-secondary)' }
    if (diffDays > 1 && diffDays < 7) return { text: date.toLocaleDateString('en-US', { weekday: 'long' }), color: 'var(--text-secondary)' }
    if (diffDays < -1) return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: '#EF4444' }
    return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'var(--text-secondary)' }
  }

  const formatTaskRange = (start, due) => {
    if (!start && !due) return 'icon'
    if (!start && due) return new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (start && !due) return new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const s = new Date(start)
    const d = new Date(due)
    if (s.getMonth() === d.getMonth()) return `${s.getDate()} - ${d.getDate()} ${s.toLocaleDateString('en-US', { month: 'short' })}`
    return `${s.getDate()} ${s.toLocaleDateString('en-US', { month: 'short' })} - ${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`
  }

  // ========================
  // LAYOUT OPERATIONS
  // ========================
  const addWidget = (type) => {
    const existing = widgetLayout.find(w => w.type === type)
    if (existing) return

    const newWidget = {
      id: type + '-' + Date.now(),
      type,
      colSpan: 1,
      rowSpan: 1,
    }
    const newLayout = [...widgetLayout, newWidget]
    setWidgetLayout(newLayout)
    saveLayout(newLayout)
    setShowWidgetPicker(false)
  }

  const removeWidget = (widgetId) => {
    const newLayout = widgetLayout.filter(w => w.id !== widgetId)
    setWidgetLayout(newLayout)
    saveLayout(newLayout)
    setOpenMenu(null)
  }

  const toggleWidgetSize = (widgetId, prop, val) => {
    const newLayout = widgetLayout.map(w =>
      w.id === widgetId ? { ...w, [prop]: val } : w
    )
    setWidgetLayout(newLayout)
    saveLayout(newLayout)
    setOpenMenu(null)
  }

  // ========================
  // DRAG & DROP
  // ========================
  const handleDragStart = (e, index) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // Set a small transparent image as drag image
    const emptyImg = document.createElement('img')
    emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
    e.dataTransfer.setDragImage(emptyImg, 0, 0)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = () => {
    // Don't clear immediately, causes flicker
  }

  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }

    const newLayout = [...widgetLayout]
    const [draggedItem] = newLayout.splice(dragIndex, 1)
    newLayout.splice(dropIndex, 0, draggedItem)

    setWidgetLayout(newLayout)
    saveLayout(newLayout)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  // ========================
  // CLICK OUTSIDE MENU
  // ========================
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openMenu && menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenu])

  // ========================
  // WIDGET CONTENT RENDERERS
  // ========================
  const renderMyTasks = (widget) => (
    <>
      <div className="widget-header">
        <div className="widget-header-left">
          <UserAvatar name={user?.name} size={48} />
          <h2 className="widget-title">My tasks <span style={{fontSize:'1rem', color:'var(--text-tertiary)'}}>🔒</span></h2>
        </div>
        {renderWidgetMenuBtn(widget)}
      </div>
      <div className="widget-tabs-row">
        {['Upcoming', `Overdue (${myOverdue.length})`, 'Completed'].map(tab => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`widget-tab-item ${activeTab === tab ? 'active' : ''}`}
          >
            {tab}
          </div>
        ))}
      </div>
      <div className="widget-body">
        <div className="widget-create-row">+ Create task</div>
        {displayedMyTasks.length === 0 && <div className="widget-empty-state">No tasks in this category.</div>}
        {displayedMyTasks.map(t => (
          <div key={t.id} className="widget-task-row">
            <div className="widget-task-left">
              <div
                className={`widget-task-checkbox ${t.isCompleted ? 'completed' : ''}`}
                onClick={(e) => handleToggleComplete(e, t)}
              >✓</div>
              <span className={`widget-task-title ${t.isCompleted ? 'completed' : ''}`}>{t.title}</span>
            </div>
            <div className="widget-task-right">
              <div className="widget-project-pill">
                <div className="widget-project-pill-dot" />
                {t.projectName}
              </div>
              <div className="widget-task-date">
                {formatTaskRange(t.startDate, t.dueDate) === 'icon' ? '📅' : formatTaskRange(t.startDate, t.dueDate)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )

  const renderProjects = (widget) => (
    <>
      <div className="widget-header">
        <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
          <h2 className="widget-title">Projects</h2>
          <span style={{fontSize:'0.85rem', color:'var(--text-secondary)', cursor:'pointer', marginTop:'4px'}}>Recents <span style={{fontSize:'0.6rem'}}>▼</span></span>
        </div>
        {renderWidgetMenuBtn(widget)}
      </div>
      <div className="widget-projects-grid">
        <div className="widget-create-project-card" onClick={handleCreateProject}>
          <div className="widget-dashed-square">+</div>
          <span style={{fontSize:'0.9rem', color:'var(--text-primary)'}}>Create project</span>
        </div>
        {activeProjects.map(p => (
          <div key={p.id} className="widget-project-card" onClick={() => setSelectedProject(p)}>
            <div className="widget-project-icon" style={{backgroundColor: p.color || '#4F46E5'}}>
              <span>{p.icon || '📋'}</span>
            </div>
            <div>
              <div className="widget-project-name">{p.name}</div>
              <div className="widget-project-sub">{p.sections?.reduce((acc, sec) => acc + (sec.tasks?.length || 0), 0) || 0} tasks</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )

  const renderAssignedTasks = (widget) => (
    <>
      <div className="widget-header">
        <div>
          <h2 className="widget-title">Tasks I've assigned</h2>
          <div className="widget-subtitle">Track work you've delegated so you can see what needs prioritizing</div>
        </div>
        {renderWidgetMenuBtn(widget)}
      </div>
      <div className="widget-body">
        {assignedToOthers.length === 0 && <div className="widget-empty-state">No delegated tasks found.</div>}
        {assignedToOthers.slice(0, 5).map(t => {
          const status = formatFriendlyDate(t.dueDate)
          return (
            <div key={t.id} className="widget-task-row" style={{opacity: t.isCompleted ? 0.5 : 1}}>
              <div className="widget-task-left">
                <div
                  className={`widget-task-checkbox ${t.isCompleted ? 'completed' : ''}`}
                  onClick={(e) => handleToggleComplete(e, t)}
                >✓</div>
                <span className={`widget-task-title ${t.isCompleted ? 'completed' : ''}`}>{t.title}</span>
              </div>
              <div className="widget-task-right">
                <span style={{fontSize:'0.8rem', color: t.isCompleted ? 'var(--text-tertiary)' : status.color}}>
                  {t.isCompleted ? 'Completed' : status.text}
                </span>
                <UserAvatar name={t.assignee?.name} size={24} />
              </div>
            </div>
          )
        })}
      </div>
      <div style={{marginTop:'auto', paddingTop:'1rem'}}>
        <button className="widget-outline-btn">Invite a teammate</button>
      </div>
    </>
  )

  const renderPeople = (widget) => (
    <>
      <div className="widget-header">
        <div>
          <h2 className="widget-title">People</h2>
          <div className="widget-subtitle">See who's on track and who needs support at a glance.</div>
        </div>
        {renderWidgetMenuBtn(widget)}
      </div>
      <div className="widget-body">
        {peopleList.length === 0 && <div className="widget-empty-state">No collaborators found.</div>}
        {peopleList.map(p => {
          const total = p.overdue + p.completed + p.upcoming
          return (
            <div key={p.id} className="widget-people-row">
              <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                <UserAvatar name={p.user?.name} size={24} />
                <div className="widget-people-bar">
                  <div className="widget-people-bar-inner">
                    {p.overdue > 0 && <div style={{width: `${(p.overdue/total)*100}%`, backgroundColor:'var(--accent-danger)'}} />}
                    {p.completed > 0 && <div style={{width: `${(p.completed/total)*100}%`, backgroundColor:'var(--accent-success)'}} />}
                    {p.upcoming > 0 && <div style={{width: `${(p.upcoming/total)*100}%`, backgroundColor:'var(--border-color)'}} />}
                  </div>
                </div>
              </div>
              <div className="widget-people-stats">
                <span style={{color: p.overdue > 0 ? 'var(--accent-danger)' : 'var(--text-tertiary)'}}>{p.overdue} overdue</span>
                <span style={{color: p.completed > 0 ? 'var(--accent-success)' : 'var(--text-tertiary)'}}>{p.completed} completed</span>
                <span style={{color:'var(--text-tertiary)'}}>{p.upcoming} upcoming</span>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{marginTop:'auto', paddingTop:'1rem'}}>
        <button className="widget-outline-btn">Invite a teammate</button>
      </div>
    </>
  )

  const renderNotepad = (widget) => (
    <>
      <div className="widget-header">
        <div className="widget-header-left">
          <h2 className="widget-title">📝 Notepad</h2>
        </div>
        {renderWidgetMenuBtn(widget)}
      </div>
      <textarea
        className="widget-notepad-textarea"
        placeholder="Write your notes here..."
        value={notepadContent}
        onChange={(e) => {
          setNotepadContent(e.target.value)
          saveNotepad(e.target.value)
        }}
      />
    </>
  )

  const renderGoals = (widget) => (
    <>
      <div className="widget-header">
        <div className="widget-header-left">
          <h2 className="widget-title">🎯 Goals</h2>
        </div>
        {renderWidgetMenuBtn(widget)}
      </div>
      <div className="widget-body">
        {goalsData.length === 0 && <div className="widget-empty-state">No goals found. Create goals to track progress.</div>}
        {goalsData.map(goal => {
          const pct = goal.targetValue > 0 ? Math.round((goal.currentValue / goal.targetValue) * 100) : 0
          const statusColor = goal.status === 'On track' ? '#10B981' : goal.status === 'At risk' ? '#F59E0B' : '#EF4444'
          return (
            <div key={goal.id} className="widget-goal-row">
              <div className="widget-goal-status" style={{backgroundColor: statusColor}} />
              <div className="widget-goal-info">
                <div className="widget-goal-title">{goal.title}</div>
                <div className="widget-goal-meta">{goal.status} · {goal.timePeriod || 'No period'}</div>
              </div>
              <div className="widget-goal-progress-bar">
                <div className="widget-goal-progress-fill" style={{width: `${pct}%`, backgroundColor: statusColor}} />
              </div>
              <div className="widget-goal-percentage">{pct}%</div>
            </div>
          )
        })}
      </div>
    </>
  )

  const CHART_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

  const renderCharts = (widget) => (
    <>
      <div className="widget-header">
        <div className="widget-header-left">
          <h2 className="widget-title">📊 Charts</h2>
        </div>
        {renderWidgetMenuBtn(widget)}
      </div>
      <div className="widget-chart-container">
        <div className="widget-chart-tabs">
          {[
            { key: 'by-project', label: 'By project' },
            { key: 'by-status', label: 'By status' },
            { key: 'trend', label: 'Completion trend' },
          ].map(t => (
            <button
              key={t.key}
              className={`widget-chart-tab ${chartTab === t.key ? 'active' : ''}`}
              onClick={() => setChartTab(t.key)}
            >{t.label}</button>
          ))}
        </div>
        <div className="widget-chart-area">
          {chartTab === 'by-project' && (
            chartDataByProject.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataByProject} margin={{top: 5, right: 10, left: -10, bottom: 5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="name" tick={{fontSize: 11, fill: 'var(--text-secondary)'}} />
                  <YAxis tick={{fontSize: 11, fill: 'var(--text-secondary)'}} />
                  <Tooltip
                    contentStyle={{background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem'}}
                    labelStyle={{color: 'var(--text-primary)'}}
                  />
                  <Bar dataKey="completed" fill="#10B981" radius={[4,4,0,0]} name="Completed" />
                  <Bar dataKey="incomplete" fill="#6366F1" radius={[4,4,0,0]} name="Incomplete" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="widget-empty-state">No project data to display.</div>
            )
          )}
          {chartTab === 'by-status' && (
            chartDataByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartDataByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="70%"
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {chartDataByStatus.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem'}}
                  />
                  <Legend wrapperStyle={{fontSize: '0.8rem'}} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="widget-empty-state">No task data to display.</div>
            )
          )}
          {chartTab === 'trend' && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartDataCompletionTrend} margin={{top: 5, right: 10, left: -10, bottom: 5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" tick={{fontSize: 11, fill: 'var(--text-secondary)'}} />
                <YAxis tick={{fontSize: 11, fill: 'var(--text-secondary)'}} />
                <Tooltip
                  contentStyle={{background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem'}}
                  labelStyle={{color: 'var(--text-primary)'}}
                />
                <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} name="Completed" dot={{r: 3}} />
                <Line type="monotone" dataKey="created" stroke="#6366F1" strokeWidth={2} name="Created" dot={{r: 3}} />
                <Legend wrapperStyle={{fontSize: '0.8rem'}} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  )

  const renderDraftComments = (widget) => (
    <>
      <div className="widget-header">
        <div className="widget-header-left">
          <h2 className="widget-title">💬 Draft comments</h2>
        </div>
        {renderWidgetMenuBtn(widget)}
      </div>
      <div className="widget-body">
        <div className="widget-empty-state" style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, textAlign:'center', gap:'0.5rem', padding:'2rem 0'}}>
          <span style={{fontSize:'2rem'}}>💬</span>
          <span>Your draft comments on tasks will appear here</span>
        </div>
      </div>
    </>
  )

  const renderForms = (widget) => {
    const projectsWithForms = safeProjects.filter(p => p.formSettings)
    return (
      <>
        <div className="widget-header">
          <div className="widget-header-left">
            <h2 className="widget-title">📋 Forms</h2>
          </div>
          {renderWidgetMenuBtn(widget)}
        </div>
        <div className="widget-body">
          {projectsWithForms.length === 0 ? (
            <div className="widget-empty-state" style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, textAlign:'center', gap:'0.5rem', padding:'2rem 0'}}>
              <span style={{fontSize:'2rem'}}>📋</span>
              <span>Create forms in your projects to collect information</span>
            </div>
          ) : (
            projectsWithForms.map(p => (
              <div key={p.id} className="widget-task-row" style={{cursor:'pointer'}} onClick={() => setSelectedProject(p)}>
                <div className="widget-task-left">
                  <div className="widget-project-icon" style={{backgroundColor: p.color || '#4F46E5', width: 28, height: 28, borderRadius: 6}}>
                    <span style={{fontSize:'0.8rem'}}>{p.icon || '📋'}</span>
                  </div>
                  <span className="widget-task-title">{p.name} form</span>
                </div>
              </div>
            ))
          )}
        </div>
      </>
    )
  }

  // ========================
  // WIDGET MENU BUTTON
  // ========================
  const renderWidgetMenuBtn = (widget) => (
    <div style={{position:'relative'}} ref={openMenu === widget.id ? menuRef : null}>
      <button className="widget-menu-btn" onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === widget.id ? null : widget.id) }}>•••</button>
      {openMenu === widget.id && (
        <div className="widget-menu-dropdown" onClick={(e) => e.stopPropagation()}>
          <button
            className="widget-menu-item"
            onClick={() => toggleWidgetSize(widget.id, 'colSpan', widget.colSpan === 2 ? 1 : 2)}
          >
            {widget.colSpan === 2 ? '↔ Half width' : '↔ Full width'}
          </button>
          <button
            className="widget-menu-item"
            onClick={() => toggleWidgetSize(widget.id, 'rowSpan', widget.rowSpan === 2 ? 1 : 2)}
          >
            {widget.rowSpan === 2 ? '↕ Short' : '↕ Tall'}
          </button>
          <div className="widget-menu-divider" />
          <button className="widget-menu-item danger" onClick={() => removeWidget(widget.id)}>
            ✕ Remove widget
          </button>
        </div>
      )}
    </div>
  )

  // ========================
  // RENDER WIDGET CONTENT
  // ========================
  const renderWidgetContent = (widget) => {
    switch (widget.type) {
      case 'my-tasks': return renderMyTasks(widget)
      case 'projects': return renderProjects(widget)
      case 'assigned-tasks': return renderAssignedTasks(widget)
      case 'people': return renderPeople(widget)
      case 'notepad': return renderNotepad(widget)
      case 'goals': return renderGoals(widget)
      case 'charts': return renderCharts(widget)
      case 'draft-comments': return renderDraftComments(widget)
      case 'forms': return renderForms(widget)
      default: return <div className="widget-empty-state">Unknown widget type</div>
    }
  }

  // ========================
  // ACTIVE WIDGET TYPES (for picker)
  // ========================
  const activeWidgetTypes = widgetLayout.map(w => w.type)

  // ========================
  // RENDER
  // ========================
  return (
    <div className="dashboard-container">
      {/* HEADER */}
      <div className="dashboard-header">
        <div>
          <div className="dashboard-header-date">{dateStr}</div>
          <h1 className="dashboard-header-greeting">{greeting}, {user?.name || 'User'}</h1>
        </div>
        <div className="dashboard-header-actions">
          <button className="dashboard-header-btn">My week <span style={{fontSize:'0.6rem'}}>▼</span></button>
          <button className="dashboard-header-btn"><span style={{color:'var(--accent-success)'}}>✓</span> {myCompleted.length} tasks completed</button>
          <button className="dashboard-header-btn">👥 {peopleList.length} collaborators</button>
          <button className="dashboard-header-btn customize-btn" onClick={() => setShowWidgetPicker(true)}>
            ⚙ Customize
          </button>
        </div>
      </div>

      {/* GRID */}
      <div className={`dashboard-grid ${dragIndex !== null ? 'is-dragging' : ''}`}>
        {widgetLayout.map((widget, index) => (
          <div
            key={widget.id}
            className={`dashboard-widget ${widget.colSpan === 2 ? 'span-2' : ''} ${widget.rowSpan === 2 ? 'row-2' : 'row-1'} ${dragIndex === index ? 'widget-dragging' : ''} ${dragOverIndex === index && dragIndex !== index ? 'widget-drop-target' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            style={{
              border: dragOverIndex === index && dragIndex !== index ? '2px dashed var(--accent-primary)' : undefined,
              background: dragOverIndex === index && dragIndex !== index ? 'rgba(79, 70, 229, 0.04)' : undefined,
            }}
          >
            {/* Drag Handle */}
            <div className="widget-drag-handle">
              <div className="widget-drag-handle-dots">
                <span /><span /><span /><span /><span /><span />
              </div>
            </div>

            {/* Remove Button */}
            <button className="widget-remove-btn" onClick={() => removeWidget(widget.id)} title="Remove widget">✕</button>

            {/* Resize Handle */}
            <div
              className="widget-resize-handle"
              onMouseDown={(e) => {
                e.stopPropagation()
                // Toggle size on double click as a simple resize mechanic
              }}
              onDoubleClick={() => {
                const newColSpan = widget.colSpan === 2 ? 1 : 2
                toggleWidgetSize(widget.id, 'colSpan', newColSpan)
              }}
              title="Double-click to toggle width"
            />

            {/* Widget Content */}
            {renderWidgetContent(widget)}
          </div>
        ))}
      </div>

      {/* WIDGET PICKER MODAL */}
      {showWidgetPicker && (
        <div className="widget-picker-overlay" onClick={() => setShowWidgetPicker(false)}>
          <div className="widget-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="widget-picker-header">
              <h2>Add widget</h2>
              <button className="widget-picker-close" onClick={() => setShowWidgetPicker(false)}>✕</button>
            </div>
            <div className="widget-picker-body">
              <div className="widget-picker-grid">
                {WIDGET_REGISTRY.map(reg => {
                  const isActive = activeWidgetTypes.includes(reg.type)
                  return (
                    <div
                      key={reg.type}
                      className={`widget-picker-card ${isActive ? 'disabled' : ''}`}
                      onClick={() => !isActive && addWidget(reg.type)}
                    >
                      <div className="widget-picker-icon" style={{backgroundColor: reg.color}}>
                        {reg.icon}
                      </div>
                      <div className="widget-picker-info">
                        <h3>{reg.label}{isActive ? ' ✓' : ''}</h3>
                        <p>{reg.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

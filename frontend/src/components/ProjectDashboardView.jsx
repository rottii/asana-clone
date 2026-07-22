import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './ProjectDashboardView.css';

const ReactGridLayout = WidthProvider(GridLayout);

// ========================
// CHART REGISTRY — all available chart types
// ========================
const CHART_REGISTRY = [
  // Summary Metrics
  { type: 'number-completed', label: 'Total completed tasks', icon: '#️⃣', color: '#10B981', category: 'summary', description: 'Count of completed tasks' },
  { type: 'number-incomplete', label: 'Total incomplete tasks', icon: '#️⃣', color: '#6366F1', category: 'summary', description: 'Count of incomplete tasks' },
  { type: 'number-overdue', label: 'Total overdue tasks', icon: '#️⃣', color: '#EF4444', category: 'summary', description: 'Count of overdue tasks' },
  { type: 'number-total', label: 'Total tasks', icon: '#️⃣', color: '#8B5CF6', category: 'summary', description: 'Count of all tasks' },
  // Recommended / common
  { type: 'tasks-by-section', label: 'Tasks by section', icon: '📊', color: '#BFDBFE', category: 'recommended', description: 'Stacked bar chart of tasks per section' },
  { type: 'tasks-by-assignee', label: 'Tasks by assignee', icon: '👥', color: '#D1FAE5', category: 'recommended', description: 'Donut chart of task distribution by assignee' },
  { type: 'tasks-by-completion', label: 'Task completion', icon: '✅', color: '#BBF7D0', category: 'recommended', description: 'Completed vs incomplete overview' },
  // Status & progress
  { type: 'tasks-by-status', label: 'Tasks by status', icon: '🔵', color: '#E9D5FF', category: 'status', description: 'Pie chart of task completion status' },
  { type: 'overdue-tasks', label: 'Overdue tasks', icon: '⚠️', color: '#FECACA', category: 'status', description: 'Bar chart of overdue tasks per section' },
  { type: 'completion-over-time', label: 'Completion over time', icon: '📈', color: '#CFFAFE', category: 'status', description: 'Line chart of tasks completed over last 7 days' },
  // Workload & distribution
  { type: 'tasks-by-priority', label: 'Tasks by priority', icon: '🔺', color: '#FDE68A', category: 'workload', description: 'Donut chart of task priority distribution' },
  { type: 'upcoming-deadlines', label: 'Upcoming deadlines', icon: '📅', color: '#FED7AA', category: 'workload', description: 'Tasks due in the next 7 days per day' },
  { type: 'unassigned-tasks', label: 'Unassigned tasks', icon: '❓', color: '#E5E7EB', category: 'workload', description: 'Tasks without an assignee by section' },
];

const DEFAULT_CHARTS = [
  { i: 'num-completed', type: 'number-completed', x: 0, y: 0, w: 5, h: 5 },
  { i: 'num-incomplete', type: 'number-incomplete', x: 5, y: 0, w: 5, h: 5 },
  { i: 'num-overdue', type: 'number-overdue', x: 10, y: 0, w: 5, h: 5 },
  { i: 'num-total', type: 'number-total', x: 15, y: 0, w: 5, h: 5 },
  { i: 'tasks-by-section-default', type: 'tasks-by-section', x: 0, y: 5, w: 10, h: 12 },
  { i: 'tasks-by-assignee-default', type: 'tasks-by-assignee', x: 10, y: 5, w: 10, h: 12 },
];

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'];

export default function ProjectDashboardView({ selectedProject, showPicker, setShowPicker }) {
  // --- Chart layout state (localStorage per project) ---
  const storageKey = `proj-dash-layout-${selectedProject?.id}`;
  const [chartLayout, setChartLayout] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migration: If the layout doesn't use the 'i' property (old format), reset to defaults
        // Also if 'type' is missing due to a previous bug, reset to defaults
        if (parsed.length > 0 && (parsed[0].i === undefined || parsed.some(p => !p.type))) {
          return DEFAULT_CHARTS;
        }
        return parsed;
      }
    } catch { }
    return DEFAULT_CHARTS;
  });

  const [openMenu, setOpenMenu] = useState(null);
  const [isDraggingOrResizing, setIsDraggingOrResizing] = useState(false);
  const menuRef = useRef(null);

  // Persist layout
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(chartLayout)); } catch { }
  }, [chartLayout, storageKey]);

  // ========================
  // DATA COMPUTATION
  // ========================
  const {
    totalTasks, completedTasks, incompleteTasks,
    tasksBySection, tasksByAssignee, tasksByStatus,
    overdueTasks, completionOverTime, tasksByPriority,
    upcomingDeadlines, unassignedBySection, allTasks
  } = useMemo(() => {
    let total = 0, completed = 0, incomplete = 0;
    const bySection = [];
    const assigneeMap = {};
    const priorityMap = {};
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const overdueBySection = [];
    const unassignedMap = [];
    const tasks = [];

    selectedProject?.sections?.forEach(sec => {
      let secTotal = 0, secCompleted = 0, secOverdue = 0, secUnassigned = 0;

      sec.tasks?.forEach(task => {
        total++; secTotal++;
        tasks.push(task);

        if (task.isCompleted) { completed++; secCompleted++; }
        else { incomplete++; }

        // Overdue
        if (!task.isCompleted && task.dueDate && new Date(task.dueDate) < now) secOverdue++;

        // Unassigned
        if (!task.assigneeId) secUnassigned++;

        // Assignee
        const name = task.assignee?.name || 'Unassigned';
        assigneeMap[name] = (assigneeMap[name] || 0) + 1;

        // Priority
        const p = task.priority || 'MEDIUM';
        priorityMap[p] = (priorityMap[p] || 0) + 1;
      });

      bySection.push({ name: sec.name, Completed: secCompleted, Incomplete: secTotal - secCompleted });
      overdueBySection.push({ name: sec.name, Overdue: secOverdue });
      unassignedMap.push({ name: sec.name, Unassigned: secUnassigned });
    });

    const byAssignee = Object.entries(assigneeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const byPriority = Object.entries(priorityMap).map(([name, value]) => ({ name: name.charAt(0) + name.slice(1).toLowerCase(), value }));

    // Status pie
    const byStatus = [
      { name: 'Completed', value: completed, color: '#10B981' },
      { name: 'Incomplete', value: incomplete, color: '#6366F1' },
    ].filter(d => d.value > 0);

    // Completion over time (last 7 days)
    const completionDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const cnt = tasks.filter(t => {
        if (!t.completedAt) return false;
        const ct = new Date(t.completedAt); ct.setHours(0, 0, 0, 0);
        return ct.getTime() === d.getTime();
      }).length;
      completionDays.push({ name: label, Completed: cnt });
    }

    // Upcoming deadlines (next 7 days)
    const upcoming = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i); d.setHours(0, 0, 0, 0);
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const cnt = tasks.filter(t => {
        if (t.isCompleted || !t.dueDate) return false;
        const dd = new Date(t.dueDate); dd.setHours(0, 0, 0, 0);
        return dd.getTime() === d.getTime();
      }).length;
      upcoming.push({ name: label, Due: cnt });
    }

    return {
      totalTasks: total, completedTasks: completed, incompleteTasks: incomplete,
      tasksBySection: bySection, tasksByAssignee: byAssignee, tasksByStatus: byStatus,
      overdueTasks: overdueBySection, completionOverTime: completionDays,
      tasksByPriority: byPriority, upcomingDeadlines: upcoming,
      unassignedBySection: unassignedMap, allTasks: tasks
    };
  }, [selectedProject]);

  const overdueTotalCount = useMemo(() => allTasks.filter(t => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return !t.isCompleted && t.dueDate && new Date(t.dueDate) < now;
  }).length, [allTasks]);

  // ========================
  // CHART RENDERERS
  // ========================
  const tooltipStyle = {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    padding: '8px 12px'
  };

  const renderDynamicChart = (config) => {
    if (!config) return null;
    const { chartStyle, xAxis, dataLabels } = config;
    let data = [];
    let emptyMsg = 'No data';
    let emptyIcon = '📊';

    if (xAxis === 'section') { data = tasksBySection; emptyMsg = 'No sections to display'; }
    else if (xAxis === 'assignee') { data = tasksByAssignee; emptyMsg = 'No assignee data'; emptyIcon = '👥'; }
    else if (xAxis === 'status') { data = tasksByStatus; emptyMsg = 'No task data'; emptyIcon = '🔵'; }
    else if (xAxis === 'priority') { data = tasksByPriority; emptyMsg = 'No priority data'; emptyIcon = '🔺'; }
    else if (xAxis === 'due_date') { data = upcomingDeadlines; emptyMsg = 'No deadlines'; emptyIcon = '📅'; }
    
    let normalizedData = data.map(item => {
      let val = item.value;
      if (val === undefined) {
         if (xAxis === 'section') val = item.Completed + item.Incomplete;
         else if (xAxis === 'due_date') val = item.Due;
         else if (xAxis === 'unassigned') val = item.Unassigned;
         else val = 0;
      }
      return { name: item.name, value: val, color: item.color };
    });

    if (normalizedData.length === 0) {
      return <div className="proj-dash-empty"><span className="proj-dash-empty-icon">{emptyIcon}</span>{emptyMsg}</div>;
    }

    if (chartStyle === 'number') {
      const sum = normalizedData.reduce((acc, curr) => acc + curr.value, 0);
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div style={{ fontSize: '3.5rem', fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>{sum}</div>
        </div>
      );
    }

    if (chartStyle === 'donut' || chartStyle === 'pie') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={normalizedData} cx="50%" cy="50%" innerRadius={chartStyle === 'donut' ? "38%" : 0} outerRadius="65%" paddingAngle={chartStyle === 'donut' ? 4 : 0} dataKey="value"
                 label={dataLabels ? ({ name, value }) => `${name}: ${value}` : false} labelLine={false}>
              {normalizedData.map((entry, i) => <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />)}
            </Pie>
            <RechartsTooltip contentStyle={tooltipStyle} />
            <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '0.78rem' }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartStyle === 'bar' || chartStyle === 'stacked-bar') {
      if (xAxis === 'section' && chartStyle === 'stacked-bar') {
          return (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tasksBySection} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '0.78rem' }} />
                <Bar dataKey="Completed" stackId="a" fill="#10B981" radius={[0, 0, 4, 4]} label={dataLabels ? { position: 'top', fill: 'var(--text-secondary)', fontSize: 11 } : false} />
                <Bar dataKey="Incomplete" stackId="a" fill="#E5E7EB" radius={[4, 4, 0, 0]} label={dataLabels ? { position: 'top', fill: 'var(--text-secondary)', fontSize: 11 } : false} />
              </BarChart>
            </ResponsiveContainer>
          );
      }
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={normalizedData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
            <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill="#6366F1" radius={[4, 4, 0, 0]} label={dataLabels ? { position: 'top', fill: 'var(--text-secondary)', fontSize: 11 } : false} >
               {normalizedData.map((entry, i) => <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartStyle === 'line' || chartStyle === 'area') {
      return (
          <ResponsiveContainer width="100%" height="100%">
            {chartStyle === 'line' ? (
              <LineChart data={normalizedData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="value" stroke="#06B6D4" strokeWidth={3} dot={{ r: 4, fill: '#06B6D4', strokeWidth: 0 }} label={dataLabels ? { position: 'top', fill: 'var(--text-secondary)', fontSize: 11 } : false} />
              </LineChart>
            ) : (
              <AreaChart data={normalizedData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="completionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="value" stroke="#06B6D4" strokeWidth={3} fillOpacity={1} fill="url(#completionGrad)" label={dataLabels ? { position: 'top', fill: 'var(--text-secondary)', fontSize: 11 } : false} />
              </AreaChart>
            )}
          </ResponsiveContainer>
      );
    }
    return <div className="proj-dash-empty">Unsupported chart style</div>;
  };

  const renderChart = (type, config = null) => {
    if (config) {
      return renderDynamicChart(config);
    }

    switch (type) {
      case 'number-completed':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div style={{ fontSize: '3.5rem', fontWeight: 300, color: '#10B981', lineHeight: 1 }}>{completedTasks}</div>
          </div>
        );
      case 'number-incomplete':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div style={{ fontSize: '3.5rem', fontWeight: 300, color: '#6366F1', lineHeight: 1 }}>{incompleteTasks}</div>
          </div>
        );
      case 'number-total':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div style={{ fontSize: '3.5rem', fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>{totalTasks}</div>
          </div>
        );
      case 'number-overdue':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div style={{ fontSize: '3.5rem', fontWeight: 300, color: overdueTotalCount > 0 ? '#EF4444' : 'var(--text-primary)', lineHeight: 1 }}>{overdueTotalCount}</div>
          </div>
        );

      case 'tasks-by-section':
        return tasksBySection.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tasksBySection} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={tooltipStyle} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '0.78rem' }} />
              <Bar dataKey="Completed" stackId="a" fill="#10B981" radius={[0, 0, 4, 4]} />
              <Bar dataKey="Incomplete" stackId="a" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="proj-dash-empty"><span className="proj-dash-empty-icon">📊</span>No sections to display</div>;

      case 'tasks-by-assignee':
        return tasksByAssignee.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={tasksByAssignee} cx="50%" cy="50%" innerRadius="38%" outerRadius="65%" paddingAngle={4} dataKey="value">
                {tasksByAssignee.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '0.78rem' }} />
            </PieChart>
          </ResponsiveContainer>
        ) : <div className="proj-dash-empty"><span className="proj-dash-empty-icon">👥</span>No assignee data</div>;

      case 'tasks-by-completion':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '2rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 300, color: '#10B981' }}>{completedTasks}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Completed</div>
            </div>
            <div style={{ width: 1, height: 60, background: 'var(--border-color)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 300, color: '#6366F1' }}>{incompleteTasks}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Incomplete</div>
            </div>
            <div style={{ width: 1, height: 60, background: 'var(--border-color)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 300, color: 'var(--text-primary)' }}>{totalTasks}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total</div>
            </div>
          </div>
        );

      case 'tasks-by-status':
        return tasksByStatus.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={tasksByStatus} cx="50%" cy="50%" innerRadius="35%" outerRadius="60%" paddingAngle={5} dataKey="value"
                label={({ name, value }) => `${name}: ${value}`} labelLine={false}
              >
                {tasksByStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '0.78rem' }} />
            </PieChart>
          </ResponsiveContainer>
        ) : <div className="proj-dash-empty"><span className="proj-dash-empty-icon">🔵</span>No task data</div>;

      case 'overdue-tasks':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overdueTasks} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={tooltipStyle} />
              <Bar dataKey="Overdue" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'completion-over-time':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={completionOverTime} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="completionGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="Tasks" stroke="#10B981" strokeWidth={2} fill="url(#completionGrad)" dot={{ r: 3, fill: '#10B981' }} />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'tasks-by-priority':
        return tasksByPriority.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={tasksByPriority} cx="50%" cy="50%" innerRadius="35%" outerRadius="60%" paddingAngle={4} dataKey="value">
                {tasksByPriority.map((entry, i) => {
                  const pColors = { High: '#EF4444', Medium: '#F59E0B', Low: '#10B981', None: '#9CA3AF' };
                  return <Cell key={i} fill={pColors[entry.name] || COLORS[i % COLORS.length]} />;
                })}
              </Pie>
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '0.78rem' }} />
            </PieChart>
          </ResponsiveContainer>
        ) : <div className="proj-dash-empty"><span className="proj-dash-empty-icon">🔺</span>No priority data</div>;

      case 'upcoming-deadlines':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={upcomingDeadlines} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
              <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'unassigned-tasks':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={unassignedBySection} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
              <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={tooltipStyle} />
              <Bar dataKey="Unassigned" fill="#9CA3AF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return <div className="proj-dash-empty"><span className="proj-dash-empty-icon">📊</span>Unknown chart type</div>;
    }
  };

  // ========================
  // LAYOUT OPERATIONS
  // ========================
  const [addChartModal, setAddChartModal] = useState(null); // null or { chartStyle, xAxis, yAxis, yMetric, dataLabels, filters }

  // Available axis options derived from project data
  const axisOptions = useMemo(() => {
    const opts = [
      { value: 'section', label: 'Section' },
      { value: 'assignee', label: 'Assignee' },
      { value: 'status', label: 'Completion status' },
      { value: 'priority', label: 'Priority' },
      { value: 'due_date', label: 'Due date' },
    ];
    // Add custom fields from the project
    selectedProject?.customFields?.forEach(cf => {
      if (cf.fieldType === 'SINGLE_SELECT' || cf.fieldType === 'MULTI_SELECT') {
        opts.push({ value: `cf_${cf.id}`, label: cf.fieldName });
      }
    });
    return opts;
  }, [selectedProject]);

  const CHART_STYLES = [
    { value: 'bar', label: 'Bar', icon: '📊' },
    { value: 'stacked-bar', label: 'Stacked bar', icon: '📊' },
    { value: 'line', label: 'Line', icon: '📈' },
    { value: 'area', label: 'Area', icon: '📉' },
    { value: 'donut', label: 'Donut', icon: '🍩' },
    { value: 'number', label: 'Number', icon: '#️⃣' },
  ];

  const Y_METRICS = [
    { value: 'count', label: 'Count' },
  ];

  const openAddChartModal = () => {
    setAddChartModal({
      chartStyle: 'bar',
      xAxis: 'section',
      yAxis: 'task',
      yMetric: 'count',
      dataLabels: true,
      filters: [],
    });
  };

  const openAddTextWidget = () => {
    const newChart = {
      i: 'text-' + Date.now(),
      type: 'text-widget',
      x: 0,
      y: Infinity,
      w: 10,
      h: 6,
    };
    setChartLayout(prev => [...prev, newChart]);
  };

  const handleAddChartConfirm = () => {
    const newChart = {
      i: 'chart-' + Date.now(),
      type: 'dynamic',
      config: addChartModal,
      x: 0,
      y: Infinity,
      w: addChartModal.chartStyle === 'number' ? 5 : 10,
      h: addChartModal.chartStyle === 'number' ? 5 : 12,
    };
    setChartLayout(prev => [...prev, newChart]);
    setAddChartModal(null);
  };

  const removeChart = (chartId) => {
    setChartLayout(prev => prev.filter(c => c.i !== chartId));
    setOpenMenu(null);
  };

  const toggleSize = (chartId, prop, val) => {
    setChartLayout(prev => prev.map(c => c.i === chartId ? { ...c, [prop]: val } : c));
    setOpenMenu(null);
  };

  // Click outside menu
  useEffect(() => {
    const handler = (e) => {
      if (openMenu && menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  // Listen for custom events from parent (KanbanBoard dropdown)
  useEffect(() => {
    const handleOpenChart = () => openAddChartModal();
    const handleOpenText = () => openAddTextWidget();
    window.addEventListener('openAddChartModal', handleOpenChart);
    window.addEventListener('openAddTextWidget', handleOpenText);
    return () => {
      window.removeEventListener('openAddChartModal', handleOpenChart);
      window.removeEventListener('openAddTextWidget', handleOpenText);
    };
  }, []);

  // ========================
  // CARD MENU
  // ========================
  const renderCardMenu = (chart) => (
    <div style={{ position: 'relative' }} ref={openMenu === chart.i ? menuRef : null}>
      <button className="proj-dash-card-menu-btn" onMouseDown={(e) => { e.stopPropagation(); setOpenMenu(openMenu === chart.i ? null : chart.i); }}>
        •••
      </button>
      {openMenu === chart.i && (
        <div className="proj-dash-card-menu" onMouseDown={(e) => e.stopPropagation()}>
          <button className="proj-dash-card-menu-item" onClick={() => toggleSize(chart.i, 'w', chart.w === 20 ? 10 : 20)}>
            {chart.w === 20 ? '↔ Half width' : '↔ Full width'}
          </button>
          <button className="proj-dash-card-menu-item" onClick={() => toggleSize(chart.i, 'h', chart.h === 12 ? 6 : 12)}>
            {chart.h === 12 ? '↕ Standard height' : '↕ Tall'}
          </button>
          <div className="proj-dash-card-menu-divider" />
          <button className="proj-dash-card-menu-item danger" onClick={() => removeChart(chart.i)}>
            ✕ Remove chart
          </button>
        </div>
      )}
    </div>
  );

  // Chart label lookup
  const getChartLabel = (chart) => {
    if (chart.type === 'text-widget') return 'Text';
    if (chart.type === 'dynamic') {
      const styleLabel = CHART_STYLES.find(s => s.value === chart.config?.chartStyle)?.label || 'Chart';
      return styleLabel;
    }
    return CHART_REGISTRY.find(r => r.type === chart.type)?.label || chart.type;
  };
  const getChartDesc = (chart) => {
    if (chart.type === 'text-widget') return 'A text block for notes and descriptions';
    if (chart.type === 'dynamic') {
        const xLabel = axisOptions.find(o => o.value === chart.config?.xAxis)?.label || chart.config?.xAxis;
        return `Total tasks by ${xLabel.toLowerCase()}`;
    }
    return CHART_REGISTRY.find(r => r.type === chart.type)?.description || '';
  };

  // Generate preview chart title based on config
  const getPreviewTitle = (config) => {
    if (!config) return '';
    const xLabel = axisOptions.find(o => o.value === config.xAxis)?.label || config.xAxis;
    return `Total tasks by ${xLabel.toLowerCase()}`;
  };

  // ========================
  // RENDER
  // ========================
  return (
    <div className="proj-dash-container">

      {/* Grid Wrapper */}
      <div className="proj-dash-grid-wrapper">
        {/* Background grid for visual guidance */}
        <div className={`proj-dash-bg-grid ${isDraggingOrResizing ? 'visible' : ''}`}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="proj-dash-bg-column" />
          ))}
        </div>

        {/* Chart Grid */}
        <ReactGridLayout
          className={`proj-dash-chart-grid ${isDraggingOrResizing ? 'is-dragging' : ''}`}
          layout={chartLayout}
          cols={20}
          rowHeight={20}
          margin={[20, 20]}
          onLayoutChange={(layout) => {
            setChartLayout(prev => layout.map(l => {
              const existing = prev.find(p => p.i === l.i);
              return existing ? { ...existing, ...l } : l;
            }));
          }}
          onDragStart={() => setIsDraggingOrResizing(true)}
          onDragStop={() => setIsDraggingOrResizing(false)}
          onResizeStart={() => setIsDraggingOrResizing(true)}
          onResizeStop={() => setIsDraggingOrResizing(false)}
          draggableHandle=".proj-dash-card-drag-handle"
          resizeHandles={['e', 's', 'se', 'w', 'sw']}
        >
          {chartLayout.map((chart) => (
            <div key={chart.i} data-grid={chart} className="proj-dash-chart-card">
              {/* Drag handle */}
              <div className="proj-dash-card-drag-handle">
                <div className="proj-dash-card-drag-dots">
                  <span /><span /><span /><span /><span /><span />
                </div>
              </div>

              {/* Remove button */}
              <button className="proj-dash-card-remove" onMouseDown={(e) => { e.stopPropagation(); removeChart(chart.i); }} title="Remove chart">✕</button>

              {/* Header */}
              <div className="proj-dash-card-header">
                <div>
                  <h3 className="proj-dash-card-title">{getChartLabel(chart)}</h3>
                  <div className="proj-dash-card-subtitle">{getChartDesc(chart)}</div>
                </div>
                {renderCardMenu(chart)}
              </div>

              {/* Chart */}
              <div className="proj-dash-chart-area">
                {chart.type === 'text-widget' ? (
                  <div className="proj-dash-text-widget">
                    <textarea 
                      className="proj-dash-text-widget-editor" 
                      placeholder="Type your notes or description here..." 
                    />
                  </div>
                ) : (
                  renderChart(chart.type, chart.config)
                )}
              </div>
            </div>
          ))}
        </ReactGridLayout>

        {/* Empty state when no charts */}
        {chartLayout.length === 0 && (
          <div className="proj-dash-chart-card" style={{ alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', background: 'transparent', boxShadow: 'none', cursor: 'pointer', minHeight: '300px' }} onClick={openAddChartModal}>
            <div className="proj-dash-empty">
              <span className="proj-dash-empty-icon">📊</span>
              <span>No charts added yet</span>
              <button className="proj-dash-add-btn" style={{ marginTop: '0.5rem' }}>
                <span className="plus-icon">+</span> Add widget
              </button>
            </div>
          </div>
        )}
      </div>
      {/* End Grid Wrapper */}


      {/* ========== ADD CHART MODAL (Asana style) ========== */}
      {addChartModal && (
        <div className="proj-dash-picker-overlay" onClick={() => setAddChartModal(null)}>
          <div className="add-chart-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="add-chart-modal-header">
              <h2>Add chart</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button className="add-chart-modal-dots">•••</button>
                <button className="proj-dash-picker-close" onClick={() => setAddChartModal(null)}>✕</button>
              </div>
            </div>

            {/* Body: Preview + Sidebar */}
            <div className="add-chart-modal-body">
              {/* Left: Live Preview */}
              <div className="add-chart-modal-preview">
                <h3 className="add-chart-preview-title">{getPreviewTitle(addChartModal)}</h3>
                <div className="add-chart-preview-chart">
                  {renderChart(null, addChartModal)}
                </div>
              </div>

              {/* Right: Configuration Sidebar */}
              <div className="add-chart-modal-sidebar">
                {/* Chart details */}
                <div className="add-chart-section">
                  <h4 className="add-chart-section-title">Chart details</h4>

                  {/* Work / Time entries toggle */}
                  <div className="add-chart-toggle-group">
                    <button className="add-chart-toggle active">Work</button>
                    <button className="add-chart-toggle" disabled>Time entries</button>
                  </div>

                  {/* Chart style */}
                  <label className="add-chart-label">Chart style</label>
                  <div className="add-chart-select-wrap">
                    <select
                      className="add-chart-select"
                      value={addChartModal.chartStyle}
                      onChange={(e) => setAddChartModal(prev => ({ ...prev, chartStyle: e.target.value }))}
                    >
                      {CHART_STYLES.map(s => (
                        <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Chart data */}
                <div className="add-chart-section">
                  <h4 className="add-chart-section-title">Chart data</h4>

                  <label className="add-chart-label">X-axis</label>
                  <div className="add-chart-select-wrap">
                    <select
                      className="add-chart-select"
                      value={addChartModal.xAxis}
                      onChange={(e) => setAddChartModal(prev => ({ ...prev, xAxis: e.target.value }))}
                    >
                      {axisOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <label className="add-chart-label">Y-axis</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="add-chart-select-wrap" style={{ flex: 1 }}>
                      <select className="add-chart-select" value="task" disabled>
                        <option value="task">Task</option>
                      </select>
                    </div>
                    <div className="add-chart-select-wrap" style={{ width: '100px' }}>
                      <select
                        className="add-chart-select"
                        value={addChartModal.yMetric}
                        onChange={(e) => setAddChartModal(prev => ({ ...prev, yMetric: e.target.value }))}
                      >
                        {Y_METRICS.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button className="add-chart-add-metric">+ Add metric ⌄</button>
                </div>

                {/* Filters */}
                <div className="add-chart-section">
                  <h4 className="add-chart-section-title">Filters</h4>
                  <button className="add-chart-add-metric">+ Add filter ⌄</button>
                </div>

                {/* Data annotations */}
                <div className="add-chart-section">
                  <h4 className="add-chart-section-title">Data annotations</h4>
                  <label className="add-chart-checkbox-label">
                    <input
                      type="checkbox"
                      checked={addChartModal.dataLabels}
                      onChange={(e) => setAddChartModal(prev => ({ ...prev, dataLabels: e.target.checked }))}
                    />
                    Data labels
                  </label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="add-chart-modal-footer">
              <button className="add-chart-cancel-btn" onClick={() => setAddChartModal(null)}>Cancel</button>
              <button className="add-chart-confirm-btn" onClick={handleAddChartConfirm}>Add chart</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

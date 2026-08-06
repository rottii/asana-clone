import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Label, LabelList
} from 'recharts';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './ProjectDashboardView.css';
import { apiFetch } from '../api';
import { getParsedCustomFields, getParsedGithubPRs, getGithubPRStatusLabel } from '../utils/customFields';

const ReactGridLayout = WidthProvider(GridLayout);

const CustomLollipopBar = (props) => {
  const { fill, x, y, width, height, value } = props;
  if (value === 0 || height === 0) return null;
  const centerX = x + width / 2;
  return (
    <g>
      <line x1={centerX} y1={y + height} x2={centerX} y2={y} stroke={fill} strokeWidth={2} />
      <circle cx={centerX} cy={y} r={5} fill={fill} />
    </g>
  );
};

const renderCustomStackedBarLabel = (props, data) => {
  const { x, y, width, height, index, dataKey, payload, value } = props;
  
  let actualValue = null;
  if (data && index !== undefined && data[index] !== undefined) {
    actualValue = data[index][dataKey];
  } else if (payload && payload[dataKey] !== undefined) {
    actualValue = payload[dataKey];
  } else if (Array.isArray(value)) {
    actualValue = value[1] - value[0];
  } else {
    actualValue = value;
  }
  
  if (!actualValue || actualValue === 0) return null;
  if (x === undefined || y === undefined || width === undefined || height === undefined) return null;
  
  return (
    <text x={x + width / 2} y={y + height / 2} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={500}>
      {actualValue}
    </text>
  );
};

const renderCustomizedPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
  if (value === 0) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="#111827" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {value}
    </text>
  );
};

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
  { type: 'burnup-chart', label: 'Burnup chart', icon: '🔥', color: '#FBCFE8', category: 'recommended', description: 'Cumulative completed tasks vs total tasks over time' },
  // Status & progress
  { type: 'tasks-by-status', label: 'Tasks by status', icon: '🔵', color: '#E9D5FF', category: 'status', description: 'Pie chart of task completion status' },
  { type: 'overdue-tasks', label: 'Overdue tasks', icon: '⚠️', color: '#FECACA', category: 'status', description: 'Bar chart of overdue tasks per section' },
  { type: 'completion-over-time', label: 'Completion over time', icon: '📈', color: '#CFFAFE', category: 'status', description: 'Line chart of tasks completed over last 7 days' },
  // Workload & distribution
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

const dateFieldOptions = [
  { value: 'date_due', label: 'Due date' },
  { value: 'date_created', label: 'Creation date' },
  { value: 'date_completed', label: 'Completion date' },
];

const XAxisCustomDropdown = ({ value, onChange, disabled, axisOptions, customFieldOptions, dateFieldOptions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredSubmenu, setHoveredSubmenu] = useState(null);
  const [submenuRect, setSubmenuRect] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && !e.target.closest('.custom-dropdown-submenu')) {
        setIsOpen(false);
        setHoveredSubmenu(null);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const selectedLabel = axisOptions.find(o => o.value === value)?.label ||
    customFieldOptions.find(c => c.value === value)?.label ||
    dateFieldOptions?.find(c => c.value === value)?.label ||
    (value === 'time' ? 'Time' : value);

  if (disabled) {
    return (
      <div className="add-chart-select-wrap">
        <select className="add-chart-select" disabled value={value}>
          <option>{selectedLabel}</option>
        </select>
      </div>
    );
  }

  return (
    <div className="custom-dropdown-container" ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div
        className="add-chart-select"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedLabel}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>▼</span>
      </div>

      {isOpen && (
        <div className="custom-dropdown-menu" style={{ position: 'absolute', top: '100%', left: 0, minWidth: '200px', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, marginTop: '4px', padding: '8px 0' }}>
          {axisOptions.map((opt, idx) => {
            const hasSubmenu = opt.hasSubmenu;
            const isCustomFieldSelected = value && value.startsWith('cf_') && opt.value === 'custom_field';
            const isDateFieldSelected = value && value.startsWith('date_') && opt.value === 'date';
            const isSelected = value === opt.value || isCustomFieldSelected || isDateFieldSelected;

            return (
              <div
                key={opt.value}
                className="custom-dropdown-item"
                style={{ position: 'relative', padding: '8px 16px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', color: 'var(--text-primary)' }}
                onMouseEnter={(e) => {
                  setHoveredSubmenu(hasSubmenu ? opt.value : null);
                  if (hasSubmenu) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setSubmenuRect({ top: rect.top, left: rect.left, right: rect.right, width: rect.width });
                  }
                }}
                onMouseDown={(e) => {
                  if (!hasSubmenu) {
                    e.preventDefault();
                    onChange(opt.value);
                    setIsOpen(false);
                    setHoveredSubmenu(null);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '20px', display: 'inline-block' }}>{isSelected ? '✓' : ''}</span>
                  <span>{opt.label}</span>
                </div>
                {hasSubmenu && <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>▶</span>}

                {/* Flyout Submenu */}
                {hasSubmenu && hoveredSubmenu === opt.value && submenuRect && document.body ? createPortal(
                  <div
                    className="custom-dropdown-submenu"
                    style={{ position: 'fixed', left: submenuRect.right + 'px', top: (submenuRect.top - 8) + 'px', zIndex: 999999, minWidth: '180px', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '8px 0', color: 'var(--text-primary)' }}
                  >
                    {opt.value === 'custom_field' ? (
                      customFieldOptions.length === 0 ? (
                        <div style={{ padding: '8px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No custom fields</div>
                      ) : (
                        customFieldOptions.map(cf => (
                          <div
                            key={cf.value}
                            className="custom-dropdown-item custom-submenu-item"
                            style={{ padding: '8px 16px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', background: 'transparent', color: 'var(--text-primary)' }}
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent focus loss on inputs if any
                              onChange(cf.value);
                              setIsOpen(false);
                              setHoveredSubmenu(null);
                            }}
                          >
                            <span style={{ width: '20px', display: 'inline-block' }}>{value === cf.value ? '✓' : ''}</span>
                            <span style={{ marginRight: '8px', color: 'var(--text-secondary)' }}>{cf.icon}</span>
                            <span>{cf.label}</span>
                          </div>
                        ))
                      )
                    ) : opt.value === 'date' ? (
                      dateFieldOptions.map(df => (
                        <div
                          key={df.value}
                          className="custom-dropdown-item custom-submenu-item"
                          style={{ padding: '8px 16px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', background: 'transparent', color: 'var(--text-primary)' }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            onChange(df.value);
                            setIsOpen(false);
                            setHoveredSubmenu(null);
                          }}
                        >
                          <span style={{ width: '20px', display: 'inline-block' }}>{value === df.value ? '✓' : ''}</span>
                          <span>{df.label}</span>
                        </div>
                      ))
                    ) : null}
                  </div>,
                  document.body
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


export default function ProjectDashboardView({ selectedProject, showPicker, setShowPicker, isReadOnly }) {
  // --- Chart layout state ---
  const storageKey = `proj-dash-layout-${selectedProject?.id}`;
  const [chartLayout, setChartLayout] = useState(() => {
    // 1. Try to load from database first
    try {
      const dbSaved = selectedProject?.dashboardLayout;
      if (dbSaved) {
        const parsed = typeof dbSaved === 'string' ? JSON.parse(dbSaved) : dbSaved;
        if (parsed.length > 0 && (parsed[0].i !== undefined && parsed.every(p => p.type))) {
          return parsed;
        }
      }
    } catch { }

    // 2. Fallback to localStorage (migration)
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
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
  const saveTimerRef = useRef(null);

  // Persist layout to localStorage AND Database
  useEffect(() => {
    if (isReadOnly) return;
    try { localStorage.setItem(storageKey, JSON.stringify(chartLayout)); } catch { }
    
    // Save to Database
    if (selectedProject?.id) {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        apiFetch(`/api/projects/${selectedProject.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ dashboardLayout: chartLayout })
        })
        .catch(err => {
            console.error('Failed to save dashboard layout:', err);
        });
      }, 1000);
    }
  }, [chartLayout, storageKey, selectedProject?.id, isReadOnly]);

  const axisOptions = useMemo(() => {
    return [
      { value: 'assignee', label: 'Assignee' },
      { value: 'creator', label: 'Creator' },
      { value: 'section', label: 'Section' },
      { value: 'task_type', label: 'Task type' },
      { value: 'status', label: 'Completion status' },
      { value: 'due_date_status', label: 'Due date status' },
      { value: 'date', label: 'Date', hasSubmenu: true },
      { value: 'custom_field', label: 'Custom field', hasSubmenu: true },
    ];
  }, []);

  const customFieldOptions = useMemo(() => {
    const opts = [];
    const fields = getParsedCustomFields(selectedProject);
    if (!fields || fields.length === 0) return opts;

    const getCustomFieldIcon = (fieldType) => {
      switch (fieldType) {
        case 'DATE':
        case 'DATE_TIME':
          return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;
        case 'PEOPLE':
          return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle><path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path></svg>;
        case 'CHECKBOX':
          return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><polyline points="9 11 12 14 22 4"></polyline></svg>;
        case 'NUMBER':
        case 'TIME':
          return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
        default:
          return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="8 10 12 14 16 10"></polyline></svg>;
      }
    };

    fields.forEach(cf => {
      opts.push({
        value: `cf_${cf.id}`,
        label: cf.name || cf.fieldName || cf.title,
        icon: getCustomFieldIcon(cf.fieldType)
      });
    });
    return opts;
  }, [selectedProject]);

  // ========================
  // DATA COMPUTATION
  // ========================
  const {
    totalTasks, completedTasks, incompleteTasks,
    tasksBySection, tasksByAssignee, tasksByStatus,
    tasksByCreator, tasksByType,
    overdueTasks, completionOverTime,
    upcomingDeadlines, unassignedBySection, customFieldData, burnupOverTime, allTasks,
    dueStatusData
  } = useMemo(() => {
    let total = 0, completed = 0, incomplete = 0;
    const bySection = [];
    const assigneeMap = {};
    const creatorMap = {};
    const typeMap = {};
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const overdueBySection = [];
    const unassignedMap = [];
    const tasks = [];
    const customFieldCounts = {};

    getParsedCustomFields(selectedProject).forEach(cf => {
      customFieldCounts[cf.id] = {};
    });

    selectedProject?.sections?.forEach(sec => {
      let secTotal = 0, secCompleted = 0, secOverdue = 0, secUnassigned = 0;

      sec.tasks?.forEach(task => {
        total++; secTotal++;
        tasks.push({ ...task, _sectionName: sec.name });

        if (task.isCompleted) { completed++; secCompleted++; }
        else { incomplete++; }

        // Overdue
        if (!task.isCompleted && task.dueDate && new Date(task.dueDate) < now) secOverdue++;

        // Unassigned
        if (!task.assigneeId) secUnassigned++;

        // Assignee
        const name = task.assignee?.name || 'Unassigned';
        if (!assigneeMap[name]) assigneeMap[name] = { Total: 0, Completed: 0 };
        assigneeMap[name].Total++;
        if (task.isCompleted) assigneeMap[name].Completed++;

        // Creator
        const creatorName = task.creator?.name || 'Unknown';
        if (!creatorMap[creatorName]) creatorMap[creatorName] = { Total: 0, Completed: 0 };
        creatorMap[creatorName].Total++;
        if (task.isCompleted) creatorMap[creatorName].Completed++;

        // Task Type
        const taskType = task.type || 'Task';
        if (!typeMap[taskType]) typeMap[taskType] = { Total: 0, Completed: 0 };
        typeMap[taskType].Total++;
        if (task.isCompleted) typeMap[taskType].Completed++;

        // Custom Fields
        let parsedCF = {};
        if (typeof task.customFields === 'string') {
          try { parsedCF = JSON.parse(task.customFields); } catch (e) { }
        } else if (task.customFields && typeof task.customFields === 'object') {
          parsedCF = task.customFields;
        }

        if (Array.isArray(parsedCF)) {
          parsedCF.forEach(cfVal => {
            if (customFieldCounts[cfVal.fieldId]) {
              const valName = cfVal.value || 'None';
              if (!customFieldCounts[cfVal.fieldId][valName]) customFieldCounts[cfVal.fieldId][valName] = { Total: 0, Completed: 0 };
              customFieldCounts[cfVal.fieldId][valName].Total++;
              if (task.isCompleted) customFieldCounts[cfVal.fieldId][valName].Completed++;
            }
          });
        } else {
          Object.entries(parsedCF).forEach(([fieldId, value]) => {
            if (customFieldCounts[fieldId]) {
              const valName = value || 'None';
              if (!customFieldCounts[fieldId][valName]) customFieldCounts[fieldId][valName] = { Total: 0, Completed: 0 };
              customFieldCounts[fieldId][valName].Total++;
              if (task.isCompleted) customFieldCounts[fieldId][valName].Completed++;
            }
          });
        }

        // Handle Github PR custom fields specifically since they live on task.githubPRs
        const prFields = getParsedCustomFields(selectedProject).filter(f => f.type === 'github_pr' || f.fieldType === 'github_pr');
        if (prFields.length > 0) {
          const prs = getParsedGithubPRs(task.githubPRs);
          const prVal = prs.length > 0 ? getGithubPRStatusLabel(prs[0]) : 'Empty';

          prFields.forEach(cf => {
            if (customFieldCounts[cf.id]) {
              if (!customFieldCounts[cf.id][prVal]) customFieldCounts[cf.id][prVal] = { Total: 0, Completed: 0 };
              customFieldCounts[cf.id][prVal].Total++;
              if (task.isCompleted) customFieldCounts[cf.id][prVal].Completed++;
            }
          });
        }

      });

      bySection.push({ name: sec.name, Completed: secCompleted, Incomplete: secTotal - secCompleted });
      overdueBySection.push({ name: sec.name, Overdue: secOverdue });
      unassignedMap.push({ name: sec.name, Unassigned: secUnassigned });
    });

    const overdueTasks = overdueBySection;
    const unassignedTasks = unassignedMap;
    const allTasks = tasks;

    // Burnup over time (last 14 days)
    const burnupOverTime = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(23, 59, 59, 999);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const totalToDate = tasks.filter(t => {
        const createDate = t.createdAt ? new Date(t.createdAt) : new Date(0);
        return createDate.getTime() <= d.getTime();
      }).length;

      const completedToDate = tasks.filter(t => {
        if (!t.isCompleted || !t.completedAt) return false;
        const compDate = new Date(t.completedAt);
        return compDate.getTime() <= d.getTime();
      }).length;

      burnupOverTime.push({ name: label, Total: totalToDate, Completed: completedToDate });
    }

    const customFieldData = {};
    Object.keys(customFieldCounts).forEach(cfId => {
      customFieldData[cfId] = Object.entries(customFieldCounts[cfId])
        .map(([name, data]) => ({ name, value: data.Total, Total: data.Total, Completed: data.Completed }))
        .sort((a, b) => b.value - a.value);
    });

    const byAssignee = Object.entries(assigneeMap).map(([name, data]) => ({ name, value: data.Total, Total: data.Total, Completed: data.Completed })).sort((a, b) => b.value - a.value);
    const byCreator = Object.entries(creatorMap).map(([name, data]) => ({ name, value: data.Total, Total: data.Total, Completed: data.Completed })).sort((a, b) => b.value - a.value);
    const byType = Object.entries(typeMap).map(([name, data]) => ({ name, value: data.Total, Total: data.Total, Completed: data.Completed })).sort((a, b) => b.value - a.value);

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
      const d = new Date();
      d.setDate(d.getDate() + i);
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const cnt = tasks.filter(t => !t.isCompleted && t.dueDate && new Date(t.dueDate).toDateString() === d.toDateString()).length;
      upcoming.push({ name: label, Due: cnt });
    }

    // Due Date Status
    let dsUpcoming = 0, dsOverdue = 0, dsUnscheduled = 0, dsCompleted = 0;
    const dsNow = new Date(); dsNow.setHours(0, 0, 0, 0);

    tasks.forEach(t => {
      if (t.isCompleted) {
        dsCompleted++;
      } else if (!t.dueDate) {
        dsUnscheduled++;
      } else {
        const dd = new Date(t.dueDate); dd.setHours(0, 0, 0, 0);
        if (dd < dsNow) {
          dsOverdue++;
        } else {
          dsUpcoming++;
        }
      }
    });

    const dueStatusData = [
      { name: 'Upcoming', value: dsUpcoming, color: '#A78BFA' },
      { name: 'Overdue', value: dsOverdue, color: '#EF4444' },
      { name: 'Unscheduled', value: dsUnscheduled, color: '#9CA3AF' },
      { name: 'Completed', value: dsCompleted, color: '#10B981' },
    ];

    return {
      totalTasks: total, completedTasks: completed, incompleteTasks: incomplete,
      tasksBySection: bySection, tasksByAssignee: byAssignee, tasksByStatus: byStatus,
      tasksByCreator: byCreator, tasksByType: byType,
      overdueTasks, completionOverTime: completionDays,
      upcomingDeadlines: upcoming,
      unassignedBySection: unassignedTasks, customFieldData, burnupOverTime, allTasks,
      dueStatusData
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

  const renderDynamicChart = (config, isPreview = false) => {
    if (!config) return null;
    const { chartStyle, xAxis, dataLabels } = config;
    let data = [];
    let emptyMsg = 'No data';
    let emptyIcon = '📊';

    let normalizedData = [];

    if (xAxis === 'time') { data = burnupOverTime; emptyMsg = 'No time data'; emptyIcon = '🕒'; }
    else if (xAxis === 'section') { data = tasksBySection; emptyMsg = 'No sections to display'; }
    else if (xAxis === 'assignee') { data = tasksByAssignee; emptyMsg = 'No assignee data'; emptyIcon = '👥'; }
    else if (xAxis === 'status') { data = tasksByStatus; emptyMsg = 'No task data'; emptyIcon = '🔵'; }
    else if (xAxis === 'due_date_status') { data = dueStatusData; emptyMsg = 'No deadlines'; emptyIcon = '📅'; }
    else if (xAxis === 'creator') { data = tasksByCreator; emptyMsg = 'No creator data'; emptyIcon = '👤'; }
    else if (xAxis === 'task_type') { data = tasksByType; emptyMsg = 'No task type data'; emptyIcon = '📝'; }
    else if (xAxis.startsWith('date_')) {
      const gran = config.timeGranularity || 'day';
      const formatGroup = (date) => {
        if (!date) return null;
        const d = new Date(date);
        if (isNaN(d.getTime())) return null;
        if (gran === 'day') return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (gran === 'week') {
          const sw = new Date(d);
          sw.setDate(d.getDate() - d.getDay());
          return `${String(sw.getDate()).padStart(2, '0')}/${String(sw.getMonth() + 1).padStart(2, '0')}`;
        }
        if (gran === 'month') return d.toLocaleDateString('en-US', { month: 'short' });
        if (gran === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
        if (gran === 'year') return `${d.getFullYear()}`;
        return null;
      };

      const sortedData = [];
      allTasks.forEach(t => {
        let dateVal = null;
        if (xAxis === 'date_due') dateVal = t.dueDate;
        else if (xAxis === 'date_created') dateVal = t.createdAt;
        else if (xAxis === 'date_completed') dateVal = t.completedAt;

        const groupLabel = formatGroup(dateVal);
        if (groupLabel) {
          const d = new Date(dateVal);
          let sortVal = 0;
          if (gran === 'day') sortVal = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          else if (gran === 'week') {
            const sw = new Date(d);
            sw.setDate(d.getDate() - d.getDay());
            sortVal = new Date(sw.getFullYear(), sw.getMonth(), sw.getDate()).getTime();
          }
          else if (gran === 'month') sortVal = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
          else if (gran === 'quarter') sortVal = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).getTime();
          else if (gran === 'year') sortVal = new Date(d.getFullYear(), 0, 1).getTime();
          
          let existing = sortedData.find(s => s.name === groupLabel);
          if (!existing) {
             existing = { name: groupLabel, value: 0, _sort: sortVal };
             sortedData.push(existing);
          }
          existing.value++;
        }
      });
      sortedData.sort((a, b) => a._sort - b._sort);
      data = sortedData;
      emptyMsg = 'No timeline data';
      emptyIcon = '📅';
    }
    else if (xAxis.startsWith('cf_')) {
      const cfId = xAxis.replace('cf_', '');
      data = customFieldData[cfId] || [];
      emptyMsg = 'No custom field data';
    }

    if (config.filters && config.filters.length > 0) {
      const statusFilter = config.filters.find(f => f.field === 'status');
      if (statusFilter && xAxis === 'status') {
        data = data.filter(d => d.name === statusFilter.value);
      }

      const overdueFilter = config.filters.find(f => f.field === 'overdue');
      if (overdueFilter) {
        data = [{ name: 'Overdue', value: overdueTotalCount, color: '#EF4444' }];
        emptyMsg = 'No overdue tasks';
        emptyIcon = '⚠️';
      }
    }

    if (chartStyle === 'burnup' || chartStyle === 'burndown') {
      normalizedData = data.map(item => {
        let tot = item.Total;
        let comp = item.Completed;
        if (tot === undefined) {
          if (xAxis === 'section') { tot = item.Completed + item.Incomplete; comp = item.Completed; }
          else { tot = item.value || 0; comp = item.Completed || 0; }
        }
        return { name: item.name, Total: tot, Completed: comp };
      });
    } else {
      normalizedData = data.map(item => {
        let val = item.value;
        if (val === undefined) {
          if (xAxis === 'section') val = item.Completed + item.Incomplete;
          else if (xAxis === 'due_date') val = item.Due;
          else if (xAxis === 'unassigned') val = item.Unassigned;
          else val = 0;
        }
        return { name: item.name, value: val, color: item.color };
      });
    }

    if (normalizedData.length === 0) {
      return <div className="proj-dash-empty"><span className="proj-dash-empty-icon">{emptyIcon}</span>{emptyMsg}</div>;
    }

    let stackedKeys = [];
    if (chartStyle === 'stacked-bar' && config.groupBy) {
      const gBy = config.groupBy;
      const gran = config.timeGranularity || 'day';
      
      const getTaskDimensionValue = (task, dim) => {
        if (!dim) return 'None';
        if (dim === 'assignee') return task.assignee?.name || 'Unassigned';
        if (dim === 'creator') return task.creator?.name || 'Unknown';
        if (dim === 'section') return task._sectionName || 'No section';
        if (dim === 'task_type') return task.type || 'Task';
        if (dim === 'status') return task.isCompleted ? 'Completed' : 'Incomplete';
        if (dim === 'due_date_status') {
          if (task.isCompleted) return 'Completed';
          if (!task.dueDate) return 'Unscheduled';
          const now = new Date(); now.setHours(0, 0, 0, 0);
          const dd = new Date(task.dueDate); dd.setHours(0, 0, 0, 0);
          return dd < now ? 'Overdue' : 'Upcoming';
        }
        if (dim.startsWith('date_')) {
          let dateVal = null;
          if (dim === 'date_due') dateVal = task.dueDate;
          else if (dim === 'date_created') dateVal = task.createdAt;
          else if (dim === 'date_completed') dateVal = task.completedAt;
          if (!dateVal) return 'None';
          const d = new Date(dateVal);
          if (isNaN(d.getTime())) return 'None';
          if (gran === 'day') return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (gran === 'week') {
            const sw = new Date(d); sw.setDate(d.getDate() - d.getDay());
            return `${String(sw.getDate()).padStart(2, '0')}/${String(sw.getMonth() + 1).padStart(2, '0')}`;
          }
          if (gran === 'month') return d.toLocaleDateString('en-US', { month: 'short' });
          if (gran === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
          if (gran === 'year') return `${d.getFullYear()}`;
          return 'None';
        }
        if (dim.startsWith('cf_')) {
          const cfId = dim.replace('cf_', '');
          let parsedCF = {};
          if (typeof task.customFields === 'string') {
            try { parsedCF = JSON.parse(task.customFields); } catch (e) { }
          } else if (task.customFields && typeof task.customFields === 'object') {
            parsedCF = task.customFields;
          }
          if (Array.isArray(parsedCF)) {
            const field = parsedCF.find(f => f.fieldId === cfId);
            return field?.value || 'None';
          } else {
            return parsedCF[cfId] || 'None';
          }
        }
        return 'Other';
      };

      const keys = new Set();
      normalizedData.forEach(nd => {
        const tasksInGroup = allTasks.filter(t => {
           const xVal = getTaskDimensionValue(t, xAxis);
           return xVal === nd.name;
        });

        tasksInGroup.forEach(t => {
           if (config.filters && config.filters.length > 0) {
             const statusFilter = config.filters.find(f => f.field === 'status');
             if (statusFilter && statusFilter.value !== (t.isCompleted ? 'Completed' : 'Incomplete')) return;
           }
           const gVal = getTaskDimensionValue(t, gBy);
           if (!nd[gVal]) nd[gVal] = 0;
           nd[gVal]++;
           keys.add(gVal);
        });
      });
      
      stackedKeys = Array.from(keys);
    }

    if (chartStyle === 'number') {
      const sum = normalizedData.reduce((acc, curr) => acc + curr.value, 0);
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
          <div style={{ fontSize: '3.5rem', fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>{sum}</div>
        </div>
      );
    }

    if (chartStyle === 'donut' || chartStyle === 'pie') {
      const sum = normalizedData.reduce((acc, curr) => acc + curr.value, 0);
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={normalizedData} cx="50%" cy="50%" innerRadius={chartStyle === 'donut' ? "38%" : 0} outerRadius="65%" paddingAngle={chartStyle === 'donut' ? 4 : 0} dataKey="value"
              label={dataLabels ? renderCustomizedPieLabel : false} labelLine={false} animationDuration={400} isAnimationActive={false}>
              {normalizedData.map((entry, i) => <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />)}
              {chartStyle === 'donut' && (
                <Label value={sum} position="center" fill="var(--text-primary)" fontSize={32} fontWeight={400} />
              )}
            </Pie>
            <RechartsTooltip contentStyle={tooltipStyle} />
            <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '0.78rem' }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartStyle === 'bar' || chartStyle === 'stacked-bar') {
      if (chartStyle === 'stacked-bar' && stackedKeys.length > 0) {
        const getGroupColor = (key, idx) => {
          if (key === 'Completed') return '#10B981';
          if (key === 'Incomplete') return '#6366F1';
          if (key === 'Overdue') return '#EF4444';
          if (key === 'Upcoming') return '#A78BFA';
          if (key === 'Unscheduled') return '#60A5FA';
          return COLORS[idx % COLORS.length];
        };

        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={normalizedData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
              <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={tooltipStyle} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '0.78rem' }} />
              {stackedKeys.map((key, idx) => (
                <Bar key={key} dataKey={key} stackId="a" fill={getGroupColor(key, idx)} animationDuration={400} isAnimationActive={false}>
                  {dataLabels && <LabelList dataKey={key} position="center" fill="#fff" fontSize={10} fontWeight={500} formatter={(val) => (val && val !== 0 ? val : '')} />}
                </Bar>
              ))}
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
            <Bar dataKey="value" fill="#6366F1" radius={[4, 4, 0, 0]} label={dataLabels ? { position: 'top', fill: 'var(--text-secondary)', fontSize: 11 } : false} animationDuration={400} isAnimationActive={false} >
              {normalizedData.map((entry, i) => <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartStyle === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={normalizedData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
            <RechartsTooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="value" stroke="#06B6D4" strokeWidth={3} dot={{ r: 4, fill: '#06B6D4', strokeWidth: 0 }} label={dataLabels ? { position: 'top', fill: 'var(--text-secondary)', fontSize: 11 } : false} animationDuration={400} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartStyle === 'burnup' || chartStyle === 'burndown') {
      const burnData = normalizedData.map(d => ({
        ...d,
        Remaining: d.Total - (d.Completed || 0)
      }));

      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={burnData} margin={{ top: 20, right: 10, left: -10, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} angle={-45} textAnchor="end" />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
            <RechartsTooltip contentStyle={tooltipStyle} />
            <>
              <Area type="monotone" dataKey="Total" stroke="none" fill="#EDE9FE" fillOpacity={1} label={dataLabels ? { position: 'top', fill: '#111827', stroke: '#EDE9FE', strokeWidth: 3, paintOrder: 'stroke', fontSize: 11, fontWeight: 'bold' } : false} animationDuration={400} isAnimationActive={false} />
              <Area type="monotone" dataKey={chartStyle === 'burnup' ? "Completed" : "Remaining"} stroke="none" fill="#8B5CF6" fillOpacity={1} label={dataLabels ? { position: 'center', fill: '#fff', stroke: '#8B5CF6', strokeWidth: 3, paintOrder: 'stroke', fontSize: 11, fontWeight: 'bold' } : false} animationDuration={400} isAnimationActive={false} />
            </>
          </AreaChart>
        </ResponsiveContainer>
      );
    }


    if (chartStyle === 'lollipop') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={normalizedData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
            <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={tooltipStyle} />
            <Bar dataKey="value" shape={<CustomLollipopBar />} label={dataLabels ? { position: 'top', fill: 'var(--text-secondary)', fontSize: 11 } : false} animationDuration={400} isAnimationActive={false} >
              {normalizedData.map((entry, i) => <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return <div className="proj-dash-empty">Unsupported chart style</div>;
  };

  const renderChart = (type, config = null) => {
    const isPreview = type === null;
    if (config) {
      return renderDynamicChart(config, isPreview);
    }

    switch (type) {
      case 'number-completed':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
            <div style={{ fontSize: '3.5rem', fontWeight: 300, color: '#10B981', lineHeight: 1 }}>{completedTasks}</div>
          </div>
        );
      case 'number-incomplete':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
            <div style={{ fontSize: '3.5rem', fontWeight: 300, color: '#6366F1', lineHeight: 1 }}>{incompleteTasks}</div>
          </div>
        );
      case 'number-total':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
            <div style={{ fontSize: '3.5rem', fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>{totalTasks}</div>
          </div>
        );
      case 'number-overdue':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
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
  const [viewChartModal, setViewChartModal] = useState(null); // null or chart object



  const CHART_STYLES = [
    { value: 'bar', label: 'Bar', icon: '📊' },
    { value: 'stacked-bar', label: 'Stacked bar', icon: '📊' },
    { value: 'line', label: 'Line', icon: '📈' },
    { value: 'donut', label: 'Donut', icon: '🍩' },
    { value: 'number', label: 'Number', icon: '#️⃣' },
    { value: 'burnup', label: 'Burnup', icon: '🔥' },
    { value: 'burndown', label: 'Burndown', icon: '📉' },
    { value: 'lollipop', label: 'Lollipop', icon: '🍭' },
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
      timeGranularity: 'day',
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

  const openEditChartModal = (chart) => {
    let config = chart.config;
    if (!config) {
      config = {
        chartStyle: chart.type.includes('number') ? 'number' :
          chart.type.includes('donut') || chart.type === 'tasks-by-assignee' ? 'donut' :
            chart.type.includes('status') ? 'pie' :
              chart.type.includes('over-time') ? 'line' : 'bar',
        xAxis: 'section',
        yMetric: 'count',
        dataLabels: true,
        filters: []
      };

      if (chart.type === 'tasks-by-assignee') config.xAxis = 'assignee';
      else if (chart.type === 'tasks-by-status') config.xAxis = 'status';
      else if (chart.type === 'number-overdue' || chart.type === 'upcoming-deadlines') {
        config.xAxis = 'date_due';
        if (chart.type === 'number-overdue') config.filters = [{ field: 'overdue', value: true }];
      }
      else if (chart.type.includes('number')) {
        config.xAxis = 'status';
        if (chart.type === 'number-completed') config.filters = [{ field: 'status', value: 'Completed' }];
        else if (chart.type === 'number-incomplete') config.filters = [{ field: 'status', value: 'Incomplete' }];
      }
      else if (chart.type === 'burnup-chart') {
        config.xAxis = 'time';
        config.chartStyle = 'burnup';
      }
      else if (chart.type === 'completion-over-time') {
        config.xAxis = 'date_completed';
      }
    }

    setAddChartModal({
      editChartId: chart.i,
      ...config
    });
    if (viewChartModal) setViewChartModal(null);
  };

  const handleAddChartConfirm = () => {
    if (addChartModal.editChartId) {
      setChartLayout(prev => prev.map(c =>
        c.i === addChartModal.editChartId ? { ...c, type: 'dynamic', config: addChartModal } : c
      ));
    } else {
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
    }
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
    <div className={`proj-dash-card-actions ${openMenu === chart.i ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      <button className="proj-dash-card-menu-btn" title="View larger" onMouseDown={(e) => { e.stopPropagation(); setViewChartModal(chart); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
      </button>
      {!isReadOnly && chart.type !== 'text-widget' && (
        <button className="proj-dash-card-menu-btn" title="Edit chart" onMouseDown={(e) => { e.stopPropagation(); openEditChartModal(chart); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        </button>
      )}
      {!isReadOnly && (
        <div style={{ position: 'relative' }} ref={openMenu === chart.i ? menuRef : null}>
          <button className="proj-dash-card-menu-btn" onMouseDown={(e) => { e.stopPropagation(); setOpenMenu(openMenu === chart.i ? null : chart.i); }}>
            •••
          </button>
          {openMenu === chart.i && (
            <div className="proj-dash-card-menu" onMouseDown={(e) => e.stopPropagation()}>
              <button className="proj-dash-card-menu-item danger" onClick={() => removeChart(chart.i)}>
                ✕ Remove chart
              </button>
            </div>
          )}
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
      const xLabel = axisOptions.find(o => o.value === chart.config?.xAxis)?.label || customFieldOptions.find(o => o.value === chart.config?.xAxis)?.label || chart.config?.xAxis;
      return `Total tasks by ${xLabel.toLowerCase()}`;
    }
    return CHART_REGISTRY.find(r => r.type === chart.type)?.description || '';
  };

  // Generate preview chart title based on config
  const getPreviewTitle = (config) => {
    if (!config) return '';
    const xLabel = axisOptions.find(o => o.value === config.xAxis)?.label || customFieldOptions.find(o => o.value === config.xAxis)?.label || config.xAxis;
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
          isDraggable={!isReadOnly}
          isResizable={!isReadOnly}
          onLayoutChange={(layout) => {
            if (isReadOnly) return;
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
              {!isReadOnly && (
                <div className="proj-dash-card-drag-handle">
                  <div className="proj-dash-card-drag-dots">
                    <span /><span /><span /><span /><span /><span />
                  </div>
                </div>
              )}

              {/* Remove button (Removed as per user request) */}

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
          <div className="proj-dash-chart-card" style={{ alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', background: 'transparent', boxShadow: 'none', cursor: isReadOnly ? 'default' : 'pointer', minHeight: '300px' }} onClick={!isReadOnly ? openAddChartModal : undefined}>
            <div className="proj-dash-empty">
              <span className="proj-dash-empty-icon">📊</span>
              <span>No charts added yet</span>
              {!isReadOnly && (
                <button className="proj-dash-add-btn" style={{ marginTop: '0.5rem' }}>
                  <span className="plus-icon">+</span> Add widget
                </button>
              )}
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
                      onChange={(e) => {
                        const newStyle = e.target.value;
                        setAddChartModal(prev => ({
                          ...prev,
                          chartStyle: newStyle,
                          xAxis: newStyle === 'burnup' || newStyle === 'burndown' ? 'time' : (prev.xAxis === 'time' ? 'section' : prev.xAxis)
                        }));
                      }}
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
                  <div className="add-chart-select-wrap" style={{ border: 'none', padding: 0 }}>
                    <XAxisCustomDropdown
                      value={addChartModal.chartStyle === 'burnup' || addChartModal.chartStyle === 'burndown' ? 'time' : addChartModal.xAxis}
                      onChange={(val) => setAddChartModal(prev => ({ ...prev, xAxis: val }))}
                      disabled={addChartModal.chartStyle === 'burnup' || addChartModal.chartStyle === 'burndown'}
                      axisOptions={axisOptions}
                      customFieldOptions={customFieldOptions}
                      dateFieldOptions={dateFieldOptions}
                    />
                  </div>

                {addChartModal.xAxis?.startsWith('date_') && (
                  <div className="add-chart-section">
                    <label className="add-chart-label">Granularity</label>
                    <div className="add-chart-select-wrap">
                      <select className="add-chart-select" value={addChartModal.timeGranularity || 'day'} onChange={(e) => setAddChartModal(prev => ({ ...prev, timeGranularity: e.target.value }))}>
                        <option value="day">Day</option>
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                        <option value="quarter">Quarter</option>
                        <option value="year">Year</option>
                      </select>
                      <span className="add-chart-select-arrow">▼</span>
                    </div>
                  </div>
                )}

                {addChartModal.chartStyle === 'stacked-bar' && (
                  <>
                    <label className="add-chart-label" style={{ marginTop: '16px' }}>Group by</label>
                    <div className="add-chart-select-wrap" style={{ border: 'none', padding: 0 }}>
                      <XAxisCustomDropdown
                        value={addChartModal.groupBy || 'due_date_status'}
                        onChange={(val) => setAddChartModal(prev => ({ ...prev, groupBy: val }))}
                        disabled={false}
                        axisOptions={axisOptions}
                        customFieldOptions={customFieldOptions}
                        dateFieldOptions={dateFieldOptions}
                      />
                    </div>
                  </>
                )}

                  <label className="add-chart-label" style={{ marginTop: '16px' }}>Y-axis</label>
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
              <button className="add-chart-confirm-btn" onClick={handleAddChartConfirm}>
                {addChartModal.editChartId ? 'Save chart' : 'Add chart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== VIEW CHART MODAL ========== */}
      {viewChartModal && (
        <div className="proj-dash-picker-overlay" onClick={() => setViewChartModal(null)}>
          <div className="add-chart-modal" style={{ width: '800px', maxWidth: '90vw', height: '80vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="add-chart-modal-header" style={{ padding: '16px 24px' }}>
              <h2>View chart</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!isReadOnly && viewChartModal.type !== 'text-widget' && (
                  <button className="proj-dash-picker-close" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Edit chart" onClick={() => openEditChartModal(viewChartModal)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                  </button>
                )}
                <button className="proj-dash-picker-close" onClick={() => setViewChartModal(null)}>✕</button>
              </div>
            </div>

            {/* Body */}
            <div className="add-chart-modal-body" style={{ flexDirection: 'column', padding: '24px', flex: 1, overflow: 'hidden' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '500', marginBottom: '24px' }}>
                {getChartDesc(viewChartModal)}
              </h3>
              <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                {viewChartModal.type === 'text-widget' ? (
                  <div style={{ fontSize: '1.1rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                    Text widgets cannot be enlarged.
                  </div>
                ) : (
                  renderChart(viewChartModal.type, viewChartModal.config)
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

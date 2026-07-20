import React, { useState, useEffect } from 'react';
import ProjectDashboardView from './ProjectDashboardView';
import ProjectCalendarView from './ProjectCalendarView';
import KanbanColumn from './KanbanColumn';

export default function MyTasks({ user, projects, token }) {
  const [activeTab, setActiveTab] = useState('List');

  // Filter, Sort, Group State
  const [activeFilters, setActiveFilters] = useState([]);
  const [activeSort, setActiveSort] = useState(null);
  const [activeGroup, setActiveGroup] = useState('Sections');
  const [groupOrder, setGroupOrder] = useState('Custom order');
  const [showEmptyGroups, setShowEmptyGroups] = useState(true);

  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [isGroupInnerDropdownOpen, setIsGroupInnerDropdownOpen] = useState(false);
  const [isGroupOrderMenuOpen, setIsGroupOrderMenuOpen] = useState(false);
  const [isGroupMoreMenuOpen, setIsGroupMoreMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const closeDropdowns = () => {
      setIsFilterDropdownOpen(false);
      setIsSortDropdownOpen(false);
      setIsGroupDropdownOpen(false);
      setIsGroupInnerDropdownOpen(false);
      setIsGroupOrderMenuOpen(false);
      setIsGroupMoreMenuOpen(false);
    };
    document.body.addEventListener('click', closeDropdowns);
    return () => document.body.removeEventListener('click', closeDropdowns);
  }, []);

  const getThisWeekRange = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { monday, sunday };
  };

  const getNextWeekRange = () => {
    const { monday } = getThisWeekRange();
    const nextMonday = new Date(monday);
    nextMonday.setDate(nextMonday.getDate() + 7);
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextSunday.getDate() + 6);
    nextSunday.setHours(23, 59, 59, 999);
    return { nextMonday, nextSunday };
  };

  const handleToggleFilter = (type) => {
    setActiveFilters(prev => {
      if (prev.includes(type)) return prev.filter(f => f !== type);
      let updated = [...prev, type];
      if (type === 'incomplete') updated = updated.filter(f => f !== 'completed');
      if (type === 'completed') updated = updated.filter(f => f !== 'incomplete');
      if (type === 'this-week') updated = updated.filter(f => f !== 'next-week');
      if (type === 'next-week') updated = updated.filter(f => f !== 'this-week');
      return updated;
    });
  };

  const applyTaskFilter = (tasks) => {
    if (!tasks) return [];
    return tasks.filter(task => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title?.toLowerCase().includes(query);
        if (!matchesTitle) return false;
      }
      if (activeFilters.includes('incomplete') && task.isCompleted) return false;
      if (activeFilters.includes('completed') && !task.isCompleted) return false;
      if (activeFilters.includes('this-week')) {
        if (!task.dueDate) return false;
        const due = new Date(task.dueDate);
        const { monday, sunday } = getThisWeekRange();
        if (due < monday || due > sunday) return false;
      }
      if (activeFilters.includes('next-week')) {
        if (!task.dueDate) return false;
        const due = new Date(task.dueDate);
        const { nextMonday, nextSunday } = getNextWeekRange();
        if (due < nextMonday || due > nextSunday) return false;
      }
      return true;
    });
  };

  const handleSortOptionClick = (field) => {
    setActiveSort(prev => {
      if (prev?.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
    setIsSortDropdownOpen(false);
  };

  const applyTaskSort = (tasks) => {
    if (!tasks || !activeSort) return tasks;
    return [...tasks].sort((a, b) => {
      let valA, valB;
      const { field, direction } = activeSort;
      const orderMultiplier = direction === 'asc' ? 1 : -1;

      switch (field) {
        case 'Start date': valA = a.startDate ? new Date(a.startDate).getTime() : 0; valB = b.startDate ? new Date(b.startDate).getTime() : 0; break;
        case 'Due date': valA = a.dueDate ? new Date(a.dueDate).getTime() : 0; valB = b.dueDate ? new Date(b.dueDate).getTime() : 0; break;
        case 'Assignee': valA = a.assignee?.name?.toLowerCase() || ''; valB = b.assignee?.name?.toLowerCase() || ''; break;
        case 'Created by': valA = a.creator?.name?.toLowerCase() || ''; valB = b.creator?.name?.toLowerCase() || ''; break;
        case 'Created on': valA = new Date(a.createdAt).getTime(); valB = new Date(b.createdAt).getTime(); break;
        case 'Last modified on': valA = new Date(a.updatedAt).getTime(); valB = new Date(b.updatedAt).getTime(); break;
        case 'Completed on': valA = a.completedAt ? new Date(a.completedAt).getTime() : (a.isCompleted ? 1 : 0); valB = b.completedAt ? new Date(b.completedAt).getTime() : (b.isCompleted ? 1 : 0); break;
        case 'Likes': valA = a.likes || 0; valB = b.likes || 0; break;
        case 'Alphabetical': valA = a.title?.toLowerCase() || ''; valB = b.title?.toLowerCase() || ''; break;
        case 'Project': valA = a.projectName?.toLowerCase() || ''; valB = b.projectName?.toLowerCase() || ''; break;
        default: return 0;
      }

      if (valA < valB) return -1 * orderMultiplier;
      if (valA > valB) return 1 * orderMultiplier;
      return 0;
    });
  };

  const allUserTasksRaw = [];
  const safeProjects = Array.isArray(projects) ? projects : [];
  safeProjects.forEach(p => {
    p.sections?.forEach(s => {
      s.tasks?.forEach(t => {
        if (t.assigneeId === user.id) {
          allUserTasksRaw.push({ ...t, projectName: p.name });
        }
      });
    });
  });

  const filteredTasks = applyTaskFilter(allUserTasksRaw);
  const sortedTasks = applyTaskSort(filteredTasks);

  let processedSections = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (activeGroup === 'Sections') {
    const recentlyAssigned = [];
    const doToday = [];
    const doNextWeek = [];
    const doLater = [];

    sortedTasks.forEach(t => {
      if (!t.dueDate) {
        recentlyAssigned.push(t);
      } else {
        const due = new Date(t.dueDate);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.round((due - now) / 86400000);
        
        if (diffDays <= 0) doToday.push(t);
        else if (diffDays <= 7) doNextWeek.push(t);
        else doLater.push(t);
      }
    });

    processedSections = [
      { id: 'recently-assigned', name: 'Recently assigned', tasks: recentlyAssigned, order: 1 },
      { id: 'do-today', name: 'Do today', tasks: doToday, order: 2 },
      { id: 'do-next-week', name: 'Do next week', tasks: doNextWeek, order: 3 },
      { id: 'do-later', name: 'Do later', tasks: doLater, order: 4 },
    ];
  } else {
    const getDateGroup = (dateString, typeName) => {
      if (!dateString) return { key: 'no-date', name: `No ${typeName.toLowerCase()}`, sortValue: 999999 };
      const now = new Date();
      now.setHours(0,0,0,0);
      const d = new Date(dateString);
      d.setHours(0,0,0,0);
      
      const diffTime = d - now;
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return { key: 'today', name: 'Today', sortValue: 0 };
      if (diffDays === -1) return { key: 'yesterday', name: 'Yesterday', sortValue: -1 };
      if (diffDays === 1) return { key: 'tomorrow', name: 'Tomorrow', sortValue: 1 };
      
      if (diffDays < -1 && diffDays >= -7) return { key: 'last-7', name: 'Last 7 days', sortValue: -7 };
      if (diffDays > 1 && diffDays <= 7) return { key: 'next-7', name: 'Next 7 days', sortValue: 7 };
      
      if (diffDays < -7 && diffDays >= -30) return { key: 'last-30', name: 'Last 30 days', sortValue: -30 };
      if (diffDays > 7 && diffDays <= 30) return { key: 'next-30', name: 'Next 30 days', sortValue: 30 };
      
      const monthYear = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const monthSortValue = d.getFullYear() * 12 + d.getMonth();
      const finalSortValue = diffDays < 0 ? -100000 + monthSortValue : 100000 + monthSortValue;
      
      return { key: monthYear.toLowerCase().replace(' ', '-'), name: monthYear, sortValue: finalSortValue };
    };

    const groupMap = {};
    const sortValueMap = {};

    sortedTasks.forEach(task => {
      let groupObj = { key: 'No Value', name: 'No Value', sortValue: 0 };
      
      if (activeGroup === 'Project') {
        groupObj = { key: task.projectName || 'No Project', name: task.projectName || 'No Project', sortValue: 0 };
      } else if (activeGroup === 'Assignee') {
        groupObj = { key: task.assignee?.name || 'Unassigned', name: task.assignee?.name || 'Unassigned', sortValue: 0 };
      } else if (activeGroup === 'Created by') {
        groupObj = { key: task.creator?.name || 'Unknown', name: task.creator?.name || 'Unknown', sortValue: 0 };
      } else if (activeGroup === 'Start date') {
        groupObj = getDateGroup(task.startDate, 'start date');
      } else if (activeGroup === 'Due date') {
        groupObj = getDateGroup(task.dueDate, 'due date');
      } else if (activeGroup === 'Created on') {
        groupObj = getDateGroup(task.createdAt, 'created on');
      } else if (activeGroup === 'Completed on') {
        if (!task.completedAt && !task.isCompleted) groupObj = { key: 'no-date', name: 'No completed on date', sortValue: 999999 };
        else if (!task.completedAt && task.isCompleted) groupObj = { key: 'completed-no-date', name: 'Completed (No date)', sortValue: 999998 };
        else groupObj = getDateGroup(task.completedAt, 'completed on');
      } else if (activeGroup === 'Last modified on') {
        groupObj = getDateGroup(task.updatedAt, 'last modified on');
      }
      
      const gName = groupObj.name;
      if (!groupMap[gName]) {
        groupMap[gName] = [];
        sortValueMap[gName] = groupObj.sortValue;
      }
      groupMap[gName].push(task);
    });

    processedSections = Object.entries(groupMap).map(([name, tasks], idx) => ({
      id: `group-${idx}`,
      name,
      tasks,
      sortValue: sortValueMap[name] || 0,
      order: idx
    }));

    if (groupOrder === 'Ascending') {
      if (['Start date', 'Due date', 'Created on', 'Last modified on', 'Completed on'].includes(activeGroup)) {
        processedSections.sort((a, b) => a.sortValue - b.sortValue);
      } else {
        processedSections.sort((a, b) => a.name.localeCompare(b.name));
      }
    } else if (groupOrder === 'Descending') {
      if (['Start date', 'Due date', 'Created on', 'Last modified on', 'Completed on'].includes(activeGroup)) {
        processedSections.sort((a, b) => b.sortValue - a.sortValue);
      } else {
        processedSections.sort((a, b) => b.name.localeCompare(a.name));
      }
    }
  }

  if (!showEmptyGroups) {
    processedSections = processedSections.filter(s => s.tasks.length > 0);
  }

  const pseudoProject = {
    id: 'my-tasks',
    name: 'My Tasks',
    sections: processedSections
  };

  const formatFriendlyDate = (dueDate) => {
    if (!dueDate) return '';
    const date = new Date(dueDate);
    date.setHours(0,0,0,0);
    const diffDays = Math.round((date - now) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays === 1) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderSection = (title, tasks) => (
    <div style={styles.sectionContainer} key={title}>
      <div style={styles.sectionHeader}>
        <span style={styles.dropdownArrow}>▼</span>
        <h3 style={styles.sectionTitle}>{title}</h3>
      </div>
      
      {tasks.length === 0 && (
        <div style={styles.emptyTaskRow}>
          <span style={styles.addTaskPlaceholder}>Add task...</span>
        </div>
      )}

      {tasks.map((task, idx) => (
        <div key={task.id} style={{ ...styles.taskRow, borderTop: idx === 0 ? '1px solid #E5E7EB' : 'none', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `1px solid ${task.isCompleted ? '#10B981' : '#D1D5DB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: task.isCompleted ? '#10B981' : 'transparent', cursor: 'pointer' }}>✓</div>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', textDecoration: task.isCompleted ? 'line-through' : 'none' }}>{task.title}</span>
          </div>
          <div style={{ flex: 1, padding: '0.5rem 1rem', fontSize: '0.85rem', color: (task.dueDate && new Date(task.dueDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && !task.isCompleted) ? '#EF4444' : 'var(--text-secondary)', borderLeft: '1px solid #E5E7EB' }}>
            {formatFriendlyDate(task.dueDate)}
          </div>
          <div style={{ flex: 1, padding: '0.5rem 1rem', borderLeft: '1px solid #E5E7EB' }}>
            {/* Collaborators */}
          </div>
          <div style={{ flex: 1, padding: '0.5rem 1rem', borderLeft: '1px solid #E5E7EB' }}>
            <span style={styles.projectPill}>{task.projectName}</span>
          </div>
          <div style={{ flex: 1, padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', borderLeft: '1px solid #E5E7EB' }}>
            My workspace
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.userAvatar}>{user?.name?.[0]?.toUpperCase()}</div>
          <h1 style={styles.pageTitle}>My tasks <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>▼</span></h1>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.headerBtn}>Share</button>
          <button style={styles.headerBtn}>Customize</button>
        </div>
      </div>

      <div style={styles.tabsRow}>
        {['List', 'Board', 'Calendar', 'Dashboard', 'Files', '+'].map(tab => (
          <span 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tabItem,
              borderBottom: activeTab === tab ? '2px solid var(--text-primary)827' : '2px solid transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab ? '600' : '400'
            }}
          >
            {tab}
          </span>
        ))}
      </div>

      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <button style={styles.addTaskBtn}>+ Add task <span style={{ fontSize: '0.6rem' }}>▼</span></button>
        </div>
        <div style={styles.toolbarRight}>
          
          <div style={{ position: 'relative' }}>
            <div className="option-sub-item" style={{ ...styles.optionSubItem, backgroundColor: activeFilters.length > 0 ? '#EEF2F6' : 'transparent', fontWeight: activeFilters.length > 0 ? '700' : '500' }} onClick={(e) => { document.body.click(); e.stopPropagation(); setIsFilterDropdownOpen(!isFilterDropdownOpen); }}>
              <span style={styles.optionIcon}>📊</span> Filter {activeFilters.length > 0 && `(${activeFilters.length})`}
              {activeFilters.length > 0 && (
                <span onClick={(e) => { e.stopPropagation(); setActiveFilters([]); }} style={{ marginLeft: '4px', padding: '0 4px', color: 'var(--text-secondary)', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>×</span>
              )}
            </div>
            {isFilterDropdownOpen && (
              <div style={styles.filterPanelBox} onClick={(e) => e.stopPropagation()}>
                <div style={styles.filterPanelHeader}>
                  <div style={styles.filterPanelTitle}>Quick filters</div>
                  <div style={styles.filterClearLink} onClick={() => setActiveFilters([])}>Clear all</div>
                </div>
                <div style={styles.quickFiltersSection}>
                  <div style={styles.quickFiltersLabel}>Completion status</div>
                  <div style={styles.filterPillsContainer}>
                    <div style={{ ...styles.filterPill, ...(activeFilters.includes('incomplete') ? styles.activeFilterPill : {}) }} onClick={() => handleToggleFilter('incomplete')}>Incomplete tasks</div>
                    <div style={{ ...styles.filterPill, ...(activeFilters.includes('completed') ? styles.activeFilterPill : {}) }} onClick={() => handleToggleFilter('completed')}>Completed tasks</div>
                  </div>
                  
                  <div style={{ ...styles.quickFiltersLabel, marginTop: '0.5rem' }}>Due date</div>
                  <div style={styles.filterPillsContainer}>
                    <div style={{ ...styles.filterPill, ...(activeFilters.includes('this-week') ? styles.activeFilterPill : {}) }} onClick={() => handleToggleFilter('this-week')}>Due this week</div>
                    <div style={{ ...styles.filterPill, ...(activeFilters.includes('next-week') ? styles.activeFilterPill : {}) }} onClick={() => handleToggleFilter('next-week')}>Due next week</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <div className="option-sub-item" style={{ ...styles.optionSubItem, backgroundColor: isSortDropdownOpen ? '#EEF2F6' : 'transparent', fontWeight: isSortDropdownOpen ? '700' : '500' }} onClick={(e) => { document.body.click(); e.stopPropagation(); setIsSortDropdownOpen(!isSortDropdownOpen); }}>
              <span style={styles.optionIcon}>⇅</span> Sort
              {activeSort && (
                <span onClick={(e) => { e.stopPropagation(); setActiveSort(null); }} style={{ marginLeft: '4px', padding: '0 4px', color: 'var(--text-secondary)', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>×</span>
              )}
            </div>
            {isSortDropdownOpen && (
              <div style={styles.sortDropdownMenu} onClick={(e) => e.stopPropagation()}>
                {[
                  { icon: '📅', label: 'Start date' },
                  { icon: '📅', label: 'Due date' },
                  { icon: '🕒', label: 'Created on' },
                  { icon: '🕒', label: 'Last modified on' },
                  { icon: '🕒', label: 'Completed on' },
                  { icon: 'A', label: 'Alphabetical' },
                  { icon: '📋', label: 'Project' }
                ].map((item, idx) => {
                  const isActive = activeSort?.field === item.label;
                  return (
                    <div key={idx} style={{ ...styles.sortDropdownItem, backgroundColor: isActive ? '#EEF2F6' : 'transparent', fontWeight: isActive ? '600' : '400' }} onClick={() => handleSortOptionClick(item.label)}>
                      <span style={styles.sortDropdownIcon}>{item.icon}</span> 
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {isActive && <span style={{ fontSize: '0.8rem', color: '#4F46E5' }}>{activeSort.direction === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  )
                })}
                {activeSort && (
                  <>
                    <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '4px 0' }}></div>
                    <div style={{ ...styles.sortDropdownItem, color: '#EF4444', justifyContent: 'center' }} onClick={() => { setActiveSort(null); setIsSortDropdownOpen(false); }}>
                      Clear sort
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          
          <div style={{ position: 'relative' }}>
            <div className="option-sub-item" style={{ ...styles.optionSubItem, backgroundColor: isGroupDropdownOpen ? '#EEF2F6' : 'transparent', fontWeight: isGroupDropdownOpen ? '700' : '500' }} onClick={(e) => { document.body.click(); e.stopPropagation(); setIsGroupDropdownOpen(!isGroupDropdownOpen); }}>
              <span style={styles.optionIcon}>⊞</span> Group
              {activeGroup && activeGroup !== 'Sections' && (
                <span onClick={(e) => { e.stopPropagation(); setActiveGroup('Sections'); }} style={{ marginLeft: '4px', padding: '0 4px', color: 'var(--text-secondary)', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>×</span>
              )}
            </div>
            
            {isGroupDropdownOpen && (
              <div style={styles.groupDropdownPanel} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '12px 16px', borderBottom: '1px solid #E5E7EB' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Groups</span>
                </div>
                
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#9CA3AF', cursor: 'grab', userSelect: 'none' }}>⋮⋮</span>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <div 
                        style={{ border: '1px solid #D1D5DB', borderRadius: '6px', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)' }}
                        onClick={(e) => { e.stopPropagation(); setIsGroupInnerDropdownOpen(!isGroupInnerDropdownOpen); setIsGroupMoreMenuOpen(false); setIsGroupOrderMenuOpen(false); }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>≡</span> {activeGroup || 'Sections'}
                        </div>
                        <span style={{ color: '#9CA3AF' }}>⌄</span>
                      </div>
                      
                      {isGroupInnerDropdownOpen && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', zIndex: 100, marginTop: '4px', maxHeight: '250px', overflowY: 'auto' }}>
                          {[
                            { icon: '≡', label: 'Sections' },
                            { icon: '📅', label: 'Start date' },
                            { icon: '📅', label: 'Due date' },
                            { icon: '🕒', label: 'Created on' },
                            { icon: '🕒', label: 'Last modified on' },
                            { icon: '🕒', label: 'Completed on' },
                            { icon: '📋', label: 'Project' }
                          ].map((item, idx) => (
                            <div 
                              key={idx}
                              style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                              onClick={() => { 
                                setActiveGroup(item.label); 
                                setIsGroupInnerDropdownOpen(false); 
                                if (item.label === 'Sections') {
                                  setGroupOrder('Custom order');
                                } else if (groupOrder === 'Custom order') {
                                  setGroupOrder('Ascending');
                                }
                              }}
                            >
                              <span style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', width: '20px', textAlign: 'center' }}>{item.icon}</span>
                              {item.label}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ position: 'relative' }}>
                      <div 
                        style={{ border: '1px solid #D1D5DB', borderRadius: '6px', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: (!activeGroup || activeGroup === 'Sections') ? 'not-allowed' : 'pointer', fontSize: '0.9rem', color: (!activeGroup || activeGroup === 'Sections') ? '#9CA3AF' : 'var(--text-primary)', width: '130px', backgroundColor: (!activeGroup || activeGroup === 'Sections') ? '#F9FAFB' : '#FFF' }}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (!activeGroup || activeGroup === 'Sections') return;
                          setIsGroupOrderMenuOpen(!isGroupOrderMenuOpen); 
                          setIsGroupInnerDropdownOpen(false); 
                          setIsGroupMoreMenuOpen(false); 
                        }}
                      >
                        {(!activeGroup || activeGroup === 'Sections') ? 'Custom order' : groupOrder} <span style={{ color: '#9CA3AF' }}>⌄</span>
                      </div>
                      {isGroupOrderMenuOpen && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, width: '150px', backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)', zIndex: 110, marginTop: '4px', padding: '6px 0' }} onClick={(e) => e.stopPropagation()}>
                          {['Ascending', 'Descending'].map((opt) => (
                            <div key={opt} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }} onClick={() => { setGroupOrder(opt); setIsGroupOrderMenuOpen(false); }}>
                              <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>
                                {groupOrder === opt && <span style={{ color: '#4F46E5' }}>✓</span>}
                              </div>
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <span style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px', fontWeight: 'bold' }} onClick={(e) => { e.stopPropagation(); setIsGroupMoreMenuOpen(!isGroupMoreMenuOpen); setIsGroupInnerDropdownOpen(false); setIsGroupOrderMenuOpen(false); }}>...</span>
                      {isGroupMoreMenuOpen && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, width: '200px', backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)', zIndex: 110, marginTop: '4px', padding: '6px 0' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }} onClick={() => { setShowEmptyGroups(false); setIsGroupMoreMenuOpen(false); }}>
                            <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>{!showEmptyGroups && <span style={{ color: '#4F46E5' }}>✓</span>}</div>
                            Hide empty groups
                          </div>
                          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }} onClick={() => { setShowEmptyGroups(true); setIsGroupMoreMenuOpen(false); }}>
                            <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>{showEmptyGroups && <span style={{ color: '#4F46E5' }}>✓</span>}</div>
                            Show empty groups
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ width: '1px', height: '16px', backgroundColor: '#E5E7EB', margin: '0 8px' }}></div>
          <div className="option-sub-item" style={styles.optionSubItem}><span style={styles.optionIcon}>⚙️</span> Options</div>
          {isSearchOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '2px 8px', backgroundColor: 'var(--bg-primary)', marginLeft: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginRight: '6px' }}>🔍</span>
              <input type="text" placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus style={{ border: 'none', outline: 'none', fontSize: '0.85rem', width: '150px' }} />
              <span onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} style={{ color: '#9CA3AF', cursor: 'pointer', fontSize: '1rem', marginLeft: '4px' }}>×</span>
            </div>
          ) : (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer', marginLeft: '8px' }} onClick={() => setIsSearchOpen(true)}>🔍</span>
          )}
        </div>
      </div>

      {activeTab === 'List' && (
        <>
          <div style={styles.spreadsheetHeader}>
            <div style={{ flex: 2, padding: '0.5rem 1rem' }}>Name</div>
            <div style={{ flex: 1, padding: '0.5rem 1rem', borderLeft: '1px solid #E5E7EB' }}>Due date</div>
            <div style={{ flex: 1, padding: '0.5rem 1rem', borderLeft: '1px solid #E5E7EB' }}>Collaborators</div>
            <div style={{ flex: 1, padding: '0.5rem 1rem', borderLeft: '1px solid #E5E7EB' }}>Projects</div>
            <div style={{ flex: 1, padding: '0.5rem 1rem', borderLeft: '1px solid #E5E7EB' }}>Task visibility</div>
            <div style={{ width: '40px', borderLeft: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</div>
          </div>
          <div style={styles.listContent}>
            {processedSections.map(section => renderSection(section.name, section.tasks))}
            <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer' }}>+ Add section</div>
          </div>
        </>
      )}

      {activeTab === 'Board' && (
        <div style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', padding: '1.5rem', flex: 1, backgroundColor: 'var(--bg-secondary)' }}>
          {processedSections.map(section => (
            <div key={section.id} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', width: '300px' }}>
              <KanbanColumn section={section} token={token} projectRole="VIEWER" />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Dashboard' && <ProjectDashboardView selectedProject={pseudoProject} />}
      {activeTab === 'Calendar' && <ProjectCalendarView selectedProject={pseudoProject} token={token} />}
      {activeTab === 'Files' && <div style={{ padding: '2rem', color: 'var(--text-secondary)', textAlign: 'center' }}>No files attached to your tasks.</div>}
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-primary)', fontFamily: 'system-ui' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  userAvatar: { width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' },
  pageTitle: { margin: 0, fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  headerRight: { display: 'flex', gap: '0.5rem' },
  headerBtn: { padding: '0.4rem 0.8rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: '500' },
  tabsRow: { display: 'flex', gap: '1.5rem', padding: '0 1.5rem', borderBottom: '1px solid var(--border-color)' },
  tabItem: { padding: '0.75rem 0', fontSize: '0.9rem', cursor: 'pointer' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1.5rem', borderBottom: '1px solid var(--border-color)' },
  toolbarLeft: { display: 'flex' },
  addTaskBtn: { backgroundColor: 'var(--accent-primary)', color: '#FFF', border: 'none', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' },
  toolbarRight: { display: 'flex', gap: '1rem', alignItems: 'center' },
  optionSubItem: { fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500', padding: '4px 8px', borderRadius: '6px' },
  optionIcon: { fontSize: '0.95rem', color: 'var(--text-secondary)' },
  sortDropdownMenu: { position: 'absolute', top: '100%', left: 0, marginTop: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '0.5rem 0', minWidth: '220px', zIndex: 10005 },
  sortDropdownItem: { padding: '0.6rem 1rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'background-color 0.1s' },
  sortDropdownIcon: { fontSize: '1rem', color: 'var(--text-secondary)', width: '20px', textAlign: 'center' },
  groupDropdownPanel: { position: 'absolute', top: '100%', right: '0', marginTop: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 9999, width: '420px', display: 'flex', flexDirection: 'column' },
  filterPanelBox: { position: 'absolute', top: '100%', right: '0', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '1rem', width: '420px', zIndex: 10005, marginTop: '8px' },
  filterPanelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  filterPanelTitle: { fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' },
  filterClearLink: { fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: '500' },
  quickFiltersSection: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  quickFiltersLabel: { fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' },
  filterPillsContainer: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' },
  filterPill: { border: '1px solid var(--border-color)', borderRadius: '20px', padding: '5px 12px', fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', backgroundColor: 'var(--bg-primary)', fontWeight: '500' },
  activeFilterPill: { border: '1px solid var(--accent-primary)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-primary)' },
  spreadsheetHeader: { display: 'flex', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '500', backgroundColor: 'var(--bg-secondary)' },
  listContent: { flex: 1, overflowY: 'auto', paddingBottom: '2rem' },
  sectionContainer: { marginBottom: '0.5rem' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' },
  dropdownArrow: { fontSize: '0.6rem', color: 'var(--text-secondary)', cursor: 'pointer' },
  sectionTitle: { margin: 0, fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)' },
  emptyTaskRow: { padding: '0.5rem 2.5rem', color: 'var(--text-tertiary)', fontSize: '0.85rem', borderTop: '1px solid var(--bg-tertiary)' },
  addTaskPlaceholder: { cursor: 'pointer', color: 'var(--text-tertiary)' },
  taskRow: { display: 'flex', alignItems: 'stretch' },
  projectPill: { display: 'inline-block', backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-primary)', fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }
};

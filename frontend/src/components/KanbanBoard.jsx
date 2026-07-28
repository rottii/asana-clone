import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import KanbanColumn from './KanbanColumn'
import DatePickerPopover from './DatePickerPopover'
import AssigneePopover from './AssigneePopover'
import FilterValueDropdown from './FilterValueDropdown'
import ShareProjectModal from './ShareProjectModal'
import ProjectListView from './ProjectListView'
import AddFieldModal from './AddFieldModal'
import RulesModal from './RulesModal'
import ProjectOverviewView from './ProjectOverviewView'
import ProjectFormView from './ProjectFormView'
import ProjectDashboardView from './ProjectDashboardView'
import ProjectCalendarView from './ProjectCalendarView'
import ProjectTimelineView from './ProjectTimelineView'
import ProjectWorkloadView from './ProjectWorkloadView'
import ProjectGanttView from './ProjectGanttView'
import TaskDetailPane from './TaskDetailPane'
import IconColorPicker from './IconColorPicker'
import ProjectNoteView from './ProjectNoteView'
import ProjectFilesView from './ProjectFilesView'
import ProjectMessagesView from './ProjectMessagesView'
import './KanbanBoard.css'
import { getParsedCustomFields, getParsedGithubPRs, getGithubPRStatusLabel, GITHUB_PR_STATUSES, GITHUB_PR_SORT_MAP } from '../utils/customFields'

export default function KanbanBoard({ selectedProject, setSelectedProject, projects, setProjects, token, user, handleLogout }) {
  const [newSectionName, setNewSectionName] = useState('')
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, taskId: null })
  const [approvalMenu, setApprovalMenu] = useState({ visible: false, x: 0, y: 0, task: null })
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false)
  const [isCustomizePanelOpen, setIsCustomizePanelOpen] = useState(false)
  const [isOptionsPaneOpen, setIsOptionsPaneOpen] = useState(false)
  const [isFormsModalOpen, setIsFormsModalOpen] = useState(false)
  const [activeFormId, setActiveFormId] = useState(null)
  const [customizeView, setCustomizeView] = useState('main')
  const [optionsView, setOptionsView] = useState('main')
  const [projectRules, setProjectRules] = useState([])
  const [activeRuleMenuId, setActiveRuleMenuId] = useState(null)
  const [ruleToEdit, setRuleToEdit] = useState(null)
  const [fieldToEdit, setFieldToEdit] = useState(null)
  const [activePopover, setActivePopover] = useState(null)
  const [activeTaskPaneId, setActiveTaskPaneId] = useState(null)

  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false)
  const [isGroupInnerDropdownOpen, setIsGroupInnerDropdownOpen] = useState(false)
  const [isGroupMoreMenuOpen, setIsGroupMoreMenuOpen] = useState(false)
  const [isGroupOrderMenuOpen, setIsGroupOrderMenuOpen] = useState(false)
  const [groupOrder, setGroupOrder] = useState('Custom order')
  const [showEmptyGroups, setShowEmptyGroups] = useState(true)
  const [activeGroup, setActiveGroup] = useState(null)
  const [showAddFieldMenu, setShowAddFieldMenu] = useState(false)

  // Üst menü ve görünüm tab kontrolü
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(selectedProject.name)
  const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false)
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)
  const [isFilterInnerMenuOpen, setIsFilterInnerMenuOpen] = useState(false)
  const [openFilterDropdown, setOpenFilterDropdown] = useState(null) // { index, type: 'operator' | 'value' | 'value_start' | 'value_end' }
  const [sortDropdownView, setSortDropdownView] = useState('main')
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const [isAddWidgetMenuOpen, setIsAddWidgetMenuOpen] = useState(false)
  const [isAddTaskMenuOpen, setIsAddTaskMenuOpen] = useState(false)
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const [isAddViewMenuOpen, setIsAddViewMenuOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState([])
  const [activeSorts, setActiveSorts] = useState([])
  const [draggingSortIdx, setDraggingSortIdx] = useState(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false)
  const [currentTab, setCurrentTab] = useState(() => {
    return localStorage.getItem(`currentProjectTab_${selectedProject.id}`) || selectedProject.defaultView || 'List';
  })
  const [tabContextMenu, setTabContextMenu] = useState({ visible: false, x: 0, y: 0, view: null })

  useEffect(() => {
    const handleClickOutside = () => setOpenFilterDropdown(null);
    if (openFilterDropdown) document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openFilterDropdown]);

  useEffect(() => {
    const handleClickOutsidePanes = (e) => {
      if (e.target.closest('#customize-pane-container') || e.target.closest('#options-pane-container')) return;
      if (e.target.closest('#customize-pane-toggle-btn') || e.target.closest('#options-pane-toggle-btn')) return;

      setIsOptionsPaneOpen(false);
      setIsCustomizePanelOpen(false);
    };

    if (isOptionsPaneOpen || isCustomizePanelOpen) {
      document.addEventListener('mousedown', handleClickOutsidePanes);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsidePanes);
    };
  }, [isOptionsPaneOpen, isCustomizePanelOpen]);

  // Parse views for backward compatibility
  const rawViews = selectedProject.activeViews || ['Overview', 'List', 'Board', 'Timeline', 'Gantt', 'Dashboard', 'Calendar', 'Workload'];
  const parsedViews = rawViews.map((v, i) => {
    if (typeof v === 'string') return { id: `legacy-${v.toLowerCase()}`, type: v, name: v };
    return v;
  });

  // Determine current active view object
  const activeViewObj = parsedViews.find(v => v.id === currentTab) || parsedViews.find(v => v.type === currentTab) || parsedViews[0];

  const projectStatuses = [
    { id: 'ON_TRACK', label: 'On track', color: '#34D399', bgColor: '#064E3B', icon: '●' },
    { id: 'AT_RISK', label: 'At risk', color: '#FBBF24', bgColor: '#78350F', icon: '●' },
    { id: 'OFF_TRACK', label: 'Off track', color: '#F87171', bgColor: '#7F1D1D', icon: '●' },
    { id: 'ON_HOLD', label: 'On hold', color: '#60A5FA', bgColor: '#1E3A8A', icon: '●' },
    { id: 'DIVIDER', isDivider: true },
    { id: 'COMPLETE', label: 'Complete', color: '#FFF', bgColor: '#10B981', icon: '✓' },
    { id: 'DROPPED', label: 'Dropped', color: '#9CA3AF', bgColor: 'var(--text-primary)', icon: '●' }
  ];

  // Akıllı konum hafıza takipleri
  const [lastInteractedSectionId, setLastInteractedSectionId] = useState(null)
  const [lastInteractedTaskId, setLastInteractedTaskId] = useState(null)
  const [draggingTaskId, setDraggingTaskId] = useState(null)
  const [draggingSectionId, setDraggingSectionId] = useState(null)
  const [draggingTabId, setDraggingTabId] = useState(null)
  const [dropTargetTab, setDropTargetTab] = useState({ id: null, position: null })

  const [undoToast, setUndoToast] = useState(false);
  const pendingDeleteRef = useRef(null);

  const projectRole = selectedProject.ownerId === user.id
    ? 'ADMIN'
    : (selectedProject.members?.find(m => (m.user?.id || m.userId) === user.id)?.role || 'VIEWER');

  const isReadOnly = projectRole === 'VIEWER' || projectRole === 'COMMENTER';

  // Sürükle bırak işlemlerinde state gecikmesini önlemek için senkron referans
  const latestSectionsRef = useRef(selectedProject.sections);
  useEffect(() => {
    return () => {
      if (pendingDeleteRef.current) {
        clearTimeout(pendingDeleteRef.current.timeoutId);
        fetch(`http://localhost:5001/api/projects/tasks/${pendingDeleteRef.current.task.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).catch(console.error);
      }
    };
  }, [token]);

  useEffect(() => {
    latestSectionsRef.current = selectedProject.sections;
  }, [selectedProject.sections]);

  useEffect(() => {
    setNameInput(selectedProject.name);
  }, [selectedProject.id, selectedProject.name]);

  useEffect(() => {
    localStorage.setItem(`currentProjectTab_${selectedProject.id}`, currentTab);
  }, [currentTab, selectedProject.id]);

  useEffect(() => {
    const saved = localStorage.getItem(`currentProjectTab_${selectedProject.id}`);
    setCurrentTab(saved || selectedProject.defaultView || 'List');
  }, [selectedProject.id, selectedProject.defaultView]);

  // --- REAL-TIME UPDATES VIA SOCKET.IO ---
  useEffect(() => {
    if (!selectedProject || !selectedProject.id) return;

    const socket = io('http://localhost:5001');
    socket.emit('join_project', selectedProject.id);

    const refreshProject = async () => {
      try {
        const response = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}?t=${Date.now()}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store'
        });
        if (response.ok) {
          let updatedProj = await response.json();

          // Filter out the currently pending deleted task so it doesn't reappear
          if (pendingDeleteRef.current) {
            const pendingTaskId = pendingDeleteRef.current.task.id;
            updatedProj.sections = updatedProj.sections.map(sec => ({
              ...sec,
              tasks: (sec.tasks || []).filter(t => t.id !== pendingTaskId)
            }));
          }

          setSelectedProject(updatedProj);
          setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
        }
      } catch (err) {
        console.error("Socket update fetch failed", err);
      }
    };

    socket.on('task_created', refreshProject);
    socket.on('task_updated', refreshProject);
    socket.on('task_moved', refreshProject);
    socket.on('task_deleted', refreshProject);
    socket.on('section_created', refreshProject);
    socket.on('section_updated', refreshProject);
    socket.on('section_moved', refreshProject);
    socket.on('section_deleted', refreshProject);
    socket.on('project_updated', refreshProject);

    // Fetch initial fresh data when mounting this project board
    refreshProject();

    return () => {
      socket.emit('leave_project', selectedProject.id);
      socket.disconnect();
    };
  }, [selectedProject?.id, token]);

  useEffect(() => {
    // Reset interaction state when switching projects
    setLastInteractedSectionId(null);
    setLastInteractedTaskId(null);

    if (selectedProject?.sections?.length > 0) {
      setLastInteractedSectionId(selectedProject.sections[0].id)
    }
  }, [selectedProject?.id])

  useEffect(() => {
    const handleAddFieldModal = () => setShowAddFieldMenu(true);
    window.addEventListener('openAddFieldModal', handleAddFieldModal);
    return () => window.removeEventListener('openAddFieldModal', handleAddFieldModal);
  }, []);

  useEffect(() => {
    const closeAll = (e) => {
      // Prevent closing if click is inside the Task Detail Pane or view context menu
      if (e && e.target.closest && (e.target.closest('.task-pane-ignore-click') || e.target.closest('.view-context-menu'))) return;

      setContextMenu({ visible: false, x: 0, y: 0, taskId: null })
      setApprovalMenu({ visible: false, x: 0, y: 0, task: null })
      setTabContextMenu({ visible: false, x: 0, y: 0, view: null })
      setActivePopover(null)
      setIsHeaderDropdownOpen(false)
      setIsFilterDropdownOpen(false)
      setIsStatusDropdownOpen(false)
      setIsSortDropdownOpen(false)
      setIsAddWidgetMenuOpen(false)
      setIsAddViewMenuOpen(false)
      setIsGroupDropdownOpen(false)
      setIsGroupInnerDropdownOpen(false)
      setIsGroupMoreMenuOpen(false)
      setIsGroupOrderMenuOpen(false)
      setIsIconPickerOpen(false)
    }
    window.addEventListener('click', closeAll)
    return () => window.removeEventListener('click', closeAll)
  }, [])

  const handleSetProjectStatus = async (newStatusId) => {
    if (projectRole !== 'ADMIN' && projectRole !== 'EDITOR') {
      alert('Only project admins and editors can change the status.');
      return;
    }
    try {
      const response = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatusId })
      });
      const data = await response.json();
      if (response.ok) {
        syncProjectStates(data);
      }
    } catch (err) {
      console.error(err);
    }
    setIsStatusDropdownOpen(false);
  };

  const handleUpdateViews = async (newViews, newDefaultView = selectedProject.defaultView) => {
    try {
      const response = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ activeViews: newViews, defaultView: newDefaultView })
      });
      const data = await response.json();
      if (response.ok) {
        syncProjectStates(data);
      }
    } catch (err) { console.error(err); }
  };

  const handleUpdateIconColor = async (color, icon) => {
    if (projectRole !== 'ADMIN' && projectRole !== 'EDITOR') return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ color, icon })
      });
      if (response.ok) {
        const data = await response.json();
        syncProjectStates(data);
      }
    } catch (err) { console.error(err); }
  };

  const handleToggleStar = async () => {
    try {
      const response = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}/star`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const { isStarred } = await response.json();
        const updatedProj = { ...selectedProject };
        if (isStarred) {
          updatedProj.starredBy = [...(updatedProj.starredBy || []), { userId: user.id }];
        } else {
          updatedProj.starredBy = (updatedProj.starredBy || []).filter(s => s.userId !== user.id);
        }
        setSelectedProject(updatedProj);
        if (setProjects) {
          setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
        }
      }
    } catch (err) {
      console.error('Error toggling star:', err);
    }
  };

  const handleLiveTabSwap = (dragId, hoverId) => {
    if (dragId === hoverId) return;

    const dragIndex = parsedViews.findIndex(v => v.id === dragId);
    const hoverIndex = parsedViews.findIndex(v => v.id === hoverId);

    if (dragIndex < 0 || hoverIndex < 0) return;

    const newViews = [...parsedViews];
    const [draggedView] = newViews.splice(dragIndex, 1);
    newViews.splice(hoverIndex, 0, draggedView);

    // Update local state instantly for visual feedback
    setSelectedProject({ ...selectedProject, activeViews: newViews });
  };

  const handleTabDrop = () => {
    // The final order is already in parsedViews thanks to handleLiveTabSwap
    handleUpdateViews(parsedViews);
    setDraggingTabId(null);
  };

  const handleAddView = (type) => {
    const newView = { id: crypto.randomUUID(), type, name: type };
    const newViews = [...parsedViews, newView];
    setIsAddViewMenuOpen(false);
    handleUpdateViews(newViews);
    setCurrentTab(newView.id);
  };

  const handleRenameView = () => {
    const view = tabContextMenu.view;
    setTabContextMenu({ visible: false, x: 0, y: 0, view: null });
    const newName = window.prompt("Enter new view name:", view.name);
    if (!newName || newName.trim() === '' || newName === view.name) return;

    const newViews = parsedViews.map(v => v.id === view.id ? { ...v, name: newName.trim() } : v);
    handleUpdateViews(newViews);
  };

  const handleCopyView = () => {
    const view = tabContextMenu.view;
    setTabContextMenu({ visible: false, x: 0, y: 0, view: null });

    const newView = { ...view, id: crypto.randomUUID(), name: `${view.name} (Copy)` };
    const newViews = [...parsedViews, newView];
    handleUpdateViews(newViews);
  };

  const handleSetDefaultView = () => {
    const view = tabContextMenu.view;
    setTabContextMenu({ visible: false, x: 0, y: 0, view: null });
    handleUpdateViews(parsedViews, view.id);
  };

  const handleDeleteView = () => {
    const view = tabContextMenu.view;
    setTabContextMenu({ visible: false, x: 0, y: 0, view: null });
    if (parsedViews.length <= 1) {
      alert("You cannot delete the last view.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete the view "${view.name}"?`)) {
      const newViews = parsedViews.filter(v => v.id !== view.id);
      let newDefaultView = selectedProject.defaultView;
      if (newDefaultView === view.id) newDefaultView = newViews[0].id;

      if (currentTab === view.id) setCurrentTab(newViews[0].id);
      handleUpdateViews(newViews, newDefaultView);
    }
  };

  // Haftalık Filtreleme Algoritmaları
  const getThisWeekRange = () => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(today.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(sunday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    return { monday, sunday }
  }

  const getNextWeekRange = () => {
    const { monday } = getThisWeekRange()
    const nextMonday = new Date(monday)
    nextMonday.setDate(nextMonday.getDate() + 7)
    const nextSunday = new Date(nextMonday)
    nextSunday.setDate(nextSunday.getDate() + 6)
    nextSunday.setHours(23, 59, 59, 999)
    return { nextMonday, nextSunday }
  }

  const handleToggleFilter = (type) => {
    setActiveFilters(prev => {
      if (prev.includes(type)) { return prev.filter(f => f !== type) }
      else {
        let updated = [...prev, type]
        if (type === 'incomplete') updated = updated.filter(f => f !== 'completed')
        if (type === 'completed') updated = updated.filter(f => f !== 'incomplete')
        if (type === 'this-week') updated = updated.filter(f => f !== 'next-week')
        if (type === 'next-week') updated = updated.filter(f => f !== 'this-week')
        return updated
      }
    })
  }

  const applyTaskFilter = (tasks) => {
    if (!tasks) return []
    return tasks.filter(task => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title?.toLowerCase().includes(query);
        if (!matchesTitle) return false;
      }
      if (activeFilters.includes('incomplete') && task.isCompleted) return false
      if (activeFilters.includes('completed') && !task.isCompleted) return false
      if (activeFilters.includes('my-tasks') && task.assigneeId !== user.id) return false
      if (activeFilters.includes('this-week')) {
        if (!task.dueDate) return false
        const due = new Date(task.dueDate)
        const { monday, sunday } = getThisWeekRange()
        if (due < monday || due > sunday) return false
      }
      if (activeFilters.includes('next-week')) {
        if (!task.dueDate) return false
        const due = new Date(task.dueDate)
        const { nextMonday, nextSunday } = getNextWeekRange()
        if (due < nextMonday || due > nextSunday) return false
      }

      const objFilters = activeFilters.filter(f => typeof f === 'object');
      for (const filter of objFilters) {
        let taskValue;
        if (filter.field === 'Completion status') taskValue = task.isCompleted ? 'Completed' : 'Incomplete';
        else if (filter.field === 'Assignee') taskValue = task.assignee?.name || null;
        else if (filter.field === 'Created by') taskValue = task.creator?.name || null;
        else if (filter.field === 'Start date') taskValue = task.startDate;
        else if (filter.field === 'Due date') taskValue = task.dueDate;
        else if (filter.field === 'Created on') taskValue = task.createdAt;
        else if (filter.field === 'Last modified on') taskValue = task.updatedAt;
        else if (filter.field === 'Completed on') taskValue = task.completedAt;
        else if (filter.field === 'Task type') taskValue = task.type || 'Task';
        else {
          const customFieldsList = getParsedCustomFields(selectedProject);
          const cf = customFieldsList.find(f => f.title === filter.field);
          if (cf) {
            if (cf.type === 'github_pr') {
              const prs = getParsedGithubPRs(task.githubPRs);
              taskValue = prs.length > 0 ? getGithubPRStatusLabel(prs[0]) : null;
            } else {
              let parsedFields = {};
              if (typeof task.customFields === 'string') { try { parsedFields = JSON.parse(task.customFields); } catch (e) { } } else if (task.customFields) parsedFields = task.customFields;
              taskValue = parsedFields[cf.id];
            }
          } else {
            taskValue = null;
          }
        }

        const op = filter.operator;
        const val = filter.value;
        const filterType = (filter.type || '').toLowerCase();
        const isDate = ['Start date', 'Due date', 'Created on', 'Completed on', 'Last modified on'].includes(filter.field) || filterType === 'date';
        const isMulti = filterType === 'multi_select' || filterType === 'multi-select';

        if (isDate) {
          const tDate = taskValue ? new Date(taskValue).setHours(0, 0, 0, 0) : null;
          if (op === 'is empty') { if (tDate) return false; }
          else if (op === 'is not empty') { if (!tDate) return false; }
          else if (op === 'is') {
            if (!tDate || !val) return false;
            const vDate = new Date(val).setHours(0, 0, 0, 0);
            if (tDate !== vDate) return false;
          }
          else if (op === 'is not') {
            if (tDate && val) {
              const vDate = new Date(val).setHours(0, 0, 0, 0);
              if (tDate === vDate) return false;
            }
          }
          else if (op === 'is between') {
            const start = val?.start ? new Date(val.start).setHours(0, 0, 0, 0) : null;
            const end = val?.end ? new Date(val.end).setHours(0, 0, 0, 0) : null;
            if (!tDate) return false;
            if (start && tDate < start) return false;
            if (end && tDate > end) return false;
          }
          else if (op === 'is not between') {
            const start = val?.start ? new Date(val.start).setHours(0, 0, 0, 0) : null;
            const end = val?.end ? new Date(val.end).setHours(0, 0, 0, 0) : null;
            if (!tDate) return false;
            const isInside = (!start || tDate >= start) && (!end || tDate <= end);
            if (isInside) return false;
          }
        } else if (isMulti) {
          let tArr = [];
          if (Array.isArray(taskValue)) tArr = taskValue;
          else if (typeof taskValue === 'string') { try { tArr = JSON.parse(taskValue); if (!Array.isArray(tArr)) tArr = [taskValue]; } catch (e) { tArr = [taskValue]; } }
          else if (taskValue) tArr = [taskValue];

          const vArr = Array.isArray(val) ? val : [];
          if (op === 'is empty') { if (tArr.length > 0) return false; }
          else if (op === 'is not empty') { if (tArr.length === 0) return false; }
          else if (op === 'contains all') {
            for (const v of vArr) { if (!tArr.includes(v)) return false; }
          }
          else if (op === 'contains any') {
            if (vArr.length > 0 && !vArr.some(v => tArr.includes(v))) return false;
          }
          else if (op === 'doesnt contain all') {
            let hasAll = true;
            for (const v of vArr) { if (!tArr.includes(v)) hasAll = false; }
            if (hasAll && vArr.length > 0) return false;
          }
          else if (op === 'doesnt contain any') {
            if (vArr.some(v => tArr.includes(v))) return false;
          }
        } else {
          const tStr = String(taskValue || '').toLowerCase();
          const vStr = String(val || '').toLowerCase();
          if (op === 'is empty') { if (tStr) return false; }
          else if (op === 'is not empty') { if (!tStr) return false; }
          else if (op === 'is') { if (tStr !== vStr) return false; }
          else if (op === 'is not') { if (tStr === vStr) return false; }
        }
      }

      return true
    })
  }

  const getOperatorsForFilter = (filter) => {
    const filterType = (filter.type || '').toLowerCase();
    const isDateField = ['Start date', 'Due date', 'Created on', 'Completed on', 'Last modified on'].includes(filter.field) || filterType === 'date';
    if (isDateField) return ['is', 'is not', 'is between', 'is not between', 'is empty', 'is not empty'];
    if (filterType === 'multi_select' || filterType === 'multi-select') return ['contains all', 'contains any', 'doesnt contain all', 'doesnt contain any', 'is empty', 'is not empty'];
    if (filterType === 'single_select' || filterType === 'single-select' || filterType === 'select' || filterType === 'github_pr') return ['is', 'is not', 'is empty', 'is not empty'];
    if (filter.field === 'Created by') return ['is', 'is not'];
    if (filter.field === 'Assignee') return ['is', 'is not', 'is empty', 'is not empty'];
    if (filter.field === 'Completion status') return ['is'];
    if (filter.field === 'Task type') return ['is', 'is not'];
    return ['is'];
  };

  const updateActiveFilter = (idx, key, value) => {
    const newFilters = [...activeFilters];
    if (key === 'operator') {
      const isBetween = ['is between', 'is not between'].includes(value);
      const filterType = (newFilters[idx].type || '').toLowerCase();
      const isMulti = filterType === 'multi_select' || filterType === 'multi-select';
      if (isBetween) {
        newFilters[idx].value = { start: '', end: '' };
      } else if (isMulti) {
        newFilters[idx].value = Array.isArray(newFilters[idx].value) ? newFilters[idx].value : [];
      } else {
        newFilters[idx].value = '';
      }
    }
    newFilters[idx] = { ...newFilters[idx], [key]: value };
    setActiveFilters(newFilters);
  };

  const handleSortOptionClick = (field) => {
    setActiveSorts(prev => {
      const existingIdx = prev.findIndex(s => s.field === field);
      if (existingIdx !== -1) {
        const newSorts = [...prev];
        newSorts[existingIdx] = { field, direction: prev[existingIdx].direction === 'asc' ? 'desc' : 'asc' };
        return newSorts;
      }
      return [...prev, { field, direction: 'asc' }];
    });
    setIsSortDropdownOpen(false);
  };

  const applyTaskSort = (tasks) => {
    if (!tasks || activeSorts.length === 0) return tasks;

    return [...tasks].sort((a, b) => {
      for (const sortObj of activeSorts) {
        const { field, direction } = sortObj;
        const orderMultiplier = direction === 'asc' ? 1 : -1;
        let valA, valB;

        switch (field) {
          case 'Start date':
            valA = a.startDate ? new Date(a.startDate).getTime() : 0;
            valB = b.startDate ? new Date(b.startDate).getTime() : 0;
            break;
          case 'Due date':
            valA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
            valB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
            break;
          case 'Assignee':
            valA = a.assignee?.name?.toLowerCase() || '';
            valB = b.assignee?.name?.toLowerCase() || '';
            break;
          case 'Created by':
            valA = a.creator?.name?.toLowerCase() || '';
            valB = b.creator?.name?.toLowerCase() || '';
            break;
          case 'Created on':
            valA = new Date(a.createdAt).getTime();
            valB = new Date(b.createdAt).getTime();
            break;
          case 'Last modified on':
            valA = new Date(a.updatedAt).getTime();
            valB = new Date(b.updatedAt).getTime();
            break;
          case 'Completed on':
            valA = a.completedAt ? new Date(a.completedAt).getTime() : (a.isCompleted ? 1 : 0);
            valB = b.completedAt ? new Date(b.completedAt).getTime() : (b.isCompleted ? 1 : 0);
            break;
          case 'Likes':
            valA = a.likes || 0;
            valB = b.likes || 0;
            break;
          case 'Alphabetical':
            valA = a.title?.toLowerCase() || '';
            valB = b.title?.toLowerCase() || '';
            break;

          case 'Task type':
            valA = a.type?.toLowerCase() || '';
            valB = b.type?.toLowerCase() || '';
            break;
          case 'Project':
            valA = selectedProject.name?.toLowerCase() || '';
            valB = selectedProject.name?.toLowerCase() || '';
            break;
          default:
            const customFieldsList = getParsedCustomFields(selectedProject);
            const cf = customFieldsList.find(f => f.title === field);
            if (cf) {
              if (cf.type === 'github_pr') {
                const prsA = getParsedGithubPRs(a.githubPRs);
                const prsB = getParsedGithubPRs(b.githubPRs);
                const labelA = prsA.length > 0 ? getGithubPRStatusLabel(prsA[0]) : 'Empty';
                const labelB = prsB.length > 0 ? getGithubPRStatusLabel(prsB[0]) : 'Empty';

                valA = GITHUB_PR_SORT_MAP[labelA] || 9;
                valB = GITHUB_PR_SORT_MAP[labelB] || 9;
              } else {
                let aFields = {};
                if (typeof a.customFields === 'string') { try { aFields = JSON.parse(a.customFields); } catch (e) { } } else if (a.customFields) aFields = a.customFields;
                let bFields = {};
                if (typeof b.customFields === 'string') { try { bFields = JSON.parse(b.customFields); } catch (e) { } } else if (b.customFields) bFields = b.customFields;

                const aValStr = aFields[cf.id] ? String(aFields[cf.id]) : '';
                const bValStr = bFields[cf.id] ? String(bFields[cf.id]) : '';

                if (Array.isArray(cf.options) && cf.options.length > 0) {
                  const idxA = cf.options.findIndex(o => o.label === aValStr);
                  const idxB = cf.options.findIndex(o => o.label === bValStr);
                  valA = idxA !== -1 ? idxA : 9999;
                  valB = idxB !== -1 ? idxB : 9999;
                } else {
                  valA = aValStr.toLowerCase();
                  valB = bValStr.toLowerCase();
                }
              }
            } else {
              return 0;
            }
            break;
        }

        if (valA < valB) return -1 * orderMultiplier;
        if (valA > valB) return 1 * orderMultiplier;
      }
      return 0;
    });
  };

  // CANLI SWAP ALGORİTMASI
  const handleLiveSectionSwap = (draggedId, targetId) => {
    const currentSections = latestSectionsRef.current || selectedProject.sections || [];
    const sortedSections = [...currentSections].sort((a, b) => a.order - b.order);
    const draggedIdx = sortedSections.findIndex(s => s.id === draggedId);
    const targetIdx = sortedSections.findIndex(s => s.id === targetId);

    if (draggedIdx === -1 || targetIdx === -1 || draggedIdx === targetIdx) return;

    const [draggedSec] = sortedSections.splice(draggedIdx, 1);
    sortedSections.splice(targetIdx, 0, draggedSec);

    const updatedSections = sortedSections.map((s, idx) => ({ ...s, order: idx + 1 }));
    latestSectionsRef.current = updatedSections;
    setSelectedProject(prev => ({ ...prev, sections: updatedSections }));
  }

  const handleLiveTaskSwap = (dragId, hoverId) => {
    if (dragId === hoverId) return;

    const currentSections = latestSectionsRef.current || selectedProject.sections || [];
    let dragSecIdx = -1, dragTaskIdx = -1;
    let hoverSecIdx = -1, hoverTaskIdx = -1;

    for (let i = 0; i < currentSections.length; i++) {
      const ts = currentSections[i].tasks || [];
      for (let j = 0; j < ts.length; j++) {
        if (ts[j].id === dragId) { dragSecIdx = i; dragTaskIdx = j; }
        if (ts[j].id === hoverId) { hoverSecIdx = i; hoverTaskIdx = j; }
      }
    }

    if (dragSecIdx < 0 || hoverSecIdx < 0) return;

    const newSections = [...currentSections];
    const dragSec = { ...newSections[dragSecIdx], tasks: [...newSections[dragSecIdx].tasks] };
    const [draggedTask] = dragSec.tasks.splice(dragTaskIdx, 1);

    if (dragSecIdx === hoverSecIdx) {
      dragSec.tasks.splice(hoverTaskIdx, 0, draggedTask);
      newSections[dragSecIdx] = dragSec;
    } else {
      const hoverSec = { ...newSections[hoverSecIdx], tasks: [...newSections[hoverSecIdx].tasks] };
      hoverSec.tasks.splice(hoverTaskIdx, 0, { ...draggedTask, sectionId: newSections[hoverSecIdx].id });
      newSections[dragSecIdx] = dragSec;
      newSections[hoverSecIdx] = hoverSec;
    }

    latestSectionsRef.current = newSections;
    setSelectedProject(prev => ({ ...prev, sections: newSections }));
  };

  // SÜRÜKLEME BİTTİĞİNDE VERİTABANINA YAZMA
  const handleFinalSectionMove = async () => {
    if (isReadOnly) return;
    const currentSections = latestSectionsRef.current || selectedProject.sections || [];
    const orderedSectionIds = [...currentSections].sort((a, b) => a.order - b.order).map(s => s.id);
    try {
      const response = await fetch('http://localhost:5001/api/projects/sections/move', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderedSectionIds, projectId: selectedProject.id })
      })
      const data = await response.json()
      if (!response.ok) {
        alert("Sıralama kaydedilemedi.");
        window.location.reload();
      } else {
        syncProjectStates(data);
      }
    } catch (err) { console.error(err) }
  }

  const handleTopAddTaskGlobal = async (overrides = {}) => {
    if (isReadOnly) return;

    // Check if activeGroup exists instead of relying on isVirtualGrouping because it's defined later
    if (activeGroup && activeGroup !== 'Sections') {
      alert("You cannot add tasks directly into a dynamically grouped view. Please switch to 'Group by: Sections' to add tasks.");
      return;
    }

    const targetSectionId = overrides.sectionId || lastInteractedSectionId || selectedProject.sections?.[0]?.id;
    if (!targetSectionId) return;

    try {
      let bodyData = { title: 'New task', sectionId: targetSectionId, ...overrides };
      if (overrides.type === 'APPROVAL') bodyData.title = 'New approval';
      if (overrides.type === 'MILESTONE') bodyData.title = 'New milestone';

      const response = await fetch('http://localhost:5001/api/projects/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(bodyData)
      })
      const data = await response.json()
      if (response.ok) {
        handleTaskUpdate(data.id, data, 'create', targetSectionId, overrides.insertAfterTaskId || lastInteractedTaskId)
      } else { alert(data.error); }
    } catch (err) { console.error(err) }
  }

  const handleCreateSectionGlobal = async () => {
    if (isReadOnly) return;
    try {
      const response = await fetch('http://localhost:5001/api/projects/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: 'New Section', projectId: selectedProject.id })
      });
      const data = await response.json();
      if (response.ok) {
        syncProjectStates({ ...selectedProject, sections: [...(selectedProject.sections || []), { ...data, tasks: [] }] });
      } else {
        alert(data.error);
      }
    } catch (err) { console.error(err) }
  }

  const handleRenameProject = async () => {
    if ((projectRole !== 'ADMIN' && projectRole !== 'EDITOR') || !nameInput.trim() || nameInput.trim() === selectedProject.name) {
      setIsEditingName(false); return;
    }
    try {
      const response = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name: nameInput.trim() }) })
      const data = await response.json()
      if (response.ok) syncProjectStates(data)
      setIsEditingName(false)
    } catch (err) { console.error(err) }
  }

  const handleArchiveProject = async () => {
    if (projectRole !== 'ADMIN' && projectRole !== 'EDITOR') return;
    const isCurrentlyArchived = selectedProject.isArchived;
    if (!window.confirm(`Proje ${isCurrentlyArchived ? 'arşivden çıkarılsın' : 'arşivlensin'} mi?`)) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ isArchived: !isCurrentlyArchived }) })
      const data = await response.json()
      setProjects(prev => prev.map(p => p.id === selectedProject.id ? data : p));
      syncProjectStates(data);
    } catch (err) { console.error(err) }
  }

  const handleSaveAsTemplate = async () => {
    if (projectRole !== 'ADMIN' && projectRole !== 'EDITOR') return;
    if (!window.confirm("Bu projeyi şablon olarak kaydetmek istediğinize emin misiniz?")) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}/save-as-template`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } })
      if (response.ok) {
        alert('Proje başarıyla şablon olarak kaydedildi.');
      } else {
        alert('Şablon kaydedilirken bir hata oluştu.');
      }
      setIsHeaderDropdownOpen(false);
    } catch (err) { console.error(err) }
  }

  const handleDeleteProject = async () => {
    if (projectRole !== 'ADMIN') return;
    if (!window.confirm("Proje silinsin mi?")) return;
    try {
      await fetch(`http://localhost:5001/api/projects/${selectedProject.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
      setProjects(prev => prev.filter(p => p.id !== selectedProject.id)); setSelectedProject(null);
    } catch (err) { console.error(err) }
  }

  const handleCreateSection = async (e) => {
    e.preventDefault()
    if (isReadOnly || !newSectionName.trim()) return
    try {
      const response = await fetch('http://localhost:5001/api/projects/sections', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name: newSectionName, projectId: selectedProject.id }) })
      const data = await response.json()
      syncProjectStates({ ...selectedProject, sections: [...(selectedProject.sections || []), { ...data, tasks: [] }] })
      setNewSectionName('')
    } catch (err) { console.error(err) }
  }

  const handleDeleteSection = async (sectionId) => {
    if (isReadOnly) return;
    if (!window.confirm("Bölümü silmek istediğinize emin misiniz?")) return;
    try {
      await fetch(`http://localhost:5001/api/projects/sections/${sectionId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
      syncProjectStates({ ...selectedProject, sections: selectedProject.sections.filter(s => s.id !== sectionId) })
    } catch (err) { console.error(err) }
  }

  const handleRenameSection = async (sectionId, newName) => {
    if (isReadOnly || !newName.trim()) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/sections/${sectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim() })
      });
      const updatedSection = await response.json();
      if (response.ok) {
        syncProjectStates({
          ...selectedProject,
          sections: selectedProject.sections.map(s => s.id === sectionId ? updatedSection : s)
        });
      }
    } catch (err) { console.error(err); }
  }

  // --- CUSTOMIZE PANEL LOGIC ---
  const fetchProjectRules = async () => {
    try {
      const res = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}/rules`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setProjectRules(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedProject?.id) {
      fetchProjectRules();
    }
  }, [selectedProject?.id, token]);

  const openRulesView = () => {
    setCustomizeView('rules');
    fetchProjectRules();
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      const res = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}/rules/${ruleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchProjectRules();
    } catch (err) { console.error(err); }
  }

  const handleDuplicateRule = async (rule) => {
    try {
      const res = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ruleData: rule.ruleData
        })
      });
      if (res.ok) fetchProjectRules();
    } catch (err) { console.error(err); }
  }

  const handleEditRule = (rule) => {
    setRuleToEdit(rule);
    setIsRulesModalOpen(true);
  }

  // --- GERİ EKLENDİ: EKSİK OLAN GÖREV GÜNCELLEME MOTORU ---
  const handleTaskUpdate = (taskId, updatedTask, action = 'edit', sectionId = null, insertAfterTaskId = null) => {
    let updatedSections = selectedProject.sections.map(sec => {
      if (action === 'create' && sec.id === sectionId) {
        let newTasks = [...(sec.tasks || [])];
        if (insertAfterTaskId) {
          const insertIdx = newTasks.findIndex(t => t.id === insertAfterTaskId);
          if (insertIdx !== -1) {
            newTasks.splice(insertIdx + 1, 0, updatedTask);
            return { ...sec, tasks: newTasks };
          }
        }
        return { ...sec, tasks: [...newTasks, updatedTask] };
      }
      return { ...sec };
    });

    if (action === 'edit') {
      let originalSectionId = null;
      for (const sec of updatedSections) {
        if ((sec.tasks || []).some(t => t.id === taskId)) {
          originalSectionId = sec.id;
          break;
        }
      }

      let targetSectionId = updatedTask.sectionId;
      if (updatedTask.secondaryProjects) {
        const sp = updatedTask.secondaryProjects.find(p => p.projectId === selectedProject.id);
        if (sp) targetSectionId = sp.sectionId;
      }

      // If the targetSectionId doesn't exist in the current project, it means the task was removed from this project.
      const targetSectionExists = updatedSections.some(sec => sec.id === targetSectionId);

      if (originalSectionId && (originalSectionId !== targetSectionId || !targetSectionExists)) {
        updatedSections = updatedSections.map(sec => {
          if (sec.id === originalSectionId) {
            return { ...sec, tasks: (sec.tasks || []).filter(t => t.id !== taskId) };
          }
          if (sec.id === targetSectionId) {
            return { ...sec, tasks: [...(sec.tasks || []), updatedTask] };
          }
          return sec;
        });
      } else {
        updatedSections = updatedSections.map(sec => {
          return { ...sec, tasks: (sec.tasks || []).map(t => t.id === taskId ? updatedTask : t) };
        });
      }
    }
    syncProjectStates({ ...selectedProject, sections: updatedSections })
  }

  // --- GERİ EKLENDİ: EKSİK OLAN SATIR İÇİ COMPLETION METODU ---
  const handleToggleTaskCompleteInline = async (task, sectionId) => {
    if (isReadOnly) return;
    setLastInteractedSectionId(sectionId);
    setLastInteractedTaskId(task.id);

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
      if (response.ok) handleTaskUpdate(task.id, data)
    } catch (err) { console.error(err) }
  }

  // --- GERİ EKLENDİ: EKSİK OLAN LİSTE POPOVER METODU ---
  const handleOpenPopoverInline = (e, type, task, sectionId, extraProps = {}) => {
    document.body.click();
    e.stopPropagation();
    setLastInteractedSectionId(sectionId);
    setLastInteractedTaskId(task.id);
    const rect = e.currentTarget.getBoundingClientRect()

    let top = rect.bottom + 4;
    let bottom = undefined;
    // If clicking near the bottom of the window, render popover above the cell to prevent clipping
    if (e.clientY > window.innerHeight - 320) {
      top = undefined;
      bottom = window.innerHeight - rect.top + 4;
    }

    setActivePopover({ type, task, coords: { top, bottom, left: rect.left }, ...extraProps })
  }
  const handleDuplicateTask = async () => {
    const taskIdToDuplicate = contextMenu.taskId;
    setContextMenu({ visible: false, x: 0, y: 0, taskId: null });
    setApprovalMenu({ visible: false, x: 0, y: 0, task: null });
    if (isReadOnly) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${taskIdToDuplicate}/duplicate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        handleTaskUpdate(data.id, data, 'create', data.sectionId);
      } else {
        alert(data.error || "Görevi kopyalarken hata oluştu.");
      }
    } catch (err) { console.error(err) }
  }

  const executeDeleteTask = async (taskId) => {
    try {
      await fetch(`http://localhost:5001/api/projects/tasks/${taskId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
    } catch (err) { console.error(err) }
  }

  const handleDeleteTask = async (taskId) => {
    const taskIdToDelete = taskId || contextMenu.taskId;
    setContextMenu({ visible: false, x: 0, y: 0, taskId: null });

    let taskToDelete = null;
    let secId = null;
    let taskIndex = -1;
    for (const sec of selectedProject.sections) {
      const idx = sec.tasks?.findIndex(t => t.id === taskIdToDelete);
      if (idx !== -1 && idx !== undefined) {
        taskToDelete = sec.tasks[idx];
        secId = sec.id;
        taskIndex = idx;
        break;
      }
    }

    if (!taskToDelete) return;

    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timeoutId);
      executeDeleteTask(pendingDeleteRef.current.task.id);
    }

    const updatedSections = selectedProject.sections.map(sec => ({ ...sec, tasks: (sec.tasks || []).filter(t => t.id !== taskIdToDelete) }))
    syncProjectStates({ ...selectedProject, sections: updatedSections })

    const timeoutId = setTimeout(() => {
      executeDeleteTask(taskIdToDelete);
      setUndoToast(false);
      pendingDeleteRef.current = null;
    }, 5000);

    pendingDeleteRef.current = { task: taskToDelete, sectionId: secId, index: taskIndex, timeoutId };
    setUndoToast(true);
  }

  const handleUndoDelete = () => {
    if (!pendingDeleteRef.current) return;
    clearTimeout(pendingDeleteRef.current.timeoutId);

    const { task, sectionId, index } = pendingDeleteRef.current;

    const updatedSections = selectedProject.sections.map(sec => {
      if (sec.id === sectionId) {
        const newTasks = [...(sec.tasks || [])];
        newTasks.splice(index, 0, task);
        return { ...sec, tasks: newTasks };
      }
      return sec;
    });
    syncProjectStates({ ...selectedProject, sections: updatedSections });

    setUndoToast(false);
    pendingDeleteRef.current = null;
  }

  const handleConvertTask = async (newType, taskId) => {
    const taskIdToConvert = taskId || contextMenu.taskId;
    setContextMenu({ visible: false, x: 0, y: 0, taskId: null });
    if (isReadOnly) return;
    try {
      if (newType === 'PROJECT') {
        const response = await fetch(`http://localhost:5001/api/projects/tasks/${taskIdToConvert}/convert-to-project`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
          handleTaskUpdate(taskIdToConvert, data);
        } else {
          alert(data.error || "Görevi projeye dönüştürürken hata oluştu.");
        }
        return;
      }

      const response = await fetch(`http://localhost:5001/api/projects/tasks/${taskIdToConvert}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: newType })
      });
      const data = await response.json();
      if (response.ok) {
        handleTaskUpdate(taskIdToConvert, data);
      } else {
        alert(data.error || "Görevi dönüştürürken hata oluştu.");
      }
    } catch (err) { console.error(err); }
  }

  const handleOpenApprovalMenu = (e, task) => {
    if (isReadOnly) return;
    if (task.assigneeId && (!user || task.assigneeId !== user.id)) {
      return;
    }
    setApprovalMenu({ visible: true, x: e.clientX, y: e.clientY, task });
  };

  const handleApprovalStatusChange = async (status) => {
    const taskIdToUpdate = approvalMenu.task?.id;
    setApprovalMenu({ visible: false, x: 0, y: 0, task: null });
    if (!taskIdToUpdate || isReadOnly) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${taskIdToUpdate}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ approvalStatus: status === 'PENDING' ? null : status })
      });
      const data = await response.json();
      if (response.ok) {
        handleTaskUpdate(taskIdToUpdate, data);
      } else {
        alert(data.error || "Error updating approval status.");
      }
    } catch (err) { console.error(err) }
  }

  const handleGeneralDrop = async (e, targetSectionId, explicitTargetTaskId = null) => {
    e.preventDefault()
    setDraggingTaskId(null)

    const dragType = e.dataTransfer.getData('drag-type')
    if (dragType === 'task') {
      const taskId = e.dataTransfer.getData('task-id')
      if (!taskId) return

      setLastInteractedSectionId(targetSectionId);
      setLastInteractedTaskId(explicitTargetTaskId);

      let currentSections = latestSectionsRef.current || selectedProject.sections;
      let draggedTaskObj = null;
      let isAlreadyInTarget = false;

      currentSections.forEach(sec => {
        const found = (sec.tasks || []).find(t => t.id === taskId);
        if (found) {
          draggedTaskObj = found;
          if (sec.id === targetSectionId) {
            isAlreadyInTarget = true;
          }
        }
      });

      if (!draggedTaskObj) return;

      let reorderedSections = currentSections;

      if (!isAlreadyInTarget) {
        reorderedSections = currentSections.map(sec => {
          if (sec.id === draggedTaskObj.sectionId) {
            return { ...sec, tasks: (sec.tasks || []).filter(t => t.id !== taskId) };
          }
          if (sec.id === targetSectionId) {
            return { ...sec, tasks: [...(sec.tasks || []), { ...draggedTaskObj, sectionId: targetSectionId }] };
          }
          return sec;
        });
      }

      const targetSecObj = reorderedSections.find(s => s.id === targetSectionId);
      const orderedTaskIds = targetSecObj ? targetSecObj.tasks.map(t => t.id) : [];

      syncProjectStates({ ...selectedProject, sections: reorderedSections });

      try {
        const response = await fetch('http://localhost:5001/api/projects/tasks/move', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ taskId, targetSectionId, orderedTaskIds, projectId: selectedProject.id })
        })
        const result = await response.json()
        if (!response.ok) { alert(result.error || "Hata."); window.location.reload(); }
      } catch (err) { console.error(err) }
    }
  }

  const syncProjectStates = (updatedProj) => {
    setSelectedProject(updatedProj)
    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p))
  }

  const formatFriendlyDate = (startDate, dueDate) => {
    if (!dueDate) return '';
    const date = new Date(dueDate);
    const today = new Date();
    const options = { month: 'short', day: 'numeric' };
    if (date.getFullYear() !== today.getFullYear()) options.year = 'numeric';
    const formattedDue = date.toLocaleDateString('en-US', options);

    if (!startDate) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (date.toDateString() === today.toDateString()) return 'Today';
      if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
      return formattedDue;
    }

    const start = new Date(startDate);
    const startOptions = { month: 'short', day: 'numeric' };
    if (start.getFullYear() !== today.getFullYear() && start.getFullYear() !== date.getFullYear()) startOptions.year = 'numeric';
    const formattedStart = start.toLocaleDateString('en-US', startOptions);
    return `${formattedStart} - ${formattedDue}`;
  }
  const getGroupedSections = () => {
    let rawSections = selectedProject?.sections || [];
    if (!activeGroup || activeGroup === 'Sections') return null;

    let allTasks = [];
    rawSections.forEach(sec => {
      allTasks = [...allTasks, ...(sec.tasks || [])];
    });

    const groupsMap = {};

    if (activeGroup === 'Assignee') {
      groupsMap['unassigned'] = { id: `group-unassigned`, name: 'Unassigned', tasks: [] };
      if (selectedProject.owner) {
        groupsMap[selectedProject.owner.id] = { id: `group-${selectedProject.owner.id}`, name: selectedProject.owner.name, tasks: [] };
      }
      if (selectedProject.members) {
        selectedProject.members.forEach(m => {
          const u = m.user || m;
          if (u && u.id && u.name) {
            groupsMap[u.id] = { id: `group-${u.id}`, name: u.name, tasks: [] };
          }
        });
      }
    } else if (['Start date', 'Due date', 'Created on', 'Last modified on', 'Completed on'].includes(activeGroup)) {
      const buckets = [
        { key: 'today', name: 'Today', sortValue: 0 },
        { key: 'yesterday', name: 'Yesterday', sortValue: -1 },
        { key: 'tomorrow', name: 'Tomorrow', sortValue: 1 },
        { key: 'last-7', name: 'Last 7 days', sortValue: -7 },
        { key: 'next-7', name: 'Next 7 days', sortValue: 7 },
        { key: 'no-date', name: `No ${activeGroup.toLowerCase()}`, sortValue: 999999 }
      ];
      buckets.forEach(b => {
        groupsMap[b.key] = { id: `group-${b.key}`, name: b.name, tasks: [], sortValue: b.sortValue };
      });
    } else {
      const customFieldsList = getParsedCustomFields(selectedProject);
      const cf = customFieldsList.find(f => f.title === activeGroup);
      if (cf && cf.type === 'github_pr') {
        const statuses = GITHUB_PR_STATUSES.map(s => ({ key: s, sortValue: GITHUB_PR_SORT_MAP[s] || 8 }));
        statuses.forEach(s => {
          groupsMap[s.key] = { id: `group-${s.key}`, name: s.key, tasks: [], sortValue: s.sortValue };
        });
        groupsMap['empty'] = { id: 'group-empty', name: 'Empty', tasks: [], sortValue: 99 };
      } else if (cf && Array.isArray(cf.options)) {
        cf.options.forEach(opt => {
          const optName = opt.value || opt.label;
          if (optName) {
            groupsMap[optName] = { id: `group-${optName}`, name: optName, tasks: [] };
          }
        });
        groupsMap['empty'] = { id: 'group-empty', name: 'Empty', tasks: [] };
      }
    }

    const getDateGroup = (dateString, typeName) => {
      if (!dateString) return { key: 'no-date', name: `No ${typeName.toLowerCase()}`, sortValue: 999999 };

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const d = new Date(dateString);
      d.setHours(0, 0, 0, 0);

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

    const getGroupKeyAndName = (task) => {
      switch (activeGroup) {
        case 'Assignee':
          return task.assignee ? { key: task.assigneeId, name: task.assignee.name } : { key: 'unassigned', name: 'Unassigned' };
        case 'Created by':
          return task.creator ? { key: task.creatorId, name: task.creator.name } : { key: 'unknown', name: 'Unknown' };
        case 'Start date':
          return getDateGroup(task.startDate, 'start date');
        case 'Due date':
          return getDateGroup(task.dueDate, 'due date');
        case 'Created on':
          return getDateGroup(task.createdAt, 'created on');
        case 'Last modified on':
          return getDateGroup(task.updatedAt, 'last modified on');
        case 'Completed on':
          if (!task.completedAt && !task.isCompleted) return { key: 'no-date', name: 'No completed on date', sortValue: 999999 };
          if (!task.completedAt && task.isCompleted) return { key: 'completed-no-date', name: 'Completed (No date)', sortValue: 999998 };
          return getDateGroup(task.completedAt, 'completed on');
        case 'Project':
          return { key: selectedProject.id, name: selectedProject.name };
        default:
          const customFieldsList = getParsedCustomFields(selectedProject);
          const cf = customFieldsList.find(f => f.title === activeGroup);
          if (cf) {
            if (cf.type === 'github_pr') {
              let prs = getParsedGithubPRs(task.githubPRs);
              if (!prs || prs.length === 0) return { key: 'empty', name: 'Empty' };

              const label = getGithubPRStatusLabel(prs[0]);
              const sortVal = GITHUB_PR_SORT_MAP[label] || 8;

              return { key: label, name: label, sortValue: sortVal };
            }

            let taskFields = {};
            if (typeof task.customFields === 'string') { try { taskFields = JSON.parse(task.customFields); } catch (e) { } } else if (task.customFields) taskFields = task.customFields;
            const val = taskFields[cf.id];

            if (Array.isArray(cf.options) && cf.options.length > 0) {
              const opt = cf.options.find(o => (o.value || o.label) === val);
              const optName = opt ? (opt.value || opt.label) : val;
              return val ? { key: val, name: optName } : { key: 'empty', name: 'Empty' };
            }
            return val ? { key: val, name: val } : { key: 'empty', name: 'Empty' };
          }
          return { key: 'other', name: 'Other' };
      }
    };

    allTasks.forEach(task => {
      const { key, name, sortValue } = getGroupKeyAndName(task);
      if (!groupsMap[key]) {
        groupsMap[key] = { id: `group-${key}`, name: name, tasks: [], sortValue: sortValue };
      }
      groupsMap[key].tasks.push(task);
    });

    let groupedSections = Object.values(groupsMap).map(g => ({
      ...g,
      tasks: applyTaskSort ? applyTaskSort(applyTaskFilter(g.tasks)) : applyTaskFilter(g.tasks)
    }));

    if (!showEmptyGroups) {
      groupedSections = groupedSections.filter(g => g.tasks.length > 0);
    }

    groupedSections.sort((a, b) => {
      if (a.key === 'unassigned' || a.key === 'no-date' || a.key === 'empty') return 1;
      if (b.key === 'unassigned' || b.key === 'no-date' || b.key === 'empty') return -1;

      if (a.sortValue !== undefined && b.sortValue !== undefined) {
        if (a.sortValue < b.sortValue) return groupOrder === 'Ascending' ? -1 : 1;
        if (a.sortValue > b.sortValue) return groupOrder === 'Ascending' ? 1 : -1;
        return 0;
      }

      const valA = a.name.toLowerCase();
      const valB = b.name.toLowerCase();
      if (valA < valB) return groupOrder === 'Ascending' ? -1 : 1;
      if (valA > valB) return groupOrder === 'Ascending' ? 1 : -1;
      return 0;
    });

    return groupedSections;
  };

  const virtualGroupedSections = getGroupedSections();
  const isVirtualGrouping = activeGroup && activeGroup !== 'Sections';

  const renderActiveFiltersList = (isOptionsPane = false) => {
    return (
      <>
        {activeFilters.filter(f => typeof f === 'object').length > 0 && activeFilters.map((filter, idx) => {
          if (typeof filter !== 'object') return null;
          const operators = getOperatorsForFilter(filter);
          const hasNoValue = ['is empty', 'is not empty'].includes(filter.operator);
          const hasTwoValues = ['is between', 'is not between'].includes(filter.operator);

          const formatVal = (val) => {
            if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '';
            if (typeof val === 'object' && val !== null) return '';
            return val || '';
          };

          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>

              {/* Field Box */}
              <div style={{ position: 'relative', flex: 1, minWidth: '120px' }}>
                <div onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(prev => prev?.index === idx && prev?.type === 'field' ? null : { index: idx, type: 'field' }) }} style={{ border: '1px solid #D1D5DB', borderRadius: '6px', padding: '6px 12px', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{filter.icon}</span> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{filter.field}</span> <span style={{ color: '#9CA3AF', marginLeft: 'auto' }}>⌄</span>
                </div>
                {openFilterDropdown?.index === idx && openFilterDropdown?.type === 'field' && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, width: '220px', backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', zIndex: 102, marginTop: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                    {[
                      { icon: '✓', label: 'Completion status' },
                      { icon: '👤', label: 'Assignee' },
                      { icon: '📅', label: 'Start date', type: 'date' },
                      { icon: '📅', label: 'Due date', type: 'date' },
                      { icon: '👤', label: 'Created by' },
                      { icon: '🕒', label: 'Created on', type: 'date' },
                      { icon: '✏️', label: 'Last modified on', type: 'date' },
                      { icon: '✓', label: 'Completed on', type: 'date' },
                      { icon: '✓', label: 'Task type' },
                      ...getParsedCustomFields(selectedProject).map(cf => ({ icon: 'A', label: cf.title, type: cf.type || cf.fieldType, options: cf.options }))
                    ].map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        onClick={(e) => {
                          e.stopPropagation();
                          let defOperator = 'is';
                          let defValue = '';
                          const isDateField = ['Start date', 'Due date', 'Created on', 'Completed on', 'Last modified on'].includes(item.label) || item.type === 'date';
                          const isAssigneeField = ['Assignee', 'Created by'].includes(item.label);
                          const isMulti = item.type === 'multi_select';

                          if (isDateField) {
                            defOperator = 'is between';
                            defValue = { start: '', end: '' };
                          } else if (isAssigneeField) {
                            defOperator = 'is';
                            defValue = null;
                          } else if (item.label === 'Completion status') {
                            defOperator = 'is';
                            defValue = 'Incomplete';
                          } else if (item.label === 'Task type') {
                            defOperator = 'is';
                            defValue = 'Task';
                          } else if (isMulti) {
                            defOperator = 'contains any';
                            defValue = [];
                          } else {
                            defOperator = 'is';
                            defValue = null;
                          }

                          const newFilters = [...activeFilters];
                          newFilters[idx] = { field: item.label, icon: item.icon, operator: defOperator, value: defValue, type: item.type, options: item.options };
                          setActiveFilters(newFilters);
                          setOpenFilterDropdown(null);
                        }}
                      >
                        <span style={{ color: 'var(--text-secondary)' }}>{item.icon}</span> {item.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ position: 'relative', flex: 1, minWidth: '120px' }}>
                <div onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(prev => prev?.index === idx && prev?.type === 'operator' ? null : { index: idx, type: 'operator' }) }} style={{ border: '1px solid #D1D5DB', borderRadius: '6px', padding: '6px 12px', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{filter.operator}</span> <span style={{ color: '#9CA3AF', marginLeft: 'auto' }}>⌄</span>
                </div>
                {openFilterDropdown?.index === idx && openFilterDropdown?.type === 'operator' && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 101, marginTop: '4px', padding: '4px 0', minWidth: '120px' }}>
                    {operators.map(op => (
                      <div key={op} onClick={(e) => { e.stopPropagation(); updateActiveFilter(idx, 'operator', op); setOpenFilterDropdown(null); }} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)', backgroundColor: filter.operator === op ? '#EEF2F6' : 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = filter.operator === op ? '#EEF2F6' : 'transparent'}>
                        {op}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!hasNoValue && (
                <>
                  {hasTwoValues ? (
                    <>
                      <div style={{ position: 'relative', flex: 1, minWidth: '120px' }}>
                        <div onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(prev => prev?.index === idx && prev?.type === 'value_start' ? null : { index: idx, type: 'value_start' }) }} style={{ border: '1px solid #D1D5DB', borderRadius: '6px', padding: '6px 12px', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{filter.value?.start ? new Date(filter.value.start).toLocaleDateString() : '\u00A0'}</span> <span style={{ color: '#9CA3AF', marginLeft: 'auto' }}>⌄</span>
                        </div>
                        {openFilterDropdown?.index === idx && openFilterDropdown?.type === 'value_start' && (
                          <FilterValueDropdown filter={filter} type="value_start" onSelect={(v) => { updateActiveFilter(idx, 'value', v); setOpenFilterDropdown(null); }} project={selectedProject} alignRight={false} />
                        )}
                      </div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>and</span>
                      <div style={{ position: 'relative', flex: 1, minWidth: '120px' }}>
                        <div onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(prev => prev?.index === idx && prev?.type === 'value_end' ? null : { index: idx, type: 'value_end' }) }} style={{ border: '1px solid #D1D5DB', borderRadius: '6px', padding: '6px 12px', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{filter.value?.end ? new Date(filter.value.end).toLocaleDateString() : '\u00A0'}</span> <span style={{ color: '#9CA3AF', marginLeft: 'auto' }}>⌄</span>
                        </div>
                        {openFilterDropdown?.index === idx && openFilterDropdown?.type === 'value_end' && (
                          <FilterValueDropdown filter={filter} type="value_end" onSelect={(v) => { updateActiveFilter(idx, 'value', v); setOpenFilterDropdown(null); }} project={selectedProject} alignRight={isOptionsPane} />
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ position: 'relative', flex: 1, minWidth: '120px' }}>
                      <div onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(prev => prev?.index === idx && prev?.type === 'value' ? null : { index: idx, type: 'value' }) }} style={{ border: '1px solid #D1D5DB', borderRadius: '6px', padding: '6px 12px', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatVal(filter.value) || '\u00A0'}</span> <span style={{ color: '#9CA3AF', marginLeft: 'auto' }}>⌄</span>
                      </div>
                      {openFilterDropdown?.index === idx && openFilterDropdown?.type === 'value' && (
                        <FilterValueDropdown filter={filter} type="value" onSelect={(v) => { updateActiveFilter(idx, 'value', v); setOpenFilterDropdown(null); }} project={selectedProject} alignRight={false} />
                      )}
                    </div>
                  )}
                </>
              )}

              <span
                style={{ cursor: 'pointer', color: 'var(--text-secondary)', padding: '0 4px', fontSize: '1.2rem' }}
                onClick={(e) => { e.stopPropagation(); setActiveFilters(activeFilters.filter((_, i) => i !== idx)) }}
              >×</span>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div style={styles.boardContainer}>
      {/* 1. SATIR: ASANA MAIN HEADER */}
      <div style={styles.asanaMainHeader}>
        <div style={styles.headerLeftBlock}>
          <div style={{ position: 'relative' }}>
            <div
              style={{ ...styles.asanaProjectIcon, backgroundColor: selectedProject.color || '#4F46E5', cursor: (projectRole === 'ADMIN' || projectRole === 'EDITOR') ? 'pointer' : 'default' }}
              onClick={(e) => {
                if (projectRole === 'ADMIN' || projectRole === 'EDITOR') {
                  document.body.click();
                  e.stopPropagation();
                  setIsIconPickerOpen(!isIconPickerOpen);
                }
              }}
            >
              {selectedProject.icon || '📋'}
            </div>
            {isIconPickerOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', zIndex: 10000 }}>
                <IconColorPicker
                  selectedColor={selectedProject.color || '#4F46E5'}
                  setSelectedColor={(c) => handleUpdateIconColor(c, selectedProject.icon || '📋')}
                  selectedIcon={selectedProject.icon || '📋'}
                  setSelectedIcon={(i) => handleUpdateIconColor(selectedProject.color || '#4F46E5', i)}
                  onClose={() => setIsIconPickerOpen(false)}
                />
              </div>
            )}
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            {isEditingName ? (
              <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)} onBlur={handleRenameProject} onKeyDown={e => e.key === 'Enter' && handleRenameProject()} style={styles.renameInputInline} autoFocus />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <h1 style={styles.projectTitleText}>{selectedProject.name}</h1>
                <button onClick={(e) => { document.body.click(); e.stopPropagation(); setIsHeaderDropdownOpen(!isHeaderDropdownOpen); }} style={styles.titleDropdownArrowBtn}>▼</button>
              </div>
            )}
            {isHeaderDropdownOpen && (
              <div style={styles.titleActionDropdown} onClick={(e) => e.stopPropagation()}>
                {projectRole === 'ADMIN' ? (
                  <>
                    <div onClick={() => { setIsEditingName(true); setIsHeaderDropdownOpen(false); }} style={styles.dropdownOptionItem}>✏️ Rename Project</div>
                    <div onClick={handleArchiveProject} style={styles.dropdownOptionItem}>📦 {selectedProject?.isArchived ? 'Unarchive Project' : 'Archive Project'}</div>
                    <div onClick={handleSaveAsTemplate} style={styles.dropdownOptionItem}>💾 Save as Template</div>
                    <div style={styles.dropdownDivider}></div>
                    <div onClick={handleDeleteProject} style={{ ...styles.dropdownOptionItem, color: '#EF4444' }}>🗑️ Delete Project</div>
                  </>
                ) : (
                  <div style={{ ...styles.dropdownOptionItem, color: '#9CA3AF', cursor: 'not-allowed' }}>🔒 No admin rights</div>
                )}
              </div>
            )}
          </div>
          <span
            style={{
              ...styles.starIconStyle,
              color: selectedProject?.starredBy?.some(s => s.userId === user.id) ? '#F59E0B' : 'var(--text-tertiary)'
            }}
            onClick={handleToggleStar}
          >
            {selectedProject?.starredBy?.some(s => s.userId === user.id) ? '★' : '☆'}
          </span>

          {/* Status Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { document.body.click(); e.stopPropagation(); setIsStatusDropdownOpen(!isStatusDropdownOpen); }}
              style={{
                ...styles.setStatusDummyBtn,
                backgroundColor: selectedProject.status && selectedProject.status !== 'NONE' ? projectStatuses.find(s => s.id === selectedProject.status)?.bgColor : 'transparent',
                color: selectedProject.status && selectedProject.status !== 'NONE' ? projectStatuses.find(s => s.id === selectedProject.status)?.color : 'var(--text-secondary)',
                border: selectedProject.status && selectedProject.status !== 'NONE' ? 'none' : '1px dashed #D1D5DB'
              }}
            >
              {selectedProject.status && selectedProject.status !== 'NONE' ? (
                <>
                  {projectStatuses.find(s => s.id === selectedProject.status)?.icon}{' '}
                  {projectStatuses.find(s => s.id === selectedProject.status)?.label} ▼
                </>
              ) : (
                'Set status ▼'
              )}
            </button>

            {isStatusDropdownOpen && (
              <div style={styles.statusDropdownMenu} onClick={(e) => e.stopPropagation()}>
                {projectStatuses.map(status => {
                  if (status.isDivider) {
                    return <div key="divider" style={{ height: '1px', backgroundColor: 'var(--text-primary)', margin: '4px 0' }} />;
                  }
                  return (
                    <div
                      key={status.id}
                      style={{
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        marginBottom: '2px',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--text-primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      onClick={() => handleSetProjectStatus(status.id)}
                    >
                      <span style={{
                        backgroundColor: status.bgColor,
                        color: status.color,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>{status.icon}</span> {status.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={styles.headerRightBlock}>
          <div style={styles.avatarListWrapper}>
            <div
              style={styles.avatarCircleOwner}
              onClick={(e) => { e.stopPropagation(); setIsShareModalOpen(true); }}
            >
              {selectedProject.owner?.name?.[0].toUpperCase()}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setIsShareModalOpen(true); }} style={{ ...styles.asanaShareButtonLight, fontWeight: 'normal' }}>👥 Share</button>
          <button id="customize-pane-toggle-btn" onClick={(e) => { e.stopPropagation(); setIsCustomizePanelOpen(prev => !prev); setIsOptionsPaneOpen(false); }} style={styles.asanaCustomizeBtn}>🎛️ Customize</button>
        </div>
      </div>

      {/* 2. SATIR: ASANA TAB BAR */}
      <div style={styles.asanaTabsRow}>
        {parsedViews.map(view => (
          <span
            key={view.id}
            className="view-tab-item"
            draggable
            onDragStart={(e) => {
              setDraggingTabId(view.id);
              e.dataTransfer.setData('text/plain', view.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (draggingTabId && draggingTabId !== view.id) {
                const rect = e.currentTarget.getBoundingClientRect();
                const hoverMiddleX = (rect.right - rect.left) / 2;
                const hoverClientX = e.clientX - rect.left;

                const draggingIndex = parsedViews.findIndex(v => v.id === draggingTabId);
                const hoverIndex = parsedViews.findIndex(v => v.id === view.id);

                if (draggingIndex < hoverIndex && hoverClientX < hoverMiddleX) return;
                if (draggingIndex > hoverIndex && hoverClientX > hoverMiddleX) return;

                handleLiveTabSwap(draggingTabId, view.id);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleTabDrop();
            }}
            onDragEnd={() => {
              setDraggingTabId(null);
              setDropTargetTab({ id: null, position: null });
            }}
            onClick={() => setCurrentTab(view.id)}
            onContextMenu={(e) => {
              if (isReadOnly) return;
              e.preventDefault();
              setTabContextMenu({ visible: true, x: e.clientX, y: e.clientY, view });
            }}
            style={{
              ...(activeViewObj.id === view.id ? styles.tabItemActive : styles.tabItemPassive),
              opacity: draggingTabId === view.id ? 0.5 : 1,
              cursor: draggingTabId === view.id ? 'grabbing' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span className="view-tab-text" data-text={view.name} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
              {view.name}
            </span>
            {selectedProject.defaultView === view.id && <span style={{ fontSize: '10px' }}>⭐</span>}
          </span>
        ))}
        <div style={{ position: 'relative' }}>
          <span
            className="view-tab-item"
            style={{ ...styles.tabItemPassive, cursor: 'pointer', padding: '6px 12px', borderRadius: '6px' }}
            onClick={(e) => { e.stopPropagation(); setIsAddViewMenuOpen(!isAddViewMenuOpen); }}
          >
            +
          </span>
          {isAddViewMenuOpen && (
            <div style={{ ...styles.addWidgetDropdownMenu, top: '100%', left: 0, marginTop: '4px', zIndex: 100 }} onClick={(e) => e.stopPropagation()}>
              {['Overview', 'List', 'Board', 'Timeline', 'Gantt', 'Dashboard', 'Calendar', 'Workload', 'Note', 'Files', 'Messages'].map(type => (
                <div key={type} style={styles.addWidgetDropdownItem} onClick={() => handleAddView(type)}>
                  {type}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. SATIR: OPTIONS SUB-HEADER */}
      {activeViewObj.type !== 'Overview' && activeViewObj.type !== 'Note' && activeViewObj.type !== 'Files' && activeViewObj.type !== 'Messages' && (
        <div style={styles.asanaOptionsSubHeader}>
          {activeViewObj.type === 'Dashboard' ? (
            <div>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  style={styles.addTaskDropdownBtn}
                  disabled={isReadOnly}
                  onClick={(e) => { e.stopPropagation(); setIsAddWidgetMenuOpen(!isAddWidgetMenuOpen); }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#818CF8'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366F1'}
                >
                  <span style={{ fontWeight: '700' }}>+</span> Add widget
                </button>
                {isAddWidgetMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    zIndex: 10001,
                    minWidth: '160px',
                    padding: '4px 0',
                    animation: 'fadeIn 0.15s ease',
                  }}>
                    <button
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 16px', border: 'none', background: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      onClick={() => { setIsAddWidgetMenuOpen(false); window.dispatchEvent(new CustomEvent('openAddChartModal')); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="12" width="4" height="9" rx="1" /><rect x="10" y="6" width="4" height="15" rx="1" /><rect x="17" y="3" width="4" height="18" rx="1" /></svg>
                      Chart
                    </button>
                    <button
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 16px', border: 'none', background: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      onClick={() => { setIsAddWidgetMenuOpen(false); window.dispatchEvent(new CustomEvent('openAddTextWidget')); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></svg>
                      Text
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
              <button
                style={{ ...styles.addTaskDropdownBtn, borderTopRightRadius: 0, borderBottomRightRadius: 0, paddingRight: '0.5rem' }}
                disabled={isReadOnly}
                onClick={(e) => { e.stopPropagation(); handleTopAddTaskGlobal(); }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#818CF8'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366F1'}
              >
                <span style={{ fontWeight: '700' }}>+</span> Add task
              </button>
              <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.2)', margin: '4px 0', zIndex: 1 }} />
              <button
                style={{ ...styles.addTaskDropdownBtn, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, paddingLeft: '0.4rem', paddingRight: '0.4rem' }}
                disabled={isReadOnly}
                onClick={(e) => { e.stopPropagation(); setIsAddTaskMenuOpen(!isAddTaskMenuOpen); }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#818CF8'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366F1'}
              >
                <span style={{ fontSize: '0.6rem' }}>▼</span>
              </button>

              {isAddTaskMenuOpen && (
                <div style={{ ...styles.addWidgetDropdownMenu, top: '100%', left: 0 }} onClick={(e) => e.stopPropagation()}>
                  <div style={styles.addWidgetDropdownItem} onClick={() => { handleTopAddTaskGlobal(); setIsAddTaskMenuOpen(false); }}>
                    <span style={{ color: 'var(--text-secondary)', marginRight: '8px' }}>✓</span> Task <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-tertiary)', paddingLeft: '2rem' }}>Default</span>
                  </div>
                  <div style={styles.addWidgetDropdownItem} onClick={() => { handleTopAddTaskGlobal({ type: 'APPROVAL' }); setIsAddTaskMenuOpen(false); }}>
                    <span style={{ color: 'var(--text-secondary)', marginRight: '8px' }}>⚖️</span> Approval
                  </div>
                  <div style={styles.addWidgetDropdownItem} onClick={() => { handleTopAddTaskGlobal({ type: 'MILESTONE' }); setIsAddTaskMenuOpen(false); }}>
                    <span style={{ color: 'var(--text-secondary)', marginRight: '8px' }}>◇</span> Milestone
                  </div>
                  <div style={styles.addWidgetDropdownItem} onClick={() => { handleCreateSectionGlobal(); setIsAddTaskMenuOpen(false); }}>
                    <span style={{ color: 'var(--text-secondary)', marginRight: '8px' }}>≡</span> Section
                  </div>
                </div>
              )}
            </div>
          )}

          {['Gantt', 'Timeline', 'Workload', 'Calendar'].includes(activeViewObj.type) && (
            <div style={{ display: 'flex', alignItems: 'center', marginLeft: '1rem', gap: '0.5rem' }}>
              <button
                style={{ padding: '0.4rem 0.6rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                onClick={() => window.dispatchEvent(new CustomEvent('timeline-scroll-left'))}
              >
                &lt;
              </button>
              <button
                style={{ padding: '0.4rem 1rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', color: 'var(--text-primary)' }}
                onClick={() => window.dispatchEvent(new CustomEvent('timeline-go-today'))}
              >
                Today
              </button>
              <button
                style={{ padding: '0.4rem 0.6rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                onClick={() => window.dispatchEvent(new CustomEvent('timeline-scroll-right'))}
              >
                &gt;
              </button>
            </div>
          )}
          <div id="timeline-topbar-portal" style={{ display: 'flex', alignItems: 'center', marginLeft: '1rem', gap: '1rem', flexShrink: 0 }}></div>

          {activeViewObj.type !== 'Dashboard' && (
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <div style={styles.optionsRightGroup}>
                <div style={{ position: 'relative' }}>
                  <div className="option-sub-item" style={{ ...styles.optionSubItem, backgroundColor: isFilterDropdownOpen || activeFilters.length > 0 ? '#EEF2F6' : 'transparent', fontWeight: '500' }} onClick={(e) => { document.body.click(); e.stopPropagation(); setIsFilterDropdownOpen(!isFilterDropdownOpen); }}>
                    <span style={styles.optionIcon}>📊</span> Filter {activeFilters.length > 0 && `(${activeFilters.length})`}
                    {activeFilters.length > 0 && (
                      <span
                        onClick={(e) => { e.stopPropagation(); setActiveFilters([]); }}
                        style={{ marginLeft: '4px', padding: '0 4px', color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >×</span>
                    )}
                  </div>
                  {isFilterDropdownOpen && (
                    <div style={{ ...styles.groupDropdownPanel, right: '-150px', minWidth: '600px', padding: '16px' }} onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(null); }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <span style={{ fontWeight: '500', fontSize: '1rem', color: 'var(--text-primary)' }}>Filters</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setActiveFilters([])}>Clear</span>
                      </div>

                      {/* Quick filters */}
                      <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>Quick filters</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          <div onClick={() => handleToggleFilter('incomplete')} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: activeFilters.includes('incomplete') ? '1px solid #4F46E5' : '1px solid #D1D5DB', borderRadius: '16px', padding: '4px 12px', fontSize: '0.85rem', color: activeFilters.includes('incomplete') ? '#4F46E5' : 'var(--text-primary)', backgroundColor: activeFilters.includes('incomplete') ? '#EEF2F6' : 'transparent', cursor: 'pointer' }}>
                            <span style={{ color: activeFilters.includes('incomplete') ? '#4F46E5' : 'var(--text-secondary)' }}>✓</span> Incomplete tasks
                          </div>
                          <div onClick={() => handleToggleFilter('completed')} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: activeFilters.includes('completed') ? '1px solid #4F46E5' : '1px solid #D1D5DB', borderRadius: '16px', padding: '4px 12px', fontSize: '0.85rem', color: activeFilters.includes('completed') ? '#4F46E5' : 'var(--text-primary)', backgroundColor: activeFilters.includes('completed') ? '#EEF2F6' : 'transparent', cursor: 'pointer' }}>
                            <span style={{ color: activeFilters.includes('completed') ? '#4F46E5' : 'var(--text-secondary)' }}>✓</span> Completed tasks
                          </div>
                          <div onClick={() => handleToggleFilter('my-tasks')} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: activeFilters.includes('my-tasks') ? '1px solid #4F46E5' : '1px solid #D1D5DB', borderRadius: '16px', padding: '4px 12px', fontSize: '0.85rem', color: activeFilters.includes('my-tasks') ? '#4F46E5' : 'var(--text-primary)', backgroundColor: activeFilters.includes('my-tasks') ? '#EEF2F6' : 'transparent', cursor: 'pointer' }}>
                            <span style={{ color: activeFilters.includes('my-tasks') ? '#4F46E5' : 'var(--text-secondary)' }}>👤</span> Just my tasks
                          </div>
                          <div onClick={() => handleToggleFilter('this-week')} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: activeFilters.includes('this-week') ? '1px solid #4F46E5' : '1px solid #D1D5DB', borderRadius: '16px', padding: '4px 12px', fontSize: '0.85rem', color: activeFilters.includes('this-week') ? '#4F46E5' : 'var(--text-primary)', backgroundColor: activeFilters.includes('this-week') ? '#EEF2F6' : 'transparent', cursor: 'pointer' }}>
                            <span style={{ color: activeFilters.includes('this-week') ? '#4F46E5' : 'var(--text-secondary)' }}>📅</span> Due this week
                          </div>
                          <div onClick={() => handleToggleFilter('next-week')} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: activeFilters.includes('next-week') ? '1px solid #4F46E5' : '1px solid #D1D5DB', borderRadius: '16px', padding: '4px 12px', fontSize: '0.85rem', color: activeFilters.includes('next-week') ? '#4F46E5' : 'var(--text-primary)', backgroundColor: activeFilters.includes('next-week') ? '#EEF2F6' : 'transparent', cursor: 'pointer' }}>
                            <span style={{ color: activeFilters.includes('next-week') ? '#4F46E5' : 'var(--text-secondary)' }}>📅</span> Due next week
                          </div>
                        </div>
                      </div>

                      {/* All filters */}
                      <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>All filters</div>

                        {renderActiveFiltersList()}
                      </div>

                      <div style={{ position: 'relative' }}>
                        <div
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem' }}
                          onClick={() => setIsFilterInnerMenuOpen(!isFilterInnerMenuOpen)}
                        >
                          <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>+</span> Add filter ⌄
                        </div>

                        {isFilterInnerMenuOpen && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, width: '220px', backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', zIndex: 100, marginTop: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                            {[
                              { icon: '✓', label: 'Completion status' },
                              { icon: '👤', label: 'Assignee' },
                              { icon: '📅', label: 'Start date', type: 'date' },
                              { icon: '📅', label: 'Due date', type: 'date' },
                              { icon: '👤', label: 'Created by' },
                              { icon: '🕒', label: 'Created on', type: 'date' },
                              { icon: '✏️', label: 'Last modified on', type: 'date' },
                              { icon: '✓', label: 'Completed on', type: 'date' },
                              { icon: '✓', label: 'Task type' },
                              ...getParsedCustomFields(selectedProject).map(cf => ({ icon: 'A', label: cf.title, type: cf.type || cf.fieldType, options: cf.options }))
                            ].map((item, idx) => (
                              <div
                                key={idx}
                                style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                onClick={() => {
                                  let defOperator = 'is';
                                  let defValue = 'Today';
                                  const filterType = (item.type || '').toLowerCase();
                                  const isDateField = ['Start date', 'Due date', 'Created on', 'Completed on', 'Last modified on'].includes(item.label) || filterType === 'date';
                                  const isAssigneeField = ['Assignee', 'Created by'].includes(item.label);
                                  const isMulti = filterType === 'multi_select' || filterType === 'multi-select';

                                  if (isDateField) {
                                    defOperator = 'is between';
                                    defValue = { start: '', end: '' };
                                  } else if (isAssigneeField) {
                                    defOperator = 'is';
                                    defValue = null;
                                  } else if (item.label === 'Completion status') {
                                    defOperator = 'is';
                                    defValue = 'Incomplete';
                                  } else if (item.label === 'Task type') {
                                    defOperator = 'is';
                                    defValue = 'Task';
                                  } else if (isMulti) {
                                    defOperator = 'contains any';
                                    defValue = [];
                                  } else {
                                    defOperator = 'is';
                                    defValue = null;
                                  }

                                  setActiveFilters([...activeFilters, { field: item.label, icon: item.icon, operator: defOperator, value: defValue, type: item.type, options: item.options }]);
                                  setIsFilterInnerMenuOpen(false);
                                }}
                              >
                                <span style={{ color: 'var(--text-secondary)', width: '16px', textAlign: 'center' }}>{item.icon}</span>
                                <span>{item.label}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <div
                    className="option-sub-item"
                    style={{ ...styles.optionSubItem, backgroundColor: isSortDropdownOpen || activeSorts.length > 0 ? '#EEF2F6' : 'transparent', fontWeight: '500' }}
                    onClick={(e) => { document.body.click(); e.stopPropagation(); setIsSortDropdownOpen(!isSortDropdownOpen); setSortDropdownView('main'); }}
                  >
                    <span style={styles.optionIcon}>⇅</span> Sort {activeSorts.length > 0 && `(${activeSorts.length})`}
                    {activeSorts.length > 0 && (
                      <span
                        onClick={(e) => { e.stopPropagation(); setActiveSorts([]); }}
                        style={{ marginLeft: '4px', padding: '0 4px', color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >×</span>
                    )}
                  </div>
                  {isSortDropdownOpen && (
                    <div style={{ ...styles.sortDropdownMenu, width: activeSorts.length > 0 ? '400px' : styles.sortDropdownMenu.width, padding: activeSorts.length > 0 ? '16px' : styles.sortDropdownMenu.padding }} onClick={(e) => e.stopPropagation()}>
                      {activeSorts.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>Sorts</span>
                            <button onClick={() => { setActiveSorts([]); setIsSortDropdownOpen(false); }} style={{ background: 'none', border: 'none', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>Clear</button>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {activeSorts.map((sortObj, sIdx) => (
                              <div 
                                key={sIdx} 
                                draggable
                                onDragStart={(e) => {
                                  setDraggingSortIdx(sIdx);
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  if (draggingSortIdx === null || draggingSortIdx === sIdx) return;
                                  
                                  const newSorts = [...activeSorts];
                                  const [removed] = newSorts.splice(draggingSortIdx, 1);
                                  newSorts.splice(sIdx, 0, removed);
                                  setActiveSorts(newSorts);
                                  setDraggingSortIdx(sIdx);
                                }}
                                onDragEnd={() => setDraggingSortIdx(null)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', opacity: draggingSortIdx === sIdx ? 0.5 : 1, cursor: 'grab' }}
                              >
                                <span style={{ cursor: 'grab', color: 'var(--text-tertiary)', padding: '0 0.2rem', display: 'flex', alignItems: 'center', userSelect: 'none', fontSize: '1.2rem' }}>
                                  ⋮⋮
                                </span>
                                <div style={{ flex: 1, border: '1px solid #D1D5DB', borderRadius: '6px', padding: '6px 12px', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-primary)' }}>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{sortObj.field}</span>
                                </div>
                                <div style={{ position: 'relative', width: '120px' }}>
                                  <div onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(prev => prev?.index === `sort-${sIdx}` && prev?.type === 'direction' ? null : { index: `sort-${sIdx}`, type: 'direction' }) }} style={{ border: '1px solid #D1D5DB', borderRadius: '6px', padding: '6px 12px', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    {sortObj.direction === 'asc' ? 'Ascending' : 'Descending'} <span style={{ color: '#9CA3AF', marginLeft: 'auto' }}>⌄</span>
                                  </div>
                                  {openFilterDropdown?.index === `sort-${sIdx}` && openFilterDropdown?.type === 'direction' && (
                                    <div style={{ position: 'absolute', top: '100%', right: 0, width: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 101, marginTop: '4px', padding: '4px 0' }}>
                                      <div onClick={(e) => { e.stopPropagation(); const ns = [...activeSorts]; ns[sIdx].direction = 'asc'; setActiveSorts(ns); setOpenFilterDropdown(null); }} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)', backgroundColor: sortObj.direction === 'asc' ? '#EEF2F6' : 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = sortObj.direction === 'asc' ? '#EEF2F6' : 'transparent'}>Ascending</div>
                                      <div onClick={(e) => { e.stopPropagation(); const ns = [...activeSorts]; ns[sIdx].direction = 'desc'; setActiveSorts(ns); setOpenFilterDropdown(null); }} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)', backgroundColor: sortObj.direction === 'desc' ? '#EEF2F6' : 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = sortObj.direction === 'desc' ? '#EEF2F6' : 'transparent'}>Descending</div>
                                    </div>
                                  )}
                                </div>
                                <span
                                  style={{ cursor: 'pointer', color: 'var(--text-secondary)', padding: '0 4px', fontSize: '1.2rem' }}
                                  onClick={(e) => { e.stopPropagation(); const ns = activeSorts.filter((_, i) => i !== sIdx); setActiveSorts(ns); }}
                                >×</span>
                              </div>
                            ))}
                          </div>

                          <div style={{ position: 'relative' }}>
                            <div
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}
                              onClick={(e) => { e.stopPropagation(); setSortDropdownView(sortDropdownView === 'add' ? 'main' : 'add'); }}
                            >
                              <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>+</span> Add sort <span style={{ fontSize: '0.8rem' }}>⌄</span>
                            </div>
                            {sortDropdownView === 'add' && (
                              <div style={{ ...styles.sortDropdownMenu, position: 'absolute', top: '100%', left: '0', right: 'auto', marginTop: '4px', width: '220px', zIndex: 102, padding: '0.5rem 0' }} onClick={(e) => e.stopPropagation()}>
                                {[
                                  { icon: '📅', label: 'Start date' },
                                  { icon: '📅', label: 'Due date' },
                                  { icon: '👤', label: 'Assignee' },
                                  { icon: '👤', label: 'Created by' },
                                  { icon: '🕒', label: 'Created on' },
                                  { icon: '🕒', label: 'Last modified on' },
                                  { icon: '🕒', label: 'Completed on' },
                                  { icon: '👍', label: 'Likes' },
                                  { icon: 'A', label: 'Alphabetical' },
                                  ...getParsedCustomFields(selectedProject).map(cf => ({ icon: '⌄', label: cf.title }))
                                ].map((item, idx) => {
                                  const activeObj = activeSorts.find(s => s.field === item.label);
                                  const isActive = !!activeObj;
                                  return (
                                    <div
                                      key={idx}
                                      style={{ ...styles.sortDropdownItem, backgroundColor: isActive ? '#EEF2F6' : 'transparent', fontWeight: isActive ? '600' : '400' }}
                                      onMouseEnter={(e) => !isActive && (e.currentTarget.style.backgroundColor = '#F3F4F6')}
                                      onMouseLeave={(e) => !isActive && (e.currentTarget.style.backgroundColor = 'transparent')}
                                      onClick={() => { handleSortOptionClick(item.label); setSortDropdownView('main'); setIsSortDropdownOpen(true); }}
                                    >
                                      <span style={styles.sortDropdownIcon}>{item.icon}</span>
                                      <span style={{ flex: 1 }}>{item.label}</span>
                                      {isActive && <span style={{ fontSize: '0.8rem', color: '#4F46E5' }}>{activeObj.direction === 'asc' ? '↑' : '↓'}</span>}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {[
                            { icon: '📅', label: 'Start date' },
                            { icon: '📅', label: 'Due date' },
                            { icon: '👤', label: 'Assignee' },
                            { icon: '👤', label: 'Created by' },
                            { icon: '🕒', label: 'Created on' },
                            { icon: '🕒', label: 'Last modified on' },
                            { icon: '🕒', label: 'Completed on' },
                            { icon: '👍', label: 'Likes' },
                            { icon: 'A', label: 'Alphabetical' },
                            ...getParsedCustomFields(selectedProject).map(cf => ({ icon: '⌄', label: cf.title }))
                          ].map((item, idx) => {
                            const activeObj = activeSorts.find(s => s.field === item.label);
                            const isActive = !!activeObj;
                            return (
                              <div
                                key={idx}
                                style={{ ...styles.sortDropdownItem, backgroundColor: isActive ? '#EEF2F6' : 'transparent', fontWeight: isActive ? '600' : '400' }}
                                onMouseEnter={(e) => !isActive && (e.currentTarget.style.backgroundColor = '#F3F4F6')}
                                onMouseLeave={(e) => !isActive && (e.currentTarget.style.backgroundColor = 'transparent')}
                                onClick={() => handleSortOptionClick(item.label)}
                              >
                                <span style={styles.sortDropdownIcon}>{item.icon}</span>
                                <span style={{ flex: 1 }}>{item.label}</span>
                                {isActive && <span style={{ fontSize: '0.8rem', color: '#4F46E5' }}>{activeObj.direction === 'asc' ? '↑' : '↓'}</span>}
                              </div>
                            )
                          })}
                          {activeSorts.length > 0 && (
                            <>
                              <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '4px 0' }}></div>
                              <div
                                style={{ ...styles.sortDropdownItem, color: '#EF4444', justifyContent: 'center' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEF2F2'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                onClick={() => { setActiveSorts([]); setIsSortDropdownOpen(false); }}
                              >
                                Clear sorts
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  <div
                    className="option-sub-item"
                    style={{ ...styles.optionSubItem, backgroundColor: isGroupDropdownOpen || (activeGroup && activeGroup !== 'Sections') ? '#EEF2F6' : 'transparent', fontWeight: '500' }}
                    onClick={(e) => { document.body.click(); e.stopPropagation(); setIsGroupDropdownOpen(!isGroupDropdownOpen); }}
                  >
                    <span style={styles.optionIcon}>⊞</span> Group
                    {activeGroup && activeGroup !== 'Sections' && (
                      <span
                        onClick={(e) => { e.stopPropagation(); setActiveGroup('Sections'); }}
                        style={{ marginLeft: '4px', padding: '0 4px', color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >×</span>
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
                                  { icon: '👤', label: 'Assignee' },
                                  { icon: '👤', label: 'Created by' },
                                  { icon: '🕒', label: 'Created on' },
                                  { icon: '🕒', label: 'Last modified on' },
                                  { icon: '🕒', label: 'Completed on' },
                                  { icon: '📋', label: 'Project' },
                                  ...getParsedCustomFields(selectedProject).map(cf => ({ icon: 'A', label: cf.title }))
                                ].map((item, idx) => (
                                  <div
                                    key={idx}
                                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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
                                <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '4px 0' }}></div>
                                <div
                                  style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#4F46E5', fontWeight: '500' }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  onClick={() => { setShowAddFieldMenu(true); setIsGroupDropdownOpen(false); setIsGroupInnerDropdownOpen(false); }}
                                >
                                  + Add Custom Field
                                </div>
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
                                  <div
                                    key={opt}
                                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    onClick={() => { setGroupOrder(opt); setIsGroupOrderMenuOpen(false); }}
                                  >
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
                            <span
                              style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px', fontWeight: 'bold' }}
                              onClick={(e) => { e.stopPropagation(); setIsGroupMoreMenuOpen(!isGroupMoreMenuOpen); setIsGroupInnerDropdownOpen(false); setIsGroupOrderMenuOpen(false); }}
                            >
                              ...
                            </span>
                            {isGroupMoreMenuOpen && (
                              <div style={{ position: 'absolute', top: '100%', right: 0, width: '200px', backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)', zIndex: 110, marginTop: '4px', padding: '6px 0' }} onClick={(e) => e.stopPropagation()}>
                                <div
                                  style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  onClick={() => { setShowEmptyGroups(false); setIsGroupMoreMenuOpen(false); }}
                                >
                                  <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>
                                    {!showEmptyGroups && <span style={{ color: '#4F46E5' }}>✓</span>}
                                  </div>
                                  Hide empty groups
                                </div>
                                <div
                                  style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  onClick={() => { setShowEmptyGroups(true); setIsGroupMoreMenuOpen(false); }}
                                >
                                  <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>
                                    {showEmptyGroups && <span style={{ color: '#4F46E5' }}>✓</span>}
                                  </div>
                                  Show empty groups
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer', fontWeight: '500' }}>
                          + Add subgroup <span style={{ fontSize: '0.8rem' }}>⌄</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={styles.dividerVertical}></div>
                <div id="options-pane-toggle-btn" className="option-sub-item" style={styles.optionSubItem} onClick={() => { setIsOptionsPaneOpen(true); setIsCustomizePanelOpen(false); }}><span style={styles.optionIcon}>⚙️</span> Options</div>
                {isSearchOpen ? (
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '2px 8px', backgroundColor: 'var(--bg-primary)', marginLeft: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginRight: '6px' }}>🔍</span>
                    <input
                      type="text"
                      placeholder="Search tasks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ border: 'none', outline: 'none', fontSize: '0.85rem', width: '130px', color: 'var(--text-primary)', backgroundColor: 'transparent' }}
                      autoFocus
                    />
                    <span
                      style={{ cursor: 'pointer', color: '#9CA3AF', fontSize: '0.8rem', marginLeft: '4px' }}
                      onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
                    >
                      ✕
                    </span>
                  </div>
                ) : (
                  <div style={styles.searchIconBtn} onClick={() => setIsSearchOpen(true)}>🔍</div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* --- GÖRÜNÜM SEÇİM ALANI --- */}
      {activeViewObj.type === 'Overview' ? (
        <ProjectOverviewView selectedProject={selectedProject} projectRole={projectRole} isReadOnly={isReadOnly} token={token} onUpdate={syncProjectStates} onOpenShareModal={() => setIsShareModalOpen(true)} />
      ) : activeViewObj.type === 'Board' ? (
        /* ================= BOARD (KART) GÖRÜNÜMÜ ================= */
        <div style={styles.columnsWrapper}>
          {(virtualGroupedSections || selectedProject.sections?.sort((a, b) => a.order - b.order))?.map(section => {
            const filteredTasks = virtualGroupedSections ? section.tasks : applyTaskSort(applyTaskFilter(section.tasks))
            return (
              <div
                key={section.id}
                onClickCapture={() => setLastInteractedSectionId(section.id)}
                className="kanban-column-wrapper"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (draggingSectionId && draggingSectionId !== section.id && !isVirtualGrouping) {
                    handleLiveSectionSwap(draggingSectionId, section.id);
                  }
                }}
                onDrop={(e) => { if (!isVirtualGrouping) handleGeneralDrop(e, section.id); }}
                style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', opacity: draggingSectionId === section.id ? 0.4 : 1 }}
              >
                <KanbanColumn section={{ ...section, tasks: filteredTasks }} token={token} isVirtualGrouping={isVirtualGrouping} customFieldSettings={selectedProject?.customFieldSettings || []} projectMembers={selectedProject?.members || []} onTaskUpdate={handleTaskUpdate} onDeleteSection={handleDeleteSection} onRenameSection={handleRenameSection} onGeneralDrop={handleGeneralDrop} onTaskContextMenu={(e, id) => { if (!isReadOnly) setContextMenu({ visible: true, x: e.clientX, y: e.clientY, taskId: id }) }} onOpenApprovalMenu={handleOpenApprovalMenu} onOpenPopover={(type, task, coords, extra = {}) => setActivePopover({ type, task, coords, ...extra })} onOpenTaskPane={setActiveTaskPaneId} projectRole={projectRole} handleLiveTaskSwap={handleLiveTaskSwap} draggingTaskId={draggingTaskId} setDraggingTaskId={setDraggingTaskId} draggableSection={!isReadOnly && !isVirtualGrouping} onDragStartSection={(e) => { setDraggingSectionId(section.id); e.dataTransfer.setData('drag-type', 'section'); e.dataTransfer.setData('section-id', section.id); const ghostEl = document.getElementById('asana-drag-ghost-preview-card'); if (ghostEl) { ghostEl.textContent = section.name; e.dataTransfer.setDragImage(ghostEl, 20, 15); } }} onDragEndSection={() => { handleFinalSectionMove(); setDraggingSectionId(null); }} setLastInteractedSectionId={setLastInteractedSectionId} setLastInteractedTaskId={setLastInteractedTaskId} />
              </div>
            )
          })}
          {!isReadOnly && !isVirtualGrouping && (
            <div style={styles.addSectionColumn}>
              <form onSubmit={handleCreateSection} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <input type="text" placeholder="+ Add section..." value={newSectionName} onChange={e => setNewSectionName(e.target.value)} style={styles.input} required />
                {newSectionName.trim() && <button type="submit" style={styles.button}>Add Section</button>}
              </form>
            </div>
          )}
        </div>
      ) : activeViewObj.type === 'List' ? (
        /* ================= LIST GÖRÜNÜMÜ ================= */
        <ProjectListView
          selectedProject={selectedProject}
          groupedSections={virtualGroupedSections}
          isVirtualGrouping={isVirtualGrouping}
          isReadOnly={isReadOnly}
          token={token}
          lastInteractedSectionId={lastInteractedSectionId}
          setLastInteractedSectionId={setLastInteractedSectionId}
          lastInteractedTaskId={lastInteractedTaskId}
          setLastInteractedTaskId={setLastInteractedTaskId}
          draggingTaskId={draggingTaskId}
          setDraggingTaskId={setDraggingTaskId}
          draggingSectionId={draggingSectionId}
          setDraggingSectionId={setDraggingSectionId}
          handleLiveSectionSwap={handleLiveSectionSwap}
          handleFinalSectionMove={handleFinalSectionMove}
          handleLiveTaskSwap={handleLiveTaskSwap}
          applyTaskFilter={applyTaskFilter}
          applyTaskSort={applyTaskSort}
          handleSortOptionClick={handleSortOptionClick}
          activeSorts={activeSorts}
          handleTaskUpdate={handleTaskUpdate}
          handleGeneralDrop={handleGeneralDrop}
          handleToggleTaskCompleteInline={handleToggleTaskCompleteInline}
          handleOpenPopoverInline={handleOpenPopoverInline}
          formatFriendlyDate={formatFriendlyDate}
          onTaskContextMenu={(e, id) => { if (!isReadOnly) setContextMenu({ visible: true, x: e.clientX, y: e.clientY, taskId: id }) }}
          onOpenApprovalMenu={handleOpenApprovalMenu}
          onRenameSection={handleRenameSection}
          onDeleteSection={handleDeleteSection}
          onOpenTaskPane={setActiveTaskPaneId}
          syncProjectStates={syncProjectStates}
          handleTopAddTaskGlobal={handleTopAddTaskGlobal}
        />
      ) : activeViewObj.type === 'Dashboard' ? (
        <ProjectDashboardView
          selectedProject={selectedProject}
          showPicker={isAddWidgetMenuOpen}
          setShowPicker={setIsAddWidgetMenuOpen}
        />
      ) : activeViewObj.type === 'Calendar' ? (
        <ProjectCalendarView selectedProject={selectedProject} applyTaskFilter={applyTaskFilter} applyTaskSort={applyTaskSort} onOpenTaskPane={setActiveTaskPaneId} handleTaskUpdate={handleTaskUpdate} token={token} />
      ) : activeViewObj.type === 'Timeline' ? (
        <ProjectTimelineView
          selectedProject={selectedProject}
          applyTaskFilter={applyTaskFilter}
          applyTaskSort={applyTaskSort}
          onOpenTaskPane={setActiveTaskPaneId}
          handleTaskUpdate={handleTaskUpdate}
          token={token}
          onRenameSection={handleRenameSection}
          onDeleteSection={handleDeleteSection}
          isReadOnly={isReadOnly}
          draggingSectionId={draggingSectionId}
          setDraggingSectionId={setDraggingSectionId}
          handleLiveSectionSwap={handleLiveSectionSwap}
          handleFinalSectionMove={handleFinalSectionMove}
        />
      ) : activeViewObj.type === 'Workload' ? (
        <ProjectWorkloadView
          selectedProject={selectedProject}
          handleTaskUpdate={handleTaskUpdate}
          onOpenTaskPane={setActiveTaskPaneId}
          token={token}
          isReadOnly={isReadOnly}
        />
      ) : activeViewObj.type === 'Gantt' ? (
        <ProjectGanttView
          selectedProject={selectedProject}
          handleTaskUpdate={handleTaskUpdate}
          onOpenTaskPane={setActiveTaskPaneId}
          token={token}
          isReadOnly={isReadOnly}
          applyTaskFilter={applyTaskFilter}
          applyTaskSort={applyTaskSort}
          draggingTaskId={draggingTaskId}
          setDraggingTaskId={setDraggingTaskId}
          handleLiveTaskSwap={handleLiveTaskSwap}
          handleGeneralDrop={handleGeneralDrop}
          draggingSectionId={draggingSectionId}
          setDraggingSectionId={setDraggingSectionId}
          handleLiveSectionSwap={handleLiveSectionSwap}
          handleFinalSectionMove={handleFinalSectionMove}
        />
      ) : activeViewObj.type === 'Note' ? (
        <ProjectNoteView
          selectedProject={selectedProject}
          isReadOnly={isReadOnly}
          activeViewObj={activeViewObj}
          onUpdateNote={(newTitle, newContent) => {
            const newViews = parsedViews.map(v => v.id === activeViewObj.id ? { ...v, noteTitle: newTitle, content: newContent } : v);
            handleUpdateViews(newViews);
          }}
        />
      ) : activeViewObj.type === 'Files' ? (
        <ProjectFilesView selectedProject={selectedProject} token={token} onTaskUpdate={handleTaskUpdate} />
      ) : activeViewObj.type === 'Messages' ? (
        <ProjectMessagesView selectedProject={selectedProject} token={token} />
      ) : null}

      {/* Sürükleme Ghost Önizleme Taslağı */}
      <div id="asana-drag-ghost-preview-card" style={styles.ghostDragCardTemplate}></div>

      {/* Popover ve Modallar */}
      {contextMenu.visible && (
        <div style={{ ...styles.contextMenu, top: `${contextMenu.y}px`, left: `${contextMenu.x}px`, overflow: 'visible' }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setContextMenu({ ...contextMenu, convertMode: true })}
            onMouseLeave={() => setContextMenu({ ...contextMenu, convertMode: false })}
          >
            <button style={{ ...styles.contextMenuItem, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: contextMenu.convertMode ? 'var(--bg-secondary)' : 'transparent' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 8h16M4 16h16"></path><circle cx="6" cy="8" r="2"></circle><circle cx="18" cy="16" r="2"></circle></svg>
                Convert to
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>›</span>
            </button>

            {contextMenu.convertMode && (
              <div style={{ ...styles.contextMenu, top: '-5px', left: '100%', position: 'absolute', marginLeft: '2px', minWidth: '150px' }}>
                <button onClick={() => handleConvertTask('TASK')} style={{ ...styles.contextMenuItem, display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--text-secondary)' }}>✓</span> Task</button>
                <button onClick={() => handleConvertTask('MILESTONE')} style={{ ...styles.contextMenuItem, display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--text-secondary)' }}>◇</span> Milestone</button>
                <button onClick={() => handleConvertTask('APPROVAL')} style={{ ...styles.contextMenuItem, display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--text-secondary)' }}>⚖️</span> Approval</button>
              </div>
            )}
          </div>
          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }}></div>
          <button onClick={() => handleDuplicateTask()} style={{ ...styles.contextMenuItem, display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--text-secondary)' }}>📄</span> Duplicate Task</button>
          <button onClick={() => handleDeleteTask()} style={{ ...styles.contextMenuItemDelete, display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--text-secondary)' }}>🗑️</span> Delete Task</button>
        </div>
      )}

      {approvalMenu.visible && (
        <div style={{ ...styles.contextMenu, top: `${approvalMenu.y}px`, left: `${approvalMenu.x}px`, overflow: 'visible', width: '150px', minWidth: '150px' }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <button onClick={() => handleApprovalStatusChange('APPROVED')} style={{ ...styles.contextMenuItem, padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: 'var(--accent-success)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--accent-success)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div> Approve</button>
          <button onClick={() => handleApprovalStatusChange('CHANGES_REQUESTED')} style={{ ...styles.contextMenuItem, padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: '#F59E0B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: '#F59E0B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.67-5.67"></path></svg></div> Request Changes</button>
          <button onClick={() => handleApprovalStatusChange('REJECTED')} style={{ ...styles.contextMenuItem, padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: 'var(--accent-danger)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--accent-danger)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></div> Reject</button>
          <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }}></div>
          <button onClick={() => handleApprovalStatusChange('PENDING')} style={{ ...styles.contextMenuItem, padding: '0.3rem 0.5rem', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'transparent', border: '1px dashed var(--text-tertiary)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '10px', lineHeight: 1 }}>⚖️</span></div> Clear</button>
        </div>
      )}

      {isShareModalOpen && <ShareProjectModal project={selectedProject} token={token} currentUser={user} onClose={() => setIsShareModalOpen(false)} onProjectUpdated={(updatedProj) => syncProjectStates(updatedProj)} />}
      {isRulesModalOpen && <RulesModal projectId={selectedProject.id} token={token} onClose={() => { setIsRulesModalOpen(false); setRuleToEdit(null); fetchProjectRules(); }} editRule={ruleToEdit} />}
      {isFormsModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: '65vw', height: '90vh', backgroundColor: '#F9F9F9', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <ProjectFormView project={selectedProject} token={token} activeFormId={activeFormId} onProjectUpdate={syncProjectStates} onClose={() => { setIsFormsModalOpen(false); setActiveFormId(null); }} />
          </div>
        </div>
      )}
      {showAddFieldMenu && (
        <AddFieldModal
          project={selectedProject}
          onClose={() => { setShowAddFieldMenu(false); setFieldToEdit(null); }}
          onCreateField={async (fieldData) => {
            const newField = { id: Date.now().toString(), ...fieldData };
            const newCustomFields = [...(selectedProject.customFieldSettings || []), newField];
            try {
              const res = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ customFieldSettings: newCustomFields }) });
              if (res.ok) { const updatedProj = await res.json(); syncProjectStates(updatedProj); setShowAddFieldMenu(false); }
            } catch (err) { console.error(err); }
          }}
          onUpdateField={async (updatedField) => {
            const newCustomFields = (selectedProject.customFieldSettings || []).map(f => f.id === updatedField.id ? updatedField : f);
            try {
              const res = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ customFieldSettings: newCustomFields }) });
              if (res.ok) { const updatedProj = await res.json(); syncProjectStates(updatedProj); setShowAddFieldMenu(false); setFieldToEdit(null); }
            } catch (err) { console.error(err); }
          }}
          editField={fieldToEdit}
          token={token}
        />
      )}
      {activePopover && (activePopover.type === 'date' || activePopover.type === 'custom-date') && <DatePickerPopover task={activePopover.task} token={token} coords={activePopover.coords} customFieldId={activePopover.customFieldId} onDatesUpdated={(id, updated) => { handleTaskUpdate(id, updated); setActivePopover(null); }} />}
      {activePopover && activePopover.type === 'assignee' && <AssigneePopover task={activePopover.task} token={token} coords={activePopover.coords} project={selectedProject} onAssigneeUpdated={(id, updated) => { handleTaskUpdate(id, updated); setActivePopover(null); }} />}

      {/* Global Task Detail Pane */}
      {activeTaskPaneId && (
        <div className="task-pane-ignore-click">
          <TaskDetailPane
            task={(() => {
              for (const sec of selectedProject.sections || []) {
                const t = sec.tasks?.find(t => t.id === activeTaskPaneId);
                if (t) return t;
              }
              return null;
            })()}
            selectedProject={selectedProject}
            token={token}
            projectRole={projectRole}
            currentUser={user}
            onClose={() => setActiveTaskPaneId(null)}
            onTaskUpdate={handleTaskUpdate}
            customFieldSettings={selectedProject.customFieldSettings}
            onDeleteTask={(taskId) => {
              handleDeleteTask(taskId);
              setActiveTaskPaneId(null);
            }}
            onConvertTask={handleConvertTask}
            onOpenPopover={(type, task, coords, extra = {}) => setActivePopover({ type, task, coords, ...extra })}
          />
        </div>
      )}

      {/* Customize Panel */}
      {isCustomizePanelOpen && (
        <>
          <div style={styles.customizePanel} id="customize-pane-container">
            {customizeView === 'main' && (
              <>
                <div style={styles.customizeHeader}>
                  <h2 style={styles.customizeTitle}>Customize</h2>
                  <button style={styles.customizeCloseBtn} onClick={() => { setIsCustomizePanelOpen(false); setCustomizeView('main'); }}>→|</button>
                </div>

                <div style={styles.customizeBody}>
                  <div style={styles.customizeSectionHeader}>
                    <div>
                      <h3 style={styles.customizeSectionTitle}>This project</h3>
                      <div style={styles.customizeSectionSubtitle}>View and edit features on this project</div>
                    </div>
                    <button style={styles.customizeAddBtn}>Add <span>▼</span></button>
                  </div>

                  <div style={styles.customizeGroupTitle}>AI Studio</div>
                  <div style={styles.customizeList}>
                    <div className="customize-list-card" style={styles.customizeListItem} onClick={openRulesView}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>⚡</span>
                        <span style={styles.customizeItemLabel}>Rules</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {projectRules.length > 0 && <span style={styles.customizeBadge}>{projectRules.length}</span>}
                        <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>›</span>
                      </div>
                    </div>
                  </div>

                  <div style={styles.customizeGroupTitle}>Workflow features</div>
                  <div style={styles.customizeList}>
                    {[
                      { icon: '◇', label: 'Fields', badge: selectedProject?.customFieldSettings?.length || 0, action: () => setCustomizeView('fields') },
                      { icon: '📄', label: 'Forms', badge: Array.isArray(selectedProject?.formSettings) ? selectedProject.formSettings.length : (selectedProject?.formSettings ? 1 : 0), action: () => setCustomizeView('forms') },
                      { icon: '✉️', label: 'Emails' },
                      { icon: '⊞', label: 'Apps' },
                      { icon: 'A', label: 'Task types and templates' },
                      { icon: '📦', label: 'Bundles', badge: '1' },
                      { icon: '💬', label: 'Status templates' }
                    ].map((item, i) => (
                      <div key={i} className="customize-list-card" style={styles.customizeListItem} onClick={item.action}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{item.icon}</span>
                          <span style={styles.customizeItemLabel}>{item.label}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {item.badge !== undefined && item.badge > 0 && <span style={styles.customizeBadge}>{item.badge}</span>}
                          <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>›</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {customizeView === 'forms' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-primary)' }}>
                <div style={{ ...styles.customizeHeader, justifyContent: 'flex-start', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-secondary)', padding: 0 }} onClick={() => setCustomizeView('main')}>←</button>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: '500' }}>Forms</h2>
                </div>
                <div style={{ padding: '1.5rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '500', color: 'var(--text-primary)' }}>Added to project</h3>
                    <button
                      style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      onClick={() => { setActiveFormId(null); setIsCustomizePanelOpen(false); setIsFormsModalOpen(true); }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>+</span> Add
                    </button>
                  </div>

                  {(Array.isArray(selectedProject?.formSettings) ? selectedProject.formSettings : (selectedProject?.formSettings ? [selectedProject.formSettings] : [])).map(form => (
                    <div
                      key={form.id || form.title || Math.random()}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'var(--bg-primary)', marginBottom: '0.5rem' }}
                      onClick={() => { setActiveFormId(form.id); setIsCustomizePanelOpen(false); setIsFormsModalOpen(true); }}
                    >
                      <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>📄</span>
                      <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                          {form.title || 'Intake form'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Part of <span style={{ color: 'var(--accent-primary)' }}>{selectedProject.name}</span> bundle
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {customizeView === 'rules' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ ...styles.customizeHeader, justifyContent: 'flex-start', gap: '0.75rem' }}>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-secondary)', padding: 0 }} onClick={() => setCustomizeView('main')}>←</button>
                  <h2 style={{ ...styles.customizeTitle, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1.2rem' }}>
                    Rules
                  </h2>
                </div>

                <div style={styles.customizeBody}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div>
                      <h3 style={styles.customizeSectionTitle}>Added to project</h3>
                      <div style={styles.customizeSectionSubtitle}>Manage tasks and workflows automatically.</div>
                    </div>
                    <button style={styles.customizeAddBtn} onClick={() => setIsRulesModalOpen(true)}>+ Add</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {projectRules.length === 0 && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No active rules.</div>}
                    {projectRules.map(r => {
                      let ruleName = r.name || 'Rule';
                      if (!r.name && r.ruleData?.trigger?.type) {
                        const triggerName = r.ruleData.trigger.type.replace(/_/g, ' ');
                        const actionName = r.ruleData.branches?.[0]?.actions?.[0]?.type?.replace(/_/g, ' ') || 'action';
                        ruleName = triggerName + ' → ' + actionName;
                        ruleName = ruleName.charAt(0).toUpperCase() + ruleName.slice(1);
                      }
                      return (
                        <div
                          key={r.id}
                          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0.5rem', margin: '0 -0.5rem', borderRadius: '6px', cursor: 'pointer', transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          onClick={() => handleEditRule(r)}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                            <span style={{ color: '#F87171', fontSize: '1.2rem', marginTop: '2px' }}>⚡</span>
                            <div>
                              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '500' }}>{ruleName}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                {r.isActive === false ? 'Paused' : 'Active'}
                              </div>
                            </div>
                          </div>
                          <div style={{ position: 'relative' }}>
                            <button
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-secondary)', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                              onClick={(e) => { e.stopPropagation(); setActiveRuleMenuId(activeRuleMenuId === r.id ? null : r.id); }}
                            >
                              ⋮
                            </button>
                            {activeRuleMenuId === r.id && (
                              <div style={{ position: 'absolute', top: '100%', right: 0, backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '4px 0', zIndex: 10, minWidth: '120px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <div style={{ padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => { handleEditRule(r); setActiveRuleMenuId(null); }}>✏️ Edit</div>
                                <div style={{ padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => { handleDuplicateRule(r); setActiveRuleMenuId(null); }}>📋 Duplicate</div>
                                <div style={{ padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer', color: '#EF4444' }} onClick={() => { handleDeleteRule(r.id); setActiveRuleMenuId(null); }}>🗑️ Delete</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {customizeView === 'fields' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ ...styles.customizeHeader, justifyContent: 'flex-start', gap: '0.75rem' }}>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-secondary)', padding: 0 }} onClick={() => setCustomizeView('main')}>←</button>
                  <h2 style={{ ...styles.customizeTitle, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1.2rem' }}>
                    Fields
                  </h2>
                </div>

                <div style={styles.customizeBody}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div>
                      <h3 style={styles.customizeSectionTitle}>Added to project</h3>
                    </div>
                    <button style={styles.customizeAddBtn} onClick={() => { setFieldToEdit(null); setShowAddFieldMenu(true); }}>+ Add <span>⌄</span></button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(!selectedProject?.customFieldSettings || selectedProject.customFieldSettings.length === 0) && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No fields added to this project.</div>
                    )}
                    {selectedProject?.customFieldSettings?.map((field, idx) => (
                      <div
                        key={field.id}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', cursor: 'pointer', padding: '0.75rem', borderRadius: '8px', transition: 'background-color 0.1s' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        onClick={() => { setFieldToEdit(field); setShowAddFieldMenu(true); }}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('field-idx', idx);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={async (e) => {
                          e.preventDefault();
                          const draggedIdx = parseInt(e.dataTransfer.getData('field-idx'), 10);
                          if (draggedIdx === idx) return;

                          const newFields = [...selectedProject.customFieldSettings];
                          const [removed] = newFields.splice(draggedIdx, 1);
                          newFields.splice(idx, 0, removed);

                          // Local optimistic update
                          syncProjectStates({ ...selectedProject, customFieldSettings: newFields });

                          // Remote update
                          try {
                            const res = await fetch(`http://localhost:5001/api/projects/${selectedProject.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ customFieldSettings: newFields }) });
                            if (res.ok) { const updatedProj = await res.json(); syncProjectStates(updatedProj); }
                          } catch (err) { console.error(err); }
                        }}
                      >
                        <span style={{ color: '#9CA3AF', fontSize: '1.2rem', cursor: 'grab', marginTop: '2px', display: 'flex', alignItems: 'center' }}>⊝</span>
                        <div>
                          <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: '500', marginBottom: '6px' }}>{field.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {field.options?.slice(0, 3).map((opt, i) => (
                              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: opt.color || '#E0E7FF' }}></span>
                                {opt.label}
                              </span>
                            ))}
                            {field.options?.length > 3 && (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>+{field.options.length - 3}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Options Pane */}
      {isOptionsPaneOpen && (
        <>
          <div style={styles.customizePanel} id="options-pane-container">
            {optionsView === 'main' ? (
              <>
                <div style={styles.customizeHeader}>
                  <h2 style={styles.customizeTitle}>{activeViewObj?.name || activeViewObj?.type || 'Board'}</h2>
                  <button style={styles.customizeCloseBtn} onClick={() => setIsOptionsPaneOpen(false)}>→</button>
                </div>
                <div style={styles.customizeBody}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
                      🗂️
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>View name</div>
                      <input
                        type="text"
                        key={activeViewObj?.id || 'board'}
                        defaultValue={activeViewObj?.name || activeViewObj?.type || 'Board'}
                        onBlur={(e) => {
                          const newName = e.target.value;
                          if (newName && newName.trim() !== '' && newName !== (activeViewObj?.name || activeViewObj?.type)) {
                            const newViews = parsedViews.map(v => v.id === activeViewObj?.id ? { ...v, name: newName.trim() } : v);
                            handleUpdateViews(newViews);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.target.blur();
                          }
                        }}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #D1D5DB', fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="customize-list-card" style={{ ...styles.customizeListItem, justifyContent: 'space-between', padding: '14px 16px', border: '1px solid #E5E7EB', borderRadius: '8px', backgroundColor: '#FFF' }} onClick={() => { }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', width: '20px', textAlign: 'center' }}>◫</span>
                        <span style={styles.customizeItemLabel}>Layout options</span>
                      </div>
                      <span style={{ color: 'var(--text-secondary)' }}>›</span>
                    </div>
                    <div className="customize-list-card" style={{ ...styles.customizeListItem, justifyContent: 'space-between', padding: '14px 16px', border: '1px solid #E5E7EB', borderRadius: '8px', backgroundColor: '#FFF' }} onClick={() => { }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', width: '20px', textAlign: 'center' }}>👁️</span>
                        <span style={styles.customizeItemLabel}>Show/hide fields</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>1 hidden</span>
                        <span style={{ color: 'var(--text-secondary)' }}>›</span>
                      </div>
                    </div>
                    <div className="customize-list-card" style={{ ...styles.customizeListItem, justifyContent: 'space-between', padding: '14px 16px', border: '1px solid #E5E7EB', borderRadius: '8px', backgroundColor: '#FFF' }} onClick={() => setOptionsView(activeFilters.filter(f => typeof f === 'object').length > 0 ? 'filters_list' : 'add_filter')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', width: '20px', textAlign: 'center' }}>≡</span>
                        <span style={styles.customizeItemLabel}>Filters</span>
                      </div>
                      <span style={{ color: 'var(--text-secondary)' }}>›</span>
                    </div>
                    <div className="customize-list-card" style={{ ...styles.customizeListItem, justifyContent: 'space-between', padding: '14px 16px', border: '1px solid #E5E7EB', borderRadius: '8px', backgroundColor: '#FFF' }} onClick={() => setOptionsView(activeSorts.length > 0 ? 'sorts_list' : 'add_sort')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', width: '20px', textAlign: 'center' }}>⇅</span>
                        <span style={styles.customizeItemLabel}>Sorts</span>
                      </div>
                      <span style={{ color: 'var(--text-secondary)' }}>›</span>
                    </div>
                    <div className="customize-list-card" style={{ ...styles.customizeListItem, justifyContent: 'space-between', padding: '14px 16px', border: '1px solid #E5E7EB', borderRadius: '8px', backgroundColor: '#FFF' }} onClick={() => setOptionsView('groups_list')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', width: '20px', textAlign: 'center' }}>⊞</span>
                        <span style={styles.customizeItemLabel}>Groups</span>
                      </div>
                      <span style={{ color: 'var(--text-secondary)' }}>›</span>
                    </div>
                    <div className="customize-list-card" style={{ ...styles.customizeListItem, justifyContent: 'space-between', padding: '14px 16px', border: '1px solid #E5E7EB', borderRadius: '8px', backgroundColor: '#FFF' }} onClick={() => { }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', width: '20px', textAlign: 'center' }}>⮑</span>
                        <span style={styles.customizeItemLabel}>Subtasks</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Collapsed</span>
                        <span style={{ color: 'var(--text-secondary)' }}>›</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : optionsView === 'filters_list' ? (
              <>
                <div style={{ ...styles.customizeHeader, justifyContent: 'flex-start', gap: '12px' }}>
                  <button style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }} onClick={() => setOptionsView('main')}>←</button>
                  <h2 style={{ ...styles.customizeTitle, fontWeight: 'normal' }}>Filters</h2>
                </div>
                <div style={{ ...styles.customizeBody, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Manage filters on this view</span>
                    <button onClick={() => { setActiveFilters([]); setOptionsView('main'); }} style={{ background: 'none', border: 'none', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>Clear</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {renderActiveFiltersList(true)}
                  </div>

                  <div
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '12px' }}
                    onClick={() => setOptionsView('add_filter')}
                  >
                    <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>+</span> Add filter
                  </div>

                  <div style={{ marginTop: 'auto', borderTop: '1px solid #E5E7EB', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button style={{ padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', backgroundColor: '#FFF', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      Save view <span style={{ color: 'var(--text-secondary)' }}>⌄</span>
                    </button>
                  </div>
                </div>
              </>
            ) : optionsView === 'add_filter' ? (
              <>
                <div style={{ ...styles.customizeHeader, justifyContent: 'flex-start', gap: '12px' }}>
                  <button style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }} onClick={() => setOptionsView(activeFilters.filter(f => typeof f === 'object').length > 0 ? 'filters_list' : 'main')}>←</button>
                  <h2 style={{ ...styles.customizeTitle, fontWeight: 'normal' }}>Add filter</h2>
                </div>
                <div style={{ ...styles.customizeBody, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>🔍</span>
                    <input type="text" placeholder="Filter by" style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '6px', border: '1px solid #D1D5DB', outline: 'none', fontSize: '0.9rem' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {[
                      { icon: '✓', label: 'Completion status' },
                      { icon: '👤', label: 'Assignee' },
                      { icon: '📅', label: 'Start date', type: 'date' },
                      { icon: '📅', label: 'Due date', type: 'date' },
                      { icon: '👤', label: 'Created by' },
                      { icon: '🕒', label: 'Created on', type: 'date' },
                      { icon: '✏️', label: 'Last modified on', type: 'date' },
                      { icon: '✓', label: 'Completed on', type: 'date' },
                      { icon: '✓', label: 'Task type' },
                      ...getParsedCustomFields(selectedProject).map(cf => ({ icon: cf.type === 'date' ? '📅' : cf.type === 'people' ? '👤' : cf.type === 'checkbox' ? '☑' : '⌄', label: cf.title, type: cf.type || cf.fieldType, options: cf.options }))
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="customize-list-card"
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', cursor: 'pointer', borderRadius: '6px', color: 'var(--text-primary)', transition: 'background-color 0.15s' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          let defOperator = 'is';
                          let defValue = '';
                          const isDateField = ['Start date', 'Due date', 'Created on', 'Completed on', 'Last modified on'].includes(item.label) || item.type === 'date';
                          const isAssigneeField = ['Assignee', 'Created by'].includes(item.label);
                          const isMulti = item.type === 'multi_select';

                          if (isDateField) {
                            defOperator = 'is between';
                            defValue = { start: '', end: '' };
                          } else if (isAssigneeField) {
                            defOperator = 'is';
                            defValue = null;
                          } else if (item.label === 'Completion status') {
                            defOperator = 'is';
                            defValue = 'Incomplete';
                          } else if (item.label === 'Task type') {
                            defOperator = 'is';
                            defValue = 'Task';
                          } else if (isMulti) {
                            defOperator = 'contains any';
                            defValue = [];
                          } else {
                            defOperator = 'is';
                            defValue = null;
                          }

                          const newFilters = [...activeFilters];
                          newFilters.push({ field: item.label, icon: item.icon, operator: defOperator, value: defValue, type: item.type, options: item.options });
                          setActiveFilters(newFilters);
                          setOptionsView('filters_list');
                        }}
                      >
                        <span style={{ color: 'var(--text-secondary)', width: '20px', textAlign: 'center' }}>{item.icon}</span>
                        <span style={{ fontSize: '0.9rem' }}>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 'auto', borderTop: '1px solid #E5E7EB', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button style={{ padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', backgroundColor: '#FFF', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      Save view <span style={{ color: 'var(--text-secondary)' }}>⌄</span>
                    </button>
                  </div>
                </div>
              </>
            ) : optionsView === 'sorts_list' ? (
              <>
                <div style={{ ...styles.customizeHeader, justifyContent: 'flex-start', gap: '12px' }}>
                  <button style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }} onClick={() => setOptionsView('main')}>←</button>
                  <h2 style={{ ...styles.customizeTitle, fontWeight: 'normal' }}>Sorts</h2>
                </div>
                <div style={{ ...styles.customizeBody, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Manage sorts on this view</span>
                    <button onClick={() => { setActiveSorts([]); setOptionsView('main'); }} style={{ background: 'none', border: 'none', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>Clear</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {activeSorts.map((sortObj, sIdx) => (
                      <div 
                        key={sIdx} 
                        draggable
                        onDragStart={(e) => {
                          setDraggingSortIdx(sIdx);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (draggingSortIdx === null || draggingSortIdx === sIdx) return;
                          
                          const newSorts = [...activeSorts];
                          const [removed] = newSorts.splice(draggingSortIdx, 1);
                          newSorts.splice(sIdx, 0, removed);
                          setActiveSorts(newSorts);
                          setDraggingSortIdx(sIdx);
                        }}
                        onDragEnd={() => setDraggingSortIdx(null)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', opacity: draggingSortIdx === sIdx ? 0.5 : 1, cursor: 'grab' }}
                      >
                        <span style={{ cursor: 'grab', color: 'var(--text-tertiary)', padding: '0 0.2rem', display: 'flex', alignItems: 'center', userSelect: 'none', fontSize: '1.2rem' }}>
                          ⋮⋮
                        </span>
                        <div style={{ flex: 1, border: '1px solid #D1D5DB', borderRadius: '6px', padding: '6px 12px', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-primary)' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{sortObj.field}</span>
                        </div>
                        <div style={{ position: 'relative', width: '120px' }}>
                          <div onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(prev => prev?.index === `sort-${sIdx}` && prev?.type === 'direction' ? null : { index: `sort-${sIdx}`, type: 'direction' }) }} style={{ border: '1px solid #D1D5DB', borderRadius: '6px', padding: '6px 12px', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {sortObj.direction === 'asc' ? 'Ascending' : 'Descending'} <span style={{ color: '#9CA3AF', marginLeft: 'auto' }}>⌄</span>
                          </div>
                          {openFilterDropdown?.index === `sort-${sIdx}` && openFilterDropdown?.type === 'direction' && (
                            <div style={{ position: 'absolute', top: '100%', right: 0, width: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 101, marginTop: '4px', padding: '4px 0' }}>
                              <div onClick={(e) => { e.stopPropagation(); const ns = [...activeSorts]; ns[sIdx].direction = 'asc'; setActiveSorts(ns); setOpenFilterDropdown(null); }} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)', backgroundColor: sortObj.direction === 'asc' ? '#EEF2F6' : 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = sortObj.direction === 'asc' ? '#EEF2F6' : 'transparent'}>Ascending</div>
                              <div onClick={(e) => { e.stopPropagation(); const ns = [...activeSorts]; ns[sIdx].direction = 'desc'; setActiveSorts(ns); setOpenFilterDropdown(null); }} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)', backgroundColor: sortObj.direction === 'desc' ? '#EEF2F6' : 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = sortObj.direction === 'desc' ? '#EEF2F6' : 'transparent'}>Descending</div>
                            </div>
                          )}
                        </div>
                        <span
                          style={{ cursor: 'pointer', color: 'var(--text-secondary)', padding: '0 4px', fontSize: '1.2rem' }}
                          onClick={(e) => { e.stopPropagation(); const ns = activeSorts.filter((_, i) => i !== sIdx); setActiveSorts(ns); if (ns.length === 0) setOptionsView('main'); }}
                        >×</span>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '12px' }}
                    onClick={() => setOptionsView('add_sort')}
                  >
                    <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>+</span> Add sort
                  </div>

                  <div style={{ marginTop: 'auto', borderTop: '1px solid #E5E7EB', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button style={{ padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', backgroundColor: '#FFF', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      Save view <span style={{ color: 'var(--text-secondary)' }}>⌄</span>
                    </button>
                  </div>
                </div>
              </>
            ) : optionsView === 'add_sort' ? (
              <>
                <div style={{ ...styles.customizeHeader, justifyContent: 'flex-start', gap: '12px' }}>
                  <button style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }} onClick={() => setOptionsView(activeSorts.length > 0 ? 'sorts_list' : 'main')}>←</button>
                  <h2 style={{ ...styles.customizeTitle, fontWeight: 'normal' }}>Add sort</h2>
                </div>
                <div style={{ ...styles.customizeBody, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>🔍</span>
                    <input type="text" placeholder="Sort by" style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '6px', border: '1px solid #D1D5DB', outline: 'none', fontSize: '0.9rem' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {[
                      { icon: '📅', label: 'Start date' },
                      { icon: '📅', label: 'Due date' },
                      { icon: '👤', label: 'Assignee' },
                      { icon: '👤', label: 'Created by' },
                      { icon: '🕒', label: 'Created on' },
                      { icon: '🕒', label: 'Last modified on' },
                      { icon: '🕒', label: 'Completed on' },
                      { icon: '👍', label: 'Likes' },
                      { icon: 'A', label: 'Alphabetical' },
                      ...getParsedCustomFields(selectedProject).map(cf => ({ icon: '⌄', label: cf.title }))
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="customize-list-card"
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', cursor: 'pointer', borderRadius: '6px', color: 'var(--text-primary)', transition: 'background-color 0.15s' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const existingIdx = activeSorts.findIndex(s => s.field === item.label);
                          if (existingIdx === -1) {
                            setActiveSorts([...activeSorts, { field: item.label, direction: 'asc' }]);
                          }
                          setOptionsView('sorts_list');
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span style={{ color: 'var(--text-secondary)', width: '20px', textAlign: 'center' }}>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 'auto', borderTop: '1px solid #E5E7EB', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button style={{ padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', backgroundColor: '#FFF', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      Save view <span style={{ color: 'var(--text-secondary)' }}>⌄</span>
                    </button>
                  </div>
                </div>
              </>
            ) : optionsView === 'groups_list' ? (
              <>
                <div style={{ ...styles.customizeHeader, justifyContent: 'flex-start', gap: '12px' }}>
                  <button style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }} onClick={() => setOptionsView('main')}>←</button>
                  <h2 style={{ ...styles.customizeTitle, fontWeight: 'normal' }}>Groups</h2>
                </div>
                <div style={{ ...styles.customizeBody, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Manage groups on this view</span>
                  </div>

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
                            { icon: '👤', label: 'Assignee' },
                            { icon: '👤', label: 'Created by' },
                            { icon: '🕒', label: 'Created on' },
                            { icon: '🕒', label: 'Last modified on' },
                            { icon: '🕒', label: 'Completed on' },
                            { icon: '📋', label: 'Project' },
                            ...getParsedCustomFields(selectedProject).map(cf => ({ icon: 'A', label: cf.title }))
                          ].map((item, idx) => (
                            <div
                              key={idx}
                              style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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
                          <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '4px 0' }}></div>
                          <div
                            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#4F46E5', fontWeight: '500' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            onClick={() => { setShowAddFieldMenu(true); setIsOptionsPaneOpen(false); setIsGroupInnerDropdownOpen(false); }}
                          >
                            + Add Custom Field
                          </div>
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
                            <div
                              key={opt}
                              style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              onClick={() => { setGroupOrder(opt); setIsGroupOrderMenuOpen(false); }}
                            >
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
                      <span
                        style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px', fontWeight: 'bold' }}
                        onClick={(e) => { e.stopPropagation(); setIsGroupMoreMenuOpen(!isGroupMoreMenuOpen); setIsGroupInnerDropdownOpen(false); setIsGroupOrderMenuOpen(false); }}
                      >
                        ...
                      </span>
                      {isGroupMoreMenuOpen && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, width: '200px', backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)', zIndex: 110, marginTop: '4px', padding: '6px 0' }} onClick={(e) => e.stopPropagation()}>
                          <div
                            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            onClick={() => { setShowEmptyGroups(false); setIsGroupMoreMenuOpen(false); }}
                          >
                            <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>
                              {!showEmptyGroups && <span style={{ color: '#4F46E5' }}>✓</span>}
                            </div>
                            Hide empty groups
                          </div>
                          <div
                            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            onClick={() => { setShowEmptyGroups(true); setIsGroupMoreMenuOpen(false); }}
                          >
                            <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>
                              {showEmptyGroups && <span style={{ color: '#4F46E5' }}>✓</span>}
                            </div>
                            Show empty groups
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '12px' }}
                  >
                    <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>+</span> Add subgroup
                  </div>

                  <div style={{ marginTop: 'auto', borderTop: '1px solid #E5E7EB', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button style={{ padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', backgroundColor: '#FFF', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      Save view <span style={{ color: 'var(--text-secondary)' }}>⌄</span>
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </>
      )}

      {tabContextMenu.visible && (
        <div className="view-context-menu" style={{ ...styles.contextMenu, left: tabContextMenu.x, top: tabContextMenu.y }}>
          <div className="view-context-menu-item" onMouseDown={(e) => { e.stopPropagation(); handleRenameView(); }}>✏️ Rename</div>
          <div className="view-context-menu-item" onMouseDown={(e) => { e.stopPropagation(); handleCopyView(); }}>📋 Copy</div>
          <div className="view-context-menu-item" onMouseDown={(e) => { e.stopPropagation(); handleSetDefaultView(); }}>⭐ Set as default</div>
          <div className="view-context-menu-item delete-item" onMouseDown={(e) => { e.stopPropagation(); handleDeleteView(); }}>🗑️ Delete</div>
        </div>
      )}
      {undoToast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '24px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '24px', zIndex: 99999, border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '400' }}>Task deleted</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { if (pendingDeleteRef.current) { clearTimeout(pendingDeleteRef.current.timeoutId); executeDeleteTask(pendingDeleteRef.current.task.id); } setUndoToast(false); pendingDeleteRef.current = null; }}>✕</button>
            <button style={{ border: '1px solid var(--border-color)', background: 'transparent', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: '500' }} onClick={handleUndoDelete}>Undo</button>
          </div>
        </div>
      )}

    </div>
  )
}

const styles = {
  boardContainer: { padding: '0', fontFamily: 'system-ui', backgroundColor: 'var(--bg-primary)', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' },
  asanaMainHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1.5rem', borderBottom: '1px solid var(--border-color)', flexShrink: 0 },
  headerLeftBlock: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  asanaProjectIcon: { width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)' },
  projectTitleText: { margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: '700' },
  titleDropdownArrowBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.65rem', cursor: 'pointer', alignSelf: 'center', padding: '4px' },
  renameInputInline: { fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', border: '1px solid var(--accent-primary)', borderRadius: '4px', outline: 'none', padding: '2px 6px', backgroundColor: 'transparent' },
  titleActionDropdown: { position: 'absolute', top: '100%', left: '0', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 15px rgba(0,0,0,0.05)', padding: '0.4rem', zIndex: 10002, minWidth: '170px', marginTop: '4px' },
  dropdownOptionItem: { padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: 'var(--text-primary)', borderRadius: '6px', cursor: 'pointer' },
  dropdownDivider: { height: '1px', backgroundColor: 'var(--border-color)', margin: '0.3rem 0' },
  starIconStyle: { color: 'var(--text-tertiary)', fontSize: '1.1rem', cursor: 'pointer' },
  setStatusDummyBtn: { backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '3px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' },
  statusDropdownMenu: { position: 'absolute', top: '100%', left: 0, marginTop: '4px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '4px 0', minWidth: '150px', zIndex: 50, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' },
  addWidgetDropdownMenu: { position: 'absolute', top: '100%', left: 0, marginTop: '4px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '4px 0', minWidth: '120px', zIndex: 50, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
  addWidgetDropdownItem: { padding: '8px 16px', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background-color 0.1s' },
  headerRightBlock: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  avatarListWrapper: { display: 'flex', alignItems: 'center' },
  avatarCircleOwner: { width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' },
  asanaShareButtonLight: { backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-primary)', border: 'none', borderRadius: '6px', padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 'normal', cursor: 'pointer' },
  asanaCustomizeBtn: { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: '500', cursor: 'pointer' },
  logoutTopBtn: { backgroundColor: '#FEE2E2', color: 'var(--accent-danger)', border: 'none', borderRadius: '6px', padding: '0.45rem 0.75rem', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' },
  asanaTabsRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', flexShrink: 0 },
  tabItemBack: { fontSize: '0.8rem', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: '600', padding: '6px 12px', borderRadius: '6px' },
  tabItemPassive: { fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '6px 12px', fontWeight: '500', cursor: 'pointer', borderRadius: '6px' },
  tabItemActive: { fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '700', padding: '6px 12px', cursor: 'pointer', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)' },
  asanaOptionsSubHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1.5rem', height: '52px', boxSizing: 'border-box', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', flexShrink: 0 },
  addTaskDropdownBtn: { backgroundColor: '#6366F1', color: '#FFF', border: 'none', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', transition: 'background-color 0.2s' },
  optionsRightGroup: { display: 'flex', alignItems: 'center', gap: '1rem' },
  optionSubItem: { fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500', padding: '4px 8px', borderRadius: '6px' },
  optionIcon: { fontSize: '0.95rem', color: 'var(--text-secondary)' },
  dividerVertical: { width: '1px', height: '16px', backgroundColor: 'var(--border-color)' },
  searchIconBtn: { fontSize: '0.9rem', color: 'var(--text-secondary)', cursor: 'pointer' },
  groupDropdownPanel: { position: 'absolute', top: '100%', right: '0', marginTop: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 9999, width: '420px', display: 'flex', flexDirection: 'column' },
  filterPanelBox: { position: 'absolute', top: '100%', right: '0', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', padding: '1rem', width: '420px', zIndex: 10005, marginTop: '8px' },
  filterPanelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  filterPanelTitle: { fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' },
  filterClearLink: { fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: '500' },
  quickFiltersSection: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  quickFiltersLabel: { fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' },
  filterPillsContainer: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' },
  filterPill: { border: '1px solid var(--border-color)', borderRadius: '20px', padding: '5px 12px', fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', backgroundColor: 'var(--bg-primary)', userSelect: 'none', fontWeight: '500', boxSizing: 'border-box' },
  activeFilterPill: { border: '1px solid var(--accent-primary)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-primary)' },
  addFilterFooterRow: { marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' },
  addFilterBtnLink: { fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: '600', cursor: 'pointer' },
  columnsWrapper: { display: 'flex', gap: '1.5rem', overflowX: 'auto', alignItems: 'stretch', padding: '1.5rem', flex: 1, minHeight: 0, backgroundColor: 'var(--bg-secondary)' },
  addSectionColumn: { border: '2px dashed var(--border-color)', width: '280px', minWidth: '280px', padding: '1rem', borderRadius: '8px', boxSizing: 'border-box', height: 'fit-content', backgroundColor: 'var(--bg-primary)' },
  input: { padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box', outline: 'none', color: 'var(--text-primary)' },
  button: { padding: '0.5rem', backgroundColor: 'var(--accent-primary)', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', width: '100%' },
  contextMenu: { position: 'fixed', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)', zIndex: 100, padding: '0.4rem', minWidth: '150px' },
  contextMenuItem: { width: '100%', padding: '0.6rem 0.8rem', backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', marginBottom: '2px' },
  contextMenuItemDelete: { width: '100%', padding: '0.6rem 0.8rem', backgroundColor: 'transparent', color: 'var(--accent-danger)', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left' },
  listSpreadsheetWrapper: { flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' },
  ghostDragCardTemplate: { position: 'fixed', top: '-1000px', left: '-1000px', width: '180px', padding: '8px 12px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: '600', borderRadius: '6px', border: '1px solid var(--accent-primary)', boxShadow: '0 10px 15px -3px rgba(79,70,229,0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none', zIndex: -99999 },

  customizePanelOverlay: { position: 'fixed', top: '104px', left: 0, right: 0, bottom: 0, zIndex: 100000 },
  customizePanel: { position: 'fixed', top: '104px', right: 0, bottom: 0, width: '380px', backgroundColor: 'var(--bg-primary)', borderLeft: '1px solid var(--border-color)', zIndex: 100001, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 15px rgba(0,0,0,0.05)' },
  customizeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' },
  customizeTitle: { margin: 0, fontSize: '1.25rem', fontWeight: '500', color: 'var(--text-primary)' },
  customizeCloseBtn: { background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-secondary)', cursor: 'pointer' },
  customizeBody: { flex: 1, overflowY: 'auto', padding: '1.5rem' },
  customizeSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' },
  customizeSectionTitle: { margin: 0, fontSize: '1rem', fontWeight: '500', color: 'var(--text-primary)' },
  customizeSectionSubtitle: { fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' },
  customizeAddBtn: { backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.35rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' },
  customizeGroupTitle: { fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' },
  customizeList: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' },
  customizeListItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.2s' },
  customizeItemLabel: { fontSize: '0.9rem', color: 'var(--text-primary)' },
  customizeBadge: { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '12px', fontWeight: '500' },
  sortDropdownMenu: { position: 'absolute', top: '100%', right: '0', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', padding: '0.5rem 0', width: '220px', zIndex: 10005, marginTop: '8px', display: 'flex', flexDirection: 'column' },
  sortDropdownItem: { padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' },
  sortDropdownIcon: { fontSize: '1.1rem', color: 'var(--text-secondary)', width: '20px', textAlign: 'center', display: 'inline-block' }
}

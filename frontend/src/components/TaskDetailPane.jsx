import React, { useState, useEffect, useRef } from 'react';
import RichTextEditor from './RichTextEditor';
import { getParsedTaskCustomFields, getParsedGithubPRs, getGithubPRStatusColor, getGithubPRStatusLabel } from '../utils/customFields';

export default function TaskDetailPane({ task, selectedProject, onClose, onTaskUpdate, onDeleteTask, onConvertTask, token, projectRole, customFieldSettings, onOpenPopover, currentUser }) {
  const paneRef = useRef(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
  });
  const [openFieldMenuId, setOpenFieldMenuId] = useState(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInputValue, setTagInputValue] = useState('');
  const [tagColorValue, setTagColorValue] = useState('#3B82F6');
  const [availableTags, setAvailableTags] = useState([]);

  const [showProjectInput, setShowProjectInput] = useState(false);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [expandedProjects, setExpandedProjects] = useState({});

  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState('comments');
  const [activityTab, setActivityTab] = useState('all');
  const [openSectionMenuId, setOpenSectionMenuId] = useState(null);
  const [hoveredCommentId, setHoveredCommentId] = useState(null);
  const [reactionPickerId, setReactionPickerId] = useState(null);

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isConvertMenuOpen, setIsConvertMenuOpen] = useState(false);

  const [isAddingGithubPr, setIsAddingGithubPr] = useState(false);
  const [githubPrUrlValue, setGithubPrUrlValue] = useState('');
  const [isUpdatingPrStatus, setIsUpdatingPrStatus] = useState(false);
  const [isAutoCoding, setIsAutoCoding] = useState(false);
  const tagInputRef = useRef(null);
  const [isFetchingPr, setIsFetchingPr] = useState(false);
  const [openPrMenuIdx, setOpenPrMenuIdx] = useState(null);

  const githubPRs = typeof task?.githubPRs === 'string' ? JSON.parse(task.githubPRs || '[]') : (task?.githubPRs || []);

  const getCustomFieldSettingsForProject = (proj) => {
    if (!proj || !proj.customFieldSettings) return [];
    try {
      return typeof proj.customFieldSettings === 'string'
        ? JSON.parse(proj.customFieldSettings)
        : proj.customFieldSettings;
    } catch {
      return [];
    }
  };

  const isProjectExpanded = (projectId) => {
    if (expandedProjects[projectId] !== undefined) return expandedProjects[projectId];
    return true; // Expanded by default
  };

  const toggleProject = (projectId) => {
    setExpandedProjects(prev => {
      const current = prev[projectId] !== undefined ? prev[projectId] : true; // Assuming default was true if not in state but was primary... actually let's just toggle
      const isCurrentlyExpanded = prev[projectId] !== undefined ? prev[projectId] : true; // Actually if it's primary it defaults to true
      // To be safe, let's just toggle the current visual state
      // Wait, we can pass isCurrentlyExpanded directly to the toggle
      return { ...prev, [projectId]: !current };
    });
  };
  const fileInputRef = useRef(null);

  const isReadOnly = projectRole === 'VIEWER' || projectRole === 'COMMENTER';

  useEffect(() => {
    if (task) {
      setEditForm({
        title: task.title || '',
        description: task.description || '',
      });
    }
  }, [task]);

  useEffect(() => {
    if (showTagInput) {
      fetch('http://localhost:5001/api/tags', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAvailableTags(data);
        })
        .catch(console.error);
    }
  }, [showTagInput, token]);

  useEffect(() => {
    if (showProjectInput && availableProjects.length === 0) {
      fetch('http://localhost:5001/api/projects', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAvailableProjects(data);
        })
        .catch(console.error);
    }
  }, [showProjectInput, token, availableProjects.length]);

  useEffect(() => {
    if (!openFieldMenuId && !openSectionMenuId && !isMoreMenuOpen) return;
    const handleClickOutside = (e) => {
      if (e.target.closest('.dropdownMenu') || e.target.closest('[class*="popover"]') || e.target.closest('.more-menu-container')) return;
      setOpenFieldMenuId(null);
      setOpenSectionMenuId(null);
      setIsMoreMenuOpen(false);
      setIsConvertMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openFieldMenuId, openSectionMenuId, isMoreMenuOpen]);

  // Click outside to close the entire pane
  useEffect(() => {
    const handlePaneClickOutside = (e) => {
      // Ignore clicks inside the pane itself
      if (paneRef.current && paneRef.current.contains(e.target)) return;
      
      // Ignore clicks on popovers, dropdowns, or other floating menus that belong to the pane
      // Also ignore clicks on the sidebar hamburger toggle
      // Ignore clicks on tasks so they can open/update the pane instead of closing it
      if (e.target.closest('.dropdownMenu') || e.target.closest('.popover') || e.target.closest('.more-menu-container') || e.target.closest('.flatpickr-calendar') || e.target.closest('.topnav-hamburger') || e.target.closest('[data-task-id]')) return;

      onClose();
    };
    document.addEventListener('mousedown', handlePaneClickOutside);
    return () => document.removeEventListener('mousedown', handlePaneClickOutside);
  }, [onClose]);

  if (!task) return null;

  const handleAddGithubPr = async () => {
    if (!githubPrUrlValue.trim() || isReadOnly) return;
    setIsFetchingPr(true);
    try {
      const response = await fetch('http://localhost:5001/api/github/pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: githubPrUrlValue })
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Failed to fetch PR');
        setIsFetchingPr(false);
        return;
      }

      const newPRs = [...githubPRs, data];
      const patchResponse = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ githubPRs: JSON.stringify(newPRs) })
      });
      const patchData = await patchResponse.json();
      if (patchResponse.ok) {
        onTaskUpdate(task.id, patchData);
        setGithubPrUrlValue('');
        setIsAddingGithubPr(false);
      }
    } catch (e) {
      console.error(e);
      alert('Error adding GitHub PR');
    }
    setIsFetchingPr(false);
  };

  const handleRefreshGithubPRs = async () => {
    if (!githubPRs.length || isReadOnly) return;
    setIsFetchingPr(true);
    try {
      const refreshedPRs = [];
      for (const pr of githubPRs) {
        const response = await fetch('http://localhost:5001/api/github/pr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: pr.url })
        });
        if (response.ok) {
          const data = await response.json();
          refreshedPRs.push(data);
        } else {
          refreshedPRs.push(pr); // keep old if fetch fails
        }
      }

      const patchResponse = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ githubPRs: JSON.stringify(refreshedPRs) })
      });
      const patchData = await patchResponse.json();
      if (patchResponse.ok) {
        onTaskUpdate(task.id, patchData);
      }
    } catch (e) {
      console.error(e);
    }
    setIsFetchingPr(false);
  };

  const handleRemoveGithubPr = async (indexToRemove) => {
    if (isReadOnly) return;
    try {
      const newPRs = githubPRs.filter((_, idx) => idx !== indexToRemove);
      const patchResponse = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ githubPRs: JSON.stringify(newPRs) })
      });
      const patchData = await patchResponse.json();
      if (patchResponse.ok) {
        onTaskUpdate(task.id, patchData);
      }
    } catch (e) {
      console.error('Error removing GitHub PR:', e);
    }
    setOpenPrMenuIdx(null);
  };

  const handleAutoCode = async () => {
    const targetRepo = selectedProject?.githubRepo || task.section?.project?.githubRepo;
    if (!targetRepo) {
      alert("Please connect a GitHub repository in the Project settings first.");
      return;
    }
    setIsAutoCoding(true);
    try {
      const response = await fetch(`http://localhost:5001/api/ai/auto-code/${task.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to auto-code task.');
      
      if (data.newPrData) {
        const currentPRs = typeof task.githubPRs === 'string' ? JSON.parse(task.githubPRs || '[]') : (task.githubPRs || []);
        const updatedPRs = [...currentPRs, data.newPrData];
        onTaskUpdate(task.id, { ...task, githubPRs: JSON.stringify(updatedPRs) });
      }

      alert(`Success! Auto-coded and pushed to branch:\n${data.branch}\n\nPull Request:\n${data.prUrl}`);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsAutoCoding(false);
    }
  };

  const handleSave = async (field, value) => {
    if (isReadOnly) return;

    // Only save if changed
    if (field === 'title' && value === task.title) return;
    if (field === 'description' && value === task.description) return;

    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ [field]: value })
      });
      const data = await response.json();
      if (response.ok) {
        onTaskUpdate(task.id, data);
      } else {
        alert(data.error || 'Failed to update task');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleComplete = async () => {
    if (isReadOnly) return;

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
      });
      const data = await response.json();
      if (response.ok) {
        onTaskUpdate(task.id, data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproval = async (status) => {
    if (isReadOnly) return;
    try {
      const isCompleted = status === 'APPROVED' || status === 'REJECTED';
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ approvalStatus: status, isCompleted })
      });
      const data = await response.json();
      if (response.ok) {
        onTaskUpdate(task.id, data);
      } else {
        alert(data.error || 'Failed to update approval status');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDirectFieldUpdate = async (fieldId, value, shouldCloseMenu = true) => {
    if (isReadOnly) return;
    const bodyData = {};
    const parsedFields = getParsedTaskCustomFields(task.customFields);
    parsedFields[fieldId] = value;
    bodyData.customFields = JSON.stringify(parsedFields);

    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(bodyData)
      });
      const data = await response.json();
      if (response.ok) {
        onTaskUpdate(task.id, data);
        if (shouldCloseMenu) {
          setOpenFieldMenuId(null);
        }
      } else {
        alert(data.error || "Update failed.");
      }
    } catch (err) { console.error(err); }
  };

  const handleOpenDatePicker = (e) => {
    if (isReadOnly || !onOpenPopover) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    let coords = { left: rect.left };
    if (rect.bottom > window.innerHeight - 300) {
      coords.bottom = window.innerHeight - rect.top;
    } else {
      coords.top = rect.bottom + 5;
    }
    onOpenPopover('date', task, coords);
  };

  const handleOpenAssignee = (e) => {
    if (isReadOnly || !onOpenPopover) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    onOpenPopover('assignee', task, { left: rect.left, top: rect.bottom + 5 });
  };

  const formatFriendlyDateRange = (start, end) => {
    if (!start && !end) return "No due date";
    const fmt = (str) => { if (!str) return ''; const d = new Date(str); return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}` }
    return start && !end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
  };

  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (isReadOnly || !newSubtaskTitle.trim()) return;
    try {
      const response = await fetch('http://localhost:5001/api/projects/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: newSubtaskTitle, sectionId: task.sectionId, parentId: task.id })
      });
      const data = await response.json();
      if (response.ok) {
        setNewSubtaskTitle('');
        const updatedTask = { ...task, subtasks: [...(task.subtasks || []), data] };
        onTaskUpdate(task.id, updatedTask);
      }
    } catch (err) { console.error(err); }
  };

  const handleToggleSubtaskComplete = async (subtaskId, isCompleted) => {
    if (isReadOnly) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${subtaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isCompleted: !isCompleted })
      });
      const data = await response.json();
      if (response.ok) {
        const updatedSubtasks = task.subtasks.map(st => st.id === subtaskId ? { ...st, isCompleted: !isCompleted } : st);
        onTaskUpdate(task.id, { ...task, subtasks: updatedSubtasks });
      }
    } catch (err) { console.error(err); }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (projectRole === 'VIEWER' || !newCommentText.trim()) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text: newCommentText })
      });
      const data = await response.json();
      if (response.ok) {
        setNewCommentText('');
        const updatedTask = { ...task, comments: [...(task.comments || []), data] };
        onTaskUpdate(task.id, updatedTask);
      }
    } catch (err) { console.error(err); }
  };

  const handleToggleReaction = async (commentId, emoji) => {
    if (projectRole === 'VIEWER') return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}/comments/${commentId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ emoji })
      });
      if (response.ok) {
        const updatedTask = await response.json();
        onTaskUpdate(task.id, updatedTask);
      }
    } catch (err) { console.error(err); }
  };

  const handleAddTag = async (e) => {
    e.preventDefault();
    if (isReadOnly || !tagInputValue.trim()) return;
    try {
      const tagRes = await fetch('http://localhost:5001/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: tagInputValue.trim(), color: tagColorValue })
      });
      const tagData = await tagRes.json();
      const tagId = tagData.id || tagData.tag?.id;

      if (tagId) {
        const projectId = task.projectId || (selectedProject && selectedProject.id) || task.section?.projectId;
        const assignRes = await fetch(`http://localhost:5001/api/projects/${projectId}/tasks/${task.id}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ tagId })
        });
        const updatedTask = await assignRes.json();
        if (assignRes.ok) {
          onTaskUpdate(task.id, updatedTask);
          setTagInputValue('');
          setShowTagInput(false);
        }
      }
    } catch (err) { console.error(err); }
  };

  const handleAssignExistingTag = async (tagId) => {
    if (isReadOnly) return;
    try {
      const projectId = task.projectId || (selectedProject && selectedProject.id) || task.section?.projectId;
      const assignRes = await fetch(`http://localhost:5001/api/projects/${projectId}/tasks/${task.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tagId })
      });
      const updatedTask = await assignRes.json();
      if (assignRes.ok) {
        onTaskUpdate(task.id, updatedTask);
        setTagInputValue('');
        setShowTagInput(false);
      }
    } catch (err) { console.error(err); }
  };

  const handleRemoveTag = async (tagId) => {
    if (isReadOnly) return;
    try {
      const projectId = task.projectId || (selectedProject && selectedProject.id) || task.section?.projectId;
      const res = await fetch(`http://localhost:5001/api/projects/${projectId}/tasks/${task.id}/tags/${tagId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const updatedTask = await res.json();
      if (res.ok) {
        onTaskUpdate(task.id, updatedTask);
      }
    } catch (err) { console.error(err); }
  };

  const handleAddToProject = async (projectId) => {
    if (isReadOnly) return;
    try {
      const selectedProj = availableProjects.find(p => p.id === projectId);
      const sectionId = selectedProj?.sections?.[0]?.id; // Default to first section
      if (!sectionId) return alert('This project has no sections!');

      const res = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetProjectId: projectId, targetSectionId: sectionId })
      });
      const data = await res.json();
      if (res.ok) {
        // Append locally
        const updatedTask = {
          ...task,
          secondaryProjects: [...(task.secondaryProjects || []), data]
        };
        onTaskUpdate(task.id, updatedTask);
        setShowProjectInput(false);
      } else {
        alert(data.error || 'Failed to add to project');
      }
    } catch (err) { console.error(err); }
  };

  const handleRemoveFromProject = async (projectId) => {
    if (isReadOnly) return;
    if (task.section?.projectId === projectId) {
      alert("You cannot remove the task from its primary project from here.");
      return;
    }
    if (!window.confirm("Are you sure you want to remove this task from the project?")) return;
    try {
      const res = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const updatedTask = {
          ...task,
          secondaryProjects: (task.secondaryProjects || []).filter(sp => sp.projectId !== projectId)
        };
        onTaskUpdate(task.id, updatedTask);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to remove from project');
      }
    } catch (err) { console.error(err); }
  };

  const handleChangeSection = async (projectId, newSectionId) => {
    if (isReadOnly) return;
    setOpenSectionMenuId(null);
    try {
      const res = await fetch(`http://localhost:5001/api/projects/tasks/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ taskId: task.id, targetSectionId: newSectionId, projectId })
      });
      if (res.ok) {
        // Refresh the task to get the new section data. 
        // We can just rely on the socket 'task_moved' event to refresh the board, but let's also update locally.
        // Wait, the API doesn't return the full task, it returns a success message or the updated taskProject.
        // Actually, let's just let the board handle it, or we can fetch the task again.
        // For now, we know the section name changed. Let's just optimistic update.
        // But since we have websockets, it will update automatically!
        // To be safe, let's just trigger a task update if we can.
        // Actually `onTaskUpdate` requires the full task.
        // We'll let the socket handle the board refresh!
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to change section');
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteComment = async (commentId) => {
    if (projectRole === 'VIEWER') return;
    if (!window.confirm("Yorumu silmek istediğinize emin misiniz?")) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const updatedComments = task.comments.filter(c => c.id !== commentId);
        onTaskUpdate(task.id, { ...task, comments: updatedComments });
      } else {
        const data = await response.json();
        alert(data.error || "Silinemedi");
      }
    } catch (err) { console.error(err); }
  };

  const handleFileUpload = async (files) => {
    if (isReadOnly || !files?.length) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('files', file));

      const response = await fetch(`http://localhost:5001/api/projects/tasks/${task.id}/attachments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const newAttachments = await response.json();
      if (response.ok) {
        const simulatedActivities = newAttachments.map(att => ({
          id: 'temp-' + Math.random(),
          action: `attached ${att.originalName}`,
          createdAt: new Date().toISOString(),
          user: currentUser
        }));
        const updatedTask = {
          ...task,
          attachments: [...newAttachments, ...(task.attachments || [])],
          activities: [...(task.activities || []), ...simulatedActivities]
        };
        onTaskUpdate(task.id, updatedTask);
      }
    } catch (err) { console.error(err); }
    finally { setIsUploading(false); }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      const response = await fetch(`http://localhost:5001/api/projects/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const deletedAttachment = (task.attachments || []).find(a => a.id === attachmentId);
        const updatedAttachments = (task.attachments || []).filter(a => a.id !== attachmentId);
        const simulatedActivity = deletedAttachment ? {
          id: 'temp-' + Math.random(),
          action: `removed attachment ${deletedAttachment.originalName}`,
          createdAt: new Date().toISOString(),
          user: currentUser
        } : null;

        const updatedTask = {
          ...task,
          attachments: updatedAttachments,
          activities: simulatedActivity ? [...(task.activities || []), simulatedActivity] : task.activities
        };
        onTaskUpdate(task.id, updatedTask);
      }
    } catch (err) { console.error(err); }
  };

  const parsedFields = getParsedTaskCustomFields(task.customFields);

  const activeBlockedBy = task.blockedBy?.filter(dep => !dep.blockingTask?.isCompleted) || [];
  const activeBlocking = task.blocking?.filter(dep => !dep.blockedByTask?.isCompleted) || [];

  return (
    <>
      <div style={styles.pane} ref={paneRef}>
        <div style={styles.header}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {task.type === 'APPROVAL' ? (
              <div
                style={{
                  ...styles.completeBtn,
                  backgroundColor: task.approvalStatus === 'APPROVED' ? 'var(--accent-success)' : task.approvalStatus === 'REJECTED' ? 'var(--accent-danger)' : task.approvalStatus === 'CHANGES_REQUESTED' ? '#F59E0B' : 'transparent',
                  color: task.approvalStatus === 'PENDING' || !task.approvalStatus ? 'var(--text-primary)' : '#FFF',
                  border: task.approvalStatus === 'PENDING' || !task.approvalStatus ? '1px solid var(--border-color)' : '1px solid transparent',
                  cursor: 'default'
                }}
              >
                {task.approvalStatus === 'APPROVED' ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><polyline points="20 6 9 17 4 12"></polyline></svg> Approved</> : task.approvalStatus === 'REJECTED' ? '✕ Rejected' : task.approvalStatus === 'CHANGES_REQUESTED' ? '⟳ Changes Requested' : '⚖️ Approval Pending'}
              </div>
            ) : task.type === 'MILESTONE' ? (
              <button
                style={{
                  ...styles.completeBtn,
                  backgroundColor: task.isCompleted ? 'var(--accent-success)' : 'transparent',
                  color: task.isCompleted ? '#FFF' : '#6366F1',
                  border: task.isCompleted ? '1px solid var(--accent-success)' : '1px solid #6366F1',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
                onClick={handleToggleComplete}
                disabled={isReadOnly}
              >
                <span style={{ display: 'inline-block', width: '10px', height: '10px', transform: 'rotate(45deg)', backgroundColor: task.isCompleted ? '#FFF' : '#6366F1', border: 'none', flexShrink: 0 }} />
                {task.isCompleted ? 'Completed' : 'Milestone'}
              </button>
            ) : (
              <button
                style={{ ...styles.completeBtn, backgroundColor: task.isCompleted ? 'var(--accent-success)' : 'transparent', color: task.isCompleted ? '#FFF' : 'var(--text-primary)' }}
                onClick={handleToggleComplete}
                disabled={isReadOnly}
              >
                {task.isCompleted ? '✓ Completed' : '✓ Mark complete'}
              </button>
            )}
          </div>
          <div style={styles.headerActions}>
            {(selectedProject?.githubRepo || task.section?.project?.githubRepo) && !isReadOnly && (
              <button
                style={{
                  ...styles.iconBtn,
                  padding: '4px 8px',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  color: isAutoCoding ? 'var(--text-secondary)' : '#FFF',
                  backgroundColor: isAutoCoding ? 'transparent' : 'var(--accent-primary)',
                  border: isAutoCoding ? '1px solid var(--border-color)' : '1px solid var(--accent-primary)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginRight: '8px'
                }}
                onClick={handleAutoCode}
                disabled={isAutoCoding}
                title="Automatically write code for this task using Gemini AI"
              >
                {isAutoCoding ? '🤖 Coding...' : '🤖 Auto-Code'}
              </button>
            )}
            <div className="more-menu-container" style={{ position: 'relative' }}>
              <button
                style={{ ...styles.iconBtn, fontSize: '1.2rem', paddingBottom: '0.2rem' }}
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                title="More actions"
              >
                ⋯
              </button>

              {isMoreMenuOpen && (
                <div style={{ position: 'absolute', top: '100%', right: '0', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)', zIndex: 100, padding: '0.4rem', minWidth: '150px', marginTop: '4px' }}>
                  <div
                    style={{ position: 'relative' }}
                    onMouseEnter={() => setIsConvertMenuOpen(true)}
                    onMouseLeave={() => setIsConvertMenuOpen(false)}
                  >
                    <button style={{ width: '100%', padding: '0.6rem 0.8rem', backgroundColor: isConvertMenuOpen ? 'var(--bg-secondary)' : 'transparent', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 8h16M4 16h16"></path><circle cx="6" cy="8" r="2"></circle><circle cx="18" cy="16" r="2"></circle></svg>
                        Convert to
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '1rem', transform: 'rotate(180deg)' }}>›</span>
                    </button>

                    {isConvertMenuOpen && (
                      <div style={{ position: 'absolute', top: '-5px', right: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)', zIndex: 101, padding: '0.4rem', minWidth: '150px' }}>
                        <button onClick={() => { onConvertTask('TASK', task.id); setIsMoreMenuOpen(false); setIsConvertMenuOpen(false); }} style={{ width: '100%', padding: '0.6rem 0.8rem', backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--text-secondary)' }}>✓</span> Task</button>
                        <button onClick={() => { onConvertTask('MILESTONE', task.id); setIsMoreMenuOpen(false); setIsConvertMenuOpen(false); }} style={{ width: '100%', padding: '0.6rem 0.8rem', backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--text-secondary)' }}>◇</span> Milestone</button>
                        <button onClick={() => { onConvertTask('APPROVAL', task.id); setIsMoreMenuOpen(false); setIsConvertMenuOpen(false); }} style={{ width: '100%', padding: '0.6rem 0.8rem', backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--text-secondary)' }}>⚖️</span> Approval</button>
                        <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }}></div>
                        <button onClick={() => { alert('Coming soon'); setIsMoreMenuOpen(false); setIsConvertMenuOpen(false); }} style={{ width: '100%', padding: '0.6rem 0.8rem', backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--text-secondary)' }}>⑂</span> Subtask</button>
                        <button onClick={() => { onConvertTask('PROJECT', task.id); setIsMoreMenuOpen(false); setIsConvertMenuOpen(false); }} style={{ width: '100%', padding: '0.6rem 0.8rem', backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--text-secondary)' }}>📋</span> Project</button>
                        <button onClick={() => { alert('Coming soon'); setIsMoreMenuOpen(false); setIsConvertMenuOpen(false); }} style={{ width: '100%', padding: '0.6rem 0.8rem', backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--text-secondary)' }}>◯</span> Task template</button>
                      </div>
                    )}
                  </div>
                  <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }}></div>
                  <button onClick={() => { onDeleteTask(task.id); setIsMoreMenuOpen(false); }} style={{ width: '100%', padding: '0.6rem 0.8rem', backgroundColor: 'transparent', color: 'var(--accent-danger)', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--accent-danger)' }}>🗑️</span> Delete Task
                  </button>
                </div>
              )}
            </div>
            <button style={styles.iconBtn} onClick={onClose} title="Close details">×</button>
          </div>
        </div>

        {task.type === 'APPROVAL' && (
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: task.approvalStatus === 'APPROVED' ? 'var(--accent-success)' : task.approvalStatus === 'REJECTED' ? 'var(--accent-danger)' : task.approvalStatus === 'CHANGES_REQUESTED' ? '#F59E0B' : 'transparent', border: task.approvalStatus === 'PENDING' || !task.approvalStatus ? '2px dashed var(--text-tertiary)' : 'none', color: task.approvalStatus === 'PENDING' || !task.approvalStatus ? 'var(--text-secondary)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {task.approvalStatus === 'APPROVED' ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : task.approvalStatus === 'REJECTED' ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> : task.approvalStatus === 'CHANGES_REQUESTED' ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.67-5.67"></path></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {task.approvalStatus === 'APPROVED' ? 'Approved' : task.approvalStatus === 'REJECTED' ? 'Rejected' : task.approvalStatus === 'CHANGES_REQUESTED' ? 'Changes Requested' : 'Approval Pending'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Assignee must approve
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(!task.assigneeId || (currentUser && task.assigneeId === currentUser.id)) ? (
                <>
                  <button onClick={() => handleApproval('APPROVED')} style={{ ...styles.approvalBtn, backgroundColor: task.approvalStatus === 'APPROVED' ? 'var(--accent-success)' : 'transparent', color: task.approvalStatus === 'APPROVED' ? '#fff' : 'var(--text-primary)', borderColor: 'var(--accent-success)' }}>Approve</button>
                  <button onClick={() => handleApproval('CHANGES_REQUESTED')} style={{ ...styles.approvalBtn, backgroundColor: task.approvalStatus === 'CHANGES_REQUESTED' ? '#F59E0B' : 'transparent', color: task.approvalStatus === 'CHANGES_REQUESTED' ? '#fff' : 'var(--text-primary)', borderColor: '#F59E0B' }}>Request Changes</button>
                  <button onClick={() => handleApproval('REJECTED')} style={{ ...styles.approvalBtn, backgroundColor: task.approvalStatus === 'REJECTED' ? 'var(--accent-danger)' : 'transparent', color: task.approvalStatus === 'REJECTED' ? '#fff' : 'var(--text-primary)', borderColor: 'var(--accent-danger)' }}>Reject</button>
                </>
              ) : (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Waiting on assignee...</span>
              )}
            </div>
          </div>
        )}

        <div style={styles.body}>
          <input
            type="text"
            style={{ ...styles.titleInput, textDecoration: task.isCompleted ? 'line-through' : 'none' }}
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            onBlur={() => handleSave('title', editForm.title)}
            readOnly={isReadOnly}
            placeholder="Write a task name"
          />

          <div style={styles.fieldsGrid}>
            <div style={styles.fieldRow}>
              <div style={styles.fieldLabel}>Assignee</div>
              <div style={{ ...styles.fieldValue, cursor: isReadOnly ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={handleOpenAssignee}>
                <span style={{ color: 'var(--text-tertiary)' }}>👤</span>
                <span style={{ color: task.assignee ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{task.assignee ? task.assignee.name : 'No assignee'}</span>
              </div>
            </div>

            <div style={styles.fieldRow}>
              <div style={styles.fieldLabel}>Due date</div>
              <div style={{ ...styles.fieldValue, cursor: isReadOnly ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={handleOpenDatePicker}>
                <span style={{ color: 'var(--text-tertiary)' }}>📅</span>
                <span style={{ color: (task.startDate || task.dueDate) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {formatFriendlyDateRange(task.startDate, task.dueDate)}
                </span>
                {task.isRecurring && <span style={{ fontSize: '0.85rem' }} title="Recurring Task">🔁</span>}
              </div>
            </div>

            <div style={styles.fieldRow}>
              <div style={styles.fieldLabel}>Dependencies</div>
              <div style={styles.fieldValue}>
                {(!activeBlockedBy.length && !activeBlocking.length) ? (
                  <div style={{ color: 'var(--text-secondary)' }}>Add dependencies</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {activeBlockedBy.map(dep => (
                      <div key={dep.id} style={styles.dependencyItem}>
                        <span style={styles.dependencyType}>Blocked by:</span>
                        {dep.blockingTask?.title || 'Task'}
                      </div>
                    ))}
                    {activeBlocking.map(dep => (
                      <div key={dep.id} style={styles.dependencyItem}>
                        <span style={styles.dependencyType}>Blocking:</span>
                        {dep.blockedByTask?.title || 'Task'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={styles.fieldRow}>
              <div style={styles.fieldLabel}>Tags</div>
              <div style={styles.fieldValue}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                  {task.tags && task.tags.map(tag => (
                    <span key={tag.id} style={{ color: tag.color, fontSize: '0.85rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path></svg> {tag.name}
                      {!isReadOnly && <span style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => handleRemoveTag(tag.id)}>×</span>}
                    </span>
                  ))}
                  {!isReadOnly && (
                    <div style={{ position: 'relative' }}>
                      {!showTagInput ? (
                        <span style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }} onClick={() => setShowTagInput(true)}>+ Add Tag</span>
                      ) : (
                        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: '8px', zIndex: 100, width: '200px' }}>
                          {availableTags.length > 0 && (
                            <div style={{ marginBottom: '8px', maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {availableTags.filter(t => !task.tags?.find(tt => tt.id === t.id) && t.name.toLowerCase().includes(tagInputValue.toLowerCase())).map(tag => (
                                <div
                                  key={tag.id}
                                  onClick={() => handleAssignExistingTag(tag.id)}
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px', cursor: 'pointer', borderRadius: '4px' }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill={tag.color} style={{ flexShrink: 0 }}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path></svg>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{tag.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <form onSubmit={handleAddTag} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: availableTags.length > 0 ? '1px solid var(--border-color)' : 'none', paddingTop: availableTags.length > 0 ? '8px' : '0' }}>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <input type="text" value={tagInputValue} onChange={e => setTagInputValue(e.target.value)} placeholder="New tag name..." style={{ border: '1px solid var(--border-color)', borderRadius: '4px', outline: 'none', background: 'transparent', flex: 1, fontSize: '0.8rem', padding: '4px', color: 'var(--text-primary)' }} autoFocus />
                              <input type="color" value={tagColorValue} onChange={e => setTagColorValue(e.target.value)} style={{ width: '24px', height: '24px', border: 'none', padding: 0, cursor: 'pointer' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                              <button type="button" onClick={() => setShowTagInput(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 6px' }}>Cancel</button>
                              <button type="submit" style={{ background: 'var(--accent-primary)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 8px' }}>Create</button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem 0', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '500', color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Projects <span style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '0 0.4rem', borderRadius: '4px', fontSize: '0.75rem' }}>{(task.secondaryProjects?.length || 0) + 1}</span>
                {!isReadOnly && (
                  <div style={{ position: 'relative' }}>
                    <span style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: '1', marginLeft: '0.5rem' }} onClick={() => setShowProjectInput(true)}>+</span>
                    {showProjectInput && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: '8px', zIndex: 100, width: '250px' }}>
                        {availableProjects.length > 0 ? (
                          <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {availableProjects.filter(p => p.id !== task.section?.projectId && !task.secondaryProjects?.find(sp => sp.projectId === p.id)).map(proj => (
                              <div
                                key={proj.id}
                                onClick={() => handleAddToProject(proj.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', borderRadius: '4px' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <span style={{ color: proj.color }}>{proj.icon || '📋'}</span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 'normal' }}>{proj.name}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ padding: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Loading projects...</div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                          <button onClick={() => setShowProjectInput(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'normal' }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Projects List */}
              {[{
                isPrimary: true,
                project: task.section?.project || selectedProject,
                section: task.section || selectedProject?.sections?.find(s => s.id === task.sectionId)
              }, ...(task.secondaryProjects || []).map(sp => ({
                isPrimary: false,
                project: sp.project,
                section: sp.section
              }))].filter(p => p.project).map(({ isPrimary, project, section }, index) => {
                const cfs = getCustomFieldSettingsForProject(project);
                const expanded = isProjectExpanded(project.id);

                return (
                  <div key={`${project.id}-${index}`} style={{ width: '100%', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.5rem 0' }}>
                      <span
                        onClick={() => {
                          setExpandedProjects(prev => ({ ...prev, [project.id]: !expanded }));
                        }}
                        style={{ color: 'var(--text-secondary)', fontSize: '0.6rem', cursor: 'pointer', display: 'inline-block', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', padding: '0.2rem' }}
                      >
                        ▼
                      </span>
                      <div style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: project.color || 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}></div>
                      <span style={{ color: 'var(--text-primary)' }}>{project.name}</span>

                      <div style={{ position: 'relative', marginLeft: '0.5rem' }}>
                        <span
                          onClick={(e) => { e.stopPropagation(); if (!isReadOnly) setOpenSectionMenuId(openSectionMenuId === project.id ? null : project.id); }}
                          style={{ color: 'var(--text-secondary)', cursor: isReadOnly ? 'default' : 'pointer' }}
                        >
                          {section?.name} ⌄
                        </span>
                        {openSectionMenuId === project.id && project.sections && (
                          <div style={{ ...styles.dropdownMenu, top: '100%', left: 0, marginTop: '4px' }} className="dropdownMenu" onClick={(e) => e.stopPropagation()}>
                            <div style={{ padding: '4px 8px', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', marginBottom: '2px' }}>Sections</div>
                            {project.sections.map(s => (
                              <button
                                key={s.id}
                                onClick={() => handleChangeSection(project.id, s.id)}
                                style={{ ...styles.dropdownItem, padding: '4px 8px' }}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {!isReadOnly && !isPrimary && (
                        <span style={{ cursor: 'pointer', opacity: 0.7, marginLeft: 'auto', paddingLeft: '8px', color: 'var(--text-secondary)' }} onClick={() => handleRemoveFromProject(project.id)}>×</span>
                      )}
                    </div>

                    {/* Custom Fields */}
                    {expanded && cfs?.length > 0 && (
                      <div style={{ width: '100%' }}>
                        {cfs.map((cf) => {
                          const value = parsedFields[cf.id] || '';
                          const cfType = cf.type || 'single-select';

                          // Icon based on field type
                          const fieldIcon = {
                            'single-select': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="8 10 12 14 16 10"></polyline></svg>,
                            'multi-select': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
                            'date': <span style={{ fontSize: '14px' }}>📅</span>,
                            'people': <span style={{ fontSize: '14px' }}>👤</span>,
                            'text': <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'serif' }}>A</span>,
                            'number': <span style={{ fontSize: '12px', fontWeight: 'bold' }}>#</span>,
                            'formula': <span style={{ fontSize: '11px', fontWeight: 'bold', fontStyle: 'italic' }}>fx</span>,
                            'id': <span style={{ fontSize: '14px' }}>🆔</span>,
                            'timer': <span style={{ fontSize: '14px' }}>⏱</span>,
                            'github_pr': <span style={{ fontSize: '14px' }}>🐙</span>,
                          }[cfType] || <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="8 10 12 14 16 10"></polyline></svg>;

                          // Render value cell based on type
                          const renderFieldValue = () => {
                            // SINGLE-SELECT
                            if (cfType === 'SELECT' || cfType === 'single-select') {
                              const opt = cf.options?.find(o => (o.value || o.label) === value);
                              const displayValue = opt ? (opt.label || opt.value) : (value || '—');
                              return (
                                <>
                                  <span
                                    onClick={(e) => { e.stopPropagation(); if (!isReadOnly) setOpenFieldMenuId(openFieldMenuId === cf.id ? null : cf.id); }}
                                    style={{ cursor: isReadOnly ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: (value && opt?.color) ? opt.color : 'transparent', color: value ? 'var(--text-primary)' : 'var(--text-secondary)', padding: value ? '0.2rem 0.5rem' : '0', borderRadius: '4px', fontSize: '0.85rem' }}
                                  >
                                    {displayValue}
                                  </span>
                                  {openFieldMenuId === cf.id && (
                                    <div style={styles.dropdownMenu} className="dropdownMenu" onClick={(e) => e.stopPropagation()}>
                                      <div style={{ padding: '4px 8px', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', marginBottom: '2px' }}>{cf.title}</div>
                                      {cf.options?.map(o => (
                                        <button
                                          key={o.id}
                                          onClick={() => handleDirectFieldUpdate(cf.id, o.label || o.value)}
                                          style={{ ...styles.dropdownItem, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '4px 8px' }}
                                        >
                                          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: o.color || '#E0E7FF', display: 'inline-block', flexShrink: 0 }}></div>
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label || o.value}</span>
                                        </button>
                                      ))}
                                      <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }}></div>
                                      <button onClick={() => handleDirectFieldUpdate(cf.id, '')} style={{ ...styles.dropdownItem, padding: '4px 8px', color: 'var(--text-secondary)' }}>Clear value</button>
                                    </div>
                                  )}
                                </>
                              );
                            }

                            // MULTI-SELECT
                            if (cfType === 'multi-select') {
                              const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);
                              return (
                                <>
                                  <div
                                    onClick={(e) => { e.stopPropagation(); if (!isReadOnly) setOpenFieldMenuId(openFieldMenuId === cf.id ? null : cf.id); }}
                                    style={{ cursor: isReadOnly ? 'default' : 'pointer', display: 'flex', flexWrap: 'wrap', gap: '4px', minHeight: '24px', alignItems: 'center' }}
                                  >
                                    {selectedValues.length > 0 ? selectedValues.map(sv => {
                                      const opt = cf.options?.find(o => (o.label || o.value) === sv);
                                      return (
                                        <span key={sv} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: opt?.color || '#E0E7FF', color: 'var(--text-primary)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                                          {sv}
                                        </span>
                                      );
                                    }) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>—</span>}
                                  </div>
                                  {openFieldMenuId === cf.id && (
                                    <div style={styles.dropdownMenu} className="dropdownMenu" onClick={(e) => e.stopPropagation()}>
                                      <div style={{ padding: '4px 8px', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', marginBottom: '2px' }}>{cf.title}</div>
                                      {cf.options?.map(o => {
                                        const label = o.label || o.value;
                                        const isSelected = selectedValues.includes(label);
                                        return (
                                          <button
                                            key={o.id}
                                            onClick={() => {
                                              const newVals = isSelected ? selectedValues.filter(v => v !== label) : [...selectedValues, label];
                                              handleDirectFieldUpdate(cf.id, newVals, false);
                                            }}
                                            style={{ ...styles.dropdownItem, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '4px 8px', backgroundColor: isSelected ? 'var(--bg-secondary)' : 'transparent' }}
                                          >
                                            <div style={{ width: 14, height: 14, borderRadius: '3px', border: isSelected ? 'none' : '1px solid #D1D5DB', backgroundColor: isSelected ? '#4F46E5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '10px', color: '#fff' }}>
                                              {isSelected && '✓'}
                                            </div>
                                            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: o.color || '#E0E7FF', display: 'inline-block', flexShrink: 0 }}></div>
                                            <span>{label}</span>
                                          </button>
                                        );
                                      })}
                                      <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }}></div>
                                      <button onClick={() => handleDirectFieldUpdate(cf.id, [])} style={{ ...styles.dropdownItem, padding: '4px 8px', color: 'var(--text-secondary)' }}>Clear all</button>
                                    </div>
                                  )}
                                </>
                              );
                            }

                            // DATE
                            if (cfType === 'date') {
                              const formatted = value ? new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Set Date';
                              return (
                                <div 
                                  onClick={(e) => { 
                                    if (!isReadOnly) {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const coords = { left: rect.left };
                                      if (rect.bottom > window.innerHeight - 300) {
                                        coords.bottom = window.innerHeight - rect.top;
                                      } else {
                                        coords.top = rect.bottom + 5;
                                      }
                                      onOpenPopover('custom-date', task, coords, { customFieldId: cf.id }); 
                                    }
                                  }}
                                  style={{ ...styles.inlineInput, color: value ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: !isReadOnly ? 'pointer' : 'default', display: 'flex', alignItems: 'center', height: '32px' }}
                                >
                                  📅 {formatted}
                                </div>
                              );
                            }

                            // PEOPLE (multi-select from project members)
                            if (cfType === 'people') {
                              const selectedPeople = Array.isArray(value) ? value : (value ? [value] : []);
                              const members = selectedProject?.members?.map(m => m.user) || [];
                              return (
                                <>
                                  <div
                                    onClick={(e) => { e.stopPropagation(); if (!isReadOnly) setOpenFieldMenuId(openFieldMenuId === cf.id ? null : cf.id); }}
                                    style={{ cursor: isReadOnly ? 'default' : 'pointer', display: 'flex', flexWrap: 'wrap', gap: '4px', minHeight: '24px', alignItems: 'center' }}
                                  >
                                    {selectedPeople.length > 0 ? selectedPeople.map(uid => {
                                      const member = members.find(m => m.id === uid);
                                      return (
                                        <span key={uid} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#EDE9FE', color: '#4F46E5', padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.8rem' }}>
                                          <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#4F46E5', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 'bold' }}>
                                            {member?.name?.charAt(0).toUpperCase() || '?'}
                                          </span>
                                          {member?.name || 'Unknown'}
                                        </span>
                                      );
                                    }) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>—</span>}
                                  </div>
                                  {openFieldMenuId === cf.id && (
                                    <div style={styles.dropdownMenu} className="dropdownMenu" onClick={(e) => e.stopPropagation()}>
                                      <div style={{ padding: '4px 8px', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', marginBottom: '2px' }}>People</div>
                                      {members.map(m => {
                                        const isSelected = selectedPeople.includes(m.id);
                                        return (
                                          <button
                                            key={m.id}
                                            onClick={() => {
                                              const newVals = isSelected ? selectedPeople.filter(v => v !== m.id) : [...selectedPeople, m.id];
                                              handleDirectFieldUpdate(cf.id, newVals, false);
                                            }}
                                            style={{ ...styles.dropdownItem, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '4px 8px', backgroundColor: isSelected ? 'var(--bg-secondary)' : 'transparent' }}
                                          >
                                            <div style={{ width: 14, height: 14, borderRadius: '3px', border: isSelected ? 'none' : '1px solid #D1D5DB', backgroundColor: isSelected ? '#4F46E5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '10px', color: '#fff' }}>
                                              {isSelected && '✓'}
                                            </div>
                                            <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#4F46E5', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold', flexShrink: 0 }}>
                                              {m.name?.charAt(0).toUpperCase() || '?'}
                                            </span>
                                            <span>{m.name || m.email}</span>
                                          </button>
                                        );
                                      })}
                                      <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }}></div>
                                      <button onClick={() => handleDirectFieldUpdate(cf.id, [])} style={{ ...styles.dropdownItem, padding: '4px 8px', color: 'var(--text-secondary)' }}>Clear all</button>
                                    </div>
                                  )}
                                </>
                              );
                            }

                            // NUMBER
                            if (cfType === 'number') {
                              const formatNumber = (v) => {
                                if (!v && v !== 0) return '';
                                const fmt = cf.numberFormat || 'plain';
                                const num = Number(v);
                                if (isNaN(num)) return v;
                                if (fmt === 'currency') return `$${num.toLocaleString()}`;
                                if (fmt === 'percent') return `${num}%`;
                                return num.toLocaleString();
                              };
                              return (
                                <input
                                  type="number"
                                  value={value}
                                  readOnly={isReadOnly}
                                  placeholder="—"
                                  onChange={e => {
                                    const newFields = { ...parsedFields, [cf.id]: e.target.value };
                                    task.customFields = JSON.stringify(newFields);
                                    setEditForm({ ...editForm, _cfForceUpdate: Date.now() });
                                  }}
                                  onBlur={e => handleDirectFieldUpdate(cf.id, e.target.value ? Number(e.target.value) : '')}
                                  onKeyDown={e => e.key === 'Enter' && handleDirectFieldUpdate(cf.id, e.target.value ? Number(e.target.value) : '')}
                                  style={{ ...styles.inlineInput, color: value || value === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                                />
                              );
                            }

                            // ID (read-only, auto-generated)
                            if (cfType === 'id') {
                              const idValue = value || task.id?.slice(-6).toUpperCase();
                              return (
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                                  {idValue}
                                </span>
                              );
                            }

                            // TIMER
                            if (cfType === 'timer') {
                              const timerData = (typeof value === 'object' && value !== null) ? value : { running: false, elapsed: 0, lastStart: null };
                              const elapsed = timerData.elapsed || 0;
                              const isRunning = timerData.running || false;
                              const formatTime = (secs) => {
                                const h = Math.floor(secs / 3600);
                                const m = Math.floor((secs % 3600) / 60);
                                const s = secs % 60;
                                return `${h}h ${m}m ${s}s`;
                              };
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '0.85rem', color: isRunning ? '#10B981' : 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                    {formatTime(elapsed)}
                                  </span>
                                  {!isReadOnly && (
                                    <button
                                      onClick={() => {
                                        if (isRunning) {
                                          const now = Math.floor(Date.now() / 1000);
                                          const addedTime = timerData.lastStart ? now - timerData.lastStart : 0;
                                          handleDirectFieldUpdate(cf.id, { running: false, elapsed: elapsed + addedTime, lastStart: null });
                                        } else {
                                          handleDirectFieldUpdate(cf.id, { running: true, elapsed, lastStart: Math.floor(Date.now() / 1000) });
                                        }
                                      }}
                                      style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer', color: isRunning ? '#EF4444' : '#10B981' }}
                                    >
                                      {isRunning ? '⏹ Stop' : '▶ Start'}
                                    </button>
                                  )}
                                </div>
                              );
                            }

                            // FORMULA (read-only placeholder)
                            if (cfType === 'formula') {
                              return (
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                  {value || '—'}
                                </span>
                              );
                            }

                            // GITHUB PR (read-only auto-filled)
                            if (cfType === 'github_pr') {
                              const prs = getParsedGithubPRs(task.githubPRs);
                              if (prs.length === 0) {
                                return <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>—</span>;
                              }
                              
                              const firstPr = prs[0];
                              let statusColor = getGithubPRStatusColor(firstPr);
                              let label = getGithubPRStatusLabel(firstPr);
                  
                              if (prs.length > 1) label += ` (+${prs.length - 1})`;
                              
                              return (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: statusColor, padding: '0.15rem 0.4rem', border: `1px solid ${statusColor}`, borderRadius: '4px' }}>
                                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                    <path fillRule="evenodd" d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.25 2.25 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 7.425A3.155 3.155 0 0012.75 12h.75a.75.75 0 01.75.75v.5a.75.75 0 01-.75.75H12a4.655 4.655 0 01-4.655-4.655V5.372a2.25 2.25 0 111.5 0v3.983c0 .713.273 1.398.75 1.916V7.425z"></path>
                                  </svg>
                                  {label}
                                </span>
                              );
                            }

                            // TEXT (default fallback)
                            return (
                              <input
                                type="text"
                                value={value}
                                placeholder="—"
                                readOnly={isReadOnly}
                                onChange={e => {
                                  const newFields = { ...parsedFields, [cf.id]: e.target.value };
                                  setEditForm({ ...editForm, _cfForceUpdate: Date.now() });
                                  task.customFields = JSON.stringify(newFields);
                                }}
                                onBlur={e => handleDirectFieldUpdate(cf.id, e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleDirectFieldUpdate(cf.id, e.target.value)}
                                style={{ ...styles.inlineInput, color: value ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                              />
                            );
                          };

                          return (
                            <div key={cf.id} style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', borderTop: cf.id === cfs[0].id ? '1px solid var(--border-color)' : 'none', minHeight: '36px', alignItems: 'center' }}>
                              <div style={{ width: '150px', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem', paddingLeft: '0.5rem', flexShrink: 0 }}>
                                {fieldIcon}
                                {cf.title}
                              </div>
                              <div style={{ flex: 1, position: 'relative', paddingLeft: '0.5rem', borderLeft: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', height: '100%' }}>
                                {renderFieldValue()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>

          <div style={styles.descriptionSection}>
            <div style={styles.descriptionLabel}>Description</div>
            {!isReadOnly ? (
              <RichTextEditor
                value={editForm.description}
                onChange={val => setEditForm({ ...editForm, description: val })}
                onBlur={() => handleSave('description', editForm.description)}
                users={selectedProject?.members?.map(m => m.user) || []}
                minHeight="150px"
              />
            ) : (
              <div className="rich-text-content" style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }} dangerouslySetInnerHTML={{ __html: editForm.description || '<p>No description</p>' }} />
            )}
          </div>

          {/* SUBTASKS SECTION */}
          <div style={styles.subtasksSection}>
            <div style={styles.sectionTitle}>Subtasks</div>
            <div style={styles.subtaskList}>
              {task.subtasks?.map(st => (
                <div key={st.id} style={styles.subtaskItem}>
                  <input type="checkbox" checked={st.isCompleted} onChange={() => handleToggleSubtaskComplete(st.id, st.isCompleted)} disabled={isReadOnly} style={{ cursor: 'pointer' }} />
                  <span style={{ textDecoration: st.isCompleted ? 'line-through' : 'none', color: st.isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)', flex: 1, fontSize: '0.9rem' }}>{st.title}</span>
                </div>
              ))}
            </div>
            {!isReadOnly && (
              <form onSubmit={handleAddSubtask} style={styles.subtaskForm}>
                <input type="text" value={newSubtaskTitle} onChange={e => setNewSubtaskTitle(e.target.value)} placeholder="Add a subtask..." style={styles.subtaskInput} />
              </form>
            )}
          </div>

          {/* APPS SECTION */}
          <div style={styles.appsSection}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem' }}>
              <div style={styles.sectionTitle}>Apps <span style={styles.countPill}>{githubPRs.length || 0}</span></div>
              {githubPRs.length > 0 && !isReadOnly && (
                <button onClick={handleRefreshGithubPRs} style={styles.refreshAppBtn} disabled={isFetchingPr} title="Refresh PR Status">
                  {isFetchingPr ? '...' : '↻'}
                </button>
              )}
            </div>
            <div style={styles.appRow}>
              <div style={styles.appName}>GitHub</div>
              <div style={{ flex: 1 }}>
                {!isAddingGithubPr && githubPRs.length === 0 && (
                  <div style={styles.addAppPlaceholder} onClick={() => setIsAddingGithubPr(true)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" /></svg>
                    Add GitHub pull request
                  </div>
                )}
                {isAddingGithubPr && (
                  <div style={styles.addAppInputContainer}>
                    <input
                      type="text"
                      value={githubPrUrlValue}
                      onChange={e => setGithubPrUrlValue(e.target.value)}
                      placeholder="Paste a GitHub pull request URL..."
                      style={styles.addAppInput}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddGithubPr();
                        if (e.key === 'Escape') setIsAddingGithubPr(false);
                      }}
                    />
                    <button onClick={handleAddGithubPr} style={styles.addAppButton} disabled={isFetchingPr}>
                      {isFetchingPr ? '...' : 'Add'}
                    </button>
                  </div>
                )}
                {githubPRs.map((pr, idx) => (
                  <div key={idx} style={styles.githubCard}>
                    <div style={styles.githubCardHeader}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" /></svg>
                      <div style={styles.githubCardTitleArea}>
                        <a href={pr.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                          <div style={styles.githubCardTitle}>#{pr.number} {pr.title}</div>
                        </a>
                        <div style={styles.githubCardSubtitle}>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: 4 }}><path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113.882 1.55l3.204 3.204a2.25 2.25 0 11-1.06 1.06L4.32 5.862A2.25 2.25 0 011.5 3.25zM12.25 8a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 114.5 0 2.25 2.25 0 01-4.5 0z" /></svg>
                          Pull request in {pr.owner}/{pr.repo} • View in GitHub
                        </div>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setOpenPrMenuIdx(openPrMenuIdx === idx ? null : idx)} style={styles.githubCardMoreBtn}>•••</button>
                        {openPrMenuIdx === idx && (
                          <div style={{ ...styles.dropdownMenu, left: 'auto', right: 0, padding: 0, minWidth: '180px', overflow: 'hidden' }} className="dropdownMenu" onClick={(e) => e.stopPropagation()}>
                            <a href={pr.url} target="_blank" rel="noreferrer" className="github-dropdown-item" style={{ ...styles.dropdownItem, textDecoration: 'none', fontSize: '0.9rem', gap: '0.6rem' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                              View in GitHub
                            </a>
                            <button onClick={() => { navigator.clipboard.writeText(pr.url); setOpenPrMenuIdx(null); }} className="github-dropdown-item" style={{ ...styles.dropdownItem, fontSize: '0.9rem', gap: '0.6rem' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                              Copy link
                            </button>
                            <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }}></div>
                            <button onClick={() => handleRemoveGithubPr(idx)} className="github-dropdown-item" style={{ ...styles.dropdownItem, color: 'var(--text-primary)', fontSize: '0.9rem', gap: '0.6rem' }}>
                              Remove from task
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={styles.githubCardMetrics}>
                      <div style={styles.githubMetricCol}>
                        <div style={styles.githubMetricLabel}>Review status</div>
                        <div style={styles.githubMetricValue}>{pr.reviewStatus || 'In review'}</div>
                      </div>
                      <div style={styles.githubMetricCol}>
                        <div style={styles.githubMetricLabel}>PR status</div>
                        <div style={styles.githubMetricValue}>{getGithubPRStatusLabel(pr)}</div>
                      </div>
                      <div style={styles.githubMetricCol}>
                        <div style={styles.githubMetricLabel}>Line changes</div>
                        <div style={styles.githubMetricValue}>
                          <span style={styles.githubAdditions}></span> +{pr.additions}
                          <span style={styles.githubDeletions}></span> -{pr.deletions}
                        </div>
                      </div>
                    </div>
                    <div style={styles.githubCardFooter}>
                      Created in GitHub {new Date(pr.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(pr.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ATTACHMENTS SECTION */}
          <div style={styles.attachmentsSection}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={styles.sectionTitle}>Attachments {task.attachments?.length > 0 && <span style={{ color: 'var(--text-tertiary)', fontWeight: '400' }}>({task.attachments.length})</span>}</div>
              {!isReadOnly && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={styles.attachBtn}
                  disabled={isUploading}
                >
                  📎 {isUploading ? 'Uploading...' : 'Attach file'}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={async (e) => {
                if (!e.target.files?.length) return;
                await handleFileUpload(e.target.files);
                e.target.value = '';
              }}
            />
            {/* Drop zone */}
            {!isReadOnly && (
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(false);
                  if (e.dataTransfer.files?.length) {
                    await handleFileUpload(e.dataTransfer.files);
                  }
                }}
                style={{
                  ...styles.dropZone,
                  borderColor: isDragOver ? 'var(--accent-primary)' : 'var(--border-color)',
                  backgroundColor: isDragOver ? 'rgba(79, 70, 229, 0.05)' : 'transparent'
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>📁</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Drop files here to attach</span>
              </div>
            )}
            {/* Attachment list */}
            {task.attachments?.length > 0 && (
              <div style={styles.attachmentList}>
                {task.attachments.map(att => {
                  const isImage = att.mimeType?.startsWith('image/');
                  const fileUrl = `http://localhost:5001/uploads/${att.filename}`;
                  const sizeStr = att.size < 1024 ? `${att.size} B`
                    : att.size < 1024 * 1024 ? `${(att.size / 1024).toFixed(1)} KB`
                      : `${(att.size / (1024 * 1024)).toFixed(1)} MB`;
                  const fileIcon = att.mimeType?.includes('pdf') ? '📄'
                    : att.mimeType?.includes('word') || att.mimeType?.includes('document') ? '📝'
                      : att.mimeType?.includes('spreadsheet') || att.mimeType?.includes('excel') ? '📊'
                        : att.mimeType?.includes('zip') || att.mimeType?.includes('archive') ? '📦'
                          : att.mimeType?.includes('video') ? '🎬'
                            : att.mimeType?.includes('audio') ? '🎵'
                              : '📎';

                  return (
                    <div key={att.id} style={styles.attachmentItem}>
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={styles.attachmentPreviewLink}>
                        {isImage ? (
                          <div style={styles.attachmentThumb}>
                            <img src={fileUrl} alt={att.originalName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                          </div>
                        ) : (
                          <div style={styles.attachmentFileIcon}>
                            <span style={{ fontSize: '1.8rem' }}>{fileIcon}</span>
                          </div>
                        )}
                      </a>
                      <div style={styles.attachmentInfo}>
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={styles.attachmentName}>{att.originalName}</a>
                        <div style={styles.attachmentMeta}>
                          <span>{sizeStr}</span>
                          <span>•</span>
                          <span>{att.uploader?.name || 'Unknown'}</span>
                          <span>•</span>
                          <span>{new Date(att.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                      {(att.uploaderId === currentUser?.id || projectRole === 'ADMIN' || projectRole === 'EDITOR') && (
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          style={styles.attachmentDeleteBtn}
                          title="Delete attachment"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>



          {/* COMMENTS & ACTIVITY SECTION */}
          <div style={styles.commentsSection}>
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem' }}>
              <button 
                onClick={() => setActivityTab('comments')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: activityTab === 'comments' ? '600' : '400', color: activityTab === 'comments' ? 'var(--text-primary)' : 'var(--text-secondary)', borderBottom: activityTab === 'comments' ? '2px solid var(--text-primary)' : '2px solid transparent', paddingBottom: '0.5rem' }}
              >
                Comments
              </button>
              <button 
                onClick={() => setActivityTab('all')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: activityTab === 'all' ? '600' : '400', color: activityTab === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)', borderBottom: activityTab === 'all' ? '2px solid var(--text-primary)' : '2px solid transparent', paddingBottom: '0.5rem' }}
              >
                All Activity
              </button>
            </div>
            <div style={styles.commentList}>
              {(() => {
                let combinedFeed = [
                  ...(task.comments || []).map(c => ({ ...c, type: 'comment' })),
                  ...(task.activities || []).map(a => ({ ...a, type: 'activity' }))
                ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                if (activityTab === 'comments') {
                  combinedFeed = combinedFeed.filter(item => item.type === 'comment');
                }

                if (combinedFeed.length === 0) {
                  return <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', fontStyle: 'italic' }}>No activity yet.</div>;
                }

                return combinedFeed.map(item => {
                  if (item.type === 'comment') {
                    const reactionGroups = item.reactions ? item.reactions.reduce((acc, r) => {
                      acc[r.emoji] = acc[r.emoji] || [];
                      acc[r.emoji].push(r);
                      return acc;
                    }, {}) : {};

                    return (
                      <div
                        key={`comment-${item.id}`}
                        style={styles.commentItem}
                        onMouseEnter={() => setHoveredCommentId(item.id)}
                        onMouseLeave={() => setHoveredCommentId(null)}
                      >
                        <div style={styles.commentAvatar}>{item.user?.name?.charAt(0).toUpperCase() || '?'}</div>
                        <div style={{ ...styles.commentContent, position: 'relative' }}>
                          <div style={styles.commentHeader}>
                            <span style={styles.commentAuthor}>{item.user?.name || 'Unknown'}</span>
                            <span style={styles.commentTime}>
                              {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="rich-text-content" style={styles.commentText} dangerouslySetInnerHTML={{ __html: item.text }} />

                          {/* Reactions Display */}
                          {Object.keys(reactionGroups).length > 0 && (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '6px' }}>
                              {Object.entries(reactionGroups).map(([emoji, reacts]) => {
                                const hasReacted = currentUser && reacts.some(r => r.userId === currentUser.id);
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() => handleToggleReaction(item.id, emoji)}
                                    style={{
                                      ...styles.reactionPill,
                                      backgroundColor: hasReacted ? 'var(--accent-primary-light)' : 'var(--bg-tertiary)',
                                      borderColor: hasReacted ? 'var(--accent-primary)' : 'transparent',
                                      color: hasReacted ? 'var(--accent-primary)' : 'var(--text-primary)'
                                    }}
                                    title={reacts.map(r => r.user.name).join(', ')}
                                  >
                                    {emoji} {reacts.length}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '4px', opacity: hoveredCommentId === item.id || reactionPickerId === item.id ? 1 : 0, transition: 'opacity 0.15s', alignSelf: 'flex-start' }}>
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={() => setReactionPickerId(reactionPickerId === item.id ? null : item.id)}
                              style={styles.reactionBtn}
                              title="Like"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                            </button>
                            {reactionPickerId === item.id && (
                              <div style={styles.reactionPicker}>
                                {['👍', '❤️', '😂', '🎉', '👀'].map(emj => (
                                  <button key={emj} style={styles.reactionPickerEmoji} onClick={() => { handleToggleReaction(item.id, emj); setReactionPickerId(null); }}>
                                    {emj}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {projectRole !== 'VIEWER' && (projectRole === 'ADMIN' || (currentUser && item.userId === currentUser.id)) && (
                            <button onClick={() => handleDeleteComment(item.id)} style={styles.commentDeleteBtn} title="Delete comment">×</button>
                          )}
                        </div>
                      </div>
                    );
                  } else if (item.action === "attached_github_pr") {
                    let pr = null;
                    try { pr = JSON.parse(item.newValue); } catch (e) { }
                    return (
                      <div key={`activity-${item.id}`} style={styles.activityItem}>
                        <div style={styles.activityAvatar}>{item.user?.name?.charAt(0).toUpperCase() || '?'}</div>
                        <div style={styles.activityContent}>
                          <span style={styles.activityAuthor}>{item.user?.name || 'Unknown'}</span> attached
                          <span style={styles.activityTime}>
                            {' '}• {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {pr && (
                            <div style={{ ...styles.githubCard, marginTop: '1rem', width: '90%' }}>
                              <div style={styles.githubCardHeader}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" /></svg>
                                <div style={styles.githubCardTitleArea}>
                                  <div style={styles.githubCardTitle}>#{pr.number} {pr.title}</div>
                                  <div style={styles.githubCardSubtitle}>
                                    Pull request in {pr.owner}/{pr.repo} • View in GitHub
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={`activity-${item.id}`} style={styles.activityItem}>
                        <div style={styles.activityAvatar}>{item.user?.name?.charAt(0).toUpperCase() || '?'}</div>
                        <div style={styles.activityContent}>
                          <span style={styles.activityAuthor}>{item.user?.name || 'Unknown'}</span> {item.action}
                          {item.oldValue && item.newValue && (
                            <span> from <strong>{item.oldValue}</strong> to <strong>{item.newValue}</strong></span>
                          )}
                          <span style={styles.activityTime}>
                            {' '}• {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  }
                });
              })()}
            </div>
            {projectRole !== 'VIEWER' && (
              <div style={styles.commentForm}>
                <div style={styles.commentAvatarCurrentUser}>{currentUser?.name?.charAt(0).toUpperCase() || '?'}</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <RichTextEditor
                    value={newCommentText}
                    onChange={val => setNewCommentText(val)}
                    users={selectedProject?.members?.map(m => m.user) || []}
                    minHeight="60px"
                  />
                  <button onClick={handleAddComment} style={{ ...styles.saveBtn, alignSelf: 'flex-end', padding: '6px 12px', fontSize: '0.85rem' }}>
                    Comment
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  pane: { position: 'fixed', top: '52px', right: 0, bottom: 0, width: '700px', backgroundColor: 'var(--bg-primary)', boxShadow: '-4px 0 15px rgba(0,0,0,0.05)', zIndex: 10001, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', animation: 'slideIn 0.2s ease-out' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)' },
  completeBtn: { padding: '0.4rem 1rem', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: '0.2s' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  iconBtn: { background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0 0.5rem' },
  body: { flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  titleInput: { width: '100%', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-primary)', border: 'none', outline: 'none', backgroundColor: 'transparent' },
  fieldsGrid: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' },
  fieldRow: { display: 'flex', alignItems: 'center', padding: '0.5rem 0', minHeight: '32px' },
  fieldLabel: { width: '160px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' },
  fieldValue: { flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' },
  divider: { height: '1px', backgroundColor: 'var(--border-color)', margin: '0.5rem 0' },
  inlineInput: { background: 'none', border: '1px solid transparent', color: 'var(--text-primary)', fontSize: '0.85rem', width: '100%', outline: 'none', padding: '0' },
  descriptionSection: { marginTop: '1.5rem' },
  descriptionLabel: { fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' },
  descriptionInput: { width: '100%', border: 'none', padding: '0', fontSize: '0.9rem', color: 'var(--text-primary)', background: 'transparent', outline: 'none', resize: 'vertical', minHeight: '150px' },
  footer: { padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: 'var(--bg-secondary)' },
  cancelBtn: { padding: '0.5rem 1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', fontWeight: '500', cursor: 'pointer' },
  saveBtn: { padding: '0.5rem 1.5rem', backgroundColor: 'var(--accent-primary)', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' },
  projectPill: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.5rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '500' },
  projectSquare: { width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#34D399' },
  dependencyItem: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-primary)' },
  dependencyType: { color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '500' },
  dropdownMenu: { position: 'absolute', top: '100%', left: 0, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 50, padding: '0.25rem', minWidth: '120px', marginTop: '4px' },
  dropdownItem: { width: '100%', backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500', textAlign: 'left', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '0.4rem' },
  subtasksSection: { marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' },
  sectionTitle: { fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '1rem' },
  subtaskList: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' },
  subtaskItem: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' },
  subtaskForm: { display: 'flex', alignItems: 'center', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' },
  subtaskInput: { border: 'none', outline: 'none', width: '100%', fontSize: '0.9rem', background: 'transparent', color: 'var(--text-primary)' },
  commentsSection: { marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' },
  commentList: { display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' },
  commentItem: { display: 'flex', gap: '0.75rem' },
  commentAvatar: { width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '0.85rem', flexShrink: 0 },
  commentAvatarCurrentUser: { width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--accent-success)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '0.85rem', flexShrink: 0 },
  commentContent: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  commentHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  commentAuthor: { fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-primary)' },
  commentTime: { fontSize: '0.75rem', color: 'var(--text-secondary)' },
  commentText: { fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.4' },
  commentDeleteBtn: { background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1rem', padding: '0 0.25rem' },
  commentForm: { display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginTop: '1rem' },
  commentInput: { flex: 1, padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.9rem', resize: 'vertical', outline: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)' },

  // Activity Feed Styles
  activityItem: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0' },
  activityAvatar: { width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500', fontSize: '0.7rem', flexShrink: 0 },
  activityContent: { fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' },
  activityAuthor: { fontWeight: '600', color: 'var(--text-primary)' },
  activityTime: { fontSize: '0.75rem', color: 'var(--text-tertiary)' },

  attachmentsSection: { marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' },
  attachBtn: { background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 12px', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s' },
  dropZone: { border: '2px dashed var(--border-color)', borderRadius: '8px', padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s', marginBottom: '0.75rem', cursor: 'pointer' },
  attachmentList: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  attachmentItem: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', transition: 'box-shadow 0.15s' },
  attachmentPreviewLink: { textDecoration: 'none', flexShrink: 0 },
  attachmentThumb: { width: '56px', height: '56px', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'var(--bg-tertiary)', flexShrink: 0 },
  attachmentFileIcon: { width: '56px', height: '56px', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  attachmentInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  attachmentName: { fontSize: '0.85rem', fontWeight: '500', color: 'var(--accent-primary)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' },
  attachmentMeta: { fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '0.4rem' },
  attachmentDeleteBtn: { background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.4rem', flexShrink: 0, transition: 'color 0.15s' },

  reactionPill: { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', border: '1px solid transparent', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s' },
  reactionBtn: { background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s' },
  reactionPicker: { position: 'absolute', top: '100%', right: 0, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '4px 8px', display: 'flex', gap: '4px', zIndex: 100, marginTop: '4px' },
  reactionPickerEmoji: { background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: '4px', borderRadius: '50%', transition: 'background-color 0.15s', ':hover': { backgroundColor: 'var(--bg-secondary)' } },

  approvalBtn: { padding: '0.4rem 0.8rem', border: '1px solid', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '0.8rem', transition: 'all 0.15s' },

  appsSection: { marginBottom: '2rem' },
  countPill: { backgroundColor: 'var(--bg-tertiary)', borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-secondary)' },
  refreshAppBtn: { background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center', marginLeft: '0.5rem' },
  appRow: { display: 'flex', gap: '1rem', alignItems: 'flex-start' },
  appName: { fontSize: '0.85rem', color: 'var(--text-primary)', width: '60px', marginTop: '6px' },
  addAppPlaceholder: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 0' },
  addAppInputContainer: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
  addAppInput: { flex: 1, padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' },
  addAppButton: { padding: '6px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' },
  githubCard: { border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '1rem' },
  githubCardHeader: { display: 'flex', gap: '1rem', alignItems: 'flex-start' },
  githubCardTitleArea: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  githubCardTitle: { fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)' },
  githubCardSubtitle: { fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' },
  githubCardMoreBtn: { background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1rem' },
  githubCardMetrics: { display: 'flex', gap: '2rem', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '0.75rem 0' },
  githubMetricCol: { display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  githubMetricLabel: { fontSize: '0.75rem', color: 'var(--text-tertiary)' },
  githubMetricValue: { fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' },
  githubAdditions: { width: 8, height: 8, borderRadius: '50%', backgroundColor: '#2DA44E', display: 'inline-block' },
  githubDeletions: { width: 8, height: 8, borderRadius: '50%', backgroundColor: '#CF222E', marginLeft: '4px', display: 'inline-block' },
  githubCardFooter: { fontSize: '0.75rem', color: 'var(--text-tertiary)' }
};

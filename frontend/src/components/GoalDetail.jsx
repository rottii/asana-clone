import React, { useState, useEffect } from 'react';
import './Goals.css'; // We'll reuse some css and add specific ones later if needed
import { apiFetch } from '../api';

export default function GoalDetail({ goal, token, onBack }) {
  const [currentGoal, setCurrentGoal] = useState(goal);
  const [isEditing, setIsEditing] = useState(false);
  const [projects, setProjects] = useState([]);
  
  // Edit Form State
  const [editStatus, setEditStatus] = useState(goal.status);
  const [editTimePeriod, setEditTimePeriod] = useState(goal.timePeriod || '');
  const [editMetricType, setEditMetricType] = useState(goal.metricType);
  const [editCurrentValue, setEditCurrentValue] = useState(goal.currentValue);
  const [editTargetValue, setEditTargetValue] = useState(goal.targetValue);
  const [editDescription, setEditDescription] = useState(goal.description || '');

  // Project linking state
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [allWorkspaceProjects, setAllWorkspaceProjects] = useState([]);

  useEffect(() => {
    // Fetch all projects for the linking dropdown
    apiFetch('/api/projects', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setAllWorkspaceProjects(data))
    .catch(err => console.error(err));
  }, [token]);

  const handleSave = async () => {
    try {
      const res = await apiFetch(`/api/goals/${currentGoal.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: editStatus,
          timePeriod: editTimePeriod,
          metricType: editMetricType,
          currentValue: Number(editCurrentValue),
          targetValue: Number(editTargetValue),
          description: editDescription
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentGoal(updated);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to update goal', err);
    }
  };

  const handleLinkProject = async (projectId) => {
    try {
      const res = await apiFetch(`/api/goals/${currentGoal.id}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ projectId })
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentGoal(updated);
        setShowProjectSelect(false);
      }
    } catch (err) {
      console.error('Failed to link project', err);
    }
  };

  const handleUnlinkProject = async (projectId) => {
    try {
      const res = await apiFetch(`/api/goals/${currentGoal.id}/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentGoal(updated);
      }
    } catch (err) {
      console.error('Failed to unlink project', err);
    }
  };

  const handleDeleteGoal = async () => {
    if (!window.confirm("Are you sure you want to delete this goal?")) return;
    try {
      const res = await apiFetch(`/api/goals/${currentGoal.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        onBack();
      }
    } catch (err) {
      console.error('Failed to delete goal', err);
    }
  };

  const progress = currentGoal.targetValue > 0 ? (currentGoal.currentValue / currentGoal.targetValue) * 100 : 0;
  const cappedProgress = Math.min(Math.max(progress, 0), 100);
  
  let statusColor = '#10B981';
  if (currentGoal.status === 'At risk') statusColor = '#F59E0B';
  if (currentGoal.status === 'Off track') statusColor = '#EF4444';

  const linkedProjectIds = currentGoal.projects?.map(p => p.projectId) || [];
  const availableProjectsToLink = allWorkspaceProjects.filter(p => !linkedProjectIds.includes(p.id) && !p.isArchived);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        ← Back to Goals
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <div style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              {currentGoal.level} Goal
            </div>
            {currentGoal.timePeriod && (
              <div style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', fontSize: '0.8rem' }}>
                {currentGoal.timePeriod}
              </div>
            )}
            <div style={{ padding: '0.25rem 0.75rem', backgroundColor: `${statusColor}15`, color: statusColor, borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              {currentGoal.status}
            </div>
          </div>
          <h1 style={{ margin: 0, fontSize: '2rem', color: 'var(--text-primary)' }}>{currentGoal.title}</h1>
        </div>
        <div>
          <button onClick={() => setIsEditing(!isEditing)} style={{ padding: '0.5rem 1rem', border: '1px solid #D1D5DB', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', cursor: 'pointer', marginRight: '1rem' }}>
            {isEditing ? 'Cancel Edit' : 'Edit Goal'}
          </button>
          <button onClick={handleDeleteGoal} style={{ padding: '0.5rem 1rem', border: '1px solid #EF4444', color: '#EF4444', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', cursor: 'pointer' }}>
            Delete
          </button>
        </div>
      </div>

      {isEditing ? (
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px', border: '1px solid #E5E7EB', marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0 }}>Update Progress</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #D1D5DB' }}>
                <option value="On track">On track</option>
                <option value="At risk">At risk</option>
                <option value="Off track">Off track</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Time Period</label>
              <input type="text" value={editTimePeriod} onChange={e => setEditTimePeriod(e.target.value)} placeholder="e.g. Q3 2026" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Metric Type</label>
              <select value={editMetricType} onChange={e => setEditMetricType(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #D1D5DB' }}>
                <option value="Percentage">Percentage</option>
                <option value="Numeric">Numeric</option>
                <option value="Currency">Currency</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Current Value</label>
              <input type="number" value={editCurrentValue} onChange={e => setEditCurrentValue(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Target Value</label>
              <input type="number" value={editTargetValue} onChange={e => setEditTargetValue(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
            </div>
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Description</label>
            <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows="3" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #D1D5DB', resize: 'vertical' }} />
          </div>
          <button onClick={handleSave} style={{ backgroundColor: '#4F46E5', color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Save Updates
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {currentGoal.metricType === 'Currency' && '$'}
              {currentGoal.currentValue} {currentGoal.metricType === 'Percentage' && '%'}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Target: {currentGoal.metricType === 'Currency' && '$'}{currentGoal.targetValue}{currentGoal.metricType === 'Percentage' && '%'}
            </span>
          </div>
          <div style={{ height: '16px', backgroundColor: '#E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${cappedProgress}%`, backgroundColor: statusColor, transition: 'width 0.5s' }}></div>
          </div>
          
          {currentGoal.description && (
            <div style={{ marginTop: '2rem', color: 'var(--text-primary)', lineHeight: '1.6' }}>
              <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>About this goal</h3>
              <p>{currentGoal.description}</p>
            </div>
          )}
        </div>
      )}

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Supporting Work</h2>
          <button onClick={() => setShowProjectSelect(!showProjectSelect)} style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--bg-primary)', border: '1px solid #D1D5DB', borderRadius: '4px', cursor: 'pointer' }}>
            + Link Project
          </button>
        </div>

        {showProjectSelect && (
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '6px', border: '1px solid #E5E7EB', marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 1rem 0' }}>Select a project to link</h4>
            {availableProjectsToLink.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>No more projects available to link.</p>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {availableProjectsToLink.map(p => (
                  <button key={p.id} onClick={() => handleLinkProject(p.id)} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--bg-primary)', border: '1px solid #D1D5DB', borderRadius: '99px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#2dd4bf' }}>🚀</span> {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {currentGoal.projects && currentGoal.projects.length > 0 ? (
            currentGoal.projects.map(link => (
              <div key={link.projectId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'var(--bg-primary)', border: '1px solid #E5E7EB', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '32px', height: '32px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2dd4bf' }}>🚀</div>
                  <div>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{link.project.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Project</div>
                  </div>
                </div>
                <button onClick={() => handleUnlinkProject(link.projectId)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '1.2rem' }} title="Remove link">
                  ×
                </button>
              </div>
            ))
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed #D1D5DB', borderRadius: '6px', color: 'var(--text-secondary)' }}>
              No projects linked to this goal yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

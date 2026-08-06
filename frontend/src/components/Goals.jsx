import React, { useState, useEffect } from 'react';
import GoalDetail from './GoalDetail';
import { apiFetch } from '../api';
import './Goals.css';
import UserAvatar from './UserAvatar';

export default function Goals({ token, user, setActiveView }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState(null);
  
  // Create Goal Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalLevel, setNewGoalLevel] = useState('Company');

  const fetchGoals = async () => {
    try {
      const res = await apiFetch('/api/goals', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGoals(data);
      }
    } catch (err) {
      console.error('Failed to fetch goals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [token]);

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;

    try {
      const res = await apiFetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newGoalTitle,
          level: newGoalLevel,
          status: 'On track',
          metricType: 'Percentage',
          currentValue: 0,
          targetValue: 100
        })
      });
      if (res.ok) {
        const created = await res.json();
        setGoals([created, ...goals]);
        setNewGoalTitle('');
        setShowCreateModal(false);
        setSelectedGoal(created); // Automatically open the new goal
      }
    } catch (err) {
      console.error('Failed to create goal:', err);
    }
  };

  if (selectedGoal) {
    return (
      <GoalDetail 
        goal={selectedGoal} 
        token={token} 
        onBack={() => {
          setSelectedGoal(null);
          fetchGoals(); // Refresh the list when coming back
        }} 
      />
    );
  }

  const companyGoals = goals.filter(g => g.level === 'Company');
  const teamGoals = goals.filter(g => g.level === 'Team');

  const renderGoalCard = (goal) => {
    const progress = goal.targetValue > 0 ? (goal.currentValue / goal.targetValue) * 100 : 0;
    const cappedProgress = Math.min(Math.max(progress, 0), 100);
    
    let statusColor = '#10B981'; // On track - Green
    if (goal.status === 'At risk') statusColor = '#F59E0B'; // Yellow
    if (goal.status === 'Off track') statusColor = '#EF4444'; // Red

    return (
      <div key={goal.id} className="goal-card" onClick={() => setSelectedGoal(goal)}>
        <div className="goal-card-header">
          <div className="goal-card-icon" style={{ backgroundColor: statusColor }}>🎯</div>
          <h3 className="goal-card-title">{goal.title}</h3>
        </div>
        
        <div className="goal-card-body">
          <div className="goal-card-status" style={{ color: statusColor, backgroundColor: `${statusColor}15` }}>
            {goal.status}
          </div>
          {goal.timePeriod && <div className="goal-card-period">{goal.timePeriod}</div>}
        </div>

        <div className="goal-card-footer">
          <div className="goal-progress-wrapper">
            <div className="goal-progress-bar">
              <div className="goal-progress-fill" style={{ width: `${cappedProgress}%`, backgroundColor: statusColor }}></div>
            </div>
            <span className="goal-progress-text">{Math.round(cappedProgress)}%</span>
          </div>
          <div title={goal.owner?.name}>
            <UserAvatar name={goal.owner?.name} size={24} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="goals-container">
      <div className="goals-header">
        <div className="goals-header-left">
          <div className="goals-header-icon">🎯</div>
          <h1 className="goals-page-title">Goals</h1>
        </div>
        <div className="goals-header-right">
          <button className="add-goal-btn" onClick={() => setShowCreateModal(true)}>+ Add Goal</button>
        </div>
      </div>

      <div className="goals-content">
        {loading ? (
          <div className="goals-loading">Loading goals...</div>
        ) : (
          <>
            <div className="goals-section">
              <h2 className="goals-section-title">Company Goals</h2>
              <p className="goals-section-desc">High-level objectives that guide the entire organization.</p>
              
              {companyGoals.length === 0 ? (
                <div className="goals-empty">No company goals yet.</div>
              ) : (
                <div className="goals-grid">
                  {companyGoals.map(renderGoalCard)}
                </div>
              )}
            </div>

            <div className="goals-divider"></div>

            <div className="goals-section">
              <h2 className="goals-section-title">Team Goals</h2>
              <p className="goals-section-desc">Specific objectives owned by individual teams or groups.</p>
              
              {teamGoals.length === 0 ? (
                <div className="goals-empty">No team goals yet.</div>
              ) : (
                <div className="goals-grid">
                  {teamGoals.map(renderGoalCard)}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showCreateModal && (
        <div className="goal-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="goal-modal" onClick={e => e.stopPropagation()}>
            <h2>Create new goal</h2>
            <form onSubmit={handleCreateGoal}>
              <div className="goal-form-group">
                <label>Goal title</label>
                <input 
                  type="text" 
                  autoFocus 
                  value={newGoalTitle} 
                  onChange={e => setNewGoalTitle(e.target.value)} 
                  placeholder="e.g. Increase Q3 Revenue by 15%"
                  required
                />
              </div>
              <div className="goal-form-group">
                <label>Goal level</label>
                <select value={newGoalLevel} onChange={e => setNewGoalLevel(e.target.value)}>
                  <option value="Company">Company</option>
                  <option value="Team">Team</option>
                </select>
              </div>
              <div className="goal-modal-actions">
                <button type="button" className="goal-btn-cancel" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="goal-btn-submit" disabled={!newGoalTitle.trim()}>Create Goal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

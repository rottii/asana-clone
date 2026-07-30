import React, { useState, useEffect } from 'react';
import UserAvatar from './UserAvatar';

export default function ProfileView({ user, projects, activeWorkspace, setActiveView, handleSelectProject, token }) {
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    if (token) {
      fetch('http://localhost:5001/api/goals', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setGoals(data))
      .catch(err => console.error('Failed to fetch goals:', err));
    }
  }, [token]);

  // Extract all tasks for the user
  const allTasks = [];
  (projects || []).forEach(p => {
    if (!p.isArchived) {
      p.sections?.forEach(s => {
        s.tasks?.forEach(t => {
          if (t.assigneeId === user?.id) {
            allTasks.push({ ...t, projectName: p.name });
          }
        });
      });
    }
  });

  const incompleteTasks = allTasks.filter(t => !t.isCompleted).slice(0, 5);

  // Extract recent projects
  const recentProjects = (projects || []).filter(p => !p.isArchived).slice(0, 3);

  // Extract frequent collaborators
  const collaborators = [];
  const seenIds = new Set([user?.id]); // Exclude self
  (activeWorkspace?.teams || []).forEach(team => {
    (team.members || []).forEach(member => {
      if (member.user && !seenIds.has(member.user.id)) {
        collaborators.push(member.user);
        seenIds.add(member.user.id);
      }
    });
  });

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
        <div style={{ position: 'relative', width: '120px', height: '120px' }}>
          <UserAvatar name={user?.name} size={120} />
          <div style={{ position: 'absolute', bottom: '0', right: '0', backgroundColor: 'white', borderRadius: '50%', padding: '4px', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px' }}>
            <span style={{ fontSize: '0.8rem' }}>📷</span>
          </div>
        </div>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {user?.name || 'User'}
          </h1>
          <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📅 Set out of office</span>
          </p>
          <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
            <span style={{ cursor: 'pointer' }}>+ Add job title</span>
            <span style={{ cursor: 'pointer' }}>+ Add team or dept.</span>
            <span style={{ cursor: 'pointer' }}>+ Add about me</span>
          </div>
          <button style={{ backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: '500' }}>
            Edit profile
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* LEFT COLUMN */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* MY TASKS WIDGET */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E5E7EB', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '600' }}>My tasks 🔒</h2>
              <button 
                onClick={() => { if(setActiveView) setActiveView('my-tasks'); }}
                style={{ padding: '4px 12px', border: '1px solid #D1D5DB', backgroundColor: 'white', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                View all tasks
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {incompleteTasks.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No tasks assigned to you.</div>
              ) : (
                incompleteTasks.map(task => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '1px solid #D1D5DB', marginRight: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'transparent' }}>✓</div>
                    <span style={{ flex: 1, fontSize: '0.9rem' }}>{task.title}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ backgroundColor: '#F3F4F6', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '8px', height: '8px', backgroundColor: '#9CA3AF', borderRadius: '2px' }}></div>
                        {task.projectName}
                      </span>
                      {task.dueDate && <span style={{ color: '#DC2626', fontSize: '0.85rem', width: '40px', textAlign: 'right' }}>{formatDate(task.dueDate)}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* MY RECENT PROJECTS WIDGET */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E5E7EB', padding: '20px' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: '600' }}>My recent projects</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentProjects.length === 0 ? (
                <div style={{ color: 'var(--text-tertiary)' }}>No recent projects.</div>
              ) : (
                recentProjects.map(project => (
                  <div
                    key={project.id}
                    onClick={() => {
                      if (handleSelectProject) handleSelectProject(project);
                      if (setActiveView) setActiveView('project');
                    }}
                    style={{ display: 'flex', alignItems: 'center', padding: '8px', cursor: 'pointer', borderRadius: '6px' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ width: '24px', height: '24px', borderRadius: '4px', backgroundColor: project.color || '#4F46E5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', fontSize: '0.8rem' }}>
                      {project.icon || '📋'}
                    </div>
                    <span style={{ flex: 1, fontSize: '0.95rem' }}>{project.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* COLLABORATORS WIDGET */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E5E7EB', padding: '20px' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: '600' }}>Frequent collaborators 🔒</h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', cursor: 'pointer' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px dashed #9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                +
              </div>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Invite teammates</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {collaborators.length === 0 ? (
                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No other members in this workspace.</div>
              ) : (
                collaborators.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <UserAvatar name={c.name || c.email} size={36} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{c.email}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* GOALS WIDGET */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E5E7EB', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '600' }}>My goals</h2>
              <button
                onClick={() => { if (setActiveView) setActiveView('goals'); }}
                style={{ backgroundColor: 'white', border: '1px solid #D1D5DB', color: 'var(--text-secondary)', padding: '4px 12px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '500', cursor: 'pointer' }}
              >
                Create goal
              </button>
            </div>

            <p style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: '500' }}>Use goals to achieve your most important objectives</p>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Connect work and goals to see progress and keep your team on track</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {goals.length === 0 ? (
                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No goals created yet.</div>
              ) : (
                goals.slice(0, 3).map(goal => {
                  const progress = goal.targetValue > 0 ? Math.round((goal.currentValue / goal.targetValue) * 100) : 0;
                  const statusColor = goal.status === 'On track' ? '#10B981' : goal.status === 'At risk' ? '#F59E0B' : goal.status === 'Off track' ? '#EF4444' : '#6B7280';
                  const trackColor = goal.status === 'On track' ? '#A7F3D0' : goal.status === 'At risk' ? '#FDE68A' : goal.status === 'Off track' ? '#FECACA' : '#F3F4F6';

                  return (
                    <div key={goal.id}>
                      <div style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: '8px' }}>{goal.title}</div>
                      <div style={{ height: '8px', backgroundColor: '#F3F4F6', borderRadius: '4px', width: '100%', marginBottom: '6px', position: 'relative' }}>
                        <div style={{ height: '8px', backgroundColor: trackColor, borderRadius: '4px', width: `${progress}%` }}></div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusColor }}></div>
                        {goal.status} ({progress}%)
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

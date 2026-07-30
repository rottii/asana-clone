import React from 'react';
import KanbanBoard from './KanbanBoard';

export default function MyTasks({ user, projects, token, setProjects }) {
  if (!user || !projects) return null;
  
  // Find the actual My Tasks project from the backend
  const myTasksProject = projects.find(p => p.status === 'MY_TASKS' && p.ownerId === user.id);

  if (!myTasksProject) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading My Tasks...
      </div>
    );
  }

  // Define activeViews if missing (since we didn't add it in the backend defaults earlier)
  if (!myTasksProject.activeViews) {
    myTasksProject.activeViews = [
      { id: 'list', type: 'List', name: 'List' },
      { id: 'board', type: 'Board', name: 'Board' },
      { id: 'calendar', type: 'Calendar', name: 'Calendar' },
      { id: 'files', type: 'Files', name: 'Files' }
    ];
  }

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <KanbanBoard 
        selectedProject={myTasksProject}
        setSelectedProject={(updatedProj) => {
          setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
        }}
        projects={projects}
        setProjects={setProjects}
        token={token}
        user={user}
        handleLogout={() => {}}
        isMyTasks={true}
      />
    </div>
  );
}

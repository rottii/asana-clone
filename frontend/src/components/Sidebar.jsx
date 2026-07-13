import { useState, useEffect } from 'react';
import './Sidebar.css';

export default function Sidebar({ 
  projects, 
  setProjects, 
  selectedProject, 
  handleSelectProject, 
  activeView, 
  setActiveView, 
  user, 
  token,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  portfolios,
  selectedPortfolio,
  setSelectedPortfolio
}) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [narrowTab, setNarrowTab] = useState('Work');
  
  const [collapsed, setCollapsed] = useState({
    projects: false,
    portfolios: false
  });

  useEffect(() => {
    if (token) {
      fetch('http://localhost:5001/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const unread = data.filter(n => !n.isRead).length;
          setUnreadCount(unread);
        }
      })
      .catch(err => console.error(err));
    }
  }, [token, activeView]); // Re-fetch when activeView changes (e.g. they visit inbox)

  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProjects = safeProjects.filter(p => !p.isArchived);

  const toggleSection = (section) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  async function handleCreateProject(e) {
    e.preventDefault();
    setActiveView('create_project');
  }

  function renderProjectItem(project) {
    const isActive = activeView === 'project' && selectedProject?.id === project.id;
    return (
      <li
        key={project.id}
        className={`sidebar-project-item ${isActive ? 'active' : ''}`}
        onClick={() => handleSelectProject(project)}
      >
        <div className="sidebar-project-icon-box" style={{ backgroundColor: '#2dd4bf', color: 'var(--text-primary)' }}>🚀</div>
        <span className="sidebar-project-name">{project.name}</span>
      </li>
    );
  }

  if (isSidebarCollapsed) {
    return null;
  }

  return (
    <aside className="sidebar-wrapper" style={{ width: '300px' }}>
      {/* NARROW LEFT PANE */}
      <div className="sidebar-narrow">
        <div className="sidebar-narrow-top">
          {/* Top section was moved to global top bar, but keeping narrow nav for spacing if needed or just remove hamburger here */}
          <div className="sidebar-narrow-nav" style={{ marginTop: '20px' }}>
            <div className={`sidebar-icon-item ${narrowTab === 'Work' ? 'active' : ''}`} onClick={() => setNarrowTab('Work')}>
              <span className="icon-wrapper">✓</span>
              <span className="icon-label">Work</span>
            </div>
            <div className={`sidebar-icon-item ${narrowTab === 'Strategy' ? 'active' : ''}`} onClick={() => setNarrowTab('Strategy')}>
              <span className="icon-wrapper">△</span>
              <span className="icon-label">Strategy</span>
            </div>
            <div className="sidebar-icon-item">
              <span className="icon-wrapper">⎎</span>
              <span className="icon-label">Workflow</span>
            </div>
            <div className="sidebar-icon-item">
              <span className="icon-wrapper">👥</span>
              <span className="icon-label">People</span>
            </div>
          </div>
        </div>

        <div className="sidebar-narrow-bottom">
          <div className="sidebar-user-avatar">
            {user?.name?.[0]?.toUpperCase() || 'A'}
          </div>
        </div>
      </div>

      {/* WIDE RIGHT PANE */}
      <div className="sidebar-wide">
        <div className="sidebar-wide-scrollable">
          {narrowTab === 'Work' && (
            <>
              <div className="sidebar-section-title-small" style={{ marginTop: '20px' }}>Work</div>
              
              <nav className="sidebar-nav">
                <button className={`sidebar-nav-item ${activeView === 'home' ? 'active' : ''}`} onClick={() => { handleSelectProject(null); setActiveView('home'); }}>
                  <span className="sidebar-nav-icon">🏠</span>
                  <span>Home</span>
                </button>
                <button className={`sidebar-nav-item ${activeView === 'inbox' ? 'active' : ''}`} onClick={() => { handleSelectProject(null); setActiveView('inbox'); }}>
                  <span className="sidebar-nav-icon">🔔</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>Inbox</span>
                  {unreadCount > 0 && (
                    <span style={{ backgroundColor: 'var(--accent-primary)', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                      {unreadCount}
                    </span>
                  )}
                </button>
              </nav>

              <div className="sidebar-divider" />

              <nav className="sidebar-nav">
                <button className={`sidebar-nav-item ${activeView === 'my-tasks' ? 'active' : ''}`} onClick={() => { handleSelectProject(null); setActiveView('my-tasks'); }}>
                  <span className="sidebar-nav-icon">✓</span>
                  <span>My tasks</span>
                </button>
                <button className={`sidebar-nav-item ${activeView === 'projects' ? 'active' : ''}`} onClick={() => { handleSelectProject(null); setActiveView('projects'); }}>
                  <span className="sidebar-nav-icon">📋</span>
                  <span>Projects</span>
                </button>
                <button className={`sidebar-nav-item ${activeView === 'portfolios' ? 'active' : ''}`} onClick={() => { handleSelectProject(null); setActiveView('portfolios'); }}>
                  <span className="sidebar-nav-icon">📁</span>
                  <span>Portfolios</span>
                </button>
              </nav>

              <div className="sidebar-section">
                <div className="sidebar-section-header">
                  <div className="sidebar-section-label-group" onClick={() => toggleSection('projects')}>
                    <span className="sidebar-section-arrow">{collapsed.projects ? '▶' : '▼'}</span>
                    <span className="sidebar-section-label">Work</span>
                  </div>
                  <button className="sidebar-add-btn" onClick={(e) => { e.stopPropagation(); setActiveView('create_project'); }}>+</button>
                </div>

                {!collapsed.projects && (
                  <ul className="sidebar-project-list">
                    {activeProjects.map(renderProjectItem)}
                    
                    {activeProjects.length === 0 && (
                      <li className="sidebar-project-item">
                        <div className="sidebar-project-icon-box" style={{ backgroundColor: '#2dd4bf', color: 'var(--text-primary)' }}>🚀</div>
                        <span className="sidebar-project-name">Asana implementation...</span>
                      </li>
                    )}

                    {(portfolios || []).map(portfolio => {
                      const isActive = activeView === 'portfolio_detail' && selectedPortfolio?.id === portfolio.id;
                      return (
                        <li 
                          key={portfolio.id} 
                          className={`sidebar-project-item ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            handleSelectProject(null);
                            setSelectedPortfolio(portfolio);
                            setActiveView('portfolio_detail');
                          }}
                        >
                          <div className="sidebar-project-icon-box" style={{ backgroundColor: 'transparent', color: 'var(--text-tertiary)' }}>📁</div>
                          <span className="sidebar-project-name">{portfolio.name}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}

          {narrowTab === 'Strategy' && (
            <>
              <div className="sidebar-section-title-small" style={{ marginTop: '20px' }}>Strategy</div>
              
              <nav className="sidebar-nav">
                <button className={`sidebar-nav-item ${activeView === 'goals' ? 'active' : ''}`} onClick={() => { handleSelectProject(null); setActiveView('goals'); }}>
                  <span className="sidebar-nav-icon">🎯</span>
                  <span>Goals</span>
                </button>
                <button className={`sidebar-nav-item ${activeView === 'reporting' ? 'active' : ''}`} onClick={() => { handleSelectProject(null); setActiveView('reporting'); }}>
                  <span className="sidebar-nav-icon">📊</span>
                  <span>Reporting</span>
                </button>
              </nav>
            </>
          )}
        </div>

        <div className="sidebar-wide-bottom">
          <button className="sidebar-invite-btn">
            <span className="invite-icon">✉</span> Invite teammates
          </button>
        </div>
      </div>
    </aside>
  );
}

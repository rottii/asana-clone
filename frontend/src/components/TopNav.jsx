import React, { useState, useEffect, useRef } from 'react';
import './TopNav.css';
import QuickAddTaskModal from './QuickAddTaskModal';

export default function TopNav({ 
  isSidebarCollapsed, 
  setIsSidebarCollapsed, 
  projects, 
  setProjects,
  selectedProject,
  setActiveView, 
  handleSelectProject, 
  token,
  user,
  handleLogout,
  isDarkMode,
  setIsDarkMode
}) {
  const [showOmniCreate, setShowOmniCreate] = useState(false);
  const [showQuickAddTask, setShowQuickAddTask] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ tasks: [], projects: [], users: [], portfolios: [], goals: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const createRef = useRef(null);
  const searchRef = useRef(null);
  const profileRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (createRef.current && !createRef.current.contains(e.target)) {
        setShowOmniCreate(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults({ tasks: [], projects: [], users: [], portfolios: [], goals: [] });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`http://localhost:5001/api/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
          setShowSearchDropdown(true);
        }
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery, token]);

  const handleSearchResultClick = (type, item) => {
    setShowSearchDropdown(false);
    setSearchQuery('');
    
    if (type === 'project') {
      const p = projects.find(proj => proj.id === item.id);
      if (p) {
        handleSelectProject(p);
        setActiveView('project');
      }
    } else if (type === 'task') {
      // If task, we can navigate to project
      if (item.section && item.section.project) {
        const p = projects.find(proj => proj.id === item.section.project.id);
        if (p) {
          handleSelectProject(p);
          setActiveView('project');
        }
      }
    } else if (type === 'portfolio') {
      setActiveView('portfolios');
    } else if (type === 'goal') {
      setActiveView('goals');
    }
  };

  const handleOmniAction = (action) => {
    setShowOmniCreate(false);
    if (action === 'task') {
      setShowQuickAddTask(true);
    } else if (action === 'project') {
      setActiveView('create_project');
    } else if (action === 'portfolio') {
      setActiveView('portfolios');
    } else if (action === 'goal') {
      setActiveView('goals');
    }
  };

  const hasSearchResults = 
    searchResults.tasks.length > 0 || 
    searchResults.projects.length > 0 || 
    searchResults.users.length > 0 || 
    searchResults.portfolios.length > 0 || 
    searchResults.goals.length > 0;

  const toggleDarkMode = () => {
    const newVal = !isDarkMode;
    setIsDarkMode(newVal);
    localStorage.setItem('darkMode', newVal.toString());
  };

  return (
    <>
      <div className="topnav-container">
        <div className="topnav-left">
          <button 
            className="topnav-hamburger" 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          >
            ≡
          </button>
          
          <div style={{ position: 'relative' }} ref={createRef}>
            <button className="topnav-create-btn" onClick={() => setShowOmniCreate(!showOmniCreate)}>
              <span className="create-icon">+</span> Create
            </button>
            {showOmniCreate && (
              <div className="omni-create-dropdown">
                <div className="omni-create-item" onClick={() => handleOmniAction('task')}>✅ Task</div>
                <div className="omni-create-item" onClick={() => handleOmniAction('project')}>📋 Project</div>
                <div className="omni-create-item" onClick={() => handleOmniAction('portfolio')}>📁 Portfolio</div>
                <div className="omni-create-item" onClick={() => handleOmniAction('goal')}>🎯 Goal</div>
              </div>
            )}
          </div>

        </div>
        
        <div className="topnav-center">
          <div className="topnav-search-bar" ref={searchRef} style={{ position: 'relative' }}>
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Search tasks, projects, people..." 
              className="topnav-search-input" 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim().length >= 2) setShowSearchDropdown(true);
              }}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) setShowSearchDropdown(true);
              }}
            />
            {isSearching && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', position: 'absolute', right: '16px' }}>Searching...</span>}
            
            {showSearchDropdown && hasSearchResults && (
              <div className="search-dropdown">
                {searchResults.projects.length > 0 && (
                  <div>
                    <div className="search-group-title">Projects</div>
                    {searchResults.projects.map(p => (
                      <div key={`p-${p.id}`} className="search-item" onClick={() => handleSearchResultClick('project', p)}>
                        📋 {p.name}
                      </div>
                    ))}
                  </div>
                )}
                
                {searchResults.tasks.length > 0 && (
                  <div>
                    <div className="search-group-title">Tasks</div>
                    {searchResults.tasks.map(t => (
                      <div key={`t-${t.id}`} className="search-item" onClick={() => handleSearchResultClick('task', t)}>
                        ✅ {t.title} <span className="search-item-meta">{t.section?.project?.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {searchResults.users.length > 0 && (
                  <div>
                    <div className="search-group-title">People</div>
                    {searchResults.users.map(u => (
                      <div key={`u-${u.id}`} className="search-item" onClick={() => handleSearchResultClick('user', u)}>
                        👤 {u.name} <span className="search-item-meta">{u.email}</span>
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.portfolios.length > 0 && (
                  <div>
                    <div className="search-group-title">Portfolios</div>
                    {searchResults.portfolios.map(p => (
                      <div key={`port-${p.id}`} className="search-item" onClick={() => handleSearchResultClick('portfolio', p)}>
                        📁 {p.name}
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.goals.length > 0 && (
                  <div>
                    <div className="search-group-title">Goals</div>
                    {searchResults.goals.map(g => (
                      <div key={`g-${g.id}`} className="search-item" onClick={() => handleSearchResultClick('goal', g)}>
                        🎯 {g.title} <span className="search-item-meta">{g.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="topnav-right" style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }} ref={profileRef}>
          <div 
            className="topnav-user-avatar" 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            style={{ 
              width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FBCFE8', color: '#BE185D', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem', 
              cursor: 'pointer', userSelect: 'none'
            }}
          >
            {user?.name?.charAt(0).toUpperCase() || '?'}
          </div>

          {showProfileMenu && (
            <div className="profile-dropdown">
              <div className="profile-header">
                <div style={{ fontWeight: '600', color: 'var(--text-primary-dark, #E8E8E8)' }}>{user?.name || 'User'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary-dark, var(--text-tertiary))' }}>{user?.email || 'email@example.com'}</div>
              </div>
              <div className="profile-divider"></div>
              <div className="profile-menu-item" onClick={toggleDarkMode}>
                <span>{isDarkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary-dark, var(--text-tertiary))' }}>{isDarkMode ? 'ON' : 'OFF'}</span>
              </div>
              <div className="profile-divider"></div>
              <div className="profile-menu-item profile-logout" onClick={() => { setShowProfileMenu(false); handleLogout(); }}>
                Sign out
              </div>
            </div>
          )}
        </div>
      </div>

      {showQuickAddTask && (
        <QuickAddTaskModal 
          projects={projects || []}
          token={token}
          onClose={() => setShowQuickAddTask(false)}
          onTaskCreated={(task) => {
            console.log("Quick added task:", task);
            if (task.section && task.section.projectId) {
              let updatedCurrentProject = null;
              
              const updatedProjects = projects.map(p => {
                if (p.id === task.section.projectId) {
                  const updatedSections = p.sections.map(s => {
                    if (s.id === task.sectionId) {
                      return { ...s, tasks: [...(s.tasks || []), task] };
                    }
                    return s;
                  });
                  const updatedProj = { ...p, sections: updatedSections };
                  if (selectedProject && selectedProject.id === p.id) {
                    updatedCurrentProject = updatedProj;
                  }
                  return updatedProj;
                }
                return p;
              });
              setProjects(updatedProjects);
              
              if (updatedCurrentProject) {
                handleSelectProject(updatedCurrentProject);
              }
            }
          }}
        />
      )}
    </>
  );
}

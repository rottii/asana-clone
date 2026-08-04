import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import KanbanBoard from './components/KanbanBoard'
import Sidebar from './components/Sidebar'
import MyTasks from './components/MyTasks'
import TopNav from './components/TopNav'
import BrowseProjects from './components/BrowseProjects'
import Portfolios from './components/Portfolios'
import PortfolioDetail from './components/PortfolioDetail'
import CreateProject from './components/CreateProject'
import Inbox from './components/Inbox'
import ProfileView from './components/ProfileView'
import Goals from './components/Goals'
import Reporting from './components/Reporting'
import PublicForm from './components/PublicForm'
import { UndoProvider } from './context/UndoContext'

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')))
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('darkMode') === 'true')
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [portfolios, setPortfolios] = useState([])
  const [selectedPortfolio, setSelectedPortfolio] = useState(null)
  const [portfolioCreationParent, setPortfolioCreationParent] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const storedWorkspaceId = localStorage.getItem('activeWorkspaceId');
  const initialWorkspaceId = (storedWorkspaceId === 'null' || storedWorkspaceId === 'undefined') ? null : storedWorkspaceId;
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(initialWorkspaceId)

  const [activeView, setActiveView] = useState(() => {
    const path = window.location.pathname;
    if (path.startsWith('/project/')) {
      localStorage.setItem('selectedProjectId', path.split('/')[2]);
      return 'project';
    }
    if (path.startsWith('/portfolio/')) {
      localStorage.setItem('selectedPortfolioId', path.split('/')[2]);
      return 'portfolio_detail';
    }
    if (path.length > 1) {
      const view = path.substring(1);
      // Validate view to prevent random paths from crashing the app
      const validViews = ['home', 'my-tasks', 'inbox', 'reporting', 'portfolios', 'goals', 'projects', 'profile', 'create_project'];
      if (validViews.includes(view)) return view;
    }
    return localStorage.getItem('activeView') || 'home';
  }) 
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const previousViewRef = useRef((() => {
    const stored = localStorage.getItem('activeView') || 'home'
    return stored === 'create_project' ? 'home' : stored
  })())

  // --- HTML5 History API Routing ---
  
  // URL to State Sync (Back/Forward Buttons)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/project/')) {
        const id = path.split('/')[2];
        const proj = projects.find(p => p.id === id);
        if (proj) {
          setSelectedProject(proj);
          setActiveView('project');
        }
      } else if (path.startsWith('/portfolio/')) {
        const id = path.split('/')[2];
        const port = portfolios.find(p => p.id === id);
        if (port) {
          setSelectedPortfolio(port);
          setActiveView('portfolio_detail');
        }
      } else {
        const view = path.length > 1 ? path.substring(1) : 'home';
        const validViews = ['home', 'my-tasks', 'inbox', 'reporting', 'portfolios', 'goals', 'projects', 'profile', 'create_project'];
        setActiveView(validViews.includes(view) ? view : 'home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [projects, portfolios]);

  // State to URL Sync
  useEffect(() => {
    let newPath = '/';
    if (activeView === 'project' && selectedProject) {
      newPath = `/project/${selectedProject.id}`;
    } else if (activeView === 'portfolio_detail' && selectedPortfolio) {
      newPath = `/portfolio/${selectedPortfolio.id}`;
    } else if (activeView !== 'home') {
      newPath = `/${activeView}`;
    }

    if (window.location.pathname !== newPath) {
      window.history.pushState({}, '', newPath);
    }
  }, [activeView, selectedProject, selectedPortfolio]);
  
  // ---------------------------------

  useEffect(() => {
    if (activeView !== 'create_project') {
      previousViewRef.current = activeView
    }
    localStorage.setItem('activeView', activeView)
  }, [activeView])

  useEffect(() => {
    if (activeWorkspaceId) {
      localStorage.setItem('activeWorkspaceId', activeWorkspaceId)
    }
  }, [activeWorkspaceId])

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark')
    } else {
      document.body.classList.remove('dark')
    }
  }, [isDarkMode])

  // Projeleri çek ve yenileme sonrası aktif projeyi geri yükle
  useEffect(() => {
    if (token) {
      // Projeleri çek (Bypass cache with timestamp)
      fetch(`http://localhost:5001/api/projects?t=${Date.now()}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            // Filter out tasks that belong to template projects from MY_TASKS
            const myTasksProject = data.find(p => p.status === 'MY_TASKS');
            if (myTasksProject) {
              myTasksProject.sections?.forEach(s => {
                if (s.tasks) {
                  s.tasks = s.tasks.filter(t => {
                    if (t.section?.project?.isTemplate) return false;
                    if (t.secondaryProjects?.some(sp => sp.project?.isTemplate)) return false;
                    return true;
                  });
                }
              });
            }

            setProjects(data)
            
            const savedProjectId = localStorage.getItem('selectedProjectId')
            if (savedProjectId) {
              const found = data.find(p => p.id === savedProjectId)
              if (found) {
                setSelectedProject(found)
                setActiveView('project')
              }
            }
          } else {
            console.error("Expected an array of projects, but got:", data)
            if (data.error && data.error.toLowerCase().includes("token")) {
              localStorage.removeItem('token')
              localStorage.removeItem('user')
              localStorage.removeItem('selectedProjectId')
              setToken(null)
              setUser(null)
              setSelectedProject(null)
              setActiveView('home')
            } else {
              setProjects([])
            }
          }
        })
        .catch(err => console.error("Projeler yüklenemedi", err))

      // Portföyleri çek
      fetch('http://localhost:5001/api/portfolios', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setPortfolios(data)
            const savedPortfolioId = localStorage.getItem('selectedPortfolioId')
            if (savedPortfolioId) {
              const found = data.find(p => p.id === savedPortfolioId)
              if (found) {
                setSelectedPortfolio(found)
                setActiveView('portfolio_detail')
              }
            }
          } else {
            setPortfolios([])
          }
        })
        .catch(err => console.error("Portföyler yüklenemedi", err))

      // Workspaces (Teams) çek
      fetch('http://localhost:5001/api/workspaces', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setWorkspaces(data)
            if (data.length > 0) {
              const currentIsValid = data.find(w => w.id === activeWorkspaceId);
              if (!currentIsValid || !activeWorkspaceId || activeWorkspaceId === 'null') {
                setActiveWorkspaceId(data[0].id)
              }
            }
          } else {
            setWorkspaces([])
          }
        })
        .catch(err => console.error("Workspaces yüklenemedi", err))
    }
  }, [token])

  useEffect(() => {
    if (user && user.id) {
      const socket = io('http://localhost:5001');
      socket.emit('join_user', user.id);
      
      socket.on('project_created', (newProj) => {
        setProjects(prev => {
          if (prev.find(p => p.id === newProj.id)) return prev;
          return [...prev, newProj];
        });
      });

      socket.on('project_shared', (sharedProj) => {
        setProjects(prev => {
          if (prev.find(p => p.id === sharedProj.id)) {
            return prev.map(p => p.id === sharedProj.id ? sharedProj : p);
          }
          return [...prev, sharedProj];
        });
      });
      
      return () => {
        socket.disconnect();
      }
    }
  }, [user]);

  const handleSelectProject = (project) => {
    if (project) {
      localStorage.setItem('selectedProjectId', project.id)
      setActiveView('project')
    } else {
      localStorage.removeItem('selectedProjectId')
      setActiveView('home')
    }
    setSelectedProject(project)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('selectedProjectId')
    setToken(null)
    setUser(null)
    setSelectedProject(null)
    setSelectedPortfolio(null)
    setActiveView('home')
  }

  const isPublicForm = window.location.pathname.startsWith('/form/');
  if (isPublicForm) {
    return <PublicForm />;
  }

  if (!token) {
    return <Auth setToken={setToken} setUser={setUser} />
  }

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

  // Filter projects by active workspace, but always include 'MY_TASKS' which is global
  // Actually, MY_TASKS will now have a workspaceId, so we just filter by workspaceId directly!
  const filteredProjects = projects.filter(p => p.workspaceId === activeWorkspace?.id);
  const filteredPortfolios = portfolios.filter(p => p.workspaceId === activeWorkspace?.id);

  return (
    <UndoProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopNav 
        isSidebarCollapsed={isSidebarCollapsed} 
        setIsSidebarCollapsed={setIsSidebarCollapsed} 
        projects={filteredProjects}
        setProjects={setProjects}
        selectedProject={selectedProject}
        setActiveView={setActiveView}
        handleSelectProject={handleSelectProject}
        token={token}
        user={user}
        handleLogout={handleLogout}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        setActiveWorkspaceId={setActiveWorkspaceId}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar 
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          projects={filteredProjects} 
          setProjects={setProjects}
          selectedProject={selectedProject}
          handleSelectProject={handleSelectProject}
          activeView={activeView}
          setActiveView={setActiveView}
          user={user}
          token={token}
          handleLogout={handleLogout}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          activeWorkspaceId={activeWorkspaceId}
          setActiveWorkspaceId={setActiveWorkspaceId}
          portfolios={filteredPortfolios}
          selectedPortfolio={selectedPortfolio}
          setSelectedPortfolio={setSelectedPortfolio}
        />
        <div style={{ flex: 1, overflow: 'auto', backgroundColor: 'var(--bg-secondary)', position: 'relative' }}>
          {activeView === 'home' ? (
            <Dashboard 
              user={user}
              projects={filteredProjects}
              setProjects={setProjects}
              setSelectedProject={handleSelectProject}
              portfolios={filteredPortfolios}
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              handleSelectProject={handleSelectProject}
              handleLogout={handleLogout}
              activeView={activeView}
              setActiveView={setActiveView}
              setSelectedPortfolio={setSelectedPortfolio}
              setWorkspaces={setWorkspaces}
              token={token}
            />
          ) : activeView === 'project' && selectedProject ? (
            <KanbanBoard 
              selectedProject={selectedProject} 
              setSelectedProject={handleSelectProject} 
              projects={filteredProjects} 
              setProjects={setProjects} 
              token={token} 
              user={user} 
              handleLogout={handleLogout} 
            />
          ) : activeView === 'my-tasks' ? (
            <MyTasks token={token} user={user} projects={filteredProjects} setProjects={setProjects} />
          ) : activeView === 'projects' ? (
            <BrowseProjects 
              projects={filteredProjects}
              setProjects={setProjects}
              setActiveView={setActiveView}
              handleSelectProject={handleSelectProject}
              token={token}
              user={user}
              activeWorkspaceId={activeWorkspaceId}
            />
          ) : activeView === 'portfolios' ? (
            <Portfolios 
              portfolios={filteredPortfolios}
              setPortfolios={setPortfolios}
              token={token}
              setActiveView={setActiveView}
              setSelectedPortfolio={setSelectedPortfolio}
              portfolioCreationParent={portfolioCreationParent}
              setPortfolioCreationParent={setPortfolioCreationParent}
              activeWorkspaceId={activeWorkspaceId}
            />
          ) : activeView === 'portfolio_detail' && selectedPortfolio ? (
            <PortfolioDetail
              portfolio={selectedPortfolio}
              setPortfolio={setSelectedPortfolio}
              portfolios={filteredPortfolios}
              setPortfolios={setPortfolios}
              projects={filteredProjects}
              setProjects={setProjects}
              token={token}
              user={user}
              setActiveView={setActiveView}
              setPortfolioCreationParent={setPortfolioCreationParent}
              handleSelectProject={handleSelectProject}
            />
          ) : activeView === 'inbox' ? (
            <Inbox token={token} user={user} />
          ) : activeView === 'profile' ? (
            <ProfileView user={user} projects={filteredProjects} activeWorkspace={activeWorkspace} setActiveView={setActiveView} handleSelectProject={handleSelectProject} token={token} />
          ) : activeView === 'goals' ? (
            <Goals token={token} user={user} setActiveView={setActiveView} />
          ) : activeView === 'reporting' ? (
            <Reporting token={token} />
          ) : activeView === 'create_project' ? (
            <CreateProject
              token={token}
              setProjects={setProjects}
              setPortfolios={setPortfolios}
              setActiveView={setActiveView}
              previousView={previousViewRef.current}
              setSelectedProject={setSelectedProject}
              portfolioCreationParent={portfolioCreationParent}
              setPortfolioCreationParent={setPortfolioCreationParent}
              activeWorkspace={activeWorkspace}
            />
          ) : (
            <Dashboard 
              user={user}
              projects={filteredProjects}
              setProjects={setProjects}
              setSelectedProject={handleSelectProject}
              portfolios={filteredPortfolios}
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              handleSelectProject={handleSelectProject}
              handleLogout={handleLogout}
              activeView={activeView}
              setActiveView={setActiveView}
              setSelectedPortfolio={setSelectedPortfolio}
              setWorkspaces={setWorkspaces}
              token={token}
            />
          )}
        </div>
      </div>
      </div>
    </UndoProvider>
  )
}
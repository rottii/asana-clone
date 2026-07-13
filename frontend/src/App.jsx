import { useState, useEffect } from 'react'
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
import Goals from './components/Goals'
import Reporting from './components/Reporting'
import PublicForm from './components/PublicForm'

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')))
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('darkMode') === 'true')
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [portfolios, setPortfolios] = useState([])
  const [selectedPortfolio, setSelectedPortfolio] = useState(null)
  const [portfolioCreationParent, setPortfolioCreationParent] = useState(null)

  const [activeView, setActiveView] = useState(() => localStorage.getItem('activeView') || 'home') // 'home', 'my-tasks', 'inbox', 'reporting', 'portfolios', 'goals', 'project', 'projects'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  useEffect(() => {
    localStorage.setItem('activeView', activeView)
  }, [activeView])

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
      // Projeleri çek
      fetch('http://localhost:5001/api/projects', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
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
          } else {
            setPortfolios([])
          }
        })
        .catch(err => console.error("Portföyler yüklenemedi", err))
    }
  }, [token])

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopNav 
        isSidebarCollapsed={isSidebarCollapsed} 
        setIsSidebarCollapsed={setIsSidebarCollapsed} 
        projects={projects}
        setProjects={setProjects}
        selectedProject={selectedProject}
        setActiveView={setActiveView}
        handleSelectProject={handleSelectProject}
        token={token}
        user={user}
        handleLogout={handleLogout}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar 
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          projects={projects} 
          setProjects={setProjects}
          selectedProject={selectedProject}
          handleSelectProject={handleSelectProject}
          activeView={activeView}
          setActiveView={setActiveView}
          user={user}
          token={token}
          portfolios={portfolios}
          selectedPortfolio={selectedPortfolio}
          setSelectedPortfolio={setSelectedPortfolio}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeView === 'project' && selectedProject ? (
            <KanbanBoard 
              selectedProject={selectedProject} 
              setSelectedProject={handleSelectProject} 
              projects={projects} 
              setProjects={setProjects} 
              token={token} 
              user={user} 
              handleLogout={handleLogout} 
            />
          ) : activeView === 'my-tasks' ? (
            <MyTasks 
              user={user} 
              projects={projects} 
              token={token} 
            />
          ) : activeView === 'projects' ? (
            <BrowseProjects 
              projects={projects} 
              user={user} 
              handleSelectProject={handleSelectProject} 
              setActiveView={setActiveView}
            />
          ) : activeView === 'portfolios' ? (
            <Portfolios 
              portfolios={portfolios}
              setPortfolios={setPortfolios}
              token={token}
              setActiveView={setActiveView}
              setSelectedPortfolio={setSelectedPortfolio}
              portfolioCreationParent={portfolioCreationParent}
              setPortfolioCreationParent={setPortfolioCreationParent}
            />
          ) : activeView === 'portfolio_detail' && selectedPortfolio ? (
            <PortfolioDetail
              portfolio={selectedPortfolio}
              setPortfolio={setSelectedPortfolio}
              portfolios={portfolios}
              setPortfolios={setPortfolios}
              projects={projects}
              setProjects={setProjects}
              token={token}
              user={user}
              setActiveView={setActiveView}
              setPortfolioCreationParent={setPortfolioCreationParent}
              handleSelectProject={handleSelectProject}
            />
          ) : activeView === 'inbox' ? (
            <Inbox token={token} user={user} />
          ) : activeView === 'goals' ? (
            <Goals token={token} user={user} setActiveView={setActiveView} />
          ) : activeView === 'reporting' ? (
            <Reporting token={token} />
          ) : activeView === 'create_project' ? (
            <CreateProject
              token={token}
              setProjects={setProjects}
              setActiveView={setActiveView}
              setSelectedProject={setSelectedProject}
              portfolioCreationParent={portfolioCreationParent}
              setPortfolioCreationParent={setPortfolioCreationParent}
            />
          ) : (
            <Dashboard 
              user={user} 
              projects={projects} 
              setProjects={setProjects} 
              setSelectedProject={handleSelectProject} 
              token={token} 
              handleLogout={handleLogout} 
              activeView={activeView}
              setActiveView={setActiveView}
            />
          )}
        </div>
      </div>
    </div>
  )
}
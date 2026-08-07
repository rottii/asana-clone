import React, { useState, useEffect } from 'react';
import IconColorPicker from './IconColorPicker';
import { apiFetch } from '../api';

export default function CreateProject({ token, setProjects, setPortfolios, setActiveView, previousView = 'home', setSelectedProject, portfolioCreationParent, setPortfolioCreationParent, activeWorkspace }) {
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState('new project');
  const [privacy, setPrivacy] = useState('My workspace');
  const [teamId, setTeamId] = useState('');
  const [color, setColor] = useState('#4F46E5');
  const [icon, setIcon] = useState('📋');
  const [showPicker, setShowPicker] = useState(false);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    if (activeWorkspace?.teams?.length > 0 && !teamId) {
      setTeamId(activeWorkspace.teams[0].id);
    }
  }, [activeWorkspace, teamId]);

  useEffect(() => {
    if (!token || !activeWorkspace) return;
    apiFetch(`/api/projects/templates?workspaceId=${activeWorkspace.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTemplates(data);
      })
      .catch(console.error);
  }, [token, activeWorkspace]);

  const handleUseTemplate = async (template) => {
    try {
      const finalName = (!projectName || projectName === 'new project') ? template.name.replace(' Template', '') : projectName;
      const response = await apiFetch(`/api/projects/${template.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          name: finalName, 
          isTemplate: false,
          workspaceId: activeWorkspace ? activeWorkspace.id : undefined,
          teamId: teamId || undefined
        })
      });
      const data = await response.json();
      if (response.ok) {
        if (setProjects) {
          setProjects(prev => [data, ...prev]);
        }
        setSelectedProject(data);
        if (setPortfolioCreationParent) setPortfolioCreationParent(null);
        setActiveView('project');
      } else {
        alert("Proje oluşturulamadı: " + data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  // Step 2 states
  const [views, setViews] = useState({
    Overview: true,
    List: true,
    Board: true,
    Timeline: true,
    Gantt: true,
    Calendar: true,
    Dashboard: true,
    Workload: true,
    Messages: false,
    Files: false
  });
  const [defaultView, setDefaultView] = useState('List');

  const toggleView = (viewName) => {
    if (viewName === 'Overview') return; // Maybe Overview is required, or let them toggle it
    setViews(prev => {
      const newState = { ...prev, [viewName]: !prev[viewName] };
      // If turning off the default view, change default view
      if (!newState[viewName] && defaultView === viewName) {
        const available = Object.keys(newState).find(k => newState[k] && k !== 'Overview');
        setDefaultView(available || 'Overview');
      }
      return newState;
    });
  };

  const handleCreate = () => {
    const activeViewsArray = Object.keys(views).filter(k => views[k]).map(k => {
      const id = crypto.randomUUID();
      return { id, name: k, type: k };
    });
    
    apiFetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: projectName,
        color,
        icon,
        workspaceId: activeWorkspace ? activeWorkspace.id : undefined,
        teamId: teamId || undefined,
        defaultView,
        activeViews: activeViewsArray
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.id) {
        setProjects(prev => [...prev, data]);
        setSelectedProject(data);
        
        // If it was created from inside a portfolio, link it
        if (portfolioCreationParent) {
          apiFetch(`/api/portfolios/${portfolioCreationParent}/projects`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ projectId: data.id })
          })
          .then(() => {
             if (setPortfolios) {
               setPortfolios(prev => prev.map(p => p.id === portfolioCreationParent ? { ...p, projectsCount: (p.projectsCount || 0) + 1 } : p));
             }
             if (setPortfolioCreationParent) setPortfolioCreationParent(null);
             setActiveView('project');
          })
          .catch(err => {
             console.error(err);
             setActiveView('project');
          });
        } else {
          setActiveView('project');
        }
      }
    })
    .catch(err => console.error(err));
  };

  return (
    <div style={styles.creationContainer}>
      <div style={styles.creationHeader}>
        <button style={styles.backBtn} onClick={() => {
          if (step === 2) setStep(1);
          else setActiveView(previousView);
        }}>←</button>
      </div>
      
      <div style={styles.creationContent}>
        {step === 1 ? (
          <>
            <h1 style={styles.creationTitle}>New project</h1>
            
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Project name</label>
              <input 
                style={styles.formInput} 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                autoFocus
              />
            </div>



            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Project icon & color</label>
              <div style={{ position: 'relative' }}>
                <div 
                  style={{
                    width: '36px', 
                    height: '36px', 
                    backgroundColor: color, 
                    borderRadius: '8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    cursor: 'pointer',
                    fontSize: '1.2rem'
                  }}
                  onClick={() => setShowPicker(!showPicker)}
                >
                  {icon}
                </div>
                {showPicker && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', zIndex: 1000 }}>
                    <IconColorPicker 
                      selectedColor={color}
                      setSelectedColor={setColor}
                      selectedIcon={icon}
                      setSelectedIcon={setIcon}
                      onClose={() => setShowPicker(false)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Project access</label>
              <select 
                style={styles.formSelect}
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value)}
              >
                <option>My workspace</option>
                <option>Private to project members</option>
              </select>
            </div>

            <button style={styles.continueBtn} onClick={() => setStep(2)}>Continue to set up views</button>

            {templates.length > 0 && (
              <>
                <div style={{ margin: '32px 0 16px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '12px' }}>Or start from a template</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                    {templates.map(template => (
                      <div 
                        key={template.id} 
                        onClick={() => handleUseTemplate(template)}
                        style={{
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '16px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'box-shadow 0.2s',
                          backgroundColor: 'var(--bg-primary)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                      >
                        <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: template.color || '#4F46E5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {template.icon || '📋'}
                        </div>
                        <div style={{ fontWeight: 500, fontSize: '14px' }}>{template.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Click to use this template</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <h1 style={styles.creationTitle}>What views do you want for this project?</h1>
            
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Default view</label>
              <select 
                style={styles.formSelect}
                value={defaultView}
                onChange={(e) => setDefaultView(e.target.value)}
              >
                {Object.keys(views).filter(k => views[k]).map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div style={styles.viewsList}>
              {Object.keys(views).map(view => (
                <div key={view} style={styles.viewRow}>
                  <label style={styles.viewLabel}>
                    <input 
                      type="checkbox" 
                      checked={views[view]} 
                      onChange={() => toggleView(view)} 
                      style={styles.checkbox}
                      disabled={view === 'Overview'}
                    />
                    {view}
                  </label>
                </div>
              ))}
            </div>

            <button style={styles.continueBtn} onClick={handleCreate}>Go to project</button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  creationContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--bg-primary)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    flex: 1,
    overflowY: 'auto'
  },
  creationHeader: {
    padding: '24px 32px'
  },
  backBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: 'var(--text-secondary)'
  },
  creationContent: {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '500px',
    margin: '0 auto',
    width: '100%',
    paddingBottom: '40px'
  },
  creationTitle: {
    fontSize: '32px',
    fontWeight: '400',
    color: 'var(--text-primary)',
    marginBottom: '32px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '24px'
  },
  formLabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginBottom: '8px'
  },
  formInput: {
    padding: '10px 12px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '4px',
    fontSize: '15px',
    color: 'var(--text-primary)',
    outline: 'none'
  },
  formSelect: {
    padding: '10px 12px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: '4px',
    fontSize: '15px',
    color: 'var(--text-primary)',
    outline: 'none'
  },
  continueBtn: {
    padding: '12px 16px',
    backgroundColor: '#4F46E5',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '15px',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '16px'
  },
  viewsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '16px',
    marginBottom: '16px'
  },
  viewRow: {
    display: 'flex',
    alignItems: 'center'
  },
  viewLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '15px',
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  checkbox: {
    marginRight: '12px',
    width: '18px',
    height: '18px'
  }
};

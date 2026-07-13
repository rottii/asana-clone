import React, { useState } from 'react';

export default function CreateProject({ token, setProjects, setActiveView, setSelectedProject, portfolioCreationParent, setPortfolioCreationParent }) {
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState('new project');
  const [privacy, setPrivacy] = useState('My workspace');
  
  // Step 2 states
  const [views, setViews] = useState({
    Overview: true,
    List: true,
    Board: true,
    Timeline: true,
    Calendar: true,
    Dashboard: true,
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
    let finalDefaultView = '';
    const activeViewsArray = Object.keys(views).filter(k => views[k]).map(k => {
      const id = crypto.randomUUID();
      if (k === defaultView) finalDefaultView = id;
      return { id, name: k, type: k };
    });
    
    fetch('http://localhost:5001/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: projectName,
        defaultView: finalDefaultView,
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
          fetch(`http://localhost:5001/api/portfolios/${portfolioCreationParent}/projects`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ projectId: data.id })
          })
          .then(() => {
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
          else setActiveView('home');
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
              />
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

            <button style={styles.continueBtn} onClick={() => setStep(2)}>Continue</button>
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
    border: '1px solid #D1D5DB',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '4px',
    fontSize: '15px',
    color: 'var(--text-primary)',
    outline: 'none'
  },
  formSelect: {
    padding: '10px 12px',
    border: '1px solid #D1D5DB',
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

import React, { useState, useEffect, useRef } from 'react';
import PortfolioTimelineView from './PortfolioTimelineView';

export default function PortfolioDetail({ portfolio, setPortfolio, portfolios, setPortfolios, projects, setProjects, token, user, setActiveView, setPortfolioCreationParent, handleSelectProject }) {
  const [activeTab, setActiveTab] = useState('List');
  const [showAddWork, setShowAddWork] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showPortfolioSettings, setShowPortfolioSettings] = useState(false);
  
  const createMenuRef = useRef(null);
  const settingsMenuRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target)) {
        setShowCreateMenu(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
        setShowPortfolioSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Refetch the detailed portfolio when mounted to get the projectsList (which includes tasks)
  const [details, setDetails] = useState(portfolio);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:5001/api/portfolios/${portfolio.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setDetails(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [portfolio.id, token]);

  const handleAddProject = (projectId) => {
    fetch(`http://localhost:5001/api/portfolios/${portfolio.id}/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ projectId })
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          // Add the returned project to details.projectsList
          setDetails(prev => ({
            ...prev,
            projectsCount: prev.projectsCount + 1,
            projectsList: [...prev.projectsList, data]
          }));
          setShowAddWork(false);
        } else {
          alert(data.error);
        }
      })
      .catch(err => console.error(err));
  };

  const handleAddPortfolio = (childPortfolioId) => {
    fetch(`http://localhost:5001/api/portfolios/${portfolio.id}/portfolios`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ childPortfolioId })
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setDetails(prev => ({
            ...prev,
            childPortfoliosList: [...(prev.childPortfoliosList || []), data]
          }));
          setShowAddWork(false);
        } else {
          alert(data.error);
        }
      })
      .catch(err => console.error(err));
  };

  const handleCreateNewProject = () => {
    if (setPortfolioCreationParent && setActiveView) {
      setPortfolioCreationParent(portfolio.id);
      setActiveView('create_project');
    }
  };

  const handleCreateNewPortfolio = () => {
    if (setPortfolioCreationParent && setActiveView) {
      setPortfolioCreationParent(portfolio.id);
      setActiveView('portfolios');
    }
  };

  const handleRenamePortfolio = () => {
    setShowPortfolioSettings(false);
    const newName = window.prompt("Enter new name for this portfolio:", details.name);
    if (!newName || newName.trim() === '' || newName === details.name) return;

    fetch(`http://localhost:5001/api/portfolios/${portfolio.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: newName.trim() })
    })
    .then(res => res.json())
    .then(data => {
      if (!data.error) {
        setDetails(prev => ({ ...prev, name: data.name }));
        setPortfolios(prev => prev.map(p => p.id === data.id ? { ...p, name: data.name } : p));
      } else {
        alert(data.error);
      }
    })
    .catch(err => console.error(err));
  };

  const handleDeletePortfolio = () => {
    setShowPortfolioSettings(false);
    if (window.confirm("Are you sure you want to delete this portfolio? This action cannot be undone.")) {
      fetch(`http://localhost:5001/api/portfolios/${portfolio.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setPortfolios(prev => prev.filter(p => p.id !== portfolio.id));
          if (setActiveView) setActiveView('home');
        } else {
          alert(data.error);
        }
      })
      .catch(err => console.error(err));
    }
  };

  const getStatusColor = (status) => {
    if (status === 'On track') return { bg: '#E0F2E9', color: '#10B981' };
    if (status === 'At risk') return { bg: '#FEF3C7', color: '#F59E0B' };
    if (status === 'Off track') return { bg: '#FEE2E2', color: '#EF4444' };
    return { bg: '#F3F4F6', color: 'var(--text-secondary)' };
  };

  const handleToggleStar = async () => {
    try {
      const response = await fetch(`http://localhost:5001/api/portfolios/${details.id}/star`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const { isStarred } = await response.json();
        const updatedPort = { ...details };
        if (isStarred) {
          updatedPort.starredBy = [...(updatedPort.starredBy || []), { userId: user.id }];
        } else {
          updatedPort.starredBy = (updatedPort.starredBy || []).filter(s => s.userId !== user.id);
        }
        setDetails(updatedPort);
        setPortfolio(updatedPort);
        if (setPortfolios) {
          setPortfolios(prev => prev.map(p => p.id === updatedPort.id ? updatedPort : p));
        }
      }
    } catch (err) {
      console.error('Error toggling star:', err);
    }
  };

  const statusStyle = getStatusColor(details.status);

  return (
    <div style={styles.container}>
      <div style={styles.headerArea}>
        <div style={styles.breadcrumbs}>Portfolios</div>
        <div style={styles.headerTop}>
          <div style={styles.titleRow}>
            <div style={styles.folderIconLarge}>📁</div>
            <h1 style={styles.pageTitle}>{details.name}</h1>
            <div style={{ position: 'relative' }} ref={settingsMenuRef}>
              <span 
                style={{ ...styles.chevron, cursor: 'pointer', padding: '4px' }}
                onClick={() => setShowPortfolioSettings(!showPortfolioSettings)}
              >
                ▼
              </span>
              {showPortfolioSettings && (
                <div style={{ ...styles.createDropdownMenu, top: '100%', left: 0, marginTop: '8px', zIndex: 50, width: '160px' }}>
                  <div style={styles.dropdownItem} onClick={handleRenamePortfolio}>
                    ✏️ Rename portfolio
                  </div>
                  <div style={{ ...styles.dropdownItem, color: '#EF4444' }} onClick={handleDeletePortfolio}>
                    🗑️ Delete portfolio
                  </div>
                </div>
              )}
            </div>
            <span 
              style={{
                ...styles.starIcon, 
                color: details?.starredBy?.some(s => s.userId === user.id) ? '#F59E0B' : 'var(--text-tertiary)',
                cursor: 'pointer'
              }}
              onClick={handleToggleStar}
            >
              {details?.starredBy?.some(s => s.userId === user.id) ? '★' : '☆'}
            </span>
            <div style={{ ...styles.statusPill, backgroundColor: statusStyle.bg, color: statusStyle.color }}>
              <span style={styles.statusDot}>●</span>
              {details.status}
            </div>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.memberBadge}>{details.owner?.name?.[0]?.toUpperCase() || 'U'}</div>
            <button style={styles.shareBtn}>
              <span style={{ marginRight: 4 }}>👥</span> Share
            </button>
            <button style={styles.customizeBtn}>
              <span style={{ marginRight: 4 }}>⚙</span> Customize
            </button>
          </div>
        </div>

        <div style={styles.tabsContainer}>
          {['List', 'Timeline', 'Dashboard', 'Progress', 'Workload', 'Messages', '+'].map(tab => (
            <div
              key={tab}
              style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </div>
          ))}
        </div>
      </div>

      <div style={styles.toolbar}>
        <div style={{ position: 'relative', display: 'inline-block' }} ref={createMenuRef}>
          <div style={{ display: 'flex' }}>
            <button style={styles.addWorkBtn} onClick={() => setShowCreateMenu(!showCreateMenu)}>
              + Add work <span style={{ ...styles.chevron, marginLeft: '4px' }}>▼</span>
            </button>
          </div>
          {showCreateMenu && (
            <div style={styles.createDropdownMenu}>
              <div style={styles.dropdownItem} onClick={() => { handleCreateNewProject(); setShowCreateMenu(false); }}>
                Create new project
              </div>
              <div style={styles.dropdownItem} onClick={() => { handleCreateNewPortfolio(); setShowCreateMenu(false); }}>
                Create new portfolio
              </div>
              <div style={styles.dropdownItem} onClick={() => { setShowAddWork(true); setShowCreateMenu(false); }}>
                Add existing work
              </div>
            </div>
          )}
        </div>

        <div style={styles.toolbarRight}>
          <div style={styles.actionItem}><span style={{ marginRight: 4 }}>≡</span> Filter</div>
          <div style={styles.actionItem}><span style={{ marginRight: 4 }}>⇅</span> Sort</div>
          <div style={styles.actionItem}><span style={{ marginRight: 4 }}>⊞</span> Group</div>
          <div style={styles.actionItem}><span style={{ marginRight: 4 }}>⚙</span> Options</div>
          <div style={styles.actionItem}>🔍</div>
        </div>
      </div>

      <div style={styles.contentArea}>
        {loading ? (
          <div style={{ padding: '20px' }}>Loading...</div>
        ) : activeTab === 'List' ? (
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <div style={{ ...styles.tableCell, flex: 3 }}>Name</div>
              <div style={{ ...styles.tableCell, flex: 2 }}>Status</div>
              <div style={{ ...styles.tableCell, flex: 2 }}>Task progress</div>
              <div style={{ ...styles.tableCell, flex: 1.5 }}>Due date</div>
              <div style={{ ...styles.tableCell, flex: 1.5 }}>Owner</div>
              <div style={{ ...styles.tableCell, width: '40px' }}>+</div>
            </div>

            <div style={styles.tableBody}>
              {showAddWork && (
                <div style={{ ...styles.tableRow, border: 'none', position: 'relative' }}>
                  <div style={{ ...styles.tableCell, flex: 3, padding: 0 }}>
                    <div style={styles.addWorkInputWrapper}>
                      <input
                        style={styles.addWorkInput}
                        placeholder="Add a project or portfolio by name"
                        autoFocus
                        onBlur={(e) => {
                          // Allow clicks on dropdown items to fire before hiding
                          setTimeout(() => {
                            // If they clicked an item, the add logic will fire.
                            // We can just leave it open for now or rely on the add logic to close it.
                          }, 200);
                        }}
                      />
                      <div style={styles.inlineDropdownMenu}>
                        {projects.filter(p => !details.projectsList?.find(pl => pl.id === p.id)).map(p => (
                          <div key={p.id} style={styles.dropdownItem} onClick={() => handleAddProject(p.id)}>
                            <span style={{ marginRight: 8 }}>📋</span> {p.name}
                          </div>
                        ))}
                        {portfolios.filter(p => p.id !== details.id && !details.childPortfoliosList?.find(pl => pl.id === p.id)).map(p => (
                          <div key={p.id} style={styles.dropdownItem} onClick={() => handleAddPortfolio(p.id)}>
                            <span style={{ marginRight: 8 }}>📁</span> {p.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ ...styles.tableCell, flex: 2 }}>
                    <div style={styles.skeletonPill}></div>
                  </div>
                  <div style={{ ...styles.tableCell, flex: 2 }}>
                    <div style={styles.skeletonLine}></div>
                  </div>
                  <div style={{ ...styles.tableCell, flex: 1.5 }}>
                    <div style={styles.skeletonPill}></div>
                  </div>
                  <div style={{ ...styles.tableCell, flex: 1.5 }}>
                    <div style={styles.skeletonCircle}></div>
                  </div>
                  <div style={{ ...styles.tableCell, width: '40px' }}></div>
                </div>
              )}
              {details.childPortfoliosList?.map(port => {
                const portStatusStyle = getStatusColor(port.status);

                return (
                  <div key={port.id} style={styles.tableRow}>
                    <div style={{ ...styles.tableCell, flex: 3 }}>
                      <div style={styles.projectNameWrapper}>
                        <div style={{ ...styles.projectIcon, fontSize: '16px', color: '#9CA3AF', marginRight: '12px' }}>📁</div>
                        <div style={styles.projectName}>{port.name}</div>
                      </div>
                    </div>

                    <div style={{ ...styles.tableCell, flex: 2 }}>
                      <div style={{ ...styles.statusPillSmall, backgroundColor: portStatusStyle.bg, color: portStatusStyle.color }}>
                        <span style={styles.statusDot}>●</span>
                        {port.status === 'NONE' ? 'No recent updates' : port.status}
                      </div>
                    </div>

                    <div style={{ ...styles.tableCell, flex: 2 }}>
                      <span style={{ color: '#9CA3AF', fontSize: '13px' }}>--</span>
                    </div>

                    <div style={{ ...styles.tableCell, flex: 1.5 }}>
                      <span style={styles.dueDateText}>{port.dueDate ? new Date(port.dueDate).toLocaleDateString() : ''}</span>
                    </div>

                    <div style={{ ...styles.tableCell, flex: 1.5 }}>
                      <div style={styles.ownerWrapper}>
                        <div style={styles.memberBadgeSmall}>{port.owner?.name?.[0]?.toUpperCase() || 'U'}</div>
                        <span style={styles.ownerName}>{port.owner?.name || 'Unknown'}</span>
                      </div>
                    </div>

                    <div style={{ ...styles.tableCell, width: '40px' }}></div>
                  </div>
                );
              })}
              {details.projectsList?.map(proj => {
                const projStatusStyle = getStatusColor(proj.status);

                return (
                  <div key={proj.id} style={styles.tableRow} onClick={() => { if (handleSelectProject) handleSelectProject(proj); }}>
                    <div style={{ ...styles.tableCell, flex: 3 }}>
                      <div style={styles.projectNameWrapper}>
                        <div style={{...styles.projectIcon, color: '#FFF', backgroundColor: proj.color || '#4F46E5', borderRadius: '4px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'}}>{proj.icon || '📋'}</div>
                        <div style={styles.projectName}>{proj.name}</div>
                      </div>
                    </div>

                    <div style={{ ...styles.tableCell, flex: 2 }}>
                      <div style={{ ...styles.statusPillSmall, backgroundColor: projStatusStyle.bg, color: projStatusStyle.color }}>
                        <span style={styles.statusDot}>●</span>
                        {proj.status === 'NONE' ? 'No recent updates' : proj.status}
                      </div>
                    </div>

                    <div style={{ ...styles.tableCell, flex: 2 }}>
                      <div style={styles.progressContainer}>
                        <div style={styles.progressBarBg}>
                          <div style={{ ...styles.progressBarFill, width: `${proj.taskProgress}%` }}></div>
                        </div>
                        <div style={styles.progressText}>{proj.taskProgress}%</div>
                      </div>
                    </div>

                    <div style={{ ...styles.tableCell, flex: 1.5 }}>
                      <span style={styles.dueDateText}>{proj.dueDate ? new Date(proj.dueDate).toLocaleDateString() : ''}</span>
                    </div>

                    <div style={{ ...styles.tableCell, flex: 1.5 }}>
                      <div style={styles.ownerWrapper}>
                        <div style={styles.memberBadgeSmall}>{proj.owner?.name?.[0]?.toUpperCase() || 'U'}</div>
                        <span style={styles.ownerName}>{proj.owner?.name || 'Unknown'}</span>
                      </div>
                    </div>

                    <div style={{ ...styles.tableCell, width: '40px' }}></div>
                  </div>
                );
              })}

              {(!details.projectsList?.length && !details.childPortfoliosList?.length) && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                  No projects or portfolios in this portfolio yet. Click "+ Add work" to get started.
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'Timeline' ? (
          <PortfolioTimelineView projectsList={details.projectsList} token={token} setDetails={setDetails} user={user} />
        ) : (
          <div style={{ padding: '20px' }}>{activeTab} view coming soon...</div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  },
  headerArea: {
    padding: '24px 32px 0 32px',
    borderBottom: '1px solid #E5E7EB'
  },
  breadcrumbs: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginBottom: '8px'
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  folderIconLarge: {
    fontSize: '32px',
    color: '#9CA3AF'
  },
  pageTitle: {
    fontSize: '28px',
    fontWeight: '500',
    margin: 0,
    color: 'var(--text-primary)'
  },
  chevron: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    cursor: 'pointer'
  },
  starIcon: {
    fontSize: '20px',
    color: '#9CA3AF',
    cursor: 'pointer'
  },
  statusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    borderRadius: '16px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  statusDot: {
    fontSize: '10px'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  memberBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#F9A8D4',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
    border: '2px solid #FFF'
  },
  shareBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 16px',
    backgroundColor: '#4F46E5', // Asana blue
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  customizeBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  tabsContainer: {
    display: 'flex',
    gap: '24px',
  },
  tab: {
    paddingBottom: '12px',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
  },
  activeTab: {
    color: 'var(--text-primary)',
    fontWeight: '500',
    borderBottom: '2px solid var(--text-primary)'
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 32px',
    borderBottom: '1px solid #E5E7EB',
    backgroundColor: 'var(--bg-primary)'
  },
  addWorkBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid #D1D5DB',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    cursor: 'pointer'
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  actionItem: {
    display: 'flex',
    alignItems: 'center',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    cursor: 'pointer'
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '4px',
    width: '250px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    zIndex: 10
  },
  dropdownHeader: {
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    borderBottom: '1px solid #E5E7EB'
  },
  dropdownList: {
    maxHeight: '200px',
    overflowY: 'auto'
  },
  dropdownItem: {
    padding: '10px 16px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  contentArea: {
    flex: 1,
    overflowY: 'auto'
  },
  table: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column'
  },
  tableHeader: {
    display: 'flex',
    padding: '12px 32px',
    borderBottom: '1px solid #E5E7EB'
  },
  tableCell: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center'
  },
  tableBody: {
    display: 'flex',
    flexDirection: 'column'
  },
  tableRow: {
    display: 'flex',
    padding: '12px 32px',
    borderBottom: '1px solid #F3F4F6',
    cursor: 'pointer'
  },
  projectNameWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  projectIcon: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    backgroundColor: '#EEF2FF',
    color: '#4F46E5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px'
  },
  projectName: {
    fontSize: '13px',
    color: 'var(--text-primary)'
  },
  statusPillSmall: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: '500'
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%'
  },
  progressBarBg: {
    flex: 1,
    height: '6px',
    backgroundColor: '#E5E7EB',
    borderRadius: '3px',
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981', // Green
    borderRadius: '3px'
  },
  progressText: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    width: '32px'
  },
  dueDateText: {
    fontSize: '13px',
    color: 'var(--text-secondary)'
  },
  ownerWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  memberBadgeSmall: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#F9A8D4',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 'bold'
  },
  ownerName: {
    fontSize: '13px',
    color: 'var(--text-primary)'
  },
  addWorkInputWrapper: {
    position: 'relative',
    width: '100%',
    padding: '6px 32px'
  },
  addWorkInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #4F46E5', // blue border as in screenshot
    outline: 'none',
    fontSize: '13px',
    borderRadius: '4px',
    color: 'var(--text-primary)'
  },
  inlineDropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: '32px',
    width: 'calc(100% - 64px)',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid #E5E7EB',
    borderTop: 'none',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    zIndex: 10,
    maxHeight: '250px',
    overflowY: 'auto'
  },
  dropdownItemBlue: {
    padding: '10px 16px',
    fontSize: '13px',
    color: '#4F46E5', // Blue text for create actions
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  createDropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: '0',
    marginTop: '4px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid #E5E7EB',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    zIndex: 20,
    minWidth: '200px'
  },
  skeletonPill: {
    width: '80px',
    height: '24px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '12px'
  },
  skeletonLine: {
    width: '100px',
    height: '6px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '3px'
  },
  skeletonCircle: {
    width: '24px',
    height: '24px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '50%'
  }
};

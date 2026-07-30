import React, { useState, useEffect } from 'react';
import './BrowseProjects.css';
import UserAvatar from './UserAvatar';

export default function BrowseProjects({ projects, user, handleSelectProject, setActiveView, token, setProjects, activeWorkspaceId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    if (!token || !activeWorkspaceId) return;
    fetch(`http://localhost:5001/api/projects/templates?workspaceId=${activeWorkspaceId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTemplates(data);
        else setTemplates([]);
      })
      .catch(console.error);
  }, [token, activeWorkspaceId]);

  const handleUseTemplate = async (template) => {
    const newName = window.prompt("Yeni proje adını girin:", template.name.replace(' Template', ''));
    if (!newName) return;
    try {
      const response = await fetch(`http://localhost:5001/api/projects/${template.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newName, isTemplate: false })
      });
      const data = await response.json();
      if (response.ok) {
        if (setProjects) {
          setProjects(prev => [data, ...prev]);
        }
        handleSelectProject(data);
      } else {
        alert("Proje oluşturulamadı: " + data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [activeOwner, setActiveOwner] = useState(null);
  const [activeMember, setActiveMember] = useState(null);
  const [activeStatus, setActiveStatus] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showTemplates, setShowTemplates] = useState(true);

  const safeProjects = Array.isArray(projects) ? projects : [];
  
  // Extract unique values for filters
  const uniqueOwners = [...new Set(safeProjects.map(p => p.owner?.name).filter(Boolean))];
  const uniqueMembers = [...new Set(safeProjects.flatMap(p => p.members?.map(m => m.user?.name)).filter(Boolean))];
  const uniqueStatuses = ['ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'ON_HOLD', 'NONE'];
  const statusLabels = { ON_TRACK: 'On track', AT_RISK: 'At risk', OFF_TRACK: 'Off track', ON_HOLD: 'On hold', NONE: 'No status' };

  const filteredProjects = safeProjects.filter(p => {
    if (p.status === 'MY_TASKS') return false;
    if (p.isTemplate) return false;
    if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (activeOwner && p.owner?.name !== activeOwner) return false;
    if (activeMember && !p.members?.some(m => m.user?.name === activeMember)) return false;
    if (activeStatus && p.status !== activeStatus && !(activeStatus === 'NONE' && !p.status)) return false;
    return true;
  });

  return (
    <div className="browse-projects-container">
      <div className="browse-projects-header">
        <h1>Browse projects</h1>
        <button className="bp-create-btn" onClick={() => { if (setActiveView) setActiveView('create_project') }}>+ Create project</button>
      </div>

      <div className="bp-search-container">
        <span className="bp-search-icon">🔍</span>
        <input 
          type="text" 
          placeholder="Find a project" 
          className="bp-search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bp-filters" style={{ position: 'relative' }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button className={`bp-filter-chip ${activeOwner ? 'active-filter' : ''}`} onClick={() => setOpenDropdown(openDropdown === 'owner' ? null : 'owner')}>
            Owner: {activeOwner || 'Any'} <span>⌄</span>
          </button>
          {openDropdown === 'owner' && (
            <div className="bp-filter-dropdown" style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', zIndex: 10, minWidth: '150px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
              <div style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee' }} onClick={() => { setActiveOwner(null); setOpenDropdown(null); }}>Any</div>
              {uniqueOwners.map(o => (
                <div key={o} style={{ padding: '8px', cursor: 'pointer' }} onClick={() => { setActiveOwner(o); setOpenDropdown(null); }}>{o}</div>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button className={`bp-filter-chip ${activeMember ? 'active-filter' : ''}`} onClick={() => setOpenDropdown(openDropdown === 'member' ? null : 'member')}>
            Member: {activeMember || 'Any'} <span>⌄</span>
          </button>
          {openDropdown === 'member' && (
            <div className="bp-filter-dropdown" style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', zIndex: 10, minWidth: '150px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
              <div style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee' }} onClick={() => { setActiveMember(null); setOpenDropdown(null); }}>Any</div>
              {uniqueMembers.map(m => (
                <div key={m} style={{ padding: '8px', cursor: 'pointer' }} onClick={() => { setActiveMember(m); setOpenDropdown(null); }}>{m}</div>
              ))}
            </div>
          )}
        </div>

        <button className="bp-filter-chip">Portfolios <span>⌄</span></button>

        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button className={`bp-filter-chip ${activeStatus ? 'active-filter' : ''}`} onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}>
            Status: {activeStatus ? statusLabels[activeStatus] : 'Any'} <span>⌄</span>
          </button>
          {openDropdown === 'status' && (
            <div className="bp-filter-dropdown" style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', zIndex: 10, minWidth: '150px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
              <div style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee' }} onClick={() => { setActiveStatus(null); setOpenDropdown(null); }}>Any</div>
              {uniqueStatuses.map(s => (
                <div key={s} style={{ padding: '8px', cursor: 'pointer' }} onClick={() => { setActiveStatus(s); setOpenDropdown(null); }}>{statusLabels[s]}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bp-table">
        <div className="bp-table-header">
          <div className="bp-col-name">Name</div>
          <div className="bp-col-members">Members</div>
          <div className="bp-col-portfolios">Portfolios</div>
          <div className="bp-col-lastmod">⇅ Last modified</div>
        </div>

        <div className="bp-table-body">
          {filteredProjects.map((project, index) => (
            <div 
              key={project.id} 
              className="bp-table-row"
              onClick={() => handleSelectProject(project)}
            >
              <div className="bp-col-name bp-flex-name">
                <div className="bp-project-icon" style={{ backgroundColor: project.color || '#4F46E5', color: '#FFF' }}>
                  {project.icon || '📋'}
                </div>
                <div className="bp-project-info">
                  <div className="bp-project-title">{project.name}</div>
                  <div className="bp-project-status">Joined</div>
                </div>
              </div>
              <div className="bp-col-members">
                {(() => {
                  const allUsers = [];
                  if (project.owner && !allUsers.find(u => u.id === project.owner.id)) {
                    allUsers.push(project.owner);
                  }
                  if (project.members) {
                    project.members.forEach(m => {
                      if (m.user && !allUsers.find(u => u.id === m.user.id)) {
                        allUsers.push(m.user);
                      }
                    });
                  }
                  if (allUsers.length === 0) return null;
                  
                  return (
                    <>
                      {allUsers.slice(0, 3).map((u, i) => (
                        <div key={i} title={u.name} style={{ display: 'inline-flex', marginRight: '-6px' }}>
                          <UserAvatar name={u.name} size={24} style={{ border: '2px solid var(--bg-primary)' }} />
                        </div>
                      ))}
                      {allUsers.length > 3 && (
                        <div className="bp-member-more">+{allUsers.length - 3}</div>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="bp-col-portfolios">
                {project.portfolios && project.portfolios.length > 0 ? (
                  project.portfolios
                    .filter(pItem => pItem.portfolio?.ownerId === (user?.userId || user?.id) || pItem.portfolio?.privacy === 'Public to My workspace')
                    .map(pItem => (
                      <span key={pItem.portfolio?.id} className="bp-portfolio-pill">📁 {pItem.portfolio?.name}</span>
                    ))
                ) : ''}
              </div>
              <div className="bp-col-lastmod bp-text-muted">
                {project.updatedAt 
                  ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(project.updatedAt)) 
                  : 'N/A'}
              </div>
            </div>
          ))}
          {filteredProjects.length === 0 && (
            <div className="bp-empty-state">No projects found.</div>
          )}
        </div>
      </div>

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import './BrowseProjects.css';

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
                {project.members && project.members.length > 0 ? (
                  <>
                    {project.members.slice(0, 3).map((m, i) => (
                      <div key={i} className="bp-member-avatar" title={m.user?.name}>
                        {m.user?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    ))}
                    {project.members.length > 3 && (
                      <div className="bp-member-more">+{project.members.length - 3}</div>
                    )}
                  </>
                ) : (
                  <div className="bp-member-avatar" title={project.owner?.name || 'Owner'}>
                    {project.owner?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="bp-col-portfolios">
                {project.portfolios && project.portfolios.length > 0 ? (
                  project.portfolios.map(pItem => (
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

      {showTemplates && (
        <div className="bp-templates-section">
          <div className="bp-templates-header">
            <h2>Explore ready-made templates to jumpstart your next project</h2>
            <button className="bp-close-templates" onClick={() => setShowTemplates(false)}>✕</button>
          </div>
          
          <div className="bp-templates-grid">
            {templates.map(template => (
              <div key={template.id} className="bp-template-card" onClick={() => handleUseTemplate(template)} style={{ cursor: 'pointer' }}>
                <div className="bp-template-icon" style={{ backgroundColor: template.color || '#4F46E5', color: '#fff' }}>
                  <span>{template.icon || '📋'}</span>
                </div>
                <h3>{template.name}</h3>
                <p>{template.description || "Start your project efficiently using this pre-made template."}</p>
              </div>
            ))}
            {templates.length === 0 && (
              <div className="bp-empty-state" style={{ gridColumn: '1 / -1', padding: '2rem' }}>No templates available. Save a project as a template to see it here!</div>
            )}
          </div>

          <div className="bp-templates-footer">
            <button className="bp-gallery-btn">View the template gallery</button>
          </div>
        </div>
      )}
    </div>
  );
}

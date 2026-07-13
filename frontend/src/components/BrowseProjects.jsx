import React, { useState } from 'react';
import './BrowseProjects.css';

export default function BrowseProjects({ projects, user, handleSelectProject, setActiveView }) {
  const [searchTerm, setSearchTerm] = useState('');

  const safeProjects = Array.isArray(projects) ? projects : [];
  const filteredProjects = safeProjects.filter(p => 
    !p.isArchived && p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      <div className="bp-filters">
        <button className="bp-filter-chip">Owner <span>⌄</span></button>
        <button className="bp-filter-chip">Members <span>⌄</span></button>
        <button className="bp-filter-chip">Portfolios <span>⌄</span></button>
        <button className="bp-filter-chip">Status <span>⌄</span></button>
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
                <div className="bp-member-avatar">
                  {user?.name?.[0]?.toUpperCase() || 'A'}k
                </div>
                <div className="bp-member-more">...</div>
              </div>
              <div className="bp-col-portfolios">
                {/* Dummy portfolio for visual match */}
                {index === 1 ? <span className="bp-portfolio-pill">📁 My first portfolio</span> : ''}
              </div>
              <div className="bp-col-lastmod bp-text-muted">
                Today
              </div>
            </div>
          ))}
          {filteredProjects.length === 0 && (
            <div className="bp-empty-state">No projects found.</div>
          )}
        </div>
      </div>

      <div className="bp-templates-section">
        <div className="bp-templates-header">
          <h2>Explore ready-made templates to jumpstart your next project</h2>
          <button className="bp-close-templates">✕</button>
        </div>
        
        <div className="bp-templates-grid">
          <div className="bp-template-card">
            <div className="bp-template-icon bg-green">
              <span>✓</span>
            </div>
            <h3>Engineering project plan</h3>
            <p>Break down work into tasks with due dates, organized by priority and stage to keep your team aligned.</p>
          </div>
          
          <div className="bp-template-card">
            <div className="bp-template-icon bg-purple">
              <span>📋</span>
            </div>
            <h3>Kanban board</h3>
            <p>Track responsibility and progress of critical work in boards to hit your deadlines.</p>
          </div>
          
          <div className="bp-template-card">
            <div className="bp-template-icon bg-teal">
              <span>🎫</span>
            </div>
            <h3>Ticketing</h3>
            <p>Collect, prioritize, and resolve tickets to keep your service goals on track.</p>
          </div>
        </div>

        <div className="bp-templates-footer">
          <button className="bp-gallery-btn">View the template gallery</button>
        </div>
      </div>
    </div>
  );
}

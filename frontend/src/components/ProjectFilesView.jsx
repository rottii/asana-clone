import React, { useState, useEffect } from 'react';
import { apiFetch, assetUrl } from '../api';

export default function ProjectFilesView({ selectedProject, token, onTaskUpdate }) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e) => {
      if (e.target.closest('.attachment-more-menu')) return;
      setOpenMenuId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  const handleDeleteAttachment = async (e, att) => {
    e.stopPropagation();
    if (isDeleting) return;
    if (!window.confirm(`Are you sure you want to delete ${att.originalName}?`)) return;

    setIsDeleting(true);
    setOpenMenuId(null);
    try {
      const response = await apiFetch(`/api/projects/attachments/${att.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        if (onTaskUpdate && att.task) {
          const updatedAttachments = (att.task.attachments || []).filter(a => a.id !== att.id);
          const updatedTask = {
            ...att.task,
            attachments: updatedAttachments
          };
          onTaskUpdate(att.task.id, updatedTask);
        }
      } else {
        alert("Failed to delete attachment.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while deleting the attachment.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = (e, att) => {
    e.stopPropagation();
    setOpenMenuId(null);
    const link = document.createElement('a');
    link.href = assetUrl(`/uploads/${att.filename}`);
    link.download = att.originalName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Collect all attachments from all tasks
  const allAttachments = [];
  selectedProject?.sections?.forEach(section => {
    section.tasks?.forEach(task => {
      if (task.attachments && task.attachments.length > 0) {
        task.attachments.forEach(att => {
          allAttachments.push({
            ...att,
            task: task,
          });
        });
      }
    });
  });

  // Sort by newest first
  allAttachments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', padding: '2rem', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

      {allAttachments.length === 0 ? (
        <div style={{
          flex: 1,
          border: '1px dashed var(--border-color)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontWeight: '500' }}>No files attached yet</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Upload files to share them with your team.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          {allAttachments.map((att) => (
            <div
              key={att.id}
              onClick={() => window.open(assetUrl(`/uploads/${att.filename}`), '_blank')}
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                transition: 'box-shadow 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; setHoveredCardId(att.id); }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; setHoveredCardId(null); }}
            >
              {/* Header section with icon, filename and task details */}
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid var(--border-color)', position: 'relative', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#F3F4F6',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  color: 'var(--text-secondary)',
                  flexShrink: 0
                }}>
                  {att.mimeType?.startsWith('image/') ? '🖼️' : '📄'}
                </div>
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginBottom: '2px'
                  }}>
                    {att.originalName}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {att.task?.title} • {att.uploader?.name}
                  </div>
                </div>

                {/* 3-dot Menu */}
                <div className="attachment-more-menu" style={{ position: 'relative', opacity: (hoveredCardId === att.id || openMenuId === att.id) ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: (hoveredCardId === att.id || openMenuId === att.id) ? 'auto' : 'none' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === att.id ? null : att.id); }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      fontSize: '1.2rem',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.2s'
                    }}
                    title="More actions"
                  >
                    ⋯
                  </button>
                  {openMenuId === att.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        top: '0',
                        left: '100%',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        zIndex: 100,
                        minWidth: '150px',
                        padding: '4px 0',
                        marginLeft: '4px'
                      }}
                    >
                      <button
                        onClick={(e) => handleDownload(e, att)}
                        style={{
                          width: '100%',
                          padding: '8px 16px',
                          background: 'transparent',
                          border: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        Download
                      </button>
                      <button
                        onClick={(e) => handleDeleteAttachment(e, att)}
                        disabled={isDeleting}
                        style={{
                          width: '100%',
                          padding: '8px 16px',
                          background: 'transparent',
                          border: 'none',
                          textAlign: 'left',
                          cursor: isDeleting ? 'not-allowed' : 'pointer',
                          color: 'var(--accent-danger)',
                          fontSize: '0.85rem',
                          opacity: isDeleting ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => !isDeleting && (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)')}
                        onMouseLeave={(e) => !isDeleting && (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        Delete attachment
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Section */}
              <div style={{
                height: '200px',
                backgroundColor: '#F9FAFB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                borderBottomLeftRadius: '8px',
                borderBottomRightRadius: '8px'
              }}>
                {att.mimeType?.startsWith('image/') ? (
                  <img
                    src={assetUrl(`/uploads/${att.filename}`)}
                    alt={att.originalName}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  style={{
                    display: att.mimeType?.startsWith('image/') ? 'none' : 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-tertiary)'
                  }}
                >
                  <span style={{ fontSize: '3rem', marginBottom: '8px' }}>📄</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: '500' }}>No Preview Available</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

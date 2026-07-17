                    <div
                      key={task.id}
                      onClick={() => setLastInteractedSectionId(sectionId)}
                      data-task-id={task.id}
                      style={{
                        ...styles.taskDataTableRow,
                        position: 'relative',
                        zIndex: openApprovalMenuTaskId === task.id ? 9999 : 0,
                        backgroundColor: lastInteractedSectionId === sectionId ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                        opacity: draggingTaskId === task.id ? 0.4 : 1,
                        borderLeft: lastInteractedSectionId === sectionId ? '3px solid #4F46E5' : '3px solid transparent'
                      }}
                      onContextMenu={(e) => { e.preventDefault(); onTaskContextMenu(e, task.id); }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggingTaskId && draggingTaskId !== task.id && !isVirtualGrouping) {
                          if (handleLiveTaskSwap) handleLiveTaskSwap(draggingTaskId, task.id);
                        }
                      }}
                      onDrop={(e) => { if (!isVirtualGrouping) handleGeneralDrop(e, sectionId, task.id); }}
                    >
                      <div
                        draggable={!isReadOnly && !isVirtualGrouping}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDraggingTaskId(task.id);
                          e.dataTransfer.setData('drag-type', 'task');
                          e.dataTransfer.setData('task-id', task.id);

                          const ghostEl = document.getElementById('asana-drag-ghost-preview-card');
                          if (ghostEl) {
                            ghostEl.textContent = task.title;
                            e.dataTransfer.setDragImage(ghostEl, 20, 15);
                          }
                        }}
                        onDragEnd={() => setDraggingTaskId(null)}
                        style={styles.drag6DotHandleCellTask}
                      >
                        ⋮⋮
                      </div>

                      {/* Hücre 1: Checkbox & Başlık */}
                      <div
                        style={{ ...styles.gridBodyCell, width: colWidths.name, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '1rem', cursor: 'pointer', overflow: openApprovalMenuTaskId === task.id ? 'visible' : 'hidden', position: openApprovalMenuTaskId === task.id ? 'relative' : 'static', zIndex: openApprovalMenuTaskId === task.id ? 9999 : 'auto' }}
                        onClick={() => {
                          if (onOpenTaskPane) onOpenTaskPane(task.id);
                        }}
                      >
                        {task.type === 'APPROVAL' ? (
                          <div style={{ position: 'relative', zIndex: openApprovalMenuTaskId === task.id ? 9999 : 'auto' }}>
                            <div
                              style={{
                                width: '18px', height: '18px', borderRadius: '4px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: isReadOnly ? 'default' : 'pointer', flexShrink: 0,
                                backgroundColor: task.approvalStatus === 'APPROVED' ? 'var(--accent-success)' : task.approvalStatus === 'REJECTED' ? 'var(--accent-danger)' : task.approvalStatus === 'CHANGES_REQUESTED' ? '#F59E0B' : 'transparent',
                                border: task.approvalStatus === 'PENDING' || !task.approvalStatus ? '1px dashed var(--text-tertiary)' : 'none',
                                color: task.approvalStatus === 'PENDING' || !task.approvalStatus ? 'var(--text-secondary)' : '#fff',
                              }}
                              title={task.approvalStatus || 'PENDING'}
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (!isReadOnly && onOpenApprovalMenu) {
                                  closeAllMenus();
                                  onOpenApprovalMenu(e, task);
                                }
                              }}
                            >
                              {task.approvalStatus === 'APPROVED' ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : task.approvalStatus === 'REJECTED' ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> : task.approvalStatus === 'CHANGES_REQUESTED' ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.67-5.67"></path></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>}
                            </div>
                          </div>
                        ) : task.type === 'MILESTONE' ? (
                          <div
                            onClick={(e) => { e.stopPropagation(); if (!isReadOnly) handleToggleTaskCompleteInline(task, sectionId); }}
                            style={{
                              width: '12px', height: '12px', flexShrink: 0, cursor: isReadOnly ? 'default' : 'pointer',
                              transform: 'rotate(45deg)',
                              backgroundColor: task.isCompleted ? 'var(--accent-success)' : 'transparent',
                              border: task.isCompleted ? '2px solid var(--accent-success)' : '2px solid #6366F1',
                            }}
                            title="Milestone"
                          />
                        ) : (
                          <div
                            onClick={(e) => { e.stopPropagation(); if (!isReadOnly) handleToggleTaskCompleteInline(task, sectionId); }}
                            style={{
                              width: '18px', height: '18px', borderRadius: '50%', border: '1px solid',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: isReadOnly ? 'default' : 'pointer', flexShrink: 0,
                              borderColor: task.isCompleted ? 'var(--accent-success)' : 'var(--text-tertiary)',
                              backgroundColor: task.isCompleted ? 'var(--accent-success)' : 'transparent',
                              color: '#fff',
                            }}
                          >
                            {task.isCompleted && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                          </div>
                        )}

                        {editingTaskId === task.id ? (
                          <input
                            ref={editingTaskId === task.id ? inputRef : null}
                            type="text"
                            value={editTaskTitleValue}
                            autoFocus
                            onChange={(e) => setEditTaskTitleValue(e.target.value)}
                            onBlur={() => submitTaskRename(task, sectionId)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitTaskRename(task, sectionId);
                              if (e.key === 'Escape') setEditingTaskId(null);
                            }}
                            style={{
                              minWidth: '200px',
                              fontSize: '0.85rem',
                              fontFamily: 'inherit',
                              padding: '0',
                              backgroundColor: 'transparent',
                              color: 'var(--text-primary)',
                              border: 'none',
                              outline: 'none'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isReadOnly) {
                                let offset = null;
                                if (document.caretRangeFromPoint) {
                                  const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                                  if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
                                    offset = range.startOffset;
                                  }
                                } else if (document.caretPositionFromPoint) {
                                  const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
                                  if (pos && pos.offsetNode.nodeType === Node.TEXT_NODE) {
                                    offset = pos.offset;
                                  }
                                }
                                setEditCursorPos(offset !== null ? offset : task.title.length);
                                setEditingTaskId(task.id);
                                setEditTaskTitleValue(task.title);
                              }
                              if (onOpenTaskPane) onOpenTaskPane(task.id);
                            }}
                            style={{ fontSize: '0.85rem', color: 'var(--text-primary)', textDecoration: task.isCompleted ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: isReadOnly ? 'default' : 'text', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            {task.title}
                            {task.tags && task.tags.map(tag => (
                              <span key={tag.id} style={{ color: tag.color, fontSize: '0.75rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path></svg> {tag.name}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>

                      {/* Data Cells (Dynamic based on columnOrder) */}
                      {columnOrder.map(colId => {
                        if (colId === 'assignee') {
                          return (
                            <div key="assignee" style={{ ...styles.gridBodyCell, width: colWidths.assignee, flexShrink: 0, cursor: isReadOnly ? 'default' : 'pointer' }} onClick={(e) => !isReadOnly && handleOpenPopoverInline(e, 'assignee', task, sectionId)}>
                              {task.assignee ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden', height: '22px' }}>
                                  <div style={styles.listAvatarIcon}>{task.assignee.name?.[0].toUpperCase()}</div>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.assignee.name}</span>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', height: '22px' }}>
                                  <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>👤 Unassigned</span>
                                </div>
                              )}
                            </div>
                          );
                        } else if (colId === 'dueDate') {
                          return (
                            <div key="dueDate" style={{ ...styles.gridBodyCell, width: colWidths.dueDate, flexShrink: 0, cursor: isReadOnly ? 'default' : 'pointer', color: (task.dueDate && new Date(task.dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && !task.isCompleted) ? '#EF4444' : '#4F46E5', fontSize: '0.8rem', fontWeight: '500' }} onClick={(e) => !isReadOnly && handleOpenPopoverInline(e, 'date', task, sectionId)}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatFriendlyDate(task.startDate, task.dueDate)}</span>
                            </div>
                          );
                        } else {
                          const cf = customFields.find(f => f.id === colId);
                          if (!cf) return null;
                          let parsedFields = {};
                          if (typeof task.customFields === 'string') {
                            try { parsedFields = JSON.parse(task.customFields); } catch (e) { }
                          } else if (task.customFields) {
                            parsedFields = task.customFields;
                          }

                          return (
                            <div key={cf.id} style={{ ...styles.gridBodyCell, width: colWidths[cf.id] || 140, flexShrink: 0, position: 'relative', cursor: isReadOnly ? 'default' : 'pointer', overflow: 'visible' }} onClick={(e) => !isReadOnly && handleOpenCellMenu(e, `${task.id}-${cf.id}`)}>
                              {(() => {
                                const val = parsedFields[cf.id];
                                if (!val) return null;

                                if (cf.type === 'SELECT' || cf.type === 'single-select') {
                                  const opt = cf.options?.find(o => (o.label || o.value) === val);
                                  const displayValue = opt ? (opt.label || opt.value) : val;
                                  const displayColor = opt ? opt.color : '#F3F4F6';
                                  return (
                                    <span style={{ fontSize: '0.75rem', fontWeight: '500', padding: '2px 8px', borderRadius: '4px', backgroundColor: displayColor, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      {displayValue}
                                    </span>
                                  );
                                }

                                return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>;
                              })()}
                              {openCellMenuId === `${task.id}-${cf.id}` && (
                                <div style={{ ...styles.cellDropdownMenu, ...(menuPosition === 'top' ? { bottom: '100%', top: 'auto', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }) }} onClick={(e) => e.stopPropagation()}>
                                  {(cf.type === 'SELECT' || cf.type === 'single-select') && cf.options?.map(o => (
                                    <button
                                      key={o.id}
                                      onClick={() => { handleTaskCustomFieldUpdate(task.id, sectionId, cf.id, o.label); setOpenCellMenuId(null); }}
                                      style={{ ...styles.dropdownItem, color: 'var(--text-primary)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                      <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: o.color || '#E0E7FF', flexShrink: 0 }}></div>
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label || o.value}</span>
                                    </button>
                                  ))}
                                  <div style={{ borderTop: '1px solid #E5E7EB', margin: '4px 0' }}></div>
                                  <button onClick={() => { handleTaskCustomFieldUpdate(task.id, sectionId, cf.id, ''); setOpenCellMenuId(null); }} style={{ ...styles.dropdownItem, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    Clear value
                                  </button>
                                  <button onClick={() => { setFieldTitle(cf.title); setFieldOptionsList(cf.options); setEditingFieldOptions(true); setOpenCellMenuId(null); }} style={{ ...styles.dropdownItem, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '1rem' }}>✏️</span> Edit field
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        }
                      })}
                    </div>
                  ))}


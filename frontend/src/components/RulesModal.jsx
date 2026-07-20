import { useState, useEffect } from 'react';
import './RulesModal.css';

const TRIGGER_OPTIONS = [
  { group: 'Task moved', items: [
      { id: 'task_moved', label: 'Task is moved to a section', icon: '→' },
      { id: 'task_added_to_project', label: 'Task is added to this project', icon: '+' }
  ]},
  { group: 'Task field is changed', items: [
      { id: 'task_assigned', label: 'Task is assigned', icon: '👤' },
      { id: 'task_type_changed', label: 'Task type is changed', icon: '✓' },
      { id: 'task_name_changed', label: 'Task name is changed', icon: 'A' },
      { id: 'task_description_changed', label: 'Task description is changed', icon: 'A' }
  ]},
  { group: 'Due date is…', items: [
      { id: 'due_date_changed', label: 'Due date is changed', icon: '📅' },
      { id: 'due_date_approaching', label: 'Due date is approaching', icon: '📅' },
      { id: 'task_overdue', label: 'Task is overdue', icon: '📅' }
  ]},
  { group: 'Start date is…', items: [
      { id: 'start_date_changed', label: 'Start date is changed', icon: '📅' },
      { id: 'start_date_approaching', label: 'Start date is approaching', icon: '📅' },
      { id: 'start_date_passed', label: 'Start date has passed', icon: '📅' }
  ]},
  { group: 'Status is changed', items: [
      { id: 'approval_status_changed', label: 'Approval status is changed', icon: '✓' },
      { id: 'task_no_longer_blocked', label: 'Task is no longer blocked', icon: '✓' },
      { id: 'completion_status_changed', label: 'Task completion status is changed', icon: '✓' }
  ]},
  { group: 'Custom field is changed', items: [
      { id: 'custom_field_changed', label: 'Custom field is changed', icon: '★' }
  ]},
  { group: 'Added to task', items: [
      { id: 'attachment_added', label: 'Attachment is added', icon: '📎' },
      { id: 'comment_added', label: 'Comment is added', icon: '💬' },
      { id: 'collaborator_added', label: 'Collaborator is added', icon: '👤' }
  ]},
  { group: 'Other', items: [
      { id: 'rule_run_manually', label: 'Rule is run manually', icon: '⚙️' },
      { id: 'scheduled_time_occurs', label: 'Scheduled time occurs…', icon: '⏱' }
  ]}
];

const ACTION_OPTIONS = [
  { group: 'Move task', items: [
      { id: 'move_to_section', label: 'Move to a section…', icon: '→' },
      { id: 'add_to_project', label: 'Move or add to project…', icon: '+' },
      { id: 'remove_from_project', label: 'Remove task from the project', icon: '✕' }
  ]},
  { group: 'Change status', items: [
      { id: 'mark_complete', label: 'Change completion status to…', icon: '✓' }
  ]},
  { group: 'Change task field to…', items: [
      { id: 'change_assignee', label: 'Change assignee to…', icon: '👤' },
      { id: 'change_due_date', label: 'Change due date to…', icon: '📅' },
      { id: 'set_task_name', label: 'Set task name to', icon: 'A' },
      { id: 'set_task_description', label: 'Set task description to', icon: 'A' }
  ]},
  { group: 'Change custom field to…', items: [
      { id: 'change_custom_field', label: 'Change custom field to…', icon: '★' }
  ]},
  { group: 'Create new', items: [
      { id: 'create_task', label: 'Create a task…', icon: '+' },
      { id: 'create_subtasks', label: 'Create subtasks…', icon: '+' },
      { id: 'create_approvals', label: 'Create approvals…', icon: '+' }
  ]},
  { group: 'Convert task to…', items: [
      { id: 'convert_to_project', label: 'Convert task to project', icon: '↳' },
      { id: 'set_task_type', label: 'Set task type to', icon: '✓' }
  ]},
  { group: 'Add to task', items: [
      { id: 'add_comment', label: 'Add comment', icon: '💬' },
      { id: 'add_collaborators', label: 'Add or remove collaborators', icon: '👤' }
  ]}
];

export default function RulesModal({ projectId, token, onClose, editRule = null }) {
  const [ruleName, setRuleName] = useState(editRule ? 'Edit Rule' : 'New Rule');
  const [triggerType, setTriggerType] = useState(editRule?.triggerType || '');
  const [triggerValue, setTriggerValue] = useState(editRule?.triggerValue || '');
  const [actionType, setActionType] = useState(editRule?.actionType || '');
  const [actionValue, setActionValue] = useState(editRule?.actionValue || '');
  
  const [activePanel, setActivePanel] = useState(null); // 'trigger', 'action', or null
  const [searchQuery, setSearchQuery] = useState('');
  
  const [sections, setSections] = useState([]);
  const [members, setMembers] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [projectName, setProjectName] = useState('Project');

  useEffect(() => {
    fetchProjectData();
    // Reconstruct rule name if editing (optional enhancement)
    if (editRule) {
       let name = editRule.triggerType.replace(/_/g, ' ') + ' → ' + editRule.actionType.replace(/_/g, ' ');
       name = name.charAt(0).toUpperCase() + name.slice(1);
       setRuleName(name);
    }
  }, [editRule]);

  const fetchProjectData = async () => {
    try {
      const res = await fetch(`http://localhost:5001/api/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const projects = await res.json();
      const currentProject = projects.find(p => p.id === projectId);
      if (currentProject) {
        setProjectName(currentProject.name || 'Project');
        if (currentProject.sections) {
          setSections(currentProject.sections);
        }
        if (currentProject.members) {
          const membersList = currentProject.members.map(m => m.user || m);
          setMembers(membersList);
        }
        let fields = [];
        try {
            if (currentProject.customFieldSettings) {
               const parsedFields = typeof currentProject.customFieldSettings === 'string' ? JSON.parse(currentProject.customFieldSettings) : currentProject.customFieldSettings;
               if (Array.isArray(parsedFields)) fields = [...parsedFields];
            }
        } catch (e) {}
        setCustomFields(fields);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublish = async () => {
    if (!triggerType || !actionType) return;
    try {
      let res;
      if (editRule) {
        res = await fetch(`http://localhost:5001/api/projects/${projectId}/rules/${editRule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ triggerType, triggerValue, actionType, actionValue })
        });
      } else {
        res = await fetch(`http://localhost:5001/api/projects/${projectId}/rules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ triggerType, triggerValue, actionType, actionValue })
        });
      }

      if (res.ok) {
        onClose();
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getFilteredOptions = (options) => {
    if (!searchQuery) return options;
    return options.map(group => ({
      ...group,
      items: group.items.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
    })).filter(group => group.items.length > 0);
  };

  const renderTriggerValueInput = () => {
    if (triggerType === 'task_moved') {
      return (
        <select className="node-value-selector" value={triggerValue} onChange={e => setTriggerValue(e.target.value)} onClick={e => e.stopPropagation()}>
          <option value="">Select section...</option>
          {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      );
    }
    if (triggerType === 'custom_field_changed') {
      return (
        <select className="node-value-selector" value={triggerValue} onChange={e => setTriggerValue(e.target.value)} onClick={e => e.stopPropagation()}>
          <option value="">Select field...</option>
          {customFields.map(cf => <option key={cf.id || cf.title || cf.name} value={cf.id || cf.name || cf.title}>{cf.title || cf.name}</option>)}
        </select>
      );
    }
    return null;
  };

  const renderActionValueInput = () => {
    if (actionType === 'move_to_section') {
      return (
        <select className="node-value-selector" value={actionValue} onChange={e => setActionValue(e.target.value)} onClick={e => e.stopPropagation()}>
          <option value="">Select section...</option>
          {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      );
    }
    if (actionType === 'mark_complete') {
      return (
        <select className="node-value-selector" value={actionValue} onChange={e => setActionValue(e.target.value)} onClick={e => e.stopPropagation()}>
          <option value="">Select status...</option>
          <option value="true">Complete</option>
          <option value="false">Incomplete</option>
        </select>
      );
    }
    if (actionType === 'change_assignee' || actionType === 'add_collaborators') {
      return (
        <select className="node-value-selector" value={actionValue} onChange={e => setActionValue(e.target.value)} onClick={e => e.stopPropagation()}>
          <option value="">Select user...</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
        </select>
      );
    }
    if (actionType === 'set_task_type') {
      return (
        <select className="node-value-selector" value={actionValue} onChange={e => setActionValue(e.target.value)} onClick={e => e.stopPropagation()}>
          <option value="">Select type...</option>
          <option value="TASK">Task</option>
          <option value="MILESTONE">Milestone</option>
          <option value="APPROVAL">Approval</option>
        </select>
      );
    }
    if (actionType === 'change_custom_field') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
          <select className="node-value-selector" style={{ margin: 0 }} value={actionValue.split(':')[0] || ''} onChange={e => setActionValue(`${e.target.value}:`)}>
            <option value="">Select field...</option>
            {customFields.map(cf => <option key={cf.id || cf.title || cf.name} value={cf.id || cf.name || cf.title}>{cf.title || cf.name}</option>)}
          </select>
          {actionValue.split(':')[0] && (
            <select className="node-value-selector" style={{ margin: 0 }} value={actionValue.split(':')[1] || ''} onChange={e => setActionValue(`${actionValue.split(':')[0]}:${e.target.value}`)}>
              <option value="">Select value...</option>
              {customFields.find(cf => (cf.id || cf.title || cf.name) === actionValue.split(':')[0])?.options?.map(opt => (
                <option key={opt.id || opt.label} value={opt.label || opt}>{opt.label || opt}</option>
              ))}
            </select>
          )}
        </div>
      );
    }
    if (['change_due_date', 'set_task_name', 'set_task_description', 'create_task', 'create_subtasks', 'create_approvals', 'convert_to', 'add_comment'].includes(actionType)) {
      return (
        <input 
          type="text" 
          value={actionValue} 
          onChange={e => setActionValue(e.target.value)}
          onClick={e => e.stopPropagation()}
          placeholder={
            actionType === 'change_due_date' ? '+Days (e.g. 3) or Date' :
            actionType === 'create_subtasks' ? 'Titles (comma separated)' :
            actionType === 'add_comment' ? 'Comment text' : 'Enter value...'
          }
          className="node-value-selector"
        />
      );
    }
    return null;
  };

  const selectedTriggerObj = TRIGGER_OPTIONS.flatMap(g => g.items).find(i => i.id === triggerType);
  const selectedActionObj = ACTION_OPTIONS.flatMap(g => g.items).find(i => i.id === actionType);

  return (
    <div className="rules-modal-overlay" onClick={() => setActivePanel(null)}>
      
      {/* Header */}
      <div className="rules-modal-header" onClick={e => e.stopPropagation()}>
        <div className="rules-modal-header-left">
          <button className="close-btn" onClick={onClose}>←</button>
          <div>
            <div className="project-name">{projectName}</div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input 
                type="text" 
                className="rule-name-input" 
                value={ruleName} 
                onChange={e => setRuleName(e.target.value)} 
                placeholder="Add rule name"
              />
              <span className="active-badge">Active</span>
            </div>
          </div>
        </div>
        <div>
          <button 
            className={`publish-btn ${(!triggerType || !actionType) ? 'disabled' : ''}`}
            onClick={handlePublish}
          >
            Publish rule
          </button>
        </div>
      </div>

      <div className="rules-modal-body">
        
        {/* Canvas area containing nodes */}
        <div className="canvas-area">
          <div className="node-group">
            
            {/* Trigger Node */}
            <div 
              className={`rule-node ${triggerType ? 'filled' : ''} ${activePanel === 'trigger' ? 'selected' : ''}`}
              onClick={(e) => { e.stopPropagation(); setActivePanel('trigger'); setSearchQuery(''); }}
            >
              {triggerType && (
                <button className="node-remove" onClick={(e) => { e.stopPropagation(); setTriggerType(''); setTriggerValue(''); }}>×</button>
              )}
              <div className="node-title">
                {triggerType ? selectedTriggerObj?.label : '+ When...'}
              </div>
              {!triggerType && <div className="node-content">Add a trigger that sets the rule in motion.</div>}
              {triggerType && renderTriggerValueInput()}
            </div>

            <div className="node-connector dotted">
              <div className="connector-circle">...</div>
            </div>

            {/* Condition Node (Placeholder for now) */}
            <div className="rule-node disabled" onClick={e => e.stopPropagation()}>
              <div className="node-title" style={{ color: 'var(--text-tertiary)' }}>+ Check if...</div>
              <div className="node-content">Add a condition (coming soon).</div>
            </div>

            <div className="node-connector"></div>

            {/* Action Node */}
            <div 
              className={`rule-node ${actionType ? 'filled' : ''} ${activePanel === 'action' ? 'selected' : ''}`}
              onClick={(e) => { e.stopPropagation(); setActivePanel('action'); setSearchQuery(''); }}
            >
              {actionType && (
                <button className="node-remove" onClick={(e) => { e.stopPropagation(); setActionType(''); setActionValue(''); }}>×</button>
              )}
              <div className="node-title">
                {actionType ? selectedActionObj?.label : '+ Do this...'}
              </div>
              {!actionType && <div className="node-content">Add an action that occurs as a result of the rule.</div>}
              {actionType && renderActionValueInput()}
            </div>

          </div>
        </div>

        {/* Right Side Panel */}
        {activePanel && (
          <div className="side-panel" onClick={e => e.stopPropagation()}>
            <div className="side-panel-header">
              <h3>{activePanel === 'trigger' ? 'When...' : 'Do this...'}</h3>
              <p>
                {activePanel === 'trigger' 
                  ? 'Add a trigger that sets the rule in motion.' 
                  : 'Add an action that occurs as a result of the rule.'}
              </p>
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input 
                  type="text" 
                  placeholder={`Search ${activePanel}s`} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="side-panel-tabs">
              <div className="panel-tab active">{activePanel === 'trigger' ? 'Triggers' : 'Actions'}</div>
            </div>

            <div className="side-panel-content">
              {getFilteredOptions(activePanel === 'trigger' ? TRIGGER_OPTIONS : ACTION_OPTIONS).map(group => (
                <div key={group.group} className="option-group">
                  <div className="option-group-title">{group.group}</div>
                  {group.items.map(item => (
                    <div 
                      key={item.id} 
                      className="option-item"
                      onClick={() => {
                        if (activePanel === 'trigger') {
                          setTriggerType(item.id);
                          setTriggerValue('');
                        } else {
                          setActionType(item.id);
                          setActionValue('');
                        }
                      }}
                    >
                      <div className="option-icon">{item.icon}</div>
                      <div className="option-label">{item.label}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

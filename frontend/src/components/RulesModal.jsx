import { useState, useEffect } from 'react';
import './RulesModal.css';
import { apiFetch } from '../api';

const TRIGGER_OPTIONS = [
  {
    group: 'Task moved', items: [
      { id: 'task_moved', label: 'Task is moved to a section', icon: '→' },
      { id: 'task_added_to_project', label: 'Task is added to this project', icon: '+' }
    ]
  },
  {
    group: 'Task field is changed', items: [
      { id: 'task_assigned', label: 'Task is assigned', icon: '👤' },
      { id: 'task_type_changed', label: 'Task type is changed', icon: '✓' },
      { id: 'task_name_changed', label: 'Task name is changed', icon: 'A' },
      { id: 'task_description_changed', label: 'Task description is changed', icon: 'A' }
    ]
  },
  {
    group: 'Due date is…', items: [
      { id: 'due_date_changed', label: 'Due date is changed', icon: '📅' },
      { id: 'due_date_approaching', label: 'Due date is approaching', icon: '📅' },
      { id: 'task_overdue', label: 'Task is overdue', icon: '📅' }
    ]
  },
  {
    group: 'Start date is…', items: [
      { id: 'start_date_changed', label: 'Start date is changed', icon: '📅' },
      { id: 'start_date_approaching', label: 'Start date is approaching', icon: '📅' },
      { id: 'start_date_passed', label: 'Start date has passed', icon: '📅' }
    ]
  },
  {
    group: 'Status is changed', items: [
      { id: 'approval_status_changed', label: 'Approval status is changed', icon: '✓' },
      { id: 'task_no_longer_blocked', label: 'Task is no longer blocked', icon: '✓' },
      { id: 'completion_status_changed', label: 'Task completion status is changed', icon: '✓' }
    ]
  },
  {
    group: 'Custom field is changed', items: [
      { id: 'custom_field_changed', label: 'Custom field is changed', icon: '★' }
    ]
  },
  {
    group: 'Added to task', items: [
      { id: 'attachment_added', label: 'Attachment is added', icon: '📎' },
      { id: 'comment_added', label: 'Comment is added', icon: '💬' },
      { id: 'collaborator_added', label: 'Collaborator is added', icon: '👤' }
    ]
  },
  {
    group: 'Other', items: [
      { id: 'rule_run_manually', label: 'Rule is run manually', icon: '⚙️' },
      { id: 'scheduled_time_occurs', label: 'Scheduled time occurs…', icon: '⏱' }
    ]
  }
];

const ACTION_OPTIONS = [
  {
    group: 'Move task', items: [
      { id: 'move_to_section', label: 'Move to a section…', icon: '→' },
      { id: 'add_to_project', label: 'Move or add to project…', icon: '+' },
      { id: 'remove_from_project', label: 'Remove task from the project', icon: '✕' }
    ]
  },
  {
    group: 'Change status', items: [
      { id: 'mark_complete', label: 'Change completion status to…', icon: '✓' }
    ]
  },
  {
    group: 'Change task field to…', items: [
      { id: 'change_assignee', label: 'Change assignee to…', icon: '👤' },
      { id: 'change_due_date', label: 'Change due date to…', icon: '📅' },
      { id: 'set_task_name', label: 'Set task name to', icon: 'A' },
      { id: 'set_task_description', label: 'Set task description to', icon: 'A' }
    ]
  },
  {
    group: 'Change custom field to…', items: [
      { id: 'change_custom_field', label: 'Change custom field to…', icon: '★' }
    ]
  },
  {
    group: 'Create new', items: [
      { id: 'create_task', label: 'Create a task…', icon: '+' },
      { id: 'create_subtasks', label: 'Create subtasks…', icon: '+' },
      { id: 'create_approvals', label: 'Create approvals…', icon: '+' }
    ]
  },
  {
    group: 'Convert task to…', items: [
      { id: 'convert_to_project', label: 'Convert task to project', icon: '↳' },
      { id: 'set_task_type', label: 'Set task type to', icon: '✓' }
    ]
  },
  {
    group: 'Add to task', items: [
      { id: 'add_comment', label: 'Add comment', icon: '💬' },
      { id: 'add_collaborators', label: 'Add or remove collaborators...', icon: '👤' }
    ]
  }
];

const CONDITION_OPTIONS = [
  {
    group: 'Task moved', items: [
      { id: 'task_in_section', label: 'Task is in section...', icon: '≡' },
      { id: 'task_added_by_form', label: 'Task is added to this project by form...', icon: '+' },
      { id: 'task_added_by_email', label: 'Task is added to this project by email...', icon: '+' }
    ]
  },
  {
    group: 'Task field is...', items: [
      { id: 'assignee_is', label: 'Assignee is...', icon: '👤' },
      { id: 'task_creator_is', label: 'Task creator is...', icon: '👤' },
      { id: 'task_name_is', label: 'Task name is...', icon: 'A' },
      { id: 'task_description_is', label: 'Task description is...', icon: 'A' },
      { id: 'due_date_is', label: 'Due date is...', icon: '📅' },
      { id: 'start_date_is', label: 'Start date is...', icon: '📅' }
    ]
  },
  {
    group: 'Status is...', items: [
      { id: 'task_type_is', label: 'Task type is...', icon: '✓' },
      { id: 'completion_status_is', label: 'Task or all subtasks completion status is...', icon: '✓' },
      { id: 'approval_status_is', label: 'Approval status is...', icon: '✓' },
      { id: 'task_no_longer_blocked', label: 'Task is no longer blocked', icon: '🔗' }
    ]
  },
  {
    group: 'Task details', items: [
      { id: 'task_in_projects', label: 'Task is in any of these projects...', icon: '🏢' }
    ]
  },
  {
    group: 'Custom field is...', items: [
      { id: 'custom_field_is', label: 'Custom field is...', icon: 'v' }
    ]
  },
  {
    group: 'Task has...', items: [
      { id: 'task_has_attachment', label: 'Task has an attachment', icon: '📎' },
      { id: 'task_has_comment', label: 'Task has a comment', icon: '💬' }
    ]
  }
];

export default function RulesModal({ projectId, token, onClose, editRule = null }) {
  const [ruleName, setRuleName] = useState(editRule ? 'Edit Rule' : 'New Rule');
  const [isActive, setIsActive] = useState(editRule && editRule.isActive !== undefined ? editRule.isActive : true);

  const [ruleData, setRuleData] = useState(() => {
    if (editRule?.ruleData) return editRule.ruleData;
    if (editRule?.triggerType) {
      return {
        trigger: { type: editRule.triggerType, value: editRule.triggerValue },
        branches: [{
          id: Date.now().toString(),
          conditions: [],
          actions: [{ type: editRule.actionType, value: editRule.actionValue }]
        }]
      }
    }
    return { trigger: null, branches: [{ id: '1', conditions: [], actions: [] }] };
  });

  const [activePanel, setActivePanel] = useState(null); // { type: 'trigger'|'condition'|'action', branchId: string, itemIndex: number }
  const [showAddBranchMenu, setShowAddBranchMenu] = useState(false);
  const [actionPlaceholders, setActionPlaceholders] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const [allProjects, setAllProjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [members, setMembers] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [projectName, setProjectName] = useState('Project');

  useEffect(() => {
    fetchProjectData();
    if (editRule && !editRule.ruleData) {
      let name = editRule.triggerType.replace(/_/g, ' ') + ' → ' + editRule.actionType.replace(/_/g, ' ');
      name = name.charAt(0).toUpperCase() + name.slice(1);
      setRuleName(name);
    }
  }, [editRule]);

  const fetchProjectData = async () => {
    try {
      const res = await apiFetch(`/api/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const projects = await res.json();
      setAllProjects(projects);
      const currentProject = projects.find(p => p.id === projectId);
      if (currentProject) {
        setProjectName(currentProject.name || 'Project');
        if (currentProject.sections) setSections(currentProject.sections);
        if (currentProject.members) setMembers(currentProject.members.map(m => m.user || m));
        let fields = [];
        try {
          if (currentProject.customFieldSettings) {
            const parsedFields = typeof currentProject.customFieldSettings === 'string' ? JSON.parse(currentProject.customFieldSettings) : currentProject.customFieldSettings;
            if (Array.isArray(parsedFields)) fields = [...parsedFields];
          }
        } catch (e) { }
        setCustomFields(fields);
      }
    } catch (err) { }
  };

  const handlePublish = async () => {
    if (!ruleData.trigger) return;
    try {
      let res;
      if (editRule) {
        res = await apiFetch(`/api/projects/${projectId}/rules/${editRule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ ruleData, isActive })
        });
      } else {
        res = await apiFetch(`/api/projects/${projectId}/rules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ ruleData, isActive })
        });
      }
      if (res.ok) onClose();
      else alert((await res.json()).error);
    } catch (err) { }
  };

  const getFilteredOptions = (options) => {
    let opts = options.map(g => {
      if (g.group === 'Custom field is...' || g.group === 'Custom field is changed' || g.group === 'Change custom field to…') {
        if (customFields.length > 0) {
          const idStr = g.group === 'Custom field is...' ? 'custom_field_is' : g.group === 'Custom field is changed' ? 'custom_field_changed' : 'change_custom_field';
          const labelSuffix = g.group === 'Custom field is...' ? ' is...' : g.group === 'Custom field is changed' ? ' is changed' : ' to...';
          const iconStr = g.group === 'Custom field is...' ? 'v' : '★';
          return {
            ...g,
            items: customFields.map(cf => ({
              id: idStr,
              fieldId: cf.id || cf.name || cf.title,
              label: g.group === 'Change custom field to…' ? `Change ${cf.title || cf.name} to...` : `${cf.title || cf.name}${labelSuffix}`,
              icon: iconStr
            }))
          };
        }
      }
      return g;
    });

    if (!searchQuery) return opts;
    return opts.map(group => ({
      ...group,
      items: group.items.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
    })).filter(group => group.items.length > 0);
  };

  const updateNodeData = (nodeType, branchId, itemIndex, field, value) => {
    setRuleData(prev => {
      const newData = { ...prev };
      if (nodeType === 'trigger') {
        newData.trigger = { ...newData.trigger, [field]: value };
      } else {
        const branchIndex = newData.branches.findIndex(b => b.id === branchId);
        if (branchIndex !== -1) {
          if (nodeType === 'condition') {
            newData.branches[branchIndex].conditions[itemIndex] = { ...newData.branches[branchIndex].conditions[itemIndex], [field]: value };
          } else if (nodeType === 'action') {
            newData.branches[branchIndex].actions[itemIndex] = { ...newData.branches[branchIndex].actions[itemIndex], [field]: value };
          }
        }
      }
      return newData;
    });
  };

  const setNodeType = (nodeType, branchId, itemIndex, typeId) => {
    if (nodeType === 'action') {
      const branch = ruleData.branches.find(b => b.id === branchId);
      if (branch && !branch.actions[itemIndex]) {
        setActionPlaceholders(prev => ({ ...prev, [branchId]: false }));
      }
    }

    setRuleData(prev => {
      const newData = { ...prev };
      if (nodeType === 'trigger') {
        newData.trigger = { type: typeId, value: '' };
      } else {
        const branchIndex = newData.branches.findIndex(b => b.id === branchId);
        if (branchIndex !== -1) {
          if (nodeType === 'condition') {
            if (newData.branches[branchIndex].conditions[itemIndex]) {
              newData.branches[branchIndex].conditions[itemIndex] = { type: typeId, value: '' };
            } else {
              newData.branches[branchIndex].conditions.push({ type: typeId, value: '' });
            }
          } else if (nodeType === 'action') {
            if (newData.branches[branchIndex].actions[itemIndex]) {
              newData.branches[branchIndex].actions[itemIndex] = { type: typeId, value: '' };
            } else {
              newData.branches[branchIndex].actions.push({ type: typeId, value: '' });
            }
          }
        }
      }
      return newData;
    });
  };

  const removeNode = (nodeType, branchId, itemIndex) => {
    setRuleData(prev => {
      const newData = { ...prev };
      if (nodeType === 'trigger') {
        newData.trigger = null;
      } else {
        const branchIndex = newData.branches.findIndex(b => b.id === branchId);
        if (branchIndex !== -1) {
          if (nodeType === 'condition') {
            newData.branches[branchIndex].conditions.splice(itemIndex, 1);
          } else if (nodeType === 'action') {
            newData.branches[branchIndex].actions.splice(itemIndex, 1);
          }
        }
      }
      return newData;
    });
    setActivePanel(null);
  };

  const removeBranch = (branchId) => {
    setRuleData(prev => {
      const newData = { ...prev };
      newData.branches = newData.branches.filter(b => b.id !== branchId);
      if (newData.branches.length === 0) {
        newData.branches = [{ id: Date.now().toString(), conditions: [], actions: [] }];
      }
      return newData;
    });
    setActivePanel(null);
  };

  const addBranch = (type = 'condition') => {
    const newBranchId = Date.now().toString();
    setRuleData(prev => {
      const branches = [...prev.branches];
      const newBranch = { id: newBranchId, type: type, conditions: [], actions: [] };

      const otherwiseIdx = branches.findIndex(b => b.type === 'otherwise');
      if (otherwiseIdx !== -1 && type !== 'otherwise') {
        branches.splice(otherwiseIdx, 0, newBranch);
      } else {
        branches.push(newBranch);
      }

      return {
        ...prev,
        branches
      };
    });
    setShowAddBranchMenu(false);

    if (type === 'condition') {
      setActivePanel({ type: 'condition', branchId: newBranchId, itemIndex: 0 });
    } else {
      setActivePanel({ type: 'action', branchId: newBranchId, itemIndex: 0 });
    }
    setSearchQuery('');
  };

  const renderValueInput = (nodeType, typeId, value, branchId, itemIndex) => {
    const onChange = (v) => updateNodeData(nodeType, branchId, itemIndex, 'value', v);
    const onTypeChange = (v) => updateNodeData(nodeType, branchId, itemIndex, 'type', v);

    // Inputs shared by condition and action/trigger
    if (typeId === 'task_moved' || typeId === 'move_to_section' || typeId === 'task_in_section') {
      return (
        <select className="node-value-selector" value={value || ''} onChange={e => onChange(e.target.value)} onClick={e => e.stopPropagation()}>
          <option value="">Select section...</option>
          {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      );
    }
    if (typeId === 'custom_field_changed' || typeId === 'custom_field_is' || typeId === 'change_custom_field') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
          <select className="node-value-selector" style={{ margin: 0 }} value={(value || '').split(':')[0] || ''} onChange={e => onChange(`${e.target.value}:`)}>
            <option value="">Select field...</option>
            {customFields.map(cf => <option key={cf.id || cf.title || cf.name} value={cf.id || cf.name || cf.title}>{cf.title || cf.name}</option>)}
          </select>
          {(value || '').split(':')[0] && (
            <select className="node-value-selector" style={{ margin: 0 }} value={(value || '').split(':')[1] || ''} onChange={e => onChange(`${(value || '').split(':')[0]}:${e.target.value}`)}>
              <option value="">{typeId === 'custom_field_changed' ? 'Any value' : 'Select value...'}</option>
              {(() => {
                const selectedCf = customFields.find(cf => (cf.id || cf.title || cf.name) === (value || '').split(':')[0]);
                if (!selectedCf) return null;
                if (selectedCf.type === 'github_pr') {
                  const prStatuses = ['Merged', 'Approved', 'Changes requested', 'In review', 'No reviews', 'Open', 'Closed'];
                  return prStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ));
                }
                return selectedCf.options?.map(opt => (
                  <option key={opt.id || opt.label} value={opt.label || opt.value || opt}>{opt.label || opt.value || opt}</option>
                ));
              })()}
            </select>
          )}
        </div>
      );
    }
    if (typeId === 'mark_complete' || typeId === 'completion_status_is') {
      return (
        <select className="node-value-selector" value={value || ''} onChange={e => onChange(e.target.value)} onClick={e => e.stopPropagation()}>
          <option value="">Select status...</option>
          <option value={typeId === 'mark_complete' ? 'true' : 'completed'}>Complete</option>
          <option value={typeId === 'mark_complete' ? 'false' : 'incomplete'}>Incomplete</option>
        </select>
      );
    }
    if (typeId === 'change_assignee' || typeId === 'add_collaborators' || typeId === 'remove_collaborators' || typeId === 'assignee_is' || typeId === 'task_creator_is') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
          {(typeId === 'add_collaborators' || typeId === 'remove_collaborators') && (
            <select className="node-value-selector" style={{ margin: 0 }} value={typeId} onChange={e => onTypeChange(e.target.value)}>
              <option value="add_collaborators">Add collaborators</option>
              <option value="remove_collaborators">Remove collaborators</option>
            </select>
          )}
          <select className="node-value-selector" style={{ margin: 0 }} value={value || ''} onChange={e => onChange(e.target.value)}>
            <option value="">Select user...</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
          </select>
        </div>
      );
    }
    if (typeId === 'add_to_project' || typeId === 'move_to_project') {
      const selectedProjId = (value || '').split(':')[0] || '';
      const selectedSecId = (value || '').split(':')[1] || '';
      const proj = allProjects.find(p => p.id === selectedProjId);
      const projSections = proj?.sections || [];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
          <select className="node-value-selector" style={{ margin: 0 }} value={typeId} onChange={e => onTypeChange(e.target.value)}>
            <option value="add_to_project">Add to project</option>
            <option value="move_to_project">Move to project</option>
          </select>
          <select className="node-value-selector" style={{ margin: 0 }} value={selectedProjId} onChange={e => onChange(e.target.value)}>
            <option value="">Select project...</option>
            {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {selectedProjId && projSections.length > 0 && (
            <select className="node-value-selector" style={{ margin: 0 }} value={selectedSecId} onChange={e => onChange(`${selectedProjId}:${e.target.value}`)}>
              <option value="">Select section (optional)...</option>
              {projSections.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      );
    }
    if (typeId === 'set_task_type' || typeId === 'task_type_is') {
      return (
        <select className="node-value-selector" value={value || ''} onChange={e => onChange(e.target.value)} onClick={e => e.stopPropagation()}>
          <option value="">Select type...</option>
          <option value="TASK">Task</option>
          <option value="MILESTONE">Milestone</option>
          <option value="APPROVAL">Approval</option>
        </select>
      );
    }
    if (typeId === 'approval_status_is') {
      return (
        <select className="node-value-selector" value={value || ''} onChange={e => onChange(e.target.value)} onClick={e => e.stopPropagation()}>
          <option value="">Select status...</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CHANGES_REQUESTED">Changes Requested</option>
        </select>
      );
    }
    if (typeId === 'task_in_projects') {
      return (
        <select className="node-value-selector" value={value || ''} onChange={e => onChange(e.target.value)} onClick={e => e.stopPropagation()}>
          <option value="">Select project...</option>
          {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      );
    }
    if (['change_due_date', 'set_task_name', 'set_task_description', 'create_task', 'create_subtasks', 'create_approvals', 'convert_to', 'add_comment', 'task_name_is', 'task_description_is'].includes(typeId)) {
      return (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          onClick={e => e.stopPropagation()}
          placeholder={
            typeId === 'change_due_date' ? '+Days (e.g. 3) or Date' :
              typeId === 'create_subtasks' ? 'Titles (comma separated)' :
                typeId === 'add_comment' ? 'Comment text' : 'Enter value...'
          }
          className="node-value-selector"
        />
      );
    }
    if (['due_date_is', 'start_date_is'].includes(typeId)) {
      let config = { op: 'empty', date1: '', date2: '' };
      try {
        if (value) config = JSON.parse(value);
      } catch (e) { }

      const updateDateConfig = (newOp, newD1, newD2) => {
        onChange(JSON.stringify({ op: newOp, date1: newD1, date2: newD2 }));
      };

      const name = typeId === 'due_date_is' ? 'Due date' : 'Start date';

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', width: '100%' }}>
          <select
            className="node-value-selector"
            style={{ margin: 0 }}
            value={config.op}
            onChange={(e) => updateDateConfig(e.target.value, config.date1, config.date2)}
            onClick={e => e.stopPropagation()}
          >
            <option value="empty">{name} is empty</option>
            <option value="not_empty">{name} is not empty</option>
            <option value="before">{name} is before...</option>
            <option value="after">{name} is after...</option>
            <option value="between">{name} is between...</option>
          </select>

          {(config.op === 'before' || config.op === 'after') && (
            <input
              type="date"
              className="node-value-selector"
              style={{ margin: 0, width: '65%' }}
              value={config.date1}
              onChange={e => updateDateConfig(config.op, e.target.value, config.date2)}
              onClick={e => e.stopPropagation()}
            />
          )}

          {config.op === 'between' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="date"
                className="node-value-selector"
                style={{ margin: 0, flex: 1, minWidth: 0, width: 'auto' }}
                value={config.date1}
                onChange={e => updateDateConfig(config.op, e.target.value, config.date2)}
                onClick={e => e.stopPropagation()}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>and</span>
              <input
                type="date"
                className="node-value-selector"
                style={{ margin: 0, flex: 1, minWidth: 0, width: 'auto' }}
                value={config.date2}
                onChange={e => updateDateConfig(config.op, config.date1, e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const getOptionMeta = (typeId, panelType) => {
    let opts = [];
    if (panelType === 'trigger') opts = TRIGGER_OPTIONS;
    else if (panelType === 'condition') opts = CONDITION_OPTIONS;
    else opts = ACTION_OPTIONS;

    let res = opts.flatMap(g => g.items).find(i => i.id === typeId);
    if (!res && typeId === 'move_to_project') res = { id: 'move_to_project', label: 'Move or add to project…', icon: '+' };
    if (!res && typeId === 'remove_collaborators') res = { id: 'remove_collaborators', label: 'Add or remove collaborators...', icon: '👤' };
    return res;
  };

  return (
    <div className="rules-modal-overlay" onClick={() => { setActivePanel(null); setShowAddBranchMenu(false); }}>
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
              <span
                className={isActive ? 'active-badge' : 'paused-badge'}
                onClick={(e) => { e.stopPropagation(); setIsActive(!isActive); }}
              >
                {isActive ? 'Active' : 'Paused'}
              </span>
            </div>
          </div>
        </div>
        <div>
          <button
            className={`publish-btn ${!ruleData.trigger ? 'disabled' : ''}`}
            onClick={handlePublish}
          >
            Publish rule
          </button>
        </div>
      </div>

      <div className="rules-modal-body">
        <div className="canvas-area">
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>

            {/* TRIGGER NODE */}
            <div className="trigger-column" style={{ marginTop: '0px' }}>
              <div
                className={`rule-node ${ruleData.trigger ? 'filled' : ''} ${activePanel?.type === 'trigger' ? 'selected' : ''}`}
                onClick={(e) => { e.stopPropagation(); setActivePanel({ type: 'trigger' }); setSearchQuery(''); }}
              >
                {ruleData.trigger && (
                  <button className="node-remove" onClick={(e) => { e.stopPropagation(); removeNode('trigger'); }}>×</button>
                )}
                <div className="node-title" style={!ruleData.trigger ? { color: 'var(--text-tertiary)' } : {}}>
                  {ruleData.trigger ? getOptionMeta(ruleData.trigger.type, 'trigger')?.label : '+ When...'}
                </div>
                {ruleData.trigger && renderValueInput('trigger', ruleData.trigger.type, ruleData.trigger.value, null, null)}
              </div>
            </div>

            {/* CONNECTOR FROM TRIGGER */}
            {ruleData.branches.length === 1 && ruleData.branches[0].conditions.length === 0 ? (
              <div style={{ position: 'relative', width: '40px', height: '2px', background: 'var(--border-color)', marginTop: '39px' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setNodeType('condition', ruleData.branches[0].id, 0, ''); }}
                  style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '24px', height: '24px', borderRadius: '50%', border: '2px solid var(--border-color)', background: 'var(--bg-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: 'var(--text-tertiary)', padding: 0, paddingBottom: '2px' }}
                >+</button>
              </div>
            ) : (
              <div className="h-connector" style={{ marginTop: '39px', width: '40px' }}></div>
            )}
            {/* SPINE & BRANCHES */}
            <div className="spine-container">

              {ruleData.branches.map((branch, bIdx) => {
                const showSpineDot = ruleData.branches.length > 1 || (ruleData.branches.length === 1 && branch.conditions.length > 0);
                return (
                  <div key={branch.id} style={{ display: 'flex', flexDirection: 'row', marginBottom: '30px', position: 'relative', zIndex: 2 }}>

                    {/* SOLID LINE DOWN TO NEXT BRANCH */}
                    {bIdx < ruleData.branches.length - 1 && (
                      <div style={{ position: 'absolute', top: '40px', bottom: '-30px', left: '19px', width: '2px', background: 'var(--border-color)', zIndex: -1 }}></div>
                    )}

                    {/* SOLID LINE UP TO PREVIOUS BRANCH */}
                    {bIdx > 0 && (
                      <div style={{ position: 'absolute', top: '0', height: '40px', left: '19px', width: '2px', background: 'var(--border-color)', zIndex: -1 }}></div>
                    )}

                    {/* DASHED LINE DOWN TO ADD BRANCH BUTTON */}
                    {bIdx === ruleData.branches.length - 1 && showSpineDot && (
                      <div style={{ position: 'absolute', top: '40px', bottom: '-10px', left: '19px', width: '2px', borderLeft: '2px dashed var(--border-color)', zIndex: -1 }}></div>
                    )}

                    {showSpineDot && (
                      <>
                        <div className="spine-node-row" style={{ width: '40px', justifyContent: 'center', height: '80px', flexShrink: 0, margin: 0, position: 'relative' }}>
                          {bIdx === 0 && <div style={{ position: 'absolute', top: '39px', left: '0', width: '20px', height: '2px', background: 'var(--border-color)', zIndex: -1 }}></div>}
                          <div style={{ position: 'absolute', top: '39px', right: '0', width: '20px', height: '2px', background: 'var(--border-color)', zIndex: -1 }}></div>
                          <div className="spine-circle">...</div>
                        </div>
                        <div className="h-connector" style={{ marginTop: '39px', width: '40px' }}></div>
                      </>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
                      {/* CONDITIONS */}
                      {branch.type !== 'otherwise' && branch.conditions.map((cond, cIdx) => (
                        <div key={`c-${cIdx}`} style={{ display: 'flex', flexDirection: 'row' }}>
                          <div
                            className={`rule-node filled ${activePanel?.type === 'condition' && activePanel?.branchId === branch.id && activePanel?.itemIndex === cIdx ? 'selected' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setActivePanel({ type: 'condition', branchId: branch.id, itemIndex: cIdx }); setSearchQuery(''); }}
                          >
                            <button className="node-remove" onClick={(e) => { e.stopPropagation(); removeNode('condition', branch.id, cIdx); }}>×</button>
                            <div className="node-title" style={!cond.type ? { color: 'var(--text-tertiary)' } : {}}>
                              {cond.type ? getOptionMeta(cond.type, 'condition')?.label : '+ Check if...'}
                            </div>
                            {renderValueInput('condition', cond.type, cond.value, branch.id, cIdx)}
                          </div>
                          <div className="h-connector" style={{ marginTop: '39px' }}></div>
                        </div>
                      ))}

                      {/* CONDITION PLACEHOLDER OR OTHERWISE */}
                      {branch.type === 'otherwise' ? (
                        <div style={{ display: 'flex', flexDirection: 'row' }}>
                          <div className="rule-node" style={{ justifyContent: 'center' }}>
                            <button className="node-remove" onClick={(e) => { e.stopPropagation(); removeBranch(branch.id); }}>×</button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '24px', height: '24px', background: 'var(--bg-secondary)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--text-tertiary)' }}>→</div>
                              <div>
                                <div style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Otherwise</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>If all other conditions are not met</div>
                              </div>
                            </div>
                          </div>
                          <div className="h-connector" style={{ marginTop: '39px' }}></div>
                        </div>
                      ) : branch.conditions.length === 0 ? (
                        ruleData.branches.length === 1 ? null : (
                          <div style={{ display: 'flex', flexDirection: 'row' }}>
                            <div
                              className={`rule-node ${activePanel?.type === 'condition' && activePanel?.branchId === branch.id && activePanel?.itemIndex === branch.conditions.length ? 'selected' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setActivePanel({ type: 'condition', branchId: branch.id, itemIndex: branch.conditions.length }); setSearchQuery(''); }}
                            >
                              <button className="node-remove" onClick={(e) => { e.stopPropagation(); removeBranch(branch.id); }}>×</button>
                              <div className="node-title" style={{ color: 'var(--text-tertiary)' }}>{bIdx === 0 ? '+ Check if...' : '+ Otherwise if...'}</div>
                            </div>
                            <div className="h-connector" style={{ marginTop: '39px' }}></div>
                          </div>
                        )
                      ) : null}

                      {/* ACTIONS */}
                      {(() => {
                        const isExpanded = branch.actions.length > 1 || actionPlaceholders[branch.id];

                        if (branch.actions.length === 0) {
                          return (
                            <div
                              className={`rule-node ${activePanel?.type === 'action' && activePanel?.branchId === branch.id && activePanel?.itemIndex === 0 ? 'selected' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setActivePanel({ type: 'action', branchId: branch.id, itemIndex: 0 }); setSearchQuery(''); }}
                            >
                              <div className="node-title" style={{ color: 'var(--text-tertiary)' }}>+ Do this...</div>
                            </div>
                          );
                        }

                        if (!isExpanded) {
                          return (
                            <div
                              className={`action-group-container single ${activePanel?.type === 'action' && activePanel?.branchId === branch.id && activePanel?.itemIndex === 0 ? 'selected' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setActivePanel({ type: 'action', branchId: branch.id, itemIndex: 0 }); setSearchQuery(''); }}
                            >
                              <button className="action-remove-btn" onClick={(e) => { e.stopPropagation(); removeNode('action', branch.id, 0); }}>×</button>
                              <div className="single-action-content">
                                <div className="action-label">Do this</div>
                                <div className="action-title">
                                  {getOptionMeta(branch.actions[0].type, 'action')?.label}
                                </div>
                                {renderValueInput('action', branch.actions[0].type, branch.actions[0].value, branch.id, 0)}
                              </div>
                              <div className="add-action-hover-btn" onClick={(e) => {
                                e.stopPropagation();
                                setActionPlaceholders(prev => ({ ...prev, [branch.id]: true }));
                                setActivePanel({ type: 'action', branchId: branch.id, itemIndex: branch.actions.length });
                                setSearchQuery('');
                              }}>+</div>
                            </div>
                          );
                        }

                        return (
                          <div className="action-group-container expanded">
                            {branch.actions.map((act, aIdx) => (
                              <div key={`a-${aIdx}`} className="action-item-wrapper">
                                <div className="action-label">{aIdx === 0 ? 'Do this' : 'And'}</div>
                                <div
                                  className={`action-item-box ${activePanel?.type === 'action' && activePanel?.branchId === branch.id && activePanel?.itemIndex === aIdx ? 'selected' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); setActivePanel({ type: 'action', branchId: branch.id, itemIndex: aIdx }); setSearchQuery(''); }}
                                >
                                  <button className="action-remove-btn" onClick={(e) => { e.stopPropagation(); removeNode('action', branch.id, aIdx); }}>×</button>
                                  <div style={{ flex: 1 }}>
                                    <div className="action-title">
                                      {getOptionMeta(act.type, 'action')?.label}
                                    </div>
                                    {renderValueInput('action', act.type, act.value, branch.id, aIdx)}
                                  </div>
                                </div>
                              </div>
                            ))}

                            {actionPlaceholders[branch.id] && (
                              <div className="action-item-wrapper">
                                <div className="action-label">And</div>
                                <div
                                  className={`action-item-box placeholder ${activePanel?.type === 'action' && activePanel?.branchId === branch.id && activePanel?.itemIndex === branch.actions.length ? 'selected' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); setActivePanel({ type: 'action', branchId: branch.id, itemIndex: branch.actions.length }); setSearchQuery(''); }}
                                >
                                  <div className="node-title" style={{ color: '#3b82f6', margin: 0 }}>+ Do this...</div>
                                </div>
                              </div>
                            )}
                            {!actionPlaceholders[branch.id] && (
                              <div className="add-action-hover-btn" onClick={(e) => {
                                e.stopPropagation();
                                setActionPlaceholders(prev => ({ ...prev, [branch.id]: true }));
                                setActivePanel({ type: 'action', branchId: branch.id, itemIndex: branch.actions.length });
                                setSearchQuery('');
                              }}>+</div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )
              })}

              {/* ADD BRANCH BUTTON */}
              {(ruleData.branches.length > 1 || (ruleData.branches[0].type !== 'otherwise' && ruleData.branches[0].conditions.length > 0)) && (
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', position: 'relative', zIndex: 2, height: '60px', marginTop: '-20px' }}>
                  {/* Dashed elbow line */}
                  <div style={{ position: 'absolute', left: '19px', top: '0', width: '20px', height: '27px', borderLeft: '2px dashed var(--border-color)', borderBottom: '2px dashed var(--border-color)', borderBottomLeftRadius: '8px' }}></div>
                  <div style={{ marginLeft: '40px', marginTop: '10px', position: 'relative' }}>
                    <button className="add-branch-btn" onClick={(e) => { e.stopPropagation(); setShowAddBranchMenu(!showAddBranchMenu); }} style={{ margin: 0 }}>+ Add branch</button>

                    {showAddBranchMenu && (
                      <div className="add-branch-menu" onClick={e => e.stopPropagation()}>
                        <div className="add-branch-menu-item" onClick={() => addBranch('condition')}>
                          <div className="menu-item-title">+ Otherwise if...</div>
                          <div className="menu-item-desc">Add another set of conditions and actions to this rule.</div>
                        </div>
                        {!ruleData.branches.some(b => b.type === 'otherwise') && (
                          <div className="add-branch-menu-item" onClick={() => addBranch('otherwise')}>
                            <div className="menu-item-title">+ Otherwise</div>
                            <div className="menu-item-desc">Add actions that will run if all other conditions are not met.</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Right Side Panel */}
        {activePanel && (
          <div className="side-panel" onClick={e => e.stopPropagation()}>
            <div className="side-panel-header">
              <h3>{activePanel.type === 'trigger' ? 'When...' : activePanel.type === 'condition' ? 'Check if...' : 'Do this...'}</h3>
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder={`Search ${activePanel.type}s`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="side-panel-tabs">
              <div className="panel-tab active">{activePanel.type === 'trigger' ? 'Triggers' : activePanel.type === 'condition' ? 'Conditions' : 'Actions'}</div>
            </div>

            <div className="side-panel-content">
              {getFilteredOptions(activePanel.type === 'trigger' ? TRIGGER_OPTIONS : activePanel.type === 'condition' ? CONDITION_OPTIONS : ACTION_OPTIONS).map(group => (
                <div key={group.group} className="option-group">
                  <div className="option-group-title">{group.group}</div>
                  {group.items.map(item => (
                    <div
                      key={item.id}
                      className="option-item"
                      onClick={() => {
                        if (['custom_field_is', 'custom_field_changed', 'change_custom_field'].includes(item.id) && item.fieldId) {
                          setNodeType(activePanel.type, activePanel.branchId, activePanel.itemIndex, item.id);
                          updateNodeData(activePanel.type, activePanel.branchId, activePanel.itemIndex, 'value', `${item.fieldId}:`);
                        } else {
                          setNodeType(activePanel.type, activePanel.branchId, activePanel.itemIndex, item.id);
                        }
                        setSearchQuery('');
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

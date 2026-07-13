import { useState, useEffect } from 'react';
import './RulesModal.css';

export default function RulesModal({ projectId, token, onClose, editRule = null }) {
  const [rules, setRules] = useState([]);
  const [triggerType, setTriggerType] = useState('task_completed');
  const [triggerValue, setTriggerValue] = useState('');
  const [actionType, setActionType] = useState('move_to_section');
  const [actionValue, setActionValue] = useState('');
  const [sections, setSections] = useState([]);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    fetchRules();
    fetchProjectData();
    if (editRule) {
      setTriggerType(editRule.triggerType || 'task_completed');
      setTriggerValue(editRule.triggerValue || '');
      setActionType(editRule.actionType || 'move_to_section');
      setActionValue(editRule.actionValue || '');
    }
  }, [editRule]);

  const fetchRules = async () => {
    try {
      const res = await fetch(`http://localhost:5001/api/projects/${projectId}/rules`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setRules(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProjectData = async () => {
    try {
      const res = await fetch(`http://localhost:5001/api/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const projects = await res.json();
      const currentProject = projects.find(p => p.id === projectId);
      if (currentProject) {
        if (currentProject.sections) {
          setSections(currentProject.sections);
        }
        if (currentProject.members) {
          const membersList = currentProject.members.map(m => m.user || m);
          setMembers(membersList);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
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
        fetchRules();
        if (editRule) {
          onClose(); // Automatically close if we were just editing
        }
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      const res = await fetch(`http://localhost:5001/api/projects/${projectId}/rules/${ruleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchRules();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="rules-modal-overlay" onClick={onClose}>
      <div className="rules-modal-content" onClick={e => e.stopPropagation()}>
        <div className="rules-modal-header">
          <h2>Project Rules</h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="rules-modal-body">
          <form onSubmit={handleCreateRule} className="rules-form">
            <h3>{editRule ? 'Edit rule' : 'Create a new rule'}</h3>
            
            <div className="rule-group">
              <label>When this happens:</label>
              <select value={triggerType} onChange={e => setTriggerType(e.target.value)}>
                <option value="task_completed">Task is marked complete</option>
                <option value="rule_run_manually">Rule is run manually</option>
                <option value="scheduled_time_occurs">Scheduled time occurs…</option>
                <option value="task_moved_general">Task moved</option>
                <option value="task_moved">Task is moved to a section</option>
                <option value="task_added_to_project">Task is added to this project</option>
                <option value="task_field_changed">Task field is changed</option>
                <option value="task_assigned">Task is assigned</option>
                <option value="task_type_changed">Task type is changed</option>
                <option value="task_name_changed">Task name is changed</option>
                <option value="task_description_changed">Task description is changed</option>
                <option value="due_date_is">Due date is…</option>
                <option value="due_date_changed">Due date is changed</option>
                <option value="due_date_approaching">Due date is approaching</option>
                <option value="task_overdue">Task is overdue</option>
                <option value="start_date_is">Start date is…</option>
                <option value="start_date_changed">Start date is changed</option>
                <option value="start_date_approaching">Start date is approaching</option>
                <option value="start_date_passed">Start date has passed</option>
                <option value="status_changed">Status is changed</option>
                <option value="approval_status_changed">Approval status is changed</option>
                <option value="task_no_longer_blocked">Task is no longer blocked</option>
                <option value="completion_status_changed">Task or all subtasks completion status is changed</option>
                <option value="custom_field_changed">Custom field is changed</option>
                <option value="added_to_task">Added to task</option>
                <option value="attachment_added">Attachment is added</option>
                <option value="comment_added">Comment is added</option>
                <option value="collaborator_added">Collaborator is added</option>
              </select>

              {triggerType === 'task_moved' && (
                <select value={triggerValue} onChange={e => setTriggerValue(e.target.value)}>
                  <option value="">Select section...</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>

            <div className="rule-group">
              <label>Do this:</label>
              <select value={actionType} onChange={e => setActionType(e.target.value)}>
                <optgroup label="Move task">
                  <option value="move_to_section">Move to a section…</option>
                  <option value="add_to_project">Move or add to project…</option>
                  <option value="remove_from_project">Remove task from the project</option>
                </optgroup>
                <optgroup label="Change status">
                  <option value="draft_update_ai">Draft an update with AI…</option>
                  <option value="mark_complete">Change completion status to…</option>
                  <option value="change_task_field">Change task field to…</option>
                  <option value="change_assignee">Change assignee to…</option>
                  <option value="change_due_date">Change due date to…</option>
                  <option value="set_task_name">Set task name to</option>
                  <option value="set_task_description">Set task description to</option>
                  <option value="change_custom_field">Change custom field to…</option>
                </optgroup>
                <optgroup label="Create new">
                  <option value="create_task">Create a task…</option>
                  <option value="create_subtasks">Create subtasks…</option>
                  <option value="create_approvals">Create approvals…</option>
                  <option value="convert_to">Convert task to…</option>
                  <option value="convert_to_project">Convert task to project</option>
                  <option value="set_task_type">Set task type to</option>
                </optgroup>
                <optgroup label="Add to task">
                  <option value="add_comment">Add comment</option>
                  <option value="add_collaborators">Add or remove collaborators</option>
                </optgroup>
              </select>

              {actionType === 'move_to_section' && (
                <select value={actionValue} onChange={e => setActionValue(e.target.value)}>
                  <option value="">Select section...</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}

              {actionType === 'mark_complete' && (
                <select value={actionValue} onChange={e => setActionValue(e.target.value)}>
                  <option value="">Select status...</option>
                  <option value="true">Complete</option>
                  <option value="false">Incomplete</option>
                </select>
              )}

              {(actionType === 'change_assignee' || actionType === 'add_collaborators') && (
                <select value={actionValue} onChange={e => setActionValue(e.target.value)}>
                  <option value="">Select user...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name || m.email}</option>
                  ))}
                </select>
              )}

              {actionType === 'set_task_type' && (
                <select value={actionValue} onChange={e => setActionValue(e.target.value)}>
                  <option value="">Select type...</option>
                  <option value="TASK">Task</option>
                  <option value="MILESTONE">Milestone</option>
                  <option value="APPROVAL">Approval</option>
                </select>
              )}

              {['draft_update_ai', 'change_task_field', 'change_due_date', 'set_task_name', 'set_task_description', 'change_custom_field', 'create_task', 'create_subtasks', 'create_approvals', 'convert_to', 'add_comment'].includes(actionType) && (
                <input 
                  type="text" 
                  value={actionValue} 
                  onChange={e => setActionValue(e.target.value)} 
                  placeholder={
                    actionType === 'change_due_date' ? '+Days (e.g. 3) or Date' :
                    actionType === 'create_subtasks' ? 'Subtask titles (comma separated)' :
                    actionType === 'add_comment' ? 'Comment text' :
                    'Enter value...'
                  }
                  className="rule-action-input"
                />
              )}
            </div>

            <div className="form-actions">
              <button type="submit" className="create-rule-btn">{editRule ? 'Update rule' : 'Create rule'}</button>
            </div>
          </form>

          {!editRule && (
            <div className="active-rules-section">
              <h3>Active Rules</h3>
              {rules.length === 0 ? (
                <p className="no-rules">No rules active for this project.</p>
              ) : (
                <ul className="rules-list">
                  {rules.map(rule => (
                    <li key={rule.id} className="rule-item">
                      <div>
                        <strong>When:</strong> {rule.triggerType} 
                        {rule.triggerValue && ` (${sections.find(s => s.id === rule.triggerValue)?.name || rule.triggerValue})`}
                        <br/>
                        <strong>Then:</strong> {rule.actionType} 
                        {rule.actionValue && ` (${sections.find(s => s.id === rule.actionValue)?.name || rule.actionValue})`}
                      </div>
                      <button onClick={() => handleDeleteRule(rule.id)} className="delete-rule-btn">Delete</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

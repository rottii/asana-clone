const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const evaluateRules = async (projectId, taskId, event) => {
  try {
    const rules = await prisma.rule.findMany({
      where: { projectId, isActive: true }
    });

    for (const rule of rules) {
      if (!rule.ruleData || !rule.ruleData.trigger) continue;

      const trigger = rule.ruleData.trigger;
      let triggered = checkTrigger(trigger, event);

      if (triggered) {
        const branches = rule.ruleData.branches || [];
        
        // If there are no branches, maybe actions are at root level (for backwards compatibility/simplicity)
        if (branches.length === 0 && rule.ruleData.actions) {
           for (const action of rule.ruleData.actions) {
             await executeAction(action.type, action.value, taskId, projectId);
           }
           continue;
        }

        // Evaluate branches sequentially
        for (const branch of branches) {
          const conditions = branch.conditions || [];
          let conditionsMet = true;

          if (conditions.length > 0) {
            conditionsMet = await checkConditions(conditions, taskId, projectId);
          }

          if (conditionsMet) {
            const actions = branch.actions || [];
            for (const action of actions) {
              await executeAction(action.type, action.value, taskId, projectId);
            }
            // Branch executed, stop evaluating other branches (assuming mutually exclusive "Otherwise if" logic)
            break;
          }
        }
      }
    }
  } catch (err) {
    console.error('Rule Engine Error:', err);
  }
};

const checkTrigger = (trigger, event) => {
  const exactMatchTriggers = [
    'rule_run_manually', 'scheduled_time_occurs', 
    'task_added_to_project', 'task_assigned', 
    'task_type_changed', 'task_name_changed', 'task_description_changed', 
    'due_date_changed', 'due_date_approaching', 
    'task_overdue', 'start_date_changed', 
    'start_date_approaching', 'start_date_passed', 'status_changed', 
    'approval_status_changed', 'task_no_longer_blocked', 
    'completion_status_changed', 'custom_field_changed', 
    'attachment_added', 'comment_added', 'collaborator_added'
  ];

  if (exactMatchTriggers.includes(trigger.type) && event.type === trigger.type) {
    if (trigger.type === 'custom_field_changed') {
        if (!trigger.value || trigger.value === event.fieldName) {
            return true;
        }
    } else {
        return true;
    }
  } else if (trigger.type === 'task_moved' && (event.type === 'task_moved' || event.type === 'task_moved_general')) {
    if (trigger.value === event.targetSectionId) {
      return true;
    }
  }
  return false;
};

const checkConditions = async (conditions, taskId, projectId) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        attachments: true,
        comments: true,
        subtasks: true,
        secondaryProjects: true,
        blockedBy: {
          include: {
            blockingTask: true
          }
        }
      }
    });

    if (!task) return false;

    for (const condition of conditions) {
      switch(condition.type) {
        case 'task_in_section':
          if (task.sectionId !== condition.value) return false;
          break;
        case 'task_added_by_form':
        case 'task_added_by_email':
          // We don't have source tracking yet, return false for now or true if ignored
          break;
        case 'assignee_is':
          if (task.assigneeId !== condition.value) return false;
          break;
        case 'task_creator_is':
          if (task.creatorId !== condition.value) return false;
          break;
        case 'task_name_is':
          if (task.title !== condition.value) return false;
          break;
        case 'task_description_is':
          const plainDesc = (task.description || '').replace(/<[^>]*>?/gm, '').toLowerCase();
          const searchVal = (condition.value || '').toLowerCase();
          if (!plainDesc.includes(searchVal)) return false;
          break;
        case 'due_date_is':
        case 'start_date_is': {
          const dateField = condition.type === 'due_date_is' ? task.dueDate : task.startDate;
          let dateConfig;
          try {
             dateConfig = JSON.parse(condition.value);
          } catch (e) {
             // Fallback for backwards compatibility with old simple date matches
             if (!dateField || new Date(dateField).toDateString() !== new Date(condition.value).toDateString()) return false;
             break;
          }

          if (dateConfig.op === 'empty') {
            if (dateField) return false;
          } else if (dateConfig.op === 'not_empty') {
            if (!dateField) return false;
          } else if (dateConfig.op === 'before') {
            if (!dateField || !dateConfig.date1 || new Date(dateField) >= new Date(dateConfig.date1)) return false;
          } else if (dateConfig.op === 'after') {
            if (!dateField || !dateConfig.date1 || new Date(dateField) <= new Date(dateConfig.date1)) return false;
          } else if (dateConfig.op === 'between') {
            if (!dateField || !dateConfig.date1 || !dateConfig.date2) return false;
            const taskDate = new Date(dateField).getTime();
            const start = new Date(dateConfig.date1).getTime();
            const end = new Date(dateConfig.date2).getTime();
            // inclusive range
            if (taskDate < start || taskDate > end) return false;
          }
          break;
        }
        case 'task_type_is':
          if (task.type !== condition.value) return false;
          break;
        case 'completion_status_is':
          if (condition.value === 'completed' && !task.isCompleted) return false;
          if (condition.value === 'incomplete' && task.isCompleted) return false;
          break;
        case 'approval_status_is':
          if (task.approvalStatus !== condition.value) return false;
          break;
        case 'task_no_longer_blocked':
          if (task.blockedBy && task.blockedBy.some(dep => !dep.blockingTask.isCompleted)) return false;
          break;
        case 'task_in_projects':
          const inPrimary = task.section?.projectId === condition.value;
          const inSecondary = task.secondaryProjects?.some(sp => sp.projectId === condition.value);
          if (!inPrimary && !inSecondary) return false;
          break;
        case 'custom_field_is':
          const [fieldId, fieldValue] = condition.value.split(':');
          let cfMatched = false;
          if (fieldId === 'Priority') {
             cfMatched = task.priority === fieldValue;
          } else {
             try {
               let parsed = JSON.parse(task.customFields || '{}');
               if (Array.isArray(parsed)) {
                  cfMatched = parsed.some(cf => cf.id === fieldId && cf.value === fieldValue);
               } else {
                  cfMatched = parsed[fieldId] === fieldValue;
               }
             } catch(e) {}
          }
          if (!cfMatched) return false;
          break;
        case 'task_has_attachment':
          if (!task.attachments || task.attachments.length === 0) return false;
          break;
        case 'task_has_comment':
          if (!task.comments || task.comments.length === 0) return false;
          break;
      }
    }
    return true;
  } catch (err) {
    console.error('Condition Evaluation Error:', err);
    return false;
  }
};

const executeAction = async (actionType, actionValue, taskId, projectId) => {
  try {
    if (actionType === 'move_to_section' && actionValue) {
      const maxOrderTask = await prisma.task.findFirst({
        where: { sectionId: actionValue, parentId: null },
        orderBy: { order: 'desc' }
      });
      const newOrder = maxOrderTask ? maxOrderTask.order + 1 : 0;
      await prisma.task.update({ where: { id: taskId }, data: { sectionId: actionValue, order: newOrder } });
    } else if (actionType === 'mark_complete') {
      const isCompleted = actionValue === 'true';
      await prisma.task.update({ where: { id: taskId }, data: { isCompleted, completedAt: isCompleted ? new Date() : null } });
    } else if (actionType === 'change_assignee' && actionValue) {
      await prisma.task.update({ where: { id: taskId }, data: { assigneeId: actionValue } });
      await prisma.taskCollaborator.upsert({
        where: { taskId_userId: { taskId: taskId, userId: actionValue } },
        update: {},
        create: { taskId: taskId, userId: actionValue }
      });
    } else if (actionType === 'set_task_name' && actionValue) {
      await prisma.task.update({ where: { id: taskId }, data: { title: actionValue } });
    } else if (actionType === 'set_task_description' && actionValue) {
      await prisma.task.update({ where: { id: taskId }, data: { description: actionValue } });
    } else if (actionType === 'set_task_type' && actionValue) {
      await prisma.task.update({ where: { id: taskId }, data: { type: actionValue } });
    } else if (actionType === 'change_due_date' && actionValue) {
      let newDate = new Date();
      const daysMatch = actionValue.match(/\+(\d+)/);
      if (daysMatch) {
        newDate.setDate(newDate.getDate() + parseInt(daysMatch[1]));
      } else {
        newDate = new Date(actionValue);
      }
      if (!isNaN(newDate.getTime())) {
        await prisma.task.update({ where: { id: taskId }, data: { dueDate: newDate } });
      }
    } else if (actionType === 'create_task' && actionValue) {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (task) {
        const maxOrderTask = await prisma.task.findFirst({ where: { sectionId: task.sectionId }, orderBy: { order: 'desc' } });
        await prisma.task.create({
          data: { title: actionValue, sectionId: task.sectionId, creatorId: task.creatorId, order: maxOrderTask ? maxOrderTask.order + 1 : 0 }
        });
      }
    } else if (actionType === 'create_subtasks' && actionValue) {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (task) {
        const titles = actionValue.split(',').map(t => t.trim()).filter(Boolean);
        for (let i = 0; i < titles.length; i++) {
          await prisma.task.create({
            data: { title: titles[i], sectionId: task.sectionId, creatorId: task.creatorId, parentId: taskId, order: i }
          });
        }
      }
    } else if (actionType === 'add_comment' && actionValue) {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (task) {
        await prisma.comment.create({
           data: { text: actionValue, taskId: taskId, userId: task.creatorId }
        });
      }
    } else if (actionType === 'add_collaborators' && actionValue) {
      const userIds = actionValue.split(',').map(id => id.trim()).filter(Boolean);
      for (const uid of userIds) {
        await prisma.taskCollaborator.create({
          data: { taskId: taskId, userId: uid }
        }).catch(() => {}); // ignore unique constraint errors
      }
      await evaluateRules(projectId, taskId, { type: 'collaborator_added' });
    } else if (actionType === 'remove_collaborators' && actionValue) {
      const userIds = actionValue.split(',').map(id => id.trim()).filter(Boolean);
      for (const uid of userIds) {
        await prisma.taskCollaborator.deleteMany({
          where: { taskId: taskId, userId: uid }
        });
      }
    } else if ((actionType === 'add_to_project' || actionType === 'move_to_project') && actionValue) {
      // format: "projectId" OR "projectId:sectionId"
      const [targetProjectId, targetSectionId] = actionValue.split(':');
      let sectionIdToUse = targetSectionId;
      if (!sectionIdToUse) {
        const section = await prisma.section.findFirst({ where: { projectId: targetProjectId }, orderBy: { order: 'asc' } });
        sectionIdToUse = section?.id;
      }
      
      if (sectionIdToUse) {
         if (actionType === 'move_to_project') {
           // Remove from current project and move to new project
           const task = await prisma.task.findUnique({ where: { id: taskId }, select: { sectionId: true, section: { select: { projectId: true } } } });
           if (task && task.section.projectId === projectId) {
             await prisma.task.update({ where: { id: taskId }, data: { sectionId: sectionIdToUse } });
           } else {
             await prisma.taskProject.deleteMany({ where: { taskId: taskId, projectId: projectId } });
             await prisma.taskProject.create({
               data: { taskId: taskId, projectId: targetProjectId, sectionId: sectionIdToUse, order: 0 }
             }).catch(() => {});
           }
         } else {
           await prisma.taskProject.create({
             data: { taskId: taskId, projectId: targetProjectId, sectionId: sectionIdToUse, order: 0 }
           }).catch(() => {});
         }
      }
    } else if (actionType === 'remove_from_project') {
      const task = await prisma.task.findUnique({ where: { id: taskId }, include: { section: true } });
      if (task && task.section.projectId === projectId) {
        const secondary = await prisma.taskProject.findFirst({ where: { taskId: taskId } });
        if (secondary) {
          // Make the first secondary project the primary project
          await prisma.task.update({ where: { id: taskId }, data: { sectionId: secondary.sectionId } });
          await prisma.taskProject.delete({ where: { id: secondary.id } });
        } else {
          // It's the only project, so delete the task
          await prisma.task.delete({ where: { id: taskId } });
        }
      } else {
        await prisma.taskProject.deleteMany({
          where: { taskId: taskId, projectId: projectId }
        });
      }
    } else if (actionType === 'create_approvals' && actionValue) {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (task) {
        const titles = actionValue.split(',').map(t => t.trim()).filter(Boolean);
        for (let i = 0; i < titles.length; i++) {
          await prisma.task.create({
            data: { title: titles[i], sectionId: task.sectionId, creatorId: task.creatorId, parentId: taskId, order: i, type: 'APPROVAL', approvalStatus: 'PENDING' }
          });
        }
      }
    } else if (actionType === 'convert_to_project') {
      const task = await prisma.task.findUnique({ where: { id: taskId }, include: { section: { include: { project: true } } } });
      if (task) {
        const newProject = await prisma.project.create({
          data: {
            name: task.title,
            ownerId: task.creatorId,
            workspaceId: task.section?.project?.workspaceId || null,
            sections: {
              create: [{ name: 'To Do', order: 0 }, { name: 'In Progress', order: 1 }, { name: 'Done', order: 2 }]
            }
          }
        });
        await prisma.task.update({ where: { id: taskId }, data: { isCompleted: true } });
        await prisma.taskActivity.create({
          data: { action: `converted this task to a project: ${newProject.name}`, taskId: taskId, userId: task.creatorId }
        });

        if (global.io && task.creatorId) {
          global.io.to(task.creatorId).emit('project_created', newProject);
        }
      }
    } else if (actionType === 'change_custom_field' && actionValue) {
      const [fieldId, fieldValue] = actionValue.split(':');
      if (fieldId && fieldValue) {
        if (fieldId === 'Priority') {
          await prisma.task.update({ where: { id: taskId }, data: { priority: fieldValue } });
        } else {
          const task = await prisma.task.findUnique({ where: { id: taskId } });
          if (task) {
            let customFields = {};
            try { 
              if (task.customFields) {
                const parsed = JSON.parse(task.customFields); 
                if (Array.isArray(parsed)) {
                  parsed.forEach(cf => { if (cf.id && cf.value) customFields[cf.id] = cf.value; });
                } else if (typeof parsed === 'object' && parsed !== null) {
                  customFields = parsed;
                }
              }
            } catch(e) {}
            
            customFields[fieldId] = fieldValue;
            
            await prisma.task.update({ where: { id: taskId }, data: { customFields: JSON.stringify(customFields) } });
          }
        }
      }
    }
    console.log(`[Rule Engine] Task ${taskId} executed action ${actionType}`);
  } catch (actionErr) {
    console.error(`[Rule Engine] Failed to execute action ${actionType} for task ${taskId}:`, actionErr);
  }
};

module.exports = { evaluateRules };

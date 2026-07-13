const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const evaluateRules = async (projectId, taskId, event) => {
  try {
    const rules = await prisma.rule.findMany({
      where: { projectId }
    });

    for (const rule of rules) {
      let triggered = false;

      // 1. Exact Match triggers (where event.type matches triggerType exactly)
      const exactMatchTriggers = [
        'task_completed', 'rule_run_manually', 'scheduled_time_occurs', 
        'task_added_to_project', 'task_field_changed', 'task_assigned', 
        'task_type_changed', 'task_name_changed', 'task_description_changed', 
        'due_date_is', 'due_date_changed', 'due_date_approaching', 
        'task_overdue', 'start_date_is', 'start_date_changed', 
        'start_date_approaching', 'start_date_passed', 'status_changed', 
        'approval_status_changed', 'task_no_longer_blocked', 
        'completion_status_changed', 'custom_field_changed', 
        'added_to_task', 'attachment_added', 'comment_added', 'collaborator_added',
        'task_moved_general'
      ];

      if (exactMatchTriggers.includes(rule.triggerType) && event.type === rule.triggerType) {
        triggered = true;
      } 
      // 2. Specific Section Move
      else if (rule.triggerType === 'task_moved' && (event.type === 'task_moved' || event.type === 'task_moved_general')) {
        if (rule.triggerValue === event.targetSectionId) {
          triggered = true;
        }
      }

      if (triggered) {
        try {
          if (rule.actionType === 'move_to_section' && rule.actionValue) {
            await prisma.task.update({ where: { id: taskId }, data: { sectionId: rule.actionValue } });
          } else if (rule.actionType === 'mark_complete') {
            const isCompleted = rule.actionValue === 'true';
            await prisma.task.update({ where: { id: taskId }, data: { isCompleted, completedAt: isCompleted ? new Date() : null } });
          } else if (rule.actionType === 'change_assignee' && rule.actionValue) {
            await prisma.task.update({ where: { id: taskId }, data: { assigneeId: rule.actionValue } });
          } else if (rule.actionType === 'set_task_name' && rule.actionValue) {
            await prisma.task.update({ where: { id: taskId }, data: { title: rule.actionValue } });
          } else if (rule.actionType === 'set_task_description' && rule.actionValue) {
            await prisma.task.update({ where: { id: taskId }, data: { description: rule.actionValue } });
          } else if (rule.actionType === 'set_task_type' && rule.actionValue) {
            await prisma.task.update({ where: { id: taskId }, data: { type: rule.actionValue } });
          } else if (rule.actionType === 'change_due_date' && rule.actionValue) {
            let newDate = new Date();
            const daysMatch = rule.actionValue.match(/\+(\d+)/);
            if (daysMatch) {
              newDate.setDate(newDate.getDate() + parseInt(daysMatch[1]));
            } else {
              newDate = new Date(rule.actionValue);
            }
            if (!isNaN(newDate.getTime())) {
              await prisma.task.update({ where: { id: taskId }, data: { dueDate: newDate } });
            }
          } else if (rule.actionType === 'create_task' && rule.actionValue) {
            const task = await prisma.task.findUnique({ where: { id: taskId } });
            if (task) {
              const maxOrderTask = await prisma.task.findFirst({ where: { sectionId: task.sectionId }, orderBy: { order: 'desc' } });
              await prisma.task.create({
                data: { title: rule.actionValue, sectionId: task.sectionId, creatorId: task.creatorId, order: maxOrderTask ? maxOrderTask.order + 1 : 0 }
              });
            }
          } else if (rule.actionType === 'create_subtasks' && rule.actionValue) {
            const task = await prisma.task.findUnique({ where: { id: taskId } });
            if (task) {
              const titles = rule.actionValue.split(',').map(t => t.trim()).filter(Boolean);
              for (let i = 0; i < titles.length; i++) {
                await prisma.task.create({
                  data: { title: titles[i], sectionId: task.sectionId, creatorId: task.creatorId, parentId: taskId, order: i }
                });
              }
            }
          } else if (rule.actionType === 'add_comment' && rule.actionValue) {
            const task = await prisma.task.findUnique({ where: { id: taskId } });
            if (task) {
              await prisma.comment.create({
                 data: { text: rule.actionValue, taskId: taskId, userId: task.creatorId }
              });
            }
          } else if (rule.actionType === 'add_collaborators' && rule.actionValue) {
            await prisma.taskCollaborator.create({
              data: { taskId: taskId, userId: rule.actionValue }
            }).catch(() => {}); // ignore unique constraint errors
          }
          console.log(`[Rule Engine] Task ${taskId} executed action ${rule.actionType} via rule ${rule.triggerType}`);
        } catch (actionErr) {
          console.error(`[Rule Engine] Failed to execute action ${rule.actionType} for task ${taskId}:`, actionErr);
        }
      }
    }
  } catch (err) {
    console.error('Rule Engine Error:', err);
  }
};

module.exports = { evaluateRules };

const { PrismaClient } = require('@prisma/client');
const { evaluateRules } = require('./ruleEngine');
const prisma = new PrismaClient();

const startCronScheduler = () => {
  // Check every 1 minute for time-based triggers
  setInterval(async () => {
    try {
      const now = new Date();
      now.setHours(0,0,0,0);
      
      const tasks = await prisma.task.findMany({
        where: { isCompleted: false },
        include: { section: true }
      });

      for (const task of tasks) {
        if (!task.section) continue;
        const projectId = task.section.projectId;

        // Due date checks
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          dueDate.setHours(0,0,0,0);
          
          const diffDays = Math.round((dueDate - now) / 86400000);
          
          if (diffDays === 0) {
            await evaluateRules(projectId, task.id, { type: 'due_date_is' });
            await evaluateRules(projectId, task.id, { type: 'due_date_approaching' });
          } else if (diffDays < 0) {
            await evaluateRules(projectId, task.id, { type: 'task_overdue' });
          } else if (diffDays <= 3) {
            await evaluateRules(projectId, task.id, { type: 'due_date_approaching' });
          }
        }

        // Start date checks
        if (task.startDate) {
          const startDate = new Date(task.startDate);
          startDate.setHours(0,0,0,0);
          
          const diffDays = Math.round((startDate - now) / 86400000);
          
          if (diffDays === 0) {
            await evaluateRules(projectId, task.id, { type: 'start_date_is' });
            await evaluateRules(projectId, task.id, { type: 'start_date_approaching' });
          } else if (diffDays < 0) {
            await evaluateRules(projectId, task.id, { type: 'start_date_passed' });
          } else if (diffDays <= 3) {
            await evaluateRules(projectId, task.id, { type: 'start_date_approaching' });
          }
        }
        
        // Scheduled time occurs (every day check)
        await evaluateRules(projectId, task.id, { type: 'scheduled_time_occurs' });
      }
    } catch (err) {
      console.error('Cron Scheduler Error:', err);
    }
  }, 60 * 1000); // Run every 60 seconds
  console.log('[Cron Scheduler] Started');
};

module.exports = { startCronScheduler };

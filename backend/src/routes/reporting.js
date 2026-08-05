const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const router = express.Router();
const prisma = new PrismaClient();
const { JWT_SECRET } = require('../config/env');

// 1. ARA KATMAN: Giriş Kontrolü
const { authenticateToken } = require('../middleware/auth');

// GET /api/reporting/global
// Get high-level metrics for all tasks across user's projects
router.get('/global', authenticateToken, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        section: {
          project: {
            OR: [
              { ownerId: req.user.userId },
              { members: { some: { userId: req.user.userId } } }
            ]
          }
        }
      },
      include: {
        assignee: true,
        section: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                customFieldSettings: true
              }
            }
          }
        }
      }
    });

    const metrics = {
      totalTasks: tasks.length,
      completedTasks: 0,
      incompleteTasks: 0,
      overdueTasks: 0,
      tasksByProject: {},
      tasksByAssignee: {}
    };

    const now = new Date().getTime();

    tasks.forEach(task => {
      // Basic metrics
      if (task.isCompleted) {
        metrics.completedTasks++;
      } else {
        metrics.incompleteTasks++;
        // Check if overdue
        if (task.dueDate && new Date(task.dueDate).getTime() < now) {
          metrics.overdueTasks++;
        }
      }

      // Project metrics
      const proj = task.section?.project;
      if (proj) {
        if (!metrics.tasksByProject[proj.name]) {
          metrics.tasksByProject[proj.name] = { total: 0, completed: 0 };
        }
        metrics.tasksByProject[proj.name].total++;
        if (task.isCompleted) {
          metrics.tasksByProject[proj.name].completed++;
        }
      }

      // Assignee metrics
      const assigneeName = task.assignee?.name || 'Unassigned';
      if (!metrics.tasksByAssignee[assigneeName]) {
        metrics.tasksByAssignee[assigneeName] = { total: 0, completed: 0 };
      }
      metrics.tasksByAssignee[assigneeName].total++;
      if (task.isCompleted) {
        metrics.tasksByAssignee[assigneeName].completed++;
      }
    });

    // Formatting objects into arrays for charting convenience on frontend
    const projectStats = Object.keys(metrics.tasksByProject).map(name => ({
      name,
      total: metrics.tasksByProject[name].total,
      completed: metrics.tasksByProject[name].completed,
      incomplete: metrics.tasksByProject[name].total - metrics.tasksByProject[name].completed
    })).sort((a, b) => b.total - a.total).slice(0, 10); // top 10 projects

    const assigneeStats = Object.keys(metrics.tasksByAssignee).map(name => ({
      name,
      total: metrics.tasksByAssignee[name].total,
      completed: metrics.tasksByAssignee[name].completed
    })).sort((a, b) => b.total - a.total).slice(0, 10);

    res.json({
      totalTasks: metrics.totalTasks,
      completedTasks: metrics.completedTasks,
      incompleteTasks: metrics.incompleteTasks,
      overdueTasks: metrics.overdueTasks,
      projectStats,
      assigneeStats
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

module.exports = router;

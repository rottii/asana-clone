const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'asana_gizli_anahtar_123';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token.' });
    req.user = user;
    next();
  });
};

const prisma = new PrismaClient();

// Get all goals for the workspace
router.get('/', authenticateToken, async (req, res) => {
  try {
    const goals = await prisma.goal.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true } },
        projects: {
          include: {
            project: { select: { id: true, name: true, status: true, isArchived: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(goals);
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// Create a new goal
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, timePeriod, status, metricType, currentValue, targetValue, level } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Goal title is required' });
    }

    const newGoal = await prisma.goal.create({
      data: {
        title,
        description: description || null,
        timePeriod: timePeriod || null,
        status: status || 'On track',
        metricType: metricType || 'Percentage',
        currentValue: currentValue !== undefined ? Number(currentValue) : 0,
        targetValue: targetValue !== undefined ? Number(targetValue) : 100,
        level: level || 'Company',
        ownerId: req.user.userId
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        projects: { include: { project: true } }
      }
    });

    res.status(201).json(newGoal);
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// Update a goal
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, timePeriod, status, metricType, currentValue, targetValue, level } = req.body;

    const updatedGoal = await prisma.goal.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        description: description !== undefined ? description : undefined,
        timePeriod: timePeriod !== undefined ? timePeriod : undefined,
        status: status !== undefined ? status : undefined,
        metricType: metricType !== undefined ? metricType : undefined,
        currentValue: currentValue !== undefined ? Number(currentValue) : undefined,
        targetValue: targetValue !== undefined ? Number(targetValue) : undefined,
        level: level !== undefined ? level : undefined
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        projects: {
          include: {
            project: { select: { id: true, name: true, status: true, isArchived: true } }
          }
        }
      }
    });

    res.json(updatedGoal);
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// Delete a goal
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Sadece owner silebilir mi? Şimdilik evet yapalım
    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    if (goal.ownerId !== req.user.userId) {
      return res.status(403).json({ error: 'Sadece hedef sahibi silebilir.' });
    }

    await prisma.goal.delete({ where: { id } });
    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// Link a project to a goal
router.post('/:id/projects', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { projectId } = req.body;

    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const goalProject = await prisma.goalProject.create({
      data: {
        goalId: id,
        projectId
      }
    });

    const updatedGoal = await prisma.goal.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        projects: {
          include: {
            project: { select: { id: true, name: true, status: true, isArchived: true } }
          }
        }
      }
    });

    res.status(201).json(updatedGoal);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'This project is already linked to the goal.' });
    console.error('Error linking project to goal:', error);
    res.status(500).json({ error: 'Failed to link project' });
  }
});

// Unlink a project from a goal
router.delete('/:id/projects/:projectId', authenticateToken, async (req, res) => {
  try {
    const { id, projectId } = req.params;

    const goalProject = await prisma.goalProject.findUnique({
      where: { goalId_projectId: { goalId: id, projectId } }
    });

    if (!goalProject) return res.status(404).json({ error: 'Link not found' });

    await prisma.goalProject.delete({
      where: { goalId_projectId: { goalId: id, projectId } }
    });

    const updatedGoal = await prisma.goal.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        projects: {
          include: {
            project: { select: { id: true, name: true, status: true, isArchived: true } }
          }
        }
      }
    });

    res.json(updatedGoal);
  } catch (error) {
    console.error('Error unlinking project from goal:', error);
    res.status(500).json({ error: 'Failed to unlink project' });
  }
});

module.exports = router;

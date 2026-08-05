const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();

// Default widget layout
const DEFAULT_LAYOUT = [
  { id: 'my-tasks', type: 'my-tasks', col: 0, row: 0, colSpan: 1, rowSpan: 1 },
  { id: 'projects', type: 'projects', col: 1, row: 0, colSpan: 1, rowSpan: 1 },
  { id: 'assigned-tasks', type: 'assigned-tasks', col: 0, row: 1, colSpan: 1, rowSpan: 1 },
  { id: 'people', type: 'people', col: 1, row: 1, colSpan: 1, rowSpan: 1 },
];

// GET /api/dashboard - Get user's dashboard layout
router.get('/', authenticateToken, async (req, res) => {
  try {
    const existing = await prisma.dashboardLayout.findUnique({
      where: { userId: req.user.userId }
    });

    if (existing) {
      res.json({ layout: existing.layout, notepad: existing.notepad || '' });
    } else {
      res.json({ layout: DEFAULT_LAYOUT, notepad: '' });
    }
  } catch (error) {
    console.error('Error fetching dashboard layout:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard layout' });
  }
});

// PUT /api/dashboard - Save user's dashboard layout
router.put('/', authenticateToken, async (req, res) => {
  try {
    const { layout, notepad } = req.body;

    const data = {};
    if (layout !== undefined) data.layout = layout;
    if (notepad !== undefined) data.notepad = notepad;

    const result = await prisma.dashboardLayout.upsert({
      where: { userId: req.user.userId },
      update: data,
      create: {
        userId: req.user.userId,
        layout: layout || DEFAULT_LAYOUT,
        notepad: notepad || '',
      }
    });

    res.json({ layout: result.layout, notepad: result.notepad || '' });
  } catch (error) {
    console.error('Error saving dashboard layout:', error);
    res.status(500).json({ error: 'Failed to save dashboard layout' });
  }
});

module.exports = router;

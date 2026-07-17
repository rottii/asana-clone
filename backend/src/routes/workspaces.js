const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const router = express.Router();
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

// Get workspaces for the current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: req.user.userId
          }
        }
      },
      include: {
        teams: {
          include: {
            members: {
              include: { user: true }
            },
            projects: true
          }
        }
      }
    });
    res.json(workspaces);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching workspaces' });
  }
});

// Create a workspace
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const workspace = await prisma.workspace.create({
      data: {
        name: name || 'My Workspace',
        members: {
          create: {
            userId: req.user.userId,
            role: 'ADMIN'
          }
        },
        teams: {
          create: {
            name: 'Work',
            description: 'Default team',
            members: {
              create: {
                userId: req.user.userId,
                role: 'ADMIN'
              }
            }
          }
        }
      }
    });
    res.json(workspace);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error creating workspace' });
  }
});

// Create a team within a workspace
router.post('/:workspaceId/teams', authenticateToken, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, description } = req.body;

    // Verify workspace access
    const isMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: req.user.id }
    });

    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const team = await prisma.team.create({
      data: {
        name,
        description,
        workspaceId,
        members: {
          create: {
            userId: req.user.id,
            role: 'ADMIN'
          }
        }
      }
    });
    
    res.json(team);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error creating team' });
  }
});

module.exports = router;

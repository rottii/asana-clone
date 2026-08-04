const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'asana_gizli_anahtar_123';

const { authenticateToken } = require('../middleware/auth');

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
        members: true,
        teams: {
          include: {
            members: {
              include: { user: true }
            },
            projects: {
              include: {
                members: true
              }
            }
          }
        }
      }
    });

    // Filter data for GUEST users
    const filteredWorkspaces = workspaces.map(workspace => {
      const userMember = workspace.members.find(m => m.userId === req.user.userId);
      if (userMember && userMember.role === 'GUEST') {
        // Guests only see teams they are explicitly members of
        workspace.teams = workspace.teams.filter(team => 
          team.members.some(m => m.userId === req.user.userId)
        );
        // Guests only see projects they are explicitly members of
        workspace.teams.forEach(team => {
          team.projects = team.projects.filter(project => 
            project.members.some(m => m.userId === req.user.userId)
          );
        });
      }
      return workspace;
    });

    res.json(filteredWorkspaces);
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

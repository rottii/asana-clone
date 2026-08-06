const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { JWT_SECRET } = require('../config/env');

const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();

// TEMP FIX ROUTE
router.get('/fix-permissions', async (req, res) => {
  try {
    const workspaces = await prisma.workspace.findMany({ include: { members: true } });
    let count = 0;
    for (const w of workspaces) {
      for (const m of w.members) {
        if (m.role !== 'ADMIN') {
          await prisma.workspaceMember.update({
            where: { id: m.id },
            data: { role: 'ADMIN' }
          });
          count++;
        }
      }
    }
    res.json({ message: `Fixed permissions for ${count} users. You are now an ADMIN.` });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

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
            project.members.some(m => m.userId === req.user.userId) || project.ownerId === req.user.userId
          );
        });
      } else {
        // Normal members cannot see private projects unless they are explicitly members or the owner
        workspace.teams.forEach(team => {
          team.projects = team.projects.filter(project => 
            !project.isPrivate || project.members.some(m => m.userId === req.user.userId) || project.ownerId === req.user.userId
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

    // Verify workspace access — must be ADMIN to create teams
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: req.user.userId }
    });

    if (!member) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    if (member.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Sadece çalışma alanı yöneticisi takım oluşturabilir.' });
    }

    const team = await prisma.team.create({
      data: {
        name,
        description,
        workspaceId,
        members: {
          create: {
            userId: req.user.userId,
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

// Get workspace members
router.get('/:workspaceId/members', authenticateToken, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    
    // Check if requester is an ADMIN
    const requester = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: req.user.userId }
    });
    
    if (!requester || requester.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can view workspace members.' });
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(members);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching members' });
  }
});

// Update member role
router.patch('/:workspaceId/members/:userId', authenticateToken, async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;
    const { role } = req.body;
    
    const requester = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: req.user.userId }
    });
    
    if (!requester || requester.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can modify member roles.' });
    }

    const targetMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId }
    });

    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    if (req.user.userId === userId) {
      return res.status(400).json({ error: 'You cannot change your own role.' });
    }

    if (targetMember.role === 'ADMIN' && targetMember.createdAt < requester.createdAt) {
      return res.status(403).json({ error: 'You cannot modify the role of an admin who joined before you.' });
    }

    const updatedMember = await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    
    res.json(updatedMember);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error updating member' });
  }
});

// Remove a member (kick)
router.delete('/:workspaceId/members/:userId', authenticateToken, async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;
    
    const requester = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: req.user.userId }
    });
    
    // If removing themselves, allow it. Otherwise, enforce ADMIN rules.
    const isSelfRemoval = (req.user.userId === userId);

    if (!isSelfRemoval) {
      if (!requester || requester.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can remove other members.' });
      }

      const targetMember = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId }
      });

      if (!targetMember) {
        return res.status(404).json({ error: 'Member not found.' });
      }

      if (targetMember.role === 'ADMIN' && targetMember.createdAt < requester.createdAt) {
        return res.status(403).json({ error: 'You cannot remove an admin who joined before you.' });
      }
    }

    // 1. Delete from Workspace
    await prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } }
    });

    // 2. Cascade delete from projects in this workspace
    const projects = await prisma.project.findMany({ where: { workspaceId }, select: { id: true } });
    const projectIds = projects.map(p => p.id);
    
    if (projectIds.length > 0) {
      await prisma.projectMembership.deleteMany({
        where: { userId, projectId: { in: projectIds } }
      });
      
      // Unassign tasks from this user in these projects
      await prisma.task.updateMany({
        where: { assigneeId: userId, section: { projectId: { in: projectIds } } },
        data: { assigneeId: null }
      });
    }
    
    // 3. Cascade delete from teams in this workspace
    const teams = await prisma.team.findMany({ where: { workspaceId }, select: { id: true } });
    const teamIds = teams.map(t => t.id);
    if (teamIds.length > 0) {
      await prisma.teamMember.deleteMany({
        where: { userId, teamId: { in: teamIds } }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error removing member' });
  }
});

// Delete a workspace
router.delete('/:workspaceId', authenticateToken, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    
    // Check if requester is an ADMIN
    const requester = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: req.user.userId }
    });
    
    if (!requester || requester.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can delete a workspace.' });
    }

    // Check if there is an older admin
    const olderAdmin = await prisma.workspaceMember.findFirst({
      where: { 
        workspaceId, 
        role: 'ADMIN',
        createdAt: { lt: requester.createdAt }
      }
    });

    if (olderAdmin) {
      return res.status(403).json({ error: 'Only the original workspace creator can delete the workspace.' });
    }

    // Delete the workspace. Prisma's cascade deletes will handle all related data.
    await prisma.workspace.delete({
      where: { id: workspaceId }
    });

    res.json({ success: true, message: 'Workspace deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error deleting workspace' });
  }
});

module.exports = router;

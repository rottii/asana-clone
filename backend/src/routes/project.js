const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { evaluateRules } = require('../utils/ruleEngine');

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'asana_gizli_anahtar_123';

// ─── Auth Middleware ───────────────────────────────────────────────────────────
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

// ─── Shared include for full project data ──────────────────────────────────────
const fullProjectInclude = {
  owner: { select: { id: true, name: true, email: true } },
  members: {
    include: {
      user: { select: { id: true, name: true, email: true } }
    }
  },
  sections: {
    orderBy: { order: 'asc' },
    include: {
      tasks: {
        orderBy: { order: 'asc' },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
          subtasks: {
            orderBy: { order: 'asc' },
            include: {
              assignee: { select: { id: true, name: true, email: true } }
            }
          },
          comments: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, name: true, email: true } }
            }
          },
          collaborators: {
            include: {
              user: { select: { id: true, name: true, email: true } }
            }
          },
          blockedBy: {
            include: {
              blockingTask: { select: { id: true, title: true, isCompleted: true } }
            }
          },
          blocking: {
            include: {
              blockedByTask: { select: { id: true, title: true, isCompleted: true } }
            }
          },
          tags: true
        }
      }
    }
  }
};

// Shared include for returning a single task with all relations
const fullTaskInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  creator: { select: { id: true, name: true, email: true } },
  subtasks: {
    orderBy: { order: 'asc' },
    include: {
      assignee: { select: { id: true, name: true, email: true } }
    }
  },
  comments: {
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { id: true, name: true, email: true } }
    }
  },
  collaborators: {
    include: {
      user: { select: { id: true, name: true, email: true } }
    }
  },
  blockedBy: {
    include: {
      blockingTask: { select: { id: true, title: true, isCompleted: true } }
    }
  },
  blocking: {
    include: {
      blockedByTask: { select: { id: true, title: true, isCompleted: true } }
    }
  },
  tags: true
};


// ═══════════════════════════════════════════════════════════════════════════════
//  PROJECT CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/projects — List all projects the user owns or is a member of
router.get('/', authenticateToken, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: req.user.userId },
          { members: { some: { userId: req.user.userId } } }
        ]
      },
      include: fullProjectInclude,
      orderBy: { createdAt: 'desc' }
    });
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Projeler yüklenirken hata oluştu.', details: error.message });
  }
});

// GET /api/projects/:id — Get a single project with full data
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: fullProjectInclude
    });
    if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Proje yüklenirken hata oluştu.', details: error.message });
  }
});

// POST /api/projects — Create a new project
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, defaultView, activeViews } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Proje adı zorunludur.' });
    }

    const newProject = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description || null,
        ownerId: req.user.userId,
        defaultView: defaultView || 'List',
        activeViews: activeViews || undefined,
        sections: {
          create: [
            { name: 'To do', order: 1 },
            { name: 'In progress', order: 2 },
            { name: 'Done', order: 3 }
          ]
        }
      },
      include: fullProjectInclude
    });

    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Proje oluşturulurken hata oluştu.', details: error.message });
  }
});

// PATCH /api/projects/:id — Update project settings
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, status, isArchived, defaultView, activeViews, customFieldSettings, priorityFieldSettings, formSettings, startDate, dueDate } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (isArchived !== undefined) updateData.isArchived = isArchived;
    if (defaultView !== undefined) updateData.defaultView = defaultView;
    if (activeViews !== undefined) updateData.activeViews = activeViews;
    if (customFieldSettings !== undefined) updateData.customFieldSettings = customFieldSettings;
    if (priorityFieldSettings !== undefined) updateData.priorityFieldSettings = priorityFieldSettings;
    if (formSettings !== undefined) updateData.formSettings = formSettings;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    const updatedProject = await prisma.project.update({
      where: { id: req.params.id },
      data: updateData,
      include: fullProjectInclude
    });

    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Proje güncellenirken hata oluştu.', details: error.message });
  }
});

// DELETE /api/projects/:id — Delete a project
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: 'Proje başarıyla silindi.' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Proje silinirken hata oluştu.', details: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
//  SHARING / MEMBERS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/projects/:id/share — Invite a user by email
router.post('/:id/share', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email adresi zorunludur.' });

    const userToAdd = await prisma.user.findUnique({ where: { email } });
    if (!userToAdd) return res.status(404).json({ error: 'Bu email adresinde bir kullanıcı bulunamadı.' });

    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });

    if (project.ownerId === userToAdd.id) {
      return res.status(400).json({ error: 'Bu kullanıcı zaten proje sahibi.' });
    }

    // Create membership (upsert to handle if already exists)
    await prisma.projectMembership.upsert({
      where: {
        projectId_userId: { projectId: req.params.id, userId: userToAdd.id }
      },
      update: {},
      create: {
        projectId: req.params.id,
        userId: userToAdd.id,
        role: 'EDITOR'
      }
    });

    // Create notification for the invited user
    try {
      const io = req.app.get('io');
      await prisma.notification.create({
        data: {
          type: 'ADDED_TO_PROJECT',
          message: `You were added to the project "${project.name}"`,
          userId: userToAdd.id,
          actorId: req.user.userId,
          projectId: project.id
        }
      });
      if (io) io.to(userToAdd.id).emit('new_notification');
    } catch (notifErr) {
      console.error('Notification error:', notifErr);
    }

    const updatedProject = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: fullProjectInclude
    });

    res.json(updatedProject);
  } catch (error) {
    console.error('Error sharing project:', error);
    res.status(500).json({ error: 'Proje paylaşılırken hata oluştu.', details: error.message });
  }
});

// PATCH /api/projects/:id/members — Update a member's role
router.patch('/:id/members', authenticateToken, async (req, res) => {
  try {
    const { userId, role } = req.body;
    if (!userId || !role) return res.status(400).json({ error: 'userId ve role zorunludur.' });

    await prisma.projectMembership.updateMany({
      where: { projectId: req.params.id, userId },
      data: { role }
    });

    const updatedProject = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: fullProjectInclude
    });

    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Üye rolü güncellenirken hata oluştu.', details: error.message });
  }
});

// DELETE /api/projects/:id/members/:userId — Remove a member
router.delete('/:id/members/:userId', authenticateToken, async (req, res) => {
  try {
    await prisma.projectMembership.deleteMany({
      where: { projectId: req.params.id, userId: req.params.userId }
    });

    const updatedProject = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: fullProjectInclude
    });

    res.json(updatedProject);
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Üye kaldırılırken hata oluştu.', details: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
//  SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/projects/sections — Create a section
router.post('/sections', authenticateToken, async (req, res) => {
  try {
    const { name, projectId } = req.body;
    if (!name || !projectId) return res.status(400).json({ error: 'name ve projectId zorunludur.' });

    // Determine next order value
    const lastSection = await prisma.section.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' }
    });
    const nextOrder = lastSection ? lastSection.order + 1 : 1;

    const newSection = await prisma.section.create({
      data: { name: name.trim(), projectId, order: nextOrder },
      include: { tasks: true }
    });

    // Emit real-time event
    const io = req.app.get('io');
    if (io) io.to(projectId).emit('section_created', newSection);

    res.status(201).json(newSection);
  } catch (error) {
    console.error('Error creating section:', error);
    res.status(500).json({ error: 'Bölüm oluşturulurken hata oluştu.', details: error.message });
  }
});

// PATCH /api/projects/sections/:sectionId — Rename a section
router.patch('/sections/:sectionId', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const updatedSection = await prisma.section.update({
      where: { id: req.params.sectionId },
      data: { name: name?.trim() },
      include: {
        tasks: {
          orderBy: { order: 'asc' },
          include: fullTaskInclude
        }
      }
    });

    const io = req.app.get('io');
    if (io) io.to(updatedSection.projectId).emit('section_updated', updatedSection);

    res.json(updatedSection);
  } catch (error) {
    console.error('Error renaming section:', error);
    res.status(500).json({ error: 'Bölüm yeniden adlandırılırken hata oluştu.', details: error.message });
  }
});

// PATCH /api/projects/sections/move — Reorder sections
router.patch('/sections/move', authenticateToken, async (req, res) => {
  try {
    const { orderedSectionIds, projectId } = req.body;
    if (!orderedSectionIds || !projectId) {
      return res.status(400).json({ error: 'orderedSectionIds ve projectId zorunludur.' });
    }

    // Update each section's order
    await Promise.all(
      orderedSectionIds.map((sectionId, index) =>
        prisma.section.update({
          where: { id: sectionId },
          data: { order: index + 1 }
        })
      )
    );

    const updatedProject = await prisma.project.findUnique({
      where: { id: projectId },
      include: fullProjectInclude
    });

    const io = req.app.get('io');
    if (io) io.to(projectId).emit('section_moved', updatedProject);

    res.json(updatedProject);
  } catch (error) {
    console.error('Error reordering sections:', error);
    res.status(500).json({ error: 'Bölüm sıralaması güncellenirken hata oluştu.', details: error.message });
  }
});

// DELETE /api/projects/sections/:sectionId — Delete a section
router.delete('/sections/:sectionId', authenticateToken, async (req, res) => {
  try {
    const section = await prisma.section.findUnique({ where: { id: req.params.sectionId } });
    if (!section) return res.status(404).json({ error: 'Bölüm bulunamadı.' });

    await prisma.section.delete({ where: { id: req.params.sectionId } });

    const io = req.app.get('io');
    if (io) io.to(section.projectId).emit('section_deleted', { sectionId: req.params.sectionId });

    res.json({ message: 'Bölüm başarıyla silindi.' });
  } catch (error) {
    console.error('Error deleting section:', error);
    res.status(500).json({ error: 'Bölüm silinirken hata oluştu.', details: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
//  TASKS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/projects/tasks — Create a task
router.post('/tasks', authenticateToken, async (req, res) => {
  try {
    const { title, sectionId, parentId, assigneeId, dueDate, startDate, description, priority, type } = req.body;
    if (!title || !sectionId) return res.status(400).json({ error: 'title ve sectionId zorunludur.' });

    // Determine next order value in the section
    const lastTask = await prisma.task.findFirst({
      where: { sectionId, parentId: parentId || null },
      orderBy: { order: 'desc' }
    });
    const nextOrder = lastTask ? lastTask.order + 1 : 0;

    const newTask = await prisma.task.create({
      data: {
        title: title.trim(),
        sectionId,
        creatorId: req.user.userId,
        parentId: parentId || null,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        startDate: startDate ? new Date(startDate) : null,
        description: description || null,
        priority: priority || 'MEDIUM',
        type: type || 'TASK',
        order: nextOrder
      },
      include: fullTaskInclude
    });

    // Get the section to find the projectId for socket and rules
    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (section) {
      const io = req.app.get('io');
      if (io) io.to(section.projectId).emit('task_created', newTask);

      // Trigger rule engine
      try {
        await evaluateRules(section.projectId, newTask.id, { type: 'task_added_to_project' });
      } catch (ruleErr) {
        console.error('Rule engine error:', ruleErr);
      }
    }

    // Notify assignee if different from creator
    if (assigneeId && assigneeId !== req.user.userId) {
      try {
        await prisma.notification.create({
          data: {
            type: 'ASSIGNED',
            message: `You were assigned to "${title}"`,
            userId: assigneeId,
            actorId: req.user.userId,
            taskId: newTask.id,
            projectId: section?.projectId || null
          }
        });
        const io = req.app.get('io');
        if (io) io.to(assigneeId).emit('new_notification');
      } catch (notifErr) {
        console.error('Notification error:', notifErr);
      }
    }

    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Görev oluşturulurken hata oluştu.', details: error.message });
  }
});

// PATCH /api/projects/tasks/:taskId — Update a task
router.patch('/tasks/:taskId', authenticateToken, async (req, res) => {
  try {
    const { title, description, isCompleted, assigneeId, dueDate, startDate, priority, type, customFields, sectionId, order, likes } = req.body;

    const currentTask = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      include: { section: true }
    });
    if (!currentTask) return res.status(404).json({ error: 'Görev bulunamadı.' });

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId || null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (priority !== undefined) updateData.priority = priority;
    if (type !== undefined) updateData.type = type;
    if (sectionId !== undefined) updateData.sectionId = sectionId;
    if (order !== undefined) updateData.order = order;
    if (likes !== undefined) updateData.likes = likes;

    // Handle customFields — accept both string and object
    if (customFields !== undefined) {
      updateData.customFields = typeof customFields === 'string' ? customFields : JSON.stringify(customFields);
    }

    // Handle completion toggle
    if (isCompleted !== undefined) {
      updateData.isCompleted = isCompleted;
      updateData.completedAt = isCompleted ? new Date() : null;
    }

    const updatedTask = await prisma.task.update({
      where: { id: req.params.taskId },
      data: updateData,
      include: fullTaskInclude
    });

    const projectId = currentTask.section?.projectId;
    const io = req.app.get('io');
    if (io && projectId) io.to(projectId).emit('task_updated', updatedTask);

    // ─── Rule Engine Triggers ────────────────────────────────────────────
    if (projectId) {
      try {
        if (isCompleted !== undefined) {
          await evaluateRules(projectId, updatedTask.id, { type: 'task_completed' });
          await evaluateRules(projectId, updatedTask.id, { type: 'completion_status_changed' });
        }
        if (assigneeId !== undefined && assigneeId !== currentTask.assigneeId) {
          await evaluateRules(projectId, updatedTask.id, { type: 'task_assigned' });
        }
        if (title !== undefined && title !== currentTask.title) {
          await evaluateRules(projectId, updatedTask.id, { type: 'task_name_changed' });
        }
        if (description !== undefined && description !== currentTask.description) {
          await evaluateRules(projectId, updatedTask.id, { type: 'task_description_changed' });
        }
        if (type !== undefined && type !== currentTask.type) {
          await evaluateRules(projectId, updatedTask.id, { type: 'task_type_changed' });
        }
        if (dueDate !== undefined) {
          await evaluateRules(projectId, updatedTask.id, { type: 'due_date_changed' });
        }
        if (startDate !== undefined) {
          await evaluateRules(projectId, updatedTask.id, { type: 'start_date_changed' });
        }
        if (customFields !== undefined) {
          await evaluateRules(projectId, updatedTask.id, { type: 'custom_field_changed' });
        }
        if (sectionId !== undefined && sectionId !== currentTask.sectionId) {
          await evaluateRules(projectId, updatedTask.id, {
            type: 'task_moved',
            targetSectionId: sectionId
          });
          await evaluateRules(projectId, updatedTask.id, { type: 'task_moved_general' });
        }
      } catch (ruleErr) {
        console.error('Rule engine error:', ruleErr);
      }
    }

    // ─── Notifications ───────────────────────────────────────────────────
    if (assigneeId !== undefined && assigneeId && assigneeId !== req.user.userId && assigneeId !== currentTask.assigneeId) {
      try {
        await prisma.notification.create({
          data: {
            type: 'ASSIGNED',
            message: `You were assigned to "${updatedTask.title}"`,
            userId: assigneeId,
            actorId: req.user.userId,
            taskId: updatedTask.id,
            projectId
          }
        });
        if (io) io.to(assigneeId).emit('new_notification');
      } catch (notifErr) {
        console.error('Notification error:', notifErr);
      }
    }

    if (isCompleted === true && currentTask.assigneeId && currentTask.assigneeId !== req.user.userId) {
      try {
        await prisma.notification.create({
          data: {
            type: 'COMPLETED',
            message: `"${updatedTask.title}" was marked complete`,
            userId: currentTask.assigneeId,
            actorId: req.user.userId,
            taskId: updatedTask.id,
            projectId
          }
        });
        if (io) io.to(currentTask.assigneeId).emit('new_notification');
      } catch (notifErr) {
        console.error('Notification error:', notifErr);
      }
    }

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Görev güncellenirken hata oluştu.', details: error.message });
  }
});

// PATCH /api/projects/tasks/move — Move & reorder a task
router.patch('/tasks/move', authenticateToken, async (req, res) => {
  try {
    const { taskId, targetSectionId, orderedTaskIds, projectId } = req.body;
    if (!taskId || !targetSectionId) {
      return res.status(400).json({ error: 'taskId ve targetSectionId zorunludur.' });
    }

    // Move the task to the target section
    await prisma.task.update({
      where: { id: taskId },
      data: { sectionId: targetSectionId }
    });

    // Reorder all tasks in the target section
    if (orderedTaskIds && orderedTaskIds.length > 0) {
      await Promise.all(
        orderedTaskIds.map((id, index) =>
          prisma.task.update({
            where: { id },
            data: { order: index }
          })
        )
      );
    }

    // Trigger rule engine for task_moved
    if (projectId) {
      try {
        await evaluateRules(projectId, taskId, {
          type: 'task_moved',
          targetSectionId
        });
        await evaluateRules(projectId, taskId, { type: 'task_moved_general' });
      } catch (ruleErr) {
        console.error('Rule engine error:', ruleErr);
      }
    }

    const io = req.app.get('io');
    if (io && projectId) io.to(projectId).emit('task_moved', { taskId, targetSectionId });

    res.json({ message: 'Görev başarıyla taşındı.' });
  } catch (error) {
    console.error('Error moving task:', error);
    res.status(500).json({ error: 'Görev taşınırken hata oluştu.', details: error.message });
  }
});

// DELETE /api/projects/tasks/:taskId — Delete a task
router.delete('/tasks/:taskId', authenticateToken, async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      include: { section: true }
    });
    if (!task) return res.status(404).json({ error: 'Görev bulunamadı.' });

    await prisma.task.delete({ where: { id: req.params.taskId } });

    const io = req.app.get('io');
    if (io && task.section) io.to(task.section.projectId).emit('task_deleted', { taskId: req.params.taskId });

    res.json({ message: 'Görev başarıyla silindi.' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Görev silinirken hata oluştu.', details: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
//  COMMENTS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/projects/tasks/:taskId/comments — Add a comment
router.post('/tasks/:taskId/comments', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Yorum metni zorunludur.' });

    const newComment = await prisma.comment.create({
      data: {
        text: text.trim(),
        taskId: req.params.taskId,
        userId: req.user.userId
      },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    // Notify task assignee about the comment
    const task = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      include: { section: true }
    });

    if (task && task.assigneeId && task.assigneeId !== req.user.userId) {
      try {
        await prisma.notification.create({
          data: {
            type: 'COMMENTED',
            message: `New comment on "${task.title}"`,
            userId: task.assigneeId,
            actorId: req.user.userId,
            taskId: task.id,
            projectId: task.section?.projectId || null
          }
        });
        const io = req.app.get('io');
        if (io) io.to(task.assigneeId).emit('new_notification');
      } catch (notifErr) {
        console.error('Notification error:', notifErr);
      }
    }

    // Trigger rule engine
    if (task?.section?.projectId) {
      try {
        await evaluateRules(task.section.projectId, task.id, { type: 'comment_added' });
      } catch (ruleErr) {
        console.error('Rule engine error:', ruleErr);
      }
    }

    res.status(201).json(newComment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Yorum eklenirken hata oluştu.', details: error.message });
  }
});

// DELETE /api/projects/tasks/:taskId/comments/:commentId — Delete a comment
router.delete('/tasks/:taskId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
    if (!comment) return res.status(404).json({ error: 'Yorum bulunamadı.' });

    // Only the comment author can delete
    if (comment.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Sadece yorumun sahibi silebilir.' });
    }

    await prisma.comment.delete({ where: { id: req.params.commentId } });
    res.json({ message: 'Yorum başarıyla silindi.' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Yorum silinirken hata oluştu.', details: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
//  DEPENDENCIES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/projects/tasks/:taskId/dependencies — Create a dependency
router.post('/tasks/:taskId/dependencies', authenticateToken, async (req, res) => {
  try {
    const { blockingId } = req.body;
    const blockedById = req.params.taskId;

    if (!blockingId) return res.status(400).json({ error: 'blockingId zorunludur.' });
    if (blockingId === blockedById) return res.status(400).json({ error: 'Bir görev kendisini engelleyemez.' });

    await prisma.taskDependency.create({
      data: { blockingId, blockedById }
    });

    // Return updated task with all relations
    const updatedTask = await prisma.task.findUnique({
      where: { id: blockedById },
      include: fullTaskInclude
    });

    res.status(201).json(updatedTask);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Bu bağımlılık zaten mevcut.' });
    }
    console.error('Error creating dependency:', error);
    res.status(500).json({ error: 'Bağımlılık oluşturulurken hata oluştu.', details: error.message });
  }
});

// DELETE /api/projects/tasks/:taskId/dependencies/:dependencyId — Remove a dependency
router.delete('/tasks/:taskId/dependencies/:dependencyId', authenticateToken, async (req, res) => {
  try {
    await prisma.taskDependency.delete({ where: { id: req.params.dependencyId } });

    // Return updated task
    const updatedTask = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      include: fullTaskInclude
    });

    res.json(updatedTask);
  } catch (error) {
    console.error('Error deleting dependency:', error);
    res.status(500).json({ error: 'Bağımlılık silinirken hata oluştu.', details: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
//  TASK TAGS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/projects/:projectId/tasks/:taskId/tags — Assign a tag to a task
router.post('/:projectId/tasks/:taskId/tags', authenticateToken, async (req, res) => {
  try {
    const { tagId } = req.body;
    if (!tagId) return res.status(400).json({ error: 'tagId zorunludur.' });

    await prisma.task.update({
      where: { id: req.params.taskId },
      data: {
        tags: { connect: { id: tagId } }
      }
    });

    const updatedTask = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      include: fullTaskInclude
    });

    res.json(updatedTask);
  } catch (error) {
    console.error('Error assigning tag:', error);
    res.status(500).json({ error: 'Etiket atanırken hata oluştu.', details: error.message });
  }
});

// DELETE /api/projects/:projectId/tasks/:taskId/tags/:tagId — Remove a tag from a task
router.delete('/:projectId/tasks/:taskId/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    await prisma.task.update({
      where: { id: req.params.taskId },
      data: {
        tags: { disconnect: { id: req.params.tagId } }
      }
    });

    const updatedTask = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      include: fullTaskInclude
    });

    res.json(updatedTask);
  } catch (error) {
    console.error('Error removing tag:', error);
    res.status(500).json({ error: 'Etiket kaldırılırken hata oluştu.', details: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC FORMS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/projects/:id/form — Get form settings for a project (public, no auth)
router.get('/:id/form', async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        formSettings: true,
        customFieldSettings: true,
        sections: {
          orderBy: { order: 'asc' },
          take: 1,
          select: { id: true }
        }
      }
    });
    if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });
    if (!project.formSettings) return res.status(404).json({ error: 'Bu proje için form ayarlanmamış.' });

    res.json(project);
  } catch (error) {
    console.error('Error fetching form:', error);
    res.status(500).json({ error: 'Form yüklenirken hata oluştu.', details: error.message });
  }
});

// POST /api/projects/:id/form/submit — Submit a form (public, no auth)
router.post('/:id/form/submit', async (req, res) => {
  try {
    const { title, description, customFields } = req.body;
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        sections: { orderBy: { order: 'asc' }, take: 1 },
        owner: { select: { id: true } }
      }
    });

    if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });
    if (!project.sections || project.sections.length === 0) {
      return res.status(400).json({ error: 'Projede bölüm bulunamadı.' });
    }

    const sectionId = project.sections[0].id;

    // Determine next order
    const lastTask = await prisma.task.findFirst({
      where: { sectionId, parentId: null },
      orderBy: { order: 'desc' }
    });
    const nextOrder = lastTask ? lastTask.order + 1 : 0;

    const newTask = await prisma.task.create({
      data: {
        title: title || 'Form Submission',
        description: description || null,
        sectionId,
        creatorId: project.ownerId,
        order: nextOrder,
        customFields: customFields ? JSON.stringify(customFields) : '{}'
      }
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).json({ error: 'Form gönderilirken hata oluştu.', details: error.message });
  }
});


module.exports = router;

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { evaluateRules } = require('../utils/ruleEngine');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueName = crypto.randomUUID() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB limit

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'asana_gizli_anahtar_123';

// ─── Auth Middleware ───────────────────────────────────────────────────────────
const { authenticateToken } = require('../middleware/auth');

// ─── Role Helpers ──────────────────────────────────────────────────────────────
// Hierarchy: ADMIN > EDITOR > COMMENTER > VIEWER
const ROLE_LEVEL = { VIEWER: 0, COMMENTER: 1, EDITOR: 2, ADMIN: 3 };

// ─── Mention Helpers ───────────────────────────────────────────────────────────
function extractMentions(htmlText) {
    if (!htmlText) return [];
    const regex = /<span[^>]*data-type="mention"[^>]*data-id="([^"]+)"/g;
    const ids = new Set();
    let match;
    while ((match = regex.exec(htmlText)) !== null) {
        ids.add(match[1]);
    }
    return Array.from(ids);
}

async function processMentions({ newHtml, oldHtml, actorId, taskId, projectId, messagePrefix = 'Mentioned you in' }) {
    const newIds = extractMentions(newHtml);
    const oldIds = extractMentions(oldHtml);
    
    // Find IDs that are in newHtml but not in oldHtml
    const addedIds = newIds.filter(id => !oldIds.includes(id) && id !== actorId);
    
    for (const userId of addedIds) {
        try {
            await prisma.notification.create({
                data: {
                    type: 'MENTIONED',
                    message: `${messagePrefix} a ${taskId ? 'task' : 'message'}`,
                    userId,
                    actorId,
                    taskId: taskId || null,
                    projectId: projectId || null
                }
            });
        } catch (err) {
            console.error('Error creating mention notification for user', userId, err);
        }
    }
    return addedIds; // return IDs that were notified, so we can emit sockets
}

// Resolve user's role in a project. Owner = ADMIN.
async function getProjectRole(userId, projectId) {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true, members: { where: { userId }, select: { role: true } } }
    });
    if (!project) return null;
    if (project.ownerId === userId) return 'ADMIN';
    if (project.members.length > 0) return project.members[0].role;
    return null; // not a member
}

// Resolve role via a taskId (looks up section → project)
async function getProjectRoleFromTask(userId, taskId) {
    const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { section: { select: { projectId: true } } }
    });
    if (!task?.section?.projectId) return null;
    return getProjectRole(userId, task.section.projectId);
}

// Resolve role via a sectionId
async function getProjectRoleFromSection(userId, sectionId) {
    const section = await prisma.section.findUnique({
        where: { id: sectionId },
        select: { projectId: true }
    });
    if (!section) return null;
    return getProjectRole(userId, section.projectId);
}

// Check if role meets minimum required level
function hasRole(userRole, minimumRole) {
    if (!userRole) return false;
    return (ROLE_LEVEL[userRole] || 0) >= (ROLE_LEVEL[minimumRole] || 0);
}

// ─── Shared include for full project data ──────────────────────────────────────
const fullProjectInclude = {
    workspace: true,
    team: true,
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
                            user: { select: { id: true, name: true, email: true } },
                            reactions: { include: { user: { select: { id: true, name: true, email: true } } } }
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
                    tags: true,
                    attachments: {
                        orderBy: { createdAt: 'desc' },
                        include: {
                            uploader: { select: { id: true, name: true, email: true } }
                        }
                    },
                    activities: {
                        orderBy: { createdAt: 'desc' },
                        include: {
                            user: { select: { id: true, name: true, email: true } }
                        }
                    },
                    secondaryProjects: {
                        include: {
                            project: { select: { id: true, name: true, color: true, icon: true, customFieldSettings: true, sections: { select: { id: true, name: true } } } },
                            section: { select: { id: true, name: true } }
                        }
                    }
                }
            },
            secondaryTasks: {
                include: {
                    task: {
                        include: {
                            section: {
                                include: {
                                    project: { select: { id: true, name: true, color: true, icon: true, customFieldSettings: true, sections: { select: { id: true, name: true } } } }
                                }
                            },
                            assignee: { select: { id: true, name: true, email: true } },
                            creator: { select: { id: true, name: true, email: true } },
                            subtasks: {
                                orderBy: { order: 'asc' },
                                include: { assignee: { select: { id: true, name: true, email: true } } }
                            },
                            comments: {
                                orderBy: { createdAt: 'asc' },
                                include: { 
                                    user: { select: { id: true, name: true, email: true } },
                                    reactions: { include: { user: { select: { id: true, name: true, email: true } } } }
                                }
                            },
                            collaborators: {
                                include: { user: { select: { id: true, name: true, email: true } } }
                            },
                            blockedBy: {
                                include: { blockingTask: { select: { id: true, title: true, isCompleted: true } } }
                            },
                            blocking: {
                                include: { blockedByTask: { select: { id: true, title: true, isCompleted: true } } }
                            },
                            tags: true,
                            attachments: {
                                orderBy: { createdAt: 'desc' },
                                include: { uploader: { select: { id: true, name: true, email: true } } }
                            },
                            activities: {
                                orderBy: { createdAt: 'desc' },
                                include: { user: { select: { id: true, name: true, email: true } } }
                            },
                            secondaryProjects: {
                                include: {
                                    project: { select: { id: true, name: true, color: true, icon: true, customFieldSettings: true, sections: { select: { id: true, name: true } } } },
                                    section: { select: { id: true, name: true } }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    starredBy: true,
    portfolios: {
        include: {
            portfolio: { select: { id: true, name: true, ownerId: true, privacy: true } }
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
            user: { select: { id: true, name: true, email: true } },
            reactions: { include: { user: { select: { id: true, name: true, email: true } } } }
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
    tags: true,
    attachments: {
        orderBy: { createdAt: 'desc' },
        include: {
            uploader: { select: { id: true, name: true, email: true } }
        }
    },
    activities: {
        orderBy: { createdAt: 'desc' },
        include: {
            user: { select: { id: true, name: true, email: true } }
        }
    },
    secondaryProjects: {
        include: {
            project: { select: { id: true, name: true, color: true, icon: true, customFieldSettings: true, sections: { select: { id: true, name: true } } } },
            section: { select: { id: true, name: true } }
        }
    },
    section: {
        include: {
            project: { select: { id: true, name: true, color: true, icon: true, customFieldSettings: true, sections: { select: { id: true, name: true } } } }
        }
    }
};


// ═══════════════════════════════════════════════════════════════════════════════
//  PROJECT CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/projects/templates — List all projects marked as templates
router.get('/templates', authenticateToken, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId || workspaceId === 'null' || workspaceId === 'undefined') {
            return res.status(400).json({ error: 'Çalışma alanı (workspaceId) gereklidir.' });
        }

        // Fix any orphaned templates (from before this fix) by assigning them to this workspace
        await prisma.project.updateMany({
            where: { isTemplate: true, workspaceId: null },
            data: { workspaceId: workspaceId }
        });

        let templates = await prisma.project.findMany({
            where: { 
                isTemplate: true,
                workspaceId: workspaceId
            },
            include: fullProjectInclude,
            orderBy: { createdAt: 'desc' }
        });

        if (templates.length === 0) {
            // Seed a default template "Cross-Functional Project Plan"
            await prisma.project.create({
                data: {
                    name: 'Cross-functional project plan',
                    isTemplate: true,
                    workspaceId: workspaceId,
                    ownerId: req.user.userId,
                    color: '#10B981',
                    icon: '📋',
                    defaultView: 'Board',
                    activeViews: JSON.stringify([
                        { id: 'view-board', type: 'Board', name: 'Board' },
                        { id: 'view-list', type: 'List', name: 'List' },
                        { id: 'view-timeline', type: 'Timeline', name: 'Timeline' },
                        { id: 'view-dashboard', type: 'Dashboard', name: 'Dashboard' }
                    ]),
                    sections: {
                        create: [
                            { name: 'To Do', order: 0 },
                            { name: 'In Progress', order: 1 },
                            { name: 'Done', order: 2 }
                        ]
                    }
                }
            });

            // Seed another template
            await prisma.project.create({
                data: {
                    name: 'Product Roadmap',
                    isTemplate: true,
                    workspaceId: workspaceId,
                    ownerId: req.user.userId,
                    color: '#6366F1',
                    icon: '🗺️',
                    defaultView: 'Timeline',
                    activeViews: JSON.stringify([
                        { id: 'view-timeline', type: 'Timeline', name: 'Timeline' },
                        { id: 'view-list', type: 'List', name: 'List' },
                        { id: 'view-board', type: 'Board', name: 'Board' }
                    ]),
                    sections: {
                        create: [
                            { name: 'Q1', order: 0 },
                            { name: 'Q2', order: 1 },
                            { name: 'Q3', order: 2 },
                            { name: 'Q4', order: 3 }
                        ]
                    }
                }
            });

            // Re-fetch after seeding
            templates = await prisma.project.findMany({
                where: { 
                    isTemplate: true,
                    workspaceId: workspaceId
                },
                include: fullProjectInclude,
                orderBy: { createdAt: 'desc' }
            });
        }

        // Merge secondary tasks into the sections
        templates.forEach(project => {
            if (project.sections) {
                project.sections.forEach(section => {
                    const primaryTasks = section.tasks || [];
                    const secondaryTasks = (section.secondaryTasks || []).map(st => ({
                        ...st.task,
                        order: st.order,
                        sectionId: st.sectionId,
                        isSecondary: true
                    }));
                    section.tasks = [...primaryTasks, ...secondaryTasks].sort((a, b) => a.order - b.order);
                    delete section.secondaryTasks;
                });
            }
        });

        res.json(templates);
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: 'Şablonlar yüklenirken hata oluştu.', details: error.message });
    }
});

// GET /api/projects — List all projects the user owns or is a member of
router.get('/', authenticateToken, async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            where: {
                isTemplate: false,
                OR: [
                    { ownerId: req.user.userId },
                    { members: { some: { userId: req.user.userId } } }
                ]
            },
            include: fullProjectInclude,
            orderBy: { createdAt: 'desc' }
        });

        // Merge secondary tasks into the sections for all projects
        projects.forEach(project => {
            if (project.sections) {
                project.sections.forEach(section => {
                    const primaryTasks = section.tasks || [];
                    const secondaryTasks = (section.secondaryTasks || []).map(st => ({
                        ...st.task,
                        order: st.order,
                        sectionId: st.sectionId,
                        isSecondary: true
                    }));
                    section.tasks = [...primaryTasks, ...secondaryTasks].sort((a, b) => a.order - b.order);
                    delete section.secondaryTasks;
                });
            }
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

        // Merge secondary tasks into sections
        if (project.sections) {
            project.sections.forEach(section => {
                const primaryTasks = section.tasks || [];
                const secondaryTasks = (section.secondaryTasks || []).map(st => ({
                    ...st.task,
                    order: st.order,
                    sectionId: st.sectionId,
                    isSecondary: true
                }));
                section.tasks = [...primaryTasks, ...secondaryTasks].sort((a, b) => a.order - b.order);
                delete section.secondaryTasks;
            });
        }

        res.json(project);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Proje yüklenirken hata oluştu.', details: error.message });
    }
});

// POST /api/projects — Create a new project
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, description, defaultView, activeViews, color, icon, workspaceId, teamId } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Proje adı zorunludur.' });
        }

        const newProject = await prisma.project.create({
            data: {
                name: name.trim(),
                description: description || null,
                ownerId: req.user.userId,
                workspaceId: workspaceId || null,
                teamId: teamId || null,
                defaultView: defaultView || 'List',
                activeViews: activeViews || undefined,
                color: color || '#4F46E5',
                icon: icon || '📋',
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

// POST /api/projects/:id/duplicate — Deep copy a project (for templates or regular copying)
router.post('/:id/duplicate', authenticateToken, async (req, res) => {
    try {
        const { name, isTemplate, workspaceId, teamId } = req.body;
        const sourceProjectId = req.params.id;

        const sourceProject = await prisma.project.findUnique({
            where: { id: sourceProjectId },
            include: {
                sections: {
                    include: {
                        tasks: true
                    }
                }
            }
        });

        if (!sourceProject) {
            return res.status(404).json({ error: 'Kaynak proje bulunamadı.' });
        }

        // 1. Create new project
        const newProject = await prisma.project.create({
            data: {
                name: name || `${sourceProject.name} (Kopya)`,
                description: sourceProject.description,
                ownerId: req.user.userId,
                defaultView: sourceProject.defaultView,
                activeViews: sourceProject.activeViews,
                color: sourceProject.color,
                icon: sourceProject.icon,
                isTemplate: !!isTemplate,
                workspaceId: workspaceId || sourceProject.workspaceId,
                teamId: teamId || sourceProject.teamId,
                customFieldSettings: sourceProject.customFieldSettings,
                formSettings: sourceProject.formSettings
            }
        });

        // 2. Add owner as member with ADMIN role
        await prisma.projectMembership.create({
            data: {
                projectId: newProject.id,
                userId: req.user.userId,
                role: 'ADMIN'
            }
        });

        // 3. Copy Sections and Tasks
        for (const section of sourceProject.sections) {
            const newSection = await prisma.section.create({
                data: {
                    name: section.name,
                    order: section.order,
                    projectId: newProject.id
                }
            });

            // 4. Copy Tasks in Section
            for (const task of section.tasks) {
                await prisma.task.create({
                    data: {
                        title: task.title,
                        description: task.description,
                        type: task.type,
                        order: task.order,
                        customFields: task.customFields,
                        sectionId: newSection.id,
                        creatorId: req.user.userId,
                        assigneeId: task.assigneeId,
                        startDate: task.startDate,
                        dueDate: task.dueDate
                    }
                });
            }
        }

        const projectWithIncludes = await prisma.project.findUnique({
            where: { id: newProject.id },
            include: fullProjectInclude
        });

        res.status(201).json(projectWithIncludes);
    } catch (error) {
        console.error('Error duplicating project:', error);
        res.status(500).json({ error: 'Proje kopyalanırken hata oluştu.', details: error.message });
    }
});

// POST /api/projects/:id/save-as-template — Save current project as a template
router.post('/:id/save-as-template', authenticateToken, async (req, res) => {
    try {
        const sourceProjectId = req.params.id;
        
        const sourceProject = await prisma.project.findUnique({
            where: { id: sourceProjectId },
            include: {
                sections: {
                    include: {
                        tasks: true
                    }
                }
            }
        });

        if (!sourceProject) {
            return res.status(404).json({ error: 'Kaynak proje bulunamadı.' });
        }

        // 1. Create new template project
        const newProject = await prisma.project.create({
            data: {
                name: `${sourceProject.name} Template`,
                description: sourceProject.description,
                ownerId: req.user.userId,
                defaultView: sourceProject.defaultView,
                activeViews: sourceProject.activeViews,
                color: sourceProject.color,
                icon: sourceProject.icon,
                isTemplate: true,
                customFieldSettings: sourceProject.customFieldSettings,
                formSettings: sourceProject.formSettings,
                workspaceId: sourceProject.workspaceId
            }
        });

        // 2. Add owner as member with ADMIN role
        await prisma.projectMembership.create({
            data: {
                projectId: newProject.id,
                userId: req.user.userId,
                role: 'ADMIN'
            }
        });

        // 3. Copy Sections and Tasks
        for (const section of sourceProject.sections) {
            const newSection = await prisma.section.create({
                data: {
                    name: section.name,
                    order: section.order,
                    projectId: newProject.id
                }
            });

            for (const task of section.tasks) {
                await prisma.task.create({
                    data: {
                        title: task.title,
                        description: task.description,
                        type: task.type,
                        order: task.order,
                        customFields: task.customFields,
                        sectionId: newSection.id,
                        creatorId: req.user.userId,
                        assigneeId: task.assigneeId,
                        startDate: task.startDate,
                        dueDate: task.dueDate
                    }
                });
            }
        }

        const projectWithIncludes = await prisma.project.findUnique({
            where: { id: newProject.id },
            include: fullProjectInclude
        });

        res.status(201).json(projectWithIncludes);
    } catch (error) {
        console.error('Error saving as template:', error);
        res.status(500).json({ error: 'Şablon olarak kaydedilirken hata oluştu.', details: error.message });
    }
});

// PATCH /api/projects/:id — Update project settings (EDITOR+)
router.patch('/:id', authenticateToken, async (req, res) => {
    try {
        const role = await getProjectRole(req.user.userId, req.params.id);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

        const { name, description, status, isArchived, defaultView, activeViews, customFieldSettings, formSettings, startDate, dueDate, color, icon, workspaceId, teamId, githubRepo } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (status !== undefined) updateData.status = status;
        if (isArchived !== undefined) updateData.isArchived = isArchived;
        if (defaultView !== undefined) updateData.defaultView = defaultView;
        if (activeViews !== undefined) updateData.activeViews = activeViews;
        if (githubRepo !== undefined) updateData.githubRepo = githubRepo;
        if (customFieldSettings !== undefined) {
            updateData.customFieldSettings = customFieldSettings;

            // Cascade option renames/deletes to all tasks in the project
            const currentProject = await prisma.project.findUnique({
                where: { id: req.params.id },
                select: { customFieldSettings: true }
            });

            if (currentProject && currentProject.customFieldSettings) {
                const oldSettings = typeof currentProject.customFieldSettings === 'string' ? JSON.parse(currentProject.customFieldSettings) : currentProject.customFieldSettings;
                const newSettings = typeof customFieldSettings === 'string' ? JSON.parse(customFieldSettings) : customFieldSettings;

                const renames = {};

                (Array.isArray(oldSettings) ? oldSettings : []).forEach(oldCf => {
                    const newCf = (Array.isArray(newSettings) ? newSettings : []).find(f => f.id === oldCf.id);
                    if (newCf && ['SELECT', 'single-select', 'MULTI_SELECT', 'multi-select'].includes(oldCf.type)) {
                        const oldOpts = oldCf.options || [];
                        const newOpts = newCf.options || [];
                        oldOpts.forEach(oldOpt => {
                            const newOpt = newOpts.find(o => o.id === oldOpt.id);
                            if (newOpt && newOpt.label !== oldOpt.label) {
                                if (!renames[oldCf.id]) renames[oldCf.id] = {};
                                renames[oldCf.id][oldOpt.label] = newOpt.label;
                            } else if (!newOpt) {
                                if (!renames[oldCf.id]) renames[oldCf.id] = {};
                                renames[oldCf.id][oldOpt.label] = null;
                            }
                        });
                    }
                });

                if (Object.keys(renames).length > 0) {
                    const tasksToUpdate = await prisma.task.findMany({
                        where: { section: { projectId: req.params.id } },
                        select: { id: true, customFields: true }
                    });

                    for (const task of tasksToUpdate) {
                        if (task.customFields) {
                            let changed = false;
                            const fields = typeof task.customFields === 'string' ? JSON.parse(task.customFields) : task.customFields;
                            
                            for (const cfId of Object.keys(renames)) {
                                if (fields[cfId] !== undefined) {
                                    const val = fields[cfId];
                                    if (Array.isArray(val)) {
                                        const newVal = val.map(v => renames[cfId][v] !== undefined ? renames[cfId][v] : v).filter(v => v !== null);
                                        if (JSON.stringify(val) !== JSON.stringify(newVal)) {
                                            fields[cfId] = newVal;
                                            changed = true;
                                        }
                                    } else {
                                        if (renames[cfId][val] !== undefined) {
                                            if (renames[cfId][val] === null) {
                                                delete fields[cfId];
                                            } else {
                                                fields[cfId] = renames[cfId][val];
                                            }
                                            changed = true;
                                        }
                                    }
                                }
                            }

                            if (changed) {
                                await prisma.task.update({
                                    where: { id: task.id },
                                    data: { customFields: JSON.stringify(fields) }
                                });
                            }
                        }
                    }
                }
            }
        }
        if (formSettings !== undefined) updateData.formSettings = formSettings;
        if (workspaceId !== undefined) updateData.workspaceId = workspaceId;
        if (teamId !== undefined) updateData.teamId = teamId;
        if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
        if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
        if (color !== undefined) updateData.color = color;
        if (icon !== undefined) updateData.icon = icon;

        const updatedProject = await prisma.project.update({
            where: { id: req.params.id },
            data: updateData,
            include: fullProjectInclude
        });

        const io = req.app.get('io');
        if (io) io.to(req.params.id).emit('project_updated', updatedProject);

        res.json(updatedProject);
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Proje güncellenirken hata oluştu.', details: error.message });
    }
});

// POST /api/projects/:id/star — Toggle star status for a project
router.post('/:id/star', authenticateToken, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.userId;

        const existingStar = await prisma.starredProject.findUnique({
            where: {
                userId_projectId: {
                    userId,
                    projectId
                }
            }
        });

        if (existingStar) {
            await prisma.starredProject.delete({
                where: { id: existingStar.id }
            });
            res.json({ isStarred: false });
        } else {
            await prisma.starredProject.create({
                data: { userId, projectId }
            });
            res.json({ isStarred: true });
        }
    } catch (error) {
        console.error('Error toggling project star:', error);
        res.status(500).json({ error: 'Yıldız durumu güncellenirken hata oluştu.', details: error.message });
    }
});

// DELETE /api/projects/:id — Delete a project (ADMIN only)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const role = await getProjectRole(req.user.userId, req.params.id);
        if (role !== 'ADMIN') {
            return res.status(403).json({ error: 'Sadece proje yöneticisi projeyi silebilir.' });
        }

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

// POST /api/projects/:id/share — Invite a user by email (ADMIN only)
router.post('/:id/share', authenticateToken, async (req, res) => {
    try {
        const role = await getProjectRole(req.user.userId, req.params.id);
        if (role !== 'ADMIN') {
            return res.status(403).json({ error: 'Sadece proje yöneticisi üye ekleyebilir.' });
        }

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

        // Also add user to the workspace if they are not already a member
        if (project.workspaceId) {
            await prisma.workspaceMember.upsert({
                where: {
                    workspaceId_userId: { workspaceId: project.workspaceId, userId: userToAdd.id }
                },
                update: {},
                create: {
                    workspaceId: project.workspaceId,
                    userId: userToAdd.id,
                    role: 'MEMBER' // or GUEST depending on your rules
                }
            });
        }

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

        const io = req.app.get('io');
        if (io) {
            io.to(userToAdd.id).emit('project_shared', updatedProject);
        }

        res.json(updatedProject);
    } catch (error) {
        console.error('Error sharing project:', error);
        res.status(500).json({ error: 'Proje paylaşılırken hata oluştu.', details: error.message });
    }
});

// PATCH /api/projects/:id/members — Update a member's role (ADMIN only, cannot change own role)
router.patch('/:id/members', authenticateToken, async (req, res) => {
    try {
        const callerRole = await getProjectRole(req.user.userId, req.params.id);
        if (callerRole !== 'ADMIN') {
            return res.status(403).json({ error: 'Sadece proje yöneticisi rolleri değiştirebilir.' });
        }

        const { userId, role } = req.body;
        if (!userId || !role) return res.status(400).json({ error: 'userId ve role zorunludur.' });

        // Admin cannot change their own role
        if (userId === req.user.userId) {
            return res.status(403).json({ error: 'Kendi rolünüzü değiştiremezsiniz.' });
        }

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

// DELETE /api/projects/:id/members/:userId — Remove a member (ADMIN only)
router.delete('/:id/members/:userId', authenticateToken, async (req, res) => {
    try {
        const callerRole = await getProjectRole(req.user.userId, req.params.id);
        if (callerRole !== 'ADMIN' && req.user.userId !== req.params.userId) {
            return res.status(403).json({ error: 'Sadece proje yöneticisi üyeleri veya kendi hesabınızı kaldırabilirsiniz.' });
        }

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

        const role = await getProjectRole(req.user.userId, projectId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

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

// PATCH /api/projects/sections/move — Reorder sections (MUST be before /sections/:sectionId)
router.patch('/sections/move', authenticateToken, async (req, res) => {
    try {
        const { orderedSectionIds, projectId } = req.body;
        if (!orderedSectionIds || !projectId) {
            return res.status(400).json({ error: 'orderedSectionIds ve projectId zorunludur.' });
        }

        const role = await getProjectRole(req.user.userId, projectId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
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

// PATCH /api/projects/sections/:sectionId — Rename a section
router.patch('/sections/:sectionId', authenticateToken, async (req, res) => {
    try {
        const role = await getProjectRoleFromSection(req.user.userId, req.params.sectionId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

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



// DELETE /api/projects/sections/:sectionId — Delete a section
router.delete('/sections/:sectionId', authenticateToken, async (req, res) => {
    try {
        const role = await getProjectRoleFromSection(req.user.userId, req.params.sectionId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

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
        const { title, sectionId, parentId, assigneeId, dueDate, startDate, description, type, approvalStatus } = req.body;
        if (!title || !sectionId) return res.status(400).json({ error: 'title ve sectionId zorunludur.' });

        const role = await getProjectRoleFromSection(req.user.userId, sectionId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

        // Determine next order value in the section
        const lastTask = await prisma.task.findFirst({
            where: { sectionId, parentId: parentId || null },
            orderBy: { order: 'desc' }
        });
        const nextOrder = lastTask ? lastTask.order + 1 : 0;

        const taskType = type || 'TASK';
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
                type: taskType,
                approvalStatus: taskType === 'APPROVAL' ? (approvalStatus || 'PENDING') : null,
                order: nextOrder,
                activities: {
                    create: {
                        action: 'created this task',
                        userId: req.user.userId
                    }
                }
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

// PATCH /api/projects/tasks/move — Move & reorder a task (MUST be before /tasks/:taskId)
router.patch('/tasks/move', authenticateToken, async (req, res) => {
    try {
        const { taskId, taskIds, targetSectionId, orderedTaskIds, projectId } = req.body;
        
        const tasksToMove = taskIds || (taskId ? [taskId] : []);
        
        if (tasksToMove.length === 0 || !targetSectionId) {
            return res.status(400).json({ error: 'taskId(s) ve targetSectionId zorunludur.' });
        }

        // Use projectId if available, else get from the first taskId
        let role = null;
        if (projectId) {
            role = await getProjectRole(req.user.userId, projectId);
        } else {
            role = await getProjectRoleFromTask(req.user.userId, tasksToMove[0]);
        }
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

        const targetSection = await prisma.section.findUnique({ where: { id: targetSectionId } });
        const safeProjectId = projectId || (targetSection ? targetSection.projectId : null);

        // Move all selected tasks
        await Promise.all(tasksToMove.map(async (id) => {
            const primaryTask = await prisma.task.findFirst({
                where: { id: id, section: { projectId: safeProjectId } }
            });
            if (primaryTask) {
                await prisma.task.update({
                    where: { id: id },
                    data: { 
                        sectionId: targetSectionId,
                        activities: { create: { action: `moved this task`, userId: req.user.userId } }
                    }
                });
            } else if (safeProjectId) {
                // Secondary
                await prisma.taskProject.updateMany({
                    where: { taskId: id, projectId: safeProjectId },
                    data: { sectionId: targetSectionId }
                });
            }
        }));

        // Reorder all tasks in the target section
        if (orderedTaskIds && orderedTaskIds.length > 0) {
            await Promise.all(
                orderedTaskIds.map(async (id, index) => {
                    const isPrimary = await prisma.task.findFirst({
                        where: { id, section: { projectId: safeProjectId } }
                    });
                    if (isPrimary) {
                        return prisma.task.update({
                            where: { id },
                            data: { order: index }
                        });
                    } else if (safeProjectId) {
                        return prisma.taskProject.updateMany({
                            where: { taskId: id, projectId: safeProjectId },
                            data: { order: index }
                        });
                    }
                })
            );
        }

        // Trigger rule engine and socket events for ALL moved tasks
        const io = req.app.get('io');

        if (safeProjectId) {
            for (const id of tasksToMove) {
                try {
                    await evaluateRules(safeProjectId, id, {
                        type: 'task_moved',
                        targetSectionId
                    });
                    await evaluateRules(safeProjectId, id, { type: 'task_moved_general' });
                } catch (e) {
                    console.error("Rule engine error during bulk move:", e);
                }

                if (io) {
                    io.to(safeProjectId).emit('task_moved', { taskId: id, targetSectionId });
                    try {
                        const updatedTask = await prisma.task.findUnique({
                            where: { id: id },
                            include: fullTaskInclude
                        });
                        if (updatedTask) {
                            const primaryProjId = updatedTask.section?.projectId;
                            if (primaryProjId) io.to(primaryProjId).emit('task_updated', updatedTask);
                            if (updatedTask.secondaryProjects) {
                                updatedTask.secondaryProjects.forEach(sp => {
                                    io.to(sp.projectId).emit('task_updated', updatedTask);
                                });
                            }
                        }
                    } catch (err) {
                        console.error('Error emitting task_updated after move:', err);
                    }
                }
            }
        }

        res.json({ success: true, message: 'Görev(ler) başarıyla taşındı.' });
    } catch (error) {
        console.error('Error moving task:', error);
        res.status(500).json({ error: 'Görev taşınırken hata oluştu.', details: error.message });
    }
});

// PATCH /api/projects/tasks/:taskId — Update a task
router.patch('/tasks/:taskId', authenticateToken, async (req, res) => {
    try {
        const role = await getProjectRoleFromTask(req.user.userId, req.params.taskId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

        const { title, description, isCompleted, assigneeId, dueDate, startDate, type, customFields, githubPRs, sectionId, order, likes, isRecurring, recurrenceRule, recurrenceCustom, approvalStatus } = req.body;

        const currentTask = await prisma.task.findUnique({
            where: { id: req.params.taskId },
            include: { section: true, assignee: true }
        });
        if (!currentTask) return res.status(404).json({ error: 'Görev bulunamadı.' });
        
        const projectId = currentTask.section?.projectId;

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (assigneeId !== undefined) updateData.assigneeId = assigneeId || null;
        if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
        if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
        if (type !== undefined) updateData.type = type;
        if (sectionId !== undefined) updateData.sectionId = sectionId;
        if (order !== undefined) updateData.order = order;
        if (likes !== undefined) updateData.likes = likes;
        if (approvalStatus !== undefined) updateData.approvalStatus = approvalStatus;

        // Handle customFields — accept both string and object
        if (customFields !== undefined) {
            updateData.customFields = typeof customFields === 'string' ? customFields : JSON.stringify(customFields);
        }

        // Handle githubPRs
        if (githubPRs !== undefined) {
            updateData.githubPRs = typeof githubPRs === 'string' ? githubPRs : JSON.stringify(githubPRs);
        }

        if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
        if (recurrenceRule !== undefined) updateData.recurrenceRule = recurrenceRule;
        if (recurrenceCustom !== undefined) {
            updateData.recurrenceCustom = typeof recurrenceCustom === 'string' ? recurrenceCustom : JSON.stringify(recurrenceCustom);
        }

        // Handle completion toggle
        let nextTaskToSpawn = null;
        if (isCompleted !== undefined) {
            updateData.isCompleted = isCompleted;
            updateData.completedAt = isCompleted ? new Date() : null;

            // Recurrence spawning logic
            if (isCompleted === true && currentTask.isRecurring && !currentTask.nextRecurrenceTaskId) {
                let currentDueDate = currentTask.dueDate ? new Date(currentTask.dueDate) : new Date();
                let nextDueDate = new Date(currentDueDate);
                const rule = currentTask.recurrenceRule || 'DAILY';
                
                if (rule === 'DAILY') {
                    nextDueDate.setDate(nextDueDate.getDate() + 1);
                } else if (rule === 'WEEKLY') {
                    nextDueDate.setDate(nextDueDate.getDate() + 7);
                } else if (rule === 'MONTHLY') {
                    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
                } else if (rule === 'YEARLY') {
                    nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
                } else if (rule === 'CUSTOM') {
                    let customObj = {};
                    try {
                        customObj = typeof currentTask.recurrenceCustom === 'string' ? JSON.parse(currentTask.recurrenceCustom || '{}') : (currentTask.recurrenceCustom || {});
                    } catch(e) {}
                    const interval = customObj.interval || 1;
                    if (customObj.frequency === 'weekly' || customObj.frequency === 'week') {
                        nextDueDate.setDate(nextDueDate.getDate() + 7 * interval);
                    } else if (customObj.frequency === 'monthly' || customObj.frequency === 'month') {
                        nextDueDate.setMonth(nextDueDate.getMonth() + interval);
                    } else if (customObj.frequency === 'yearly' || customObj.frequency === 'year') {
                        nextDueDate.setFullYear(nextDueDate.getFullYear() + interval);
                    } else {
                        nextDueDate.setDate(nextDueDate.getDate() + interval);
                    }
                }

                let nextStartDate = null;
                if (currentTask.startDate && currentTask.dueDate) {
                    const duration = currentDueDate.getTime() - new Date(currentTask.startDate).getTime();
                    nextStartDate = new Date(nextDueDate.getTime() - duration);
                }

                nextTaskToSpawn = {
                    title: currentTask.title,
                    description: currentTask.description,
                    type: currentTask.type,
                    order: currentTask.order,
                    sectionId: currentTask.sectionId,
                    assigneeId: currentTask.assigneeId,
                    creatorId: currentTask.creatorId || req.user.userId,
                    customFields: currentTask.customFields,
                    dueDate: nextDueDate,
                    startDate: nextStartDate,
                    isRecurring: true,
                    recurrenceRule: currentTask.recurrenceRule,
                    recurrenceCustom: currentTask.recurrenceCustom
                };
            }
        }

        const activitiesToLog = [];
        if (title !== undefined && title !== currentTask.title) {
            activitiesToLog.push({ action: 'renamed this task', oldValue: currentTask.title, newValue: title });
        }
        if (description !== undefined && description !== currentTask.description) {
            activitiesToLog.push({ action: 'changed the description' });
        }
        if (assigneeId !== undefined && assigneeId !== currentTask.assigneeId) {
            if (assigneeId) {
                const newAssignee = await prisma.user.findUnique({ where: { id: assigneeId } });
                activitiesToLog.push({ action: `assigned this task to ${newAssignee?.name}` });
            } else {
                activitiesToLog.push({ action: 'unassigned this task' });
            }
        }
        if (dueDate !== undefined) {
            const currentDueDate = currentTask.dueDate ? currentTask.dueDate.getTime() : null;
            const newDueDate = dueDate ? new Date(dueDate).getTime() : null;
            if (currentDueDate !== newDueDate) {
                activitiesToLog.push({ action: dueDate ? 'changed the due date' : 'removed the due date' });
                updateData.reminderSent1Week = false;
                updateData.reminderSent1Day = false;
                updateData.reminderSent1Hour = false;
                updateData.reminderSentOverdue = false;
            }
        }
        if (sectionId !== undefined && sectionId !== currentTask.sectionId) {
            activitiesToLog.push({ action: 'moved this task' });
        }
        if (isCompleted !== undefined && isCompleted !== currentTask.isCompleted) {
            activitiesToLog.push({ action: isCompleted ? 'completed this task' : 'marked this task incomplete' });
        }
        
        if (githubPRs !== undefined) {
            try {
                const oldPrsStr = typeof currentTask.githubPRs === 'string' ? currentTask.githubPRs : JSON.stringify(currentTask.githubPRs || []);
                const oldPrs = JSON.parse(oldPrsStr);
                const newPrsStr = typeof githubPRs === 'string' ? githubPRs : JSON.stringify(githubPRs);
                const newPrs = JSON.parse(newPrsStr);

                const oldUrls = new Set(oldPrs.map(p => p.url));
                for (const pr of newPrs) {
                    if (!oldUrls.has(pr.url)) {
                        activitiesToLog.push({ action: 'attached_github_pr', newValue: JSON.stringify(pr) });
                    }
                }

                // We will evaluate rules for github_pr custom fields AFTER saving to database
            } catch(e) { console.error('Error diffing PRs', e); }
        }

        if (activitiesToLog.length > 0) {
            updateData.activities = {
                create: activitiesToLog.map(act => ({
                    ...act,
                    userId: req.user.userId
                }))
            };
        }

        let newSpawnedTaskId = null;
        if (nextTaskToSpawn) {
            try {
                const spawnedTask = await prisma.task.create({ data: nextTaskToSpawn });
                newSpawnedTaskId = spawnedTask.id;
                updateData.nextRecurrenceTaskId = newSpawnedTaskId;
            } catch (err) {
                console.error("Failed to spawn recurring task", err);
            }
        }

        const updatedTask = await prisma.task.update({
            where: { id: req.params.taskId },
            data: updateData,
            include: fullTaskInclude
        });

        const io = req.app.get('io');
        if (io) {
            if (projectId) io.to(projectId).emit('task_updated', updatedTask);
            if (updatedTask.secondaryProjects) {
                updatedTask.secondaryProjects.forEach(sp => {
                    io.to(sp.projectId).emit('task_updated', updatedTask);
                });
            }
            if (newSpawnedTaskId) {
                 const fullNewTask = await prisma.task.findUnique({ where: { id: newSpawnedTaskId }, include: fullTaskInclude });
                 if (projectId && fullNewTask) io.to(projectId).emit('task_created', fullNewTask);
            }
        }

        // ─── Rule Engine Triggers ────────────────────────────────────────────
        if (projectId) {
            try {
                if (isCompleted !== undefined) {
                    await evaluateRules(projectId, updatedTask.id, { type: 'task_completed' });
                    await evaluateRules(projectId, updatedTask.id, { type: 'completion_status_changed' });

                    // Subtask completion logic: If this is a subtask, check if ALL subtasks of its parent are now completed
                    if (updatedTask.parentId) {
                        const parentTask = await prisma.task.findUnique({
                            where: { id: updatedTask.parentId },
                            include: { subtasks: true, section: true }
                        });
                        if (parentTask && parentTask.section?.projectId) {
                            const allSubtasksCompleted = parentTask.subtasks.every(st => st.id === updatedTask.id ? isCompleted : st.isCompleted);
                            // If this change made all subtasks complete, trigger for the parent
                            if (allSubtasksCompleted && isCompleted) {
                                await evaluateRules(parentTask.section.projectId, parentTask.id, { type: 'completion_status_changed' });
                            }
                        }
                    }

                    // Task no longer blocked logic: If this task was blocking others, check if they are now unblocked
                    if (isCompleted) {
                        const blockedDependencies = await prisma.taskDependency.findMany({
                            where: { blockingId: updatedTask.id },
                            include: { 
                                blockedByTask: { 
                                    include: { 
                                        blockedBy: { include: { blockingTask: true } }, 
                                        section: true 
                                    } 
                                } 
                            }
                        });
                        
                        for (const dep of blockedDependencies) {
                            const blockedTask = dep.blockedByTask;
                            const allBlockersCompleted = blockedTask.blockedBy.every(b => 
                                b.blockingTask.isCompleted || b.blockingTask.id === updatedTask.id
                            );
                            
                            if (allBlockersCompleted && blockedTask.section?.projectId) {
                                await evaluateRules(blockedTask.section.projectId, blockedTask.id, { type: 'task_no_longer_blocked' });
                            }
                        }
                    }
                }
                if (approvalStatus !== undefined && approvalStatus !== currentTask.approvalStatus) {
                    await evaluateRules(projectId, updatedTask.id, { type: 'approval_status_changed' });
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
                    let oldFields = {};
                    let newFields = {};
                    try { oldFields = typeof currentTask.customFields === 'string' ? JSON.parse(currentTask.customFields) : (currentTask.customFields || {}); } catch(e){}
                    try { newFields = typeof customFields === 'string' ? JSON.parse(customFields) : (customFields || {}); } catch(e){}
                    
                    if (oldFields && newFields) {
                        for (const key of Object.keys(newFields)) {
                            if (newFields[key] !== oldFields[key]) {
                                await evaluateRules(projectId, updatedTask.id, { type: 'custom_field_changed', fieldName: key });
                            }
                        }
                    }
                }
                if (githubPRs !== undefined) {
                    const oldPrsStr = typeof currentTask.githubPRs === 'string' ? currentTask.githubPRs : JSON.stringify(currentTask.githubPRs || []);
                    const newPrsStr = typeof githubPRs === 'string' ? githubPRs : JSON.stringify(githubPRs);
                    if (oldPrsStr !== newPrsStr) {
                        const proj = await prisma.project.findUnique({ where: { id: projectId } });
                        if (proj && proj.customFieldSettings) {
                            const cfs = typeof proj.customFieldSettings === 'string' ? JSON.parse(proj.customFieldSettings) : proj.customFieldSettings;
                            const prFields = (Array.isArray(cfs) ? cfs : []).filter(f => f.type === 'github_pr');
                            for (const prField of prFields) {
                                await evaluateRules(projectId, updatedTask.id, { type: 'custom_field_changed', fieldName: prField.id });
                            }
                        }
                    }
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

        if (description !== undefined && description !== currentTask.description) {
            const notifiedIds = await processMentions({
                newHtml: description,
                oldHtml: currentTask.description,
                actorId: req.user.userId,
                taskId: updatedTask.id,
                projectId,
                messagePrefix: 'Mentioned you in the description of'
            });
            if (io) {
                notifiedIds.forEach(id => {
                    io.to(id).emit('new_notification');
                });
            }
        }

        // ─── Refetch Final Task for Rule Engine Changes ─────────────────────
        const finalTask = await prisma.task.findUnique({
            where: { id: updatedTask.id },
            include: fullTaskInclude
        });

        if (io) {
            // Emitting after rules evaluated so that UI sees rule engine effects
            if (projectId) io.to(projectId).emit('task_updated', finalTask);
            if (finalTask.secondaryProjects) {
                finalTask.secondaryProjects.forEach(sp => {
                    io.to(sp.projectId).emit('task_updated', finalTask);
                });
            }
        }

        res.json(finalTask);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Görev güncellenirken hata oluştu.', details: error.message });
    }
});
// POST /api/projects/tasks/:taskId/convert-to-project - Convert task to project
router.post('/tasks/:taskId/convert-to-project', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { section: { include: { project: true } } }
        });
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const role = await getProjectRoleFromTask(req.user.userId, taskId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlemi yapmak için yetkiniz yok.' });
        }

        const newProject = await prisma.project.create({
            data: {
                name: task.title,
                ownerId: req.user.userId,
                workspaceId: task.section?.project?.workspaceId || null,
                sections: {
                    create: [{ name: 'To Do', order: 0 }, { name: 'In Progress', order: 1 }, { name: 'Done', order: 2 }]
                }
            }
        });

        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: { isCompleted: true },
            include: {
                assignee: { select: { id: true, name: true, email: true } },
                creator: { select: { id: true, name: true, email: true } },
                subtasks: { orderBy: { order: 'asc' }, include: { assignee: { select: { id: true, name: true, email: true } } } },
                comments: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                        reactions: { include: { user: { select: { id: true, name: true, email: true } } } }
                    }
                },
                collaborators: { include: { user: { select: { id: true, name: true, email: true } } } },
                blockedBy: { include: { blockingTask: { select: { id: true, title: true, isCompleted: true } } } },
                blocking: { include: { blockedByTask: { select: { id: true, title: true, isCompleted: true } } } },
                tags: true,
                attachments: { orderBy: { createdAt: 'desc' }, include: { uploader: { select: { id: true, name: true, email: true } } } },
                activities: { orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, email: true } } } },
                secondaryProjects: {
                    include: {
                        project: { select: { id: true, name: true, color: true, icon: true, customFieldSettings: true, sections: { select: { id: true, name: true } } } },
                        section: { select: { id: true, name: true } }
                    }
                }
            }
        });

        await prisma.taskActivity.create({
            data: { action: `converted this task to a project: ${newProject.name}`, taskId: taskId, userId: req.user.userId }
        });

        if (req.app.get('io')) {
            req.app.get('io').to(req.user.userId).emit('project_created', newProject);
            if (task.section?.projectId) {
                req.app.get('io').to(task.section.projectId).emit('task_updated', updatedTask);
            }
        }

        res.json(updatedTask);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during conversion' });
    }
});
// DELETE /api/projects/tasks/:taskId — Delete a task
router.delete('/tasks/:taskId', authenticateToken, async (req, res) => {
    try {
        const role = await getProjectRoleFromTask(req.user.userId, req.params.taskId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

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
        const role = await getProjectRoleFromTask(req.user.userId, req.params.taskId);
        if (!hasRole(role, 'COMMENTER')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Commenter veya üstü gerekli)' });
        }

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

        // Process Mentions
        if (task) {
            const notifiedIds = await processMentions({
                newHtml: text,
                oldHtml: '',
                actorId: req.user.userId,
                taskId: task.id,
                projectId: task.section?.projectId,
                messagePrefix: 'Mentioned you in a comment on'
            });
            const io = req.app.get('io');
            if (io) {
                notifiedIds.forEach(id => {
                    if (id !== task.assigneeId) { // Assignee already got a notification if they were assigned, wait, maybe notify them too if mentioned
                        io.to(id).emit('new_notification');
                    }
                });
            }
        }

        // Trigger rule engine
        if (task?.section?.projectId) {
            try {
                await evaluateRules(task.section.projectId, task.id, { type: 'comment_added' });
            } catch (ruleErr) {
                console.error('Rule engine error:', ruleErr);
            }

            const io = req.app.get('io');
            if (io) {
                const updatedTaskForSocket = await prisma.task.findUnique({
                    where: { id: task.id },
                    include: fullTaskInclude
                });
                io.to(task.section.projectId).emit('task_updated', updatedTaskForSocket);
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
        const role = await getProjectRoleFromTask(req.user.userId, req.params.taskId);
        if (!hasRole(role, 'COMMENTER')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
        }

        const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
        if (!comment) return res.status(404).json({ error: 'Yorum bulunamadı.' });

        if (role !== 'ADMIN' && comment.userId !== req.user.userId) {
            return res.status(403).json({ error: 'Sadece kendi yorumunuzu veya yöneticiyseniz silebilirsiniz.' });
        }

        await prisma.comment.delete({ where: { id: req.params.commentId } });

        const taskForSocket = await prisma.task.findUnique({
            where: { id: req.params.taskId },
            include: { ...fullTaskInclude, section: true }
        });
        const io = req.app.get('io');
        if (io && taskForSocket?.section?.projectId) {
            io.to(taskForSocket.section.projectId).emit('task_updated', taskForSocket);
        }

        res.json({ message: 'Yorum başarıyla silindi.' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Yorum silinirken hata oluştu.', details: error.message });
    }
});

// POST /api/projects/tasks/:taskId/comments/:commentId/reactions — Toggle a reaction
router.post('/tasks/:taskId/comments/:commentId/reactions', authenticateToken, async (req, res) => {
    try {
        const { emoji } = req.body;
        if (!emoji) return res.status(400).json({ error: 'Emoji zorunludur.' });

        const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
        if (!comment) return res.status(404).json({ error: 'Yorum bulunamadı.' });

        const existingReaction = await prisma.commentReaction.findFirst({
            where: {
                commentId: req.params.commentId,
                userId: req.user.userId,
                emoji: emoji
            }
        });

        if (existingReaction) {
            await prisma.commentReaction.delete({ where: { id: existingReaction.id } });
        } else {
            await prisma.commentReaction.create({
                data: {
                    emoji,
                    commentId: req.params.commentId,
                    userId: req.user.userId
                }
            });
        }

        const taskForSocket = await prisma.task.findUnique({
            where: { id: req.params.taskId },
            include: { ...fullTaskInclude, section: true }
        });
        const io = req.app.get('io');
        if (io && taskForSocket?.section?.projectId) {
            io.to(taskForSocket.section.projectId).emit('task_updated', taskForSocket);
        }

        res.json(taskForSocket);
    } catch (error) {
        console.error('Error toggling comment reaction:', error);
        res.status(500).json({ error: 'Reaksiyon güncellenirken hata oluştu.', details: error.message });
    }
});



// ═══════════════════════════════════════════════════════════════════════════════
//  DEPENDENCIES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/projects/tasks/:taskId/dependencies — Create a dependency
router.post('/tasks/:taskId/dependencies', authenticateToken, async (req, res) => {
    try {
        const role = await getProjectRoleFromTask(req.user.userId, req.params.taskId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

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
        const role = await getProjectRoleFromTask(req.user.userId, req.params.taskId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

        await prisma.taskDependency.delete({ where: { id: req.params.dependencyId } });

        // Return updated task
        const updatedTask = await prisma.task.findUnique({
            where: { id: req.params.taskId },
            include: {
                ...fullTaskInclude,
                blockedBy: true
            }
        });

        if (updatedTask && updatedTask.blockedBy.length === 0 && updatedTask.section?.projectId) {
            await evaluateRules(updatedTask.section.projectId, updatedTask.id, { type: 'task_no_longer_blocked' });
        }

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
        const role = await getProjectRole(req.user.userId, req.params.projectId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

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
        const role = await getProjectRole(req.user.userId, req.params.projectId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

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

// POST /api/projects/tasks/:taskId/duplicate — Duplicate a task
router.post('/tasks/:taskId/duplicate', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.taskId;
        const taskToDuplicate = await prisma.task.findUnique({
            where: { id: taskId },
            include: { section: { select: { projectId: true } } }
        });

        if (!taskToDuplicate) {
            return res.status(404).json({ error: 'Kopyalanacak görev bulunamadı.' });
        }

        const role = await getProjectRole(req.user.userId, taskToDuplicate.section.projectId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu projede görev oluşturma yetkiniz yok.' });
        }

        // Determine next order
        const lastTask = await prisma.task.findFirst({
            where: { sectionId: taskToDuplicate.sectionId, parentId: taskToDuplicate.parentId },
            orderBy: { order: 'desc' }
        });
        const nextOrder = lastTask ? lastTask.order + 1 : 0;

        const duplicatedTask = await prisma.task.create({
            data: {
                title: `${taskToDuplicate.title} (Copy)`,
                description: taskToDuplicate.description,
                startDate: taskToDuplicate.startDate,
                dueDate: taskToDuplicate.dueDate,
                type: taskToDuplicate.type,
                order: nextOrder,
                isCompleted: false, // Don't copy completion status usually
                customFields: taskToDuplicate.customFields,
                sectionId: taskToDuplicate.sectionId,
                assigneeId: taskToDuplicate.assigneeId,
                creatorId: req.user.userId,
                parentId: taskToDuplicate.parentId
            },
            include: fullTaskInclude
        });

        // Socket.io notification
        const io = req.app.get('io');
        if (io) {
            io.to(taskToDuplicate.section.projectId).emit('task_created', duplicatedTask);
        }

        res.status(201).json(duplicatedTask);
    } catch (error) {
        console.error('Error duplicating task:', error);
        res.status(500).json({ error: 'Görev kopyalanırken hata oluştu.', details: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ATTACHMENTS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/projects/tasks/:taskId/attachments — Upload files to a task
router.post('/tasks/:taskId/attachments', authenticateToken, upload.array('files', 10), async (req, res) => {
    try {
        const role = await getProjectRoleFromTask(req.user.userId, req.params.taskId);
        if (!hasRole(role, 'COMMENTER')) {
            // Clean up uploaded files if unauthorized
            req.files?.forEach(f => fs.unlinkSync(f.path));
            return res.status(403).json({ error: 'Dosya yükleme yetkiniz yok.' });
        }

        const attachments = await Promise.all(
            req.files.map(file =>
                prisma.attachment.create({
                    data: {
                        filename: file.filename,
                        originalName: file.originalname,
                        mimeType: file.mimetype,
                        size: file.size,
                        taskId: req.params.taskId,
                        uploaderId: req.user.userId
                    },
                    include: {
                        uploader: { select: { id: true, name: true, email: true } }
                    }
                })
            )
        );

        // Create activity logs for attachments
        await Promise.all(
            req.files.map(file =>
                prisma.taskActivity.create({
                    data: {
                        action: `attached ${file.originalname}`,
                        taskId: req.params.taskId,
                        userId: req.user.userId
                    }
                })
            )
        );

        const taskForRule = await prisma.task.findUnique({ where: { id: req.params.taskId }, select: { section: { select: { projectId: true } } } });
        if (taskForRule?.section?.projectId) {
            await evaluateRules(taskForRule.section.projectId, req.params.taskId, { type: 'attachment_added' });
        }

        res.status(201).json(attachments);
    } catch (error) {
        console.error('Error uploading attachments:', error);
        res.status(500).json({ error: 'Dosya yüklenirken hata oluştu.', details: error.message });
    }
});

// GET /api/projects/tasks/:taskId/attachments — List attachments for a task
router.get('/tasks/:taskId/attachments', authenticateToken, async (req, res) => {
    try {
        const attachments = await prisma.attachment.findMany({
            where: { taskId: req.params.taskId },
            orderBy: { createdAt: 'desc' },
            include: {
                uploader: { select: { id: true, name: true, email: true } }
            }
        });
        res.json(attachments);
    } catch (error) {
        console.error('Error fetching attachments:', error);
        res.status(500).json({ error: 'Ekler yüklenirken hata oluştu.', details: error.message });
    }
});

// DELETE /api/projects/attachments/:attachmentId — Delete an attachment
router.delete('/attachments/:attachmentId', authenticateToken, async (req, res) => {
    try {
        const attachment = await prisma.attachment.findUnique({
            where: { id: req.params.attachmentId },
            include: { task: { select: { section: { select: { projectId: true } } } } }
        });
        if (!attachment) return res.status(404).json({ error: 'Ek bulunamadı.' });

        const role = await getProjectRole(req.user.userId, attachment.task.section.projectId);
        // Allow if uploader or editor+
        if (attachment.uploaderId !== req.user.userId && !hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu eki silme yetkiniz yok.' });
        }

        // Delete file from disk
        const filePath = path.join(uploadsDir, attachment.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await prisma.attachment.delete({ where: { id: req.params.attachmentId } });
        
        await prisma.taskActivity.create({
            data: {
                action: `removed attachment ${attachment.originalName}`,
                taskId: attachment.taskId,
                userId: req.user.userId
            }
        });

        res.json({ message: 'Ek silindi.' });
    } catch (error) {
        console.error('Error deleting attachment:', error);
        res.status(500).json({ error: 'Ek silinirken hata oluştu.', details: error.message });
    }
});


// ═══════════════════════════════════════════════════════════════════════════════
//  MULTI-HOMING
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/projects/tasks/:taskId/projects — Add a task to a secondary project
router.post('/tasks/:taskId/projects', authenticateToken, async (req, res) => {
    try {
        const { targetProjectId, targetSectionId } = req.body;
        if (!targetProjectId || !targetSectionId) {
            return res.status(400).json({ error: 'targetProjectId and targetSectionId are required' });
        }

        // Must be editor on target project
        const role = await getProjectRole(req.user.userId, targetProjectId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'You do not have permission to add tasks to this project.' });
        }

        const task = await prisma.task.findUnique({
            where: { id: req.params.taskId },
            include: { section: true }
        });
        if (!task) return res.status(404).json({ error: 'Task not found' });

        // Don't add if it's the primary project
        if (task.section.projectId === targetProjectId) {
            return res.status(400).json({ error: 'Task is already in this project (primary).' });
        }

        // Determine next order value
        const lastSecondaryTask = await prisma.taskProject.findFirst({
            where: { sectionId: targetSectionId },
            orderBy: { order: 'desc' }
        });
        const lastPrimaryTask = await prisma.task.findFirst({
            where: { sectionId: targetSectionId },
            orderBy: { order: 'desc' }
        });
        const maxSecondary = lastSecondaryTask ? lastSecondaryTask.order : 0;
        const maxPrimary = lastPrimaryTask ? lastPrimaryTask.order : 0;
        const nextOrder = Math.max(maxSecondary, maxPrimary) + 1;

        const taskProject = await prisma.taskProject.create({
            data: {
                taskId: req.params.taskId,
                projectId: targetProjectId,
                sectionId: targetSectionId,
                order: nextOrder
            },
            include: {
                project: { select: { id: true, name: true, color: true, icon: true, customFieldSettings: true } },
                section: { select: { id: true, name: true } }
            }
        });

        // Log activity
        await prisma.taskActivity.create({
            data: {
                action: 'added this task to another project',
                taskId: req.params.taskId,
                userId: req.user.userId
            }
        });

        const io = req.app.get('io');
        if (io) io.to(targetProjectId).emit('task_created', task); // Or a refresh event

        res.status(201).json(taskProject);
    } catch (error) {
        console.error('Error adding task to project:', error);
        res.status(500).json({ error: 'Failed to add task to project.', details: error.message });
    }
});

// DELETE /api/projects/tasks/:taskId/projects/:projectId — Remove from secondary project
router.delete('/tasks/:taskId/projects/:projectId', authenticateToken, async (req, res) => {
    try {
        const { taskId, projectId } = req.params;

        // Must be editor on the target project
        const role = await getProjectRole(req.user.userId, projectId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'You do not have permission to remove tasks from this project.' });
        }

        await prisma.taskProject.delete({
            where: { taskId_projectId: { taskId, projectId } }
        });

        // Log activity
        await prisma.taskActivity.create({
            data: {
                action: 'removed this task from a project',
                taskId,
                userId: req.user.userId
            }
        });

        const io = req.app.get('io');
        if (io) io.to(projectId).emit('task_deleted', { taskId });

        res.json({ message: 'Task removed from project' });
    } catch (error) {
        console.error('Error removing task from project:', error);
        res.status(500).json({ error: 'Failed to remove task from project.', details: error.message });
    }
});

// ─── BULK TASK UPDATE ──────────────────────────────────────────────────────────
router.patch('/tasks/bulk-update', authenticateToken, async (req, res) => {
    try {
        const { taskIds, updates } = req.body;
        if (!Array.isArray(taskIds) || taskIds.length === 0) {
            return res.status(400).json({ error: 'taskIds array is required.' });
        }

        // Build update data
        const updateData = {};
        if (updates.isCompleted !== undefined) {
            updateData.isCompleted = updates.isCompleted;
            updateData.completedAt = updates.isCompleted ? new Date() : null;
        }
        if (updates.assigneeId !== undefined) updateData.assigneeId = updates.assigneeId || null;
        if (updates.dueDate !== undefined) updateData.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;

        // Handle section move separately since it needs per-task ordering
        if (updates.sectionId) {
            const maxOrderTask = await prisma.task.findFirst({
                where: { sectionId: updates.sectionId },
                orderBy: { order: 'desc' },
                select: { order: true }
            });
            let nextOrder = (maxOrderTask?.order || 0) + 1;

            for (const taskId of taskIds) {
                await prisma.task.update({
                    where: { id: taskId },
                    data: { ...updateData, sectionId: updates.sectionId, order: nextOrder++ }
                });
            }
        } else if (Object.keys(updateData).length > 0) {
            await prisma.task.updateMany({
                where: { id: { in: taskIds } },
                data: updateData
            });
        }

        // Determine project IDs to emit socket events
        const affectedTasks = await prisma.task.findMany({
            where: { id: { in: taskIds } },
            select: { section: { select: { projectId: true } } }
        });
        const projectIds = [...new Set(affectedTasks.map(t => t.section.projectId))];

        const io = req.app.get('io');
        if (io) {
            for (const pid of projectIds) {
                io.to(pid).emit('task_updated', { bulk: true });
            }
        }

        res.json({ message: `${taskIds.length} tasks updated.` });
    } catch (error) {
        console.error('Error bulk updating tasks:', error);
        res.status(500).json({ error: 'Bulk update failed.', details: error.message });
    }
});

// ─── BULK TASK DELETE ──────────────────────────────────────────────────────────
router.delete('/tasks/bulk-delete', authenticateToken, async (req, res) => {
    try {
        const { taskIds } = req.body;
        if (!Array.isArray(taskIds) || taskIds.length === 0) {
            return res.status(400).json({ error: 'taskIds array is required.' });
        }

        // Determine project IDs before deletion for socket events
        const affectedTasks = await prisma.task.findMany({
            where: { id: { in: taskIds } },
            select: { section: { select: { projectId: true } } }
        });
        const projectIds = [...new Set(affectedTasks.map(t => t.section.projectId))];

        await prisma.task.deleteMany({
            where: { id: { in: taskIds } }
        });

        const io = req.app.get('io');
        if (io) {
            for (const pid of projectIds) {
                io.to(pid).emit('task_deleted', { bulk: true });
            }
        }

        res.json({ message: `${taskIds.length} tasks deleted.` });
    } catch (error) {
        console.error('Error bulk deleting tasks:', error);
        res.status(500).json({ error: 'Bulk delete failed.', details: error.message });
    }
});

module.exports = router;

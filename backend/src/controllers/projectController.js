const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
    getProjectRole,
    hasRole,
    ensureMyTasksProject,
    isWorkspaceMember,
    fullProjectInclude
} = require('../utils/projectHelpers');

// ═══════════════════════════════════════════════════════════════════════════════
//  PROJECT CRUD
// ═══════════════════════════════════════════════════════════════════════════════

exports.getTemplates = async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId || workspaceId === 'null' || workspaceId === 'undefined') {
            return res.status(400).json({ error: 'Çalışma alanı (workspaceId) gereklidir.' });
        }

        // Authorization: must be a member of the workspace
        const isMember = await isWorkspaceMember(req.user.userId, workspaceId);
        if (!isMember) {
            return res.status(403).json({ error: 'Bu çalışma alanına erişim yetkiniz yok.' });
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
};

exports.getProjects = async (req, res) => {
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

        // 1. Get all workspaces the user belongs to
        const userWorkspaces = await prisma.workspaceMember.findMany({
            where: { userId: req.user.userId },
            select: { workspaceId: true }
        });
        
        // 2. Assign orphaned MY_TASKS projects to the first workspace
        if (userWorkspaces.length > 0) {
            await prisma.project.updateMany({
                where: { status: 'MY_TASKS', ownerId: req.user.userId, workspaceId: null },
                data: { workspaceId: userWorkspaces[0].workspaceId }
            });
        }

        // 3. Ensure user has a MY_TASKS project for each workspace
        for (const wm of userWorkspaces) {
            await ensureMyTasksProject(req.user.userId, wm.workspaceId);
        }
        
        // 4. Remove any outdated MY_TASKS project that might have been fetched before migration
        const filteredProjects = projects.filter(p => !(p.status === 'MY_TASKS' && p.ownerId === req.user.userId));
        
        // 5. Fetch all MY_TASKS projects for the user
        let myTasksProjects = await prisma.project.findMany({
            where: { status: 'MY_TASKS', ownerId: req.user.userId },
            include: fullProjectInclude
        });
            
        for (let myTasksProject of myTasksProjects) {
            if (myTasksProject && myTasksProject.sections) {
                myTasksProject.sections.forEach(section => {
                    const primaryTasks = section.tasks || [];
                    const secondaryTasks = (section.secondaryTasks || []).map(st => ({
                        ...st.task,
                        order: st.order,
                        sectionId: st.sectionId,
                        isSecondary: true
                    }));
                    
                    let allTasks = [...primaryTasks, ...secondaryTasks];
                    // Filter out template tasks
                    allTasks = allTasks.filter(t => {
                        if (t.section?.project?.isTemplate) return false;
                        if (t.secondaryProjects?.some(sp => sp.project?.isTemplate)) return false;
                        return true;
                    });
                    
                    section.tasks = allTasks.sort((a, b) => a.order - b.order);
                    delete section.secondaryTasks;
                });
            }
            filteredProjects.push(myTasksProject);
        }

        res.json(filteredProjects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Projeler yüklenirken hata oluştu.', details: error.message });
    }
};

exports.getProjectById = async (req, res) => {
    try {
        const project = await prisma.project.findUnique({
            where: { id: req.params.id },
            include: fullProjectInclude
        });
        if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });

        // Authorization: must be owner or member to view project
        const role = await getProjectRole(req.user.userId, req.params.id);
        if (!role) {
            return res.status(403).json({ error: 'Bu projeye erişim yetkiniz yok.' });
        }

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
                
                let allTasks = [...primaryTasks, ...secondaryTasks];
                
                // If this is the MY_TASKS project, filter out template tasks
                if (project.status === 'MY_TASKS') {
                    allTasks = allTasks.filter(t => {
                        if (t.section?.project?.isTemplate) return false;
                        if (t.secondaryProjects?.some(sp => sp.project?.isTemplate)) return false;
                        return true;
                    });
                }
                
                section.tasks = allTasks.sort((a, b) => a.order - b.order);
                delete section.secondaryTasks;
            });
        }

        res.json(project);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Proje yüklenirken hata oluştu.', details: error.message });
    }
};

exports.createProject = async (req, res) => {
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
};

exports.duplicateProject = async (req, res) => {
    try {
        const { name, isTemplate, workspaceId, teamId } = req.body;
        const sourceProjectId = req.params.id;

        // Authorization: must have at least VIEWER role on source project
        const role = await getProjectRole(req.user.userId, sourceProjectId);
        if (!hasRole(role, 'VIEWER')) {
            return res.status(403).json({ error: 'Bu projeyi kopyalamak için yetkiniz yok.' });
        }

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
};

exports.saveAsTemplate = async (req, res) => {
    try {
        const sourceProjectId = req.params.id;

        // Authorization: must have ADMIN role to save as template
        const role = await getProjectRole(req.user.userId, sourceProjectId);
        if (role !== 'ADMIN') {
            return res.status(403).json({ error: 'Sadece proje yöneticisi şablon olarak kaydedebilir.' });
        }
        
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
};

exports.updateProject = async (req, res) => {
    try {
        const role = await getProjectRole(req.user.userId, req.params.id);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

        const { name, description, status, isArchived, defaultView, activeViews, customFieldSettings, formSettings, startDate, dueDate, color, icon, workspaceId, teamId, githubRepo, allowAutoCodeOnPR } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (status !== undefined) updateData.status = status;
        if (isArchived !== undefined) updateData.isArchived = isArchived;
        if (defaultView !== undefined) updateData.defaultView = defaultView;
        if (activeViews !== undefined) updateData.activeViews = activeViews;
        if (githubRepo !== undefined) updateData.githubRepo = githubRepo;
        if (allowAutoCodeOnPR !== undefined) updateData.allowAutoCodeOnPR = allowAutoCodeOnPR;
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
};

exports.toggleStar = async (req, res) => {
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
};

exports.deleteProject = async (req, res) => {
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
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SHARING / MEMBERS
// ═══════════════════════════════════════════════════════════════════════════════

exports.shareProject = async (req, res) => {
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
};

exports.updateMemberRole = async (req, res) => {
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
};

exports.removeMember = async (req, res) => {
    try {
        const callerRole = await getProjectRole(req.user.userId, req.params.id);
        if (callerRole !== 'ADMIN' && req.user.userId !== req.params.userId) {
            return res.status(403).json({ error: 'Sadece proje yöneticisi üyeleri veya kendi hesabınızı kaldırabilirsiniz.' });
        }

        await prisma.projectMembership.deleteMany({
            where: { projectId: req.params.id, userId: req.params.userId }
        });

        // Unassign any tasks assigned to this user in this project
        await prisma.task.updateMany({
            where: {
                section: { projectId: req.params.id },
                assigneeId: req.params.userId
            },
            data: { assigneeId: null }
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
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC FORMS
// ═══════════════════════════════════════════════════════════════════════════════

exports.getFormSettings = async (req, res) => {
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
};

exports.submitForm = async (req, res) => {
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
};

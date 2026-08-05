const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { evaluateRules } = require('../utils/ruleEngine');
const {
    getProjectRole,
    getProjectRoleFromTask,
    getProjectRoleFromSection,
    ensureMyTasksProject,
    processMentions,
    hasRole,
    fullTaskInclude
} = require('../utils/projectHelpers');

// ═══════════════════════════════════════════════════════════════════════════════
//  TASKS
// ═══════════════════════════════════════════════════════════════════════════════

exports.createTask = async (req, res) => {
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
        
        // Multi-home to assignee's My Tasks project
        if (assigneeId) {
            try {
                const myTasksProj = await ensureMyTasksProject(assigneeId);
                // Find "Recently assigned" section
                const recentlyAssignedSec = await prisma.section.findFirst({
                    where: { projectId: myTasksProj.id, name: 'Recently assigned' }
                });
                if (recentlyAssignedSec) {
                    await prisma.taskProject.create({
                        data: {
                            taskId: newTask.id,
                            projectId: myTasksProj.id,
                            sectionId: recentlyAssignedSec.id,
                            order: 0
                        }
                    });
                }
            } catch (err) {
                console.error('Error multi-homing to My Tasks on create:', err);
            }
        }

        res.status(201).json(newTask);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Görev oluşturulurken hata oluştu.', details: error.message });
    }
};

exports.moveTask = async (req, res) => {
    try {
        const { taskId, taskIds, targetSectionId, orderedTaskIds, projectId, taskPayloads } = req.body;
        
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
            const extraData = taskPayloads && taskPayloads[id] ? taskPayloads[id] : {};
            const updatePayload = {
                sectionId: targetSectionId,
                ...extraData,
                activities: { create: { action: `moved this task`, userId: req.user.userId } }
            };
            
            const primaryTask = await prisma.task.findFirst({
                where: { id: id, section: { projectId: safeProjectId } }
            });
            if (primaryTask) {
                await prisma.task.update({
                    where: { id: id },
                    data: updatePayload
                });
            } else if (safeProjectId) {
                // Secondary
                await prisma.taskProject.updateMany({
                    where: { taskId: id, projectId: safeProjectId },
                    data: { sectionId: targetSectionId }
                });
                if (Object.keys(extraData).length > 0) {
                    await prisma.task.update({
                        where: { id: id },
                        data: extraData
                    });
                }
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
};

exports.updateTask = async (req, res) => {
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
        
        // ─── My Tasks Sync ───────────────────────────────────────────────────
        if (assigneeId !== undefined && assigneeId !== currentTask.assigneeId) {
            try {
                // Remove from previous assignee's My Tasks if it exists
                if (currentTask.assigneeId) {
                    const prevMyTasksProj = await prisma.project.findFirst({
                        where: { status: 'MY_TASKS', ownerId: currentTask.assigneeId }
                    });
                    if (prevMyTasksProj) {
                        await prisma.taskProject.deleteMany({
                            where: { taskId: updatedTask.id, projectId: prevMyTasksProj.id }
                        });
                    }
                }
                
                // Add to new assignee's My Tasks
                if (assigneeId) {
                    const newMyTasksProj = await ensureMyTasksProject(assigneeId);
                    const recentlyAssignedSec = await prisma.section.findFirst({
                        where: { projectId: newMyTasksProj.id, name: 'Recently assigned' }
                    });
                    if (recentlyAssignedSec) {
                        await prisma.taskProject.create({
                            data: {
                                taskId: updatedTask.id,
                                projectId: newMyTasksProj.id,
                                sectionId: recentlyAssignedSec.id,
                                order: 0
                            }
                        });
                    }
                }
            } catch (err) {
                console.error('Error syncing My Tasks on task update:', err);
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
};

exports.convertToProject = async (req, res) => {
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
            include: fullTaskInclude
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
};

exports.deleteTask = async (req, res) => {
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
};

exports.duplicateTask = async (req, res) => {
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
};

exports.addMultiHome = async (req, res) => {
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
        if (io) io.to(targetProjectId).emit('task_created', task);

        res.status(201).json(taskProject);
    } catch (error) {
        console.error('Error adding task to project:', error);
        res.status(500).json({ error: 'Failed to add task to project.', details: error.message });
    }
};

exports.removeMultiHome = async (req, res) => {
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
};

exports.bulkUpdate = async (req, res) => {
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
};

exports.bulkDelete = async (req, res) => {
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
};

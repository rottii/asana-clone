const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Hierarchy: ADMIN > EDITOR > COMMENTER > VIEWER
const ROLE_LEVEL = { VIEWER: 0, COMMENTER: 1, EDITOR: 2, ADMIN: 3 };

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

async function getProjectRoleFromTask(userId, taskId) {
    const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { section: { select: { projectId: true } } }
    });
    if (!task?.section?.projectId) return null;
    return getProjectRole(userId, task.section.projectId);
}

async function getProjectRoleFromSection(userId, sectionId) {
    const section = await prisma.section.findUnique({
        where: { id: sectionId },
        select: { projectId: true }
    });
    if (!section) return null;
    return getProjectRole(userId, section.projectId);
}

async function ensureMyTasksProject(userId, workspaceId) {
    let myTasksProject = await prisma.project.findFirst({
        where: { status: 'MY_TASKS', ownerId: userId, workspaceId: workspaceId },
        include: { sections: true }
    });
    if (!myTasksProject) {
        myTasksProject = await prisma.project.create({
            data: {
                name: 'My Tasks',
                status: 'MY_TASKS',
                ownerId: userId,
                workspaceId: workspaceId,
                color: '#4F46E5',
                icon: '👤',
                sections: {
                    create: [
                        { name: 'Recently assigned', order: 1000 },
                        { name: 'Do today', order: 2000 },
                        { name: 'Do next week', order: 3000 },
                        { name: 'Do later', order: 4000 }
                    ]
                },
                members: {
                    create: { userId, role: 'ADMIN' }
                }
            },
            include: { sections: true }
        });
    }

    try {
        const recentlyAssignedSection = myTasksProject.sections.find(s => s.name === 'Recently assigned') || myTasksProject.sections[0];
        if (recentlyAssignedSection) {
            const assignedTasks = await prisma.task.findMany({
                where: { 
                    assigneeId: userId,
                    OR: [
                        { section: { project: { workspaceId: workspaceId } } },
                        { secondaryProjects: { some: { project: { workspaceId: workspaceId } } } }
                    ]
                },
                include: { secondaryProjects: true }
            });
            for (const task of assignedTasks) {
                const isPrimary = myTasksProject.sections.some(s => s.id === task.sectionId);
                const isSecondary = task.secondaryProjects.some(sp => sp.projectId === myTasksProject.id);
                if (!isPrimary && !isSecondary) {
                    const maxOrderTask = await prisma.taskProject.findFirst({
                        where: { sectionId: recentlyAssignedSection.id },
                        orderBy: { order: 'desc' }
                    });
                    const newOrder = maxOrderTask ? maxOrderTask.order + 1000 : 1000;
                    await prisma.taskProject.create({
                        data: {
                            taskId: task.id,
                            projectId: myTasksProject.id,
                            sectionId: recentlyAssignedSection.id,
                            order: newOrder
                        }
                    });
                }
            }
        }
    } catch (err) {
        console.error("Error migrating legacy tasks to My Tasks:", err);
    }

    return myTasksProject;
}

function hasRole(userRole, minimumRole) {
    if (!userRole) return false;
    return (ROLE_LEVEL[userRole] || 0) >= (ROLE_LEVEL[minimumRole] || 0);
}

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
                            project: { select: { id: true, name: true, color: true, icon: true, isTemplate: true, customFieldSettings: true, workspaceId: true, status: true, sections: { select: { id: true, name: true } } } },
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
                                    project: { select: { id: true, name: true, color: true, icon: true, isTemplate: true, customFieldSettings: true, workspaceId: true, status: true, sections: { select: { id: true, name: true } } } }
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
                                    project: { select: { id: true, name: true, color: true, icon: true, isTemplate: true, customFieldSettings: true, workspaceId: true, status: true, sections: { select: { id: true, name: true } } } },
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

module.exports = {
    ROLE_LEVEL,
    extractMentions,
    processMentions,
    getProjectRole,
    getProjectRoleFromTask,
    getProjectRoleFromSection,
    ensureMyTasksProject,
    hasRole,
    fullProjectInclude,
    fullTaskInclude
};

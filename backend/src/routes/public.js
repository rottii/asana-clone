const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Public route to fetch a read-only project dashboard by token
router.get('/projects/:token/dashboard', async (req, res) => {
    try {
        const { token } = req.params;
        const project = await prisma.project.findUnique({
            where: { publicToken: token }
        });

        if (!project || !project.isPublicDashboard) {
            return res.status(404).json({ error: 'This dashboard is not available or the link has expired.' });
        }

        // Fetch sections and basic task stats for the dashboard
        const taskSelectOpts = {
            id: true,
            title: true,
            isCompleted: true,
            createdAt: true,
            completedAt: true,
            dueDate: true,
            type: true,
            assigneeId: true,
            assignee: { select: { id: true, name: true } },
            creatorId: true,
            creator: { select: { id: true, name: true } },
            customFields: true,
            githubPRs: true
        };

        let sections = await prisma.section.findMany({
            where: { projectId: project.id },
            select: {
                id: true,
                name: true,
                order: true,
                tasks: { select: taskSelectOpts },
                secondaryTasks: {
                    select: {
                        order: true,
                        sectionId: true,
                        task: { select: taskSelectOpts }
                    }
                }
            },
            orderBy: { order: 'asc' }
        });

        // Merge secondary tasks into section.tasks (same as projectController.js)
        sections = sections.map(section => {
            const primaryTasks = section.tasks || [];
            const secondaryTasks = (section.secondaryTasks || []).map(st => ({
                ...st.task,
                order: st.order,
                sectionId: st.sectionId,
                isSecondary: true
            }));
            
            return {
                ...section,
                tasks: [...primaryTasks, ...secondaryTasks].sort((a, b) => a.order - b.order),
                secondaryTasks: undefined
            };
        });

        // Just return the project metadata and sections necessary for rendering charts
        res.json({
            id: project.id,
            name: project.name,
            description: project.description,
            color: project.color,
            icon: project.icon,
            status: project.status,
            customFieldSettings: project.customFieldSettings,
            dashboardLayout: project.dashboardLayout,
            sections: sections
        });

    } catch (error) {
        console.error('Error fetching public project dashboard:', error);
        res.status(500).json({ error: 'An error occurred while loading the dashboard.' });
    }
});

// Public route to fetch a read-only portfolio dashboard by token
router.get('/portfolios/:token/dashboard', async (req, res) => {
    try {
        const { token } = req.params;
        const portfolio = await prisma.portfolio.findUnique({
            where: { publicToken: token },
            include: {
                projects: {
                    include: {
                        project: {
                            select: {
                                id: true,
                                name: true,
                                status: true,
                                isArchived: true,
                                color: true,
                                owner: { select: { name: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!portfolio || !portfolio.isPublicDashboard) {
            return res.status(404).json({ error: 'This dashboard is not available or the link has expired.' });
        }

        res.json(portfolio);

    } catch (error) {
        console.error('Error fetching public portfolio dashboard:', error);
        res.status(500).json({ error: 'An error occurred while loading the dashboard.' });
    }
});

module.exports = router;

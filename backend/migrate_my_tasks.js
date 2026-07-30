const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Starting migration for existing My Tasks...');
  
  // Get all users
  const users = await prisma.user.findMany();
  
  for (const user of users) {
    console.log(`Processing user ${user.email} (${user.id})...`);
    
    // Find or create their MY_TASKS project
    let myTasksProject = await prisma.project.findFirst({
        where: { status: 'MY_TASKS', ownerId: user.id },
        include: { sections: true }
    });
    
    if (!myTasksProject) {
        myTasksProject = await prisma.project.create({
            data: {
                name: 'My Tasks',
                status: 'MY_TASKS',
                ownerId: user.id,
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
                    create: { userId: user.id, role: 'ADMIN' }
                }
            },
            include: { sections: true }
        });
    }

    const recentlyAssignedSection = myTasksProject.sections.find(s => s.name === 'Recently assigned') || myTasksProject.sections[0];
    
    // Find all tasks assigned to this user
    const assignedTasks = await prisma.task.findMany({
        where: { assigneeId: user.id },
        include: { secondaryProjects: true }
    });
    
    let migratedCount = 0;
    
    for (const task of assignedTasks) {
        // Check if task is already in the MY_TASKS project
        // EITHER its primary section is in MY_TASKS
        const isPrimary = myTasksProject.sections.some(s => s.id === task.sectionId);
        // OR it's multi-homed to MY_TASKS
        const isSecondary = task.secondaryProjects.some(sp => sp.projectId === myTasksProject.id);
        
        if (!isPrimary && !isSecondary) {
            // Task needs to be added to MY_TASKS
            // Find max order in Recently assigned
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
            migratedCount++;
        }
    }
    
    console.log(`Migrated ${migratedCount} tasks for user ${user.email}.`);
  }
  
  console.log('Migration complete!');
  process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('Fixing workspace memberships based on project memberships...');
    
    // Get all project memberships where the project has a workspace
    const projectMemberships = await prisma.projectMembership.findMany({
        include: {
            project: {
                select: { workspaceId: true }
            }
        }
    });

    for (const pm of projectMemberships) {
        if (!pm.project.workspaceId) continue;
        
        // Add the user to the workspace if they aren't already
        await prisma.workspaceMember.upsert({
            where: {
                workspaceId_userId: { 
                    workspaceId: pm.project.workspaceId, 
                    userId: pm.userId 
                }
            },
            update: {},
            create: {
                workspaceId: pm.project.workspaceId,
                userId: pm.userId,
                role: 'MEMBER'
            }
        });
    }
    
    console.log('Finished fixing workspace memberships.');
}

run().finally(() => prisma.$disconnect());

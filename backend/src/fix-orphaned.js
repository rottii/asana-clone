const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('Fixing projects with null workspaceId...');
    
    // Find projects with workspaceId: null
    const orphanedProjects = await prisma.project.findMany({
        where: { workspaceId: null }
    });

    console.log(`Found ${orphanedProjects.length} orphaned projects.`);

    for (const project of orphanedProjects) {
        // Find a workspace the owner belongs to
        const workspaceMember = await prisma.workspaceMember.findFirst({
            where: { userId: project.ownerId },
            include: { workspace: true }
        });

        if (workspaceMember) {
            await prisma.project.update({
                where: { id: project.id },
                data: { workspaceId: workspaceMember.workspaceId }
            });
            console.log(`Assigned project "${project.name}" to workspace "${workspaceMember.workspace.name}".`);
        } else {
            console.log(`Could not find a workspace for owner of project "${project.name}".`);
        }
    }
    
    console.log('Finished fixing orphaned projects.');
}

run().finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('Starting workspace team fix...');
    
    // Fetch all workspaces
    const workspaces = await prisma.workspace.findMany({
        include: {
            teams: true,
            members: true
        }
    });

    for (const workspace of workspaces) {
        let workTeam = workspace.teams.find(t => t.name.toLowerCase() === 'work');
        
        // If there is no "Work" team, create one
        if (!workTeam) {
            console.log(`Workspace "${workspace.name}" has no Work team. Creating one...`);
            
            // Get a user to be the admin (use the first workspace member or skip)
            if (workspace.members.length === 0) {
                console.log(`  - No members in workspace, skipping team creation.`);
                continue;
            }
            const adminUserId = workspace.members[0].userId;

            workTeam = await prisma.team.create({
                data: {
                    name: 'Work',
                    description: 'Default team',
                    workspaceId: workspace.id,
                    members: {
                        create: {
                            userId: adminUserId,
                            role: 'ADMIN'
                        }
                    }
                }
            });
            console.log(`  - Created Work team with ID: ${workTeam.id}`);
        }

        // Now move all projects in this workspace that don't have a team to this team
        const updatedProjects = await prisma.project.updateMany({
            where: { 
                workspaceId: workspace.id,
                teamId: null
            },
            data: { 
                teamId: workTeam.id 
            }
        });
        
        if (updatedProjects.count > 0) {
            console.log(`  - Assigned ${updatedProjects.count} projects to Work team.`);
        }
    }

    console.log('Finished workspace team fix.');
}

run().finally(() => prisma.$disconnect());

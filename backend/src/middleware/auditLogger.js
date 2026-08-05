const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const auditLogger = async (req, res, next) => {
    // Only log modifying requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        
        // Wait for the response to finish to capture status code
        res.on('finish', async () => {
            try {
                // If it's a 4xx or 5xx, it might have failed, but we can still log the attempt
                // Or we can choose to only log successful actions. Let's log everything for full audit.
                const userId = req.user?.userId || req.user?.id || null;
                
                let entity = 'Unknown';
                let action = `${req.method}_REQUEST`;
                
                // Very basic entity detection based on URL
                if (req.originalUrl.includes('/projects')) entity = 'Project';
                else if (req.originalUrl.includes('/tasks')) entity = 'Task';
                else if (req.originalUrl.includes('/users')) entity = 'User';
                else if (req.originalUrl.includes('/workspaces')) entity = 'Workspace';
                else if (req.originalUrl.includes('/auth')) entity = 'Auth';

                const details = {
                    method: req.method,
                    url: req.originalUrl,
                    status: res.statusCode,
                    body: req.method !== 'DELETE' ? req.body : undefined,
                    params: req.params,
                    query: req.query
                };

                // Remove sensitive info from body if necessary (e.g. passwords)
                if (details.body && details.body.password) {
                    details.body.password = '***';
                }

                await prisma.auditLog.create({
                    data: {
                        action: action,
                        entity: entity,
                        details: details,
                        ipAddress: req.ip || req.connection.remoteAddress,
                        userAgent: req.headers['user-agent'],
                        userId: userId
                    }
                });
            } catch (err) {
                console.error('Audit Log Error:', err);
            }
        });
    }
    
    next();
};

module.exports = auditLogger;

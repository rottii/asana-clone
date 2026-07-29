const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

module.exports = {
    extractMentions,
    processMentions
};

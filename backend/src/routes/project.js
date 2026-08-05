const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');

// Setup multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Import Controllers
const projectController = require('../controllers/projectController');
const sectionController = require('../controllers/sectionController');
const taskController = require('../controllers/taskController');
const commentController = require('../controllers/commentController');
const dependencyController = require('../controllers/dependencyController');
const tagController = require('../controllers/tagController');
const attachmentController = require('../controllers/attachmentController');

// Apply authentication to all routes except public forms
router.use((req, res, next) => {
    // Exclude GET /:id/form and POST /:id/form/submit from authentication
    if (req.path.endsWith('/form') || req.path.endsWith('/form/submit')) {
        return next();
    }
    return authenticateToken(req, res, next);
});

// ==========================================
// PROJECT ROUTES
// ==========================================
router.get('/templates', projectController.getTemplates);
router.get('/', projectController.getProjects);
router.post('/', projectController.createProject);
router.post('/:id/duplicate', projectController.duplicateProject);
router.post('/:id/save-as-template', projectController.saveAsTemplate);
router.patch('/:id', projectController.updateProject);
router.post('/:id/star', projectController.toggleStar);
router.delete('/:id', projectController.deleteProject);
router.get('/:id', projectController.getProjectById);

router.post('/:id/share', projectController.shareProject);
router.patch('/:id/members', projectController.updateMemberRole);
router.delete('/:id/members/:userId', projectController.removeMember);

router.get('/:id/form', projectController.getFormSettings);
router.post('/:id/form/submit', projectController.submitForm);

// ==========================================
// SECTION ROUTES
// ==========================================
router.post('/sections', sectionController.createSection);
router.patch('/sections/move', sectionController.moveSection);
router.patch('/sections/:sectionId', sectionController.renameSection);
router.delete('/sections/:sectionId', sectionController.deleteSection);

// ==========================================
// TASK ROUTES
// ==========================================
router.patch('/tasks/bulk-update', taskController.bulkUpdate);
router.delete('/tasks/bulk-delete', taskController.bulkDelete);

router.post('/tasks', taskController.createTask);
router.patch('/tasks/move', taskController.moveTask);
router.post('/tasks/:taskId/convert-to-project', taskController.convertToProject);
router.post('/tasks/:taskId/duplicate', taskController.duplicateTask);
router.patch('/tasks/:taskId', taskController.updateTask);
router.delete('/tasks/:taskId', taskController.deleteTask);

router.post('/tasks/:taskId/projects', taskController.addMultiHome);
router.delete('/tasks/:taskId/projects/:projectId', taskController.removeMultiHome);

// ==========================================
// COMMENT & REACTION ROUTES
// ==========================================
router.post('/tasks/:taskId/comments', commentController.createComment);
router.delete('/tasks/:taskId/comments/:commentId', commentController.deleteComment);
router.post('/tasks/:taskId/comments/:commentId/reactions', commentController.toggleReaction);

// ==========================================
// DEPENDENCY ROUTES
// ==========================================
router.post('/tasks/:taskId/dependencies', dependencyController.addDependency);
router.delete('/tasks/:taskId/dependencies/:dependencyId', dependencyController.removeDependency);

// ==========================================
// TAG ROUTES
// ==========================================
router.post('/:projectId/tasks/:taskId/tags', tagController.addTag);
router.delete('/:projectId/tasks/:taskId/tags/:tagId', tagController.removeTag);

// ==========================================
// ATTACHMENT ROUTES
// ==========================================
router.post('/tasks/:taskId/attachments', upload.single('file'), attachmentController.uploadAttachment);
router.get('/tasks/:taskId/attachments', attachmentController.getAttachments);
router.delete('/attachments/:attachmentId', attachmentController.deleteAttachment);

module.exports = router;

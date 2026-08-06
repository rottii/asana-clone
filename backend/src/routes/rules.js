const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router({ mergeParams: true }); // projectId alabilmek için
const { evaluateRules } = require('../utils/ruleEngine');
const { authenticateToken } = require('../middleware/auth');
const { getProjectRole, hasRole } = require('../utils/projectHelpers');

// 1. Projeye ait tüm kuralları getir
router.get('/', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  try {
    // Authorization: must be at least VIEWER on the project
    const role = await getProjectRole(req.user.userId, projectId);
    if (!hasRole(role, 'VIEWER')) {
      return res.status(403).json({ error: 'Bu projenin kurallarını görüntüleme yetkiniz yok.' });
    }

    const rules = await prisma.rule.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(rules);
  } catch (error) {
    console.error('Kurallar getirilirken hata:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. Projeye yeni kural ekle
router.post('/', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  const { ruleData, isActive } = req.body;

  if (!ruleData || !ruleData.trigger) {
    return res.status(400).json({ error: 'Geçersiz kural yapısı. (ruleData.trigger eksik)' });
  }

  try {
    // Authorization: must be at least EDITOR on the project
    const role = await getProjectRole(req.user.userId, projectId);
    if (!hasRole(role, 'EDITOR')) {
      return res.status(403).json({ error: 'Kural eklemek için yetkiniz yok. (Editor veya üstü gerekli)' });
    }

    const newRule = await prisma.rule.create({
      data: {
        projectId,
        ruleData,
        isActive: isActive !== undefined ? isActive : true
      }
    });
    res.status(201).json(newRule);
  } catch (error) {
    console.error('Kural eklenirken hata:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. Projeden kural sil
router.delete('/:ruleId', authenticateToken, async (req, res) => {
  const { projectId, ruleId } = req.params;
  try {
    // Authorization: must be ADMIN on the project
    const role = await getProjectRole(req.user.userId, projectId);
    if (role !== 'ADMIN') {
      return res.status(403).json({ error: 'Sadece proje yöneticisi kuralları silebilir.' });
    }

    await prisma.rule.delete({
      where: { id: ruleId }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Kural silinirken hata:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 4. Projedeki kuralı güncelle
router.put('/:ruleId', authenticateToken, async (req, res) => {
  const { projectId, ruleId } = req.params;
  const { ruleData, isActive } = req.body;

  if (!ruleData || !ruleData.trigger) {
    return res.status(400).json({ error: 'Geçersiz kural yapısı. (ruleData.trigger eksik)' });
  }

  try {
    // Authorization: must be at least EDITOR on the project
    const role = await getProjectRole(req.user.userId, projectId);
    if (!hasRole(role, 'EDITOR')) {
      return res.status(403).json({ error: 'Kural güncellemek için yetkiniz yok. (Editor veya üstü gerekli)' });
    }

    const updatedRule = await prisma.rule.update({
      where: { id: ruleId },
      data: {
        ruleData,
        isActive: isActive !== undefined ? isActive : true
      }
    });
    res.json(updatedRule);
  } catch (error) {
    console.error('Kural güncellenirken hata:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 5. Kuralı manuel çalıştır
router.post('/:ruleId/run/:taskId', authenticateToken, async (req, res) => {
  const { projectId, ruleId, taskId } = req.params;
  try {
    // Authorization: must be at least EDITOR on the project
    const role = await getProjectRole(req.user.userId, projectId);
    if (!hasRole(role, 'EDITOR')) {
      return res.status(403).json({ error: 'Kural çalıştırmak için yetkiniz yok. (Editor veya üstü gerekli)' });
    }

    const rule = await prisma.rule.findUnique({ where: { id: ruleId } });
    if (!rule) return res.status(404).json({ error: 'Kural bulunamadı' });

    // evaluateRules assumes event.type matches rule.triggerType for exact matches
    // But since this is a manual run, we just pass the exact triggerType of the rule so it triggers
    await evaluateRules(projectId, taskId, { type: 'rule_run_manually' });
    
    res.json({ success: true, message: 'Kural çalıştırıldı' });
  } catch (error) {
    console.error('Kural manuel çalıştırılırken hata:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

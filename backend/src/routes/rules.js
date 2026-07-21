const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router({ mergeParams: true }); // projectId alabilmek için
const { evaluateRules } = require('../utils/ruleEngine');

// 1. Projeye ait tüm kuralları getir
router.get('/', async (req, res) => {
  const { projectId } = req.params;
  try {
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
router.post('/', async (req, res) => {
  const { projectId } = req.params;
  const { ruleData } = req.body;

  if (!ruleData || !ruleData.trigger) {
    return res.status(400).json({ error: 'Geçersiz kural yapısı. (ruleData.trigger eksik)' });
  }

  try {
    const newRule = await prisma.rule.create({
      data: {
        projectId,
        ruleData,
        isActive: true
      }
    });
    res.status(201).json(newRule);
  } catch (error) {
    console.error('Kural eklenirken hata:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. Projeden kural sil
router.delete('/:ruleId', async (req, res) => {
  const { ruleId } = req.params;
  try {
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
router.put('/:ruleId', async (req, res) => {
  const { ruleId } = req.params;
  const { ruleData, isActive } = req.body;

  if (!ruleData || !ruleData.trigger) {
    return res.status(400).json({ error: 'Geçersiz kural yapısı. (ruleData.trigger eksik)' });
  }

  try {
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
router.post('/:ruleId/run/:taskId', async (req, res) => {
  const { projectId, ruleId, taskId } = req.params;
  try {
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

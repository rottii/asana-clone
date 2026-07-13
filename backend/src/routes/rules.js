const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router({ mergeParams: true }); // projectId alabilmek için

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
  const { triggerType, triggerValue, actionType, actionValue } = req.body;

  if (!triggerType || !actionType) {
    return res.status(400).json({ error: 'Tetikleyici ve Aksiyon gereklidir.' });
  }

  try {
    const newRule = await prisma.rule.create({
      data: {
        projectId,
        triggerType,
        triggerValue,
        actionType,
        actionValue
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
  const { triggerType, triggerValue, actionType, actionValue } = req.body;

  if (!triggerType || !actionType) {
    return res.status(400).json({ error: 'Tetikleyici ve Aksiyon gereklidir.' });
  }

  try {
    const updatedRule = await prisma.rule.update({
      where: { id: ruleId },
      data: {
        triggerType,
        triggerValue,
        actionType,
        actionValue
      }
    });
    res.json(updatedRule);
  } catch (error) {
    console.error('Kural güncellenirken hata:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

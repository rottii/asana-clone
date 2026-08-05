const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const { JWT_SECRET } = require('../config/env');

const { authenticateToken } = require('../middleware/auth');

// 1. Kullanıcının tüm portföylerini getir
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { workspaceId } = req.query;
    
    // Filtreyi duruma göre oluştur
    const filter = { ownerId: req.user.userId };
    if (workspaceId) {
      filter.workspaceId = workspaceId;
    }

    const portfolios = await prisma.portfolio.findMany({
      where: filter,
      include: {
        projects: {
          include: {
            project: {
              include: {
                owner: true,
                sections: {
                  include: {
                    tasks: true
                  }
                }
              }
            }
          }
        },
        childPortfolios: {
          include: {
            childPortfolio: true
          }
        },
        owner: true,
        starredBy: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Her proje için Task progress hesaplaması
    const formattedPortfolios = portfolios.map(port => {
      return {
        ...port,
        projectsCount: port.projects.length,
        projectsList: port.projects.map(pp => {
          const p = pp.project;
          let totalTasks = 0;
          let completedTasks = 0;
          
          if (p.sections) {
            p.sections.forEach(sec => {
              if (sec.tasks) {
                totalTasks += sec.tasks.length;
                completedTasks += sec.tasks.filter(t => t.isCompleted).length;
              }
            });
          }
          
          const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

          return {
            ...p,
            taskProgress: progress
          };
        }),
        childPortfoliosList: port.childPortfolios ? port.childPortfolios.map(cp => cp.childPortfolio) : []
      };
    });

    res.json(formattedPortfolios);
  } catch (error) {
    console.error("Error fetching portfolios:", error);
    res.status(500).json({ error: 'Portföyler yüklenemedi.' });
  }
});

// 2. Yeni portföy oluştur
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, privacy, defaultView, workspaceId } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Portföy adı gereklidir.' });
    }
    
    if (!workspaceId) {
      return res.status(400).json({ error: 'Çalışma alanı (workspaceId) gereklidir.' });
    }

    const workspaceExists = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspaceExists) {
      return res.status(400).json({ error: 'Belirtilen çalışma alanı (workspace) bulunamadı. Lütfen tarayıcınızın önbelleğini temizleyin veya sayfayı yenileyin.' });
    }

    const newPortfolio = await prisma.portfolio.create({
      data: {
        name,
        privacy: privacy || 'Public to My workspace',
        defaultView: defaultView || 'List',
        ownerId: req.user.userId,
        workspaceId
      },
      include: {
        projects: true,
        childPortfolios: true,
        owner: true
      }
    });

    res.status(201).json({ ...newPortfolio, projectsCount: 0, projectsList: [], childPortfoliosList: [] });
  } catch (error) {
    console.error("Error creating portfolio:", error);
    res.status(500).json({ error: 'Portföy oluşturulamadı.' });
  }
});

// 3. Portföy detayını getir (İçindeki projelerle birlikte)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: {
        projects: {
          include: {
            project: {
              include: {
                owner: true,
                sections: {
                  include: {
                    tasks: true
                  }
                }
              }
            }
          }
        },
        childPortfolios: {
          include: {
            childPortfolio: true
          }
        },
        owner: true,
        starredBy: true
      }
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portföy bulunamadı.' });
    }

    // Task progress hesaplaması
    const projectsList = portfolio.projects.map(pp => {
      const p = pp.project;
      let totalTasks = 0;
      let completedTasks = 0;
      
      if (p.sections) {
        p.sections.forEach(sec => {
          if (sec.tasks) {
            totalTasks += sec.tasks.length;
            completedTasks += sec.tasks.filter(t => t.isCompleted).length;
          }
        });
      }
      
          const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

      return {
        ...p,
        taskProgress: progress
      };
    });

    res.json({
      ...portfolio,
      projectsCount: portfolio.projects.length,
      projectsList,
      childPortfoliosList: portfolio.childPortfolios ? portfolio.childPortfolios.map(cp => cp.childPortfolio) : []
    });
  } catch (error) {
    console.error("Error fetching portfolio detail:", error);
    res.status(500).json({ error: 'Portföy detayları yüklenemedi.' });
  }
});

// 4. Portföye proje ekle
router.post('/:id/projects', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Proje ID gereklidir.' });
    }
    
    const portfolioProject = await prisma.portfolioProject.create({
      data: {
        portfolioId: id,
        projectId: projectId
      },
      include: {
        project: {
          include: {
            owner: true,
            sections: {
              include: {
                tasks: true
              }
            }
          }
        }
      }
    });
    
    // Geriye eklenen projenin task progress bilgisiyle beraber dönüyoruz
    const p = portfolioProject.project;
    let totalTasks = 0;
    let completedTasks = 0;
    
    if (p.sections) {
      p.sections.forEach(sec => {
        if (sec.tasks) {
          totalTasks += sec.tasks.length;
          completedTasks += sec.tasks.filter(t => t.isCompleted).length;
        }
      });
    }
    
    const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    res.status(201).json({
      ...p,
      taskProgress: progress
    });
  } catch (error) {
    console.error("Error adding project to portfolio:", error);
    if (error.code === 'P2002') { // Unique constraint failed
        return res.status(400).json({ error: 'Proje zaten bu portföye ekli.' });
    }
    res.status(500).json({ error: 'Proje portföye eklenemedi.' });
  }
});

// 5. Portföye portföy ekle
router.post('/:id/portfolios', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { childPortfolioId } = req.body;

    if (!childPortfolioId) {
      return res.status(400).json({ error: 'Eklenecek portföy ID gereklidir.' });
    }
    
    // Kendisini kendisine eklemeyi engelle
    if (id === childPortfolioId) {
      return res.status(400).json({ error: 'Bir portföy kendisine eklenemez.' });
    }

    const portfolioPortfolio = await prisma.portfolioPortfolio.create({
      data: {
        parentPortfolioId: id,
        childPortfolioId: childPortfolioId
      },
      include: {
        childPortfolio: true
      }
    });

    res.status(201).json(portfolioPortfolio.childPortfolio);
  } catch (error) {
    console.error("Error adding portfolio to portfolio:", error);
    if (error.code === 'P2002') { 
        return res.status(400).json({ error: 'Bu portföy zaten ekli.' });
    }
    res.status(500).json({ error: 'Portföy eklenemedi.' });
  }
});

// 6. Portföyü güncelle (Yeniden adlandır)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Yeni portföy adı gereklidir.' });
    }

    const updatedPortfolio = await prisma.portfolio.update({
      where: { id },
      data: { name }
    });

    res.json(updatedPortfolio);
  } catch (error) {
    console.error("Error updating portfolio:", error);
    res.status(500).json({ error: 'Portföy güncellenemedi.' });
  }
});

// 7. Portföyü sil
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // We can just delete it, and cascade will handle the related PortfolioProject / PortfolioPortfolio if set up,
    // otherwise we might need to delete those first. Let's assume Prisma handles it.
    await prisma.portfolio.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting portfolio:", error);
    res.status(500).json({ error: 'Portföy silinemedi.' });
  }
});

// POST /api/portfolios/:id/star — Toggle star status for a portfolio
router.post('/:id/star', authenticateToken, async (req, res) => {
  try {
    const portfolioId = req.params.id;
    const userId = req.user.userId;

    const existingStar = await prisma.starredPortfolio.findUnique({
      where: {
        userId_portfolioId: {
          userId,
          portfolioId
        }
      }
    });

    if (existingStar) {
      await prisma.starredPortfolio.delete({
        where: { id: existingStar.id }
      });
      res.json({ isStarred: false });
    } else {
      await prisma.starredPortfolio.create({
        data: { userId, portfolioId }
      });
      res.json({ isStarred: true });
    }
  } catch (error) {
    console.error('Error toggling portfolio star:', error);
    res.status(500).json({ error: 'Yıldız durumu güncellenirken hata oluştu.', details: error.message });
  }
});

module.exports = router;

import React, { useState, useEffect } from 'react';

export default function Portfolios({
  portfolios = [],
  setPortfolios,
  token,
  setActiveView,
  setSelectedPortfolio,
  portfolioCreationParent,
  setPortfolioCreationParent,
  activeWorkspaceId
}) {
  const [activeTab, setActiveTab] = useState('Recent and starred');
  const [creationStep, setCreationStep] = useState(0); // 0 = list, 1 = create step 1, 2 = create step 2

  useEffect(() => {
    if (portfolioCreationParent) {
      setCreationStep(1);
    }
  }, [portfolioCreationParent]);

  // Step 1 states
  const [portfolioName, setPortfolioName] = useState('portfolio');
  const [privacy, setPrivacy] = useState('Public to My workspace');
  const [shareAccess, setShareAccess] = useState('Share project access manually');
  const [defaultView, setDefaultView] = useState('List');

  // Step 2 states
  const [nextAction, setNextAction] = useState('projects'); // 'projects' or 'share'
  const [createdPortfolio, setCreatedPortfolio] = useState(null);

  if (creationStep === 1) {
    return (
      <div style={styles.creationContainer}>
        <div style={styles.creationHeader}>
          <button style={styles.backBtn} onClick={() => setCreationStep(0)}>←</button>
        </div>
        <div style={styles.creationContent}>
          <h1 style={styles.creationTitle}>New portfolio</h1>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Portfolio name</label>
            <input
              style={styles.formInput}
              value={portfolioName}
              onChange={(e) => setPortfolioName(e.target.value)}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Privacy</label>
            <select
              style={styles.formSelect}
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value)}
            >
              <option>Public to My workspace</option>
              <option>Private to portfolio members</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <div style={styles.labelRow}>
              <label style={styles.formLabel}>Share project access with portfolio members</label>
              <a href="#" style={styles.learnMore}>Learn more</a>
            </div>
            <select
              style={styles.formSelect}
              value={shareAccess}
              onChange={(e) => setShareAccess(e.target.value)}
            >
              <option>Share project access manually</option>
              <option>Share project access by default</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Default view</label>
            <div style={styles.viewCardsGrid}>
              <div
                style={{ ...styles.viewCard, ...(defaultView === 'List' ? styles.viewCardSelected : {}) }}
                onClick={() => setDefaultView('List')}
              >
                <div style={styles.viewCardIcon}>
                  <div style={defaultView === 'List' ? styles.iconBlue : styles.iconGray}>
                    <div style={styles.fakeListRow}></div>
                    <div style={styles.fakeListRow}></div>
                  </div>
                </div>
                <div style={styles.viewCardText}>List</div>
              </div>

              <div
                style={{ ...styles.viewCard, ...(defaultView === 'Timeline' ? styles.viewCardSelected : {}) }}
                onClick={() => setDefaultView('Timeline')}
              >
                <div style={styles.viewCardIcon}>
                  <div style={defaultView === 'Timeline' ? styles.iconBlue : styles.iconGray}>
                    <div style={styles.fakeTimeline}></div>
                  </div>
                </div>
                <div style={styles.viewCardText}>Timeline</div>
              </div>

              <div
                style={{ ...styles.viewCard, ...(defaultView === 'Workload' ? styles.viewCardSelected : {}) }}
                onClick={() => setDefaultView('Workload')}
              >
                <div style={styles.viewCardIcon}>
                  <div style={defaultView === 'Workload' ? styles.iconBlue : styles.iconGray}>
                    <div style={styles.fakeWorkload}></div>
                  </div>
                </div>
                <div style={styles.viewCardText}>Workload</div>
              </div>
            </div>
          </div>

          <button style={styles.continueBtn} onClick={() => {
            fetch('http://localhost:5001/api/portfolios', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                name: portfolioName,
                privacy,
                defaultView,
                workspaceId: activeWorkspaceId
              })
            })
              .then(res => res.json())
              .then(data => {
                if (data.id) {
                  setPortfolios([data, ...portfolios]);
                  setCreatedPortfolio(data);

                  if (portfolioCreationParent) {
                    fetch(`http://localhost:5001/api/portfolios/${portfolioCreationParent}/portfolios`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ childPortfolioId: data.id })
                    })
                      .then(res => res.json())
                      .then(() => {
                        if (setPortfolioCreationParent) setPortfolioCreationParent(null);
                        setCreationStep(2);
                      })
                      .catch(err => {
                        console.error(err);
                        if (setPortfolioCreationParent) setPortfolioCreationParent(null);
                        setCreationStep(2);
                      });
                  } else {
                    setCreationStep(2);
                  }
                }
              })
              .catch(err => console.error(err));
          }}>Continue</button>
        </div>
      </div>
    );
  }

  if (creationStep === 2) {
    return (
      <div style={styles.creationContainer}>
        <div style={styles.creationHeader}>
          <button style={styles.backBtn} onClick={() => setCreationStep(1)}>←</button>
        </div>
        <div style={styles.creationContent}>
          <h1 style={styles.creationTitleCenter}>What do you want to do first?</h1>

          <div
            style={{ ...styles.actionCard, ...(nextAction === 'projects' ? styles.actionCardSelected : {}) }}
            onClick={() => setNextAction('projects')}
          >
            <div style={styles.actionIconCircle}>+</div>
            <div>
              <div style={styles.actionCardTitle}>Start adding projects</div>
              <div style={styles.actionCardSub}>Add projects and track their progress</div>
            </div>
          </div>

          <div
            style={{ ...styles.actionCard, ...(nextAction === 'share' ? styles.actionCardSelected : {}) }}
            onClick={() => setNextAction('share')}
          >
            <div style={styles.actionIconUsers}>👥</div>
            <div>
              <div style={styles.actionCardTitle}>Share with teammates</div>
              <div style={styles.actionCardSub}>Invite teammates to collaborate</div>
            </div>
          </div>

          <button style={styles.continueBtn} onClick={() => {
            setCreationStep(0);
            setSelectedPortfolio(createdPortfolio);
            setActiveView('portfolio_detail');
          }}>Go to portfolio</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerArea}>
        <div style={styles.headerTop}>
          <h1 style={styles.pageTitle}>Portfolios</h1>
          {activeTab === 'Recent and starred' && (
            <button style={styles.createBtn} onClick={() => setCreationStep(1)}>Create portfolio</button>
          )}
        </div>

        <div style={styles.tabsAndActionsRow}>
          <div style={styles.tabsContainer}>
            <div
              style={{ ...styles.tab, ...(activeTab === 'Recent and starred' ? styles.activeTab : {}) }}
              onClick={() => setActiveTab('Recent and starred')}
            >
              Recent and starred
            </div>
            <div
              style={{ ...styles.tab, ...(activeTab === 'Browse all' ? styles.activeTab : {}) }}
              onClick={() => setActiveTab('Browse all')}
            >
              Browse all
            </div>
          </div>

          {activeTab === 'Browse all' && (
            <div style={styles.browseAllActions}>
              <div style={styles.actionItem}><span style={{ marginRight: 4 }}>≡</span> Filter</div>
              <div style={styles.actionItem}><span style={{ marginRight: 4 }}>⇅</span> Sort: Last modified (Newest)</div>
              <div style={styles.actionItem}>🔍</div>
              <button style={styles.createBtn} onClick={() => setCreationStep(1)}>Create portfolio</button>
            </div>
          )}
        </div>
      </div>

      <div style={styles.contentArea}>
        {activeTab === 'Recent and starred' ? (
          <div style={styles.recentSection}>
            <div style={styles.recentHeader}>
              <div style={styles.recentTitle}>▼ Recent portfolios</div>
              <div style={styles.gridIcon}>⊞</div>
            </div>

            <div style={styles.gridContainer}>
              <div style={styles.newPortfolioCard} onClick={() => setCreationStep(1)}>
                <div style={styles.plusIcon}>+</div>
                <div style={styles.newPortfolioText}>New portfolio</div>
              </div>

              {portfolios.map(portfolio => (
                <div key={portfolio.id} style={styles.portfolioCard} onClick={() => {
                  setSelectedPortfolio(portfolio);
                  setActiveView('portfolio_detail');
                }}>
                  <div style={styles.folderShape}>
                    <div style={styles.folderTab}></div>
                    <div style={styles.folderBody}></div>
                    <div style={styles.memberBadge}>{portfolio.owner?.name?.[0]?.toUpperCase() || 'U'}</div>
                  </div>
                  <div style={styles.portfolioName}>{portfolio.name}</div>
                  <div style={styles.portfolioSub}>{portfolio.projectsCount || 0} projects</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={styles.listViewSection}>
            <div style={styles.listHeader}>
              <div style={{ ...styles.listHeaderCell, flex: 2 }}>Name</div>
              <div style={{ ...styles.listHeaderCell, flex: 1 }}>Members</div>
              <div style={{ ...styles.listHeaderCell, flex: 2 }}>Parent portfolios</div>
              <div style={{ ...styles.listHeaderCell, width: '120px' }}></div>
            </div>

            <div style={styles.listBody}>
              {portfolios.map(portfolio => (
                <div key={portfolio.id} style={styles.listRow} onClick={() => {
                  setSelectedPortfolio(portfolio);
                  setActiveView('portfolio_detail');
                }}>
                  <div style={{ ...styles.listCell, flex: 2 }}>
                    <div style={styles.listNameWrapper}>
                      <div style={styles.listFolderIcon}>📁</div>
                      <div>
                        <div style={styles.listNameText}>{portfolio.name}</div>
                        <div style={styles.listJoinedText}>Joined</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ ...styles.listCell, flex: 1 }}>
                    <div style={styles.memberBadgeSmall}>{portfolio.owner?.name?.[0]?.toUpperCase() || 'U'}</div>
                  </div>
                  <div style={{ ...styles.listCell, flex: 2 }}>
                  </div>
                  <div style={{ ...styles.listCell, width: '120px', justifyContent: 'flex-end', gap: '16px' }}>
                    <div style={styles.starIcon}>☆</div>
                    <button style={styles.shareBtn}>Share</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  },
  headerArea: {
    padding: '24px 32px 0 32px',
    borderBottom: '1px solid var(--border-color)'
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '500',
    margin: 0,
    color: 'var(--text-primary)'
  },
  createBtn: {
    padding: '6px 12px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.1s'
  },
  tabsAndActionsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabsContainer: {
    display: 'flex',
    gap: '24px',
  },
  tab: {
    paddingBottom: '12px',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
  },
  activeTab: {
    color: 'var(--text-primary)',
    fontWeight: '500',
    borderBottom: '2px solid var(--text-primary)'
  },
  browseAllActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    paddingBottom: '8px'
  },
  actionItem: {
    display: 'flex',
    alignItems: 'center',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    cursor: 'pointer'
  },
  contentArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '32px'
  },
  recentSection: {
    maxWidth: '800px'
  },
  recentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border-color)',
    marginBottom: '24px'
  },
  recentTitle: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    fontWeight: '500',
    cursor: 'pointer'
  },
  gridIcon: {
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    fontSize: '16px'
  },
  gridContainer: {
    display: 'flex',
    gap: '32px'
  },
  newPortfolioCard: {
    width: '140px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer'
  },
  plusIcon: {
    width: '100px',
    height: '100px',
    border: '1px dashed var(--border-color)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: 'var(--text-secondary)'
  },
  newPortfolioText: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    textAlign: 'center'
  },
  portfolioCard: {
    width: '140px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer'
  },
  folderShape: {
    width: '100px',
    height: '80px',
    position: 'relative',
    marginTop: '20px'
  },
  folderTab: {
    width: '40px',
    height: '15px',
    backgroundColor: 'var(--text-tertiary)',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px',
    position: 'absolute',
    top: '-10px',
    left: '0'
  },
  folderBody: {
    width: '100%',
    height: '100%',
    backgroundColor: 'var(--text-tertiary)',
    borderRadius: '8px',
    position: 'absolute',
    top: '0',
    left: '0'
  },
  memberBadge: {
    position: 'absolute',
    bottom: '-10px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#F9A8D4', // Pinkish
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 'bold',
    border: '2px solid var(--bg-primary)'
  },
  portfolioName: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    textAlign: 'center',
    marginTop: '4px'
  },
  portfolioSub: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    textAlign: 'center'
  },
  listViewSection: {
    width: '100%'
  },
  listHeader: {
    display: 'flex',
    padding: '0 16px 12px 16px',
    borderBottom: '1px solid var(--border-color)'
  },
  listHeaderCell: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '500'
  },
  listBody: {
    display: 'flex',
    flexDirection: 'column'
  },
  listRow: {
    display: 'flex',
    padding: '12px 16px',
    borderBottom: '1px solid var(--bg-tertiary)',
    alignItems: 'center',
    backgroundColor: 'var(--bg-secondary)', // Slight gray background like screenshot
    cursor: 'pointer'
  },
  listCell: {
    display: 'flex',
    alignItems: 'center'
  },
  listNameWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  listFolderIcon: {
    fontSize: '20px',
    color: 'var(--text-tertiary)'
  },
  listNameText: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    fontWeight: '400'
  },
  listJoinedText: {
    fontSize: '12px',
    color: '#10B981' // Green
  },
  memberBadgeSmall: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#F9A8D4',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 'bold'
  },
  starIcon: {
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    fontSize: '16px'
  },
  shareBtn: {
    padding: '4px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '13px',
    cursor: 'pointer'
  },
  // Wizard Styles
  creationContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--bg-primary)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  },
  creationHeader: {
    padding: '24px 32px'
  },
  backBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: 'var(--text-secondary)'
  },
  creationContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '500px',
    margin: '0 auto',
    width: '100%',
    paddingBottom: '40px'
  },
  creationTitle: {
    fontSize: '28px',
    fontWeight: '400',
    color: 'var(--text-primary)',
    marginBottom: '32px'
  },
  creationTitleCenter: {
    fontSize: '28px',
    fontWeight: '400',
    color: 'var(--text-primary)',
    marginBottom: '32px',
    textAlign: 'center'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '24px'
  },
  formLabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginBottom: '8px'
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  learnMore: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    textDecoration: 'underline'
  },
  formInput: {
    padding: '8px 12px',
    border: 'none',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '4px',
    fontSize: '14px',
    color: 'var(--text-primary)',
    outline: 'none'
  },
  formSelect: {
    padding: '8px 12px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: '4px',
    fontSize: '14px',
    color: 'var(--text-primary)',
    outline: 'none'
  },
  viewCardsGrid: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap'
  },
  viewCard: {
    flex: 1,
    minWidth: '130px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.1s'
  },
  viewCardSelected: {
    border: '1px solid var(--accent-primary)',
    backgroundColor: 'var(--bg-tertiary)'
  },
  viewCardIcon: {
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px'
  },
  iconGray: {
    color: 'var(--text-tertiary)'
  },
  iconBlue: {
    color: 'var(--accent-primary)'
  },
  fakeListRow: {
    width: '24px',
    height: '4px',
    backgroundColor: 'currentColor',
    borderRadius: '2px',
    margin: '4px 0'
  },
  fakeTimeline: {
    width: '24px',
    height: '12px',
    borderTop: '2px solid currentColor',
    borderBottom: '2px solid currentColor'
  },
  fakeWorkload: {
    width: '24px',
    height: '16px',
    borderBottom: '2px solid currentColor',
    borderLeft: '2px solid currentColor'
  },
  viewCardText: {
    fontSize: '13px',
    color: 'var(--text-primary)'
  },
  continueBtn: {
    padding: '10px 16px',
    backgroundColor: 'var(--accent-primary)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '16px'
  },
  actionCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '24px',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    cursor: 'pointer',
    marginBottom: '16px',
    transition: 'all 0.1s'
  },
  actionCardSelected: {
    border: '1px solid var(--accent-primary)',
    backgroundColor: 'var(--bg-tertiary)'
  },
  actionIconCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '2px dashed var(--accent-primary)',
    color: 'var(--accent-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    marginRight: '16px'
  },
  actionIconUsers: {
    width: '40px',
    height: '40px',
    color: 'var(--accent-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    marginRight: '16px'
  },
  actionCardTitle: {
    fontSize: '16px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    marginBottom: '4px'
  },
  actionCardSub: {
    fontSize: '13px',
    color: 'var(--text-secondary)'
  }
};

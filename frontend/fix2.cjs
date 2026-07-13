const fs = require('fs');
const path = '/app/src/components/ProjectListView.jsx';
let text = fs.readFileSync(path, 'utf8');

text = text.replace(/Yeniden Adland.r/g, 'Yeniden Adlandır');
text = text.replace(/B.l.m. Sil/g, 'Bölümü Sil');
text = text.replace(/.* Unassigned/g, '👤 Unassigned');

text = text.replace(/<span style=\{\{ fontSize: '1rem' \}\}>.*?<\/span> Edit field/g, "<span style={{ fontSize: '1rem' }}>✏️</span> Edit field");
text = text.replace(/âœ ï¸ /g, "✏️");
text = text.replace(/ğŸ‘¥/g, "👥");
text = text.replace(/âœ•/g, "✕");
text = text.replace(/âŒ„/g, "⌄");

text = text.replace(/<div style=\{\{ cursor: 'grab', color: 'var\(--text-tertiary\)', padding: '0 0.2rem', display: 'flex', alignItems: 'center', userSelect: 'none', fontSize: '1.2rem' \}\}>.*?<\/div>/g, "<div style={{ cursor: 'grab', color: 'var(--text-tertiary)', padding: '0 0.2rem', display: 'flex', alignItems: 'center', userSelect: 'none', fontSize: '1.2rem' }}>⋮⋮</div>");
text = text.replace(/drag6DotHandleCellTask">\s*.*?\s*<\/div>/g, 'drag6DotHandleCellTask">\n                        ⋮⋮\n                      </div>');
text = text.replace(/drag6DotHandleCell">\s*.*?\s*<\/div>/g, 'drag6DotHandleCell">\n                 ⋮⋮\n                </div>');

text = text.replace(/accordionArrowIcon\}>.*?<\/span>/g, "accordionArrowIcon}>{isCollapsed ? '▶' : '▼'}</span>");

text = text.replace(/Alphabetical' && \(activeSort\?\.direction === 'asc' \? '.*?' : '.*?'\)\}/g, "Alphabetical' && (activeSort.direction === 'asc' ? '↑' : '↓')}");
text = text.replace(/title && \(activeSort\?\.direction === 'asc' \? '.*?' : '.*?'\)\}/g, "title && (activeSort.direction === 'asc' ? '↑' : '↓')}");

text = text.replace(/styles\.columnHeaderMenuBtn\}>.*?<\/button>/g, "styles.columnHeaderMenuBtn}>▼</button>");

text = text.replace(/fieldMenuIcon\}>.*?<\/span> Single-select/g, 'fieldMenuIcon}>▼</span> Single-select');
text = text.replace(/fieldMenuIcon\}>.*?<\/span> Multi-select/g, 'fieldMenuIcon}>▼</span> Multi-select');
text = text.replace(/fieldMenuIcon\}>.*?<\/span> Date/g, 'fieldMenuIcon}>📅</span> Date');
text = text.replace(/fieldMenuIcon\}>.*?<\/span> People/g, 'fieldMenuIcon}>👤</span> People');
text = text.replace(/fieldMenuIcon\}>.*?<\/span> Reference/g, 'fieldMenuIcon}>🔗</span> Reference');
text = text.replace(/fieldMenuIcon\}>.*?<\/span> Formula/g, 'fieldMenuIcon}>ƒ(x)</span> Formula');
text = text.replace(/fieldMenuIcon\}>.*?<\/span> ID/g, 'fieldMenuIcon}>🆔</span> ID');
text = text.replace(/fieldMenuIcon\}>.*?<\/span> Timer/g, 'fieldMenuIcon}>⏱️</span> Timer');
text = text.replace(/fieldMenuIcon\}>.*?<\/span> Time tracking/g, 'fieldMenuIcon}>⏱️</span> Time tracking');
text = text.replace(/fieldMenuIcon\}>.*?<\/span> Rollup/g, 'fieldMenuIcon}>🔍</span> Rollup');

text = text.replace(/onClick=\{\(\) => handleRemoveOption\(opt\.id\)\} style=\{\{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: '1\.2rem', cursor: 'pointer' \}\}>.*?<\/button>/g, 
"onClick={() => handleRemoveOption(opt.id)} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>");
text = text.replace(/onClick=\{handleAddOption\} style=\{\{ background: 'none', border: 'none', color: 'var\(--text-secondary\)', padding: 0, fontSize: '0\.85rem', cursor: 'pointer', marginTop: '0\.8rem', display: 'flex', alignItems: 'center' \}\}><span style=\{\{ fontSize: '1\.2rem', marginRight: '0\.2rem' \}\}>.*?<\/span> Add option<\/button>/g,
"onClick={handleAddOption} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', padding: 0, fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ fontSize: '1.2rem', marginRight: '0.2rem' }}>+</span> Add option</button>");

text = text.replace(/threeDotButton">\s*.*?\s*<\/button>/g, 'threeDotButton">\n                    ⋮\n                    </button>');

fs.writeFileSync(path, text, 'utf8');

const fs = require('fs');
const path = 'C:\\Users\\iboro\\OneDrive\\Belgeler\\Asana-Clone antigravity\\frontend\\src\\components\\ProjectListView.jsx';
let text = fs.readFileSync(path, 'utf8');

const regex = /handleSaveProjectSettings\(\{\s*customFieldSettings:\s*newCustomFields\s*\}\);\s*setEditingFieldOptions\(false\);\s*\}\}>Save changes<\/button>\s*Name \{activeSort\?\.field === 'Alphabetical'/;

const replacement = \handleSaveProjectSettings({ customFieldSettings: newCustomFields });
                  setEditingFieldOptions(false); 
              }}>\ + 'Save changes</button>' + \
            </div>
          </div>
        </div>
      )}

      {/* Grid Tablo Başlık Sütunları */}
      <div style={styles.listTableHeaderRow}>
        <div style={{ width: '32px', flexShrink: 0 }}></div>
        <div 
          style={{ ...styles.gridHeaderCell, width: colWidths.name, flexShrink: 0, paddingLeft: '2.5rem', position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onMouseEnter={() => setHoveredColumnName('name')}
          onMouseLeave={() => setHoveredColumnName(null)}
          onClick={() => handleSortOptionClick && handleSortOptionClick('Alphabetical')}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, fontWeight: activeSort?.field === 'Alphabetical' ? '700' : '500' }}>
            Name {activeSort?.field === 'Alphabetical'\;

text = text.replace(regex, replacement);
fs.writeFileSync(path, text, 'utf8');

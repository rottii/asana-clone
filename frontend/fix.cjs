const fs = require('fs');
const path = '/app/src/components/ProjectListView.jsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("Yeniden")) lines[i] = "                  <button onClick={() => { setEditingSectionId(section.id); setEditSectionNameValue(section.name); setOpenSectionMenuId(null); }} style={styles.dropdownItem}>Yeniden AdlandÄ±r</button>";
  if (lines[i].includes("Sil</button>")) lines[i] = "                  <button onClick={() => { if (onDeleteSection) onDeleteSection(section.id); setOpenSectionMenuId(null); }} style={styles.dropdownItemDelete}>BÃ¶lÃ¼mÃ¼ Sil</button>";
  if (lines[i].includes("Unassigned")) lines[i] = "                                <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>ğŸ‘¤ Unassigned</span>";
  if (lines[i].includes("Edit field")) lines[i] = "                                  <span style={{ fontSize: '1rem' }}>âœï¸</span> Edit field";
  if (lines[i].includes("styles.drag6DotHandleCellTask")) lines[i+2] = "                        â‹®â‹®";
  if (lines[i].includes("styles.drag6DotHandleCell") && !lines[i].includes("Task")) {
     if (!lines[i].includes("justifyContent")) {
         lines[i+2] = "                  â‹®â‹®";
     }
  }
  if (lines[i].includes("styles.accordionArrowIcon")) lines[i] = "                <span style={styles.accordionArrowIcon}>{isCollapsed ? 'â–¶' : 'â–¼'}</span>";
  if (lines[i].includes("styles.threeDotButton")) lines[i+2] = "                    â‹®";
  
  if (lines[i].includes("Name {activeSort")) lines[i] = "              Name {activeSort?.field === 'Alphabetical' && (activeSort.direction === 'asc' ? 'â†‘' : 'â†“')}";
  if (lines[i].includes("title} {activeSort")) lines[i] = "                {title} {activeSort?.field === title && (activeSort.direction === 'asc' ? 'â†‘' : 'â†“')}";
  if (lines[i].includes("styles.columnHeaderMenuBtn")) lines[i] = lines[i].replace(/>[^<]+<\/button>/, '>â–¼</button>');
  
  if (lines[i].includes("Single-select")) lines[i] = "              <button onClick={() => { setIsAddFieldModalOpen(true); setShowAddFieldMenu(false); }} style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>â–¼</span> Single-select</button>";
  if (lines[i].includes("Multi-select")) lines[i] = "              <button style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>â–¼</span> Multi-select</button>";
  if (lines[i].includes("> Date<")) lines[i] = "              <button style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>ğŸ“…</span> Date</button>";
  if (lines[i].includes("> People<")) lines[i] = "              <button style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>ğŸ‘¤</span> People</button>";
  if (lines[i].includes("> Reference<")) lines[i] = "              <button style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>ğŸ”—</span> Reference</button>";
  if (lines[i].includes("> Formula<")) lines[i] = "              <button style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>Æ’(x)</span> Formula</button>";
  if (lines[i].includes("> ID<")) lines[i] = "              <button style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>ğŸ†”</span> ID</button>";
  if (lines[i].includes("> Timer<")) lines[i] = "              <button style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>â±ï¸</span> Timer</button>";
  if (lines[i].includes("> Time tracking<")) lines[i] = "              <button style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>â±ï¸</span> Time tracking</button>";
  if (lines[i].includes("> Rollup<")) lines[i] = "              <button style={styles.addFieldMenuItem}><span style={styles.fieldMenuIcon}>ğŸ”</span> Rollup</button>";
  
  if (lines[i].includes("handleRemoveOption")) lines[i] = lines[i].replace(/>[^<]+<\/button>/, '>âœ•</button>');
  if (lines[i].includes("handleAddOption")) lines[i] = lines[i].replace(/<span style={{ fontSize: '1\.2rem', marginRight: '0\.2rem' }}>[^<]+<\/span>/, "<span style={{ fontSize: '1.2rem', marginRight: '0.2rem' }}>+</span>");
}

// Add option fix
for (let i = 0; i < lines.length; i++) {
   if (lines[i].includes("handleAddOption")) {
      lines[i] = "              <button onClick={handleAddOption} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', padding: 0, fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ fontSize: '1.2rem', marginRight: '0.2rem' }}>+</span> Add option</button>";
   }
   if (lines[i].includes("cursor: 'grab'")) {
       if (lines[i].includes("</div>")) {
           lines[i] = "                    <div style={{ cursor: 'grab', color: 'var(--text-tertiary)', padding: '0 0.2rem', display: 'flex', alignItems: 'center', userSelect: 'none', fontSize: '1.2rem' }}>â‹®â‹®</div>";
       }
   }
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Fixed encoding issues');



const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'backend', 'src', 'routes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'auth.js');

let totalModified = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Regex to match the inline authenticateToken function
  const regex = /const authenticateToken = \(req, res, next\) => \{[\s\S]*?next\(\);\s*\}\)?;\s*\};?/g;
  
  if (regex.test(content)) {
    // Replace with the require statement
    content = content.replace(regex, "const { authenticateToken } = require('../middleware/auth');");
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
    totalModified++;
  } else {
    // Check if it's already using require or something else
    if (content.includes('const { authenticateToken } = require')) {
      console.log(`Skipped ${file} (already using require)`);
    } else if (content.includes('const authenticateToken =')) {
      console.log(`Found authenticateToken in ${file} but regex didn't match.`);
    } else {
      console.log(`No authenticateToken found in ${file}`);
    }
  }
}

console.log(`Total files modified: ${totalModified}`);

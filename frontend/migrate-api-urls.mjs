import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, 'src');
const logLines = [];

function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules') collectFiles(full, files);
    } else if ((entry.endsWith('.jsx') || entry.endsWith('.js')) && entry !== 'api.js') {
      files.push(full);
    }
  }
  return files;
}

const files = collectFiles(SRC_DIR);
let totalReplacements = 0;
let modifiedFiles = 0;

for (const filePath of files) {
  let content = readFileSync(filePath, 'utf-8');
  const relPath = relative(SRC_DIR, filePath);
  const depth = relPath.split(/[\\/]/).length - 1;
  let importPath = depth === 0 ? './api' : '../'.repeat(depth) + 'api';

  let needsApiFetch = false;
  let needsApiBaseUrl = false;
  let needsAssetUrl = false;
  let replacements = 0;

  content = content.replace(
    /fetch\(\s*`http:\/\/localhost:5001(\/[^`]*)`/g,
    (m, path) => { needsApiFetch = true; replacements++; return `apiFetch(\`${path}\``; }
  );
  content = content.replace(
    /fetch\(\s*'http:\/\/localhost:5001(\/[^']*)'/g,
    (m, path) => { needsApiFetch = true; replacements++; return `apiFetch('${path}'`; }
  );
  content = content.replace(
    /fetch\(\s*"http:\/\/localhost:5001(\/[^"]*)"/g,
    (m, path) => { needsApiFetch = true; replacements++; return `apiFetch("${path}"`; }
  );
  content = content.replace(
    /io\(\s*['"]http:\/\/localhost:5001['"]\s*\)/g,
    () => { needsApiBaseUrl = true; replacements++; return 'io(API_BASE_URL)'; }
  );
  content = content.replace(
    /`http:\/\/localhost:5001(\/uploads\/[^`]*)`/g,
    (m, path) => { needsAssetUrl = true; replacements++; return `assetUrl(\`${path}\`)`; }
  );
  content = content.replace(
    /`http:\/\/localhost:5001(\/[^`]*)`/g,
    (m, path) => { needsApiBaseUrl = true; replacements++; return `\`\${API_BASE_URL}${path}\``; }
  );
  content = content.replace(
    /(['"])http:\/\/localhost:5001(\/[^'"]*)\1/g,
    (m, q, path) => { needsApiBaseUrl = true; replacements++; return `\`\${API_BASE_URL}${path}\``; }
  );

  if (replacements === 0) continue;

  const imports = [];
  if (needsApiFetch) imports.push('apiFetch');
  if (needsAssetUrl) imports.push('assetUrl');
  if (needsApiBaseUrl) imports.push('API_BASE_URL');
  const importLine = `import { ${imports.join(', ')} } from '${importPath}'`;

  if (!content.includes(`from '${importPath}'`) && !content.includes(`from "${importPath}"`)) {
    const lines = content.split('\n');
    let lastImportLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trimStart().startsWith('import ')) lastImportLine = i;
    }
    if (lastImportLine >= 0) {
      lines.splice(lastImportLine + 1, 0, importLine);
    } else {
      lines.unshift(importLine);
    }
    content = lines.join('\n');
  }

  totalReplacements += replacements;
  modifiedFiles++;
  writeFileSync(filePath, content, 'utf-8');
  logLines.push(`OK ${relPath}: ${replacements}`);
}

logLines.push(`DONE ${totalReplacements} replacements in ${modifiedFiles} files`);
writeFileSync(join(__dirname, 'migration-log.txt'), logLines.join('\n'), 'utf-8');

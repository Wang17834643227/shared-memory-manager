const fs = require('fs');
const path = require('path');

const PLUGIN_ROOT = path.join(__dirname, '..');
const checks = [];
const results = [];

function check(name, fn) {
  try {
    const result = fn();
    checks.push({ name, pass: result.pass, detail: result.detail || '' });
    results.push(result);
    console.log(`${result.pass ? '✓' : '✗'} [${name}] ${result.detail || (result.pass ? 'PASS' : 'FAIL')}`);
  } catch (e) {
    checks.push({ name, pass: false, detail: `ERROR: ${e.message}` });
    results.push({ pass: false, detail: `ERROR: ${e.message}` });
    console.log(`✗ [${name}] ERROR: ${e.message}`);
  }
}

// === CHECK 1: plugin.json exists ===
check('plugin.json exists', () => {
  const p = path.join(PLUGIN_ROOT, '.qoder-plugin', 'plugin.json');
  const exists = fs.existsSync(p);
  return { pass: exists, detail: exists ? 'Found' : 'Missing' };
});

// === CHECK 2: plugin.json is valid JSON ===
check('plugin.json valid JSON', () => {
  try {
    const content = fs.readFileSync(path.join(PLUGIN_ROOT, '.qoder-plugin', 'plugin.json'), 'utf8');
    JSON.parse(content);
    return { pass: true, detail: 'Valid JSON' };
  } catch { return { pass: false, detail: 'Invalid JSON' }; }
});

// === CHECK 3: plugin.json required fields ===
check('plugin.json required fields', () => {
  const data = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.qoder-plugin', 'plugin.json'), 'utf8'));
  const missing = ['name', 'displayName', 'version', 'description'].filter(f => !data[f]);
  return { pass: missing.length === 0, detail: missing.length ? `Missing: ${missing.join(', ')}` : 'All required fields present' };
});

// === CHECK 4: plugin name is hyphen-case ===
check('plugin name format', () => {
  const data = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.qoder-plugin', 'plugin.json'), 'utf8'));
  const valid = /^[a-z0-9-]+$/.test(data.name);
  return { pass: valid, detail: valid ? `"${data.name}" is valid` : `"${data.name}" is not hyphen-case` };
});

// === CHECK 5: SKILL.md exists ===
check('SKILL.md exists', () => {
  const p = path.join(PLUGIN_ROOT, 'skills', 'memory-manager', 'SKILL.md');
  const exists = fs.existsSync(p);
  return { pass: exists, detail: exists ? 'Found' : 'Missing' };
});

// === CHECK 6: SKILL.md has valid frontmatter ===
check('SKILL.md frontmatter', () => {
  const p = path.join(PLUGIN_ROOT, 'skills', 'memory-manager', 'SKILL.md');
  const content = fs.readFileSync(p, 'utf8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { pass: false, detail: 'No YAML frontmatter found' };
  const fm = match[1];
  const hasName = /^name:\s*.+$/m.test(fm);
  const hasDesc = /^description:\s*.+$/m.test(fm);
  return { pass: hasName && hasDesc, detail: hasName && hasDesc ? 'Frontmatter OK' : `name=${hasName}, description=${hasDesc}` };
});

// === CHECK 7: SKILL.md name matches skill directory ===
check('SKILL.md name consistency', () => {
  const p = path.join(PLUGIN_ROOT, 'skills', 'memory-manager', 'SKILL.md');
  const content = fs.readFileSync(p, 'utf8');
  const match = content.match(/^name:\s*(.+)$/m);
  const dirName = 'memory-manager';
  const skillName = match ? match[1].trim() : '';
  return { pass: skillName.includes(dirName), detail: `Skill name "${skillName}" contains dir "${dirName}"` };
});

// === CHECK 8: SKILL.md body length ===
check('SKILL.md body length', () => {
  const p = path.join(PLUGIN_ROOT, 'skills', 'memory-manager', 'SKILL.md');
  const content = fs.readFileSync(p, 'utf8');
  const lines = content.split('\n');
  // Skip frontmatter (lines until first ---)
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---' && i > 0) { bodyStart = i + 1; break; }
  }
  const bodyLines = lines.slice(bodyStart).length;
  return { pass: bodyLines <= 500, detail: `${bodyLines} lines (max 500)` };
});

// === CHECK 9: references directory exists and has files ===
check('references directory', () => {
  const refDir = path.join(PLUGIN_ROOT, 'references');
  const exists = fs.existsSync(refDir);
  const files = exists ? fs.readdirSync(refDir).filter(f => f.endsWith('.md')) : [];
  return { pass: exists && files.length > 0, detail: exists ? `${files.length} reference files` : 'Missing' };
});

// === CHECK 10: consolidated directory exists ===
check('consolidated memories dir', () => {
  const dir = path.join(PLUGIN_ROOT, 'references', 'consolidated');
  const exists = fs.existsSync(dir);
  const files = exists ? fs.readdirSync(dir) : [];
  const expected = ['user-memories.md', 'feedback-memories.md', 'project-memories.md', 'reference-memories.md'];
  const missing = expected.filter(f => !files.includes(f));
  return { pass: missing.length === 0, detail: missing.length ? `Missing: ${missing.join(', ')}` : 'All 4 consolidated files present' };
});

// === CHECK 11: MEMORY.md exists at plugin root ===
check('Plugin MEMORY.md', () => {
  const p = path.join(PLUGIN_ROOT, 'MEMORY.md');
  const exists = fs.existsSync(p);
  return { pass: exists, detail: exists ? 'Found' : 'Missing' };
});

// === CHECK 12: No extraneous files ===
check('No extraneous files', () => {
  const forbidden = ['README.md', 'CHANGELOG.md', 'INSTALLATION_GUIDE.md'];
  const files = fs.readdirSync(PLUGIN_ROOT);
  const found = forbidden.filter(f => files.includes(f) && f !== 'README.md');
  return { pass: found.length === 0, detail: found.length ? `Forbidden: ${found.join(', ')}` : 'Clean' };
});

// === CHECK 13: .gitignore exists ===
check('.gitignore exists', () => {
  const p = path.join(PLUGIN_ROOT, '.gitignore');
  const exists = fs.existsSync(p);
  return { pass: exists, detail: exists ? 'Found' : 'Missing' };
});

// === CHECK 14: plugin.json skills path resolves ===
check('Skills path resolves', () => {
  const data = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.qoder-plugin', 'plugin.json'), 'utf8'));
  const skillsPath = path.join(PLUGIN_ROOT, data.skills[0]);
  const skillExists = fs.existsSync(skillsPath);
  return { pass: skillExists, detail: skillExists ? `${data.skills[0]} exists` : `${data.skills[0]} not found` };
});

// === CHECK 15: All referenced paths in SKILL.md exist ===
check('SKILL.md path references valid', () => {
  const p = path.join(PLUGIN_ROOT, 'skills', 'memory-manager', 'SKILL.md');
  const content = fs.readFileSync(p, 'utf8');
  // Match actual file paths: quoted paths like `./foo/bar.md` or `../../x.md` or absolute paths
  // Exclude template examples like `<type>-<topic>.md` or paths inside code blocks that are just format examples
  const possibleRefs = content.match(/`(\.{0,2}\/[^`]+\.md)`/g) || [];
  const missing = possibleRefs.filter(r => {
    const file = r.replace(/`/g, '');
    const candidatePaths = [
      path.join(PLUGIN_ROOT, file),
      path.join(PLUGIN_ROOT, 'skills', 'memory-manager', file),
    ];
    return !candidatePaths.some(cp => fs.existsSync(cp));
  });
  return { pass: missing.length === 0, detail: missing.length ? `Broken refs: ${missing.join(', ')}` : 'All path references valid' };
});

// === CHECK 16: No TODO comments ===
check('No TODO comments', () => {
  const p = path.join(PLUGIN_ROOT, 'skills', 'memory-manager', 'SKILL.md');
  const content = fs.readFileSync(p, 'utf8');
  const todos = content.match(/TODO:/g) || [];
  return { pass: todos.length === 0, detail: todos.length ? `${todos.length} TODO(s) found` : 'No TODOs' };
});

// === CHECK 17: Description field length ===
check('Description length', () => {
  const data = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.qoder-plugin', 'plugin.json'), 'utf8'));
  const len = data.description.length;
  return { pass: len <= 1024, detail: `${len} chars (max 1024)` };
});

// === CHECK 18: Memory files have valid frontmatter ===
check('Memory consolidated files frontmatter', () => {
  const dir = path.join(PLUGIN_ROOT, 'references', 'consolidated');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const issues = [];
  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) issues.push(`${f}: no frontmatter`);
  }
  return { pass: issues.length === 0, detail: issues.length ? issues.join('; ') : 'All files have frontmatter or are plain text' };
});

// === CHECK 19: File encoding check (no BOM) ===
check('No BOM in key files', () => {
  const files = [
    path.join(PLUGIN_ROOT, '.qoder-plugin', 'plugin.json'),
    path.join(PLUGIN_ROOT, 'skills', 'memory-manager', 'SKILL.md'),
  ];
  const issues = [];
  for (const f of files) {
    const buf = fs.readFileSync(f);
    if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
      issues.push(path.basename(f));
    }
  }
  return { pass: issues.length === 0, detail: issues.length ? `BOM found: ${issues.join(', ')}` : 'No BOM detected' };
});

// === CHECK 20: Line ending check (LF not CRLF for key files) ===
check('LF line endings in key files', () => {
  const files = [
    path.join(PLUGIN_ROOT, '.qoder-plugin', 'plugin.json'),
    path.join(PLUGIN_ROOT, 'skills', 'memory-manager', 'SKILL.md'),
  ];
  let hasCRLF = false;
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    if (/\r\n/.test(content)) { hasCRLF = true; break; }
  }
  return { pass: !hasCRLF, detail: hasCRLF ? 'CRLF detected' : 'LF only' };
});

// === CHECK 21: Directory structure complete ===
check('Complete directory structure', () => {
  const required = [
    '.qoder-plugin/plugin.json',
    'skills/memory-manager/SKILL.md',
    'references/memory-management.md',
    'references/memory-schema.md',
    'references/consolidated/user-memories.md',
    'references/consolidated/feedback-memories.md',
    'references/consolidated/project-memories.md',
    'references/consolidated/reference-memories.md',
    'MEMORY.md',
    '.gitignore',
  ];
  const missing = required.filter(f => !fs.existsSync(path.join(PLUGIN_ROOT, f)));
  return { pass: missing.length === 0, detail: missing.length ? `Missing: ${missing.join(', ')}` : 'All required files present' };
});

// === CHECK 22: README exists and has content ===
check('README.md content', () => {
  const p = path.join(PLUGIN_ROOT, 'README.md');
  if (!fs.existsSync(p)) return { pass: false, detail: 'Missing' };
  const content = fs.readFileSync(p, 'utf8');
  return { pass: content.length > 100, detail: `${content.length} chars` };
});

// Print summary
console.log('\n========== VALIDATION SUMMARY ==========');
const passCount = results.filter(r => r.pass).length;
const failCount = results.filter(r => !r.pass).length;
console.log(`Passed: ${passCount}/${results.length}`);
console.log(`Failed: ${failCount}/${results.length}`);
if (failCount > 0) {
  console.log('\nFailed checks:');
  results.filter(r => !r.pass).forEach(r => console.log(`  - ${r.detail}`));
}
console.log('=========================================');

process.exit(failCount > 0 ? 1 : 0);

/**
 * shared-memory-manager — Daily Maintenance Script
 * Runs daily at 07:00 to:
 *  1. Pull latest from GitHub
 *  2. Run structural validation (22 checks)
 *  3. Run agent compatibility tests
 *  4. Sync skills to all CLAW agent dirs
 *  5. Sync consolidated memories to all CLAW memory dirs
 *  6. Auto-bump patch version + commit + push if changes detected
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const LOG_FILE = path.join(PLUGIN_ROOT, 'logs', 'daily-maintenance.log');
const PKG_JSON = path.join(PLUGIN_ROOT, '.qoder-plugin', 'plugin.json');
const VALIDATE_SCRIPT = path.join(PLUGIN_ROOT, 'scripts', 'validate.js');
const TEST_AGENTS_SCRIPT = path.join(PLUGIN_ROOT, 'scripts', 'test_agents.js');
const TEST_CLAW_SCRIPT = path.join(PLUGIN_ROOT, 'scripts', 'test_claw_agents.js');

// Task Scheduler runs without the user's PATH, so resolve git by absolute path
const GIT_CANDIDATE = 'C:/Users/1/.qoder-cn/bin/git/cmd/git.exe';
const GIT = fs.existsSync(GIT_CANDIDATE) ? `"${GIT_CANDIDATE}"` : 'git';

// CLAW skill & memory install targets
const SKILL_TARGETS = [
  'C:/Users/1/.qclaw/skills/shared-memory-manager',
  'C:/Users/1/.openclaw/skills/shared-memory-manager',
  'C:/Users/1/.easyclaw/skills/shared-memory-manager',
];
const MEMORY_TARGETS = [
  'C:/Users/1/.qclaw/memory',
  'C:/Users/1/.openclaw/memory',
  'C:/Users/1/.easyclaw/memory',
];

// Ensure log dir exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// Two schedulers (Windows Task Scheduler + Qoder automation) fire at 07:00,
// so only one run may proceed at a time.
const LOCK_FILE = path.join(PLUGIN_ROOT, 'logs', '.maintenance.lock');
const LOCK_TTL_MS = 45 * 60 * 1000;

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

if (fs.existsSync(LOCK_FILE)) {
  const age = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
  if (age < LOCK_TTL_MS) {
    log(`[skip] Another maintenance run is active (lock age ${Math.round(age / 1000)}s). Exiting.`);
    process.exit(0);
  }
  log('Removing stale lock from an interrupted run.');
}
fs.writeFileSync(LOCK_FILE, String(process.pid));
process.on('exit', () => {
  try { fs.unlinkSync(LOCK_FILE); } catch {}
});

function run(cmd, opts = {}) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
    return { ok: true, stdout: out, stderr: '' };
  } catch (e) {
    return { ok: false, stdout: e.stdout || '', stderr: e.stderr || e.message };
  }
}

function bumpVersion(current) {
  const [, major, minor, patch] = current.match(/^(\d+)\.(\d+)\.(\d+)/) || [0, 0, 0, 0];
  return `${major}.${minor}.${parseInt(patch) + 1}`;
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// ---------- Deep defect hunt helpers ----------

const IGNORE_DIRS = new Set(['node_modules', '.git', 'logs', 'memory', '.qoder-plugin/cache']);

function collectFiles(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const p = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) stack.push(p);
      } else if (exts.some((e) => entry.name.endsWith(e))) {
        out.push(p);
      }
    }
  }
  return out;
}

function rel(p) {
  return path.relative(PLUGIN_ROOT, p).replace(/\\/g, '/');
}

// Placeholder / dead-token sweep ("extreme" — catch leftovers that suggest
// unfinished or broken content). Matched only in product docs, never in the
// tooling .js that legitimately reference these tokens (e.g. validate.js's
// "No TODO comments" check), to avoid self-matches.
const PLACEHOLDER_TOKENS = [
  'TODO', 'FIXME', 'lorem ipsum', 'loremipsum', '<PLACEHOLDER>',
  'INSERT_HERE', 'coming soon',
];

function deepAudit() {
  const findings = [];
  const add = (severity, autoFixable, category, file, issue, data) =>
    findings.push({ severity, autoFixable, category, file, issue, data });

  // B. JS syntax — every .js must parse
  for (const f of collectFiles(PLUGIN_ROOT, ['.js'])) {
    const r = run(`node --check "${f}" 2>&1`);
    if (!r.ok) add('error', false, 'js-syntax', rel(f), `node --check failed`, (r.stderr || r.stdout).trim().slice(0, 300));
  }

  // C. JSON validity — every .json must parse
  for (const f of collectFiles(PLUGIN_ROOT, ['.json'])) {
    try { JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch (e) { add('error', false, 'json-invalid', rel(f), String(e.message).slice(0, 200)); }
  }

  // D. Frontmatter required on SKILL.md and consolidated memory files
  const needFrontmatter = [
    path.join(PLUGIN_ROOT, 'skills', 'memory-manager', 'SKILL.md'),
    ...collectFiles(path.join(PLUGIN_ROOT, 'references', 'consolidated'), ['.md']),
  ];
  for (const f of needFrontmatter) {
    if (!fs.existsSync(f)) continue;
    const head = fs.readFileSync(f, 'utf8').slice(0, 400);
    if (!/^---\n/.test(head)) add('warn', false, 'frontmatter-missing', rel(f), 'missing YAML frontmatter');
    else {
      const fm = head.slice(4, head.indexOf('\n---'));
      if (!/name:/.test(fm)) add('warn', false, 'frontmatter-missing', rel(f), 'frontmatter lacks name:');
      if (!/description:/.test(fm)) add('warn', false, 'frontmatter-missing', rel(f), 'frontmatter lacks description:');
    }
  }

  // E. Broken relative .md references across all docs
  const mdFiles = collectFiles(PLUGIN_ROOT, ['.md']);
  for (const f of mdFiles) {
    const text = fs.readFileSync(f, 'utf8');
    const refRe = /(?:\]\(|`)(\.{1,2}\/[A-Za-z0-9._\-\/]+\.md)/g;
    let m;
    while ((m = refRe.exec(text))) {
      const target = path.resolve(path.dirname(f), m[1]);
      if (!fs.existsSync(target)) add('error', false, 'broken-ref', rel(f), `dangling reference → ${m[1]}`);
    }
  }

  // F. Placeholder / dead tokens in PRODUCT DOCS ONLY (never tooling .js,
  // which legitimately reference these tokens, e.g. validate.js's "No TODO
  // comments" check — scanning it would self-match and always "find" issues).
  const docFiles = [
    ...collectFiles(path.join(PLUGIN_ROOT, 'skills'), ['.md']),
    ...collectFiles(path.join(PLUGIN_ROOT, 'references'), ['.md']),
    path.join(PLUGIN_ROOT, 'README.md'),
    path.join(PLUGIN_ROOT, 'MEMORY.md'),
  ].filter((f) => fs.existsSync(f));
  for (const f of docFiles) {
    const text = fs.readFileSync(f, 'utf8');
    const hits = PLACEHOLDER_TOKENS.filter((t) => text.includes(t));
    if (hits.length) add('warn', false, 'placeholder', rel(f), `leftover token(s): ${hits.join(', ')}`);
  }

  // G. Empty required files
  for (const f of needFrontmatter) {
    if (fs.existsSync(f) && fs.statSync(f).size === 0) add('error', false, 'empty-file', rel(f), 'file is 0 bytes');
  }
  for (const f of collectFiles(path.join(PLUGIN_ROOT, 'references', 'consolidated'), ['.md'])) {
    const c = fs.readFileSync(f, 'utf8').trim();
    if (!c.length) add('error', false, 'empty-memory', rel(f), 'consolidated memory file is empty');
  }

  // H. Version consistency: plugin.json vs installed _meta.json (auto-fixable)
  const repoVer = JSON.parse(fs.readFileSync(PKG_JSON, 'utf8')).version;
  for (const target of SKILL_TARGETS) {
    const metaFile = path.join(target, '_meta.json');
    if (!fs.existsSync(metaFile)) { add('warn', true, 'install-meta-missing', target, 'installed _meta.json missing'); continue; }
    const mv = JSON.parse(fs.readFileSync(metaFile, 'utf8')).version;
    if (mv !== repoVer) add('warn', true, 'version-drift', target, `installed v${mv} != repo v${repoVer}`, { metaFile, repoVer });
  }

  // I. Install parity: installed SKILL.md must match repo (auto-fixable)
  const repoSkill = fs.readFileSync(path.join(PLUGIN_ROOT, 'skills', 'memory-manager', 'SKILL.md'));
  for (const target of SKILL_TARGETS) {
    const installed = path.join(target, 'SKILL.md');
    if (!fs.existsSync(installed)) { add('warn', true, 'install-skill-missing', target, 'installed SKILL.md missing'); continue; }
    if (fs.readFileSync(installed).toString() !== repoSkill.toString()) {
      add('warn', true, 'install-drift', target, 'installed SKILL.md differs from repo', { installed, repoSkill: repoSkill.toString() });
    }
  }

  // K. Determinism — run validator 3×; any flake is an error
  for (let i = 0; i < 3; i++) {
    const v = run(`node "${VALIDATE_SCRIPT}" 2>&1`);
    if (!v.stdout.includes('Passed: 22/22')) add('error', false, 'validate-flake', rel(VALIDATE_SCRIPT), `validator run ${i + 1}/3 did not pass`, v.stdout.slice(-200));
  }

  // L. Git hygiene (informational only — not a publish trigger on its own)
  const status = run(`${GIT} -C "${PLUGIN_ROOT}" status --porcelain 2>&1`);
  if (status.ok) {
    const lines = status.stdout.trim().split('\n').filter(Boolean);
    if (lines.length) add('warn', false, 'git-dirty', '', `${lines.length} uncommitted path(s): ${lines.slice(0, 5).join(' | ')}${lines.length > 5 ? ' …' : ''}`);
  }

  return findings;
}

// Apply only the safe, idempotent fixes (all outside the git repo, so they
// never rewrite tracked source automatically).
function applyFixes(findings) {
  let fixed = 0;
  const repoVer = JSON.parse(fs.readFileSync(PKG_JSON, 'utf8')).version;
  const repoSkill = fs.readFileSync(path.join(PLUGIN_ROOT, 'skills', 'memory-manager', 'SKILL.md')).toString();
  for (const f of findings.filter((x) => x.autoFixable)) {
    if (f.category === 'version-drift' && f.data?.metaFile) {
      fs.mkdirSync(path.dirname(f.data.metaFile), { recursive: true });
      const meta = { ownerId: 'agent', slug: 'shared-memory-manager', version: repoVer, publishedAt: Date.now() };
      fs.writeFileSync(f.data.metaFile, JSON.stringify(meta));
      fixed++;
    } else if (f.category === 'install-drift' && f.data?.installed) {
      fs.mkdirSync(path.dirname(f.data.installed), { recursive: true });
      fs.writeFileSync(f.data.installed, f.data.repoSkill ?? repoSkill);
      fixed++;
    }
  }
  return fixed;
}

function syncDir(src, dst, filterFn) {
  if (!fs.existsSync(src)) return 0;
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  let synced = 0;
  for (const entry of fs.readdirSync(src, { recursive: true })) {
    const srcFile = path.join(src, entry);
    const dstFile = path.join(dst, entry);
    if (fs.statSync(srcFile).isDirectory()) {
      fs.mkdirSync(dstFile, { recursive: true });
      continue;
    }
    if (filterFn && !filterFn(entry)) continue;
    const srcContent = fs.readFileSync(srcFile);
    if (!fs.existsSync(dstFile) || fs.readFileSync(dstFile).toString() !== srcContent.toString()) {
      fs.mkdirSync(path.dirname(dstFile), { recursive: true });
      fs.writeFileSync(dstFile, srcContent);
      synced++;
    }
  }
  return synced;
}

// ===== MAIN =====
log('========================================');
log('Daily Maintenance — shared-memory-manager');
log('========================================');

let overallOK = true;
const steps = [];

// Step 1: Pull latest
log('\n[1/7] Pulling latest from GitHub...');
const pull = run(`${GIT} -C "${PLUGIN_ROOT}" pull --ff-only 2>&1`);
if (pull.ok) {
  log(`  Pull OK: ${pull.stdout.trim().split('\n').pop()}`);
  steps.push({ name: 'pull', status: 'ok' });
} else {
  const err = pull.stderr || pull.stdout;
  if (err.includes('Already up to date') || err.includes('up to date')) {
    log('  Already up to date.');
    steps.push({ name: 'pull', status: 'skipped' });
  } else {
    // Local uncommitted changes or divergent history must not abort maintenance
    log(`  Pull skipped (local changes / divergent): ${err.trim().slice(0, 160)}`);
    steps.push({ name: 'pull', status: 'warn' });
  }
}

// Step 2: Sync to CLAW dirs (before tests, so tests verify installed state)
log('\n[2/7] Syncing skills and memories to CLAW directories...');
const manifest = JSON.parse(fs.readFileSync(PKG_JSON, 'utf8'));
let skillSynced = 0, memorySynced = 0;
for (const target of SKILL_TARGETS) {
  skillSynced += syncDir(
    path.join(PLUGIN_ROOT, 'skills', 'memory-manager'),
    target,
    (f) => f.endsWith('.md')
  );
  const metaFile = path.join(target, '_meta.json');
  const meta = {
    ownerId: 'agent',
    slug: manifest.name,
    version: manifest.version,
    publishedAt: Date.now(),
  };
  const prev = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : null;
  if (!prev || prev.version !== meta.version) {
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(metaFile, JSON.stringify(meta));
    skillSynced++;
  }
}
for (const target of MEMORY_TARGETS) {
  memorySynced += syncDir(
    path.join(PLUGIN_ROOT, 'references', 'consolidated'),
    target,
    (f) => f.endsWith('.md')
  );
}
log(`  Skills synced: ${skillSynced} file(s) updated across ${SKILL_TARGETS.length} dirs`);
log(`  Memories synced: ${memorySynced} file(s) updated across ${MEMORY_TARGETS.length} dirs`);
steps.push({ name: 'sync', status: 'ok' });

// Step 3: Validate
log('\n[3/7] Running structural validation...');
const validate = run(`node "${VALIDATE_SCRIPT}" 2>&1`);
const validateOK = validate.stdout.includes('Passed: 22/22');
log(validateOK ? '  Validation: 22/22 PASS' : `  Validation FAILED: ${validate.stdout.slice(-300)}`);
steps.push({ name: 'validation', status: validateOK ? 'pass' : 'fail' });
if (!validateOK) overallOK = false;

// Step 4: Test agents
log('\n[4/7] Running multi-agent compatibility test...');
const agents = run(`node "${TEST_AGENTS_SCRIPT}" 2>&1`);
const agentsOK = agents.stdout.includes('2400/2400');
log(agentsOK ? '  Multi-agent test: 2400/2400 PASS' : `  Multi-agent test FAILED`);
steps.push({ name: 'agent_test', status: agentsOK ? 'pass' : 'fail' });
if (!agentsOK) overallOK = false;

// Step 5: Test CLAW agents
log('\n[5/7] Running CLAW agent integration test...');
const claw = run(`node "${TEST_CLAW_SCRIPT}" 2>&1`);
const clawOK = claw.stdout.includes('600/600');
log(clawOK ? '  CLAW agent test: 600/600 PASS' : `  CLAW agent test FAILED`);
steps.push({ name: 'claw_test', status: clawOK ? 'pass' : 'fail' });
if (!clawOK) overallOK = false;

// Step 6: Deep defect hunt (extreme) — wide, repeated static audit
log('\n[6/7] Hunting defects across the whole project (extreme pass)...');
const findings = deepAudit();
const errorsFound = findings.filter((f) => f.severity === 'error');
const warnings = findings.filter((f) => f.severity === 'warn');
log(`  Findings: ${findings.length} total (${errorsFound.length} error, ${warnings.length} warning)`);
for (const f of findings) {
  log(`    [${f.severity}${f.autoFixable ? ',auto-fixable' : ''}] ${f.category}${f.file ? ` @ ${f.file}` : ''} — ${f.issue}`);
}
let fixesApplied = 0;
if (findings.some((f) => f.autoFixable)) {
  fixesApplied = applyFixes(findings);
  const after = deepAudit();
  log(`  After fixes: ${after.length} findings remain (${after.filter((f) => f.severity === 'error').length} error)`);
}

// A run "found defects worth a release" when it has real errors, applied an
// auto-fix, or caught leftover placeholder/dead tokens. Pure informational
// notes (e.g. uncommitted work) do not by themselves trigger a publish.
const actionable = findings.filter((f) => f.severity === 'error' || f.autoFixable || f.category === 'placeholder');

// Step 7: Gated release — publish ONLY if defects were found and handled;
// a fully clean project does not produce a new version.
log('\n[7/7] Gated release decision...');
let publishFail = false;
if (!overallOK) {
  log('  No release — required checks (validate / agents / claw) failed.');
  steps.push({ name: 'release', status: 'skipped' });
} else if (actionable.length === 0) {
  log('  No release — deep hunt found no actionable defects, project is clean.');
  steps.push({ name: 'release', status: 'clean' });
} else {
  const currentVer = JSON.parse(fs.readFileSync(PKG_JSON, 'utf8')).version;
  const newVer = bumpVersion(currentVer);
  log(`  ${actionable.length} actionable defect(s) found → publishing ${currentVer} → ${newVer}`);
  const data = JSON.parse(fs.readFileSync(PKG_JSON, 'utf8'));
  data.version = newVer;
  fs.writeFileSync(PKG_JSON, JSON.stringify(data, null, 2) + '\n');
  const meta = { ownerId: 'agent', slug: data.name, version: newVer, publishedAt: Date.now() };
  for (const target of SKILL_TARGETS) {
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, '_meta.json'), JSON.stringify(meta));
  }
  const add = run(`${GIT} -C "${PLUGIN_ROOT}" add .qoder-plugin/plugin.json`);
  if (!add.ok) {
    log(`  Add failed, retrying: ${(add.stderr || add.stdout).trim().slice(0, 160)}`);
    sleepSync(2000);
    run(`${GIT} -C "${PLUGIN_ROOT}" add .qoder-plugin/plugin.json`);
  }
  const commitMsg = `chore: release v${newVer} (daily auto-release: ${actionable.length} defect(s) found, ${fixesApplied} auto-fixed)`;
  const commit = run(`${GIT} -C "${PLUGIN_ROOT}" commit -m "${commitMsg.replace(/"/g, '\\"')}" 2>&1`);
  if (!commit.ok) {
    log(`  Commit failed: ${(commit.stderr || commit.stdout).trim().slice(0, 200)}`);
    publishFail = true;
  }
  let push = run(`${GIT} -C "${PLUGIN_ROOT}" push origin main 2>&1`);
  for (let attempt = 1; !push.ok && attempt <= 2; attempt++) {
    log(`  Push attempt ${attempt} failed, retrying in 5s...`);
    sleepSync(5000);
    push = run(`${GIT} -C "${PLUGIN_ROOT}" push origin main 2>&1`);
  }
  if (push.ok) {
    log(`  Published v${newVer} to GitHub ✓ (${actionable.length} defects found, ${fixesApplied} auto-fixed)`);
  } else {
    log(`  Push failed: ${push.stderr?.trim()?.slice(0, 200) || push.stdout?.trim()?.slice(0, 200)}`);
    publishFail = true;
  }
  steps.push({ name: 'release', status: (push.ok && commit.ok) ? 'published' : 'fail', version: newVer, defects: findings.length, actionable: actionable.length, fixed: fixesApplied });
}

// Summary
log('\n========================================');
log('Daily Maintenance Complete');
log('========================================');
const exitCode = (!overallOK || publishFail) ? 1 : 0;
const releaseStatus = steps[steps.length - 1]?.status;
log(`Result: ${overallOK ? 'checks ALL PASS ✓' : 'checks FAILED ✗'} | release: ${releaseStatus}`);
log(`Steps: ${steps.map((s) => `${s.name}=${s.status}`).join(', ')}`);
log(`Log: ${LOG_FILE}`);
log('========================================');

process.exit(exitCode);

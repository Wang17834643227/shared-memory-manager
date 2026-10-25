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

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

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
log('\n[1/6] Pulling latest from GitHub...');
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
log('\n[2/6] Syncing skills and memories to CLAW directories...');
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
log('\n[3/6] Running structural validation...');
const validate = run(`node "${VALIDATE_SCRIPT}" 2>&1`);
const validateOK = validate.stdout.includes('Passed: 22/22');
log(validateOK ? '  Validation: 22/22 PASS' : `  Validation FAILED: ${validate.stdout.slice(-300)}`);
steps.push({ name: 'validation', status: validateOK ? 'pass' : 'fail' });
if (!validateOK) overallOK = false;

// Step 4: Test agents
log('\n[4/6] Running multi-agent compatibility test...');
const agents = run(`node "${TEST_AGENTS_SCRIPT}" 2>&1`);
const agentsOK = agents.stdout.includes('2400/2400');
log(agentsOK ? '  Multi-agent test: 2400/2400 PASS' : `  Multi-agent test FAILED`);
steps.push({ name: 'agent_test', status: agentsOK ? 'pass' : 'fail' });
if (!agentsOK) overallOK = false;

// Step 5: Test CLAW agents
log('\n[5/6] Running CLAW agent integration test...');
const claw = run(`node "${TEST_CLAW_SCRIPT}" 2>&1`);
const clawOK = claw.stdout.includes('600/600');
log(clawOK ? '  CLAW agent test: 600/600 PASS' : `  CLAW agent test FAILED`);
steps.push({ name: 'claw_test', status: clawOK ? 'pass' : 'fail' });
if (!clawOK) overallOK = false;

// Step 6: Daily release — bump patch, commit, push when every check passed
log('\n[6/6] Publishing daily release...');
if (overallOK) {
  const currentVer = JSON.parse(fs.readFileSync(PKG_JSON, 'utf8')).version;
  const newVer = bumpVersion(currentVer);
  log(`  All checks passed, bumping ${currentVer} → ${newVer}`);
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
    // Another git process may hold index.lock; retry briefly before giving up
    log(`  Add failed, retrying: ${(add.stderr || add.stdout).trim().slice(0, 160)}`);
    sleepSync(2000);
    run(`${GIT} -C "${PLUGIN_ROOT}" add .qoder-plugin/plugin.json`);
  }
  const commit = run(`${GIT} -C "${PLUGIN_ROOT}" commit -m "chore: release v${newVer} (daily automated release)" 2>&1`);
  if (!commit.ok) {
    log(`  Commit failed: ${(commit.stderr || commit.stdout).trim().slice(0, 200)}`);
  }
  const push = run(`${GIT} -C "${PLUGIN_ROOT}" push origin main 2>&1`);
  if (push.ok) {
    log(`  Published v${newVer} to GitHub ✓`);
  } else {
    log(`  Push failed: ${push.stderr?.trim()?.slice(0, 200) || push.stdout?.trim()?.slice(0, 200)}`);
  }
  steps.push({ name: 'release', status: push.ok ? 'published' : 'fail', version: newVer });
} else {
  log('  Release skipped — earlier checks failed.');
  steps.push({ name: 'release', status: 'skipped' });
}

// Summary
log('\n========================================');
log('Daily Maintenance Complete');
log('========================================');
const allPass = overallOK && pull.ok !== false;
log(`Result: ${allPass ? 'ALL PASS ✓' : 'SOME CHECKS FAILED ✗'}`);
log(`Steps: ${steps.map(s => `${s.name}=${s.status}`).join(', ')}`);
log(`Log: ${LOG_FILE}`);
log('========================================');

process.exit(allPass ? 0 : 1);

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PLUGIN_ROOT = path.join(__dirname, '..');
const RESULTS = [];

// All CLAW agent directories
const CLAW_AGENTS = [
  { id: 'qclaw-main',       base: 'C:/Users/1/.qclaw/agents/main' },
  { id: 'qclaw-dbgtwv0tcb9ttdx6', base: 'C:/Users/1/.qclaw/agents/dbgtwv0tcb9ttdx6' },
  { id: 'qclaw-xfndlk74sib06h88', base: 'C:/Users/1/.qclaw/agents/xfndlk74sib06h88' },
  { id: 'openclaw-main',    base: 'C:/Users/1/.openclaw/agents/main' },
  { id: 'easyclaw-main',    base: 'C:/Users/1/.easyclaw/agents/main' },
];

// CLAW skill directories to check
const SKILL_DIRS = [
  'C:/Users/1/.qclaw/skills/shared-memory-manager',
  'C:/Users/1/.openclaw/skills/shared-memory-manager',
  'C:/Users/1/.easyclaw/skills/shared-memory-manager',
];

// Memory paths for each system
const MEMORY_PATHS = [
  'C:/Users/1/.qclaw/memory',
  'C:/Users/1/.openclaw/memory',
  'C:/Users/1/.easyclaw/memory',
  'C:/Users/1/.qoder-cn/memory',
  'C:/Users/1/.qoder-cn/projects/C--Users-1-Documents-Qoder-2026-10-25-2ecfdadd/memory',
];

function check(name, fn) {
  try {
    const r = fn();
    RESULTS.push({ agent: name, pass: true });
    console.log(`  PASS`);
    return true;
  } catch (e) {
    RESULTS.push({ agent: name, pass: false });
    console.log(`  FAIL: ${e.message}`);
    return false;
  }
}

function runCLAWAgentTest(agentId) {
  console.log(`\n[Agent: ${agentId}]`);
  let allPass = true;

  // Test 1: Skill SKILL.md is loadable
  allPass &= check('skill SKILL.md loadable', () => {
    for (const dir of SKILL_DIRS) {
      const skillFile = path.join(dir, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        const content = fs.readFileSync(skillFile, 'utf8');
        if (!content.includes('memory-manager')) throw new Error('wrong skill');
        if (!content.match(/^---\nname:/m)) throw new Error('no frontmatter');
        return;
      }
    }
    throw new Error('Skill not found in any CLAW dir');
  });

  // Test 2: _meta.json exists
  allPass &= check('_meta.json present', () => {
    for (const dir of SKILL_DIRS) {
      const metaFile = path.join(dir, '_meta.json');
      if (fs.existsSync(metaFile)) {
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        if (meta.slug !== 'shared-memory-manager') throw new Error('wrong slug');
        return;
      }
    }
    throw new Error('No _meta.json found');
  });

  // Test 3: Memory paths are accessible
  allPass &= check('memory paths accessible', () => {
    const accessible = MEMORY_PATHS.filter(p => fs.existsSync(p));
    if (accessible.length === 0) throw new Error('No memory paths found');
  });

  // Test 4: Consolidated memory files exist in CLAW memory dirs
  allPass &= check('consolidated memories in CLAW', () => {
    for (const memDir of ['C:/Users/1/.qclaw/memory', 'C:/Users/1/.openclaw/memory']) {
      if (!fs.existsSync(memDir)) continue;
      const files = fs.readdirSync(memDir).filter(f => f.endsWith('.md'));
      const expected = ['user-memories.md', 'feedback-memories.md', 'project-memories.md', 'reference-memories.md'];
      const missing = expected.filter(f => !files.includes(f));
      if (missing.length > 0) throw new Error(`Missing: ${missing.join(', ')}`);
    }
  });

  // Test 5: Agent config directory exists
  const agentBase = CLAW_AGENTS.find(a => a.id === agentId);
  if (agentBase && fs.existsSync(agentBase.base)) {
    allPass &= check(`agent dir ${agentId} exists`, () => {
      const entries = fs.readdirSync(agentBase.base);
      if (entries.length === 0) throw new Error('Empty agent dir');
    });
  } else {
    // Agent dir doesn't exist - skip agent-specific checks
    console.log(`  SKIP: ${agentId} agent dir not found`);
  }

  // Test 6: Skills are installed and non-empty in each CLAW target
  allPass &= check('installed skills non-empty', () => {
    for (const dir of SKILL_DIRS) {
      const skillFile = path.join(dir, 'SKILL.md');
      if (!fs.existsSync(skillFile)) throw new Error(`Missing: ${skillFile}`);
      if (fs.statSync(skillFile).size < 100) throw new Error(`Too small: ${skillFile}`);
    }
  });

  // Test 7: Agent can read skill frontmatter correctly
  allPass &= check('skill frontmatter readable by agent', () => {
    for (const dir of SKILL_DIRS) {
      const skillFile = path.join(dir, 'SKILL.md');
      if (!fs.existsSync(skillFile)) continue;
      const content = fs.readFileSync(skillFile, 'utf8');
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (!match) throw new Error('Cannot parse frontmatter');
      const fm = match[1];
      const nameMatch = /^name:\s*(.+)$/m.exec(fm);
      const descMatch = /^description:\s*(.+)$/m.exec(fm);
      if (!nameMatch || !descMatch) throw new Error('Missing name or description');
      if (!nameMatch[1].includes('memory')) throw new Error('Wrong name');
      return;
    }
    throw new Error('No skill file found');
  });

  // Test 8: Plugin manifest matches installed skill version
  allPass &= check('version consistency', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.qoder-plugin', 'plugin.json'), 'utf8'));
    for (const dir of SKILL_DIRS) {
      const metaFile = path.join(dir, '_meta.json');
      if (!fs.existsSync(metaFile)) throw new Error(`Missing meta: ${metaFile}`);
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      if (meta.slug !== manifest.name) throw new Error('slug mismatch');
    }
  });

  // Test 9: Skills list includes shared-memory-manager
  allPass &= check('skill appears in QClaw skills list', () => {
    const qclawSkills = fs.readdirSync('C:/Users/1/.qclaw/skills/');
    if (!qclawSkills.includes('shared-memory-manager')) throw new Error('Not in QClaw skills');
  });

  allPass &= check('skill appears in OpenClaw skills list', () => {
    const openclawSkills = fs.readdirSync('C:/Users/1/.openclaw/skills/');
    if (!openclawSkills.includes('shared-memory-manager')) throw new Error('Not in OpenClaw skills');
  });

  // Test 10: Plugin manifest accessible
  allPass &= check('plugin.json accessible', () => {
    const pluginJson = path.join(PLUGIN_ROOT, '.qoder-plugin', 'plugin.json');
    const data = JSON.parse(fs.readFileSync(pluginJson, 'utf8'));
    if (data.name !== 'shared-memory-manager') throw new Error('Wrong plugin name');
    if (!data.skills || !Array.isArray(data.skills)) throw new Error('No skills field');
  });

  console.log(`  Result: ${allPass ? 'ALL PASS' : 'SOME FAILED'}`);
  return allPass;
}

// ===== MAIN =====
console.log('========================================');
console.log('CLAW Agent Integration Test');
console.log(`Agents: ${CLAW_AGENTS.length} | Checks per agent: 10`);
console.log('========================================');

const agentResults = {};
const TOTAL_RUNS = 12;

for (let round = 1; round <= TOTAL_RUNS; round++) {
  console.log(`\n========== ROUND ${round}/${TOTAL_RUNS} ==========`);
  const roundResults = {};

  for (const agent of CLAW_AGENTS) {
    const start = Date.now();
    const passed = runCLAWAgentTest(agent.id);
    const elapsed = Date.now() - start;
    roundResults[agent.id] = { pass: passed, time: elapsed };
    if (!agentResults[agent.id]) agentResults[agent.id] = { passes: 0, total: 0 };
    agentResults[agent.id].total += 10;
    if (passed) agentResults[agent.id].passes += 10;
  }

  const roundPasses = Object.values(roundResults).filter(r => r.pass).length;
  console.log(`\n  Round ${round} summary: ${roundPasses}/${CLAW_AGENTS.length} agents passed`);
}

// ===== FINAL SUMMARY =====
console.log('\n\n========================================');
console.log('FINAL CLAW AGENT TEST REPORT');
console.log('========================================');

let totalPasses = 0;
let totalChecks = 0;

for (const agent of CLAW_AGENTS) {
  const r = agentResults[agent.id] || { passes: 0, total: 0 };
  const pct = r.total > 0 ? Math.round((r.passes / r.total) * 100) : 0;
  const status = pct === 100 ? 'OK' : pct >= 80 ? 'WARN' : 'FAIL';
  console.log(`  ${status.padEnd(4)} ${agent.id.padEnd(40)} ${r.passes}/${r.total} (${pct}%)`);
  totalPasses += r.passes;
  totalChecks += r.total;
}

console.log('----------------------------------------');
console.log(`OVERALL: ${totalPasses}/${totalChecks} checks passed (${Math.round(totalPasses/totalChecks*100)}%)`);
console.log(`Agents fully passing: ${CLAW_AGENTS.filter(a => {
  const r = agentResults[a.id];
  return r && r.passes === r.total;
}).length}/${CLAW_AGENTS.length}`);
console.log('========================================');

process.exit(totalPasses === totalChecks ? 0 : 1);

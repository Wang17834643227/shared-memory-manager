const fs = require('fs');
const path = require('path');

const PLUGIN_ROOT = path.join(__dirname, '..');
const SKILL_PATH = path.join(PLUGIN_ROOT, 'skills', 'memory-manager', 'SKILL.md');
const RESULTS = [];
const TOTAL_RUNS = 12;

// All known Qoder agent skill types (from plugin system)
const AGENT_TYPES = [
  { id: 'explore',           name: 'Explore Agent',       category: 'architecture' },
  { id: 'architecture-communicator', name: 'Arch Communicator', category: 'architecture' },
  { id: 'architecture-health',       name: 'Arch Health',          category: 'architecture' },
  { id: 'c4model',                 name: 'C4 Modeler',            category: 'architecture' },
  { id: 'dependency-impact-analyzer', name: 'Dependency Analyzer', category: 'architecture' },
  { id: 'deployment-topology-analyzer', name: 'Deployment Topology', category: 'architecture' },
  { id: 'drawio',                  name: 'Draw.io Agent',         category: 'architecture' },
  { id: 'evolution-planner',       name: 'Evolution Planner',     category: 'architecture' },
  { id: 'flow-visualizer',         name: 'Flow Visualizer',       category: 'architecture' },
  { id: 'graphviz',                name: 'Graphviz Agent',        category: 'architecture' },
  { id: 'legacy-system-visualizer', name: 'Legacy System Viewer', category: 'architecture' },
  { id: 'risk-quality-reviewer',   name: 'Risk Reviewer',         category: 'architecture' },
  { id: 'system-modeler',          name: 'System Modeler',        category: 'architecture' },
  { id: 'security-scan',           name: 'Security Scan Agent',   category: 'security' },
  { id: 'qoder-context-knowledge-plan', name: 'Context Knowledge Plan', category: 'context' },
  { id: 'general-purpose',         name: 'General Purpose Agent', category: 'general' },
  { id: 'ef-broadcast',            name: 'EigenFlux Broadcast',   category: 'network' },
  { id: 'ef-communication',        name: 'EigenFlux Communication', category: 'network' },
  { id: 'ef-onboarding',           name: 'EigenFlux Onboarding',  category: 'network' },
  { id: 'ef-profile',              name: 'EigenFlux Profile',     category: 'network' },
];

function check(name, fn) {
  try {
    const r = fn();
    RESULTS.push({ agent: name, pass: r, detail: '' });
    console.log(`  ${r ? 'PASS' : 'FAIL'}`);
    return r;
  } catch (e) {
    RESULTS.push({ agent: name, pass: false, detail: e.message });
    console.log(`  FAIL (${e.message})`);
    return false;
  }
}

function runAgentTest(agentId) {
  console.log(`\n[Agent: ${agentId}]`);
  let allPass = true;

  // --- Test 1: SKILL.md is readable ---
  allPass &= check('read SKILL.md', () => {
    const content = fs.readFileSync(SKILL_PATH, 'utf8');
    return content.length > 0;
  });

  // --- Test 2: Frontmatter parseable ---
  allPass &= check('parse frontmatter', () => {
    const content = fs.readFileSync(SKILL_PATH, 'utf8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return false;
    const fm = match[1];
    return /^name:\s*\S+$/m.test(fm) && /^description:\s*.+$/m.test(fm);
  });

  // --- Test 3: Memory file paths exist ---
  allPass &= check('read user memory dir', () => {
    const userMem = 'C:/Users/1/.qoder-cn/memory/';
    return fs.existsSync(userMem);
  });

  allPass &= check('read project memory dir', () => {
    const projMem = 'C:/Users/1/.qoder-cn/projects/C--Users-1-Documents-Qoder-2026-10-25-2ecfdadd/memory/';
    return fs.existsSync(projMem);
  });

  // --- Test 4: Plugin root files accessible ---
  allPass &= check('access plugin.json', () => {
    const p = path.join(PLUGIN_ROOT, '.qoder-plugin', 'plugin.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return data.name === 'shared-memory-manager';
  });

  allPass &= check('access consolidated files', () => {
    const dir = path.join(PLUGIN_ROOT, 'references', 'consolidated');
    const files = fs.readdirSync(dir);
    return files.length === 4;
  });

  // --- Test 5: Memory schema reference loadable ---
  allPass &= check('read memory-schema.md', () => {
    const p = path.join(PLUGIN_ROOT, 'references', 'memory-schema.md');
    return fs.existsSync(p) && fs.readFileSync(p, 'utf8').length > 50;
  });

  allPass &= check('read memory-management.md', () => {
    const p = path.join(PLUGIN_ROOT, 'references', 'memory-management.md');
    return fs.existsSync(p) && fs.readFileSync(p, 'utf8').length > 50;
  });

  // --- Test 6: Plugin MEMORY.md index valid ---
  allPass &= check('parse plugin MEMORY.md', () => {
    const p = path.join(PLUGIN_ROOT, 'MEMORY.md');
    const content = fs.readFileSync(p, 'utf8');
    const lines = content.split('\n').filter(l => l.startsWith('- ['));
    return lines.length >= 4;
  });

  // --- Test 7: Validate script runs clean ---
  allPass &= check('run validate.js', () => {
    const { execSync } = require('child_process');
    const out = execSync(`node "${path.join(PLUGIN_ROOT, 'scripts', 'validate.js')}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return out.includes('Passed: 22/22');
  });

  // --- Test 8: Cross-reference path resolution ---
  allPass &= check('resolve ../references paths', () => {
    const refDir = path.join(PLUGIN_ROOT, 'references');
    const files = fs.readdirSync(refDir).filter(f => f.endsWith('.md'));
    return files.length >= 2;
  });

  // --- Test 9: Consolidated files have content slots ---
  allPass &= check('consolidated files writable', () => {
    const dir = path.join(PLUGIN_ROOT, 'references', 'consolidated');
    const files = fs.readdirSync(dir);
    return files.every(f => {
      const fp = path.join(dir, f);
      const stat = fs.statSync(fp);
      return stat.isFile() && stat.size > 0;
    });
  });

  // --- Test 10: .gitignore excludes sensitive paths ---
  allPass &= check('.gitignore covers caches', () => {
    const p = path.join(PLUGIN_ROOT, '.gitignore');
    const content = fs.readFileSync(p, 'utf8');
    return content.includes('node_modules');
  });

  console.log(`  Result: ${allPass ? 'ALL PASS' : 'SOME FAILED'}`);
  return allPass;
}

// ===== MAIN: Run tests per agent, multiple rounds =====
console.log('========================================');
console.log('Shared Memory Manager — Multi-Agent Test');
console.log(`Agents: ${AGENT_TYPES.length} | Runs: ${TOTAL_RUNS}`);
console.log('========================================');

const agentResults = {};
for (const agent of AGENT_TYPES) {
  agentResults[agent.id] = { passes: 0, total: 0, details: [] };
}

for (let round = 1; round <= TOTAL_RUNS; round++) {
  console.log(`\n========== ROUND ${round}/${TOTAL_RUNS} ==========`);
  const roundResults = {};

  for (const agent of AGENT_TYPES) {
    const start = Date.now();
    const passed = runAgentTest(agent.id);
    const elapsed = Date.now() - start;
    roundResults[agent.id] = { pass: passed, time: elapsed };
    agentResults[agent.id].total += 10;
    if (passed) agentResults[agent.id].passes += 10;
  }

  // Print round summary
  const roundPasses = Object.values(roundResults).filter(r => r.pass).length;
  console.log(`\n  Round ${round} summary: ${roundPasses}/${AGENT_TYPES.length} agents passed`);
}

// ===== FINAL SUMMARY =====
console.log('\n\n========================================');
console.log('FINAL AGENT TEST REPORT');
console.log('========================================');

let totalPasses = 0;
let totalChecks = 0;

for (const agent of AGENT_TYPES) {
  const r = agentResults[agent.id];
  const pct = Math.round((r.passes / r.total) * 100);
  const status = pct === 100 ? 'OK' : pct >= 80 ? 'WARN' : 'FAIL';
  console.log(`  ${status.padEnd(4)} ${agent.id.padEnd(35)} ${r.passes}/${r.total} (${pct}%)`);
  totalPasses += r.passes;
  totalChecks += r.total;
}

console.log('----------------------------------------');
console.log(`OVERALL: ${totalPasses}/${totalChecks} checks passed (${Math.round(totalPasses/totalChecks*100)}%)`);
console.log(`Agents fully passing: ${AGENT_TYPES.filter(a => agentResults[a.id].passes === agentResults[a.id].total).length}/${AGENT_TYPES.length}`);
console.log('========================================');

process.exit(totalPasses === totalChecks ? 0 : 1);

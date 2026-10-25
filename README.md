# Shared Memory Manager

A plugin that provides unified memory management for all AI agents. Share, read, write, and sync memories across machines — works with QClaw, OpenClaw, EasyClaw, Qoder, and any other agent platform.

## What It Does

- Consolidates user-level and project-level memories into a shared system
- Provides standardized memory formats (user, feedback, project, reference)
- Enables all intelligent agents to access the same memory context
- Supports cross-device memory sync via GitHub

## Installation

Clone this repository and install the skill into your agent's skills directory:

```bash
# QClaw / OpenClaw / EasyClaw
cp -r shared-memory-manager/skills/memory-manager ~/.qclaw/skills/
cp -r shared-memory-manager/skills/memory-manager ~/.openclaw/skills/
cp -r shared-memory-manager/skills/memory-manager ~/.easyclaw/skills/

# Or create a symlink
ln -s "$(pwd)/skills/memory-manager" ~/.qclaw/skills/shared-memory-manager
```

## Usage

Any agent that reads `~/.qclaw/skills/`, `~/.openclaw/skills/`, or `~/.easyclaw/skills/` can use this skill directly by invoking `memory-manager`.

Memory files are stored at:
- `~/.qclaw/memory/`
- `~/.openclaw/memory/`
- `~/.easyclaw/memory/`
- Any agent-compatible memory directory

## Structure

```
shared-memory-manager/
├── skills/
│   └── memory-manager/
│       ├── SKILL.md          # Core skill instructions (for any agent)
│       └── _meta.json        # Plugin manifest (slug, version)
├── references/
│   ├── memory-management.md  # Operations & routing rules
│   ├── memory-schema.md      # Directory layout & validation
│   └── consolidated/         # Merged memory files
│       ├── user-memories.md
│       ├── feedback-memories.md
│       ├── project-memories.md
│       └── reference-memories.md
├── MEMORY.md                 # Plugin memory index
├── scripts/
│   ├── validate.js           # 22 structural checks
│   ├── test_agents.js        # 20-agent × 12-round compatibility test
│   ├── test_claw_agents.js   # 5-CLAW-agent × 12-round integration test
│   ├── daily-maintenance.js  # Pull → sync → validate → test → release
│   └── run-daily.cmd         # Windows Task Scheduler entrypoint
└── .gitignore
```

## Validation & Testing

Run the built-in validator (22 structural checks):
```bash
node scripts/validate.js
```

Run the multi-agent compatibility test (20 agents × 12 rounds = 2400 checks):
```bash
node scripts/test_agents.js
```

Run the CLAW agent integration test (5 agents × 12 rounds = 600 checks):
```bash
node scripts/test_claw_agents.js
```

Both tests must pass before publishing.

## Daily Automation

`scripts/daily-maintenance.js` runs every day at 07:00 (Qoder Automation, or Windows Task Scheduler as an alternative):

1. Pull the latest changes from GitHub
2. Sync the skill and consolidated memories into every CLAW install
3. Validate structure, then run both agent test suites
4. Bump the patch version, commit, and push the release

A run lock and a same-day dedupe check prevent duplicate releases if two schedulers fire together.

The git remote uses SSH (`git@github.com:…`); the SSH key at `~/.ssh/id_ed25519` must be registered under your account (GitHub → Settings → SSH keys).

Logs are written to `logs/daily-maintenance.log` and `logs/scheduler-run.log`.

## License

MIT

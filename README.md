# Shared Memory Manager

A cross-platform memory management system for ALL AI agents. Share, read, write, and sync memories across any agent software — Qoder, QClaw, OpenClaw, EasyClaw, and beyond.

## What It Does

- Consolidates user-level and project-level memories into a unified shared system
- Provides standardized memory formats (user, feedback, project, reference)
- Enables every intelligent agent on any platform to access the same memory context
- Supports cross-device memory sync via GitHub

## Installation

Clone this repository and install into any agent platform:

```bash
# Copy skills to your agent's skills directory
cp -r shared-memory-manager/skills/memory-manager ~/.qclaw/skills/
cp -r shared-memory-manager/skills/memory-manager ~/.openclaw/skills/
cp -r shared-memory-manager/skills/memory-manager ~/.easyclaw/skills/
```

Supported platforms: **QClaw · OpenClaw · EasyClaw · Qoder · any SKILL.md-based agent**

## Usage

Any agent that loads `SKILL.md` can use this skill. Activate by invoking:

```
/memory-manager
```

## Memory Scopes

| Scope | Path | Description |
|-------|------|-------------|
| User | `~/.qclaw/memory/` · `~/.openclaw/memory/` · `~/.qoder-cn/memory/` | Shared across all agents |
| Project | `~/.qclaw/projects/<slug>/memory/` | Tied to specific project |

## Structure

```
shared-memory-manager/
├── .qoder-plugin/
│   └── plugin.json           # Manifest (Qoder-specific entry point)
├── skills/
│   └── memory-manager/
│       ├── SKILL.md          # Universal skill — all agents read this
│       └── _meta.json        # QClaw/OpenClaw metadata
├── references/
│   ├── memory-management.md  # Operations & routing rules
│   ├── memory-schema.md      # Directory layout & validation
│   └── consolidated/         # Merged memory files
│       ├── user-memories.md
│       ├── feedback-memories.md
│       ├── project-memories.md
│       └── reference-memories.md
├── scripts/
│   ├── validate.js           # 22 structural checks
│   ├── test_agents.js        # 20-agent × 12-round compat test
│   └── test_claw_agents.js   # 5-CLAW-agent × 12-round test
├── MEMORY.md                 # Plugin memory index
└── .gitignore
```

## Validation & Testing

Run the built-in validator (22 structural checks):
```bash
node scripts/validate.js
```

Run the multi-agent compatibility test (20 Qoder agents × 12 rounds = 2400 checks):
```bash
node scripts/test_agents.js
```

Run the CLAW agent integration test (5 CLAW agents × 12 rounds = 600 checks):
```bash
node scripts/test_claw_agents.js
```

All tests must pass before publishing.

## License

MIT

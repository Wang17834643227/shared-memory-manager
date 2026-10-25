# Shared Memory Manager

A Qoder plugin that provides unified memory management for all AI agents. Share, read, write, and sync memories across machines.

## What It Does

- Consolidates user-level and project-level memories into a shared system
- Provides standardized memory formats (user, feedback, project, reference)
- Enables all intelligent agents to access the same memory context
- Supports cross-device memory sync via GitHub

## Installation

Clone this repository and install as a Qoder plugin:

```bash
qoder plugin install ./shared-memory-manager
```

Or copy the `.qoder-plugin` directory to your Qoder plugins folder.

## Usage

Activate the skill:

```
/shared-memory-manager
```

Or invoke the memory skill directly:

```
/memory-manager
```

## Memory Scopes

| Scope | Path | Description |
|-------|------|-------------|
| User | `~/.qoder-cn/memory/` | Shared across all projects |
| Project | `~/.qoder-cn/projects/<project>/memory/` | Tied to specific project |

## Structure

```
shared-memory-manager/
├── .qoder-plugin/
│   └── plugin.json           # Plugin manifest
├── skills/
│   └── memory-manager/
│       └── SKILL.md          # Core skill instructions
├── references/
│   ├── memory-management.md  # Operations & routing rules
│   ├── memory-schema.md      # Directory layout & validation
│   └── consolidated/         # Merged memory files
│       ├── user-memories.md
│       ├── feedback-memories.md
│       ├── project-memories.md
│       └── reference-memories.md
├── MEMORY.md                 # Plugin memory index
└── .gitignore
```

## License

MIT

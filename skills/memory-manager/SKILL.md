---
name: memory-manager
description: Universal memory management for ALL AI agents (QClaw, OpenClaw, EasyClaw, Qoder). Use when reading, writing, updating, or syncing memories on any agent platform. Supports consolidation, archival, and cross-device sharing of user/feedback/project/reference memory types.
---

# Shared Memory Manager

All AI agents use this skill to read, write, update, and share memories consistently.

## Memory Storage Paths

| Scope | Path |
|-------|------|
| User-level | `C:\Users\1\.qoder-cn\memory\` |
| Project-level | `C:\Users\1\.qoder-cn\projects\C--Users-1-Documents-Qoder-2026-10-25-2ecfdadd\memory\` |
| Index | `MEMORY.md` at each path root |

## Memory Types

Four types of memories, each stored as a separate `.md` file:

- **user** — User profile, preferences, role, goals (always USER scope)
- **feedback** — How to approach work; corrections and confirmations (default USER, PROJECT for project-wide rules)
- **project** — Ongoing work, states, decisions, deadlines (always PROJECT scope)
- **reference** — Pointers to external resources (default PROJECT, USER for cross-project resources)

## File Format

Every memory file uses YAML frontmatter + markdown body:

```markdown
---
name: short-kebab-case-slug
description: one-line summary — used to decide relevance in future conversations
metadata:
  type: user|feedback|project|reference
---

{{memory content}}
```

**MEMORY.md index** (at each memory root):
- One line per entry: `- [Title](file.md) — one-line hook`
- Max 200 lines per index
- No frontmatter; do not write memory content into MEMORY.md

## Operations

### Read All Memories

```bash
# User-level
ls C:/Users/1/.qoder-cn/memory/
cat C:/Users/1/.qoder-cn/memory/MEMORY.md

# Project-level
ls C:/Users/1/.qoder-cn/projects/<project-path>/memory/
cat C:/Users/1/.qoder-cn/projects/<project-path>/memory/MEMORY.md
```

### Save a New Memory

1. Write the `.md` file with frontmatter to the appropriate directory
2. Add an index line to the corresponding `MEMORY.md`
3. Verify the file exists and index entry is correct

### Update an Existing Memory

1. Read the existing file first
2. Edit only the changed sections
3. Update the MEMORY.md index line if the title/description changed
4. Never silently drop fields

### Delete a Memory

1. Remove the memory `.md` file
2. Remove the corresponding index line from MEMORY.md
3. Confirm both deletions succeeded

### Consolidate Memories into Plugin

When asked to consolidate all memories into this plugin:
1. Read all `.md` files from both user and project memory directories
2. Organize by type (user, feedback, project, reference)
3. Write consolidated reference files under `references/consolidated/`
4. Update `MEMORY.md` in the plugin's memory directory
5. Ensure no duplicates and all pointers are valid

## Routing Rules

- `user` memories → always save to USER scope (`~/.qoder-cn/memory/`)
- `project` memories → always save to PROJECT scope
- `feedback` → default USER; use PROJECT only for project-wide rules everyone follows
- `reference` → default PROJECT; use USER only for cross-project resources
- Never save ephemeral task details, in-progress state, or conversation context to memory

## Naming Convention

- Filename: `<type>-<topic>.md` → e.g., `user-role.md`, `feedback-testing.md`, `project-deadline.md`
- `name` frontmatter: short-kebab-case → e.g., `user-role`, `feedback-testing`
- `description`: single line, ≤ 200 chars, specific enough for relevance matching

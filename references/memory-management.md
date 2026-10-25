# Memory Management Reference

## MEMORY.md Index Format

The `MEMORY.md` file at each memory root acts as a table of contents. Each entry is one line:

```
- [Memory Title](filename.md) — one-line hook describing relevance
```

Rules:
- Max 200 lines per index
- Keep descriptions concise and search-relevant
- Do NOT include memory content in the index
- Group semantically when possible (user / feedback / project / reference)

## Frontmatter Fields

| Field | Required | Format | Notes |
|-------|----------|--------|-------|
| `name` | yes | `short-kebab-case` | Regex: `/^[a-z0-9-]+$/` |
| `description` | yes | single-line string | ≤ 200 chars; used for relevance matching |
| `metadata.type` | yes | `user\|feedback\|project\|reference` | Must match file semantics |

## Body Structure by Type

### user
```
{{profile content}}
```
User role, goals, responsibilities, knowledge level.

### feedback
```
{{rule}}

**Why:** {{reason given by user}}

**How to apply:** {{when/where this guidance kicks in}}
```

### project
```
{{fact or decision}}

**Why:** {{motivation — constraint, deadline, stakeholder ask}}

**How to apply:** {{how this should shape suggestions}}
```

### reference
```
{{pointer to resource and its purpose}}
```

## Scoping Rules

| Memory Type | Scope | Rationale |
|-------------|-------|-----------|
| `user` | USER only | Applies to all projects the user works on |
| `feedback` | USER by default; PROJECT for universal project rules | Personal style vs project-wide invariant |
| `project` | PROJECT only | Tied to specific project context |
| `reference` | PROJECT by default; USER for cross-project resources | Resource location determines scope |

## What NOT to Save

- Code patterns, conventions, architecture — derivable from code
- Git history, recent commits — `git log` is authoritative
- Debugging solutions — the fix is in the code; commit message has context
- Anything already in AGENTS.md
- Ephemeral task details, in-progress work, current conversation context

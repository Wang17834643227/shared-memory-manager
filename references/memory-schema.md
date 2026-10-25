# Memory Schema

## Directory Layout

```
~/.qoder-cn/memory/                 # User-level (shared across all projects)
├── MEMORY.md                        # Index
├── user-role.md                     # User profile memory
├── feedback-coding-style.md         # Feedback memory
└── ...

~/.qoder-cn/projects/<project-slug>/memory/   # Project-level
├── MEMORY.md                        # Index
├── project-milestone.md             # Project memory
├── reference-tool-url.md            # Reference memory
└── ...
```

## Plugin Memory Integration

This plugin stores consolidated memory references under:

```
shared-memory-manager/references/consolidated/
├── user-memories.md          # All user-scope memories concatenated
├── feedback-memories.md      # All feedback-scope memories concatenated
├── project-memories.md       # All project-scope memories for this project
└── reference-memories.md     # All reference-scope memories concatenated
```

## Validation Checklist

Before saving any memory:

- [ ] Frontmatter `name` is kebab-case matching `/^[a-z0-9-]+$/`
- [ ] Frontmatter `description` is a single line ≤ 200 characters
- [ ] `metadata.type` matches the memory's actual type
- [ ] File is saved to the correct scope directory (USER vs PROJECT)
- [ ] MEMORY.md index line added or updated
- [ ] No sensitive data (API keys, passwords, tokens) in memory content
- [ ] No ephemeral content (task state, conversation context) saved

## Consolidation Workflow

1. Read all `.md` files from user memory dir
2. Read all `.md` files from project memory dir
3. Group by `metadata.type`
4. Write each group to `references/consolidated/<type>-memories.md`
5. Add a header with source file list for traceability
6. Update plugin-level MEMORY.md index

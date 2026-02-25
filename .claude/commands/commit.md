Analyze the current git changes and guide the user through creating a commit interactively.

## Commit Message Rules

- Language: **Korean**
- Format: Conventional Commits

```
<type>: <short description>

- bullet points describing what changed
- keep each bullet concise
```

### Types

| Type       | When to use                              |
| ---------- | ---------------------------------------- |
| `feat`     | New feature                              |
| `fix`      | Bug fix                                  |
| `style`    | UI/CSS changes (no logic change)         |
| `refactor` | Code restructure without behavior change |
| `chore`    | Config, dependencies, tooling            |
| `docs`     | Documentation only                       |

### Rules

- Title: lowercase, no period, under 72 chars
- Bullets: group by file or concern, skip obvious details
- If changes are small enough, omit the body entirely
- Also consider the current conversation context (not just diff) to better capture intent

## Steps

1. Run `git diff HEAD` to see all changes. Also consider any relevant context from the current conversation.

2. **Analyze change groups**: Identify whether the changes belong to one concern or multiple distinct concerns (e.g., a config file change + a feature change). If multiple distinct concerns exist, suggest splitting into separate commits and ask the user which grouping to proceed with.

3. **Present commit message(s)** in a code block based on the chosen grouping.

4. **Ask for confirmation**: After showing the message, ask:
   > Commit with this message? (y / edit / cancel)
   - `y` → run `git add -A && git commit -m "..."` with the message
   - `edit` → ask what to change, revise the message, then confirm again
   - `cancel` → stop, do nothing

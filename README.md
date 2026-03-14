# @cynicalsally/cli

**Brutally honest code reviews.**

> Because "You're absolutely right" is probably absolutely wrong.

Your AI pair programmer is lying to you. Sally isn't. She reviews your code with the honesty your linter is too polite to deliver.

## Install

```bash
npm install -g @cynicalsally/cli
```

Or run directly:

```bash
npx @cynicalsally/cli roast ./src/
```

## Login

```bash
# Log in with your email (opens magic link flow)
sally login your@email.com

# Check your account status
sally usage
```

SuperClub members get unlimited roasts. Free users get 3 per day.

## Usage

```bash
# Roast a directory
sally roast ./src/

# Roast a specific file
sally roast src/components/Header.tsx

# Roast staged changes before you commit
sally roast --staged

# Roast your branch vs main (PR review)
sally roast --diff main

# Deep analysis
sally roast ./src/ -m full_truth

# JSON output for piping
sally roast ./src/ --json | jq '.data.score'

# CI/CD: fail if code quality < 5
sally roast ./src/ --fail-under=5 --ci
```

## Commands

| Command | Description |
|---------|-------------|
| `sally roast <paths...>` | Roast files or directories |
| `sally roast --staged` | Roast staged git changes |
| `sally roast --diff <branch>` | Roast branch diff |
| `sally login <email>` | Log in via magic link |
| `sally logout` | Clear stored session |
| `sally usage` | Check account status & quota |
| `sally upgrade` | Open SuperClub page |
| `sally mcp` | Start MCP server for AI agents |

## CI/CD

```yaml
# GitHub Actions
- name: Sally Code Review
  run: npx @cynicalsally/cli roast ./src/ --fail-under=5 --ci
```

## MCP (AI Agents)

Use Sally in Cursor, Claude Desktop, or Windsurf:

```json
{
  "mcpServers": {
    "cynical-sally": {
      "command": "npx",
      "args": ["@cynicalsally/cli", "mcp"]
    }
  }
}
```

## Privacy & Security

Sally **never stores your code**. Your files are sent to Sally's backend for analysis, processed in-memory, and discarded. No code is retained, logged, or used for training.

- Code is transmitted over HTTPS and analyzed in real-time
- No source code is stored on our servers
- Analysis results are tied to your anonymous device ID
- SuperClub members can optionally link an email for account features
- Use of this tool is at your own risk — Sally provides opinions, not guarantees

For full details: [cynicalsally.com/privacy](https://cynicalsally.com/privacy)

## License

MIT

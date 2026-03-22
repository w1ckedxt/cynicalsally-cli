<p align="center">
  <img src="assets/banner.png" alt="Cynical Sally CLI" width="700" />
</p>

<h1 align="center">@cynicalsally/cli</h1>

<p align="center">
  <strong>Brutally honest code reviews — in your terminal and your IDE.</strong><br/>
  <em>Because "You're absolutely right" is probably absolutely wrong.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@cynicalsally/cli"><img src="https://img.shields.io/npm/v/@cynicalsally/cli.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@cynicalsally/cli"><img src="https://img.shields.io/npm/dm/@cynicalsally/cli.svg" alt="npm downloads" /></a>
  <a href="https://github.com/w1ckedxt/cynicalsally-cli/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@cynicalsally/cli.svg" alt="license" /></a>
</p>

---

Your AI pair programmer is lying to you. Sally isn't. She's the senior engineer your code hoped it'd never meet — reviewing your work with the honesty your linter is too polite to deliver.

**CLI + MCP tool.** Use Sally directly from your terminal, or plug her into Claude Code, Cursor, or Windsurf as an MCP server. Same brutal honesty, wherever you work.

## Install

```bash
npm install -g @cynicalsally/cli
```

Or run without installing:

```bash
npx @cynicalsally/cli roast ./src/
```

**Requirements:** Node.js 18+

## Quick Start

```bash
# Roast your code
sally roast ./src/

# Sally auto-detects what to review when you don't specify
sally roast
# → staged changes? reviews those
# → unstaged changes? reviews those
# → recent commit? reviews that
# → nothing? scans the directory

# Roast staged changes before you commit
sally roast --staged

# Compare your branch against main
sally roast --diff main

# Deep analysis with issues + actionable fixes
sally roast ./src/ -m full_truth

# Run the deep analysis in the background (OS notification when done)
sally roast ./src/ -m full_truth --bg
```

## Commands

### Core

| Command | Description |
|---------|-------------|
| `sally roast [paths...]` | Review files, directories, or git changes |
| `sally login <email>` | Log in via magic link (no passwords) |
| `sally logout` | Clear stored session |
| `sally usage` | Check your quota and account status |
| `sally upgrade` | Upgrade to Sally's Full Suite |
| `sally results` | View background review results |
| `sally mcp` | Start MCP server for IDE integration |

### Premium Tools

Each tool includes **1 free trial** — no account needed.

| Command | Description |
|---------|-------------|
| `sally explain [file or code]` | Sally explains what your code actually does |
| `sally review-pr [pr-number]` | Review a PR diff with devastating precision |
| `sally refactor [file or code]` | Concrete refactoring suggestions with before/after code |
| `sally brainstorm "your idea"` | Get cynical but valuable feedback on ideas |
| `sally frontend [file]` | Roast frontend/UI code (CSS, React, HTML) |
| `sally marketing "your copy"` | Review marketing copy and branding |

All premium tools accept file paths, raw text, or piped stdin:

```bash
# File path
sally explain src/utils/auth.ts

# Piped input
cat src/index.ts | sally explain

# Raw text
sally brainstorm "Should I rewrite this in Rust?"

# PR review via GitHub CLI
gh pr diff 42 | sally review-pr
```

## Roast Options

```bash
sally roast [paths...] [options]

Options:
  --staged              Review only staged git changes
  --diff <branch>       Compare against another branch (e.g., main)
  -m, --mode <mode>     "quick" (default) or "full_truth" (deep dive)
  --tone <tone>         "cynical" (default), "neutral", or "professional"
  --lang <lang>         Response language code (default: "en")
  --json                Output raw JSON (for piping or scripting)
  --fail-under <score>  Exit code 1 if quality score is below threshold
  --ci                  CI mode — compact output + exit codes
  --bg                  Run Full Truth in background with OS notification
```

## CI/CD Integration

Sally can gate your pipeline on code quality:

```yaml
# GitHub Actions
- name: Sally Code Review
  run: npx @cynicalsally/cli roast ./src/ --fail-under=5 --ci
```

```bash
# Any CI — fail the build if score < 6
sally roast ./src/ --fail-under=6 --ci --json
```

The `--ci` flag produces compact output with machine-readable exit codes. The `--fail-under` flag causes a non-zero exit when the score is below your threshold.

## MCP Server (IDE Integration)

Sally works as an MCP tool inside **Claude Code**, **Cursor**, and **Windsurf**. Add this to your MCP config:

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

Once configured, your AI agent can call Sally's tools directly:

| MCP Tool | What it does |
|----------|-------------|
| `sally_roast` | Code review with score, issues, and fixes |
| `sally_explain` | Explain code with Sally's personality |
| `sally_review_pr` | Review PR diffs |
| `sally_refactor` | Refactoring suggestions with before/after |
| `sally_brainstorm` | Feedback on ideas and approaches |
| `sally_frontend` | Frontend/UI code review |
| `sally_marketing` | Marketing copy review |
| `sally_usage` | Check quota and account status |

## Pricing

| | Free | Full Suite |
|---|---|---|
| **Quick Roasts** | 90/month | 500/month |
| **Full Truth** (deep dive) | — | 100/month |
| **Premium tools** | 1 free trial each | Unlimited |
| **MCP integration** | Roast only | All tools |
| **Price** | $0 | €14.99/month |

```bash
# Check your current quota
sally usage

# Upgrade to Full Suite
sally upgrade
```

## How It Works

1. **Your code stays private.** Files are sent over HTTPS, analyzed in-memory, and immediately discarded. Nothing is stored, logged, or used for training.
2. **Anonymous by default.** A random device ID tracks your quota — no account required for the free tier.
3. **Magic link auth.** Full Suite members authenticate via email magic links. No passwords.
4. **Smart file detection.** Sally respects `.gitignore`, skips binaries and lockfiles, and caps at 50 files / 100KB per file.

## Privacy & Security

- Code is transmitted over HTTPS and processed in real-time
- **No source code is stored** on our servers — ever
- Analysis results are tied to an anonymous device ID
- Full Suite members can optionally link an email for account features
- Config stored locally at `~/.sally/config.json`

For full details: [cynicalsally.com/privacy](https://cynicalsally.com/privacy)

## Contributing

Found a bug? Have a feature idea? [Open an issue](https://github.com/w1ckedxt/cynicalsally-cli/issues) — Sally promises to only judge your issue title a little.

## License

[MIT](LICENSE)

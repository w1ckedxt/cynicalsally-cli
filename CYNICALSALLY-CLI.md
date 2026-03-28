# CYNICALSALLY-CLI — Project File

> Source of truth voor de Sally CLI/MCP tool.
> Laatste update: 2026-03-28

---

## WAT IS DE CLI?

De volledige Sally CLI + MCP server voor developers. Installeert via npm, draait lokaal, reviewt code met Sally's persoonlijkheid. Ondersteunt directories, individuele files, git diffs, staged changes, CI/CD integratie, en 6 premium tools.

**Dual interface:** Dezelfde binary werkt als CLI tool (`sally roast`) en als MCP server (`sally mcp`) in Claude Code, Cursor, en Windsurf.

**Funnel positie:** Web Lite (gratis, 3/dag) → **CLI Free (90 QR/maand)** → Full Suite CLI (€14.99/mo)

---

## ARCHITECTUUR

```
Sally CLI (deze repo, lokaal op dev machine)
  │
  │  POST /api/v1/review    (code reviews)
  │  POST /api/v1/tool      (premium tools)
  │  POST /api/v1/auth/magic-link
  │  GET  /api/v1/entitlements
  │
  └──────> CynicalSally Backend (cynicalsally-render)
             ├── Rate limiting (deviceId)
             ├── Monthly quota enforcement
             ├── Authorization (free / Full Suite)
             ├── Claude AI review (Haiku QR, Sonnet FT)
             ├── Sally's persoonlijkheid (server-side prompts)
             └── Stripe checkout + webhooks
```

Alle AI logica, prompts, persoonlijkheid: 100% server-side.
CLI heeft GEEN Stripe code. Upgrade opent browser, pollt entitlements.

---

## STATUS

| Component | Status | Notes |
|-----------|--------|-------|
| CLI framework (commander) | ✅ DONE | 13 commands |
| File collection | ✅ DONE | Walk dirs, gitignore, binary skip |
| Git diff support | ✅ DONE | Staged, unstaged, branch diff, auto-detect |
| Terminal output | ✅ DONE | Score bar, issues, ASCII Sally, word wrap |
| Magic link auth | ✅ DONE | `sally login` → email → session |
| CI mode | ✅ DONE | `--json`, `--fail-under`, `--ci` |
| Device ID persistence | ✅ DONE | `~/.sally/config.json` |
| MCP server | ✅ DONE | 8 tools via stdio, Claude Code/Cursor/Windsurf |
| Premium tools (6x) | ✅ DONE | explain, refactor, review-pr, brainstorm, frontend, marketing |
| Background reviews | ✅ DONE | `--bg` flag, OS notifications, `sally results` |
| Markdown reports | ✅ DONE | Auto-saved to `.sally/` directory |
| Flavor text caching | ✅ DONE | 1h TTL, backend-driven personality |
| Upgrade flow | ✅ DONE | Browser checkout + entitlements polling |
| Echte AI reviews | ✅ DONE | Haiku (QR) + Sonnet (FT) via backend |
| README + OSS | ✅ DONE | Banner, screenshots, tool images, MIT license |
| Code refactoring | ✅ DONE | Sally's 6 review findings addressed |
| Full Suite branding | ✅ DONE | All public-facing text updated |
| NPM published | ✅ DONE | @cynicalsally/cli@0.1.0 live on NPM |
| Per-IDE MCP docs | ✅ DONE | Claude Code, Cursor, Windsurf setup instructions |
| Product Hunt draft | ✅ DONE | Scheduled 1 april, Render collab |
| JSON-LD pricing | ✅ DONE | Crawler/AI-readable pricing (render repo) |
| Chrome Extension | ✅ DONE | Published on Chrome Web Store |

---

## KEY FILES

| File | Doel |
|------|------|
| `src/index.ts` | CLI entry, command registration, welcome screen |
| `src/mcp-server.ts` | MCP server (8 tools via stdio) |
| `src/commands/roast.ts` | Main roast command (auto-detect, API, output) |
| `src/commands/tools.ts` | 6 premium tool commands |
| `src/commands/upgrade.ts` | Full Suite upgrade flow (browser + polling) |
| `src/utils/files.ts` | File collection (walk, gitignore, binary detect) |
| `src/utils/git.ts` | Git diff parsing (staged, unstaged, branch) |
| `src/utils/output.ts` | Terminal formatting + shared error handler |
| `src/utils/api.ts` | API client (review, tools, auth, entitlements) |
| `src/utils/config.ts` | Device ID + session persistence |
| `src/utils/report.ts` | Markdown report generation |
| `src/utils/flavor.ts` | Flavor text caching from backend |
| `src/utils/background.ts` | Background worker + OS notifications |

---

## TIER LIMITS (monthly)

| Tier | QR | FT | Tools | Model |
|------|----|----|-------|-------|
| CLI Free | 90 | — | 1 trial each | Haiku |
| Full Suite CLI | 500 | 100 | Unlimited | Sonnet-first |

---

## VOLGENDE STAPPEN

1. Safari Extension bouwen
2. Downloads badge weer aanzetten zodra NPM data toont
3. PH launch 1 april 10:00 AM PT + Render collab
4. Sitemap herindienen bij Google Search Console
5. Crawler pricing testen (Perplexity, etc.)

---

## ARCHIEF

### Sessie 2026-03-28
- NPM published: @cynicalsally/cli@0.1.0 live
- Per-IDE MCP setup instructies (Cursor, Claude Code, Windsurf)
- Product Hunt draft compleet, scheduled 1 april + Render collab
- JSON-LD structured pricing voor crawlers/AI (Full Suite + SuperClub)
- GitHub badges gefixed (license via GitHub endpoint, downloads uitgecommenteerd)
- Chrome Extension published op Chrome Web Store
- Eerste betalende klant + eerste downloads zonder marketing

### Sessie 2026-03-22
- README volledig herschreven met tool images, screenshots, branding
- MIT LICENSE file toegevoegd
- Banner + 6 tool images + Full Suite banner + 3 terminal screenshots
- Sally's 6 code review findings gefixt (-99 regels code)
- Full Suite branding doorgevoerd in alle public-facing output
- SC hint bug gefixt (Full Suite users zagen "1 free trial")
- `sally mcp` command toont nu alle 8 tools ipv "coming soon"
- Repo naar Shifra (Render) gestuurd voor review

---

*CynicalSally CLI — Thomas Geelens 2026*

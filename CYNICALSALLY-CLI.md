# CYNICALSALLY-CLI — Project File

> Source of truth voor de Sally CLI.
> Laatste update: 2026-03-14

---

## WAT IS DE CLI?

De volledige Sally CLI voor developers. Installeert via npm, draait lokaal, reviewt code met Sally's persoonlijkheid. Ondersteunt directories, individuele files, git diffs, staged changes, en CI/CD integratie.

**Verschil met Lite:** CLI is de volledige versie met login, git diff support, meerdere modes, en hogere quota's. Lite is de gratis proeverij.

**Funnel positie:** Lite (gratis, 3/dag) → **CLI Free (30 QR + 3 FT/maand)** → SuperClub CLI (€14.99/mo)

---

## ARCHITECTUUR

```
Sally CLI (deze repo, lokaal op dev machine)
  │
  │  POST /api/v1/review
  │  { files: [{path, content}], mode, deviceId, lang, tone }
  │
  └──────> CynicalSally Backend (cynicalsally-render)
             ├── Rate limiting (IP)
             ├── Device/monthly quota
             ├── Authorization (free / SC)
             ├── Claude AI review (Haiku QR, Sonnet FT)
             └── Sally's persoonlijkheid (server-side)
```

Alle AI logica, prompts, persoonlijkheid: 100% server-side.

---

## STATUS

| Component | Status | Notes |
|-----------|--------|-------|
| CLI framework (commander) | ✅ DONE | Roast command + options |
| File collection | ✅ DONE | Walk dirs, gitignore, binary skip |
| Git diff support | ✅ DONE | Staged, unstaged, branch diff |
| Terminal output | ✅ DONE | Score bar, issues, roast display |
| Magic link auth | ✅ DONE | `sally login` → email → session |
| CI mode | ✅ DONE | `--json`, `--fail-under`, `--ci` |
| Device ID persistence | ✅ DONE | `~/.sally/config.json` |
| Backend endpoint | ✅ DONE | `/api/v1/review` bestaat (stub/mock) |
| Echte AI reviews | ⬜ WACHT | Backend stuurt mock data tot Claude credits |

---

## BACKEND DEPENDENCY

Endpoint: `POST {API_URL}/api/v1/review`

**Request:**
```json
{
  "files": [{ "path": "src/app.ts", "content": "..." }],
  "mode": "quick" | "full_truth",
  "deviceId": "uuid",
  "lang": "en",
  "tone": "cynical"
}
```

**Response:**
```json
{
  "data": { "score": 7.2, "issues": [...], "actionable_fixes": [...] },
  "voice": { "roast": "...", "bright_side": "...", "hardest_sneer": "..." },
  "meta": { "mode": "quick", "files_reviewed": 5, "model": "haiku" },
  "quota": { "remaining": 25, "limit": 30 }
}
```

**Tier limits (monthly):**
| Tier | QR | FT | Model |
|------|----|----|-------|
| CLI Free | 30 | 3 | Haiku + Sonnet |
| SuperClub CLI | 500 | 100 | Sonnet-first |

---

## KEY FILES

| File | Doel |
|------|------|
| `src/commands/roast.ts` | Main roast command (file collection + API + output) |
| `src/utils/files.ts` | File collection (walk, gitignore, binary detect) |
| `src/utils/git.ts` | Git diff parsing (staged, unstaged, branch) |
| `src/utils/output.ts` | Terminal formatting (score bar, issues, roast) |
| `src/utils/api.ts` | API client (submitRoast, auth endpoints) |
| `src/utils/config.ts` | Device ID + session persistence |

---

## VOLGENDE STAPPEN

1. Claude API credits → backend mock data → echte reviews
2. End-to-end test: `sally roast ./src/` met echte AI response
3. npm publish voorbereiden
4. CI/CD integratie documenteren (GitHub Actions, etc.)

---

*CynicalSally CLI — Thomas 2026*

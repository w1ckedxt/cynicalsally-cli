# Privacy & Data Flow

How Cynical Sally handles your code, in engineering detail. The short version:
**your source code is processed in memory to produce a review, then discarded —
it is never written to disk, logs, or analytics.** Don't take our word for it —
run `sally roast --dry-run` and see the exact payload before anything is sent.

> This document describes the CLI (`@cynicalsally/cli`) and its backend. It is
> kept in sync with the code; if you find a discrepancy, please
> [open an issue](https://github.com/w1ckedxt/cynical-sally/issues) or report it
> per [SECURITY.md](../SECURITY.md).

---

## Verify before you trust

Every roast can be previewed. `--dry-run` runs the **exact** collection a real
roast would run — walking your directory, applying the secret/binary/size/
`.gitignore` rules — and then sends **nothing**:

```bash
sally roast --dry-run ./src/
```

It prints every file that *would* be uploaded with its byte size, a token
estimate, and a SHA-256 hash, plus every file that was **held back and why**. It
also writes a local receipt to `.sally/dry-run-<timestamp>.json` so you can diff
the hashes yourself. The MCP `sally_roast` tool exposes the same thing via its
`preview` flag.

---

## Data flow

```
┌─────────────────────────┐
│  Your machine (CLI/MCP)  │
│                          │
│  1. Collect files        │  Secret files (.env, keys, certs, credential
│     · skip secrets       │     files), binaries, >100 KB files, .gitignore
│     · skip binaries      │     matches, and build dirs are filtered out
│     · skip >100 KB       │     HERE, before anything leaves your machine.
│     · respect .gitignore │
│                          │
│  2. POST over HTTPS  ─────┼────────────────┐
└─────────────────────────┘                 │
                                             ▼
                          ┌──────────────────────────────────────┐
                          │  Backend (cynicalsally-render)         │
                          │                                        │
                          │  3. Validate + moderate payload        │
                          │  4. Build prompt, call Anthropic ──────┼──► Anthropic API
                          │  5. Parse the model's response         │     (no training on
                          │  6. Return review JSON to the CLI      │      submitted content)
                          │                                        │
                          │  Your code lives only in memory for    │
                          │  the duration of the request. It is    │
                          │  never written to a database, a log,   │
                          │  an error trace, or any APM/analytics. │
                          └──────────────────────────────────────┘
```

---

## What is — and isn't — retained

| Data | Retained? | Where | Notes |
| --- | --- | --- | --- |
| **Your source code** | **No** | — | In memory only for the request; discarded after the response. Never persisted, logged, or sent to APM. |
| Review result you see (score, issues) | Returned to you | your terminal / `.sally/` (local) | `full_truth` reviews are saved locally to `.sally/` on *your* machine. |
| Review **metadata** | Yes | backend events store | Random device ID, mode (`quick`/`full_truth`), **file count** (not paths or contents), score, model, duration, and request country. Used for quota and product analytics. |
| Repo **verdict** (`sally verdict`) | Yes | backend | For the public badge feature only: stores Sally's *analysis* (score, label, roast text) and the repo name you asked her to judge — **never your source code**. |
| Share card (`roast --share`) | Yes — **opt-in** | backend | Only created when you pass `--share`. Stores the score, Sally's one-liner, and (if available) your repo name on a public card page — **never your source code**. |
| Account link | Only if you log in | backend | Email ↔ device, for Full Suite. Anonymous until you run `sally login`. |
| Local config | Yes | `~/.sally/config.json` | Random device ID + (if linked) your email. Lives on your machine. |

**Code is never part of any retained record.** What's kept is the review and
counters, not the input.

---

## Subprocessors

| Service | Role | Sees your code? |
| --- | --- | --- |
| **Anthropic** (Claude API) | Generates the review | Yes — for the duration of the request. Anthropic does not train on API-submitted content. |
| **Render** | Backend hosting | Only in transit/in memory while serving the request. |
| **Stripe** | Payments (Full Suite) | No. Stripe only handles checkout; it never receives your code. The CLI contains no payment code — upgrades open a browser. |

---

## Log & error policy

- Application logs and error traces record **metadata and error objects only**
  (status codes, durations, the model's own error messages) — **never the
  request body or your source code.**
- There is **no third-party APM, Sentry, or analytics SDK** in the request path
  that would capture payloads.
- This was verified by auditing the backend's review, tool, and verdict request
  handlers and their error paths.

---

## On-machine secret filtering

Before a single byte is sent, the CLI skips:

- **Secret files:** `.env` / `.env.*`, `.npmrc`, `.netrc`, SSH keys
  (`id_rsa`, `id_ed25519`, …), and files with secret extensions
  (`.pem`, `.key`, `.p12`, `.pfx`, `.crt`, `.cer`, `.csr`, `.der`, `.kdbx`,
  `.ovpn`, `.asc`).
- **Sensitive directories:** `.aws`, `.ssh`, `.gnupg`, `.sally`, and any
  `secrets/` or `credentials/` directory.
- **Binaries**, files over **100 KB**, lockfiles, and anything matched by your
  `.gitignore`.

This filtering is in [`src/utils/files.ts`](../src/utils/files.ts) and is the
*same* code `--dry-run` reports from — so the preview is the ground truth, not a
separate approximation. You should still avoid pointing Sally at secrets on
purpose; review only code you're allowed to upload.

---

## Supply-chain integrity

Releases of `@cynicalsally/cli` are published with **npm provenance** — a signed,
publicly verifiable attestation that links each published version to the exact
source commit and CI workflow that built it. You can inspect it on the
[npm package page](https://www.npmjs.com/package/@cynicalsally/cli) or with
`npm audit signatures` after install.

---

For the user-facing summary, see [the website privacy page](https://cynicalsally.com/privacy).
Questions or a discrepancy? [Open an issue](https://github.com/w1ckedxt/cynical-sally/issues).

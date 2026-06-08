# sally-action — DRAFT scaffold (not released)

> ⚠️ **This is a scaffold, not a shipped action.** It is intentionally **not**
> wired up and **not** part of the `@cynicalsally/cli` npm package. It exists so
> the "Roast this PR" GitHub Action can be lifted into its own repo
> (`cynicalsally/sally-action`) when the backend prerequisite lands.
>
> **Blocking prerequisite:** headless CI auth. The backend needs an
> `POST /api/v1/auth/api-key` endpoint and `Authorization: Bearer <key>` support
> (Fase 1 in `plan/sally-action.md`) before this can authenticate without a
> browser session. Until then, `index.mjs` has no key to send.

## What it will do

On every pull request, run Sally over the changed files and post her verdict as
a PR comment — score, top issues, one savage line — updating the same comment on
each push (via a hidden marker). Optionally fail CI under a score threshold.

## Intended usage (once released as its own repo)

```yaml
# .github/workflows/sally.yml  — in the CONSUMER's repo
name: Sally Review
on: [pull_request]

jobs:
  roast:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write   # to post the comment
      contents: read
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }   # needed for the diff
      - uses: cynicalsally/sally-action@v1
        with:
          sally-key: ${{ secrets.SALLY_KEY }}
          mode: quick          # quick | full_truth (Full Suite)
          fail-under: 6        # optional: fail CI if score < 6
          comment: true        # post/update PR comment (default true)
          only-changed: true   # only the PR's changed files (default true)
```

## Files here

- `action.yml` — Action metadata: inputs, outputs, JS (node20) entrypoint.
- `src/index.mjs` — Entry skeleton. Wires inputs → CLI/backend → comment. The
  backend call is stubbed and clearly marked `TODO(Fase 1)`.
- `src/comment.mjs` — Pure function: roast JSON → PR-comment markdown. Testable
  today, no GitHub or network dependency.

## Promotion checklist (when moving to its own repo)

1. `npm init` + add `@actions/core`, `@actions/github`; bundle with `@vercel/ncc`
   and commit `dist/`.
2. Implement the backend key auth (Fase 1) and swap the stub in `index.mjs`.
3. Add a self-test workflow + a live test repo.
4. Marketplace listing (README, icon, tags), then the distribution push.

Full plan: `plan/sally-action.md`.

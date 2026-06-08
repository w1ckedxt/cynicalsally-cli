// DRAFT entrypoint skeleton for the Sally GitHub Action.
//
// This is NOT wired up. It depends on:
//   1. Backend headless auth (Authorization: Bearer <key>) — Fase 1, not built.
//   2. @actions/core + @actions/github + a bundler (@vercel/ncc) — added when
//      this moves to its own repo.
//
// The control flow below is the intended shape; the backend call is stubbed and
// marked TODO(Fase 1). `buildComment` is real and used as-is.

import { buildComment, COMMENT_MARKER } from "./comment.mjs";

// In the real repo these come from @actions/core. Stubbed so the shape is clear.
const core = {
  getInput: (name) => process.env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`] ?? "",
  getBooleanInput: (name) => (core.getInput(name) || "").toLowerCase() === "true",
  setOutput: (name, value) => console.log(`::set-output::${name}=${value}`),
  setFailed: (msg) => { console.error(msg); process.exitCode = 1; },
  warning: (msg) => console.warn(msg),
  info: (msg) => console.log(msg),
};

const SALLY_API = process.env.SALLY_API_URL || "https://cynicalsally-web.onrender.com";

async function run() {
  const sallyKey = core.getInput("sally-key");
  const mode = core.getInput("mode") || "quick";
  const failUnder = core.getInput("fail-under");
  const postComment = core.getBooleanInput("comment");

  if (!sallyKey) {
    // Fail soft by design: a missing key (e.g. fork PRs can't read secrets) must
    // not break someone's CI for no reason.
    core.warning("No sally-key provided — skipping Sally review. Add SALLY_KEY to repo secrets to enable.");
    return;
  }

  // 1. Collect the changed files. In the real action: read the PR diff via
  //    @actions/github (octokit) or `git diff`, then map to { path, content }.
  const files = []; // TODO(Fase 2): gather changed files from the PR.

  // 2. Submit to the backend with the API key.
  // TODO(Fase 1): this endpoint + Bearer auth do not exist yet.
  let roast;
  try {
    const res = await fetch(`${SALLY_API}/api/v1/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sallyKey}` },
      body: JSON.stringify({ type: "code", files, mode, tone: "cynical", lang: "en" }),
    });
    if (!res.ok) {
      // Out of quota → clear upsell, but don't hard-fail CI unless asked.
      core.warning(`Sally backend returned ${res.status}. Skipping. (Out of roasts? cynicalsally.com/upgrade)`);
      return;
    }
    roast = await res.json();
  } catch (err) {
    core.warning(`Could not reach Sally (${err}). Skipping review — not failing your build.`);
    return;
  }

  const score = Number(roast?.data?.score ?? 0);
  core.setOutput("score", score.toFixed(1));
  core.setOutput("issue-count", String(roast?.data?.issues?.length ?? 0));

  if (postComment) {
    const body = buildComment(roast); // includes COMMENT_MARKER for update-in-place
    // TODO(Fase 2): upsert the PR comment via octokit, finding the existing one by COMMENT_MARKER.
    core.info(`Would post PR comment (${body.length} chars, marker: ${COMMENT_MARKER}).`);
  }

  if (failUnder && score < Number(failUnder)) {
    core.setFailed(`Sally scored ${score.toFixed(1)} — below your threshold of ${failUnder}.`);
  }
}

run();

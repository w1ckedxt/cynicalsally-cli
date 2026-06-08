// Pure: roast JSON -> PR-comment markdown. No GitHub/network deps, testable today.
// This is the one piece that's fully implementable before the backend auth lands.

/** Hidden marker so the action can find and UPDATE its own comment instead of spamming. */
export const COMMENT_MARKER = "<!-- sally-action-comment -->";

const SEVERITY_RANK = { critical: 0, major: 1, minor: 2 };

/**
 * Build the PR comment body from a roast response (same shape the CLI/backend returns).
 * @param {{ data: { score: number, issues?: Array<{severity:string,issue_code:string,title:string,evidence?:string[]}> },
 *           voice: { roast?: string, bright_side?: string, hardest_sneer?: string },
 *           meta?: { mode?: string, files_reviewed?: number } }} roast
 * @returns {string} markdown
 */
export function buildComment(roast) {
  const score = Number(roast?.data?.score ?? 0).toFixed(1);
  const issues = (roast?.data?.issues ?? [])
    .slice()
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));
  const sneer = (roast?.voice?.hardest_sneer || roast?.voice?.roast || "").trim();

  const out = [COMMENT_MARKER, "", `## 🔥 Sally's Verdict: ${score} / 10`, ""];

  if (sneer) {
    out.push(`> ${sneer.split("\n").join("\n> ")}`, "");
  }

  if (issues.length > 0) {
    out.push(`### Issues (${issues.length})`);
    for (const i of issues) {
      const where = i.evidence?.[0] ? ` \`${i.evidence[0]}\`` : "";
      out.push(`- **[${String(i.severity).toUpperCase()}]**${where} — ${i.title}`);
    }
    out.push("");
  }

  if (roast?.voice?.bright_side) {
    out.push("### Bright side", `> ${roast.voice.bright_side}`, "");
  }

  out.push(
    "---",
    "*Roasted by [Cynical Sally](https://cynicalsally.com) — code review with attitude.*",
    "*[Get the Full Suite →](https://cynicalsally.com/upgrade)*",
  );
  return out.join("\n");
}

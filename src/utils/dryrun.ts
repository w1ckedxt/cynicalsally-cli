import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { API_BASE } from "./api.js";
import { describeSkipReason, type ReviewFile, type SkippedFile, type SkipReason } from "./files.js";

const REPORT_DIR = ".sally";

/** One file as it would appear in the request payload. */
export interface ManifestEntry {
  path: string;
  bytes: number;
  /** Rough token estimate (~4 chars/token). Clearly labelled an estimate. */
  tokens: number;
  sha256: string;
}

export interface PayloadManifest {
  entries: ManifestEntry[];
  totalBytes: number;
  totalTokens: number;
}

/** The local receipt written to disk so a user can verify what left their machine. */
interface Receipt {
  tool: string;
  generated_at: string;
  endpoint: string;
  mode: string;
  source: string;
  note: string;
  would_send: {
    file_count: number;
    total_bytes: number;
    estimated_tokens: number;
    files: ManifestEntry[];
  };
  held_back: {
    count: number;
    files: Array<{ path: string; reason: SkipReason; reason_text: string; detail?: string }>;
  };
  truncated: boolean;
}

/** ~4 characters per token is the common rough heuristic. */
function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

/** Build the exact payload manifest: byte size, token estimate, and SHA-256 per file. */
export function buildManifest(files: ReviewFile[]): PayloadManifest {
  const entries: ManifestEntry[] = files.map((f) => {
    const bytes = Buffer.byteLength(f.content, "utf-8");
    return {
      path: f.path,
      bytes,
      tokens: estimateTokens(f.content),
      sha256: createHash("sha256").update(f.content, "utf-8").digest("hex"),
    };
  });

  return {
    entries,
    totalBytes: entries.reduce((sum, e) => sum + e.bytes, 0),
    totalTokens: entries.reduce((sum, e) => sum + e.tokens, 0),
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTokens(tokens: number): string {
  return `~${tokens.toLocaleString("en-US")} tok`;
}

function ensureReportDir(): string {
  const dir = join(process.cwd(), REPORT_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return dir;
}

/** Write the SHA-256 receipt to .sally/. Returns the path, or null on failure. */
function writeReceipt(
  manifest: PayloadManifest,
  skipped: SkippedFile[],
  meta: { mode: string; source: string; truncated: boolean },
): string | null {
  try {
    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const time = now.toISOString().split("T")[1].slice(0, 8).replace(/:/g, "");
    const dir = ensureReportDir();
    const filepath = join(dir, `dry-run-${date}-${time}.json`);

    const receipt: Receipt = {
      tool: "cynical-sally",
      generated_at: now.toISOString(),
      endpoint: `POST ${API_BASE}/api/v1/review`,
      mode: meta.mode,
      source: meta.source,
      note:
        "Dry run — nothing was sent. This receipt lists exactly what a real roast " +
        "would upload, with a SHA-256 of each file so you can verify it yourself.",
      would_send: {
        file_count: manifest.entries.length,
        total_bytes: manifest.totalBytes,
        estimated_tokens: manifest.totalTokens,
        files: manifest.entries,
      },
      held_back: {
        count: skipped.length,
        files: skipped.map((s) => ({
          path: s.path,
          reason: s.reason,
          reason_text: describeSkipReason(s.reason),
          ...(s.detail ? { detail: s.detail } : {}),
        })),
      },
      truncated: meta.truncated,
    };

    writeFileSync(filepath, JSON.stringify(receipt, null, 2) + "\n", { mode: 0o600 });
    return join(REPORT_DIR, `dry-run-${date}-${time}.json`);
  } catch {
    return null;
  }
}

/**
 * Format a payload preview as plain markdown (no ANSI) — used by the MCP
 * `sally_roast` preview mode so an agent can show the user exactly what a roast
 * would upload, without sending anything.
 */
export function formatManifestMarkdown(
  files: ReviewFile[],
  skipped: SkippedFile[],
  meta: { mode: string },
): string {
  const manifest = buildManifest(files);
  const lines: string[] = [];

  lines.push(`## Dry run — nothing sent\n`);
  lines.push(
    `Endpoint that **would** receive this: \`POST ${API_BASE}/api/v1/review\` · mode: \`${meta.mode}\`\n`,
  );
  lines.push(
    `**Would send ${manifest.entries.length} file${manifest.entries.length !== 1 ? "s" : ""}** — ` +
      `${formatBytes(manifest.totalBytes)}, ~${manifest.totalTokens.toLocaleString("en-US")} tokens (est.)\n`,
  );

  if (manifest.entries.length > 0) {
    lines.push(`| File | Size | ~Tokens | SHA-256 |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const e of manifest.entries) {
      lines.push(`| \`${e.path}\` | ${formatBytes(e.bytes)} | ${e.tokens.toLocaleString("en-US")} | \`${e.sha256.slice(0, 16)}…\` |`);
    }
    lines.push("");
  }

  if (skipped.length > 0) {
    lines.push(`**Held back (${skipped.length}) — kept on your machine:**\n`);
    for (const s of skipped) {
      lines.push(`- \`${s.path}\` — ${describeSkipReason(s.reason)}${s.detail ? ` (${s.detail})` : ""}`);
    }
    lines.push("");
  }

  lines.push(`_Nothing was sent. Drop \`preview\` to actually roast._`);
  return lines.join("\n");
}

interface DryRunInput {
  files: ReviewFile[];
  skipped: SkippedFile[];
  truncated: boolean;
  mode: string;
  source: string;
}

/**
 * Print exactly what a roast would send, what's held back and why, and write a
 * local SHA-256 receipt. Sends NOTHING to the backend.
 */
export function printDryRun(input: DryRunInput): void {
  const { files, skipped, truncated, mode, source } = input;
  const manifest = buildManifest(files);

  console.log(chalk.magenta.bold("  ☢  DRY RUN") + chalk.gray("  — nothing leaves your machine"));
  console.log();
  console.log(chalk.gray("  This is exactly what a real roast would upload. Verify it, then run"));
  console.log(chalk.gray("  the same command without ") + chalk.cyan("--dry-run") + chalk.gray(" to actually send it.\n"));

  console.log(chalk.gray("  Endpoint that would receive it:"));
  console.log("    " + chalk.white(`POST ${API_BASE}/api/v1/review`));
  console.log(chalk.gray(`  Mode: `) + chalk.white(mode) + chalk.gray("   Source: ") + chalk.white(source));
  console.log();

  // ── Would send ──────────────────────────────────────────────────────
  if (manifest.entries.length > 0) {
    console.log(
      chalk.green.bold(`  WOULD SEND `) +
        chalk.white(`${manifest.entries.length} file${manifest.entries.length !== 1 ? "s" : ""}`) +
        chalk.gray(` · ${formatBytes(manifest.totalBytes)} · ~${manifest.totalTokens.toLocaleString("en-US")} tokens (est.)`),
    );
    console.log();

    const pathWidth = Math.min(
      48,
      Math.max(12, ...manifest.entries.map((e) => e.path.length)),
    );
    for (const e of manifest.entries) {
      const path = e.path.length > pathWidth ? "…" + e.path.slice(-(pathWidth - 1)) : e.path.padEnd(pathWidth);
      console.log(
        "    " +
          chalk.white(path) +
          chalk.gray("  " + formatBytes(e.bytes).padStart(8)) +
          chalk.gray("  " + formatTokens(e.tokens).padStart(10)) +
          chalk.gray("  " + e.sha256.slice(0, 12) + "…"),
      );
    }
    console.log();
  } else {
    console.log(chalk.yellow("  WOULD SEND nothing") + chalk.gray(" — every file was held back. See below.\n"));
  }

  // ── Held back ───────────────────────────────────────────────────────
  if (skipped.length > 0) {
    console.log(
      chalk.yellow.bold(`  HELD BACK `) +
        chalk.white(`${skipped.length} item${skipped.length !== 1 ? "s" : ""}`) +
        chalk.gray(" — kept on your machine"),
    );
    console.log();

    // Group by reason so the "why" is unmistakable.
    const byReason = new Map<SkipReason, SkippedFile[]>();
    for (const s of skipped) {
      const list = byReason.get(s.reason) ?? [];
      list.push(s);
      byReason.set(s.reason, list);
    }

    // Most trust-relevant reasons first.
    const order: SkipReason[] = ["secret", "gitignored", "too-large", "binary", "skip-file", "non-reviewable", "skipped-dir", "unreadable"];
    const reasons = [...byReason.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));

    for (const reason of reasons) {
      const list = byReason.get(reason)!;
      const marker = reason === "secret" ? chalk.red.bold("  ✖") : chalk.gray("  •");
      console.log(marker + " " + chalk.white(reason) + chalk.gray(`  (${list.length}) — ${describeSkipReason(reason)}`));
      const shown = list.slice(0, 8);
      for (const s of shown) {
        console.log("      " + chalk.gray(s.path) + (s.detail ? chalk.gray(`  (${s.detail})`) : ""));
      }
      if (list.length > shown.length) {
        console.log("      " + chalk.gray(`…and ${list.length - shown.length} more`));
      }
    }
    console.log();
  }

  if (truncated) {
    console.log(chalk.yellow(`  ⚠  Stopped at the 50-file limit — a real roast would send the same first 50.\n`));
  }

  // ── Receipt ─────────────────────────────────────────────────────────
  const receiptPath = writeReceipt(manifest, skipped, { mode, source, truncated });
  if (receiptPath) {
    console.log(chalk.gray("  🧾 SHA-256 receipt written to ") + chalk.cyan(receiptPath));
    console.log(chalk.gray("     Compare the hashes yourself — that's the whole point.\n"));
  }

  console.log(chalk.magenta("  Nothing was sent.") + chalk.gray(" Drop the ") + chalk.cyan("--dry-run") + chalk.gray(" flag when you're ready.\n"));
}

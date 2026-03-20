#!/usr/bin/env node

/**
 * Sally MCP Server — Cynical Sally as a tool in Claude Code, Cursor, etc.
 *
 * Tools:
 * - sally_roast: Review code files with Sally's brutal honesty
 * - sally_usage: Check quota and account status
 *
 * Same backend, same quota, same upgrade funnel as the CLI.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { submitRoast, checkEntitlements } from "./utils/api.js";
import { getDeviceId, getEmail } from "./utils/config.js";

const server = new McpServer(
  {
    name: "cynical-sally",
    version: "0.1.0",
  },
  {
    instructions: `You have access to Cynical Sally — a brutally honest, sharp-witted senior engineer who does code reviews. When the user mentions "Sally", asks Sally something, says "vraag Sally", "ask Sally", or wants Sally's opinion on code, use the sally_roast tool to review code or sally_usage to check their quota. Sally is NOT a PAL model — she is her own MCP tool. Always route Sally requests to these tools, never to other AI models.`,
  },
);

// ─── sally_roast tool ────────────────────────────────────────────────

server.tool(
  "sally_roast",
  "Ask Cynical Sally to review your code. She's brutally honest — sharp, witty, and always right. Quick mode for fast feedback, full_truth for deep analysis.",
  {
    files: z.array(z.object({
      path: z.string().describe("File path"),
      content: z.string().describe("File content"),
    })).describe("Code files to review"),
    mode: z.enum(["quick", "full_truth"]).default("quick").describe("quick = fast roast, full_truth = deep dive (SuperClub only for free tier)"),
    lang: z.string().default("en").describe("Response language code"),
    tone: z.enum(["cynical", "neutral", "professional"]).default("cynical").describe("Sally's tone"),
  },
  async ({ files, mode, lang, tone }) => {
    try {
      const response = await submitRoast({
        type: "code",
        files,
        mode,
        lang,
        tone,
      });

      // Format Sally's response for the IDE
      const parts: string[] = [];

      // Score
      parts.push(`## Score: ${response.data.score.toFixed(1)}/10\n`);

      // Sally's verdict
      parts.push(`### Sally's Verdict\n`);
      parts.push(response.voice.roast);
      parts.push("");

      // Issues (full_truth)
      if (response.data.issues && response.data.issues.length > 0) {
        parts.push(`### Top Issues\n`);
        for (let i = 0; i < response.data.issues.length; i++) {
          const issue = response.data.issues[i];
          parts.push(`**${i + 1}. ${issue.severity.toUpperCase()} — \`${issue.issue_code}\`**`);
          parts.push(`${issue.title}`);
          parts.push(`${issue.description}`);
          if (issue.evidence && issue.evidence.length > 0) {
            for (const e of issue.evidence) {
              parts.push(`→ ${e}`);
            }
          }
          if (issue.fix) {
            parts.push(`✓ Fix: ${issue.fix}`);
          }
          parts.push("");
        }
      }

      // Actionable fixes
      if (response.data.actionable_fixes && response.data.actionable_fixes.length > 0) {
        parts.push(`### Actionable Fixes\n`);
        for (const fix of response.data.actionable_fixes) {
          parts.push(`- ✓ ${fix}`);
        }
        parts.push("");
      }

      // Bright side + sneer
      if (response.voice.bright_side) {
        parts.push(`> ✨ ${response.voice.bright_side}\n`);
      }
      if (response.voice.hardest_sneer) {
        parts.push(`> 🔥 ${response.voice.hardest_sneer}\n`);
      }

      parts.push(`\n*${response.meta.mode === "full_truth" ? "Full Truth" : "Quick Roast"} • ${response.meta.files_reviewed} files • ${response.meta.model}*`);

      return {
        content: [{ type: "text", text: parts.join("\n") }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Sally couldn't review that: ${message}\n\nRun \`sally upgrade\` in your terminal for SuperClub access.` }],
        isError: true,
      };
    }
  },
);

// ─── sally_usage tool ────────────────────────────────────────────────

server.tool(
  "sally_usage",
  "Check your Sally quota and account status",
  {},
  async () => {
    try {
      const entitlements = await checkEntitlements();
      const email = getEmail();
      const deviceId = getDeviceId();

      const parts: string[] = [];
      parts.push("## Sally Account Status\n");

      if (email) parts.push(`**Email:** ${email}`);
      parts.push(`**Device:** ${deviceId.slice(0, 8)}...`);

      const tier = entitlements.cliTier || (entitlements.isSuperClub ? "sc" : "lite");

      if (tier === "sc") {
        parts.push(`**Tier:** SuperClub CLI ✓`);
        parts.push(`**Quick Reviews:** unlimited`);
        parts.push(`**Full Truth:** unlimited`);
      } else {
        parts.push(`**Tier:** Sally CLI Free`);
        if (entitlements.cliQuota) {
          parts.push(`**Quick Reviews:** ${entitlements.cliQuota.qr.remaining}/${entitlements.cliQuota.qr.limit} remaining`);
          parts.push(`**Full Truth:** ${entitlements.cliQuota.ft.remaining}/${entitlements.cliQuota.ft.limit} remaining`);
        }
        parts.push(`\n*Run \`sally upgrade\` in your terminal for unlimited roasts.*`);
      }

      return {
        content: [{ type: "text", text: parts.join("\n") }],
      };
    } catch {
      return {
        content: [{ type: "text", text: "Couldn't check account status. Network error." }],
        isError: true,
      };
    }
  },
);

// ─── Start server ────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Sally MCP server failed to start:", err);
  process.exit(1);
});

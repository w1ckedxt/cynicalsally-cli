import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolve } from "node:path";
import { readFileSync, statSync, existsSync } from "node:fs";
import { submitTool, ApiError, type ToolName, type ToolResponse } from "../utils/api.js";
import { printSally } from "../utils/output.js";
import { saveToolReport } from "../utils/report.js";
import { getFlavor } from "../utils/flavor.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const TERMINAL_WIDTH = Math.min(process.stdout.columns || 80, 90);

function divider(): void {
  console.log(chalk.gray("  " + "\u2500".repeat(Math.min(56, TERMINAL_WIDTH - 4))));
}

function highlightCode(text: string): string {
  return text.replace(/`([^`]+)`/g, (_, code: string) => chalk.cyan(`\`${code}\``));
}

function printWrapped(text: string, indent = "    ", color = chalk.white): void {
  const contentWidth = TERMINAL_WIDTH - 6;
  const words = highlightCode(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const plainCurrent = current.replace(/\x1b\[[0-9;]*m/g, "");
    const plainWord = word.replace(/\x1b\[[0-9;]*m/g, "");
    if (plainCurrent.length + plainWord.length + 1 > contentWidth && current) {
      lines.push(indent + current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(indent + current);
  for (const line of lines) console.log(color(line));
}

const MAX_INPUT_SIZE = 500 * 1024; // 500KB — matches backend limit

/** Read file content or return raw text argument */
function resolveContent(input: string): string {
  // Try as a file path first
  const resolved = resolve(input);
  try {
    if (existsSync(resolved) && statSync(resolved).isFile()) {
      const stat = statSync(resolved);
      if (stat.size > MAX_INPUT_SIZE) {
        throw new Error(`File too large (${Math.round(stat.size / 1024)}KB). Max ${MAX_INPUT_SIZE / 1024}KB.`);
      }
      return readFileSync(resolved, "utf-8");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("too large")) throw err;
    // Not a file, treat as raw text
  }
  return input;
}

/** Read from stdin if available (with size limit) */
async function readStdin(): Promise<string | null> {
  if (process.stdin.isTTY) return null;
  const chunks: Buffer[] = [];
  let totalSize = 0;
  for await (const chunk of process.stdin) {
    totalSize += chunk.length;
    if (totalSize > MAX_INPUT_SIZE) {
      throw new Error(`Input too large (>${MAX_INPUT_SIZE / 1024}KB). Pipe a smaller file.`);
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf-8").trim();
  return text || null;
}

/** Display a generic tool response */
function displayToolResponse(response: ToolResponse): void {
  const { voice, messages, data } = response;

  // Header
  const toolLabel = response.tool.replace("_", " ").toUpperCase();
  console.log(chalk.magenta.bold(`  SALLY'S ${toolLabel}`));
  console.log(chalk.gray(`  ${response.meta.tool} \u2022 ${response.meta.model}`));
  console.log();

  // Score (if present)
  const score = data.scorecard as number | undefined;
  if (typeof score === "number") {
    const formatted = score.toFixed(1);
    const colorFn = score < 4 ? chalk.red.bold : score < 7 ? chalk.yellow.bold : chalk.green.bold;
    const filled = Math.round(score);
    const bar = chalk.magenta("\u2588".repeat(filled)) + chalk.gray("\u2591".repeat(10 - filled));
    console.log(`  ${chalk.gray("Score:")} ${colorFn(formatted)}/10  [${bar}]`);
    console.log();
    divider();
    console.log();
  }

  // Messages
  if (messages.length > 0) {
    // Intro
    const intro = messages.find((m) => m.type === "intro");
    if (intro) {
      printWrapped(intro.text, "  ", chalk.white.italic);
      console.log();
    }

    // Body messages (skip intro and final)
    const body = messages.filter((m) => m.type !== "intro" && m.type !== "final");
    if (body.length > 0) {
      divider();
      console.log();
      for (let i = 0; i < body.length; i++) {
        const label = body[i].type.toUpperCase();
        const num = chalk.magenta.bold(`  ${i + 1}.`);
        const typeTag = chalk.gray(` [${label}]`);
        console.log(`${num}${typeTag}`);
        printWrapped(body[i].text, "     ", chalk.white);
        console.log();
      }
    }

    // Final
    const final = messages.find((m) => m.type === "final");
    if (final) {
      divider();
      console.log();
      console.log(chalk.gray("  VERDICT"));
      console.log();
      printWrapped(final.text, "  ", chalk.white.bold);
      console.log();
    }
  }

  // Refactors (refactor tool)
  const refactors = data.refactors as Array<{ title: string; priority: string; pattern: string; before: string; after: string }> | undefined;
  if (refactors && refactors.length > 0) {
    divider();
    console.log();
    console.log(chalk.magenta.bold("  REFACTORING SUGGESTIONS"));
    console.log();
    for (let i = 0; i < refactors.length; i++) {
      const r = refactors[i];
      const priorityColor = r.priority === "high" ? chalk.red.bold : r.priority === "medium" ? chalk.yellow.bold : chalk.gray;
      console.log(`  ${chalk.white.bold(`${i + 1}.`)} ${priorityColor(r.priority.toUpperCase())} ${chalk.white.bold(r.title)}`);
      console.log(`     ${chalk.gray("Pattern:")} ${chalk.cyan(r.pattern)}`);
      if (r.before) {
        console.log(chalk.gray("     Before:"));
        for (const line of r.before.split("\n").slice(0, 6)) {
          console.log(chalk.red(`       ${line}`));
        }
      }
      if (r.after) {
        console.log(chalk.gray("     After:"));
        for (const line of r.after.split("\n").slice(0, 6)) {
          console.log(chalk.green(`       ${line}`));
        }
      }
      console.log();
    }
  }

  // Issues (frontend tool)
  const issues = data.issues as Array<{ category: string; severity: string; description: string; fix: string }> | undefined;
  if (issues && issues.length > 0) {
    divider();
    console.log();
    console.log(chalk.magenta.bold("  ISSUES FOUND"));
    console.log();
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      const sevColor = issue.severity === "critical" ? chalk.red.bold : issue.severity === "major" ? chalk.yellow.bold : chalk.gray;
      console.log(`  ${chalk.white.bold(`${i + 1}.`)} ${sevColor(issue.severity.toUpperCase())} ${chalk.cyan(issue.category)}`);
      printWrapped(issue.description, "     ", chalk.gray);
      if (issue.fix) {
        console.log(`     ${chalk.green("\u2713")} ${chalk.green(highlightCode(issue.fix))}`);
      }
      console.log();
    }
  }

  // Rewrites (marketing tool)
  const rewrites = data.rewrites as Array<{ original: string; improved: string; why: string }> | undefined;
  if (rewrites && rewrites.length > 0) {
    divider();
    console.log();
    console.log(chalk.magenta.bold("  COPY REWRITES"));
    console.log();
    for (let i = 0; i < rewrites.length; i++) {
      const rw = rewrites[i];
      console.log(`  ${chalk.white.bold(`${i + 1}.`)}`);
      console.log(chalk.red(`     Before: "${rw.original}"`));
      console.log(chalk.green(`     After:  "${rw.improved}"`));
      printWrapped(rw.why, "     ", chalk.gray);
      console.log();
    }
  }

  // Bright side & hardest sneer
  divider();
  console.log();
  if (voice.bright_side) {
    printWrapped(`\u2728 ${voice.bright_side}`, "  ", chalk.green.italic);
  }
  if (voice.hardest_sneer) {
    console.log();
    printWrapped(`\uD83D\uDD25 ${voice.hardest_sneer}`, "  ", chalk.red.bold);
  }
  console.log();

  // Quota info
  if (response.quota) {
    const { remaining, limit } = response.quota;
    if (remaining < Infinity && limit < Infinity) {
      console.log(chalk.gray(`  ${remaining}/${limit} uses remaining this month`));
      console.log();
    }
  }
}

/** Handle tool errors with Sally's personality */
function handleToolError(err: unknown): void {
  if (err instanceof ApiError) {
    console.log(chalk.red(`\n${err.message}\n`));
    if (err.statusCode === 429) {
      console.log(chalk.magenta.bold("  SuperClub CLI") + chalk.gray(" — unlock all of Sally's tools:\n"));
      console.log(chalk.gray("  \u2022") + chalk.white(" Unlimited explain, refactor, review-pr, brainstorm, frontend, marketing"));
      console.log(chalk.gray("  \u2022") + chalk.white(" 500 Quick Roasts + 100 Full Truth deep-dives/month"));
      console.log(chalk.gray("  \u2022") + chalk.white(" Sally's premium priority processing\n"));
      console.log(chalk.gray("  Run ") + chalk.cyan("sally upgrade") + chalk.gray(" — you know you want to.\n"));
    }
  } else if (err instanceof TypeError) {
    console.log(chalk.red("\nCan't reach the server.") + chalk.gray(" Either I'm napping or your internet is trash.\n"));
  } else {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(chalk.red(`\nSomething unexpected: ${msg}`) + chalk.gray("\nI blame your machine.\n"));
  }
}

/** Generic tool runner */
async function runTool(
  toolName: ToolName,
  content: string,
  spinnerKey: string,
  options: { lang?: string; json?: boolean },
): Promise<void> {
  const f = getFlavor();
  const spinnerText = (f as unknown as Record<string, string>)[spinnerKey] || "Processing...";

  printSally();
  console.log();

  const spinner = ora({ text: spinnerText, color: "magenta" }).start();

  try {
    const response = await submitTool({
      tool: toolName,
      content,
      lang: options.lang || "en",
    });

    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(response, null, 2));
    } else {
      displayToolResponse(response);

      // Auto-save tool report to .sally/ directory
      const savedPath = saveToolReport(response);
      if (savedPath) {
        console.log(chalk.gray("  💾 ") + chalk.gray("Saved to ") + chalk.cyan(savedPath));
        console.log();
      }
    }
  } catch (err) {
    spinner.stop();
    handleToolError(err);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export const explainCommand = new Command("explain")
  .description("Sally explains code in her cynical but accurate style")
  .argument("[input]", "File path or code snippet to explain")
  .option("--lang <lang>", "Response language", "en")
  .option("--json", "Output raw JSON")
  .action(async (input: string | undefined, options) => {
    let content = "";

    if (input) {
      content = resolveContent(input);
    } else {
      const stdin = await readStdin();
      if (stdin) {
        content = stdin;
      } else {
        // No input — scan current directory
        const { collectFiles } = await import("../utils/files.js");
        const files = collectFiles(resolve("."));
        if (files.length > 0) {
          content = files.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join("\n\n");
        } else {
          console.log(chalk.yellow("\nNothing to explain here.") + chalk.gray(" No code files found.\n"));
          process.exit(1);
        }
      }
    }

    await runTool("explain", content, "tool_spinner_explain", options);
  });

export const reviewPrCommand = new Command("review-pr")
  .description("Sally reviews a PR diff with devastating precision")
  .argument("[pr-number]", "PR number (uses git to get diff) or file with diff")
  .option("--lang <lang>", "Response language", "en")
  .option("--json", "Output raw JSON")
  .action(async (prNumber: string | undefined, options) => {
    let content = "";

    // Try stdin first
    const stdin = await readStdin();
    if (stdin) {
      content = stdin;
    } else if (prNumber) {
      // If it's a file, read it
      const resolved = resolve(prNumber);
      try {
        if (existsSync(resolved) && statSync(resolved).isFile()) {
          content = readFileSync(resolved, "utf-8");
        } else {
          // Try to get PR diff from git
          const { execSync } = await import("node:child_process");
          try {
            // Try `gh pr diff` first (GitHub CLI)
            // Sanitize PR number to prevent command injection
            const safePr = String(prNumber).replace(/[^0-9]/g, "");
            content = execSync(`gh pr diff ${safePr}`, { encoding: "utf-8", maxBuffer: 5_000_000 });
          } catch {
            // Fallback: try getting diff vs main
            try {
              content = execSync(`git diff main...HEAD`, { encoding: "utf-8", maxBuffer: 5_000_000 });
            } catch {
              console.log(chalk.yellow(`\nCouldn't get PR diff for #${prNumber}.`) + chalk.gray(" Install 'gh' CLI or pipe the diff directly.\n"));
              console.log(chalk.gray("  gh pr diff 42 | sally review-pr"));
              console.log(chalk.gray("  git diff main | sally review-pr\n"));
              process.exit(1);
            }
          }
        }
      } catch {
        console.log(chalk.red(`\nCan't read ${prNumber}.`) + chalk.gray(" Is that a real path?\n"));
        process.exit(1);
      }
    } else {
      // No args: try to get current branch diff vs main
      const { execSync } = await import("node:child_process");
      try {
        content = execSync("git diff main...HEAD", { encoding: "utf-8", maxBuffer: 5_000_000 });
        if (!content.trim()) {
          content = execSync("git diff HEAD~1..HEAD", { encoding: "utf-8", maxBuffer: 5_000_000 });
        }
      } catch {
        console.log(chalk.yellow("\nNo diff found.") + chalk.gray(" Are you on a branch with changes?\n"));
        console.log(chalk.gray("  sally review-pr 42") + chalk.gray("        # Review PR #42 (needs gh CLI)"));
        console.log(chalk.gray("  git diff main | sally review-pr") + chalk.gray("  # Pipe a diff"));
        console.log(chalk.gray("  sally review-pr diff.patch") + chalk.gray("    # Read from file\n"));
        process.exit(1);
      }
    }

    if (!content.trim()) {
      console.log(chalk.yellow("\nEmpty diff.") + chalk.gray(" Nothing to review. That's... actually your best work.\n"));
      process.exit(1);
    }

    await runTool("review_pr", content, "tool_spinner_review_pr", options);
  });

export const refactorCommand = new Command("refactor")
  .description("Sally suggests concrete refactoring with code examples")
  .argument("[input]", "File path or code to refactor")
  .option("--lang <lang>", "Response language", "en")
  .option("--json", "Output raw JSON")
  .action(async (input: string | undefined, options) => {
    let content = "";

    if (input) {
      content = resolveContent(input);
    } else {
      const stdin = await readStdin();
      if (stdin) {
        content = stdin;
      } else {
        // No input — scan current directory
        const { collectFiles } = await import("../utils/files.js");
        const files = collectFiles(resolve("."));
        if (files.length > 0) {
          content = files.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join("\n\n");
        } else {
          console.log(chalk.yellow("\nNothing to refactor here.") + chalk.gray(" No code files found.\n"));
          process.exit(1);
        }
      }
    }

    await runTool("refactor", content, "tool_spinner_refactor", options);
  });

export const brainstormCommand = new Command("brainstorm")
  .description("Sally gives cynical but valuable feedback on your idea")
  .argument("[description...]", "Description of your idea or approach")
  .option("--lang <lang>", "Response language", "en")
  .option("--json", "Output raw JSON")
  .action(async (descParts: string[], options) => {
    let content = "";

    // Check if input refers to "this project/code" — scan directory for context
    const rawInput = descParts.join(" ").toLowerCase();
    const needsProjectContext = descParts.length === 0 ||
      rawInput.includes("this project") ||
      rawInput.includes("this code") ||
      rawInput.includes("this repo") ||
      rawInput.includes("this app") ||
      rawInput.includes("dit project") ||
      rawInput.length < 20;

    if (descParts.length > 0 && !needsProjectContext) {
      // Check if first arg is a file
      const firstArg = descParts[0];
      const resolved = resolve(firstArg);
      try {
        if (descParts.length === 1 && existsSync(resolved) && statSync(resolved).isFile()) {
          content = readFileSync(resolved, "utf-8");
        } else {
          content = descParts.join(" ");
        }
      } catch {
        content = descParts.join(" ");
      }
    } else if (needsProjectContext) {
      // Scan current directory and include as context
      const { collectFiles } = await import("../utils/files.js");
      const files = collectFiles(resolve("."));
      const userPrompt = descParts.length > 0 ? descParts.join(" ") : "What do you think of this project?";
      if (files.length > 0) {
        content = `${userPrompt}\n\nHere's the project code:\n\n${files.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join("\n\n")}`;
      } else {
        content = userPrompt;
      }
    } else {
      const stdin = await readStdin();
      if (stdin) {
        content = stdin;
      } else {
        // No input at all — scan current directory as context
        const { collectFiles: collectBs } = await import("../utils/files.js");
        const files = collectBs(resolve("."));
        if (files.length > 0) {
          content = "What do you think of this project?\n\n" + files.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join("\n\n");
        } else {
          console.log(chalk.yellow("\nNothing here to brainstorm about.") + chalk.gray(" No files found.\n"));
          process.exit(1);
        }
      }
    }

    await runTool("brainstorm", content, "tool_spinner_brainstorm", options);
  });

export const frontendCommand = new Command("frontend")
  .description("Sally roasts your frontend code and design decisions")
  .argument("[input]", "File path or frontend code to review")
  .option("--lang <lang>", "Response language", "en")
  .option("--json", "Output raw JSON")
  .action(async (input: string | undefined, options) => {
    let content = "";

    if (input) {
      const resolved = resolve(input);
      try {
        const stat = statSync(resolved);
        if (stat.isDirectory()) {
          // Collect frontend files from directory
          const { collectFiles } = await import("../utils/files.js");
          const files = collectFiles(resolved);
          content = files.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join("\n\n");
        } else {
          content = readFileSync(resolved, "utf-8");
        }
      } catch {
        // Treat as raw code
        content = input;
      }
    } else {
      const stdin = await readStdin();
      if (stdin) {
        content = stdin;
      } else {
        // No input — scan current directory
        const { collectFiles: collectFrontend } = await import("../utils/files.js");
        const files = collectFrontend(resolve("."));
        if (files.length > 0) {
          content = files.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join("\n\n");
        } else {
          console.log(chalk.yellow("\nNo frontend code found here.\n"));
          process.exit(1);
        }
      }
    }

    await runTool("frontend_review", content, "tool_spinner_frontend", options);
  });

export const marketingCommand = new Command("marketing")
  .description("Sally reviews your marketing copy and branding")
  .argument("[input...]", "Marketing text, file, or description")
  .option("--lang <lang>", "Response language", "en")
  .option("--json", "Output raw JSON")
  .action(async (inputParts: string[], options) => {
    let content = "";

    if (inputParts.length > 0) {
      const firstArg = inputParts[0];
      const resolved = resolve(firstArg);
      try {
        if (inputParts.length === 1 && existsSync(resolved) && statSync(resolved).isFile()) {
          content = readFileSync(resolved, "utf-8");
        } else {
          content = inputParts.join(" ");
        }
      } catch {
        content = inputParts.join(" ");
      }
    } else {
      const stdin = await readStdin();
      if (stdin) {
        content = stdin;
      } else {
        // No input — look for marketing-relevant files (README, HTML, package.json, etc.)
        const marketingFiles = ["README.md", "readme.md", "README", "index.html", "landing.html", "package.json"];
        const { readFileSync: readFs, existsSync: existsFs } = await import("node:fs");
        const { resolve: resolvePath } = await import("node:path");
        const found: string[] = [];
        for (const f of marketingFiles) {
          const fp = resolvePath(".", f);
          if (existsFs(fp)) {
            try {
              const text = readFs(fp, "utf-8");
              found.push(`### ${f}\n\`\`\`\n${text.slice(0, 10_000)}\n\`\`\``);
            } catch { /* skip */ }
          }
        }
        if (found.length > 0) {
          content = "Review the marketing copy and branding in this project:\n\n" + found.join("\n\n");
        } else {
          console.log(chalk.yellow("\nNo marketing content found.") + chalk.gray(" Pass text, a file, or a URL.\n"));
          console.log(chalk.gray('  sally marketing "Your tagline here"'));
          console.log(chalk.gray("  sally marketing README.md\n"));
          process.exit(1);
        }
      }
    }

    await runTool("marketing_review", content, "tool_spinner_marketing", options);
  });

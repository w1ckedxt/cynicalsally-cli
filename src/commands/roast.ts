import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolve } from "node:path";
import { statSync } from "node:fs";
import { readFileForReview, collectFiles } from "../utils/files.js";
import { submitRoast, ApiError } from "../utils/api.js";
import { displayRoast } from "../utils/output.js";
import type { ReviewFile } from "../utils/files.js";

export const roastCommand = new Command("roast")
  .description("Roast your code. Files, directories, staged changes, or branch diffs.")
  .argument("[paths...]", "Files or directories to roast")
  .option("--staged", "Roast staged git changes")
  .option("--diff <branch>", "Roast diff against a branch (e.g. main)")
  .option("-m, --mode <mode>", "Review mode: full_truth (default) or quick", "full_truth")
  .option("--tone <tone>", "Tone: cynical, neutral, or professional", "cynical")
  .option("--lang <lang>", "Language for the roast", "en")
  .option("--json", "Output raw JSON (for piping/CI)")
  .option("--fail-under <score>", "Exit with code 1 if score is below threshold", parseFloat)
  .option("--ci", "CI mode: compact output + exit codes")
  .action(async (paths: string[], options) => {
    // Dynamic imports for git utils (only when needed)
    const { isGitRepo, getStagedChanges, getUnstagedChanges, getLastCommitDiff, getBranchDiff, parseDiffToFiles } =
      await import("../utils/git.js");

    // ── Collect files ──────────────────────────────────────────────────
    let files: ReviewFile[] = [];
    let source = "";

    try {
      if (options.staged) {
        if (!isGitRepo()) {
          console.log(chalk.red("\nNot a git repository.") + " --staged requires git.\n");
          process.exit(1);
        }
        const diff = getStagedChanges();
        if (!diff.trim()) {
          console.log(chalk.yellow("\nNo staged changes.") + " Stage some files first: " + chalk.cyan("git add <files>") + "\n");
          process.exit(1);
        }
        files = parseDiffToFiles(diff);
        source = "staged changes";
      } else if (options.diff) {
        if (!isGitRepo()) {
          console.log(chalk.red("\nNot a git repository.") + " --diff requires git.\n");
          process.exit(1);
        }
        const diff = getBranchDiff(options.diff);
        if (!diff.trim()) {
          console.log(chalk.yellow("\nNo diff found") + ` against ${chalk.cyan(options.diff)}.\n`);
          process.exit(1);
        }
        files = parseDiffToFiles(diff);
        source = `diff vs ${options.diff}`;
      } else if (paths.length > 0) {
        for (const p of paths) {
          const resolved = resolve(p);
          let stat;
          try {
            stat = statSync(resolved);
          } catch {
            console.log(chalk.red(`\nPath not found: ${p}\n`));
            process.exit(1);
          }

          if (stat.isDirectory()) {
            const collected = collectFiles(resolved);
            files.push(...collected);
          } else if (stat.isFile()) {
            const file = readFileForReview(resolved);
            if (file) {
              files.push(file);
            } else {
              console.log(chalk.yellow(`Skipped: ${p}`) + chalk.gray(" (binary, too large, or unsupported)"));
            }
          }
        }
        source = paths.join(", ");
      } else {
        // ── Smart auto-detect: no args = roast what you just did ───────
        if (!isGitRepo()) {
          console.log(
            chalk.red("\nNothing to roast.") +
              " Not in a git repo, so give me a path:\n\n" +
              chalk.gray("  sally roast ./src/              ") + "# Roast a directory\n" +
              chalk.gray("  sally roast app.tsx             ") + "# Roast a file\n"
          );
          process.exit(1);
        }

        const staged = getStagedChanges();
        if (staged.trim()) {
          files = parseDiffToFiles(staged);
          source = "staged changes";
          console.log(chalk.gray("\n  Auto-detected staged changes.\n"));
        }

        if (files.length === 0) {
          const unstaged = getUnstagedChanges();
          if (unstaged.trim()) {
            files = parseDiffToFiles(unstaged);
            source = "unstaged changes";
            console.log(chalk.gray("\n  Auto-detected uncommitted changes.\n"));
          }
        }

        if (files.length === 0) {
          try {
            const lastCommit = getLastCommitDiff();
            if (lastCommit.trim()) {
              files = parseDiffToFiles(lastCommit);
              source = "last commit";
              console.log(chalk.gray("\n  No changes found. Roasting last commit.\n"));
            }
          } catch {
            // No commits yet
          }
        }

        if (files.length === 0) {
          console.log(
            chalk.yellow("\nNo changes to roast.") +
              " Write some code first, or specify a path:\n\n" +
              chalk.gray("  sally roast ./src/") + "\n"
          );
          process.exit(1);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`\nError collecting files: ${msg}\n`));
      process.exit(1);
    }

    if (files.length === 0) {
      console.log(chalk.yellow("\nNo reviewable files found.") + " Nothing to roast.\n");
      process.exit(1);
    }

    // ── Call API ───────────────────────────────────────────────────────
    const mode = options.mode === "quick" ? "quick" : "full_truth";
    const fileCount = `${files.length} file${files.length !== 1 ? "s" : ""}`;
    const spinnerText = mode === "full_truth"
      ? `Sally is deep-diving ${fileCount} (${source})...`
      : `Sally is scanning ${fileCount} (${source})...`;

    const spinner = ora({ text: spinnerText, color: "magenta" }).start();

    try {
      const response = await submitRoast({
        type: "code",
        files,
        mode,
        tone: options.tone || "cynical",
        lang: options.lang || "en",
      });

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
      } else {
        displayRoast(response);
      }

      if (options.failUnder !== undefined && response.data.score < options.failUnder) {
        if (!options.json) {
          console.log(
            chalk.red(`  Score ${response.data.score.toFixed(1)} is below threshold ${options.failUnder.toFixed(1)}. Failing.\n`)
          );
        }
        process.exit(1);
      }
    } catch (err) {
      spinner.stop();

      if (err instanceof ApiError) {
        console.log(chalk.red(`\n${err.message}\n`));
        if (err.statusCode === 401) {
          console.log(chalk.gray("  Run: ") + chalk.cyan("sally login your@email.com") + "\n");
        }
        if (err.statusCode === 402) {
          console.log(chalk.gray("  Run: ") + chalk.cyan("sally upgrade") + "\n");
        }
      } else if (err instanceof TypeError) {
        console.log(chalk.red("\nNetwork error. Is the backend reachable?\n"));
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`\nUnexpected error: ${msg}\n`));
      }

      process.exit(1);
    }
  });

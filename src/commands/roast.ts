import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolve } from "node:path";
import { statSync } from "node:fs";
import { readFileForReview, collectFiles } from "../utils/files.js";
import { submitRoast } from "../utils/api.js";
import { displayRoast, printSally, handleApiError } from "../utils/output.js";
import { saveReport } from "../utils/report.js";
import { askBackground, spawnBackgroundWorker, saveResult, sendNotification } from "../utils/background.js";
import { getFlavor } from "../utils/flavor.js";
import { showToolsHint, getEmail } from "../utils/config.js";
import { isGitRepo, getStagedChanges, getUnstagedChanges, getLastCommitDiff, getBranchDiff, parseDiffToFiles } from "../utils/git.js";
import type { ReviewFile } from "../utils/files.js";

export const roastCommand = new Command("roast")
  .description("Roast your code. Files, directories, staged changes, or branch diffs.")
  .argument("[paths...]", "Files or directories to roast")
  .option("--staged", "Roast staged git changes")
  .option("--diff <branch>", "Roast diff against a branch (e.g. main)")
  .option("-m, --mode <mode>", "Review mode: quick (default) or full_truth", "quick")
  .option("--tone <tone>", "Tone: cynical, neutral, or professional", "cynical")
  .option("--lang <lang>", "Language for the roast", "en")
  .option("--json", "Output raw JSON (for piping/CI)")
  .option("--fail-under <score>", "Exit with code 1 if score is below threshold", parseFloat)
  .option("--ci", "CI mode: compact output + exit codes")
  .option("--bg", "Run Full Truth in the background — get notified when done")
  .option("--bg-worker")
  .action(async (paths: string[], options) => {
    // ── Collect files ──────────────────────────────────────────────────
    let files: ReviewFile[] = [];
    let source = "";

    try {
      if (options.staged) {
        if (!isGitRepo()) {
          console.log(chalk.red("\nThis isn't a git repo.") + chalk.gray(" I need git for --staged. I'm demanding like that.\n"));
          process.exit(1);
        }
        const diff = getStagedChanges();
        if (!diff.trim()) {
          console.log(chalk.yellow("\nNothing staged.") + " I can't roast air. " + chalk.cyan("git add <files>") + " first.\n");
          process.exit(1);
        }
        files = parseDiffToFiles(diff);
        source = "staged changes";
      } else if (options.diff) {
        if (!isGitRepo()) {
          console.log(chalk.red("\nThis isn't a git repo.") + chalk.gray(" --diff needs git. Obviously.\n"));
          process.exit(1);
        }
        const diff = getBranchDiff(options.diff);
        if (!diff.trim()) {
          console.log(chalk.yellow("\nNo diff against ") + chalk.cyan(options.diff) + chalk.yellow(". Either you haven't changed anything, or you're diffing against yourself. Both are concerning.\n"));
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
            console.log(chalk.red(`\nCan't find ${p}.`) + chalk.gray(" Did you typo your own file path? Classic.\n"));
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
              console.log(chalk.yellow(`Skipped: ${p}`) + chalk.gray(" — binary, too large, or something I refuse to read."));
            }
          }
        }
        source = paths.join(", ");
      } else {
        // ── Smart auto-detect: no args = roast current directory ───────
        if (isGitRepo()) {
          // Try git-aware detection first
          const staged = getStagedChanges();
          if (staged.trim()) {
            files = parseDiffToFiles(staged);
            source = "staged changes";
            console.log(chalk.gray("\n  Found your staged changes. Let's see what you think is ready.\n"));
          }

          if (files.length === 0) {
            const unstaged = getUnstagedChanges();
            if (unstaged.trim()) {
              files = parseDiffToFiles(unstaged);
              source = "unstaged changes";
              console.log(chalk.gray("\n  Found uncommitted changes. Too scared to commit? Let me see why.\n"));
            }
          }

          if (files.length === 0) {
            try {
              const lastCommit = getLastCommitDiff();
              if (lastCommit.trim()) {
                files = parseDiffToFiles(lastCommit);
                source = "last commit";
                console.log(chalk.gray("\n  Nothing new? Fine, I'll roast your last commit.\n"));
              }
            } catch {
              // No commits yet — fall through to directory scan
            }
          }
        }

        // Fallback: just scan the current directory
        if (files.length === 0) {
          const cwd = resolve(".");
          const collected = collectFiles(cwd);
          if (collected.length > 0) {
            files = collected;
            source = ".";
            console.log(chalk.gray(`\n  Scanning this directory. Let's see what we're working with.\n`));
          }
        }

        if (files.length === 0) {
          console.log(
            chalk.yellow("\nThere's literally nothing here to roast.") +
              chalk.gray(" No code files found. Is this even a project?\n")
          );
          process.exit(1);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`\nSomething broke: ${msg}`) + chalk.gray("\nNot my fault. Probably.\n"));
      process.exit(1);
    }

    if (files.length === 0) {
      console.log(chalk.yellow("\nNo reviewable files found.") + chalk.gray(" Everything was binary, too large, or otherwise beneath me.\n"));
      process.exit(1);
    }

    // ── Call API ───────────────────────────────────────────────────────
    const mode = options.mode === "quick" ? "quick" : "full_truth";
    const fileCount = `${files.length} file${files.length !== 1 ? "s" : ""}`;

    const f = getFlavor();

    // Sally appears first — always
    if (!options.bgWorker) {
      printSally();
      console.log();
    }

    // Background mode for Full Truth
    if (mode === "full_truth" && !options.bgWorker) {
      const wantBg = options.bg || (!options.json && !options.ci && await askBackground(
        chalk.magenta(`  ${f.bg_prompt}`) + "\n"
      ));

      if (wantBg) {
        const bgArgs: string[] = [];
        for (const p of paths) bgArgs.push(p);
        if (options.staged) bgArgs.push("--staged");
        if (options.diff) bgArgs.push("--diff", options.diff);
        bgArgs.push("-m", "full_truth");
        if (options.tone !== "cynical") bgArgs.push("--tone", options.tone);
        if (options.lang !== "en") bgArgs.push("--lang", options.lang);

        console.log(chalk.magenta(`  ${f.bg_confirmed}`));
        console.log(chalk.gray(`\n  ${f.bg_results_hint}\n`));

        spawnBackgroundWorker(bgArgs, process.cwd());
        return;
      }
    }

    const spinnerText = mode === "full_truth"
      ? `${f.spinner_ft} (${source})`
      : `${f.spinner_quick} (${source})`;

    const spinner = ora({ text: options.bgWorker ? "Background review running..." : spinnerText, color: "magenta" }).start();

    try {
      const response = await submitRoast({
        type: "code",
        files,
        mode,
        tone: options.tone || "cynical",
        lang: options.lang || "en",
      });

      spinner.stop();

      if (options.bgWorker) {
        // Background worker: save result + send notification, no display
        const savedPath = saveReport(response, source);
        saveResult(response, source);
        sendNotification(
          "Sally's done.",
          `Score: ${response.data.score.toFixed(1)}/10 — run 'sally results' to see the verdict.`,
        );
        if (savedPath) {
          sendNotification("Report saved", savedPath);
        }
        process.exit(0);
      } else if (options.json) {
        console.log(JSON.stringify(response, null, 2));
      } else {
        displayRoast(response);

        // Show premium tools hint (once per install, not for Full Suite users)
        if (mode === "quick" && !getEmail() && showToolsHint()) {
          console.log(chalk.gray("  " + "\u2500".repeat(56)));
          console.log();
          console.log(chalk.gray("  You also get ") + chalk.white("1 free trial") + chalk.gray(" of each premium tool:"));
          console.log(chalk.cyan("    sally explain") + chalk.gray("    sally refactor") + chalk.gray("    sally brainstorm"));
          console.log(chalk.cyan("    sally frontend") + chalk.gray("   sally marketing") + chalk.gray("    sally review-pr"));
          console.log();
        }

        // Auto-save Full Truth reviews as markdown report
        if (mode === "full_truth") {
          const savedPath = saveReport(response, source);
          if (savedPath) {
            console.log(chalk.gray("  💾 ") + chalk.gray("Saved this verdict to ") + chalk.cyan(savedPath));
            console.log();
          }
        }
      }

      if (options.failUnder !== undefined && response.data.score < options.failUnder) {
        if (!options.json) {
          console.log(
            chalk.red(`\n  ${response.data.score.toFixed(1)}/10 — below your threshold of ${options.failUnder.toFixed(1)}. Told you.\n`)
          );
        }
        process.exit(1);
      }
    } catch (err) {
      spinner.stop();
      handleApiError(err);
      process.exit(1);
    }
  });

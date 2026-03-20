import { Command } from "commander";
import chalk from "chalk";
import { readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { displayRoast } from "../utils/output.js";

const RESULTS_DIR = join(homedir(), ".sally", "results");

export const resultsCommand = new Command("results")
  .description("View your latest Full Truth review (background jobs)")
  .option("--list", "List all saved reviews")
  .option("--clear", "Clear all saved reviews")
  .action((options) => {
    try {
      const files = readdirSync(RESULTS_DIR)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse();

      if (files.length === 0) {
        console.log(chalk.gray("\n  No saved reviews. Run a Full Truth review first.\n"));
        return;
      }

      if (options.clear) {
        for (const f of files) {
          unlinkSync(join(RESULTS_DIR, f));
        }
        console.log(chalk.green(`\n  Cleared ${files.length} saved review(s).\n`));
        return;
      }

      if (options.list) {
        console.log(chalk.magenta.bold("\n  Saved Reviews\n"));
        for (const f of files) {
          try {
            const data = JSON.parse(readFileSync(join(RESULTS_DIR, f), "utf-8"));
            const score = data.data?.score?.toFixed(1) ?? "?";
            const source = data._source || "unknown";
            const date = data._savedAt ? new Date(data._savedAt).toLocaleString() : f;
            console.log(chalk.gray(`  ${date}`) + chalk.white(` — ${score}/10`) + chalk.gray(` (${source})`));
          } catch {
            console.log(chalk.gray(`  ${f}`));
          }
        }
        console.log();
        return;
      }

      // Show most recent result
      const latest = files[0];
      const data = JSON.parse(readFileSync(join(RESULTS_DIR, latest), "utf-8"));

      if (data.data && data.voice && data.meta) {
        displayRoast(data);
      } else {
        console.log(chalk.yellow("\n  Latest review file is malformed.\n"));
      }
    } catch {
      console.log(chalk.gray("\n  No saved reviews yet. Run ") + chalk.cyan("sally roast -m full_truth --bg") + chalk.gray(" first.\n"));
    }
  });

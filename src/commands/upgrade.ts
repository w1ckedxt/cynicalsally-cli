import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { exec } from "node:child_process";
import { getDeviceId } from "../utils/config.js";
import { checkEntitlements } from "../utils/api.js";

const SUPERCLUB_BASE = "https://cynicalsally-web.onrender.com/en/fullsuite";
const POLL_INTERVAL_MS = 5000; // 5 seconds between checks
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max (Stripe webhooks can be slow)

export const upgradeCommand = new Command("upgrade")
  .description("Upgrade to Sally's Full Suite")
  .action(async () => {
    const deviceId = getDeviceId();
    const url = `${SUPERCLUB_BASE}?cli_device=${encodeURIComponent(deviceId)}`;

    // Check if already SuperClub
    try {
      const current = await checkEntitlements();
      if (current.isSuperClub || current.cliTier === "sc") {
        console.log(
          chalk.green("\n  You've already got the Full Suite.") +
            chalk.gray(" Go roast something instead of wasting my time.\n")
        );
        return;
      }
    } catch {
      // Can't check — continue with upgrade flow
    }

    console.log(
      chalk.magenta("\n  Opening Full Suite in your browser...") +
        chalk.gray(" Complete the checkout and I'll detect it automatically.\n")
    );

    // Open browser
    const openCmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "start"
          : "xdg-open";

    exec(`${openCmd} "${url}"`);

    // Poll for subscription activation
    const spinner = ora({
      text: "Waiting for your upgrade... complete checkout in the browser.",
      color: "magenta",
    }).start();

    const startTime = Date.now();

    const poll = async (): Promise<boolean> => {
      while (Date.now() - startTime < POLL_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

        try {
          const entitlements = await checkEntitlements();
          if (entitlements.isSuperClub || entitlements.cliTier === "sc") {
            return true;
          }
        } catch {
          // Network blip — keep polling
        }
      }
      return false;
    };

    const upgraded = await poll();
    spinner.stop();

    if (upgraded) {
      console.log();
      console.log(chalk.green.bold("  ✓ Sally's Full Suite activated"));
      console.log();
      console.log(chalk.white("  Welcome. You actually paid for brutal honesty."));
      console.log(chalk.white("  I respect that more than your code.\n"));
      console.log(chalk.gray("  What you get:"));
      console.log(chalk.white("  • 500 Quick Roasts + 100 Full Truth deep-dives/month"));
      console.log(chalk.white("  • 8 premium tools — explain, refactor, brainstorm & more"));
      console.log(chalk.white("  • MCP integration — Sally in your IDE"));
      console.log(chalk.white("  • Unlimited web + Chrome extension included"));
      console.log(chalk.white("  • Sally's coffee-powered priority processing"));
      console.log();
      console.log(chalk.gray("  Try it now:"));
      console.log(chalk.cyan("  sally roast src/ -m full_truth") + chalk.gray("  — the deep dive\n"));
    } else {
      console.log(
        chalk.yellow("\n  Didn't detect an upgrade yet.") +
          chalk.gray(" If you completed checkout, give it a moment and run:\n") +
          chalk.cyan("  sally usage") +
          chalk.gray("  — to check your status\n")
      );
    }
  });

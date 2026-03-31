import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { getEmail, getDeviceId } from "../utils/config.js";
import { checkEntitlements } from "../utils/api.js";

const TIER_LABELS: Record<string, string> = {
  lite: "Sally CLI Free",
  sc: "Sally's Full Suite",
};

export const usageCommand = new Command("usage")
  .description("Check your account status and remaining quota")
  .action(async () => {
    const spinner = ora({ text: "Checking if you deserve my attention...", color: "magenta" }).start();

    try {
      const entitlements = await checkEntitlements();
      spinner.stop();

      const email = getEmail();
      const deviceId = getDeviceId();

      console.log();
      console.log(chalk.magenta.bold("  Your Sally Status"));
      console.log();

      if (email) {
        console.log(`  ${chalk.gray("Email (local):")}  ${chalk.white(email)}`);
      }
      console.log(`  ${chalk.gray("Device:")}   ${chalk.gray(deviceId.slice(0, 8) + "...")}`);
      console.log();

      const cliTier = entitlements.cliTier || (entitlements.isSuperClub ? "sc" : "lite");
      const tierLabel = TIER_LABELS[cliTier] || cliTier;

      if (cliTier === "sc") {
        console.log(`  ${chalk.gray("Tier:")}     ${chalk.yellow.bold(tierLabel)} ${chalk.green("active")}`);
        console.log(`  ${chalk.gray("Quick Reviews:")}  ${chalk.green("unlimited")}`);
        console.log(`  ${chalk.gray("Full Truth:")}     ${chalk.green("unlimited")}`);
        console.log();
        console.log(chalk.gray("  You actually paid. Respect. Now let me tear your code apart."));
      } else {
        console.log(`  ${chalk.gray("Tier:")}     ${chalk.white(tierLabel)}`);

        if (entitlements.cliQuota) {
          const qr = entitlements.cliQuota.qr;
          const ft = entitlements.cliQuota.ft;
          console.log(`  ${chalk.gray("Quick Reviews:")}  ${chalk.white(`${qr.remaining}/${qr.limit}`)} remaining`);
          console.log(`  ${chalk.gray("Full Truth:")}     ${chalk.white(`${ft.remaining}/${ft.limit}`)} remaining`);
        } else {
          console.log(`  ${chalk.gray("Roasts:")}   ${chalk.white(`${entitlements.quotaRemaining}/3`)} today`);
        }

        if (entitlements.hasPrepaidGrant) {
          console.log(`  ${chalk.gray("Prepaid:")}  ${chalk.green("1 Full Truth available")}`);
        }

        // Premium tool trials
        if (entitlements.toolQuota) {
          console.log();
          console.log(chalk.white.bold("  Premium Tools (1 free trial each):"));
          const toolLabels: Record<string, string> = {
            explain: "explain",
            review_pr: "review-pr",
            refactor: "refactor",
            brainstorm: "brainstorm",
            frontend_review: "frontend",
            marketing_review: "marketing",
          };
          for (const [tool, q] of Object.entries(entitlements.toolQuota)) {
            const label = toolLabels[tool] || tool;
            const used = q.remaining === 0;
            const status = used
              ? chalk.red("used")
              : chalk.green("available");
            console.log(`  ${chalk.gray("  sally " + label)}  ${status}`);
          }
        }

        console.log();
        console.log(
          chalk.gray("  Want unlimited everything? ") +
            chalk.cyan("sally upgrade")
        );
      }

      if (!email) {
        console.log();
        console.log(
          chalk.gray("  No email linked locally. ") +
            chalk.cyan("sally login your@email.com")
        );
      }

      console.log();
    } catch {
      spinner.stop();
      console.log(chalk.red("\nCan't reach the server. Your internet is giving 'it works on my machine' energy.\n"));
    }
  });

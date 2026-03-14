import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { getEmail, getDeviceId } from "../utils/config.js";
import { checkEntitlements } from "../utils/api.js";

export const usageCommand = new Command("usage")
  .description("Check your account status and remaining quota")
  .action(async () => {
    const spinner = ora({ text: "Checking account...", color: "magenta" }).start();

    try {
      const entitlements = await checkEntitlements();
      spinner.stop();

      const email = getEmail();
      const deviceId = getDeviceId();

      console.log();
      console.log(chalk.magenta.bold("  Account Status"));
      console.log();

      if (email) {
        console.log(`  ${chalk.gray("Email:")}    ${chalk.white(email)}`);
      }
      console.log(`  ${chalk.gray("Device:")}   ${chalk.gray(deviceId.slice(0, 8) + "...")}`);
      console.log();

      if (entitlements.isSuperClub) {
        console.log(`  ${chalk.yellow.bold("SuperClub")} ${chalk.green("active")}`);
        console.log(`  ${chalk.gray("Roasts:")}   ${chalk.green("unlimited")}`);
      } else {
        console.log(`  ${chalk.gray("Plan:")}     ${chalk.white("Free")}`);
        console.log(`  ${chalk.gray("Roasts:")}   ${chalk.white(`${entitlements.quotaRemaining}/3`)} today`);
        if (entitlements.hasPrepaidGrant) {
          console.log(`  ${chalk.gray("Prepaid:")}  ${chalk.green("1 Full Truth available")}`);
        }
      }

      if (!email) {
        console.log();
        console.log(
          chalk.gray("  Not logged in. Run ") +
            chalk.cyan("sally login your@email.com") +
            chalk.gray(" for SuperClub access.")
        );
      }

      console.log();
    } catch {
      spinner.stop();
      console.log(chalk.red("\nFailed to check account. Network error.\n"));
    }
  });

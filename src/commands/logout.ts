import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { clearSession, getDeviceId, getEmail } from "../utils/config.js";
import { unlinkDeviceSession } from "../utils/api.js";

export const logoutCommand = new Command("logout")
  .description("Clear stored local account info")
  .action(async () => {
    const existing = getEmail();
    const deviceId = getDeviceId();
    const spinner = ora({ text: "Cutting this device loose...", color: "magenta" }).start();

    let unlinkFailed = false;

    try {
      await unlinkDeviceSession();
    } catch {
      unlinkFailed = true;
    }

    clearSession();
    spinner.stop();

    if (unlinkFailed) {
      console.log(chalk.yellow("\nBackend unlink failed.") + chalk.gray(" I still cleared this device's local state.\n"));
      console.log(chalk.gray("Run ") + chalk.cyan("sally usage") + chalk.gray(" to confirm the server-side unlink caught up.\n"));
      return;
    }

    if (!existing) {
      console.log(chalk.green("\nDevice unlinked.") + chalk.gray(` ${deviceId.slice(0, 8)}... is no longer tied to local account info.\n`));
      return;
    }

    console.log(chalk.green("\nGone.") + chalk.gray(" This device is no longer linked to that account.\n"));
  });

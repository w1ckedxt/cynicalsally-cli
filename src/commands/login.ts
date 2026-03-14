import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { saveEmail, getEmail, getDeviceId } from "../utils/config.js";
import { requestMagicLink, checkEntitlements } from "../utils/api.js";

export const loginCommand = new Command("login")
  .description("Log in with your email (magic link)")
  .argument("[email]", "Your email address")
  .action(async (email?: string) => {
    const existing = getEmail();
    if (existing) {
      console.log(
        chalk.yellow("\nAlready logged in as ") +
          chalk.cyan(existing) +
          ".\nRun " +
          chalk.cyan("sally logout") +
          " first to switch accounts.\n"
      );
      return;
    }

    if (!email) {
      console.log(
        chalk.magenta("\nLog in to Sally") +
          "\n\n" +
          chalk.gray("  sally login your@email.com") +
          "\n\n" +
          "SuperClub members get unlimited roasts.\n" +
          "Free users get 3 roasts per day.\n"
      );
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      console.log(chalk.red("\nInvalid email format.\n"));
      process.exit(1);
    }

    const spinner = ora({ text: "Sending magic link...", color: "magenta" }).start();

    try {
      const result = await requestMagicLink(email);
      spinner.stop();

      if (result.sent) {
        console.log(
          chalk.green("\nMagic link sent!") +
            " Check your inbox at " +
            chalk.cyan(email) +
            ".\n\n" +
            chalk.gray("Click the link in the email, then run:") +
            "\n" +
            chalk.cyan("  sally usage") +
            "\n" +
            chalk.gray("to verify your account.\n")
        );
        // Save email locally — the magic link verify maps deviceId server-side
        saveEmail(email);
      } else {
        console.log(chalk.red(`\n${result.error || "Failed to send magic link."}\n`));
      }
    } catch {
      spinner.stop();
      console.log(chalk.red("\nNetwork error. Is the internet working?\n"));
    }
  });

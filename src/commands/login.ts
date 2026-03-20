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
        chalk.yellow("\nI already know you as ") +
          chalk.cyan(existing) +
          chalk.yellow(".") +
          "\nWant a fresh start? " +
          chalk.cyan("sally logout") +
          " first.\n"
      );
      return;
    }

    if (!email) {
      console.log(
        chalk.magenta("\nWho are you?") +
          "\n\n" +
          chalk.gray("  sally login your@email.com") +
          "\n\n" +
          chalk.gray("SuperClub members get unlimited roasts. The rest of you get a taste.\n")
      );
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      console.log(chalk.red("\nThat's not an email. I'm cynical, not blind.\n"));
      process.exit(1);
    }

    const spinner = ora({ text: "Summoning a magic link... don't get too excited.", color: "magenta" }).start();

    try {
      const result = await requestMagicLink(email);
      spinner.stop();

      if (result.sent) {
        console.log(
          chalk.green("\nCheck your inbox at ") +
            chalk.cyan(email) +
            chalk.green(".") +
            "\n\n" +
            chalk.gray("Click the link. I'll be here, judging your code.\n")
        );
        // Save email locally — the magic link verify maps deviceId server-side
        saveEmail(email);
      } else {
        console.log(chalk.red(`\n${result.error || "Couldn't send that. Even magic has its limits."}\n`));
      }
    } catch {
      spinner.stop();
      console.log(chalk.red("\nCan't reach the server. Your wifi is as reliable as your code.\n"));
    }
  });

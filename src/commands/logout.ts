import { Command } from "commander";
import chalk from "chalk";
import { clearSession, getEmail } from "../utils/config.js";

export const logoutCommand = new Command("logout")
  .description("Log out and clear stored session")
  .action(() => {
    const existing = getEmail();
    if (!existing) {
      console.log(chalk.gray("\nYou weren't even logged in. Dramatic much?\n"));
      return;
    }

    clearSession();
    console.log(chalk.green("\nGone.") + chalk.gray(" I already forgot about you.\n"));
  });

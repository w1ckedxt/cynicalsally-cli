import { Command } from "commander";
import chalk from "chalk";
import { clearSession, getEmail } from "../utils/config.js";

export const logoutCommand = new Command("logout")
  .description("Log out and clear stored session")
  .action(() => {
    const existing = getEmail();
    if (!existing) {
      console.log(chalk.gray("\nNot logged in. Nothing to do.\n"));
      return;
    }

    clearSession();
    console.log(chalk.green("\nLogged out.") + " Session cleared.\n");
  });

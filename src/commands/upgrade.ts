import { Command } from "commander";
import chalk from "chalk";
import { exec } from "node:child_process";

const SUPERCLUB_URL = "https://cynicalsally-web.onrender.com/en/superclub";

export const upgradeCommand = new Command("upgrade")
  .description("Open the SuperClub page — unlimited roasts")
  .action(() => {
    console.log(
      chalk.magenta("\nOpening SuperClub...") +
        " " +
        chalk.cyan.underline(SUPERCLUB_URL) +
        "\n"
    );

    const openCmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "start"
          : "xdg-open";

    exec(`${openCmd} ${SUPERCLUB_URL}`);
  });

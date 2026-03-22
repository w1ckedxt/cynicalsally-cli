import { Command } from "commander";
import chalk from "chalk";

export const mcpCommand = new Command("mcp")
  .description("Start MCP server (stdio) for AI agents in Cursor, Claude Desktop, Windsurf")
  .action(async () => {
    if (process.stdout.isTTY) {
      // Running in a terminal — show setup instructions instead of starting stdio server
      console.log(
        chalk.magenta("\n  MCP Server") +
          chalk.gray(" — Sally as a tool in your IDE\n")
      );
      console.log(chalk.white.bold("  Add this to your MCP config:\n"));
      console.log(
        chalk.cyan(
          "  " +
            JSON.stringify(
              {
                mcpServers: {
                  "cynical-sally": {
                    command: "npx",
                    args: ["@cynicalsally/cli", "mcp"],
                  },
                },
              },
              null,
              2
            ).replace(/\n/g, "\n  ")
        )
      );
      console.log();
      console.log(chalk.white.bold("  Available tools:"));
      console.log(chalk.gray("  sally_roast       ") + chalk.white("Code review with score, issues, and fixes"));
      console.log(chalk.gray("  sally_explain     ") + chalk.white("Explain code snippets or files"));
      console.log(chalk.gray("  sally_review_pr   ") + chalk.white("Review PR diffs"));
      console.log(chalk.gray("  sally_refactor    ") + chalk.white("Refactoring with before/after code"));
      console.log(chalk.gray("  sally_brainstorm  ") + chalk.white("Feedback on ideas and approaches"));
      console.log(chalk.gray("  sally_frontend    ") + chalk.white("Frontend/UI code review"));
      console.log(chalk.gray("  sally_marketing   ") + chalk.white("Marketing copy review"));
      console.log(chalk.gray("  sally_usage       ") + chalk.white("Check quota and account status"));
      console.log();
      console.log(chalk.gray("  Works with Claude Code, Cursor, and Windsurf.\n"));
      return;
    }

    // Non-TTY: start the actual MCP stdio server
    await import("../mcp-server.js");
  });

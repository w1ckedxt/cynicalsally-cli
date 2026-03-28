import { Command } from "commander";
import chalk from "chalk";

export const mcpCommand = new Command("mcp")
  .description("Start MCP server (stdio) for AI agents in Cursor, Claude Desktop, Windsurf")
  .action(async () => {
    if (process.stdout.isTTY) {
      // Running in a terminal — show setup instructions instead of starting stdio server
      const mcpConfig = JSON.stringify(
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
      );

      console.log(
        chalk.magenta("\n  MCP Server") +
          chalk.gray(" — Sally as a tool in your IDE\n")
      );

      // Claude Code
      console.log(chalk.white.bold("  Claude Code"));
      console.log(chalk.cyan("  claude mcp add cynical-sally -- npx @cynicalsally/cli mcp\n"));

      // Cursor
      console.log(chalk.white.bold("  Cursor"));
      console.log(chalk.gray("  Add to ~/.cursor/mcp.json (global) or .cursor/mcp.json (per project):\n"));
      console.log(chalk.cyan("  " + mcpConfig.replace(/\n/g, "\n  ")));
      console.log();

      // Windsurf
      console.log(chalk.white.bold("  Windsurf"));
      console.log(chalk.gray("  Add to ~/.codeium/windsurf/mcp_config.json:\n"));
      console.log(chalk.cyan("  " + mcpConfig.replace(/\n/g, "\n  ")));
      console.log();

      // Tools
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
      return;
    }

    // Non-TTY: start the actual MCP stdio server
    await import("../mcp-server.js");
  });

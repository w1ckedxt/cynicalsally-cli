import { Command } from "commander";
import chalk from "chalk";

export const mcpCommand = new Command("mcp")
  .description("Start MCP server (stdio) for AI agents in Cursor, Claude Desktop, Windsurf")
  .action(async () => {
    // TODO: Implement MCP stdio server
    // Tools: review_code, review_diff, get_score
    // Protocol: JSON-RPC over stdin/stdout

    if (process.stdout.isTTY) {
      console.log(
        chalk.magenta("\nMCP Mode") +
          chalk.gray(" — for AI agents in your IDE\n\n") +
          "Add this to your MCP config:\n\n" +
          chalk.cyan(
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
            )
          ) +
          "\n\n" +
          chalk.gray("MCP server implementation coming soon.\n")
      );
    }
  });

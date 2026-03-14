#!/usr/bin/env node

import { Command } from "commander";
import { roastCommand } from "./commands/roast.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { usageCommand } from "./commands/usage.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { mcpCommand } from "./commands/mcp.js";

const program = new Command();

program
  .name("sally")
  .description(
    "Brutally honest code reviews.\nBecause 'You're absolutely right' is probably absolutely wrong."
  )
  .version("0.1.0");

program.addCommand(roastCommand);
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(usageCommand);
program.addCommand(upgradeCommand);
program.addCommand(mcpCommand);

program.parse();

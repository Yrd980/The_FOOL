#!/usr/bin/env bun

import { commandHandlers } from "./control/commands";
import { fail, USAGE } from "./control/support";
import { isCommandName } from "./control/types";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  fail(USAGE);
}

if (!isCommandName(command)) {
  fail(`Unknown command "${command}".\n\n${USAGE}`);
}

await commandHandlers[command](args);

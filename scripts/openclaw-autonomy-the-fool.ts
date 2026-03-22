#!/usr/bin/env bun

import { runTheFoolAutonomy } from "./autonomy/theFoolAutonomy";

const activityRunId = process.argv[2]?.trim() || process.env.OPENCLAW_ACTIVITY_RUN_ID?.trim();
const ledgerDir = process.env.OPENCLAW_AUTONOMY_LEDGER_DIR?.trim();

await runTheFoolAutonomy({
  ...(activityRunId ? { activityRunId } : {}),
  ...(ledgerDir ? { ledgerDir } : {}),
});

# Dev Playwright MCP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a project-level Playwright MCP setup that makes `dev` the default local UI debugging target for Codex.

**Architecture:** Keep browser automation and app startup as separate contracts. The workspace root owns the Playwright MCP configuration, launcher script, and project-wide note; the `dev` worktree owns the dedicated `ui:debug` app entrypoint and app-specific documentation. The normal `bun run dev` path remains unchanged.

**Tech Stack:** Bun, Bash, Vite 7, React 19, TypeScript 5.9, Playwright MCP

**Spec:** `docs/superpowers/specs/2026-03-14-dev-playwright-mcp-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `/home/yrd/projects/The_FOOL/.mcp.json` | Define the exact project-level Playwright MCP defaults for UI debugging while leaving `chrome-devtools` unchanged. |
| Create | `/home/yrd/projects/The_FOOL/scripts/start-dev-ui-debug.sh` | Provide a root-level launcher that forwards into the `dev` worktree and runs the stable debug entrypoint. |
| Create | `/home/yrd/projects/The_FOOL/PLAYWRIGHT_MCP.md` | Document the project-wide Codex/Playwright debugging contract. |
| Modify | `/home/yrd/projects/The_FOOL/dev/package.json` | Add the dedicated `ui:debug` script without changing the meaning of `bun run dev`. |
| Modify | `/home/yrd/projects/The_FOOL/dev/README.md` | Document the `dev`-local workflow for Playwright MCP UI debugging. |

## Chunk 1: Root Workspace Contract

### Task 1: Tighten the root Playwright MCP configuration

**Files:**
- Modify: `/home/yrd/projects/The_FOOL/.mcp.json`

- [ ] **Step 1: Prove the current `playwright` MCP entry is underspecified**

Run:

```bash
bun -e 'const cfg = JSON.parse(await Bun.file("/home/yrd/projects/The_FOOL/.mcp.json").text()); console.log(cfg.mcpServers.playwright.args.join(" "));'
```

Expected: output only shows `@playwright/mcp`, proving the UI-debug defaults from the spec are not configured yet.

- [ ] **Step 2: Add the exact Playwright MCP defaults from the spec**

Update `/home/yrd/projects/The_FOOL/.mcp.json` so:

- `chrome-devtools` stays unchanged
- `playwright.args` becomes:

```json
[
  "@playwright/mcp",
  "--caps",
  "vision,devtools",
  "--output-dir",
  ".playwright-mcp",
  "--save-trace",
  "--console-level",
  "warning",
  "--viewport-size",
  "1440x960"
]
```

- [ ] **Step 3: Verify the JSON parses and the `playwright` args are exact**

Run:

```bash
bun -e 'const cfg = JSON.parse(await Bun.file("/home/yrd/projects/The_FOOL/.mcp.json").text()); console.log(JSON.stringify({ chromeDevtools: cfg.mcpServers["chrome-devtools"], playwrightArgs: cfg.mcpServers.playwright.args }));'
```

Expected:

- `playwrightArgs` is exactly the array listed in Step 2
- `chromeDevtools.command` is still `"npx"`
- `chromeDevtools.args` is still `["chrome-devtools-mcp"]`

- [ ] **Step 4: Record that the root workspace file is outside the tracked `dev` worktree**

Run:

```bash
if git -C /home/yrd/projects/The_FOOL/dev status --short | rg -q '\.mcp\.json'; then
  echo "unexpected-root-file-leak"
  exit 1
fi
echo "root-files-stay-outside-dev-worktree"
```

Expected: prints `root-files-stay-outside-dev-worktree`.

### Task 2: Add the project-level launcher and root note

**Files:**
- Create: `/home/yrd/projects/The_FOOL/scripts/start-dev-ui-debug.sh`
- Create: `/home/yrd/projects/The_FOOL/PLAYWRIGHT_MCP.md`

- [ ] **Step 1: Prove the root discoverability artifacts do not exist yet**

Run:

```bash
test -f /home/yrd/projects/The_FOOL/scripts/start-dev-ui-debug.sh; echo "launcher:$?"
test -f /home/yrd/projects/The_FOOL/PLAYWRIGHT_MCP.md; echo "note:$?"
```

Expected:

- `launcher:1`
- `note:1`

- [ ] **Step 2: Create the root launcher**

Create `/home/yrd/projects/The_FOOL/scripts/start-dev-ui-debug.sh` with these behaviors:

- Create the missing `/home/yrd/projects/The_FOOL/scripts/` directory first if it does not already exist
- `#!/usr/bin/env bash`
- `set -euo pipefail`
- Resolve the repository root relative to the script location
- Fail with a readable error if `${ROOT}/dev` is missing
- `cd` into `${ROOT}/dev`
- Fail with a readable error if `bun` is not available
- Fail with a readable error if the app dependencies are not installed well enough to start the app, using a deterministic check such as the absence of `node_modules/.bin/vite`
- Execute `bun run ui:debug`
- Keep the launcher a thin forwarder only: no waiting loops, no app logic, and no browser automation behavior
- Mark the script executable

- [ ] **Step 3: Create the project-wide Playwright note**

Create `/home/yrd/projects/The_FOOL/PLAYWRIGHT_MCP.md` documenting:

- `dev` is the default UI debugging target
- canonical URL: `http://127.0.0.1:4173`
- preferred launcher: `/home/yrd/projects/The_FOOL/scripts/start-dev-ui-debug.sh`
- direct app command: `cd /home/yrd/projects/The_FOOL/dev && bun run ui:debug`
- the setup is for interactive UI debugging with Playwright MCP, not repository E2E coverage

- [ ] **Step 4: Verify the launcher script syntax and the note contents**

Run:

```bash
bash -n /home/yrd/projects/The_FOOL/scripts/start-dev-ui-debug.sh
test -x /home/yrd/projects/The_FOOL/scripts/start-dev-ui-debug.sh
rg -n "127\\.0\\.0\\.1:4173" /home/yrd/projects/The_FOOL/PLAYWRIGHT_MCP.md
rg -n "default UI debugging target" /home/yrd/projects/The_FOOL/PLAYWRIGHT_MCP.md
rg -n "interactive UI debugging with Playwright MCP" /home/yrd/projects/The_FOOL/PLAYWRIGHT_MCP.md
rg -n "/home/yrd/projects/The_FOOL/scripts/start-dev-ui-debug.sh" /home/yrd/projects/The_FOOL/PLAYWRIGHT_MCP.md
rg -n "cd /home/yrd/projects/The_FOOL/dev && bun run ui:debug" /home/yrd/projects/The_FOOL/PLAYWRIGHT_MCP.md
```

Expected:

- `bash -n` exits successfully with no output
- `test -x` exits successfully
- each `rg` command finds its required contract line

## Chunk 2: `dev` App Debug Contract

### Task 3: Add the dedicated `ui:debug` command without changing `bun run dev`

**Files:**
- Modify: `/home/yrd/projects/The_FOOL/dev/package.json`

- [ ] **Step 1: Prove the dedicated debug command is missing**

Run:

```bash
cd /home/yrd/projects/The_FOOL/dev
bun run ui:debug
```

Expected: Bun fails with a missing-script error because `ui:debug` does not exist yet.

- [ ] **Step 2: Add the new script and keep the existing `dev` script untouched**

Update `/home/yrd/projects/The_FOOL/dev/package.json` so:

- `"dev": "vite"` remains unchanged
- add `"ui:debug": "vite --host 127.0.0.1 --port 4173 --strictPort"`

- [ ] **Step 3: Verify the package contract directly**

Run:

```bash
rg -n '"dev": "vite"' /home/yrd/projects/The_FOOL/dev/package.json
rg -n '"ui:debug": "vite --host 127.0.0.1 --port 4173 --strictPort"' /home/yrd/projects/The_FOOL/dev/package.json
```

Expected: both lines are found exactly once.

- [ ] **Step 4: Verify the new command actually serves the canonical URL**

Run the command in one terminal:

```bash
cd /home/yrd/projects/The_FOOL/dev
bun run ui:debug
```

Then in another terminal:

```bash
curl -I http://127.0.0.1:4173
```

Expected: `curl` returns an HTTP success response from the Vite dev server while the first terminal stays attached to the running server.

- [ ] **Step 5: Commit the tracked `dev` changes**

```bash
cd /home/yrd/projects/The_FOOL/dev
git add package.json
git commit --no-gpg-sign -m "chore: add dev ui debug entrypoint"
git log -1 --oneline
```

Expected: the latest commit message is `chore: add dev ui debug entrypoint`.

### Task 4: Document the `dev`-local debugging workflow

**Files:**
- Modify: `/home/yrd/projects/The_FOOL/dev/README.md`

- [ ] **Step 1: Add a Playwright MCP debugging section**

Update `/home/yrd/projects/The_FOOL/dev/README.md` with a short section that includes:

- `dev` as the default Codex UI target
- `bun run ui:debug`
- `http://127.0.0.1:4173`
- the distinction between Playwright MCP debugging and repository E2E tests

- [ ] **Step 2: Verify the documentation contains the new contract**

Run:

```bash
rg -n "default Codex UI target" /home/yrd/projects/The_FOOL/dev/README.md
rg -n "bun run ui:debug" /home/yrd/projects/The_FOOL/dev/README.md
rg -n "127\\.0\\.0\\.1:4173" /home/yrd/projects/The_FOOL/dev/README.md
rg -n "Playwright MCP" /home/yrd/projects/The_FOOL/dev/README.md
rg -n "not repository E2E tests|not repository E2E coverage|not repository E2E" /home/yrd/projects/The_FOOL/dev/README.md
```

Expected: each `rg` command finds its required contract line, including the “debugging, not repository E2E” boundary.

- [ ] **Step 3: Commit the README update**

```bash
cd /home/yrd/projects/The_FOOL/dev
git add README.md
git commit --no-gpg-sign -m "docs: add dev playwright mcp workflow"
git log -1 --oneline
```

Expected: the latest commit message is `docs: add dev playwright mcp workflow`.

## Chunk 3: End-to-End Verification

### Task 5: Verify the full contract end to end

**Files:**
- Verify only: `/home/yrd/projects/The_FOOL/.mcp.json`
- Verify only: `/home/yrd/projects/The_FOOL/scripts/start-dev-ui-debug.sh`
- Verify only: `/home/yrd/projects/The_FOOL/PLAYWRIGHT_MCP.md`
- Verify only: `/home/yrd/projects/The_FOOL/dev/package.json`
- Verify only: `/home/yrd/projects/The_FOOL/dev/README.md`

- [ ] **Step 1: Verify the `dev` app still builds**

Run:

```bash
cd /home/yrd/projects/The_FOOL/dev
bun run build
```

Expected: successful Vite/TypeScript production build.

- [ ] **Step 2: Verify the existing `dev` test workflow still passes**

Run:

```bash
cd /home/yrd/projects/The_FOOL/dev
bun run test
```

Expected: existing Vitest suite passes with no regressions caused by the debug-entrypoint changes.

This final verification assumes the direct `bun run ui:debug` smoke check already passed in Chunk 2.

- [ ] **Step 3: Verify the root launcher reaches the canonical URL**

Run the launcher in one terminal:

```bash
/home/yrd/projects/The_FOOL/scripts/start-dev-ui-debug.sh
```

Then in another terminal:

```bash
curl -I http://127.0.0.1:4173
```

Expected: the launcher starts the `dev` app successfully and `curl` receives an HTTP success response.

- [ ] **Step 4: Re-verify the root MCP and root note contracts**

Run:

```bash
bun -e 'const cfg = JSON.parse(await Bun.file("/home/yrd/projects/The_FOOL/.mcp.json").text()); console.log(JSON.stringify(cfg.mcpServers.playwright.args));'
rg -n "127\\.0\\.0\\.1:4173" /home/yrd/projects/The_FOOL/PLAYWRIGHT_MCP.md
rg -n "/home/yrd/projects/The_FOOL/scripts/start-dev-ui-debug.sh" /home/yrd/projects/The_FOOL/PLAYWRIGHT_MCP.md
rg -n "interactive UI debugging with Playwright MCP" /home/yrd/projects/The_FOOL/PLAYWRIGHT_MCP.md
```

Expected:

- the Bun command prints the exact Playwright args array from the spec
- each `rg` command finds the required root-note contract line

- [ ] **Step 5: Re-verify the `dev` README contract**

Run:

```bash
rg -n "default Codex UI target" /home/yrd/projects/The_FOOL/dev/README.md
rg -n "bun run ui:debug" /home/yrd/projects/The_FOOL/dev/README.md
rg -n "127\\.0\\.0\\.1:4173" /home/yrd/projects/The_FOOL/dev/README.md
rg -n "Playwright MCP" /home/yrd/projects/The_FOOL/dev/README.md
rg -n "not repository E2E tests|not repository E2E coverage|not repository E2E" /home/yrd/projects/The_FOOL/dev/README.md
```

Expected: each `rg` command finds the required `dev`-local contract line.

- [ ] **Step 6: Verify the normal developer entrypoint still exists**

Run:

```bash
rg -n '"dev": "vite"' /home/yrd/projects/The_FOOL/dev/package.json
```

Expected: the normal `bun run dev` entrypoint remains unchanged.

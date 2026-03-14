# Dev Playwright MCP Design

## 1. Goal

Provide a project-level Playwright MCP setup for The FOOL that makes `dev` the default UI debugging target for Codex. The setup should let an agent reliably launch the app, open a stable local URL, and inspect or reproduce UI issues without having to rediscover ports or startup commands each time.

## 2. Current State

- The repository root already contains `.mcp.json` with a `playwright` MCP server entry.
- The `dev` app already includes `@playwright/test` and `playwright` as dependencies, but there is no project-level E2E test harness or Playwright config.
- `dev` currently starts with the generic `bun run dev` Vite command and does not reserve a dedicated fixed port for Codex-driven UI debugging.
- The repository root is a workspace container for multiple worktrees, so project-level Codex configuration belongs at the root, while tracked app changes belong in the `dev` worktree.

## 3. Chosen Approach

Use a two-boundary setup:

1. **Root-level MCP configuration** continues to define the Playwright MCP server for the whole project.
2. **`dev`-level app launch contract** provides a dedicated, stable UI debugging command and URL.

This keeps responsibilities clear:

- MCP is responsible for browser automation.
- The app is responsible for exposing a predictable local target.

## 4. Alternatives Considered

### Option A: Leave the current `.mcp.json` as-is

- Lowest effort.
- Rejected because the agent would still need to rediscover how to start `dev` and which port it is using.

### Option B: Add a dedicated UI debug contract for `dev` and improve root MCP defaults

- Recommended.
- Keeps the setup simple, explicit, and stable.
- Avoids coupling the MCP process to the app lifecycle.

### Option C: Build a wrapper that starts both the app and Playwright MCP together

- Potentially convenient, but higher fragility.
- Rejected because stdio-based MCP servers are easier to break when wrapped together with long-running app processes.

## 5. Design

### 5.1 Root-level MCP Defaults

Update the root `.mcp.json` so the `playwright` server is better suited for UI debugging sessions. The configuration should:

- Keep using `@playwright/mcp`
- Leave the existing `chrome-devtools` server entry unchanged
- Store artifacts under the existing root `.playwright-mcp/` directory
- Add these exact `playwright` arguments:
  - `--caps vision,devtools`
  - `--output-dir .playwright-mcp`
  - `--save-trace`
  - `--console-level warning`
  - `--viewport-size 1440x960`
- Keep the configuration minimal and predictable beyond those explicit defaults

The MCP config should not attempt to launch the application itself.

### 5.2 Dedicated `dev` UI Debug Command

Add a new `dev/package.json` script dedicated to Codex/MCP-driven UI debugging.

Properties of this command:

- Uses `bun`
- Starts the existing Vite app directly
- Binds to `127.0.0.1`
- Uses a fixed port
- Uses `--strictPort` so failures are explicit instead of silently falling back to a random port
- Preserves the current app default data mode, meaning seed mode remains the default unless the caller explicitly overrides env vars

The existing `bun run dev` command should remain unchanged for normal developer workflows.

### 5.3 Stable URL Contract

Define one canonical debugging URL for this repository:

- `http://127.0.0.1:4173`

Codex should treat this as the default page for local UI debugging of The FOOL unless the user explicitly requests a different frontend entrypoint.

### 5.4 Root Launcher Convenience

Add a small root-level launcher script that forwards into the `dev` worktree and runs the dedicated debug command. This gives the whole workspace a single project-level entrypoint even though the actual app lives inside `dev`.

The script should:

- Live at `scripts/start-dev-ui-debug.sh`
- `cd` into `dev`
- Execute the dedicated `bun run ui:debug` command
- Avoid adding any app logic, waiting loops, or browser automation behavior
- Fail fast with a readable error if the `dev` worktree does not exist
- Fail fast with a readable error if `bun` is unavailable or dependencies are not installed well enough to start the app

### 5.5 Documentation

Document the contract in two places:

- `dev/README.md` for the tracked app workflow
- `PLAYWRIGHT_MCP.md` at the repository root for project-wide discoverability

The documentation should make these points explicit:

- `dev` is the default UI debugging target
- The canonical local URL is `http://127.0.0.1:4173`
- The intended startup command is the dedicated UI debug command
- This setup is for interactive UI debugging with Playwright MCP, not for repository E2E test coverage

## 6. Files To Change

### Root workspace files

- Modify `.mcp.json`
- Create `scripts/start-dev-ui-debug.sh`
- Add `PLAYWRIGHT_MCP.md`

### `dev` worktree files

- Modify `package.json`
- Modify `README.md`

`vite.config.ts` is explicitly out of scope for this task and should remain unchanged.

## 7. Error Handling

- If port `4173` is already in use, startup must fail immediately because `--strictPort` is part of the contract.
- If Playwright MCP is unavailable, the app startup path still remains valid and manually visitable in a browser.
- If the user later wants a different default app, the contract should be changeable by editing the launcher/docs/config without restructuring the app.

## 8. Verification

Implementation is complete when all of the following are true:

1. Running the root launcher starts the `dev` app on `127.0.0.1:4173`.
2. Running the dedicated `dev` script directly does the same.
3. The root `.mcp.json` remains valid JSON and points at the Playwright MCP server with the new defaults.
4. The `dev` app still builds and its existing test workflow remains intact.
5. The docs clearly state that `dev` is the default Codex UI debugging target.
6. `bun run dev` in `dev` remains available as the normal developer entrypoint and is not replaced by the new debug command.

## 9. Out of Scope

- Adding `playwright.config.ts`
- Adding repository E2E specs
- Adding visual regression tests
- Changing the default meaning of `bun run dev`
- Introducing a custom combined app-and-MCP process manager

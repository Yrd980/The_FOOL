import path from "node:path";
import { readFile } from "node:fs/promises";

export interface LiveViewAssets {
  html: string;
  appJs: string;
  css: string;
}

const buildHtmlShell = (): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The Fool Live</title>
    <link rel="stylesheet" href="/live/live.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/live/app.js"></script>
  </body>
</html>
`;

export const buildLiveViewAssets = async (
  repoRoot: string,
): Promise<LiveViewAssets> => {
  const appEntry = path.join(
    repoRoot,
    "src/openclaw/liveView/browser/app.ts",
  );
  const cssPath = path.join(
    repoRoot,
    "src/openclaw/liveView/browser/live.css",
  );

  const [{ outputs, success, logs }, css] = await Promise.all([
    Bun.build({
      entrypoints: [appEntry],
      format: "esm",
      target: "browser",
      minify: false,
      sourcemap: "none",
      splitting: false,
    }),
    readFile(cssPath, "utf8"),
  ]);

  if (!success || outputs.length === 0) {
    const detail =
      logs.length > 0
        ? logs.map((entry) => entry.message).join("\n")
        : "Unknown live view bundle error.";
    throw new Error(`Failed to bundle live view browser app.\n${detail}`);
  }

  const bundleText = await outputs[0].text();

  return {
    html: buildHtmlShell(),
    appJs: bundleText,
    css,
  };
};

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const viewerRoot = path.join(projectRoot, "viewer");
const viewerDistRoot = path.join(viewerRoot, "dist");
const outputRoot = path.join(projectRoot, "output");

function parsePort(argv: string[]): number {
  const hit = argv.find((arg) => arg.startsWith("--port="));
  if (!hit) return 4173;
  const num = Number(hit.split("=")[1]);
  if (!Number.isInteger(num) || num < 1 || num > 65535) {
    throw new Error("port must be 1-65535");
  }
  return num;
}

function apiOnlyMode(argv: string[]): boolean {
  return argv.includes("--api-only");
}

function latestReplayName(): string | null {
  if (!fs.existsSync(outputRoot)) return null;
  const files = fs
    .readdirSync(outputRoot)
    .filter((name) => /^replay-.*\.json$/.test(name))
    .map((name) => ({
      name,
      mtimeMs: fs.statSync(path.join(outputRoot, name)).mtimeMs
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return files[0]?.name ?? null;
}

function replayList(query?: URLSearchParams) {
  if (!fs.existsSync(outputRoot)) return [];
  const items = fs
    .readdirSync(outputRoot)
    .filter((name) => /^replay-.*\.json$/.test(name))
    .map((name) => {
      const filePath = path.join(outputRoot, name);
      const stat = fs.statSync(filePath);
      let mode: "dry-run" | "live" = "live";
      let agent_count = 0;
      try {
        const fd = fs.openSync(filePath, "r");
        const buf = Buffer.alloc(512);
        fs.readSync(fd, buf, 0, 512, 0);
        fs.closeSync(fd);
        const head = buf.toString("utf-8");
        if (/"dry_run"\s*:\s*true/.test(head)) mode = "dry-run";
        const agentMatch = head.match(/"agent_count"\s*:\s*(\d+)/);
        if (agentMatch) agent_count = Number(agentMatch[1]);
      } catch {}
      return {
        name,
        mtime: new Date(stat.mtimeMs).toISOString(),
        bytes: stat.size,
        mode,
        agent_count
      };
    })
    .sort((a, b) => Date.parse(b.mtime) - Date.parse(a.mtime));

  if (!query) return items;

  return items.filter((item) => {
    const modeFilter = query.get("mode");
    if (modeFilter && item.mode !== modeFilter) return false;
    const agentsMin = query.get("agents_min");
    if (agentsMin && item.agent_count < Number(agentsMin)) return false;
    const agentsMax = query.get("agents_max");
    if (agentsMax && item.agent_count > Number(agentsMax)) return false;
    return true;
  });
}

function safeReplayPath(name: string): string | null {
  if (!/^replay-.*\.json$/.test(name)) return null;
  const full = path.join(outputRoot, name);
  if (!full.startsWith(outputRoot)) return null;
  return full;
}

function contentType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".mjs")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

function serveStatic(urlPath: string): Response {
  if (!fs.existsSync(viewerDistRoot)) {
    return new Response("Viewer bundle not found. Run `bun run viewer:build` first.", { status: 503 });
  }

  const pathname = urlPath === "/" ? "/index.html" : urlPath;
  const safeRelative = pathname.replace(/^\/+/, "");
  const filePath = path.join(viewerDistRoot, safeRelative);

  if (!filePath.startsWith(viewerDistRoot)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const fallback = path.join(viewerDistRoot, "index.html");
    if (fs.existsSync(fallback)) {
      return new Response(Bun.file(fallback), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }
    return new Response("Not Found", { status: 404 });
  }

  return new Response(Bun.file(filePath), {
    headers: {
      "content-type": contentType(filePath),
      "cache-control": "no-store"
    }
  });
}

const port = parsePort(process.argv.slice(2));
const apiOnly = apiOnlyMode(process.argv.slice(2));

const server = Bun.serve({
  port,
  fetch(req: Request) {
    const url = new URL(req.url);

    if (url.pathname === "/api/replays") {
      return Response.json({ replays: replayList(url.searchParams) });
    }

    if (url.pathname === "/api/latest") {
      const name = latestReplayName();
      if (!name) {
        return Response.json(
          { error: "No replay file found in output/. Run simulation first." },
          { status: 404 }
        );
      }
      return new Response(Bun.file(path.join(outputRoot, name)), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }

    if (url.pathname.startsWith("/api/replay/")) {
      const name = decodeURIComponent(url.pathname.replace("/api/replay/", ""));
      const full = safeReplayPath(name);
      if (!full || !fs.existsSync(full)) {
        return Response.json({ error: "Replay not found" }, { status: 404 });
      }
      return new Response(Bun.file(full), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }

    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    if (apiOnly) {
      return new Response("Not Found", { status: 404 });
    }

    if (url.pathname === "/" || url.pathname === "/viewer" || url.pathname === "/viewer/" || url.pathname.startsWith("/assets/")) {
      const staticPath =
        url.pathname === "/" || url.pathname === "/viewer" || url.pathname === "/viewer/" ? "/index.html" : url.pathname;
      return serveStatic(staticPath);
    }

    if (url.pathname.startsWith("/viewer/")) {
      const staticPath = url.pathname.replace(/^\/viewer/, "");
      return serveStatic(staticPath);
    }

    return new Response("Not Found", { status: 404 });
  }
});

console.log(apiOnly ? `Viewer API running at http://localhost:${server.port}` : `Viewer running at http://localhost:${server.port}`);

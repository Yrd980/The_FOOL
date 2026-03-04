import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const viewerRoot = path.join(projectRoot, "viewer");
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

function replayList() {
  if (!fs.existsSync(outputRoot)) return [];
  return fs
    .readdirSync(outputRoot)
    .filter((name) => /^replay-.*\.json$/.test(name))
    .map((name) => {
      const stat = fs.statSync(path.join(outputRoot, name));
      return {
        name,
        mtime: new Date(stat.mtimeMs).toISOString(),
        bytes: stat.size
      };
    })
    .sort((a, b) => Date.parse(b.mtime) - Date.parse(a.mtime));
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
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function serveStatic(urlPath: string): Response {
  const pathname = urlPath === "/" ? "/index.html" : urlPath;
  const safeRelative = pathname.replace(/^\/+/, "");
  const filePath = path.join(viewerRoot, safeRelative);

  if (!filePath.startsWith(viewerRoot)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
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

const server = Bun.serve({
  port,
  fetch(req: Request) {
    const url = new URL(req.url);

    if (url.pathname === "/api/replays") {
      return Response.json({ replays: replayList() });
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

    if (url.pathname.startsWith("/viewer") || url.pathname === "/") {
      const staticPath = url.pathname === "/" ? "/index.html" : url.pathname.replace(/^\/viewer/, "");
      return serveStatic(staticPath);
    }

    return new Response("Not Found", { status: 404 });
  }
});

console.log(`Viewer running at http://localhost:${server.port}`);

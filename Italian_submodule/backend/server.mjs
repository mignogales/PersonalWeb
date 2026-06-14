import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? join(__dirname, "data");
const API_TOKEN = process.env.ITALIAN_SPRINT_API_TOKEN ?? "";
const ALLOWED_ORIGINS = (process.env.API_ALLOWED_ORIGINS ?? "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const emptyProgress = {
  forms: {},
  currentStreak: 0,
  bestStreak: 0,
  practicedDays: [],
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  setCorsHeaders(request, response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    if (url.pathname === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/users") {
      sendJson(response, 200, await readUsers());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/users") {
      const body = await readJsonBody(request);
      if (!normalizeUserName(String(body.name ?? ""))) {
        sendJson(response, 400, { error: "Missing user name" });
        return;
      }
      const user = await upsertUser(String(body.name ?? ""));
      sendJson(response, 200, user);
      return;
    }

    const progressMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/progress$/);
    if (progressMatch && request.method === "GET") {
      const userKey = decodeURIComponent(progressMatch[1]);
      sendJson(response, 200, await readProgress(userKey));
      return;
    }

    if (progressMatch && request.method === "PUT") {
      const userKey = decodeURIComponent(progressMatch[1]);
      const body = await readJsonBody(request);
      await writeProgress(userKey, sanitizeProgress(body));
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Invalid JSON" });
      return;
    }

    console.error(error);
    sendJson(response, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Italian Verb Sprint API listening on http://127.0.0.1:${PORT}`);
  console.log(`Writing data to ${DATA_DIR}`);
});

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;
  const allowedOrigin =
    ALLOWED_ORIGINS.includes("*") || !origin
      ? "*"
      : ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0];

  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  response.setHeader("Vary", "Origin");
}

function isAuthorized(request) {
  if (!API_TOKEN) return true;
  return request.headers.authorization === `Bearer ${API_TOKEN}`;
}

async function readUsers() {
  return readJson(usersPath(), []);
}

async function upsertUser(name) {
  const cleanName = normalizeUserName(name);
  if (!cleanName) throw new Error("Missing user name");

  const users = await readUsers();
  const key = getUserKey(cleanName);
  const existing = users.find((user) => getUserKey(user.name) === key);
  const now = new Date().toISOString();
  const nextUser = existing
    ? { ...existing, name: cleanName, lastSeenAt: now }
    : { name: cleanName, createdAt: now, lastSeenAt: now };
  const nextUsers = [...users.filter((user) => getUserKey(user.name) !== key), nextUser].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  await writeJson(usersPath(), nextUsers);
  return nextUser;
}

async function readProgress(userKey) {
  return { ...emptyProgress, ...(await readJson(progressPath(userKey), emptyProgress)) };
}

async function writeProgress(userKey, progress) {
  await writeJson(progressPath(userKey), progress);
}

function sanitizeProgress(progress) {
  if (!progress || typeof progress !== "object") return emptyProgress;
  return {
    forms: typeof progress.forms === "object" && progress.forms ? progress.forms : {},
    currentStreak: Number(progress.currentStreak) || 0,
    bestStreak: Number(progress.bestStreak) || 0,
    practicedDays: Array.isArray(progress.practicedDays) ? progress.practicedDays.filter(Boolean) : [],
  };
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.${process.pid}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(tmpPath, path);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request body too large");
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function usersPath() {
  return join(DATA_DIR, "users.json");
}

function progressPath(userKey) {
  return join(DATA_DIR, "progress", `${encodeURIComponent(userKey)}.json`);
}

function normalizeUserName(name) {
  return name.trim().replace(/\s+/g, " ");
}

function getUserKey(name) {
  return normalizeUserName(name).toLocaleLowerCase();
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

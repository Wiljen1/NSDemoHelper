import { spawn } from "node:child_process";
import { chmod } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const fakeCodexPath = path.join(projectRoot, "tests/fixtures/fake-codex.mjs");

export async function startTestServer() {
  await chmod(fakeCodexPath, 0o755);
  const port = await findFreePort();
  const child = spawn("node", ["src/control-panel.mjs"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      CODEX_BIN: fakeCodexPath,
      ELEVENLABS_API_KEY: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  await waitForServer(port, child, () => output);

  return {
    child,
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    output: () => output
  };
}

export async function stopTestServer(server) {
  if (!server?.child || server.child.killed) return;
  server.child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!server.child.killed) server.child.kill("SIGKILL");
      resolve();
    }, 2000);
    server.child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export async function requestJson(server, route, options = {}) {
  const response = await fetch(`${server.baseUrl}${route}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(`${options.method || "GET"} ${route} failed: ${response.status} ${text}`);
  }
  return payload;
}

export function draftPrepPayload(overrides = {}) {
  return {
    topic: "Automated finance demo test",
    inputMode: "notes-only",
    manifestDemoMode: "customer_story",
    demoStrategy: "standard_platform_demo",
    industry: "general_business",
    audience: "prospect",
    marketSegment: "mid_market",
    outputLanguage: "en",
    instructions: "Use standard reports first and avoid low-value setup.",
    demoScope: "Financials first Services premium, including SuiteProjects and Fixed Asset Management.",
    competition: "Status quo, current ERP, and spreadsheet-heavy reporting.",
    companyUrl: "https://example.com/",
    preDemoNotes: "Automated test notes: missing current ERP, success metrics, active countries, and stakeholder priorities.",
    valueIntensity: "balanced",
    voiceProvider: "say",
    voice: "Samantha",
    ...overrides
  };
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(port, child, getOutput) {
  const deadline = Date.now() + 15000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Test server exited early with code ${child.exitCode}:\n${getOutput()}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/run-state`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await delay(150);
  }
  throw new Error(`Timed out waiting for test server. ${lastError?.message || ""}\n${getOutput()}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const supportedModes = new Set(["mvp", "whitelabel"]);
const mode = parseMode(process.argv.slice(2));

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

const defaults = mode === "whitelabel"
  ? {
      APP_PROFILE: "whitelabel",
      APP_ENV: "development",
      PORT: "4182"
    }
  : {
      APP_PROFILE: "mvp",
      APP_ENV: "development",
      PORT: "4173"
    };

const fileEnv = await readEnvFile(path.join(projectRoot, `.env.${mode}`));
const env = {
  ...defaults,
  ...fileEnv,
  ...process.env,
  APP_PROFILE: process.env.APP_PROFILE || fileEnv.APP_PROFILE || defaults.APP_PROFILE
};

const url = `http://localhost:${env.PORT}`;
console.log(`Starting NetSuite Demo Helper (${env.APP_PROFILE})`);
console.log(`Environment: ${env.APP_ENV || "development"}`);
console.log(`URL: ${url}`);
console.log("");

const child = spawn(process.execPath, ["src/control-panel.mjs"], {
  cwd: projectRoot,
  env,
  stdio: "inherit"
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code || 0);
});

function parseMode(args) {
  const raw = args.find((arg) => supportedModes.has(arg)) ||
    args.find((arg) => arg.startsWith("--mode="))?.split("=")[1] ||
    "mvp";
  const normalized = String(raw || "").toLowerCase();
  if (supportedModes.has(normalized)) return normalized;
  console.error(`Unknown mode "${raw}". Use "mvp" or "whitelabel".`);
  process.exit(1);
}

async function readEnvFile(filePath) {
  try {
    return parseEnv(await readFile(filePath, "utf8"));
  } catch {
    return {};
  }
}

function parseEnv(text) {
  const env = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) continue;
    env[key] = stripQuotes(trimmed.slice(separator + 1).trim());
  }
  return env;
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function printHelp() {
  console.log(`NetSuite Demo Helper local launcher

Usage:
  npm run mvp
  npm run whitelabel
  node scripts/start-local.mjs mvp
  node scripts/start-local.mjs whitelabel

Modes:
  mvp         Stable internal NetSuite MVP profile on port 4173
  whitelabel  Future white-label development profile on port 4182

Optional local env files:
  .env.mvp
  .env.whitelabel

Existing environment variables override values from those files.`);
}

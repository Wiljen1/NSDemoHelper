#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const localMvpUrl = process.env.NSDH_LOCAL_MVP_URL || "http://localhost:4173/";
const outputFile = process.argv[2] || "apex/apps/f56174/shared-components/static-files/nsdemohelper-cloud.html";

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Could not find expected ${label}.`);
  }
  return source.replace(search, replacement);
}

function injectCloudBridge(html) {
  let next = html;
  next = next.replaceAll('url("/assets/b31e8773d38eab8a3c4a3e25413a77595a765691.png")', 'url("b31e8773d38eab8a3c4a3e25413a77595a765691.png")');
  next = next.replaceAll('href="/assets/b31e8773d38eab8a3c4a3e25413a77595a765691.png"', 'href="b31e8773d38eab8a3c4a3e25413a77595a765691.png"');

  next = replaceRequired(
    next,
    "    const nsdhCloudRuntime = false;\n",
    `    const nsdhCloudRuntime = location.hostname === "apex.oraclecorp.com";\n`,
    "cloud runtime detector"
  );

  next = next.replace(
    "Current version: local SC workspace.",
    "Current version: Oracle APEX cloud workspace with optional local Codex bridge."
  );

  return next;
}

async function main() {
  const response = await fetch(localMvpUrl);
  if (!response.ok) throw new Error(`Could not read local MVP HTML from ${localMvpUrl}: ${response.status}`);
  const html = await response.text();
  const transformed = injectCloudBridge(html);
  const absoluteOutput = path.resolve(outputFile);
  await mkdir(path.dirname(absoluteOutput), { recursive: true });
  await writeFile(absoluteOutput, transformed, "utf8");

  const ribbonSource = path.resolve("assets/b31e8773d38eab8a3c4a3e25413a77595a765691.png");
  const ribbonTarget = path.resolve("apex/apps/f56174/shared-components/static-files/b31e8773d38eab8a3c4a3e25413a77595a765691.png");
  await mkdir(path.dirname(ribbonTarget), { recursive: true });
  await writeFile(ribbonTarget, await readFile(ribbonSource));

  console.log(JSON.stringify({
    ok: true,
    source: localMvpUrl,
    output: absoluteOutput,
    bytes: transformed.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

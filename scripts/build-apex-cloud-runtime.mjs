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
    "    let liveDemoFunctionalityEnabled = false;\n",
    `    let liveDemoFunctionalityEnabled = false;\n    const nsdhCloudRuntime = location.hostname === "apex.oraclecorp.com";\n    const nsdhDefaultLocalApiBase = "http://localhost:4173";\n\n    function cloudApiBase() {\n      return (localStorage.getItem("nsdhCloudApiBase") || nsdhDefaultLocalApiBase).replace(/\\/$/, "");\n    }\n\n    function cloudApiUrl(path) {\n      if (!path || !String(path).startsWith("/")) return path;\n      if (!nsdhCloudRuntime) return path;\n      return cloudApiBase() + path;\n    }\n`,
    "live demo feature flag bootstrap"
  );

  next = next.replaceAll("fetch(path, {", "fetch(cloudApiUrl(path), {");
  next = next.replaceAll("window.location.href = payload.downloadUrl;", "window.location.href = cloudApiUrl(payload.downloadUrl);");
  next = next.replaceAll("href='/api/session-logs/download/\" + encodeURIComponent(session.session_id) + \"'", "href='\" + escapeClientHtml(cloudApiUrl(\"/api/session-logs/download/\" + encodeURIComponent(session.session_id))) + \"'");
  next = next.replaceAll("escapeClientHtml(file.downloadUrl)", "escapeClientHtml(cloudApiUrl(file.downloadUrl))");

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

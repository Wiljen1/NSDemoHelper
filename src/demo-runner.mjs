import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const SUPPORTED_ACTIONS = new Set([
  "clickRole",
  "clickText",
  "goto",
  "globalSearchOpen",
  "highlightText",
  "note",
  "press",
  "screenshot",
  "wait",
  "waitForAnyText",
  "waitForText"
]);

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(args.manifest || "manifests/finance-pl-cash360.demo.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const projectRoot = path.dirname(path.dirname(manifestPath));
const screenshotDir = path.resolve(projectRoot, manifest.defaults?.screenshots?.directory || "artifacts/screenshots");
const cachePath = path.resolve(projectRoot, manifest.defaults?.cache?.file || "artifacts/cache/demo-cache.json");
const narratorStatePath = path.resolve(projectRoot, "artifacts/runtime/narrator-state.json");
const audioDir = path.resolve(projectRoot, "artifacts/audio");
const valueIntensity = normalizeValueIntensity(
  args["value-intensity"] ||
    args.value ||
    manifest.controls?.valueStatementIntensity?.default ||
    manifest.defaults?.valueStatementIntensity ||
    "balanced"
);

if (args["dry-run"]) {
  printDryRun(manifest);
  process.exit(0);
}

const { chromium } = await import("playwright");
const browserSession = await openBrowserSession(chromium, manifest);
const page = browserSession.page;

try {
  if (args["open-browser"]) {
    await openLoginPage(page, manifest);
  } else if (args.login) {
    await runLogin(page, manifest);
  } else {
    await runDemo(page, manifest);
  }
} finally {
  await browserSession.cleanup();
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=");
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
    } else if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
      parsed[rawKey] = argv[i + 1];
      i += 1;
    } else {
      parsed[rawKey] = true;
    }
  }
  return parsed;
}

async function openBrowserSession(chromium, demoManifest) {
  const browserDefaults = demoManifest.defaults?.browser || {};
  const mode = args.browser || browserDefaults.mode || "reuse";

  if (mode === "new") {
    const context = await launchOneOffContext(chromium, demoManifest);
    return {
      page: context.pages()[0] || await context.newPage(),
      cleanup: () => context.close()
    };
  }

  const cdpUrl = args["cdp-url"] || browserDefaults.cdpUrl || "http://127.0.0.1:9222";
  const browser = await connectOrStartReusableBrowser(chromium, demoManifest, cdpUrl);
  const context = browser.contexts()[0] || await browser.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
  const page = await pickPage(context, demoManifest);

  return {
    page,
    cleanup: async () => {
      await browser.close();
    }
  };
}

async function launchOneOffContext(chromium, demoManifest) {
  const profileDir = profileDirectory(demoManifest);
  return chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1440, height: 950 },
    slowMo: Number(args.slowMo || 0),
    acceptDownloads: true
  });
}

async function connectOrStartReusableBrowser(chromium, demoManifest, cdpUrl) {
  const existing = await tryConnect(chromium, cdpUrl);
  if (existing) return existing;

  await startReusableBrowser(chromium, demoManifest, cdpUrl);
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const browser = await tryConnect(chromium, cdpUrl);
    if (browser) return browser;
    await delay(500);
  }

  throw new Error(`Could not connect to reusable browser at ${cdpUrl}`);
}

async function tryConnect(chromium, cdpUrl) {
  try {
    return await chromium.connectOverCDP(cdpUrl, { timeout: 1200 });
  } catch {
    return null;
  }
}

async function startReusableBrowser(chromium, demoManifest, cdpUrl) {
  const port = new URL(cdpUrl).port || "9222";
  const profileDir = profileDirectory(demoManifest);
  await mkdir(profileDir, { recursive: true });

  const startUrl = resolveUrl(demoManifest, demoManifest.context.login.startPath);
  const child = spawn(
    chromium.executablePath(),
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=DialMediaRouteProvider",
      startUrl
    ],
    {
      detached: true,
      stdio: "ignore"
    }
  );
  child.unref();
}

async function pickPage(context, demoManifest) {
  const host = new URL(demoManifest.context.baseUrl).host;
  const pages = context.pages();
  const matching = pages.find((candidate) => {
    try {
      return new URL(candidate.url()).host === host;
    } catch {
      return false;
    }
  });
  return matching || pages[0] || await context.newPage();
}

function profileDirectory(demoManifest) {
  return path.resolve(projectRoot, demoManifest.defaults?.browser?.profileDirectory || ".auth/netsuite-profile");
}

async function runLogin(page, demoManifest) {
  await openLoginPage(page, demoManifest);
  const rl = readline.createInterface({ input, output });
  await rl.question("Log in to NetSuite in the opened browser, then press Enter here. This only saves the browser session; run the demo or rehearsal after this. ");
  rl.close();
  console.log("Browser session is ready. Leave that browser open, then run npm run demo:rehearse or use the control panel.");
}

async function openLoginPage(page, demoManifest) {
  const url = resolveUrl(demoManifest, demoManifest.context.login.startPath);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  console.log("Reusable NetSuite demo browser is open. Log in there and leave the window open.");
}

async function runDemo(page, demoManifest) {
  await mkdir(screenshotDir, { recursive: true });
  await waitForLogin(page, demoManifest);
  const runRecord = {
    manifestId: demoManifest.id,
    manifestName: demoManifest.name,
    mode: args.rehearse ? "rehearsal" : "live",
    valueIntensity,
    startedAt: new Date().toISOString(),
    segments: []
  };

  for (const segment of demoManifest.segments) {
    await delay(demoManifest.defaults?.pace?.beforeSegmentMs || 0);
    logSegment(segment);

    const narration = buildNarration(segment, demoManifest);
    const segmentRecord = {
      id: segment.id,
      title: segment.title,
      startedAt: new Date().toISOString(),
      actions: []
    };
    const segmentStarted = Date.now();

    await writeNarratorState({
      speaking: !args.rehearse && (args.audio || demoManifest.defaults?.audio?.provider) !== "none",
      segmentId: segment.id,
      segmentTitle: segment.title,
      text: narration,
      voice: args.voice || demoManifest.defaults?.audio?.voice || "Moira",
      updatedAt: new Date().toISOString()
    });

    const speech = speak(narration, demoManifest).catch((error) => {
      console.warn(`Audio skipped for "${segment.id}": ${error.message}`);
    });

    for (const action of segment.actions || []) {
      const actionStarted = Date.now();
      const actionTarget = action.text || action.name || action.query || action.url || action.key || "";
      try {
        const actionResult = await runAction(page, demoManifest, segment, action);
        segmentRecord.actions.push({
          type: action.type,
          target: actionTarget,
          status: actionResult?.status || "ok",
          elapsedMs: Date.now() - actionStarted,
          url: page.url()
        });
      } catch (error) {
        segmentRecord.actions.push({
          type: action.type,
          target: actionTarget,
          status: "failed",
          elapsedMs: Date.now() - actionStarted,
          error: error.message,
          url: page.url()
        });
        segmentRecord.status = "failed";
        runRecord.segments.push(segmentRecord);
        await saveRunCache(runRecord, "failed");
        throw error;
      }
      await delay(demoManifest.defaults?.pace?.afterActionMs || 0);
    }

    await verifySegment(page, segment);

    if (demoManifest.defaults?.screenshots?.onSegmentEnd) {
      await saveScreenshot(page, `${segment.id}.png`);
    }

    await speech;
    await writeNarratorState({
      speaking: false,
      segmentId: segment.id,
      segmentTitle: segment.title,
      text: narration,
      voice: args.voice || demoManifest.defaults?.audio?.voice || "Moira",
      updatedAt: new Date().toISOString()
    });
    segmentRecord.status = segmentRecord.status || "ok";
    segmentRecord.elapsedMs = Date.now() - segmentStarted;
    segmentRecord.completedAt = new Date().toISOString();
    runRecord.segments.push(segmentRecord);
    await delay(demoManifest.defaults?.pace?.afterSegmentMs || 0);
  }

  await saveRunCache(runRecord, "completed");
  await writeNarratorState({
    speaking: false,
    segmentId: "complete",
    segmentTitle: "Demo complete",
    text: "Demo complete.",
    voice: args.voice || demoManifest.defaults?.audio?.voice || "Moira",
    updatedAt: new Date().toISOString()
  });
  console.log(`Demo complete. Screenshots are in ${screenshotDir}`);
  if (args.rehearse) {
    console.log(`Rehearsal cache saved: ${cachePath}`);
  }
}

async function waitForLogin(page, demoManifest) {
  const readyText = demoManifest.context.login.readyText || "Search";
  const startUrl = resolveUrl(demoManifest, demoManifest.context.login.startPath);

  if (!page.url() || page.url() === "about:blank") {
    await page.goto(startUrl, { waitUntil: "domcontentloaded" });
  }

  try {
    await waitForText(page, readyText, 5000);
  } catch {
    console.log("Waiting for the logged-in NetSuite page. Finish login in the browser window when prompted.");
    await page.goto(startUrl, { waitUntil: "domcontentloaded" });
    await waitForText(page, readyText, 180000);
  }
}

async function runAction(page, demoManifest, segment, action) {
  if (!SUPPORTED_ACTIONS.has(action.type)) {
    throw new Error(`Unsupported action type "${action.type}" in ${segment.id}`);
  }

  try {
    switch (action.type) {
      case "goto":
        await page.goto(resolveUrl(demoManifest, action.url), { waitUntil: "domcontentloaded", timeout: action.timeoutMs || 30000 });
        break;
      case "globalSearchOpen":
        await globalSearchOpen(page, demoManifest, action);
        break;
      case "waitForText":
        await waitForText(page, action.text, action.timeoutMs);
        break;
      case "waitForAnyText":
        await waitForAnyText(page, action.texts || [], action.timeoutMs);
        break;
      case "clickText":
        await page.getByText(action.text, { exact: Boolean(action.exact) }).first().click({ timeout: action.timeoutMs || 10000 });
        break;
      case "clickRole":
        await page.getByRole(action.role, { name: action.name, exact: Boolean(action.exact) }).first().click({ timeout: action.timeoutMs || 10000 });
        break;
      case "press":
        await page.keyboard.press(action.key);
        break;
      case "highlightText":
        await highlightText(page, action.text, action);
        break;
      case "screenshot":
        await saveScreenshot(page, `${action.name || segment.id}.png`);
        break;
      case "wait":
        await delay(action.ms || 1000);
        break;
      case "note":
        console.log(action.text || "");
        break;
    }
  } catch (error) {
    if (action.optional) {
      console.warn(`Optional action skipped in ${segment.id}: ${action.type} ${action.text || action.url || ""}`);
      return { status: "skipped", error: error.message };
    }

    if (demoManifest.defaults?.screenshots?.onFailure) {
      await saveScreenshot(page, `failure-${segment.id}.png`).catch(() => {});
    }
    throw error;
  }
}

async function verifySegment(page, segment) {
  for (const verification of segment.verifications || []) {
    if (verification.type !== "text") continue;
    await waitForText(page, verification.text, verification.timeoutMs || 8000);
  }
}

async function waitForText(page, text, timeoutMs = 10000) {
  await firstVisibleLabel(page, text, { timeoutMs });
}

async function waitForAnyText(page, texts, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    for (const text of texts) {
      try {
        if (await page.getByText(text, { exact: false }).first().isVisible({ timeout: 500 })) {
          return text;
        }
      } catch (error) {
        lastError = error;
      }
    }
    await delay(400);
  }

  throw lastError || new Error(`None of these texts appeared: ${texts.join(", ")}`);
}

async function globalSearchOpen(page, demoManifest, action) {
  const timeoutMs = action.timeoutMs || 20000;
  const searchBox = await findGlobalSearchBox(page);
  await searchBox.fill(action.query, { timeout: 5000 });
  await searchBox.press("Enter");
  await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs }).catch(() => {});

  const resultText = action.resultText || action.query;
  try {
    const result = await findSearchResult(page, resultText, Math.min(timeoutMs, 10000));
    await result.click({ timeout: 5000 });
    await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs }).catch(() => {});
    return;
  } catch (error) {
    if (action.fallbackUrl) {
      await page.goto(resolveUrl(demoManifest, action.fallbackUrl), { waitUntil: "domcontentloaded", timeout: timeoutMs });
      return;
    }
    throw error;
  }
}

async function findSearchResult(page, resultText, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    const candidates = [
      page.getByRole("row", { name: resultText, exact: false }).first().getByRole("link", { name: "View", exact: true }).first(),
      page.getByRole("link", { name: resultText, exact: false }).first(),
      page.getByText(resultText, { exact: false }).first()
    ];

    for (const candidate of candidates) {
      try {
        await candidate.waitFor({ timeout: 400 });
        if (await candidate.isVisible({ timeout: 150 })) return candidate;
      } catch (error) {
        lastError = error;
      }
    }

    await delay(250);
  }

  throw lastError || new Error(`Could not find search result: ${resultText}`);
}

async function findGlobalSearchBox(page) {
  const candidates = [
    page.getByRole("textbox", { name: "Search", exact: false }).first(),
    page.getByPlaceholder("Search").first()
  ];

  for (const candidate of candidates) {
    try {
      await candidate.waitFor({ timeout: 2500 });
      if (await candidate.isVisible({ timeout: 250 })) return candidate;
    } catch {}
  }

  throw new Error("Could not find the NetSuite global search box.");
}

async function highlightText(page, text, action) {
  const locator = await firstVisibleLabel(page, text, {
    exact: Boolean(action.exact),
    timeoutMs: action.timeoutMs || 10000
  });
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((element) => {
    element.dataset.demoPreviousOutline = element.style.outline || "";
    element.dataset.demoPreviousBoxShadow = element.style.boxShadow || "";
    element.style.outline = "4px solid #00A8A8";
    element.style.boxShadow = "0 0 0 8px rgba(0, 168, 168, 0.22)";
    element.style.transition = "outline 120ms ease, box-shadow 120ms ease";
  });
  await delay(action.durationMs || 900);
  await locator.evaluate((element) => {
    element.style.outline = element.dataset.demoPreviousOutline || "";
    element.style.boxShadow = element.dataset.demoPreviousBoxShadow || "";
  }).catch(() => {});
}

async function firstVisibleLabel(page, text, options = {}) {
  const timeoutMs = options.timeoutMs || 10000;
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    for (const locator of labelLocators(page, text, options)) {
      try {
        await locator.waitFor({ timeout: 350 });
        if (await locator.isVisible({ timeout: 150 })) return locator;
      } catch (error) {
        lastError = error;
      }
    }
    await delay(250);
  }

  throw lastError || new Error(`Could not find visible label: ${text}`);
}

function labelLocators(page, text, options = {}) {
  const exact = Boolean(options.exact);
  return [
    page.getByText(text, { exact }).first(),
    page.getByRole("button", { name: text, exact }).first(),
    page.getByRole("link", { name: text, exact }).first(),
    page.getByRole("textbox", { name: text, exact }).first(),
    page.getByRole("combobox", { name: text, exact }).first()
  ];
}

async function saveScreenshot(page, filename) {
  await mkdir(screenshotDir, { recursive: true });
  const target = path.join(screenshotDir, filename);
  await page.screenshot({ path: target, fullPage: false });
  console.log(`Saved screenshot: ${target}`);
}

function speak(text, demoManifest) {
  const audioMode = args.rehearse ? "none" : args.audio || demoManifest.defaults?.audio?.provider || "none";
  if (!text || audioMode === "none") return Promise.resolve();

  if (audioMode === "elevenlabs") return speakWithElevenLabs(text, demoManifest);

  if (audioMode !== "say") return Promise.reject(new Error(`Unsupported audio provider "${audioMode}".`));

  const voice = args.voice || demoManifest.defaults?.audio?.voice || "Moira";
  const rate = String(args.rate || demoManifest.defaults?.audio?.rate || 185);

  return new Promise((resolve, reject) => {
    const child = spawn("say", ["-v", voice, "-r", rate, text], { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`say exited with code ${code}`));
    });
  });
}

async function speakWithElevenLabs(text, demoManifest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ElevenLabs needs ELEVENLABS_API_KEY. Start the control panel with that environment variable or switch back to Local Mac voice.");

  const voice = args.voice || demoManifest.defaults?.audio?.voice || "21m00Tcm4TlvDq8ikWAM";
  const modelId = args["elevenlabs-model"] || demoManifest.defaults?.audio?.model || process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
  await mkdir(audioDir, { recursive: true });
  const file = path.join(audioDir, `${Date.now()}-${slugify(voice)}.mp3`);

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "xi-api-key": apiKey,
      accept: "audio/mpeg"
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.78,
        style: 0.25,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `ElevenLabs returned ${response.status}`);
  }

  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  await playAudioFile(file);
}

function playAudioFile(file) {
  return new Promise((resolve, reject) => {
    const child = spawn("afplay", [file], { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`afplay exited with code ${code}`));
    });
  });
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "voice";
}

function resolveUrl(demoManifest, value) {
  if (!value) return value;
  const baseUrl = demoManifest.context.baseUrl.replace(/\/$/, "");
  const interpolated = value.replaceAll("${baseUrl}", baseUrl);
  if (interpolated.startsWith("http")) return interpolated;
  return `${baseUrl}${interpolated.startsWith("/") ? "" : "/"}${interpolated}`;
}

function logSegment(segment) {
  console.log(`\n[${segment.id}] ${segment.title}`);
  if (shouldIncludeValueStatement(segment, manifest)) {
    console.log(`Why this matters: ${segment.valueStatement}`);
  }
}

function printDryRun(demoManifest) {
  console.log(`${demoManifest.name}`);
  console.log(`Value intensity: ${valueIntensity}`);
  console.log(`Rehearsal cache: ${cachePath}`);
  console.log(`Segments: ${demoManifest.segments.length}`);
  for (const segment of demoManifest.segments) {
    console.log(`- ${segment.id}: ${segment.title}`);
    if (shouldIncludeValueStatement(segment, demoManifest)) {
      console.log(`  why -> ${segment.valueStatement}`);
    }
    for (const action of segment.actions || []) {
      const target = action.text || action.name || action.query || action.url || action.key || "";
      console.log(`  ${action.type}${target ? ` -> ${target}` : ""}${action.optional ? " (optional)" : ""}`);
    }
  }
}

function buildNarration(segment, demoManifest) {
  if (!shouldIncludeValueStatement(segment, demoManifest)) {
    return segment.narration;
  }
  return `${segment.narration} ${segment.valueStatement}`;
}

function shouldIncludeValueStatement(segment, demoManifest) {
  const valueMoment = segment.valueMoment || "page";
  if (valueIntensity === "heavy") return true;
  if (valueIntensity === "light") {
    return valueMoment === "major" || isMajorTransition(segment.id);
  }
  return ["major", "page"].includes(valueMoment);
}

function isMajorTransition(segmentId) {
  return ["open-pl", "open-cash360-dashboard", "close"].includes(segmentId);
}

function normalizeValueIntensity(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["light", "balanced", "heavy"].includes(normalized)) return normalized;
  throw new Error(`Unsupported value intensity "${value}". Use light, balanced, or heavy.`);
}

async function saveRunCache(runRecord, status) {
  if (!args.rehearse && !args.cache) return;
  const cache = {
    ...runRecord,
    status,
    completedAt: new Date().toISOString(),
    notes: [
      "This file is written by rehearsal runs.",
      "It captures stable routes, timing, current page URLs, and skipped optional steps for smoother final-demo tuning."
    ]
  };
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

async function writeNarratorState(state) {
  try {
    await mkdir(path.dirname(narratorStatePath), { recursive: true });
    await writeFile(narratorStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  } catch {}
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

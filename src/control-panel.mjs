import http from "node:http";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";

const projectRoot = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const manifestPath = path.join(projectRoot, "manifests/finance-pl-cash360.demo.json");
const generatedManifestsDir = path.join(projectRoot, "manifests/generated");
const versionsDir = path.join(projectRoot, "manifests/versions");
const scGuidePath = path.join(projectRoot, "artifacts/sc-demo-guide.md");
const narratorStatePath = path.join(projectRoot, "artifacts/runtime/narrator-state.json");
const port = Number(process.env.PORT || 4173);
let currentRun = null;

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/") return html(response);
    if (request.method === "GET" && request.url === "/api/manifest") return json(response, await manifestPayload());
    if (request.method === "GET" && request.url === "/api/versions") return json(response, { versions: await listVersions() });
    if (request.method === "GET" && request.url === "/api/run-state") return json(response, runState());
    if (request.method === "GET" && request.url?.startsWith("/api/voices")) {
      const provider = new URL(request.url, "http://localhost").searchParams.get("provider") || "say";
      return json(response, await listVoices(provider));
    }
    if (request.method === "GET" && request.url === "/api/sc-guide") return json(response, { guide: await readScGuide() });
    if (request.method === "GET" && request.url === "/api/setup-prompt") {
      const manifest = await readManifest();
      return json(response, { ok: true, setupPrompt: setupPromptPayload(manifest) });
    }
    if (request.method === "GET" && request.url === "/api/narrator-state") return json(response, await readNarratorState());
    if (request.method === "GET" && request.url?.startsWith("/api/download/")) {
      const fileName = decodeURIComponent(path.basename(request.url.replace("/api/download/", "")));
      if (!fileName.endsWith(".docx")) return json(response, { ok: false, error: "Only Word guide downloads are available here." }, 400);
      const filePath = path.join(projectRoot, "artifacts", fileName);
      return sendFile(response, filePath, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }

    if (request.method === "POST" && request.url === "/api/manifest") {
      const body = await readBody(request);
      const parsedManifest = JSON.parse(body.manifest);
      const nextManifest = JSON.stringify(parsedManifest, null, 2);
      await saveVersion("before-manual-edit");
      await writeFile(manifestPath, `${nextManifest}\n`, "utf8");
      const namedManifestPath = await writeNamedManifestCopy(parsedManifest);
      return json(response, { ok: true, manifest: JSON.parse(nextManifest), versions: await listVersions(), namedManifestPath, setupPrompt: setupPromptPayload(parsedManifest) });
    }

    if (request.method === "POST" && request.url === "/api/learn") {
      const body = await readBody(request);
      await saveVersion("before-learn");
      const manifest = await readManifest();
      const company = await analyseCompany(body.companyUrl, notesForCompanyAnalysis(body));
      const learned = applyLearningRequest(manifest, body, company);
      await writeFile(manifestPath, `${JSON.stringify(learned, null, 2)}\n`, "utf8");
      const namedManifestPath = await writeNamedManifestCopy(learned);
      const guide = await writeScGuide(learned, body, company);
      return json(response, { ok: true, manifest: learned, versions: await listVersions(), company, guide, namedManifestPath, setupPrompt: setupPromptPayload(learned) });
    }

    if (request.method === "POST" && request.url === "/api/restore") {
      const body = await readBody(request);
      await saveVersion("before-restore");
      const source = safeVersionPath(body.file);
      await writeFile(manifestPath, await readFile(source, "utf8"), "utf8");
      const manifest = await readManifest();
      return json(response, { ok: true, manifest, versions: await listVersions(), setupPrompt: setupPromptPayload(manifest) });
    }

    if (request.method === "POST" && request.url === "/api/run") {
      const body = await readBody(request);
      return json(response, await runCommand(body));
    }

    if (request.method === "POST" && request.url === "/api/stop") {
      return json(response, stopCurrentRun());
    }

    if (request.method === "POST" && request.url === "/api/voice-sample") {
      const body = await readBody(request);
      return json(response, await playVoiceSample(body));
    }

    if (request.method === "POST" && request.url === "/api/export-guide-docx") {
      return json(response, await exportScGuideDocx());
    }

    if (request.method === "POST" && request.url === "/api/execute-setup-prompt") {
      const body = await readBody(request);
      return json(response, await executeSetupPrompt(body));
    }

    response.writeHead(404);
    response.end("Not found");
  } catch (error) {
    json(response, { ok: false, error: error.message }, 500);
  }
});

server.listen(port, () => {
  console.log(`NetSuite Demo Helper: http://localhost:${port}`);
});

async function manifestPayload() {
  const manifest = await readManifest();
  return {
    manifest,
    versions: await listVersions(),
    guide: await readScGuide(),
    setupPrompt: setupPromptPayload(manifest)
  };
}

async function readManifest() {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

async function readBody(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

async function saveVersion(label) {
  await mkdir(versionsDir, { recursive: true });
  const manifest = await readManifest();
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const companySlug = companyFileSlug(manifest);
  const safeLabel = String(label || "version").replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const file = `${stamp}-${companySlug}-${safeLabel}.json`;
  await writeFile(path.join(versionsDir, file), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return file;
}

async function listVersions() {
  await mkdir(versionsDir, { recursive: true });
  const files = (await readdir(versionsDir)).filter((file) => file.endsWith(".json")).sort().reverse();
  return files;
}

function safeVersionPath(file) {
  const clean = path.basename(String(file || ""));
  if (!clean.endsWith(".json")) throw new Error("Choose a JSON manifest version.");
  return path.join(versionsDir, clean);
}

async function writeNamedManifestCopy(manifest) {
  await mkdir(generatedManifestsDir, { recursive: true });
  const file = `${companyFileSlug(manifest)}-demo-manifest.json`;
  const destination = path.join(generatedManifestsDir, file);
  await writeFile(destination, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return destination;
}

function companyFileSlug(manifestOrCompany) {
  const company = manifestOrCompany?.context?.company || manifestOrCompany || {};
  return websiteNameSlug(company.url) || slugify(company.companyName) || "netsuite-demo";
}

function websiteNameSlug(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const parts = url.hostname
      .toLowerCase()
      .replace(/^www\./, "")
      .split(".")
      .filter(Boolean);
    if (!parts.length) return "";

    const secondLevelCountryDomains = new Set(["ac", "co", "com", "edu", "gov", "net", "org"]);
    const domainLabel = parts.length >= 3 && parts.at(-1).length === 2 && secondLevelCountryDomains.has(parts.at(-2))
      ? parts.at(-3)
      : parts.length >= 2
        ? parts.at(-2)
        : parts[0];
    return slugify(domainLabel);
  } catch {
    return slugify(raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(".")[0]);
  }
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function defaultScInstructions() {
  return [
    "Lead with the audience's business problem and desired outcome before showing screens.",
    "Open with the biggest business hitters first: executive visibility, trusted numbers, cash control, close speed, auditability, and fewer spreadsheets.",
    "Use a crisp tell-show-tell rhythm: frame the point, show the shortest proof path, then land why it matters in plain language.",
    "Use NetSuite global search and the navigation bar as the primary way to move through the product.",
    "Use standard NetSuite reports for finance demos unless the audience explicitly asks for custom reporting.",
    "Choose the optimal demo flow, even if the product can do more. Show the path an excellent SC would choose in a live meeting.",
    "Connect each screen to the audience's likely role, pressure, and decision criteria. Make the story feel specific, not generic.",
    "Keep the demo read-only unless the SC intentionally chooses to create or edit a record.",
    "Pause for smart discovery questions at natural decision points, especially before drilling into detail or switching modules.",
    "Show drilldown only when it proves trust, auditability, or actionability. Do not drill for the sake of clicking.",
    "Use realistic business language. Avoid NetSuite jargon unless the audience already uses it.",
    "Never announce internal labels such as 'value statement' during narration.",
    "Avoid feature tours, menu wandering, slow setup, dead clicks, custom report shortcuts, and explaining every field on the page.",
    "Avoid showing unconfigured areas, risky transactions, preference saves, or anything that could distract from the core story.",
    "If a page takes time to load, narrate the business reason for the next step instead of filling the silence with product trivia."
  ].join("\n");
}

async function readScGuide() {
  try {
    return await readFile(scGuidePath, "utf8");
  } catch {
    return "";
  }
}

async function exportScGuideDocx() {
  const guide = await readScGuide();
  if (!guide.trim()) throw new Error("Create an SC guide before exporting to Word.");
  const manifest = await readManifest();
  const fileName = `${companyFileSlug(manifest)}-sc-demo-guide.docx`;
  const outputPath = path.join(projectRoot, "artifacts", fileName);

  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    ShadingType,
    TextRun
  } = loadDocx();

  const children = markdownToDocxChildren(guide, { AlignmentType, BorderStyle, HeadingLevel, Paragraph, ShadingType, TextRun });
  const document = new Document({
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: { font: "Arial", size: 22, color: "202832" },
          paragraph: { spacing: { after: 140, line: 276 } }
        },
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          next: "Normal",
          run: { font: "Arial", size: 34, bold: true, color: "0F4C5C" },
          paragraph: { spacing: { after: 260 } }
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 28, bold: true, color: "0F4C5C" },
          paragraph: { spacing: { before: 280, after: 120 } }
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 24, bold: true, color: "202832" },
          paragraph: { spacing: { before: 220, after: 90 } }
        }
      ]
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
          }
        },
        children
      }
    ]
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  const buffer = await Packer.toBuffer(document);
  await writeFile(outputPath, buffer);
  return {
    ok: true,
    path: outputPath,
    downloadUrl: `/api/download/${encodeURIComponent(fileName)}`
  };
}

function loadDocx() {
  const localRequire = createRequire(import.meta.url);
  try {
    return localRequire("docx");
  } catch {
    return createRequire("/Users/wiljan.h/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/docx/package.json")("docx");
  }
}

function markdownToDocxChildren(markdown, docx) {
  const { AlignmentType, BorderStyle, HeadingLevel, Paragraph, ShadingType, TextRun } = docx;
  const children = [];
  const lines = markdown.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      children.push(new Paragraph({ text: "", spacing: { after: 80 } }));
      continue;
    }

    if (line.startsWith("# ")) {
      children.push(new Paragraph({
        text: line.slice(2).trim(),
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.LEFT
      }));
      continue;
    }

    if (line.startsWith("## ")) {
      children.push(new Paragraph({
        text: line.slice(3).trim(),
        heading: HeadingLevel.HEADING_1
      }));
      continue;
    }

    if (line.startsWith("### ")) {
      children.push(new Paragraph({
        text: line.slice(4).trim(),
        heading: HeadingLevel.HEADING_2
      }));
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      children.push(new Paragraph({
        children: inlineRuns(line.replace(/^\s*-\s+/, ""), TextRun),
        bullet: { level: 0 },
        spacing: { after: 80 }
      }));
      continue;
    }

    const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (numbered) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${numbered[1]}. `, bold: true }), ...inlineRuns(numbered[2], TextRun)],
        spacing: { before: 120, after: 60 },
        border: {
          bottom: { color: "D8DEE6", style: BorderStyle.SINGLE, size: 4 }
        }
      }));
      continue;
    }

    if (/^\s{2,}-\s+/.test(rawLine)) {
      children.push(new Paragraph({
        children: inlineRuns(line.replace(/^\s*-\s+/, ""), TextRun),
        bullet: { level: 1 },
        spacing: { after: 60 }
      }));
      continue;
    }

    if (line.startsWith("> ")) {
      children.push(new Paragraph({
        children: inlineRuns(line.slice(2), TextRun),
        shading: { type: ShadingType.CLEAR, color: "auto", fill: "EEF6F6" },
        spacing: { before: 80, after: 120 },
        indent: { left: 180 },
        border: {
          left: { color: "0F7D7D", style: BorderStyle.SINGLE, size: 12 }
        }
      }));
      continue;
    }

    children.push(new Paragraph({
      children: inlineRuns(line, TextRun),
      spacing: { after: 120 }
    }));
  }

  return children;
}

function inlineRuns(text, TextRun) {
  const parts = String(text || "").split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return new TextRun({ text: part.slice(2, -2), bold: true });
    }
    return new TextRun({ text: part });
  });
}

async function readNarratorState() {
  try {
    const state = JSON.parse(await readFile(narratorStatePath, "utf8"));
    const updatedAt = Date.parse(state.updatedAt || "");
    if (state.speaking && (!updatedAt || Date.now() - updatedAt > 60000)) {
      return {
        ...state,
        speaking: false,
        segmentTitle: state.segmentTitle || "Ready",
        text: state.text || "The narrator is ready."
      };
    }
    return state;
  } catch {
    return {
      speaking: false,
      segmentId: "idle",
      segmentTitle: "Ready",
      text: "The narrator is ready.",
      voice: "Moira",
      updatedAt: new Date().toISOString()
    };
  }
}

function applyLearningRequest(manifest, body, company) {
  const inputMode = normalizeInputMode(body.inputMode);
  const valueIntensity = ["light", "balanced", "heavy"].includes(body.valueIntensity) ? body.valueIntensity : "balanced";
  const instructions = String(body.instructions || "").trim() || defaultScInstructions();
  const rawPreDemoNotes = String(body.preDemoNotes || "").trim();
  const preDemoNotes = inputMode === "request-only" ? "" : rawPreDemoNotes;
  const rawTopic = String(body.topic || "").trim();
  const topic = inputMode === "notes-only"
    ? inferDemoRequestFromNotes(preDemoNotes, company)
    : rawTopic || inferDemoRequestFromNotes(preDemoNotes, company);
  const voice = String(body.voice || "Moira").trim();
  const voiceProvider = normalizeVoiceProvider(body.voiceProvider);
  const audience = normalizeAudience(body.audience);
  const marketSegment = normalizeMarketSegment(body.marketSegment);

  const next = structuredClone(manifest);
  next.audience = `${audience.label} - ${marketSegment.label}`;
  next.defaults = next.defaults || {};
  next.defaults.valueStatementIntensity = valueIntensity;
  next.defaults.audio = next.defaults.audio || {};
  next.defaults.audio.provider = voiceProvider;
  next.defaults.audio.voice = voice;
  next.context = next.context || {};
  next.context.company = company;
  next.context.preDemoNotes = preDemoNotes;
  next.context.audience = audience;
  next.context.marketSegment = marketSegment;
  next.context.audiencePlaybook = buildAudiencePlaybook(audience, marketSegment);
  next.context.setupPlan = inferSetupPlan({ topic, preDemoNotes, instructions }, company, audience, marketSegment);
  next.context.demoRequest = {
    topic,
    audience: audience.value,
    marketSegment: marketSegment.value,
    inputMode,
    source: inputModeSource(inputMode),
    instructions,
    learnedAt: new Date().toISOString(),
    instruction: "Use NetSuite navigation/search first, use standard reports for prospect-facing demos, and keep custom report links only as explicit fallbacks."
  };
  next.context.navigationPolicy = {
    preferred: ["NetSuite global search", "NetSuite navigation bar"],
    avoid: ["custom saved reports for prospect demos", "deep links unless used as fallback after a learned route"],
    reportPolicy: "Use standard NetSuite reports for prospect-facing demos unless the user explicitly asks for a custom report."
  };

  next.segments = next.segments.map((segment) => {
    if (segment.id === "open-pl") {
      return {
        ...segment,
        title: "Open The Standard Income Statement",
        objective: "Use NetSuite search/navigation to open a standard profitability report.",
        valueStatement: companyValueLine(company, "reporting"),
        narration: prospectTone(
          `${audience.narratorAngle} ${company.companyName ? `For ${company.companyName}, ` : ""}let's start where a finance leader usually wants to start: the standard income statement. This gives a quick view of revenue, margin, overheads, and net profit from one controlled place in NetSuite.`
        ),
        actions: [
          {
            type: "globalSearchOpen",
            query: "Income Statement",
            resultText: "Income Statement",
            fallbackUrl: "${baseUrl}/app/reporting/reportrunner.nl?cr=-316&reload=T",
            timeoutMs: 20000
          },
          { type: "waitForText", text: "Income Statement", timeoutMs: 20000 },
          { type: "highlightText", text: "Net Income", optional: true }
        ]
      };
    }

    if (segment.id === "pl-filters") {
      return {
        ...segment,
        valueStatement: companyValueLine(company, "filters"),
        narration: "Now let's look at how a team can change the lens. In the standard report, the most important controls are period, date range, subsidiary context, and accounting book.",
        actions: [
          { type: "highlightText", text: "Period" },
          { type: "highlightText", text: "From" },
          { type: "highlightText", text: "To" },
          { type: "highlightText", text: "Subsidiary Context" },
          { type: "highlightText", text: "Accounting Book 1" },
          { type: "highlightText", text: "Refresh" }
        ],
        verifications: [
          { type: "text", text: "Period" },
          { type: "text", text: "Subsidiary Context" },
          { type: "text", text: "Accounting Book" }
        ]
      };
    }

    if (segment.id === "pl-drilldown") {
      return {
        ...segment,
        actions: [
          { type: "highlightText", text: "View Detail", optional: true },
          { type: "clickText", text: "View Detail", optional: true },
          {
            type: "waitForAnyText",
            texts: ["Transaction", "Date", "Account", "Amount", "Document Number", "Transaction Type"],
            timeoutMs: 12000,
            optional: true
          },
          { type: "screenshot", name: "pl-drilldown" },
          {
            type: "globalSearchOpen",
            query: "Income Statement",
            resultText: "Income Statement",
            fallbackUrl: "${baseUrl}/app/reporting/reportrunner.nl?cr=-316&reload=T",
            timeoutMs: 20000
          },
          { type: "waitForText", text: "Income Statement", timeoutMs: 15000 }
        ]
      };
    }

    if (segment.id === "open-cash360-dashboard") {
      return {
        ...segment,
        actions: [
          {
            type: "globalSearchOpen",
            query: "Cash 360",
            resultText: "Cash 360 - Redirect",
            fallbackUrl: "${baseUrl}/spa-app/com.netsuite.cash360/cash360?whence=",
            timeoutMs: 25000
          },
          { type: "waitForText", text: "Cash 360 Dashboard", timeoutMs: 25000 },
          { type: "highlightText", text: "Cash Position" }
        ]
      };
    }

    return { ...segment, narration: prospectTone(segment.narration) };
  });

  return next;
}

function normalizeInputMode(value) {
  const mode = String(value || "").trim();
  if (["request-and-notes", "request-only", "notes-only"].includes(mode)) return mode;
  return "request-and-notes";
}

function inputModeSource(inputMode) {
  if (inputMode === "request-only") return "demo-request";
  if (inputMode === "notes-only") return "pre-demo-notes";
  return "demo-request-and-pre-demo-notes";
}

function notesForCompanyAnalysis(body) {
  return normalizeInputMode(body.inputMode) === "request-only" ? "" : body.preDemoNotes;
}

function normalizeVoiceProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  if (["say", "elevenlabs"].includes(provider)) return provider;
  return "say";
}

function inferDemoRequestFromNotes(preDemoNotes, company) {
  const notes = String(preDemoNotes || "");
  const priorities = company?.likelyPriorities || inferPriorities("", notes);
  const combined = `${notes}\n${priorities.join(" ")}`.toLowerCase();
  const focus = [];

  if (/(p&l|profit|loss|income statement|margin|revenue|expense|report)/.test(combined)) {
    focus.push("standard income statement and profitability reporting");
  }
  if (/(cash|forecast|working capital|payables|receivables|collections|liquidity)/.test(combined)) {
    focus.push("Cash 360 and working-capital visibility");
  }
  if (/(drill|audit|detail|transaction|trust|control)/.test(combined)) {
    focus.push("drilldown from summary to transaction detail");
  }
  if (/(export|excel|spreadsheet|manual|reconciliation)/.test(combined)) {
    focus.push("export options and fewer spreadsheet handoffs");
  }
  if (/(subsidiar|entity|consolidat|multi.?entity|global|international)/.test(combined)) {
    focus.push("subsidiary and consolidated finance views");
  }

  const defaultFocus = ["standard income statement, filters, drilldown, export, and Cash 360"];
  return `Generate a finance demo from the pre-demo notes. Focus on ${joinHuman(focus.length ? focus.slice(0, 4) : defaultFocus)}.`;
}

function normalizeAudience(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.includes("existing") || raw.includes("customer")) {
    return {
      value: "existing-customer",
      label: "Already existing customer",
      guideAngle: "Assume some NetSuite familiarity. Focus on underused capability, adoption expansion, cleaner process, and how the customer can get more from the platform without making the demo feel like a reimplementation.",
      narratorAngle: "For an existing NetSuite customer, anchor the story in improvement and expansion rather than first-time education."
    };
  }
  if (raw.includes("marketing")) {
    return {
      value: "marketing-audience",
      label: "Marketing audience",
      guideAngle: "Keep the story accessible, outcome-led, and polished. Avoid deep configuration detail. Use crisp proof points that can work for a broader audience and make the narrative easy to reuse in campaigns or events.",
      narratorAngle: "For a marketing audience, keep the narration crisp, visual, and outcome-led."
    };
  }
  return {
    value: "prospect",
    label: "Prospect",
    guideAngle: "Assume first-time NetSuite viewers. Build confidence quickly, avoid jargon, prove the main business outcomes first, and show enough detail to create trust without turning the meeting into a system walkthrough.",
    narratorAngle: "For a prospect, explain the business reason for each step before going into detail."
  };
}

function normalizeMarketSegment(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.includes("enterprise")) {
    return {
      value: "enterprise",
      label: "Enterprise",
      interests: [
        "global consolidation and multi-entity control",
        "governance, auditability, and segregation of duties",
        "standardized reporting across teams, books, and subsidiaries",
        "scalability without relying on manual spreadsheet processes"
      ],
      demoBias: "Lead with control, scale, governance, and trusted consolidated reporting. Keep the proof path executive enough for senior stakeholders, then drill down only to prove traceability."
    };
  }
  if (raw.includes("mid")) {
    return {
      value: "mid-market",
      label: "Mid-Market",
      interests: [
        "faster close and cleaner operational handoffs",
        "cash visibility without manual forecast workbooks",
        "standard reporting that scales beyond founder-led finance",
        "repeatable processes that reduce dependency on individual users"
      ],
      demoBias: "Lead with operational scale, month-end speed, cash visibility, and fewer manual handoffs. Show how standard NetSuite flows make the team more repeatable."
    };
  }
  return {
    value: "emerging",
    label: "Emerging",
    interests: [
      "quick visibility without heavy setup",
      "fewer spreadsheets and simpler finance routines",
      "clear cash and profitability signals",
      "a path to grow into stronger controls"
    ],
    demoBias: "Lead with simplicity, fast time-to-insight, and how NetSuite gives a growing business a controlled foundation without overwhelming the team."
  };
}

function buildAudiencePlaybook(audience, marketSegment) {
  const audienceTypeInterests = {
    "existing-customer": [
      "better use of capabilities they may already own",
      "process improvement and adoption expansion",
      "low-disruption ways to mature current NetSuite usage"
    ],
    "marketing-audience": [
      "crisp outcome-led proof points",
      "visual moments that work in a broader story",
      "less configuration depth and more reusable narrative"
    ],
    prospect: [
      "confidence that NetSuite can solve the core business pains",
      "clear first-time product orientation",
      "proof that summary reporting connects to real detail"
    ]
  };

  return {
    audienceType: audience.label,
    targetSegment: marketSegment.label,
    interests: [...(audienceTypeInterests[audience.value] || audienceTypeInterests.prospect), ...marketSegment.interests],
    demoBias: `${audience.guideAngle} ${marketSegment.demoBias}`
  };
}

function inferSetupPlan(source, company, audience, marketSegment) {
  const combined = `${source.topic || ""}\n${source.preDemoNotes || ""}\n${source.instructions || ""}`.toLowerCase();
  const requestedCreate = /(create|setup|set up|configure|build|prepare|seed|sample|demo data|test data|record|transaction|import|upload)/.test(combined);
  const items = [];

  const add = (type, label, reason, risk = "medium") => {
    if (!items.some((item) => item.label === label)) items.push({ type, label, reason, risk });
  };

  if (/(customer|client|prospect record)/.test(combined)) add("entity", "sample customer", "needed if the demo story should show customer-level activity or receivables");
  if (/(vendor|supplier)/.test(combined)) add("entity", "sample vendor", "needed if the story should show payables, bills, or supplier exposure");
  if (/(item|inventory|stock|sku|product)/.test(combined)) add("item", "sample item", "needed if operational transactions require item detail");
  if (/(invoice|receivable|a\/r|ar aging|collections)/.test(combined)) add("transaction", "sample customer invoice", "needed to demonstrate receivables, collections, and cash inflow", "high");
  if (/(bill|payable|a\/p|ap aging|supplier invoice)/.test(combined)) add("transaction", "sample vendor bill", "needed to demonstrate payables, approvals, and cash outflow", "high");
  if (/(sales order|order to cash|order-to-cash)/.test(combined)) add("transaction", "sample sales order", "needed to demonstrate future inflow or order-to-cash context", "high");
  if (/(purchase order|procure to pay|procure-to-pay)/.test(combined)) add("transaction", "sample purchase order", "needed to demonstrate future outflow or procure-to-pay context", "high");
  if (/(bank|cash account|account category|cash 360|forecast category)/.test(combined)) add("configuration", "Cash 360 account/category setup", "needed if Cash 360 requires specific accounts, categories, or forecast assumptions");
  if (/(subsidiary|entity|consolidat|multi.?entity)/.test(combined)) add("configuration", "subsidiary or entity demo context", "needed to demonstrate multi-entity filtering or consolidation");
  if (/(saved search|dashboard|kpi|portlet|report customization)/.test(combined)) add("configuration", "demo dashboard/search/report view", "needed if the demo requires a prepared view beyond standard reports");
  if (/(role|permission|approval|workflow|segregation)/.test(combined)) add("configuration", "role/permission or approval setup", "needed if the story requires controls, approvals, or role-based access", "high");

  const needsSetup = requestedCreate || items.length > 0;
  return {
    needsSetup,
    status: needsSetup ? "setup-may-be-required" : "read-only-demo-ready",
    accountCreateWarning: "Creating records or configuration in NetSuite can affect the connected account. Always confirm the exact account, role, and records before executing.",
    items,
    promptInstruction: needsSetup
      ? "Use the generated Codex prompt to inspect the account, confirm front-end and back-end access, identify gaps, and create only the approved demo data/configuration."
      : "No create-in-account prep was detected. Keep the demo read-only unless the SC explicitly adds setup requirements."
  };
}

function prospectTone(text) {
  return text.replace(/\bI will\b/g, "we'll").replace(/\bI\b/g, "we");
}

async function analyseCompany(companyUrl, preDemoNotes = "") {
  const url = normalizeCompanyUrl(companyUrl);
  const notes = String(preDemoNotes || "");
  const fallback = {
    companyName: url ? new URL(url).hostname.replace(/^www\./, "") : "The prospect",
    url,
    title: "",
    description: "",
    likelyPriorities: inferPriorities("", notes),
    industrySignals: inferIndustrySignals("", notes),
    source: url ? "url-unavailable" : "notes-only"
  };

  if (!url) return fallback;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 NetSuiteDemoPrep/0.1"
      }
    });
    clearTimeout(timeout);
    if (!response.ok) return fallback;
    const html = await response.text();
    const title = extractTag(html, "title");
    const description = extractMetaDescription(html);
    const text = htmlToText(html).slice(0, 12000);
    const combined = `${title}\n${description}\n${text}`;
    return {
      companyName: deriveCompanyName(title, url),
      url,
      title,
      description,
      likelyPriorities: inferPriorities(combined, notes),
      industrySignals: inferIndustrySignals(combined, notes),
      source: "company-website"
    };
  } catch {
    return fallback;
  }
}

function normalizeCompanyUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function extractTag(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeHtml(match?.[1] || "").trim();
}

function extractMetaDescription(html) {
  const match = html.match(/<meta\s+[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*>/i);
  return decodeHtml(match?.[1] || "").trim();
}

function htmlToText(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  ).trim();
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function deriveCompanyName(title, url) {
  const cleanTitle = String(title || "")
    .split("|")[0]
    .split(" - ")[0]
    .replace(/\b(home|homepage|official site)\b/gi, "")
    .trim();
  if (cleanTitle && cleanTitle.length <= 70) return cleanTitle;
  return new URL(url).hostname.replace(/^www\./, "");
}

function inferIndustrySignals(text, notes) {
  const combined = `${text}\n${notes}`.toLowerCase();
  const signals = [];
  if (/(manufactur|factory|production|plant|supply chain|warehouse|inventory|distribution)/.test(combined)) signals.push("manufacturing, inventory, or distribution complexity");
  if (/(professional services|consulting|agency|project|client service|billable)/.test(combined)) signals.push("project or services profitability");
  if (/(subscription|saas|software|recurring|renewal)/.test(combined)) signals.push("recurring revenue and renewals");
  if (/(global|international|countries|subsidiar|multi.?entity|group)/.test(combined)) signals.push("multi-entity or international reporting");
  if (/(retail|commerce|e.?commerce|store|consumer)/.test(combined)) signals.push("commerce and order flow");
  if (/(regulated|compliance|audit|risk|public sector|healthcare|financial services)/.test(combined)) signals.push("compliance, auditability, and controls");
  return signals.length ? signals : ["financial visibility and operational control"];
}

function inferPriorities(text, notes) {
  const combined = `${text}\n${notes}`.toLowerCase();
  const priorities = new Set(["trusted reporting", "cash visibility", "drilldown from summary to detail"]);
  if (/(spreadsheet|excel|manual|reconciliation|close|month end|month-end)/.test(combined)) priorities.add("faster close with fewer spreadsheets");
  if (/(global|international|subsidiar|consolidat|multi.?entity|group)/.test(combined)) priorities.add("multi-entity consolidation");
  if (/(inventory|warehouse|supply chain|distribution|stock|fulfillment)/.test(combined)) priorities.add("inventory and supply chain visibility");
  if (/(project|billable|utilization|client|services)/.test(combined)) priorities.add("project profitability");
  if (/(cash|working capital|collections|payables|receivables)/.test(combined)) priorities.add("cash forecasting and working capital control");
  if (/(audit|compliance|controls|approval|risk)/.test(combined)) priorities.add("auditability and control");
  return Array.from(priorities).slice(0, 7);
}

function companyValueLine(company, theme) {
  const name = company.companyName || "The prospect";
  const priorities = company.likelyPriorities || [];
  if (theme === "filters") {
    return `${name} can re-run the same standard report by period, subsidiary, and accounting book, which supports ${joinHuman(priorities.slice(0, 2)) || "faster finance decisions"}.`;
  }
  return `${name} gets a fast, trusted performance view that connects directly to ${joinHuman(priorities.slice(0, 2)) || "the finance questions leadership cares about"}.`;
}

function joinHuman(items) {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function accountContext(manifest) {
  const baseUrl = manifest.context?.baseUrl || "";
  let host = "";
  let account = "";
  try {
    const url = new URL(baseUrl);
    host = url.host;
    account = url.hostname.split(".")[0] || "";
  } catch {}

  return {
    account: account || "unknown-account",
    host: host || "unknown-host",
    role: manifest.context?.role || "unknown role",
    baseUrl: baseUrl || "unknown URL"
  };
}

function setupPromptPayload(manifest) {
  const account = accountContext(manifest);
  const setupPlan = manifest.context?.setupPlan || inferSetupPlan({
    topic: manifest.context?.demoRequest?.topic,
    preDemoNotes: manifest.context?.preDemoNotes,
    instructions: manifest.context?.demoRequest?.instructions
  }, manifest.context?.company || {}, normalizeAudience(manifest.context?.audience?.value), normalizeMarketSegment(manifest.context?.marketSegment?.value));
  const prompt = generateSetupPrompt(manifest, account, setupPlan);

  return {
    account,
    setupPlan,
    prompt,
    promptPreview: prompt.split("\n").slice(0, 18).join("\n")
  };
}

function generateSetupPrompt(manifest, account, setupPlan) {
  const company = manifest.context?.company || {};
  const audience = manifest.context?.audience || normalizeAudience(manifest.context?.demoRequest?.audience);
  const marketSegment = manifest.context?.marketSegment || normalizeMarketSegment(manifest.context?.demoRequest?.marketSegment);
  const playbook = manifest.context?.audiencePlaybook || buildAudiencePlaybook(audience, marketSegment);
  const items = setupPlan.items?.length
    ? setupPlan.items.map((item, index) => `${index + 1}. ${item.label} (${item.type}, ${item.risk} risk): ${item.reason}`).join("\n")
    : "No create-in-account prep items were inferred. Keep the account read-only unless the SC explicitly approves new setup items.";

  return `You are preparing a NetSuite demo account for NetSuite Demo Helper.

CRITICAL ACCESS AND SAFETY RULES
- Before creating or editing anything, verify that you have both front-end browser access and back-end NetSuite access for this account.
- Front-end access means the browser is logged in and can navigate NetSuite UI pages.
- Back-end access means you can inspect or create the required records/configuration through an appropriate NetSuite backend path, such as SuiteScript, REST, saved imports, or another approved administrative mechanism.
- If either front-end or back-end access is missing, stop and report what access is missing.
- Confirm the visible NetSuite account and role before doing any write action.
- Do not create, edit, save, approve, post, delete, import, or submit anything until the user has confirmed the exact items below.

TARGET NETSUITE ACCOUNT
- Account: ${account.account}
- Host: ${account.host}
- Base URL: ${account.baseUrl}
- Role: ${account.role}

DEMO CONTEXT
- Company/prospect: ${company.companyName || "The prospect"}
- Audience type: ${audience.label}
- Target segment: ${marketSegment.label}
- Audience interests: ${playbook.interests?.join(", ") || "trusted reporting and cash visibility"}
- Demo request: ${manifest.context?.demoRequest?.topic || "Not provided"}
- Demo input mode: ${manifest.context?.demoRequest?.inputMode || "request-and-notes"}

REQUESTED OR INFERRED SETUP ITEMS
${items}

TASK
1. Open or use the existing NetSuite browser session for the target account.
2. Confirm the visible account, role, and logged-in state.
3. Inspect whether the setup items already exist.
4. Produce a short gap list: existing, missing, risky, and not required.
5. Ask for confirmation before creating anything.
6. After confirmation, create only the approved demo data/configuration.
7. Prefer standard NetSuite objects and standard reports.
8. Avoid custom reports unless explicitly required by the approved setup.
9. When finished, summarize exactly what was created, where it can be found, and what demo segment uses it.
`;
}

async function writeScGuide(manifest, body, company) {
  const guide = generateScGuide(manifest, body, company);
  await mkdir(path.dirname(scGuidePath), { recursive: true });
  await writeFile(scGuidePath, guide, "utf8");
  const archiveDir = path.join(projectRoot, "artifacts/sc-guides");
  await mkdir(archiveDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  await writeFile(path.join(archiveDir, `${stamp}-${companyFileSlug(company)}-sc-guide.md`), guide, "utf8");
  return guide;
}

function generateScGuide(manifest, body, company) {
  const instructions = String(body.instructions || "").trim() || defaultScInstructions();
  const notes = String(body.preDemoNotes || "").trim() || "No additional pre-demo notes were provided.";
  const companyName = company.companyName || "The prospect";
  const audience = normalizeAudience(body.audience || manifest.context?.audience?.value || manifest.context?.demoRequest?.audience || manifest.audience);
  const marketSegment = normalizeMarketSegment(body.marketSegment || manifest.context?.marketSegment?.value || manifest.context?.demoRequest?.marketSegment);
  const playbook = manifest.context?.audiencePlaybook || buildAudiencePlaybook(audience, marketSegment);
  const setupPlan = manifest.context?.setupPlan || inferSetupPlan({
    topic: manifest.context?.demoRequest?.topic,
    preDemoNotes: manifest.context?.preDemoNotes,
    instructions
  }, company, audience, marketSegment);
  const account = accountContext(manifest);
  const inputModeLabels = {
    "request-and-notes": "Demo request and pre-demo notes",
    "request-only": "Demo request only",
    "notes-only": "Pre-demo notes only"
  };
  const inputMode = inputModeLabels[normalizeInputMode(manifest.context?.demoRequest?.inputMode)] || inputModeLabels["request-and-notes"];
  const priorities = company.likelyPriorities || [];
  const signals = company.industrySignals || [];
  const segments = manifest.segments || [];

  return `# SC Demo Guide: ${companyName}

## Demo Thesis

Show how NetSuite helps ${companyName} move from trusted standard reporting into cash visibility, drilldown, and action. Lead with the outcomes most likely to matter: ${joinHuman(priorities.slice(0, 4)) || "visibility, control, and speed"}.

## Audience Angle

- Selected audience: ${audience.label}
- Target segment: ${marketSegment.label}
- Demo input: ${inputMode}
- Demo angle: ${playbook.demoBias}
- Likely interests: ${playbook.interests.join(", ")}

## Personalized Demo Story

Open the demo as a story about ${companyName || "the prospect"} getting from uncertain finance visibility to a more controlled way of running performance and cash. Start with the standard income statement because it is familiar, then prove that the number is trusted by showing filters and drilldown. Move from profitability into Cash 360 so the audience sees that NetSuite is not only reporting history, but helping the finance team manage what happens next.

For a ${marketSegment.label.toLowerCase()} ${audience.label.toLowerCase()} audience, keep the story anchored in ${joinHuman(playbook.interests.slice(0, 3))}. Use the first screen to build confidence, the middle of the demo to prove control, and the Cash 360 section to create the "this changes our operating rhythm" moment.

## Tips And Tricks For The SC

- Name the business reason before each click. The click is proof, not the story.
- Use the search bar and standard navigation so the flow feels natural and repeatable.
- If the audience asks for detail, drill once, then come back to the executive view.
- Keep custom reporting out of the main path unless the customer explicitly asks for it.
- For ${marketSegment.label.toLowerCase()} teams, emphasize ${joinHuman(marketSegment.interests.slice(0, 2))}.
- For ${audience.label.toLowerCase()}, frame the proof around ${audience.guideAngle}
- If setup data is missing, pause and use the NetSuite prep prompt instead of improvising live.

## SC Instructions

${instructions
  .split("\n")
  .map((line) => `- ${line.trim()}`)
  .join("\n")}

## Company Context

- Website: ${company.url || "Not provided"}
- Website signal: ${company.description || company.title || "No website summary available"}
- Likely priorities: ${priorities.join(", ") || "trusted reporting, cash visibility, drilldown"}
- Industry signals: ${signals.join(", ") || "financial visibility and operational control"}

## Pre-Demo Notes

${notes}

## NetSuite Prep And Creation Plan

- Target account: ${account.account} (${account.host})
- Role: ${account.role}
- Setup status: ${setupPlan.status}
- Safety note: ${setupPlan.accountCreateWarning}

${setupPlan.items?.length
  ? setupPlan.items.map((item) => `- ${item.label}: ${item.reason} (${item.risk} risk)`).join("\n")
  : "- No create-in-account prep items were inferred. Keep this demo read-only unless the SC explicitly adds setup requirements."}

Use the setup prompt in the app if these items need to be created. It always requires front-end browser access, back-end NetSuite access, account confirmation, and approval before writes.

## Light Demo Script For The SC

${segments
  .map((segment, index) => {
    const navigation = (segment.actions || [])
      .filter((action) => ["globalSearchOpen", "goto", "clickText", "clickRole"].includes(action.type))
      .map(describeNavigationAction)
      .filter(Boolean)
      .join(" -> ") || "Stay on the current view";
    return `${index + 1}. ${segment.title}
   - Show: ${segment.objective || segment.title}
   - Why it matters: ${segment.valueStatement}
   - Navigation: ${navigation}
   - Talk track: ${segment.narration}`;
  })
  .join("\n\n")}

## Discovery Hooks During The Demo

- "Is this the level of reporting your finance team starts with today?"
- "Where do teams currently go when someone challenges a number?"
- "How often does cash forecasting live outside the ERP?"
- "Which view would your CFO want first: consolidated performance, entity-level detail, or working capital?"
`;
}

function describeNavigationAction(action) {
  if (action.query) return `Search: ${action.query}`;
  if (action.text) return action.text;
  if (action.name) return action.name;
  const url = action.url || "";
  if (url.includes("#/forecast-table")) return "Open Cash 360 forecast";
  if (url.includes("#/preference")) return "Open Cash 360 preferences";
  if (url.includes("cash360")) return "Open Cash 360";
  if (url.includes("reportrunner")) return "Open standard report";
  return url;
}

async function listVoices(provider = "say") {
  if (normalizeVoiceProvider(provider) === "elevenlabs") {
    return listElevenLabsVoices();
  }

  const output = await collectProcess("say", ["-v", "?"]).catch(() => "");
  const preferred = new Set([
    "Moira",
    "Samantha",
    "Karen",
    "Tessa",
    "Kathy",
    "Shelley (English (UK))",
    "Shelley (English (US))",
    "Sandy (English (UK))",
    "Sandy (English (US))"
  ]);
  const voices = output
    .split("\n")
    .map((line) => line.match(/^(.+?)\s{2,}([a-z]{2}_[A-Z]{2})\s+#\s*(.*)$/))
    .filter(Boolean)
    .map((match) => ({ name: match[1].trim(), locale: match[2], sample: match[3].trim() }))
    .filter((voice) => voice.locale.startsWith("en_") && preferred.has(voice.name));

  const localVoices = voices.length ? voices : [
    { name: "Moira", locale: "en_IE", sample: "Hello! My name is Moira." },
    { name: "Samantha", locale: "en_US", sample: "Hello! My name is Samantha." }
  ];

  return {
    provider: "say",
    providerLabel: "Local Mac narrator",
    configured: true,
    voices: localVoices.map((voice) => ({ id: voice.name, provider: "say", ...voice }))
  };
}

async function listElevenLabsVoices() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return {
      provider: "elevenlabs",
      providerLabel: "ElevenLabs cloud narrator",
      configured: false,
      message: "Add ELEVENLABS_API_KEY before starting the app to use cloud voices.",
      voices: fallbackElevenLabsVoices()
    };
  }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey }
    });
    if (!response.ok) throw new Error(await response.text());
    const payload = await response.json();
    const voices = (payload.voices || [])
      .filter((voice) => voice.voice_id && voice.name)
      .map((voice) => ({
        id: voice.voice_id,
        name: voice.name,
        locale: "cloud",
        provider: "elevenlabs",
        sample: voice.description || "ElevenLabs cloud voice"
      }));
    return {
      provider: "elevenlabs",
      providerLabel: "ElevenLabs cloud narrator",
      configured: true,
      voices: voices.length ? voices : fallbackElevenLabsVoices()
    };
  } catch (error) {
    return {
      provider: "elevenlabs",
      providerLabel: "ElevenLabs cloud narrator",
      configured: false,
      message: `Could not load ElevenLabs voices: ${error.message}`,
      voices: fallbackElevenLabsVoices()
    };
  }
}

function fallbackElevenLabsVoices() {
  return [
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", locale: "cloud", provider: "elevenlabs", sample: "Clear, friendly cloud narrator" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", locale: "cloud", provider: "elevenlabs", sample: "Warm, expressive cloud narrator" }
  ];
}

async function playVoiceSample(body) {
  const voice = String(body.voice || "Moira").trim();
  const provider = normalizeVoiceProvider(body.voiceProvider);
  const line = String(body.line || "Let's show how NetSuite gives finance teams a clearer view of performance and cash.").trim();
  if (provider === "elevenlabs") {
    await speakWithElevenLabs(line, voice);
  } else {
    await collectProcess("say", ["-v", voice, "-r", "175", line]);
  }
  return { ok: true, provider, voice };
}

async function executeSetupPrompt(body = {}) {
  if (!body.confirmed) throw new Error("Confirm the NetSuite account and setup items before executing.");

  const manifest = await readManifest();
  const payload = setupPromptPayload(manifest);
  const expectedAccount = payload.account.account;
  if (body.account && body.account !== expectedAccount) {
    throw new Error(`Account mismatch. Expected ${expectedAccount}, got ${body.account}.`);
  }

  const promptDir = path.join(projectRoot, "artifacts/codex-prompts");
  await mkdir(promptDir, { recursive: true });
  const promptFile = path.join(promptDir, `${companyFileSlug(manifest)}-netsuite-setup-prompt.md`);
  await writeFile(promptFile, payload.prompt, "utf8");

  await copyToClipboard(payload.prompt).catch(() => {});
  const browserOpened = await openNetSuiteBrowserDetached().catch((error) => ({ ok: false, error: error.message }));
  const codexOpened = await openCodexWorkspace().catch((error) => ({ ok: false, error: error.message }));

  return {
    ok: true,
    promptFile,
    account: payload.account,
    items: payload.setupPlan.items || [],
    browserOpened,
    codexOpened,
    message: "Setup prompt created and copied to clipboard. NetSuite and Codex were opened where possible; paste the prompt into a new Codex session before executing."
  };
}

function openNetSuiteBrowserDetached() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", "--open-browser"], {
      cwd: projectRoot,
      detached: true,
      stdio: "ignore"
    });
    child.on("error", reject);
    child.unref();
    resolve({ ok: true });
  });
}

function openCodexWorkspace() {
  const command = process.env.CODEX_BIN
    || (os.platform() === "darwin" ? "/Applications/Codex.app/Contents/Resources/codex" : "codex");

  return new Promise((resolve, reject) => {
    const child = spawn(command, ["app", projectRoot], { cwd: projectRoot, detached: true, stdio: "ignore" });
    child.on("error", reject);
    child.unref();
    resolve({ ok: true });
  });
}

function copyToClipboard(text) {
  const command = os.platform() === "win32" ? "clip.exe" : "pbcopy";
  return new Promise((resolve, reject) => {
    const child = spawn(command, [], { cwd: projectRoot });
    child.on("error", reject);
    child.stdin.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ ok: true });
      else reject(new Error(`${command} exited with code ${code}`));
    });
    child.stdin.end(text);
  });
}

async function speakWithElevenLabs(text, voiceId) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ElevenLabs needs ELEVENLABS_API_KEY. Create a free ElevenLabs API key, stop the app, set the key, and start it again.");

  const audioDir = path.join(projectRoot, "artifacts/audio");
  await mkdir(audioDir, { recursive: true });
  const file = path.join(audioDir, `sample-${Date.now()}.mp3`);
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "xi-api-key": apiKey,
      accept: "audio/mpeg"
    },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
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
  await collectProcess("afplay", [file]);
}

function collectProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot });
    let output = "";
    let errorOutput = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { errorOutput += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(errorOutput || `${command} exited with code ${code}`));
    });
  });
}

async function runCommand(body) {
  const mode = body.mode || "dry";
  const valueIntensity = body.valueIntensity || "balanced";
  const voice = body.voice || "Moira";
  const voiceProvider = normalizeVoiceProvider(body.voiceProvider);
  const commands = {
    open: ["node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", "--open-browser"]],
    dry: ["node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", "--dry-run", "--audio=none", `--value-intensity=${valueIntensity}`]],
    rehearse: ["node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", "--rehearse", "--audio=none", `--value-intensity=${valueIntensity}`]],
    live: ["node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", `--audio=${voiceProvider}`, `--value-intensity=${valueIntensity}`, `--voice=${voice}`]]
  };
  const command = commands[mode];
  if (!command) throw new Error(`Unknown run mode: ${mode}`);
  return runProcess(command[0], command[1]);
}

function runProcess(command, args) {
  return new Promise((resolve) => {
    if (currentRun) {
      resolve({ ok: false, code: 1, log: "A demo is already running. Stop it before starting another run." });
      return;
    }

    const child = spawn(command, args, { cwd: projectRoot, detached: true });
    let log = "";
    currentRun = {
      child,
      command: [command, ...args].join(" "),
      startedAt: new Date().toISOString(),
      stopped: false
    };

    child.stdout.on("data", (chunk) => { log += chunk.toString(); });
    child.stderr.on("data", (chunk) => { log += chunk.toString(); });
    child.on("close", (code, signal) => {
      const stopped = currentRun?.child === child ? currentRun.stopped : false;
      if (currentRun?.child === child) currentRun = null;
      const stopText = stopped ? "\nStopped by user.\n" : "";
      resolve({ ok: code === 0 || stopped, code, signal, stopped, log: `${log}${stopText}` });
    });
  });
}

function runState() {
  return {
    running: Boolean(currentRun),
    command: currentRun?.command || null,
    startedAt: currentRun?.startedAt || null
  };
}

function stopCurrentRun() {
  if (!currentRun) return { ok: true, stopped: false, message: "No demo is currently running." };

  currentRun.stopped = true;
  const child = currentRun.child;
  void writeFile(narratorStatePath, JSON.stringify({
    speaking: false,
    segmentId: "stopped",
    segmentTitle: "Stopped",
    text: "The demo run was stopped.",
    voice: "Moira",
    updatedAt: new Date().toISOString()
  }, null, 2)).catch(() => {});
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {}
  }

  setTimeout(() => {
    if (currentRun?.child === child) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        try {
          child.kill("SIGKILL");
        } catch {}
      }
    }
  }, 2500).unref();

  return { ok: true, stopped: true, message: "Stop requested." };
}

function json(response, payload, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function sendFile(response, filePath, contentType) {
  try {
    const data = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${path.basename(filePath)}"`
    });
    response.end(data);
  } catch {
    json(response, { ok: false, error: "Export the SC guide to Word first." }, 404);
  }
}

function presenterAvatarHtml(id) {
  return `<div id="${id}" class="presenter-avatar" aria-hidden="true">
            <div class="hair-back"></div>
            <div class="neck"></div>
            <div class="shoulders"></div>
            <div class="head">
              <div class="hair-front"></div>
              <span class="brow brow-left"></span>
              <span class="brow brow-right"></span>
              <span class="eye eye-left"></span>
              <span class="eye eye-right"></span>
              <span class="nose"></span>
              <span class="mouth"></span>
            </div>
          </div>`;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function html(response) {
  response.writeHead(200, { "content-type": "text/html" });
  response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NetSuite Demo Helper</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #18212f;
      --muted: #5f6d7a;
      --line: #d8dee6;
      --soft: #f4f7fa;
      --accent: #007a7a;
      --accent-dark: #075f5f;
      --danger: #9f2d20;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: #ffffff;
    }
    header {
      border-bottom: 1px solid var(--line);
      padding: 18px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    h1 { margin: 0; font-size: 20px; font-weight: 700; }
    main {
      display: grid;
      grid-template-columns: minmax(340px, 430px) minmax(0, 1fr);
      min-height: calc(100vh - 66px);
    }
    aside {
      border-right: 1px solid var(--line);
      background: var(--soft);
      padding: 20px;
      overflow: auto;
    }
    section {
      padding: 20px;
      overflow: auto;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 650;
      margin: 16px 0 7px;
    }
    textarea, select, input {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px 11px;
      font: inherit;
      background: #fff;
      color: var(--ink);
    }
    textarea { resize: vertical; min-height: 92px; }
    #manifestEditor {
      min-height: 64vh;
      font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .segmented {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    .segment-option {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 9px 8px;
      background: #fff;
      text-align: center;
      cursor: pointer;
      font-size: 13px;
      font-weight: 700;
    }
    .segment-option input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .segment-option:has(input:checked) {
      border-color: var(--accent);
      background: #eaf7f7;
      color: var(--accent-dark);
    }
    button {
      border: 1px solid var(--accent);
      background: var(--accent);
      color: white;
      border-radius: 6px;
      padding: 9px 12px;
      font-weight: 700;
      cursor: pointer;
    }
    button.secondary {
      background: white;
      color: var(--accent-dark);
    }
    button.danger {
      border-color: var(--danger);
      background: white;
      color: var(--danger);
    }
    button:disabled { opacity: .55; cursor: wait; }
    .help-tooltip {
      position: fixed;
      z-index: 1000;
      max-width: 280px;
      padding: 9px 10px;
      border-radius: 6px;
      background: #18212f;
      color: white;
      box-shadow: 0 10px 24px rgba(24, 33, 47, .22);
      font-size: 12px;
      line-height: 1.35;
      opacity: 0;
      pointer-events: none;
      transform: translateY(4px);
      transition: opacity .14s ease, transform .14s ease;
    }
    .help-tooltip.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .hint {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
      margin: 8px 0 0;
    }
    .band {
      border-top: 1px solid var(--line);
      padding-top: 16px;
      margin-top: 18px;
    }
    .status {
      white-space: pre-wrap;
      background: #101820;
      color: #dce7ef;
      border-radius: 6px;
      padding: 12px;
      min-height: 120px;
      max-height: 280px;
      overflow: auto;
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      border-bottom: 1px solid var(--line);
      padding: 10px 20px;
      background: #fff;
    }
    .tab {
      background: white;
      color: var(--accent-dark);
      border-color: var(--line);
    }
    .tab.active {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
    }
    .screen { display: none; padding: 20px; }
    .screen.active { display: block; }
    .grid {
      display: grid;
      grid-template-columns: minmax(320px, .8fr) minmax(420px, 1.2fr);
      gap: 18px;
    }
    .panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
      background: white;
    }
    .panel h2 {
      margin: 0 0 10px;
      font-size: 17px;
    }
    .steps {
      display: grid;
      grid-template-columns: repeat(6, minmax(120px, 1fr));
      gap: 10px;
      margin-top: 10px;
    }
    .step {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px;
      min-height: 92px;
      background: #fbfcfd;
    }
    .step strong {
      display: block;
      font-size: 13px;
      margin-bottom: 5px;
    }
    .step span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .full { grid-column: 1 / -1; }
    .narrator-card {
      display: grid;
      grid-template-columns: 152px minmax(0, 1fr);
      gap: 18px;
      align-items: center;
    }
    .presenter-avatar {
      width: 138px;
      height: 172px;
      border-radius: 8px;
      background: linear-gradient(180deg, #f5fbfc 0%, #e8f1f3 100%);
      border: 1px solid #d8e5e8;
      position: relative;
      overflow: hidden;
      box-shadow: inset 0 -20px 34px rgba(24, 33, 47, .08);
    }
    .presenter-avatar::before {
      content: "";
      position: absolute;
      inset: 10px 10px auto;
      height: 2px;
      border-radius: 999px;
      background: rgba(255, 255, 255, .75);
    }
    .presenter-avatar .hair-back {
      position: absolute;
      width: 78px;
      height: 104px;
      left: 30px;
      top: 14px;
      border-radius: 38px 38px 26px 26px;
      background: linear-gradient(160deg, #4a2b26 0%, #2c1917 68%);
      box-shadow: 0 8px 12px rgba(24, 33, 47, .14);
    }
    .presenter-avatar .neck {
      position: absolute;
      width: 30px;
      height: 28px;
      left: 54px;
      top: 92px;
      background: #e9b49e;
      border-radius: 0 0 12px 12px;
      z-index: 2;
    }
    .presenter-avatar .shoulders {
      position: absolute;
      width: 118px;
      height: 64px;
      left: 10px;
      bottom: -10px;
      border-radius: 44px 44px 0 0;
      background: linear-gradient(135deg, #153f4b 0%, #0e2b36 100%);
      z-index: 1;
    }
    .presenter-avatar .shoulders::before {
      content: "";
      position: absolute;
      width: 42px;
      height: 54px;
      left: 38px;
      top: 10px;
      clip-path: polygon(14% 0, 86% 0, 100% 100%, 0 100%);
      background: #f7fbfb;
    }
    .presenter-avatar .shoulders::after {
      content: "";
      position: absolute;
      width: 2px;
      height: 42px;
      left: 58px;
      top: 18px;
      background: rgba(255, 255, 255, .55);
    }
    .presenter-avatar .head {
      position: absolute;
      width: 68px;
      height: 82px;
      left: 35px;
      top: 27px;
      border-radius: 30px 30px 32px 32px;
      background: linear-gradient(145deg, #f7c7b0 0%, #e7aa92 100%);
      z-index: 3;
      box-shadow: 0 6px 12px rgba(24, 33, 47, .12);
      transform-origin: 50% 100%;
    }
    .presenter-avatar .head::before,
    .presenter-avatar .head::after {
      content: "";
      position: absolute;
      width: 11px;
      height: 18px;
      top: 33px;
      border-radius: 50%;
      background: #e8ad96;
      z-index: -1;
    }
    .presenter-avatar .head::before { left: -7px; }
    .presenter-avatar .head::after { right: -7px; }
    .presenter-avatar .hair-front {
      position: absolute;
      width: 68px;
      height: 33px;
      left: 0;
      top: -5px;
      border-radius: 30px 30px 16px 18px;
      background: linear-gradient(155deg, #5a342e 0%, #2e1917 72%);
    }
    .presenter-avatar .hair-front::after {
      content: "";
      position: absolute;
      width: 30px;
      height: 30px;
      right: 2px;
      top: 4px;
      border-radius: 0 28px 0 28px;
      background: #2c1917;
      transform: rotate(-9deg);
    }
    .presenter-avatar .brow {
      position: absolute;
      width: 15px;
      height: 3px;
      top: 35px;
      border-radius: 8px;
      background: #3c251f;
    }
    .presenter-avatar .brow-left { left: 14px; transform: rotate(-4deg); }
    .presenter-avatar .brow-right { right: 14px; transform: rotate(4deg); }
    .presenter-avatar .eye {
      position: absolute;
      width: 8px;
      height: 8px;
      top: 42px;
      border-radius: 50%;
      background: #17212b;
      box-shadow: 0 0 0 2px rgba(255, 255, 255, .25);
    }
    .presenter-avatar .eye-left { left: 18px; }
    .presenter-avatar .eye-right { right: 18px; }
    .presenter-avatar .nose {
      position: absolute;
      width: 8px;
      height: 15px;
      left: 30px;
      top: 47px;
      border-radius: 7px;
      border-right: 2px solid rgba(134, 73, 60, .45);
    }
    .presenter-avatar .mouth {
      position: absolute;
      width: 24px;
      height: 7px;
      left: 22px;
      top: 65px;
      border-radius: 0 0 18px 18px;
      background: #8d3f3f;
      overflow: hidden;
      transform-origin: 50% 50%;
    }
    .presenter-avatar .mouth::before {
      content: "";
      position: absolute;
      width: 18px;
      height: 3px;
      left: 3px;
      top: 0;
      border-radius: 0 0 8px 8px;
      background: rgba(255, 255, 255, .86);
    }
    .presenter-avatar.speaking {
      box-shadow: 0 0 0 8px rgba(0, 122, 122, .12), inset 0 -20px 34px rgba(24, 33, 47, .08);
    }
    .presenter-avatar.speaking .head {
      animation: presenter-nod 1.7s infinite ease-in-out;
    }
    .presenter-avatar.speaking .mouth {
      animation: avatar-talk .2s infinite alternate ease-in-out;
    }
    .presenter-avatar:not(.speaking) .eye {
      animation: blink 5.5s infinite;
    }
    @keyframes presenter-nod {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      50% { transform: translateY(2px) rotate(.8deg); }
    }
    @keyframes avatar-talk {
      from { height: 5px; border-radius: 10px; transform: scaleX(.9); }
      to { height: 15px; border-radius: 0 0 18px 18px; transform: scaleX(1.08); }
    }
    @keyframes blink {
      0%, 94%, 100% { transform: scaleY(1); }
      96% { transform: scaleY(.12); }
    }
    .voice-wave {
      display: flex;
      align-items: end;
      gap: 4px;
      height: 24px;
      margin-top: 8px;
    }
    .voice-wave span {
      width: 5px;
      height: 8px;
      border-radius: 4px;
      background: var(--accent);
      opacity: .35;
    }
    .speaking + div .voice-wave span,
    #runAvatar.speaking + div .voice-wave span {
      animation: wave .65s infinite ease-in-out;
      opacity: .9;
    }
    .voice-wave span:nth-child(2) { animation-delay: .08s; }
    .voice-wave span:nth-child(3) { animation-delay: .16s; }
    .voice-wave span:nth-child(4) { animation-delay: .24s; }
    .voice-wave span:nth-child(5) { animation-delay: .32s; }
    @keyframes wave {
      0%, 100% { height: 7px; }
      50% { height: 22px; }
    }
    #scGuide {
      min-height: 68vh;
      font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    #setupPrompt {
      min-height: 280px;
      font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    @media (max-width: 880px) {
      main { grid-template-columns: 1fr; }
      .grid { grid-template-columns: 1fr; }
      .steps { grid-template-columns: 1fr 1fr; }
      aside { border-right: 0; border-bottom: 1px solid var(--line); }
    }
  </style>
</head>
<body>
  <header>
    <h1>NetSuite Demo Helper</h1>
  </header>
  <nav class="tabs" aria-label="Workspace screens">
    <button class="tab active" data-tab="prep" data-help="Set up the audience, company context, demo input, notes, voice, and demo value emphasis.">Prep</button>
    <button class="tab" data-tab="manifest" data-help="Review or edit the detailed automation manifest that drives the demo.">Manifest</button>
    <button class="tab" data-tab="guide" data-help="Review the personalized SC demo story, setup prompt, and export it to Word.">SC Guide</button>
    <button class="tab" data-tab="run" data-help="Open NetSuite, dry run, rehearse, run the live demo, or stop an active run.">Run</button>
  </nav>
  <main>
    <section class="screen active" id="screen-prep">
      <div class="grid">
        <div class="panel">
          <h2>SC Demo Instructions</h2>
          <label for="instructions">What the demo generator should always do and avoid</label>
          <textarea id="instructions" style="min-height:145px">${escapeHtml(defaultScInstructions())}</textarea>
        </div>

        <div class="panel">
          <h2>Prospect Context</h2>
          <label for="audience">Audience</label>
          <select id="audience">
            <option value="existing-customer">Already existing customer</option>
            <option value="prospect" selected>Prospect</option>
            <option value="marketing-audience">Marketing audience</option>
          </select>

          <label>Target segment</label>
          <div class="segmented" id="marketSegmentGroup">
            <label class="segment-option"><input type="radio" name="marketSegment" value="emerging">Emerging</label>
            <label class="segment-option"><input type="radio" name="marketSegment" value="mid-market" checked>Mid-Market</label>
            <label class="segment-option"><input type="radio" name="marketSegment" value="enterprise">Enterprise</label>
          </div>

          <label for="companyUrl">Company website</label>
          <input id="companyUrl" placeholder="https://www.example.com">

          <label for="inputMode">Demo generation input</label>
          <select id="inputMode">
            <option value="request-and-notes" selected>Use demo request and pre-demo notes</option>
            <option value="request-only">Use demo request only</option>
            <option value="notes-only">Use pre-demo notes only</option>
          </select>

          <label for="topic">Demo request</label>
          <textarea id="topic" style="min-height:135px">Finance demo for a prospect: standard income statement, filters, drilldown, export, and Cash 360.</textarea>

          <label for="preDemoNotes">Pre-demo notes</label>
          <textarea id="preDemoNotes" style="min-height:170px" placeholder="Paste discovery notes, pain points, role notes, current systems, concerns, and success criteria."></textarea>
        </div>

        <div class="panel">
          <h2>Narrator Voice</h2>
          <label for="voiceProvider">Narration engine</label>
          <select id="voiceProvider">
            <option value="say" selected>Local Mac voice</option>
            <option value="elevenlabs">ElevenLabs cloud voice (free account/API key)</option>
          </select>
          <p class="hint" id="voiceProviderHint">Local voices work without an API key. Cloud voices need ELEVENLABS_API_KEY when starting the app.</p>

          <label for="voiceSelect">Voice</label>
          <select id="voiceSelect"></select>
          <div class="row" style="margin-top:10px">
            <button class="secondary" id="sampleVoice" data-help="Plays a short sample line using the selected local narrator voice.">Play Sample</button>
          </div>

          <label for="intensity">Demo value emphasis</label>
          <select id="intensity">
            <option value="light">Light: add value points at major transitions only</option>
            <option value="balanced" selected>Balanced: add value points on main pages and sections</option>
            <option value="heavy">Heavy: add value points throughout the demo</option>
          </select>
          <p class="hint">Controls how often the generated demo connects what is shown to business value for the audience.</p>
        </div>

        <div class="panel narrator-card">
          ${presenterAvatarHtml("avatar")}
          <div>
            <h2 id="narratorName">Narrator</h2>
            <p class="hint" id="narratorSegment">Ready</p>
            <p id="narratorLine">The narrator is ready.</p>
            <div class="voice-wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
          </div>
        </div>

        <div class="panel full">
          <div class="row">
            <button id="learn" data-help="Checks the company website, applies your instructions and notes, then creates a fresh manifest and SC guide.">Learn / Create Demo</button>
            <button class="secondary" id="reload" data-help="Reloads the latest saved manifest and guide without changing anything.">Reload</button>
          </div>
          <p class="hint">This checks the company site, combines it with your notes and instructions, then creates both the editable manifest and a lighter SC guide.</p>
        </div>

        <div class="panel full">
          <h2>How NetSuite Demo Helper Works</h2>
          <p class="hint">The tool uses Codex as the reasoning layer to interpret the SC instructions, company context, demo request, and notes, then turns that into demo-ready assets.</p>
          <p class="hint">Current version: local prototype. Target version: standalone NSDemoHelper desktop app for Mac and Windows, with GitHub release-based update checks.</p>
          <div class="steps">
            <div class="step"><strong>1. Prep</strong><span>You choose the audience, input mode, voice, and demo value emphasis.</span></div>
            <div class="step"><strong>2. Interpret</strong><span>Codex-style logic reads the company site and notes to infer likely ERP priorities.</span></div>
            <div class="step"><strong>3. Generate</strong><span>The helper creates an editable manifest with navigation, narration, proof points, and safe actions.</span></div>
            <div class="step"><strong>4. Guide</strong><span>It also creates a lighter SC guide that a consultant can use manually.</span></div>
            <div class="step"><strong>5. Rehearse</strong><span>Dry runs and rehearsals check routes, timing, screenshots, and cache useful information.</span></div>
            <div class="step"><strong>6. Run</strong><span>The final demo drives NetSuite and narrates the story with the selected voice engine.</span></div>
          </div>
        </div>
      </div>
    </section>

    <section class="screen" id="screen-manifest">
      <div class="row">
        <button id="save" data-help="Saves the JSON currently shown in the manifest editor.">Save Manifest</button>
        <button class="secondary" id="reloadManifest" data-help="Reloads the saved manifest from disk and discards unsaved editor changes.">Reload Manifest</button>
      </div>
      <label for="manifestEditor">Editable manifest</label>
      <textarea id="manifestEditor" spellcheck="false"></textarea>
      <div class="band">
        <label for="versions">Earlier versions</label>
        <div class="row">
          <select id="versions"></select>
          <button class="secondary" id="restore" data-help="Restores the selected earlier manifest version after saving a backup of the current one.">Restore Selected</button>
        </div>
      </div>
    </section>

    <section class="screen" id="screen-guide">
      <div class="row">
        <button class="secondary" id="refreshGuide" data-help="Reloads the latest SC guide text generated by the helper.">Refresh Guide</button>
        <button id="exportGuide" data-help="Creates a Word document version of the SC guide and downloads it.">Export To Word</button>
      </div>
      <label for="scGuide">Personalized SC demo story and guide</label>
      <textarea id="scGuide" spellcheck="false" readonly></textarea>
      <div class="band">
        <h2>NetSuite Setup Prompt</h2>
        <p class="hint" id="setupAccountSummary">Target account will appear after a demo is generated.</p>
        <p class="hint" id="setupItemSummary">Setup items will appear here when the helper detects data or configuration that may need to be created.</p>
        <label for="setupPrompt">Prompt for Codex account setup</label>
        <textarea id="setupPrompt" spellcheck="false" readonly></textarea>
        <div class="row" style="margin-top:10px">
          <button id="executeSetupPrompt" data-help="After confirmation, opens the NetSuite browser, copies the setup prompt, and opens Codex for the account setup handoff.">Execute Now</button>
        </div>
      </div>
    </section>

    <section class="screen" id="screen-run">
      <div class="grid">
        <div class="panel">
          <h2>Run Controls</h2>
          <div class="row">
            <button class="secondary" id="openBrowser" data-help="Opens or reuses the NetSuite browser session so you can sign in before running the demo.">Open NetSuite Browser</button>
            <button class="secondary" data-run="dry" data-help="Checks the planned demo steps without controlling NetSuite or playing audio.">Dry Run</button>
            <button class="secondary" data-run="rehearse" data-help="Runs the browser flow without narration so pages, timing, and screenshots can be prepared.">Rehearse</button>
            <button data-run="live" data-help="Runs the full NetSuite automation with narrator audio using the selected voice.">Live Demo</button>
            <button class="danger" id="stopRun" disabled data-help="Stops the currently running demo automation.">Stop</button>
          </div>
          <p class="hint">Rehearse first. Then use Live Demo when the manifest and SC guide look right.</p>
        </div>

        <div class="panel narrator-card">
          ${presenterAvatarHtml("runAvatar")}
          <div>
            <h2>Virtual Narrator</h2>
            <p class="hint" id="runNarratorSegment">Ready</p>
            <p id="runNarratorLine">The narrator is ready.</p>
            <div class="voice-wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
          </div>
        </div>

        <div class="panel full">
          <label>Output</label>
          <div id="status" class="status">Ready.</div>
        </div>
      </div>
    </section>
  </main>
  <div id="buttonHelpTooltip" class="help-tooltip" role="tooltip"></div>
  <script>
    const editor = document.getElementById("manifestEditor");
    const statusBox = document.getElementById("status");
    const versions = document.getElementById("versions");
    const scGuide = document.getElementById("scGuide");
    const setupPrompt = document.getElementById("setupPrompt");
    const setupAccountSummary = document.getElementById("setupAccountSummary");
    const setupItemSummary = document.getElementById("setupItemSummary");
    const voiceSelect = document.getElementById("voiceSelect");
    const voiceProviderSelect = document.getElementById("voiceProvider");
    const voiceProviderHint = document.getElementById("voiceProviderHint");
    const audienceSelect = document.getElementById("audience");
    const inputModeSelect = document.getElementById("inputMode");
    const topicField = document.getElementById("topic");
    const preDemoNotesField = document.getElementById("preDemoNotes");
    const buttonHelpTooltip = document.getElementById("buttonHelpTooltip");
    let runInProgress = false;
    let latestSetupPrompt = null;
    let helpTimer = null;
    let helpTarget = null;

    async function api(path, options = {}) {
      const response = await fetch(path, {
        ...options,
        headers: { "content-type": "application/json", ...(options.headers || {}) }
      });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Request failed");
      return payload;
    }

    async function apiWithLog(path, options = {}) {
      const response = await fetch(path, {
        ...options,
        headers: { "content-type": "application/json", ...(options.headers || {}) }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Request failed");
      return payload;
    }

    function setStatus(text) {
      statusBox.textContent = text;
    }

    function setBusy(isBusy) {
      document.querySelectorAll("button").forEach((button) => {
        if (button.id === "stopRun") {
          button.disabled = !runInProgress;
        } else {
          button.disabled = isBusy;
        }
      });
    }

    function hideButtonHelp() {
      clearTimeout(helpTimer);
      helpTimer = null;
      helpTarget = null;
      buttonHelpTooltip.classList.remove("visible");
    }

    function scheduleButtonHelp(button) {
      const text = button?.dataset?.help;
      if (!text) return;
      clearTimeout(helpTimer);
      helpTarget = button;
      helpTimer = setTimeout(() => {
        if (helpTarget !== button || !document.body.contains(button)) return;
        buttonHelpTooltip.textContent = text;
        buttonHelpTooltip.classList.add("visible");
        const rect = button.getBoundingClientRect();
        const margin = 10;
        const top = Math.min(window.innerHeight - buttonHelpTooltip.offsetHeight - margin, rect.bottom + 10);
        const centeredLeft = rect.left + rect.width / 2 - buttonHelpTooltip.offsetWidth / 2;
        const left = Math.max(margin, Math.min(centeredLeft, window.innerWidth - buttonHelpTooltip.offsetWidth - margin));
        buttonHelpTooltip.style.left = left + "px";
        buttonHelpTooltip.style.top = top + "px";
      }, 1800);
    }

    document.addEventListener("mouseover", (event) => {
      const button = event.target.closest?.("button[data-help]");
      if (button) scheduleButtonHelp(button);
    });

    document.addEventListener("mousemove", (event) => {
      const button = event.target.closest?.("button[data-help]");
      if (button && button !== helpTarget) scheduleButtonHelp(button);
      if (!button && helpTarget) hideButtonHelp();
    });

    document.addEventListener("mouseout", (event) => {
      const button = event.target.closest?.("button[data-help]");
      if (button && (!event.relatedTarget || !button.contains(event.relatedTarget))) hideButtonHelp();
    });

    document.addEventListener("focusin", (event) => {
      const button = event.target.closest?.("button[data-help]");
      if (button) scheduleButtonHelp(button);
    });

    document.addEventListener("focusout", hideButtonHelp);
    document.addEventListener("scroll", hideButtonHelp, true);

    function render(payload) {
      editor.value = JSON.stringify(payload.manifest, null, 2);
      scGuide.value = payload.guide || "";
      renderSetupPrompt(payload.setupPrompt);
      if (payload.manifest) {
        setAudience(payload.manifest.context?.audience?.value || payload.manifest.context?.demoRequest?.audience || payload.manifest.audience);
        setMarketSegment(payload.manifest.context?.marketSegment?.value || payload.manifest.context?.demoRequest?.marketSegment || "mid-market");
        inputModeSelect.value = payload.manifest.context?.demoRequest?.inputMode || "request-and-notes";
        const manifestVoiceProvider = payload.manifest.defaults?.audio?.provider || "say";
        if (voiceProviderSelect.value !== manifestVoiceProvider) {
          voiceProviderSelect.value = manifestVoiceProvider;
          loadVoices(payload.manifest.defaults?.audio?.voice);
        }
        document.getElementById("intensity").value = payload.manifest.defaults?.valueStatementIntensity || "balanced";
        if (payload.manifest.defaults?.audio?.voice && voiceSelect.options.length) {
          voiceSelect.value = payload.manifest.defaults.audio.voice;
        }
        if (payload.manifest.context?.demoRequest?.instructions) {
          document.getElementById("instructions").value = payload.manifest.context.demoRequest.instructions;
        }
        if (payload.manifest.context?.demoRequest?.topic) {
          topicField.value = inputModeSelect.value === "notes-only" ? "" : payload.manifest.context.demoRequest.topic;
        }
        if (payload.manifest.context?.company?.url) {
          document.getElementById("companyUrl").value = payload.manifest.context.company.url;
        }
        if (payload.manifest.context?.preDemoNotes) {
          preDemoNotesField.value = payload.manifest.context.preDemoNotes;
        }
        syncInputMode();
      }
      versions.innerHTML = "";
      for (const file of payload.versions || []) {
        const option = document.createElement("option");
        option.value = file;
        option.textContent = file;
        versions.appendChild(option);
      }
    }

    function setAudience(value) {
      const raw = String(value || "").toLowerCase();
      if (raw.includes("existing") || raw.includes("customer")) {
        audienceSelect.value = "existing-customer";
      } else if (raw.includes("marketing")) {
        audienceSelect.value = "marketing-audience";
      } else {
        audienceSelect.value = "prospect";
      }
    }

    function setMarketSegment(value) {
      const normalized = String(value || "").toLowerCase();
      const target = normalized.includes("enterprise")
        ? "enterprise"
        : normalized.includes("emerging")
          ? "emerging"
          : "mid-market";
      const input = document.querySelector('input[name="marketSegment"][value="' + target + '"]');
      if (input) input.checked = true;
    }

    function selectedMarketSegment() {
      return document.querySelector('input[name="marketSegment"]:checked')?.value || "mid-market";
    }

    function renderSetupPrompt(payload) {
      latestSetupPrompt = payload || null;
      if (!payload) {
        setupPrompt.value = "";
        setupAccountSummary.textContent = "Target account will appear after a demo is generated.";
        setupItemSummary.textContent = "Setup items will appear here when the helper detects data or configuration that may need to be created.";
        return;
      }

      const account = payload.account || {};
      const items = payload.setupPlan?.items || [];
      setupPrompt.value = payload.prompt || "";
      setupAccountSummary.textContent = "Target account: " + (account.account || "unknown") + " | Host: " + (account.host || "unknown") + " | Role: " + (account.role || "unknown");
      setupItemSummary.textContent = items.length
        ? "Potential create/setup items: " + items.map((item) => item.label).join(", ")
        : "No create-in-account prep items were inferred. Keep this demo read-only unless setup requirements are added.";
    }

    function syncInputMode() {
      if (inputModeSelect.value === "notes-only") {
        if (!topicField.disabled && topicField.value.trim()) topicField.dataset.previousTopic = topicField.value;
        topicField.value = "";
        topicField.disabled = true;
        topicField.placeholder = "The helper will infer the demo request from the pre-demo notes.";
        preDemoNotesField.disabled = false;
        preDemoNotesField.placeholder = "Paste discovery notes, pain points, role notes, current systems, concerns, and success criteria.";
        if (!preDemoNotesField.value.trim() && preDemoNotesField.dataset.previousNotes) preDemoNotesField.value = preDemoNotesField.dataset.previousNotes;
      } else if (inputModeSelect.value === "request-only") {
        topicField.disabled = false;
        topicField.placeholder = "";
        if (!topicField.value.trim() && topicField.dataset.previousTopic) topicField.value = topicField.dataset.previousTopic;
        if (!preDemoNotesField.disabled && preDemoNotesField.value.trim()) preDemoNotesField.dataset.previousNotes = preDemoNotesField.value;
        preDemoNotesField.value = "";
        preDemoNotesField.disabled = true;
        preDemoNotesField.placeholder = "This mode uses the demo request only.";
      } else {
        topicField.disabled = false;
        topicField.placeholder = "";
        if (!topicField.value.trim() && topicField.dataset.previousTopic) topicField.value = topicField.dataset.previousTopic;
        preDemoNotesField.disabled = false;
        preDemoNotesField.placeholder = "Paste discovery notes, pain points, role notes, current systems, concerns, and success criteria.";
        if (!preDemoNotesField.value.trim() && preDemoNotesField.dataset.previousNotes) preDemoNotesField.value = preDemoNotesField.dataset.previousNotes;
      }
    }

    inputModeSelect.onchange = syncInputMode;
    voiceProviderSelect.onchange = () => loadVoices();

    async function load() {
      render(await api("/api/manifest"));
    }

    async function loadVoices(preferredVoice = "") {
      const provider = voiceProviderSelect.value || "say";
      const payload = await api("/api/voices?provider=" + encodeURIComponent(provider));
      voiceSelect.innerHTML = "";
      for (const voice of payload.voices || []) {
        const option = document.createElement("option");
        option.value = voice.id || voice.name;
        option.textContent = voice.name + " (" + voice.locale + ")";
        voiceSelect.appendChild(option);
      }
      voiceProviderHint.textContent = payload.message || (provider === "elevenlabs"
        ? "Cloud voices use ElevenLabs. Add ELEVENLABS_API_KEY before starting the app to enable samples and live narration."
        : "Local voices work without an API key.");
      const values = Array.from(voiceSelect.options).map((option) => option.value);
      if (preferredVoice && values.includes(preferredVoice)) {
        voiceSelect.value = preferredVoice;
      } else if (provider === "say" && values.includes("Moira")) {
        voiceSelect.value = "Moira";
      }
    }

    async function loadGuide() {
      const payload = await api("/api/sc-guide");
      scGuide.value = payload.guide || "";
      const setupPayload = await api("/api/setup-prompt");
      renderSetupPrompt(setupPayload.setupPrompt);
    }

    document.querySelectorAll(".tab").forEach((button) => {
      button.onclick = () => {
        document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
        document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
        button.classList.add("active");
        document.getElementById("screen-" + button.dataset.tab).classList.add("active");
      };
    });

    document.getElementById("reload").onclick = async () => { await load(); await loadGuide(); };
    document.getElementById("reloadManifest").onclick = load;
    document.getElementById("refreshGuide").onclick = loadGuide;
    document.getElementById("executeSetupPrompt").onclick = async () => {
      if (!latestSetupPrompt) {
        setStatus("Create a demo first so the setup prompt can be generated.");
        return;
      }

      const account = latestSetupPrompt.account || {};
      const items = latestSetupPrompt.setupPlan?.items || [];
      const itemText = items.length ? items.map((item) => item.label).join(", ") : "no inferred create items";
      const confirmed = window.confirm(
        "Are you sure you want to prepare Codex to create/setup these in this NetSuite account?\\n\\n" +
        "Account: " + (account.account || "unknown") + "\\n" +
        "Host: " + (account.host || "unknown") + "\\n" +
        "Role: " + (account.role || "unknown") + "\\n\\n" +
        "Items: " + itemText + "\\n\\n" +
        "The prompt will still require Codex to confirm front-end and back-end access before any write action."
      );
      if (!confirmed) return;

      setBusy(true);
      try {
        const payload = await api("/api/execute-setup-prompt", {
          method: "POST",
          body: JSON.stringify({
            confirmed: true,
            account: account.account
          })
        });
        setStatus(payload.message + "\\nPrompt file: " + payload.promptFile);
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(false);
      }
    };
    document.getElementById("exportGuide").onclick = async () => {
      setBusy(true);
      try {
        const payload = await api("/api/export-guide-docx", { method: "POST", body: "{}" });
        setStatus("Word guide exported: " + payload.path);
        window.location.href = payload.downloadUrl;
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(false);
      }
    };
    document.getElementById("save").onclick = async () => {
      setBusy(true);
      try {
        const payload = await api("/api/manifest", {
          method: "POST",
          body: JSON.stringify({ manifest: editor.value })
        });
        render(payload);
        setStatus("Manifest saved.");
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(false);
      }
    };

    document.getElementById("learn").onclick = async () => {
      setBusy(true);
      try {
        setStatus("Checking company context and creating demo assets...");
        const payload = await api("/api/learn", {
          method: "POST",
          body: JSON.stringify({
            topic: document.getElementById("topic").value,
            inputMode: inputModeSelect.value,
            audience: audienceSelect.value,
            marketSegment: selectedMarketSegment(),
            instructions: document.getElementById("instructions").value,
            companyUrl: document.getElementById("companyUrl").value,
            preDemoNotes: preDemoNotesField.value,
            valueIntensity: document.getElementById("intensity").value,
            voiceProvider: voiceProviderSelect.value,
            voice: voiceSelect.value
          })
        });
        render(payload);
        scGuide.value = payload.guide || "";
        setStatus("Manifest and SC guide created. Review the Manifest and SC Guide tabs before rehearsal.");
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(false);
      }
    };

    document.getElementById("sampleVoice").onclick = async () => {
      setBusy(true);
      try {
        await api("/api/voice-sample", {
          method: "POST",
          body: JSON.stringify({
            voice: voiceSelect.value,
            voiceProvider: voiceProviderSelect.value,
            line: "Let's show how NetSuite gives finance teams a clearer view of performance and cash."
          })
        });
        setStatus("Played sample voice: " + voiceSelect.value);
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(false);
      }
    };

    document.getElementById("openBrowser").onclick = () => run("open");
    document.getElementById("stopRun").onclick = async () => {
      try {
        const payload = await api("/api/stop", { method: "POST", body: "{}" });
        setStatus(payload.message || "Stop requested.");
      } catch (error) {
        setStatus(error.message);
      }
    };

    document.querySelectorAll("[data-run]").forEach((button) => {
      button.onclick = () => run(button.dataset.run);
    });

    async function run(mode) {
      runInProgress = true;
      setBusy(true);
      setStatus("Running " + mode + "...");
      try {
        const payload = await apiWithLog("/api/run", {
          method: "POST",
          body: JSON.stringify({
            mode,
            valueIntensity: document.getElementById("intensity").value,
            voiceProvider: voiceProviderSelect.value,
            voice: voiceSelect.value
          })
        });
        const prefix = payload.ok ? "" : "Run stopped with an error. Details:\\n\\n";
        setStatus(prefix + (payload.log || "Done."));
      } catch (error) {
        setStatus(error.message);
      } finally {
        runInProgress = false;
        setBusy(false);
      }
    }

    document.getElementById("restore").onclick = async () => {
      if (!versions.value) return;
      setBusy(true);
      try {
        const payload = await api("/api/restore", {
          method: "POST",
          body: JSON.stringify({ file: versions.value })
        });
        render(payload);
        setStatus("Restored " + versions.value);
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(false);
      }
    };

    async function pollNarrator() {
      try {
        const state = await api("/api/narrator-state");
        const speaking = Boolean(state.speaking);
        document.getElementById("avatar").classList.toggle("speaking", speaking);
        document.getElementById("runAvatar").classList.toggle("speaking", speaking);
        document.getElementById("narratorName").textContent = "Narrator: " + (state.voice || voiceSelect.value || "Moira");
        document.getElementById("narratorSegment").textContent = state.segmentTitle || "Ready";
        document.getElementById("runNarratorSegment").textContent = state.segmentTitle || "Ready";
        document.getElementById("narratorLine").textContent = state.text || "The narrator is ready.";
        document.getElementById("runNarratorLine").textContent = state.text || "The narrator is ready.";
      } catch {}
    }

    (async () => {
      await loadVoices();
      await load();
      await loadGuide();
      await pollNarrator();
      setInterval(pollNarrator, 1500);
    })().catch((error) => setStatus(error.message));
  </script>
</body>
</html>`);
}

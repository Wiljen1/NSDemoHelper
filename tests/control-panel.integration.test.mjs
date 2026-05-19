import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { draftPrepPayload, projectRoot, requestJson, startTestServer, stopTestServer } from "./helpers.mjs";

let server;
let manifestBackup;
let cmsAdminBackup;
let cmsSessionsBackup;
let cmsContentBackup;
const mainManifestPath = path.join(projectRoot, "manifests/finance-pl-cash360.demo.json");
const cmsAdminPath = path.join(projectRoot, ".auth/cms-admin.json");
const cmsSessionsPath = path.join(projectRoot, ".auth/cms-sessions.json");
const cmsContentPath = path.join(projectRoot, "artifacts/cms/content.json");

before(async () => {
  manifestBackup = await readFile(mainManifestPath, "utf8");
  cmsAdminBackup = await readOptionalFile(cmsAdminPath);
  cmsSessionsBackup = await readOptionalFile(cmsSessionsPath);
  cmsContentBackup = await readOptionalFile(cmsContentPath);
  await rm(cmsAdminPath, { force: true });
  await rm(cmsSessionsPath, { force: true });
  await rm(cmsContentPath, { force: true });
  server = await startTestServer();
});

after(async () => {
  await stopTestServer(server);
  if (manifestBackup) await writeFile(mainManifestPath, manifestBackup, "utf8");
  await restoreOptionalFile(cmsAdminPath, cmsAdminBackup);
  await restoreOptionalFile(cmsSessionsPath, cmsSessionsBackup);
  await restoreOptionalFile(cmsContentPath, cmsContentBackup);
});

describe("NetSuite Demo Helper control panel", () => {
  it("serves the main UI with the streamlined tabs and run controls", async () => {
    const response = await fetch(server.baseUrl);
    assert.equal(response.status, 200);
    const html = await response.text();

    for (const expected of [
      "NetSuite Demo Helper",
      ">Prep<",
      ">SC Guide<",
      ">Demo Intelligence<",
      ">Pre-Demo Intelligence<",
      ">Dry-Run<",
      ">Dataset Analysis<",
      ">Run<",
      ">Admin<",
      "Pre-demo scoring",
      "Last loaded: not yet",
      "Button/API JSON Instructions",
      "Dry-Run Prep",
      "Run Dataset Analysis",
      "Buffer Dry-Run",
      "Live Demo"
    ]) {
      assert.match(html, new RegExp(escapeRegExp(expected)));
    }

    assert.doesNotMatch(html, /Refresh Guide/);
    assert.doesNotMatch(html, /Open NetSuite Browser/);
    assert.doesNotMatch(html, /Rehearse \+ Prep Account/);
    assert.ok(html.indexOf(">Pre-Demo Intelligence<") < html.indexOf(">Demo Intelligence<"));
    assert.match(html, /Create Dry-Run From Prompt/);
    assert.doesNotMatch(html, /Create Manifest From SC Guide/);
    assert.doesNotMatch(html, /data-page-loaded="prep"/);
    assert.doesNotMatch(html, /data-page-loaded="run"/);
    assert.doesNotMatch(html, /data-page-loaded="admin"/);
    assert.match(html, /data-page-loaded="guide"/);
    assert.match(html, /data-page-loaded="dataset"/);
    assert.match(html, /\.page-load-info\.stale/);
  });

  it("detects the Codex backbone through the configured runtime", async () => {
    const payload = await requestJson(server, "/api/codex/status");
    assert.equal(payload.ok, true);
    assert.equal(payload.available, true);
    assert.match(payload.version, /fake-codex/);
    assert.equal(payload.mode, "background-operator");
  });

  it("returns narrator voices without requiring a cloud API key", async () => {
    const payload = await requestJson(server, "/api/voices", {
      method: "POST",
      body: JSON.stringify({ provider: "elevenlabs", apiKey: "" })
    });

    assert.equal(payload.provider, "elevenlabs");
    assert.equal(payload.requiresApiKey, true);
    assert.equal(payload.configured, false);
    assert.ok(Array.isArray(payload.voices));
    assert.ok(payload.voices.length > 0);
  });

  it("scores current Prep page draft input without saving a new manifest", async () => {
    const payload = await requestJson(server, "/api/intelligence", {
      method: "POST",
      body: JSON.stringify(draftPrepPayload({
        preDemoNotes: `Draft ${Date.now()}: missing success metrics, countries, current ERP, and stakeholder priorities.`
      }))
    });

    assert.equal(payload.ok, true);
    assert.equal(payload.draft, true);
    assert.equal(payload.intelligence.intelligence_generated_by, "codex-structured-json");
    assert.equal(payload.preDemoIntelligence.source, "codex-structured-json");
    assert.equal(payload.intelligence.demo_readiness_score, 82);
    assert.equal(payload.intelligence.pre_demo_notes_analyzer.overall_score, 67);
    assert.ok(payload.intelligence.discovery_gap_analyzer.missing_discovery_items.includes("Success metrics"));
  });

  it("scores pre-demo notes with the Codex pre-demo operator without running full demo intelligence", async () => {
    const payload = await requestJson(server, "/api/pre-demo-intelligence", {
      method: "POST",
      body: JSON.stringify(draftPrepPayload({
        preDemoNotes: "Prospect notes: finance stakeholder, Access ERP, Jedox consolidation, integration concerns, local GAAP, e-invoicing, and project profitability. Missing success metrics and timeline."
      }))
    });

    assert.equal(payload.ok, true);
    assert.equal(payload.draft, true);
    assert.equal(payload.preDemoIntelligence.source, "codex-pre-demo-structured-json");
    assert.ok(payload.preDemoIntelligence.codex_pre_demo_operator);
    assert.ok(Number.isFinite(payload.preDemoIntelligence.overall_score));
    assert.ok(Array.isArray(payload.preDemoIntelligence.heatmap));
    assert.ok(Array.isArray(payload.preDemoIntelligence.recommended_follow_up_questions));
  });

  it("reuses the saved Pre-Demo website context when generating Demo Intelligence", async () => {
    const companyUrl = `${server.baseUrl}/synthetic-company-page`;
    const preDemo = await requestJson(server, "/api/pre-demo-intelligence", {
      method: "POST",
      body: JSON.stringify(draftPrepPayload({
        companyUrl,
        preDemoNotes: "Discovery notes mention finance consolidation, SuiteProjects, approvals, and missing success metrics."
      }))
    });

    assert.notEqual(preDemo.preDemoIntelligence.website_context.source, "pre-demo-intelligence-required");

    const demo = await requestJson(server, "/api/intelligence", {
      method: "POST",
      body: JSON.stringify(draftPrepPayload({
        companyUrl,
        preDemoNotes: "Updated notes mention finance consolidation, SuiteProjects, approvals, and missing country scope."
      }))
    });

    assert.equal(demo.ok, true);
    assert.equal(demo.intelligence.website_context.url, companyUrl);
    assert.equal(demo.intelligence.website_context.source, preDemo.preDemoIntelligence.website_context.source);
    assert.notEqual(demo.intelligence.website_context.source, "pre-demo-intelligence-required");
  });

  it("generates and exports pre-demo discovery follow-up questions", async () => {
    const generated = await requestJson(server, "/api/intelligence/follow-up-questions", {
      method: "POST",
      body: JSON.stringify(draftPrepPayload({
        preDemoNotes: "Need sharper discovery on success metrics, countries, current ERP, and stakeholder priorities.",
        additionalComments: "Focus questions on what would change the demo path."
      }))
    });

    assert.equal(generated.ok, true);
    assert.match(generated.questions, /Discovery Follow-Up Questions|Which success metrics/);
    assert.equal(generated.operator, "codex-background-operator");
    assert.ok(generated.preDemoIntelligence);

    const exported = await requestJson(server, "/api/export-follow-up-questions-docx", {
      method: "POST",
      body: JSON.stringify(draftPrepPayload({
        additionalComments: "Use these in the next discovery call.",
        questionsMarkdown: generated.questions,
        preDemoIntelligence: generated.preDemoIntelligence
      }))
    });

    assert.equal(exported.ok, true);
    assert.match(exported.downloadUrl, /discovery-follow-up-questions\.docx/);
    const response = await fetch(`${server.baseUrl}${exported.downloadUrl}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("exports downloadable button/API instruction JSON files", async () => {
    const catalog = await requestJson(server, "/api/button-instructions");
    assert.equal(catalog.ok, true);
    assert.ok(catalog.buttons.length > 20);
    assert.ok(catalog.buttons.some((button) => button.id === "learn-create-demo"));
    assert.ok(catalog.buttons.some((button) => button.id === "refresh-dry-run-creation-prompt"));
    assert.ok(catalog.buttons.some((button) => button.id === "refresh-pre-demo-scoring"));
    assert.ok(catalog.buttons.some((button) => button.id === "export-discovery-followups"));
    assert.ok(catalog.buttons.some((button) => button.id === "run-dataset-analysis"));
    assert.ok(catalog.buttons.some((button) => button.id === "execute-dataset-prompt"));

    const exported = await requestJson(server, "/api/button-instructions/export", {
      method: "POST",
      body: "{}"
    });
    assert.equal(exported.ok, true);
    assert.ok(exported.files.some((file) => file.file === "index.json"));

    const response = await fetch(`${server.baseUrl}/api/button-instructions/download/learn-create-demo.json`);
    assert.equal(response.status, 200);
    const filePayload = await response.json();
    assert.equal(filePayload.id, "learn-create-demo");
    assert.equal(filePayload.endpoint, "/api/learn");
    assert.equal(filePayload.requestBodyExample.createRunnableManifest, false);
  });

  it("hides and blocks live demo functionality when the admin feature flag is off", async () => {
    const status = await requestJson(server, "/api/cms/status");
    let cookie = "";
    if (status.setupRequired) {
      const setupResponse = await fetch(`${server.baseUrl}/api/cms/setup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "VeryStrongPassword123!" })
      });
      assert.equal(setupResponse.status, 200);
      cookie = setupResponse.headers.get("set-cookie") || "";
    }

    const disabled = await requestJson(server, "/api/cms/feature-flags", {
      method: "POST",
      headers: cookie ? { cookie } : {},
      body: JSON.stringify({ liveDemoFunctionality: false })
    });
    assert.equal(disabled.featureFlags.liveDemoFunctionality, false);

    const html = await (await fetch(server.baseUrl)).text();
    assert.match(html, /live-demo-disabled/);
    assert.match(html, /id="demoIntelligenceAiActions" data-live-demo-only/);
    const catalog = await requestJson(server, "/api/button-instructions");
    assert.ok(!catalog.buttons.some((button) => button.id === "learn-create-demo-dry-run"));
    assert.ok(!catalog.buttons.some((button) => button.id === "live-demo"));

    const runResponse = await fetch(`${server.baseUrl}/api/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "dry" })
    });
    assert.equal(runResponse.status, 403);
    const runPayload = await runResponse.json();
    assert.equal(runPayload.ok, false);
    assert.match(runPayload.error, /Live demo functionality is switched off/);

    const learnResponse = await fetch(`${server.baseUrl}/api/learn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draftPrepPayload({ createRunnableManifest: true }))
    });
    assert.equal(learnResponse.status, 403);

    const enabled = await requestJson(server, "/api/cms/feature-flags", {
      method: "POST",
      headers: cookie ? { cookie } : {},
      body: JSON.stringify({ liveDemoFunctionality: true })
    });
    assert.equal(enabled.featureFlags.liveDemoFunctionality, true);
  });

  it("loads the manifest payload with guide, setup prompt, and Intelligence", async () => {
    const payload = await requestJson(server, "/api/manifest");

    assert.ok(payload.manifest);
    assert.ok(payload.guide);
    assert.ok(payload.guideOutputs);
    assert.ok(payload.guideOutputs.dryRunCreationPrompt);
    assert.equal(payload.guideOutputs.dryRunCreationPromptSource, "system-generated-from-sc-story-runbook");
    assert.match(payload.guideOutputs.dryRunCreationPrompt, /generated after the Personalized Demo Story And Runbook/i);
    assert.ok(payload.setupPrompt);
    assert.equal(payload.setupPrompt.promptSource, "system-generated-from-sc-story-runbook");
    assert.match(payload.setupPrompt.prompt, /Personalized Demo Story And Runbook has been completed/i);
    assert.ok(payload.intelligence);
    assert.ok(payload.preDemoIntelligence);
    assert.equal(payload.intelligence.intelligence_generated_by, "codex-structured-json");
    assert.equal(payload.preDemoIntelligence.source, "codex-structured-json");
  });

  it("refreshes the dry-run creation prompt metadata used by Run page actions", async () => {
    const payload = await requestJson(server, "/api/dry-run-prompt/refresh", {
      method: "POST",
      body: "{}"
    });

    assert.equal(payload.ok, true);
    assert.ok(payload.manifest.context.dryRunCreationPrompt.createdAt);
    assert.ok(payload.manifest.context.dryRunCreationPrompt.promptHash);
    assert.ok(payload.guideOutputs.dryRunCreationPrompt);
    assert.equal(payload.guideOutputs.dryRunCreationPromptIsCurrent, true);
    assert.equal(payload.guideOutputs.dryRunCreationPromptCreatedAt, payload.manifest.context.dryRunCreationPrompt.createdAt);
  });

  it("validates dry-run mode without launching a browser or narration", async () => {
    const payload = await requestJson(server, "/api/run", {
      method: "POST",
      body: JSON.stringify({ mode: "dry", valueIntensity: "balanced", voiceProvider: "say", voice: "Samantha" })
    });

    assert.equal(payload.ok, true);
    assert.match(payload.log, /Segments:/);
    assert.match(payload.log, /Value intensity: balanced/);
  });

  it("reports a safe stop response when no demo is running", async () => {
    const payload = await requestJson(server, "/api/stop", {
      method: "POST",
      body: "{}"
    });

    assert.equal(payload.ok, true);
    assert.equal(payload.stopped, false);
  });
});

describe("manifest validation scripts", () => {
  it("validates the NetSuite finance manifest", () => {
    const result = spawnSync("node", ["src/validate-manifest.mjs", "manifests/finance-pl-cash360.demo.json"], {
      cwd: projectRoot,
      encoding: "utf8"
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Manifest looks good/);
  });

  it("validates the SC product showcase manifest", () => {
    const result = spawnSync("node", ["src/validate-manifest.mjs", "manifests/netsuite-demo-helper-showcase.demo.json"], {
      cwd: projectRoot,
      encoding: "utf8"
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Manifest looks good/);
  });
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function readOptionalFile(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function restoreOptionalFile(filePath, contents) {
  if (contents === null) {
    await rm(filePath, { force: true });
    return;
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}

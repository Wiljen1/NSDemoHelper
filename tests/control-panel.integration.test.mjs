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
let aiProvidersBackup;
let knowledgeSourcesBackup;
let tenantConfigBackup;
let sessionDatabaseBackup;
const mainManifestPath = path.join(projectRoot, "manifests/finance-pl-cash360.demo.json");
const cmsAdminPath = path.join(projectRoot, ".auth/cms-admin.json");
const cmsSessionsPath = path.join(projectRoot, ".auth/cms-sessions.json");
const cmsContentPath = path.join(projectRoot, "artifacts/cms/content.json");
const aiProvidersPath = path.join(projectRoot, "artifacts/platform/ai-providers.json");
const knowledgeSourcesPath = path.join(projectRoot, "artifacts/platform/knowledge-sources.json");
const tenantConfigPath = path.join(projectRoot, "artifacts/platform/tenant-config.json");
const sessionDatabasePath = path.join(projectRoot, "artifacts/session-db/sessions.json");

before(async () => {
  manifestBackup = await readFile(mainManifestPath, "utf8");
  cmsAdminBackup = await readOptionalFile(cmsAdminPath);
  cmsSessionsBackup = await readOptionalFile(cmsSessionsPath);
  cmsContentBackup = await readOptionalFile(cmsContentPath);
  aiProvidersBackup = await readOptionalFile(aiProvidersPath);
  knowledgeSourcesBackup = await readOptionalFile(knowledgeSourcesPath);
  tenantConfigBackup = await readOptionalFile(tenantConfigPath);
  sessionDatabaseBackup = await readOptionalFile(sessionDatabasePath);
  await rm(cmsAdminPath, { force: true });
  await rm(cmsSessionsPath, { force: true });
  await rm(cmsContentPath, { force: true });
  await rm(aiProvidersPath, { force: true });
  await rm(knowledgeSourcesPath, { force: true });
  await rm(tenantConfigPath, { force: true });
  await rm(sessionDatabasePath, { force: true });
  server = await startTestServer();
});

after(async () => {
  await stopTestServer(server);
  if (manifestBackup) await writeFile(mainManifestPath, manifestBackup, "utf8");
  await restoreOptionalFile(cmsAdminPath, cmsAdminBackup);
  await restoreOptionalFile(cmsSessionsPath, cmsSessionsBackup);
  await restoreOptionalFile(cmsContentPath, cmsContentBackup);
  await restoreOptionalFile(aiProvidersPath, aiProvidersBackup);
  await restoreOptionalFile(knowledgeSourcesPath, knowledgeSourcesBackup);
  await restoreOptionalFile(tenantConfigPath, tenantConfigBackup);
  await restoreOptionalFile(sessionDatabasePath, sessionDatabaseBackup);
});

describe("NetSuite Demo Helper control panel", () => {
  it("serves the main UI with the streamlined tabs and run controls", async () => {
    const response = await fetch(server.baseUrl);
    assert.equal(response.status, 200);
    const html = await response.text();

    for (const expected of [
      "NetSuite Demo Helper",
      ">Discovery & Prep<",
      ">Discovery Prep<",
      ">Playbook<",
      ">Demo Intelligence<",
      ">Pre-Demo Intelligence<",
      ">Dry-Run<",
      ">Dataset Analysis<",
      ">Run<",
      ">Admin<",
      "Pre-demo scoring",
      "Additional Context",
      "Ready to prepare discovery questions",
      "Last loaded: not yet",
      "Button/API JSON Instructions",
      "Platform Foundation",
      "Founder Readiness",
      "AI Brain Management",
      "Knowledge Source Management",
      "Demo Prep Database",
      "Dry-Run Prep",
      "Run Dataset Analysis",
      "Buffer Dry-Run",
      "Live Demo"
    ]) {
      assert.match(html, new RegExp(escapeRegExp(expected)));
    }

    assert.doesNotMatch(html, /Refresh Guide/);
    assert.doesNotMatch(html, /Prepare the story before the screen share starts/);
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

  it("generates Discovery Prep questions without creating a playbook", async () => {
    const payload = await requestJson(server, "/api/discovery-prep", {
      method: "POST",
      body: JSON.stringify(draftPrepPayload({
        preDemoNotes: "Discovery notes mention finance consolidation, integration uncertainty, and missing success metrics.",
        additionalContext: "Bridge call excerpt: CFO wants to understand what should be validated before any demo story is finalized."
      }))
    });

    assert.equal(payload.ok, true);
    assert.equal(payload.draft, true);
    assert.match(payload.discoveryPrep.markdown, /# Discovery Prep/);
    assert.match(payload.discoveryPrep.markdown, /Priority Discovery Questions/);
    assert.equal(payload.discoveryPrep.source, "codex-background-operator");
    assert.ok(!payload.guide);
    assert.ok(!payload.guideOutputs);
  });

  it("protects and exposes the admin session database viewer", async () => {
    const blocked = await fetch(`${server.baseUrl}/api/session-logs`);
    assert.equal(blocked.status, 401);

    const cookie = await ensureCmsCookie();
    const payload = await requestJson(server, "/api/session-logs", {
      headers: { cookie }
    });

    assert.equal(payload.ok, true);
    assert.ok(payload.total >= 1);
    assert.ok(payload.sessions.some((session) => session.company_name));
    assert.ok(Number.isFinite(payload.metrics.average_discovery_score) || payload.metrics.average_discovery_score === null);

    const first = payload.sessions[0];
    const detail = await requestJson(server, `/api/session-logs/${first.session_id}`, {
      headers: { cookie }
    });
    assert.equal(detail.ok, true);
    assert.equal(detail.session.session_id, first.session_id);
    assert.ok(detail.session.generated_outputs);
    assert.ok(detail.session.actions.length >= 1);
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
    assert.ok(catalog.buttons.some((button) => button.id === "discovery-prep"));
    assert.ok(catalog.buttons.some((button) => button.id === "learn-create-demo"));
    assert.ok(catalog.buttons.some((button) => button.id === "refresh-pre-demo-scoring"));
    assert.ok(catalog.buttons.some((button) => button.id === "export-discovery-followups"));
    assert.ok(!catalog.buttons.some((button) => button.id === "refresh-dry-run-creation-prompt"));
    assert.ok(!catalog.buttons.some((button) => button.id === "run-dataset-analysis"));
    assert.ok(!catalog.buttons.some((button) => button.id === "execute-dataset-prompt"));
    assert.ok(catalog.buttons.some((button) => button.id === "platform-status"));
    assert.ok(catalog.buttons.some((button) => button.id === "platform-health"));
    assert.ok(catalog.buttons.some((button) => button.id === "platform-founder-readiness"));
    assert.ok(catalog.buttons.some((button) => button.id === "platform-tenant-load"));
    assert.ok(catalog.buttons.some((button) => button.id === "platform-ai-providers-load"));
    assert.ok(catalog.buttons.some((button) => button.id === "platform-knowledge-sources-load"));

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
    const disabled = await setLiveDemoFeatureFlag(false);
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

    const enabled = await setLiveDemoFeatureFlag(true);
    assert.equal(enabled.featureFlags.liveDemoFunctionality, true);
  });

  it("loads and validates future AI providers and knowledge sources in Admin", async () => {
    const cookie = await ensureCmsCookie();
    const cms = await requestJson(server, "/api/cms", {
      headers: { cookie }
    });
    assert.equal(cms.ok, true);
    assert.ok(cms.blocks.some((block) => block.id === "discoveryPrepGuidance"));
    assert.ok(cms.blocks.some((block) => block.label === "Discovery Prep Prompt"));

    const providers = await requestJson(server, "/api/platform/ai-providers", {
      headers: { cookie }
    });
    assert.equal(providers.ok, true);
    assert.equal(providers.registry.activeProviderId, "codex-local");
    assert.ok(providers.registry.providers.some((provider) => provider.providerType === "codex"));
    assert.match(providers.securityNote, /Raw API keys are not saved/);

    const providerTest = await requestJson(server, "/api/platform/ai-providers/test", {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({ providerId: "codex-local" })
    });
    assert.equal(providerTest.ok, true);
    assert.equal(providerTest.providerType, "codex");
    assert.equal(providerTest.available, true);
    assert.equal(providerTest.connectionStatus, "Connected");
    assert.equal(providerTest.runtimeStatus, "Running");

    const platformStatus = await requestJson(server, "/api/platform/status");
    assert.equal(platformStatus.ok, true);
    assert.equal(platformStatus.activeProviderId, "codex-local");
    assert.equal(platformStatus.runtime.connectionStatus, "Connected");
    assert.equal(platformStatus.runtime.runtimeStatus, "Running");

    const health = await requestJson(server, "/api/platform/health");
    assert.equal(health.ok, true);
    assert.equal(health.environment.appProfile, "mvp");
    assert.equal(health.ai.activeProviderType, "codex");
    assert.equal(health.security.clientReceivesRawSecrets, false);

    const founder = await requestJson(server, "/api/platform/founder-readiness", {
      headers: { cookie }
    });
    assert.equal(founder.ok, true);
    assert.ok(Number.isFinite(founder.readinessScore));
    assert.ok(founder.capabilities.some((capability) => capability.id === "demo_readiness"));
    assert.ok(founder.defensibleCore.length > 0);

    const tenant = await requestJson(server, "/api/platform/tenant-config", {
      headers: { cookie }
    });
    assert.equal(tenant.ok, true);
    assert.equal(tenant.editable, false);
    assert.equal(tenant.config.productPack.id, "netsuite_erp_pack");

    const sources = await requestJson(server, "/api/platform/knowledge-sources", {
      headers: { cookie }
    });
    assert.equal(sources.ok, true);
    assert.ok(Array.isArray(sources.registry.sources));
    assert.match(sources.trustPolicy, /contextual intelligence providers/);

    const savedSources = await requestJson(server, "/api/platform/knowledge-sources", {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({
        registry: {
          sources: [
            {
              id: "test-playbook-api",
              name: "Test playbook API",
              sourceType: "rest_api",
              endpointUrl: "https://example.test/playbooks",
              authMethod: "api_key_env",
              apiKeyReference: "TEST_PLAYBOOK_API_KEY",
              active: true,
              scope: "Discovery enrichment test source.",
              categories: ["Discovery Enrichment"],
              priorityWeight: 70,
              confidenceLevel: "test-context"
            }
          ]
        }
      })
    });
    assert.equal(savedSources.ok, true);
    assert.equal(savedSources.registry.sources[0].apiKeyConfigured, true);
    assert.equal(savedSources.registry.sources[0].apiKeyReference, "TEST_PLAYBOOK_API_KEY");

    const sourceTest = await requestJson(server, "/api/platform/knowledge-sources/test", {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({ registry: savedSources.registry })
    });
    assert.equal(sourceTest.ok, true);
    assert.equal(sourceTest.results[0].validationStatus, "Registered only");
    assert.equal(sourceTest.results[0].authenticationStatus, "Credential reference configured");
    assert.match(sourceTest.results[0].advisory, /contextual intelligence only/);
  });

  it("allows tenant and branding configuration only in white-label mode", async () => {
    const whiteLabelServer = await startTestServer({ APP_PROFILE: "whitelabel" });
    try {
      const cookie = await ensureCmsCookie(whiteLabelServer);
      const loaded = await requestJson(whiteLabelServer, "/api/platform/tenant-config", {
        headers: { cookie }
      });
      assert.equal(loaded.ok, true);
      assert.equal(loaded.editable, true);
      assert.equal(loaded.config.branding.appName, "Demo Intelligence Platform");
      assert.equal(loaded.config.productPack.id, "generic_enterprise_demo_pack");
      assert.equal(loaded.config.productPack.category, "enterprise_application");
      assert.equal(loaded.config.demoPlatform.id, "configurable_demo_platform");

      const saved = await requestJson(whiteLabelServer, "/api/platform/tenant-config", {
        method: "POST",
        headers: { cookie },
        body: JSON.stringify({
          config: {
            ...loaded.config,
            tenantName: "Acme Demo Team",
            branding: {
              ...loaded.config.branding,
              appName: "Acme Demo Intelligence",
              primaryColor: "#123456",
              accentColor: "#14b8a6"
            },
            productPack: {
              ...loaded.config.productPack,
              label: "Acme Workflow Platform Pack",
              category: "workflow_automation"
            }
          }
        })
      });
      assert.equal(saved.ok, true);
      assert.equal(saved.config.tenantName, "Acme Demo Team");
      assert.equal(saved.config.branding.appName, "Acme Demo Intelligence");
      assert.equal(saved.config.productPack.category, "workflow_automation");

      const health = await requestJson(whiteLabelServer, "/api/platform/health");
      assert.equal(health.environment.appProfile, "whitelabel");
      assert.equal(health.tenant.tenantName, "Acme Demo Team");
      assert.equal(health.tenant.productPack.category, "workflow_automation");
      assert.equal(health.capabilities.whiteLabelControlsVisible, true);

      const founder = await requestJson(whiteLabelServer, "/api/platform/founder-readiness", {
        headers: { cookie }
      });
      assert.equal(founder.ok, true);
      assert.equal(founder.commercialModel.currentTier, saved.config.commercial.subscriptionTier);
      assert.ok(founder.checks.some((check) => check.area === "SaaS Commercial Model"));
    } finally {
      await stopTestServer(whiteLabelServer);
      await restoreOptionalFile(tenantConfigPath, tenantConfigBackup);
    }
  });

  it("loads the manifest payload with guide, setup prompt, and Intelligence", async () => {
    await setLiveDemoFeatureFlag(true);
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
    await setLiveDemoFeatureFlag(true);
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
    await setLiveDemoFeatureFlag(true);
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

async function ensureCmsCookie(targetServer = server) {
  const status = await requestJson(targetServer, "/api/cms/status");
  const response = await fetch(`${targetServer.baseUrl}${status.setupRequired ? "/api/cms/setup" : "/api/cms/login"}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "VeryStrongPassword123!" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie") || "";
}

async function setLiveDemoFeatureFlag(enabled, targetServer = server) {
  const cookie = await ensureCmsCookie(targetServer);
  return requestJson(targetServer, "/api/cms/feature-flags", {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({ liveDemoFunctionality: Boolean(enabled) })
  });
}

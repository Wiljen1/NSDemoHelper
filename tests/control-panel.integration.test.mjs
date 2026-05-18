import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { draftPrepPayload, projectRoot, requestJson, startTestServer, stopTestServer } from "./helpers.mjs";

let server;

before(async () => {
  server = await startTestServer();
});

after(async () => {
  await stopTestServer(server);
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
      ">Intelligence<",
      ">Dry-Run<",
      ">Run<",
      ">Admin<",
      "Dry-Run Prep",
      "Buffer Dry-Run",
      "Live Demo"
    ]) {
      assert.match(html, new RegExp(escapeRegExp(expected)));
    }

    assert.doesNotMatch(html, /Refresh Guide/);
    assert.doesNotMatch(html, /Open NetSuite Browser/);
    assert.doesNotMatch(html, /Rehearse \+ Prep Account/);
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
    assert.equal(payload.intelligence.demo_readiness_score, 82);
    assert.equal(payload.intelligence.pre_demo_notes_analyzer.overall_score, 67);
    assert.ok(payload.intelligence.discovery_gap_analyzer.missing_discovery_items.includes("Success metrics"));
  });

  it("loads the manifest payload with guide, setup prompt, and Intelligence", async () => {
    const payload = await requestJson(server, "/api/manifest");

    assert.ok(payload.manifest);
    assert.ok(payload.guide);
    assert.ok(payload.guideOutputs);
    assert.ok(payload.setupPrompt);
    assert.ok(payload.intelligence);
    assert.equal(payload.intelligence.intelligence_generated_by, "codex-structured-json");
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

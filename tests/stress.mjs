import { draftPrepPayload, requestJson, startTestServer, stopTestServer } from "./helpers.mjs";

const totalRequests = Number(process.env.STRESS_REQUESTS || 80);
const concurrency = Number(process.env.STRESS_CONCURRENCY || 10);
const maxErrorCount = Number(process.env.STRESS_MAX_ERRORS || 0);

const server = await startTestServer();
const timings = [];
const errors = [];
let nextRequest = 0;

const scenarios = [
  {
    name: "home",
    run: async () => {
      const response = await fetch(server.baseUrl);
      if (!response.ok) throw new Error(`home returned ${response.status}`);
      const html = await response.text();
      if (!html.includes("NetSuite Demo Helper")) throw new Error("home did not include app title");
    }
  },
  {
    name: "codex-status",
    run: () => requestJson(server, "/api/codex/status")
  },
  {
    name: "run-state",
    run: () => requestJson(server, "/api/run-state")
  },
  {
    name: "voices",
    run: () => requestJson(server, "/api/voices", {
      method: "POST",
      body: JSON.stringify({ provider: "elevenlabs", apiKey: "" })
    })
  },
  {
    name: "sc-guide",
    run: () => requestJson(server, "/api/sc-guide")
  },
  {
    name: "setup-prompt",
    run: () => requestJson(server, "/api/setup-prompt")
  },
  {
    name: "draft-intelligence",
    run: (index) => requestJson(server, "/api/intelligence", {
      method: "POST",
      body: JSON.stringify(draftPrepPayload({
        preDemoNotes: `Stress request ${index}: check draft scoring, missing success metrics, active countries, and current ERP.`
      }))
    })
  }
];

try {
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
} finally {
  await stopTestServer(server);
}

const sorted = timings.slice().sort((left, right) => left.ms - right.ms);
const summary = {
  totalRequests,
  concurrency,
  passed: totalRequests - errors.length,
  failed: errors.length,
  minMs: sorted[0]?.ms || 0,
  medianMs: percentile(sorted, 50),
  p95Ms: percentile(sorted, 95),
  maxMs: sorted.at(-1)?.ms || 0,
  byScenario: scenarioSummary(timings)
};

console.log(JSON.stringify(summary, null, 2));

if (errors.length > maxErrorCount) {
  console.error("Stress test failures:");
  for (const error of errors.slice(0, 10)) {
    console.error(`- #${error.index} ${error.scenario}: ${error.message}`);
  }
  process.exitCode = 1;
}

async function worker() {
  while (nextRequest < totalRequests) {
    const index = nextRequest;
    nextRequest += 1;
    const scenario = scenarios[index % scenarios.length];
    const startedAt = performance.now();
    try {
      await scenario.run(index);
      timings.push({
        index,
        scenario: scenario.name,
        ms: Math.round(performance.now() - startedAt)
      });
    } catch (error) {
      errors.push({
        index,
        scenario: scenario.name,
        message: error.message
      });
    }
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index].ms;
}

function scenarioSummary(items) {
  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.scenario)) grouped.set(item.scenario, []);
    grouped.get(item.scenario).push(item.ms);
  }
  return Object.fromEntries([...grouped.entries()].map(([name, values]) => {
    const sortedValues = values.slice().sort((left, right) => left - right);
    return [name, {
      count: values.length,
      medianMs: sortedValues[Math.floor(sortedValues.length / 2)] || 0,
      maxMs: sortedValues.at(-1) || 0
    }];
  }));
}

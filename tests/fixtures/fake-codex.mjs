#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);

if (args.includes("--version")) {
  console.log("fake-codex 0.1.0");
  process.exit(0);
}

const outputFile = outputLastMessagePath(args);
const prompt = await readStdin();
const output = chooseOutput(prompt);

if (outputFile) {
  await writeFile(outputFile, output, "utf8");
}

console.log(output);

function outputLastMessagePath(argv) {
  const index = argv.indexOf("--output-last-message");
  if (index >= 0 && argv[index + 1]) return argv[index + 1];
  return "";
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("error", reject);
    process.stdin.on("end", () => resolve(data));
  });
}

function chooseOutput(prompt) {
  if (prompt.includes("Return VALID JSON ONLY")) return JSON.stringify(intelligencePayload(), null, 2);
  if (prompt.includes("Create 10 to 14 questions")) return discoveryQuestions();
  if (prompt.includes("Output exactly as Markdown with these sections") || prompt.includes("complete updated SC guide")) {
    return scGuide();
  }
  if (prompt.includes("# Codex Prep Operator Analysis") || prompt.includes("background Codex prep operator")) {
    return prepAnalysis();
  }
  return "Fake Codex response for automated tests.";
}

function prepAnalysis() {
  return `# Codex Prep Operator Analysis
Task title: automated test

## Company Context That Should Shape The Demo
- Test company context is finance-led and discovery-driven.

## Likely ERP Priorities
- Trusted reporting
- Discovery completeness
- Demo risk reduction

## Recommended Demo Direction
Start with executive context, then show the highest-value proof moments first.

## Scope And Account Prep Implications
Keep account changes read-only unless explicitly approved.

## Discovery Gaps That Could Hurt The Demo
- Success metrics
- Current systems
- Stakeholder priorities`;
}

function scGuide() {
  return `# SC Demo Guide: Automated Test Prospect

## Demo Thesis
Show a focused finance demo that starts with executive visibility and moves into trusted reporting.

## Audience Angle
Prospect, mid-market, business-first.

## Additional Admin Sources And Logic Considered
Use standard reports first and avoid setup-heavy paths.

## Codex Prep Operator Analysis
Automated test prep analysis.

## Personalized Demo Story And Runbook
### Story arc
Open with the business pressure, then prove it through a short report path.

### Exact runbook
1. Open with executive visibility.
2. Show standard reporting.
3. Drill once to prove trust.

### Demo prep rules
- Keep it read-only.
- Avoid low-value navigation.

### Closing move
Restate the before-and-after business outcome.

## Tips And Tricks For The SC
- Name the business reason before each click.

## Company Context
Automated test company context.

## Pre-Demo Notes
Automated test notes.

## Demo Asset Generation Prompt
Create a short persona-led deck that supports the live demo story.

## NetSuite Prep Summary
- Target account: test account
- Safe checks: verify report data, role, and navigation.
- Write actions: none without user confirmation.
- Read-only guidance: keep the test demo read-only.

## Discovery Hooks During The Demo
- What success metric would make this demo compelling?

## SC Instructions Used By The Generator
Use standard reports and show highest-impact proof moments first.`;
}

function discoveryQuestions() {
  return `# Discovery Follow-Up Questions

1. Which success metrics should the demo prove?
2. Which stakeholders must see their priorities reflected?
3. Which current systems create the most reporting friction?
4. Which countries, currencies, or legal entities are in scope?
5. Which workflows should be kept out of the first demo?`;
}

function intelligencePayload() {
  return {
    demo_readiness_score: 82,
    readiness_verdict: "Ready for rehearsal with a few discovery gaps to close.",
    sc_briefing: {
      customer_situation: "The prospect needs a clearer finance story from discovery notes.",
      demo_goal: "Help the SC validate readiness and tighten the demo path.",
      key_business_drivers: ["Trusted reporting", "Discovery completeness", "Demo risk reduction"],
      recommended_tone: "Business-first, concise, and practical.",
      critical_demo_moments: ["Opening business context", "Standard reporting proof", "Discovery gap discussion"]
    },
    demo_metadata: {
      customer_name: "Automated Test Prospect",
      customer_url: "https://example.com",
      demo_name: "Automated Test Demo",
      demo_goal: "Validate app behavior",
      demo_scope: "Financials first",
      customer_description: "Synthetic test customer",
      likely_priorities: ["Visibility", "Control"],
      audience_type: "Prospect",
      target_segment: "Mid-Market",
      industry: "General Business",
      strategy: "Standard Platform Demo",
      language: "English",
      narration_voice: "Samantha",
      manifest_ready: true
    },
    demo_strategy: {
      id: "standard_platform_demo",
      label: "Standard Platform Demo",
      description: "Broad but controlled platform demo.",
      tone: "polished",
      pacing: "balanced",
      technical_depth: "light",
      storytelling_style: "business-first"
    },
    industry_playbook: {
      id: "general_business",
      label: "General Business",
      description: "General finance and operations context.",
      terminology: ["finance visibility"],
      kpis: ["close speed"],
      workflows: ["standard reporting"],
      pain_points: ["manual reporting"],
      emotional_drivers: ["confidence"]
    },
    demo_risk_analyzer: {
      demo_quality_score: 84,
      demo_risk_score: 36,
      summary: "Healthy demo with manageable risk.",
      warnings: ["Discovery success metrics are not specific enough"],
      recommendations: ["Add success metrics before rehearsal"],
      score_explanation: "Scores are based on test Codex output.",
      score_details: {
        demo_quality_summary: "Strong enough for rehearsal.",
        demo_risk_summary: "Low-to-medium risk.",
        what_is_strong: ["Business-first flow"],
        what_needs_work: ["Success metrics"],
        quality_explanation: "The flow has a clear opening and proof path.",
        risk_explanation: "Missing discovery can weaken personalization.",
        notes_dependency: "Pre-demo notes need more measurable outcomes."
      }
    },
    discovery_gap_analyzer: {
      summary: "Some discovery inputs are still missing.",
      missing_discovery_items: ["Success metrics", "Current ERP", "Executive sponsor"],
      found_discovery_items: ["Audience", "Demo scope"],
      recommended_follow_up_questions: ["Which metric should this demo prove?"]
    },
    stakeholder_coverage_analyzer: {
      summary: "Finance is covered; IT needs a light bridge.",
      stakeholder_coverage: [
        { role: "CFO", coverage: 80, rationale: "Executive visibility is covered." },
        { role: "IT", coverage: 45, rationale: "Integration needs only a brief mention." }
      ],
      low_coverage_roles: ["IT"],
      uncovered_roles: ["Operations"],
      recommendation: "Add one business-facing IT bridge."
    },
    winning_moment_detection: {
      summary: "The strongest moment is trusted reporting.",
      winning_moments: ["Standard report with drilldown"],
      details: [
        {
          segment: "standard-reporting",
          moment: "Standard report with drilldown",
          source: "Fake Codex",
          why_it_lands: "It proves trust in the number.",
          coaching_tip: "Slow down and land the business reason."
        }
      ]
    },
    what_not_to_demo_engine: {
      summary: "Avoid setup-heavy areas.",
      avoid_showing: ["Admin setup", "Unprepared custom reports"],
      rationale: "These distract from the first proof path."
    },
    demo_timing_pacing_analyzer: {
      summary: "Timing is controlled.",
      estimated_runtime: "22 minutes",
      estimated_minutes: 22,
      overrun_risk: "low",
      basis: "Based on test guide and manifest.",
      high_risk_sections: ["Discovery Q&A"],
      recommended_cuts: ["Skip configuration details"],
      section_timing: [{ section: "Opening", minutes: 3 }]
    },
    ai_rehearsal_coach: {
      summary: "Ready for rehearsal.",
      status: "ready-for-rehearsal-feedback",
      basis: "No transcript yet.",
      business_value_score: 80,
      clarity_score: 84,
      executive_alignment_score: 78,
      recommendations: ["Rehearse the opening"],
      suggested_metrics_for_future_rehearsal_transcripts: ["Filler words"]
    },
    demo_heatmap_analyzer: {
      summary: "Strong on structure, weaker on discovery.",
      strongest_areas: ["Story structure"],
      needs_work_areas: ["Discovery metrics"],
      heatmap: [
        { label: "Story structure", score: 84, status: "strong", status_label: "Strong", evidence: "Clear path", recommendation: "Keep it tight" },
        { label: "Discovery metrics", score: 62, status: "watch", status_label: "Watch", evidence: "Missing metric", recommendation: "Ask follow-up questions" }
      ]
    },
    pre_demo_notes_analyzer: {
      overall_score: 67,
      discovery_coverage_score: 64,
      word_count: 42,
      summary: "Notes are usable but incomplete.",
      coverage_summary: "Audience and scope are present; success metrics are thin.",
      strong_areas: ["Audience", "Scope"],
      risk_areas: ["Success metrics", "Current systems"],
      recommendations: ["Clarify current ERP and measurable outcomes"],
      heatmap: [
        { label: "Audience", score: 80, status: "strong", status_label: "Strong", evidence: "Audience selected", recommendation: "Keep" },
        { label: "Success metrics", score: 52, status: "risk", status_label: "Risk", evidence: "Missing", recommendation: "Add measurable outcomes" }
      ]
    },
    competitive_positioning_mode: {
      summary: "Advisory only.",
      warning: "Competitive insights are advisory only and may be incomplete or outdated. Validate important claims before customer use.",
      guidance_only: true,
      competitive_focus: [
        {
          topic: "Unified suite",
          why_it_matters: "Use only if disconnected systems are confirmed.",
          recommended_demo_moment: "Standard reporting proof"
        }
      ]
    },
    win_strategy_analyzer: {
      summary: "Win by tying the demo to finance trust, standard reporting, and controlled scope.",
      competition_context: "Status quo and current ERP.",
      guidance_only: true,
      strategies: [
        {
          title: "Lead with finance trust",
          why_we_can_win: "The notes show reporting confidence and drilldown matter.",
          competitor_likely_move: "A competitor may lead with broad platform breadth.",
          demo_move: "Open with the standard report and prove drilldown."
        },
        {
          title: "Keep scope controlled",
          why_we_can_win: "The scope is finance-first with clear next-step modules.",
          competitor_likely_move: "A competitor may over-demo implementation detail.",
          demo_move: "Sequence the highest-value finance proof moments first."
        },
        {
          title: "Use discovery gaps as next-step control",
          why_we_can_win: "The SC can show what is ready and what must be validated.",
          competitor_likely_move: "A competitor may avoid weak discovery areas.",
          demo_move: "Close with precise follow-up questions."
        }
      ]
    },
    internal_best_practices_library: {
      reusable_patterns_to_capture: ["Business-first opening"],
      recommended_structures: ["Tell-show-tell"]
    }
  };
}

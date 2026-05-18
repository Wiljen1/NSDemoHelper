import http from "node:http";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const projectRoot = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const manifestPath = path.join(projectRoot, "manifests/finance-pl-cash360.demo.json");
const generatedManifestsDir = path.join(projectRoot, "manifests/generated");
const versionsDir = path.join(projectRoot, "manifests/versions");
const scGuidePath = path.join(projectRoot, "artifacts/sc-demo-guide.md");
const narratorStatePath = path.join(projectRoot, "artifacts/runtime/narrator-state.json");
const cmsContentPath = path.join(projectRoot, "artifacts/cms/content.json");
const cmsVersionsDir = path.join(projectRoot, "artifacts/cms/versions");
const cmsAdminPath = path.join(projectRoot, ".auth/cms-admin.json");
const cmsSessionsPath = path.join(projectRoot, ".auth/cms-sessions.json");
const port = Number(process.env.PORT || 4173);
const scryptAsync = promisify(scryptCallback);
let currentRun = null;
let defaultScInstructionsOverride = "";
let helperIntroOverride = "";
let helperStepsOverride = null;
let additionalDemoSources = [];

const voiceProviders = {
  say: {
    value: "say",
    label: "Local Mac narrator",
    requiresApiKey: false,
    apiKeyLabel: ""
  },
  elevenlabs: {
    value: "elevenlabs",
    label: "ElevenLabs cloud narrator",
    requiresApiKey: true,
    apiKeyEnv: "ELEVENLABS_API_KEY",
    apiKeyLabel: "ElevenLabs API key"
  }
};

let outputLanguages = {
  en: { value: "en", label: "English" },
  nl: { value: "nl", label: "Dutch" },
  de: { value: "de", label: "German" },
  fr: { value: "fr", label: "French" },
  es: { value: "es", label: "Spanish" }
};

const defaultAudienceType = "prospect";
const defaultTargetAudience = "mid_market";
const defaultOutputLanguage = "en";
const defaultDemoStrategy = "vision_demo";
const defaultIndustry = "general_business";

let demoStrategies = [
  {
    id: "discovery_demo",
    label: "Discovery Demo",
    description: "Use the demo to validate pain, clarify priorities, and open better discovery questions.",
    tone: "curious and consultative",
    pacing: "moderate, with pauses for questions",
    technicalDepth: "light",
    storytelling: "problem-led with frequent validation",
    includeWorkflows: ["short proof moments", "diagnostic questions", "before/after examples"],
    avoid: ["long monologues", "deep configuration", "assuming the pain is already confirmed"]
  },
  {
    id: "vision_demo",
    label: "Vision Demo",
    description: "Show the future operating model and help the audience picture a better way of working.",
    tone: "confident and outcome-led",
    pacing: "crisp with slower emphasis on memorable proof moments",
    technicalDepth: "light to moderate",
    storytelling: "future-state story with clear business outcomes",
    includeWorkflows: ["executive view", "core process proof", "winning moments", "business close"],
    avoid: ["feature tours", "admin setup", "too many edge cases"]
  },
  {
    id: "standard_platform_demo",
    label: "Standard Platform Demo",
    description: "A broad, structured product demonstration that showcases the overall platform, major capabilities, and end-to-end business value within a fixed timeframe.",
    tone: "polished, structured, and business-focused",
    pacing: "balanced and time-aware, with high-value workflows first",
    technicalDepth: "light to moderate unless requested",
    storytelling: "broad end-to-end platform story connecting multiple stakeholder perspectives",
    includeWorkflows: [
      "end-to-end business flows",
      "cross-functional workflows",
      "executive dashboards",
      "reporting and analytics",
      "automation examples",
      "role-based experiences",
      "standard best-practice flows",
      "platform navigation and usability"
    ],
    avoid: [
      "extremely deep configuration walkthroughs",
      "long admin setup sequences",
      "technical implementation deep dives",
      "spending too much time in one module",
      "feature dumping without business context",
      "excessive customization discussions",
      "low-value or unfinished areas"
    ],
    primaryObjectives: [
      "demonstrate overall platform breadth",
      "showcase key modules and workflows",
      "establish credibility and platform maturity",
      "highlight integration between departments",
      "show scalability and flexibility",
      "deliver a polished end-to-end story",
      "create excitement and confidence"
    ],
    recommendedRuntime: ["1 hour", "2 hour", "half-day showcase", "multi-session overview"],
    behaviorRules: [
      "prioritize breadth over deep specialization",
      "ensure all major departments are represented",
      "maintain consistent pacing",
      "avoid excessive technical depth unless requested",
      "make executive-level value visible throughout",
      "include multiple stakeholder perspectives",
      "maintain a polished showcase style",
      "connect workflows through one narrative story where possible"
    ]
  },
  {
    id: "executive_alignment",
    label: "Executive Alignment Demo",
    description: "Focus senior leaders on financial impact, risk reduction, and strategic outcomes.",
    tone: "concise and strategic",
    pacing: "fast, minimal clicks",
    technicalDepth: "very light",
    storytelling: "board-level narrative with measurable outcomes",
    includeWorkflows: ["executive KPIs", "risk and control proof", "summary-to-action moments"],
    avoid: ["field-by-field explanation", "configuration walkthroughs", "low-level navigation"]
  },
  {
    id: "technical_validation",
    label: "Technical Validation Demo",
    description: "Prove fit for IT, administrators, architects, security, integration, and extensibility stakeholders.",
    tone: "transparent and precise",
    pacing: "methodical",
    technicalDepth: "high",
    storytelling: "capability proof with clear constraints",
    includeWorkflows: ["permissions", "integration touchpoints", "auditability", "configuration flexibility"],
    avoid: ["marketing-only claims", "hiding complexity", "unsupported technical promises"]
  },
  {
    id: "competitive_defense",
    label: "Competitive Defense Demo",
    description: "Position the demo around approved differentiators without inventing competitor claims.",
    tone: "careful and evidence-led",
    pacing: "focused on contrast moments",
    technicalDepth: "moderate",
    storytelling: "customer pain to approved differentiation",
    includeWorkflows: ["cross-functional proof", "suite-level story", "migration or simplification moments"],
    avoid: ["unverified competitor claims", "negative selling", "generic superiority statements"]
  },
  {
    id: "expansion_demo",
    label: "Expansion Demo",
    description: "Show existing customers additional capabilities, adoption paths, and optimization opportunities.",
    tone: "consultative and practical",
    pacing: "moderate",
    technicalDepth: "moderate",
    storytelling: "evolution from current usage to next outcome",
    includeWorkflows: ["new capabilities", "optimization opportunities", "best-practice flows"],
    avoid: ["re-explaining basics", "competitive displacement messaging", "generic prospect intros"]
  },
  {
    id: "renewal_demo",
    label: "Renewal Demo",
    description: "Reinforce business impact, adoption, risk reduction, and roadmap confidence for renewal conversations.",
    tone: "reassuring and evidence-led",
    pacing: "concise",
    technicalDepth: "light to moderate",
    storytelling: "proof of realized and future impact",
    includeWorkflows: ["adoption wins", "new release highlights", "risk-reduction proof"],
    avoid: ["overpromising roadmap", "generic feature lists", "ignoring current pain"]
  },
  {
    id: "workshop_session",
    label: "Workshop Session",
    description: "Make the demo interactive and collaborative, with decision points and configurable paths.",
    tone: "facilitative",
    pacing: "flexible",
    technicalDepth: "variable",
    storytelling: "shared solution design",
    includeWorkflows: ["decision checkpoints", "whiteboard prompts", "alternate flows"],
    avoid: ["single-threaded monologue", "rushing decisions", "unstructured wandering"]
  },
  {
    id: "proof_of_concept",
    label: "Proof Of Concept",
    description: "Prove agreed success criteria with controlled scope and evidence.",
    tone: "evidence-led",
    pacing: "measured",
    technicalDepth: "moderate to high",
    storytelling: "success-criteria proof",
    includeWorkflows: ["test criteria", "validation evidence", "known limitations", "next-step decision"],
    avoid: ["scope creep", "unvalidated claims", "unplanned workflows"]
  },
  {
    id: "training_session",
    label: "Training Session",
    description: "Teach users how to complete work clearly and repeatably.",
    tone: "clear and patient",
    pacing: "slower and instructional",
    technicalDepth: "role-appropriate",
    storytelling: "task completion and confidence",
    includeWorkflows: ["step-by-step work", "common mistakes", "practice prompts"],
    avoid: ["executive-only framing", "rushing", "too much strategy"]
  }
];

let industryPlaybooks = [
  {
    id: "general_business",
    label: "General Business",
    description: "Use when no specific industry has been identified yet.",
    terminology: ["finance visibility", "operational control", "growth readiness"],
    kpis: ["cash position", "profitability", "close speed", "forecast accuracy"],
    workflows: ["standard reporting", "drilldown", "cash forecasting", "controlled export"],
    painPoints: ["spreadsheet dependency", "slow reporting", "limited cash visibility"],
    emotionalDrivers: ["confidence in the numbers", "less firefighting", "clearer decisions"],
    avoid: ["industry-specific claims without discovery", "unsupported benchmark statements"]
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    description: "Manufacturers balancing production, inventory, margin, and supply constraints.",
    terminology: ["production", "inventory", "plant", "work orders", "supply chain"],
    kpis: ["gross margin", "inventory turns", "production variance", "cash tied in stock"],
    workflows: ["inventory visibility", "cost control", "forecasting demand", "supplier exposure"],
    painPoints: ["inventory surprises", "margin pressure", "manual planning", "supplier delays"],
    emotionalDrivers: ["control over complexity", "fewer surprises", "confidence in margin"],
    avoid: ["pure services language", "ignoring inventory and cost flow"]
  },
  {
    id: "wholesale_distribution",
    label: "Wholesale Distribution",
    description: "Distribution businesses focused on inventory, fulfillment, margin, and working capital.",
    terminology: ["warehouse", "fulfillment", "stock", "orders", "supplier"],
    kpis: ["fill rate", "inventory turns", "gross margin", "cash conversion cycle"],
    workflows: ["order flow", "inventory availability", "AR/AP aging", "cash forecast"],
    painPoints: ["stockouts", "slow collections", "supplier pressure", "manual allocation"],
    emotionalDrivers: ["better promises to customers", "working-capital control", "operational trust"],
    avoid: ["abstract finance-only story", "ignoring inventory and order flow"]
  },
  {
    id: "retail",
    label: "Retail",
    description: "Retailers balancing channels, inventory, demand, margin, and customer experience.",
    terminology: ["stores", "channels", "commerce", "assortment", "demand"],
    kpis: ["same-store sales", "gross margin", "inventory turns", "cash position"],
    workflows: ["channel performance", "inventory planning", "cash visibility", "reporting by entity"],
    painPoints: ["channel fragmentation", "inventory risk", "promotion pressure", "manual reporting"],
    emotionalDrivers: ["speed in seasonal decisions", "confidence across channels", "margin protection"],
    avoid: ["B2B-only language", "ignoring seasonality and channels"]
  },
  {
    id: "saas",
    label: "SaaS",
    description: "Software companies focused on recurring revenue, renewals, growth efficiency, and investor visibility.",
    terminology: ["ARR", "MRR", "renewals", "subscriptions", "customer retention"],
    kpis: ["ARR", "gross retention", "net revenue retention", "cash runway"],
    workflows: ["revenue visibility", "subscription reporting", "renewal risk", "cash runway"],
    painPoints: ["spreadsheet revenue tracking", "renewal visibility", "investor reporting", "forecast uncertainty"],
    emotionalDrivers: ["board confidence", "predictable growth", "clean investor story"],
    avoid: ["inventory-heavy examples", "ignoring recurring revenue metrics"]
  },
  {
    id: "services",
    label: "Services",
    description: "Services organizations focused on project profitability, utilization, billing, and client delivery.",
    terminology: ["projects", "utilization", "billable work", "client delivery", "margin"],
    kpis: ["project margin", "utilization", "DSO", "cash forecast"],
    workflows: ["project profitability", "billing visibility", "collections", "forecasting"],
    painPoints: ["margin leakage", "late billing", "manual project reporting", "cash uncertainty"],
    emotionalDrivers: ["profitable delivery", "fewer billing surprises", "control over client work"],
    avoid: ["product inventory examples", "ignoring people and project economics"]
  },
  {
    id: "nonprofit",
    label: "Nonprofit",
    description: "Nonprofits focused on stewardship, transparency, funding, compliance, and impact reporting.",
    terminology: ["funding", "grants", "donors", "programs", "stewardship"],
    kpis: ["program spend", "fund balance", "grant utilization", "cash position"],
    workflows: ["fund reporting", "grant visibility", "approval controls", "cash planning"],
    painPoints: ["restricted funds", "manual compliance reporting", "grant visibility", "audit pressure"],
    emotionalDrivers: ["trust with stakeholders", "mission continuity", "transparent stewardship"],
    avoid: ["aggressive sales language", "for-profit-only margin framing"]
  },
  {
    id: "healthcare",
    label: "Healthcare",
    description: "Healthcare organizations focused on compliance, operational cost, reporting, and stability.",
    terminology: ["care operations", "compliance", "audit", "cost centers", "controls"],
    kpis: ["operating margin", "cash position", "cost center performance", "audit readiness"],
    workflows: ["cost reporting", "approval controls", "audit trails", "cash planning"],
    painPoints: ["compliance burden", "cost pressure", "manual reporting", "system fragmentation"],
    emotionalDrivers: ["trust and safety", "operational resilience", "audit confidence"],
    avoid: ["unverified regulatory claims", "casual treatment of sensitive data"]
  },
  {
    id: "construction",
    label: "Construction",
    description: "Construction firms focused on project controls, cash flow, commitments, and margin protection.",
    terminology: ["jobs", "projects", "commitments", "change orders", "cash flow"],
    kpis: ["job margin", "WIP", "cash forecast", "commitment exposure"],
    workflows: ["project profitability", "commitment visibility", "billing and collections", "cash forecasting"],
    painPoints: ["project overruns", "cash timing gaps", "manual WIP reporting", "change-order risk"],
    emotionalDrivers: ["project control", "fewer surprises", "protecting margin and cash"],
    avoid: ["generic office-only scenarios", "ignoring project and cash timing"]
  },
  {
    id: "financial_services",
    label: "Financial Services",
    description: "Financial services organizations focused on controls, auditability, compliance, and risk.",
    terminology: ["controls", "risk", "audit", "entities", "compliance"],
    kpis: ["close speed", "risk exposure", "audit findings", "cash position"],
    workflows: ["audit trails", "role permissions", "entity reporting", "cash visibility"],
    painPoints: ["control gaps", "audit pressure", "manual consolidation", "regulatory scrutiny"],
    emotionalDrivers: ["confidence under scrutiny", "risk reduction", "governed growth"],
    avoid: ["unverified compliance claims", "informal control language"]
  }
];

let manifestDemoModes = [
  {
    id: "plain_demo",
    label: "Plain demo",
    description: "A clean product-led demo path that shows the standard NetSuite flow, proof points, navigation, and talk track without turning the manifest into a customer/persona story.",
    instruction: "Keep the manifest direct and product/process-led. Use neutral finance-team language, standard NetSuite reports, and clear proof points. Avoid persona-heavy storytelling."
  },
  {
    id: "customer_story",
    label: "Customer story",
    description: "A personalized demo story that uses the company context, audience, persona, pain points, and business outcomes to shape the flow and talk track.",
    instruction: "Turn the manifest into a customer-centered story. Use the selected audience and target audience playbook to personalize narration, proof moments, and the SC runbook."
  }
];

let demoAudienceConfiguration = {
  targetAudiences: [
    {
      id: "startup",
      label: "Startup",
      description: "Very early-stage companies focused on speed, innovation, and rapid execution with limited resources and lean teams.",
      primary_focus: ["speed", "simplicity", "quick setup", "cost efficiency", "fast ROI", "automation"],
      include_in_demo: ["quick wins", "simple workflows", "easy onboarding", "automation examples", "modern UX", "out-of-box functionality", "time-saving scenarios"],
      avoid_in_demo: ["complex enterprise architecture", "heavy governance discussions", "long implementation timelines", "feature overload", "deep compliance discussions"],
      demo_style: ["fast-paced", "high-energy", "outcome-driven", "minimal clicks", "show immediate value"]
    },
    {
      id: "emerging",
      label: "Emerging / SMB",
      description: "Small to growing businesses looking to scale operations efficiently without increasing complexity.",
      primary_focus: ["scalability", "ease of use", "affordability", "operational efficiency", "team productivity"],
      include_in_demo: ["cross-functional workflows", "simple reporting", "collaboration features", "automation", "templates", "best practices"],
      avoid_in_demo: ["overly technical deep dives", "enterprise-only messaging", "complex implementation discussions", "advanced customization too early"],
      demo_style: ["practical", "business-focused", "efficient", "show growth potential"]
    },
    {
      id: "mid_market",
      label: "Mid-Market",
      description: "Growing organizations with defined business processes that require scalability, visibility, and operational control.",
      primary_focus: ["process efficiency", "visibility", "integration", "cross-team collaboration", "scalable operations", "reporting"],
      include_in_demo: ["role-based workflows", "analytics dashboards", "integrations", "approval processes", "department collaboration", "automation across teams"],
      avoid_in_demo: ["oversimplified startup messaging", "feature dumping", "extremely technical implementation details", "unnecessary enterprise governance complexity"],
      demo_style: ["process-oriented", "business-value focused", "real-world operational scenarios"]
    },
    {
      id: "enterprise",
      label: "Enterprise",
      description: "Large organizations with complex operations, multiple stakeholders, governance requirements, and global scale.",
      primary_focus: ["security", "governance", "scalability", "reliability", "compliance", "integration ecosystem", "risk reduction"],
      include_in_demo: ["security controls", "permissions", "audit trails", "enterprise workflows", "API/integration capabilities", "executive dashboards", "multi-role experiences", "global scalability examples"],
      avoid_in_demo: ["small business messaging", "oversimplified workflows", "generic ROI claims", "flashy features without business context"],
      demo_style: ["structured", "strategic", "multi-stakeholder narrative", "confidence-building"]
    },
    {
      id: "public_sector",
      label: "Public Sector / Government",
      description: "Government and public organizations focused on compliance, transparency, accessibility, and risk management.",
      primary_focus: ["compliance", "security", "accessibility", "auditability", "stability", "procurement alignment"],
      include_in_demo: ["compliance controls", "security certifications", "audit trails", "accessibility support", "governance workflows", "data protection"],
      avoid_in_demo: ["aggressive sales messaging", "unverified claims", "consumer-style flashy experiences", "unstructured workflows"],
      demo_style: ["formal", "trust-focused", "compliance-oriented", "detail-oriented"]
    }
  ],
  audienceTypes: [
    {
      id: "prospect",
      label: "Prospect",
      description: "Potential buyers evaluating whether the solution solves their business challenges and delivers measurable value.",
      primary_focus: ["business value", "ROI", "ease of adoption", "competitive differentiation", "outcomes"],
      include_in_demo: ["business pain points", "before/after scenarios", "success stories", "metrics and outcomes", "industry relevance", "clear value proposition"],
      avoid_in_demo: ["deep technical configuration", "feature dumping", "internal terminology", "long setup explanations"],
      demo_style: ["persuasive", "outcome-oriented", "story-driven"]
    },
    {
      id: "executive",
      label: "Executive",
      description: "Senior leaders focused on strategic outcomes, transformation, financial impact, and organizational risk.",
      primary_focus: ["ROI", "strategic value", "business transformation", "risk reduction", "competitive advantage"],
      include_in_demo: ["executive dashboards", "KPIs", "high-level workflows", "business outcomes", "strategic impact", "time-to-value"],
      avoid_in_demo: ["low-level technical detail", "too many clicks", "configuration walkthroughs", "feature-by-feature demonstrations"],
      demo_style: ["concise", "strategic", "high-level", "business-first"]
    },
    {
      id: "operational",
      label: "Operational / End User",
      description: "Daily users focused on productivity, usability, efficiency, and simplifying routine work.",
      primary_focus: ["ease of use", "workflow efficiency", "time savings", "daily productivity", "reduced manual work"],
      include_in_demo: ["realistic daily workflows", "task completion scenarios", "automation", "mobile usability", "simplified navigation", "collaboration features"],
      avoid_in_demo: ["executive strategy discussions", "deep architecture", "excessive technical jargon", "long theoretical explanations"],
      demo_style: ["hands-on", "practical", "workflow-centric", "user-focused"]
    },
    {
      id: "technical",
      label: "Technical",
      description: "Architects, developers, administrators, and IT stakeholders evaluating technical capabilities and implementation fit.",
      primary_focus: ["architecture", "security", "APIs", "integrations", "performance", "extensibility", "administration"],
      include_in_demo: ["architecture diagrams", "API examples", "integration flows", "security model", "permissions", "configuration flexibility", "data flow examples"],
      avoid_in_demo: ["marketing-only messaging", "avoiding technical limitations", "oversimplified explanations", "non-technical buzzwords"],
      demo_style: ["detailed", "transparent", "technical", "interactive"]
    },
    {
      id: "customer",
      label: "Customer",
      description: "Existing customers evaluating additional capabilities, optimization opportunities, or product expansion.",
      primary_focus: ["additional value", "optimization", "new features", "adoption", "expansion opportunities"],
      include_in_demo: ["new capabilities", "advanced workflows", "best practices", "optimization scenarios", "customer-specific use cases", "roadmap alignment"],
      avoid_in_demo: ["introductory product overviews", "generic positioning", "re-explaining basics", "competitive displacement messaging"],
      demo_style: ["consultative", "personalized", "evolution-focused"]
    },
    {
      id: "marketing",
      label: "Marketing",
      description: "Stakeholders focused on positioning, messaging, differentiation, customer engagement, and storytelling.",
      primary_focus: ["visual appeal", "innovation", "storytelling", "differentiation", "brand alignment", "engagement"],
      include_in_demo: ["modern UI", "high-level workflows", "AI/innovation highlights", "customer experiences", "visual storytelling", "competitive differentiation"],
      avoid_in_demo: ["deep technical configuration", "admin-heavy flows", "complex backend discussions", "implementation deep dives"],
      demo_style: ["engaging", "visual", "narrative-driven", "concise"]
    },
    {
      id: "partner",
      label: "Partner / Consultant",
      description: "Implementation partners, consultants, and system integrators evaluating deployability and extensibility.",
      primary_focus: ["implementability", "scalability", "extensibility", "repeatable delivery", "services opportunities"],
      include_in_demo: ["configuration flexibility", "deployment approaches", "integration capabilities", "partner ecosystem", "customization examples", "implementation methodology"],
      avoid_in_demo: ["pure marketing positioning", "hiding implementation complexity", "overly simplified delivery assumptions"],
      demo_style: ["consultative", "solution-oriented", "implementation-aware"]
    }
  ],
  recommendedContextVariables: [
    "industry",
    "primary_business_challenge",
    "demo_goal",
    "technical_depth",
    "stakeholder_count",
    "competitive_context",
    "current_solution",
    "urgency_level",
    "deployment_preference",
    "AI_interest_level"
  ],
  recommendedDemoGoals: [
    "awareness",
    "discovery",
    "executive_alignment",
    "technical_validation",
    "competitive_replacement",
    "expansion_opportunity",
    "user_training",
    "solution_workshop",
    "proof_of_concept",
    "implementation_planning"
  ]
};

await loadCmsContentIntoRuntime();

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/") return html(response);
    if (request.method === "GET" && request.url === "/api/cms/status") return json(response, await cmsStatus(request));
    if (request.method === "POST" && request.url === "/api/cms/setup") {
      const body = await readBody(request);
      const result = await setupCmsAdmin(body, request);
      return json(response, result.payload, 200, result.headers);
    }
    if (request.method === "POST" && request.url === "/api/cms/login") {
      const body = await readBody(request);
      const result = await loginCmsAdmin(body, request);
      return json(response, result.payload, 200, result.headers);
    }
    if (request.method === "POST" && request.url === "/api/cms/logout") {
      await destroyCmsSession(request);
      return json(response, { ok: true, authenticated: false }, 200, { "Set-Cookie": clearCmsSessionCookie() });
    }
    if (request.method === "GET" && request.url === "/api/cms") {
      await requireCmsAuth(request);
      return json(response, await cmsPayload());
    }
    if (request.method === "POST" && request.url === "/api/cms/save") {
      await requireCmsAuth(request);
      const body = await readBody(request);
      return json(response, await saveCmsBlock(body));
    }
    if (request.method === "POST" && request.url === "/api/cms/restore") {
      await requireCmsAuth(request);
      const body = await readBody(request);
      return json(response, await restoreCmsVersion(body.file));
    }
    if (request.method === "GET" && request.url === "/api/manifest") return json(response, await manifestPayload());
    if (request.method === "GET" && request.url === "/api/intelligence") {
      const manifest = await readManifest();
      const guide = await readOrGenerateScGuide(manifest);
      return json(response, { ok: true, intelligence: demoIntelligencePayload(manifest, guide) });
    }
    if (request.method === "GET" && request.url === "/api/versions") return json(response, { versions: await listVersions() });
    if (request.method === "GET" && request.url === "/api/run-state") return json(response, runState());
    if (request.method === "GET" && request.url?.startsWith("/api/voices")) {
      const provider = new URL(request.url, "http://localhost").searchParams.get("provider") || "say";
      return json(response, await listVoices(provider));
    }
    if (request.method === "POST" && request.url === "/api/voices") {
      const body = await readBody(request);
      return json(response, await listVoices(body.provider, body.apiKey));
    }
    if (request.method === "GET" && request.url === "/api/sc-guide") {
      const manifest = await readManifest();
      const guide = await readOrGenerateScGuide(manifest);
      return json(response, { guide, guideOutputs: guideOutputsPayload(manifest, guide) });
    }
    if (request.method === "GET" && request.url === "/api/setup-prompt") {
      const manifest = await readManifest();
      return json(response, { ok: true, setupPrompt: setupPromptPayload(manifest) });
    }
    if (request.method === "POST" && request.url === "/api/intelligence/follow-up-questions") {
      const manifest = await readManifest();
      const guide = await readOrGenerateScGuide(manifest);
      const intelligence = demoIntelligencePayload(manifest, guide);
      return json(response, { ok: true, questions: followUpQuestionsFromIntelligence(intelligence, manifest, guide) });
    }
    if (request.method === "POST" && request.url === "/api/intelligence/improve-guide") {
      const manifest = await readManifest();
      const guide = await readOrGenerateScGuide(manifest);
      const intelligence = demoIntelligencePayload(manifest, guide);
      const improvedGuide = await writeImprovedScGuide(manifest, guide, intelligence);
      return json(response, {
        ok: true,
        guide: improvedGuide,
        guideOutputs: guideOutputsPayload(manifest, improvedGuide),
        intelligence: demoIntelligencePayload(manifest, improvedGuide)
      });
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
      const guide = await readOrGenerateScGuide(parsedManifest);
      return json(response, { ok: true, manifest: JSON.parse(nextManifest), versions: await listVersions(), namedManifestPath, guideOutputs: guideOutputsPayload(parsedManifest, guide), setupPrompt: setupPromptPayload(parsedManifest), intelligence: demoIntelligencePayload(parsedManifest, guide) });
    }

    if (request.method === "POST" && request.url === "/api/manifest/from-guide") {
      await saveVersion("before-manifest-from-guide");
      const manifest = await readManifest();
      const guide = await readOrGenerateScGuide(manifest);
      const nextManifest = applyGuideToRunnableManifest(manifest, guide);
      await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
      const namedManifestPath = await writeNamedManifestCopy(nextManifest);
      return json(response, { ok: true, manifest: nextManifest, versions: await listVersions(), namedManifestPath, guideOutputs: guideOutputsPayload(nextManifest, guide), setupPrompt: setupPromptPayload(nextManifest), intelligence: demoIntelligencePayload(nextManifest, guide) });
    }

    if (request.method === "POST" && request.url === "/api/learn") {
      const body = await readBody(request);
      await saveVersion("before-learn");
      const manifest = await readManifest();
      const company = await analyseCompany(body.companyUrl, notesForCompanyAnalysis(body));
      const learned = applyLearningRequest(manifest, body, company);
      const guide = await writeScGuide(learned, body, company);
      const finalManifest = body.createRunnableManifest
        ? applyGuideToRunnableManifest(learned, guide)
        : markManifestGuideOnly(learned);
      await writeFile(manifestPath, `${JSON.stringify(finalManifest, null, 2)}\n`, "utf8");
      const namedManifestPath = await writeNamedManifestCopy(finalManifest);
      return json(response, { ok: true, manifest: finalManifest, versions: await listVersions(), company, guide, guideOutputs: guideOutputsPayload(finalManifest, guide), namedManifestPath, setupPrompt: setupPromptPayload(finalManifest), intelligence: demoIntelligencePayload(finalManifest, guide), runnableManifestCreated: Boolean(body.createRunnableManifest) });
    }

    if (request.method === "POST" && request.url === "/api/restore") {
      const body = await readBody(request);
      await saveVersion("before-restore");
      const source = safeVersionPath(body.file);
      await writeFile(manifestPath, await readFile(source, "utf8"), "utf8");
      const manifest = await readManifest();
      const guide = await readOrGenerateScGuide(manifest);
      return json(response, { ok: true, manifest, versions: await listVersions(), guideOutputs: guideOutputsPayload(manifest, guide), setupPrompt: setupPromptPayload(manifest), intelligence: demoIntelligencePayload(manifest, guide) });
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
    const status = error.statusCode || error.status || 500;
    json(response, { ok: false, error: error.message }, status);
  }
});

server.listen(port, () => {
  console.log(`NetSuite Demo Helper: http://localhost:${port}`);
});

async function manifestPayload() {
  const manifest = await readManifest();
  const guide = await readOrGenerateScGuide(manifest);
  return {
    manifest,
    versions: await listVersions(),
    guide,
    guideOutputs: guideOutputsPayload(manifest, guide),
    setupPrompt: setupPromptPayload(manifest),
    intelligence: demoIntelligencePayload(manifest, guide)
  };
}

async function loadCmsContentIntoRuntime() {
  const content = await readCmsContent();
  applyCmsContentToRuntime(content);
}

async function cmsStatus(request) {
  const setupRequired = !(await cmsAdminExists());
  return {
    ok: true,
    setupRequired,
    authenticated: setupRequired ? false : await isCmsAuthenticated(request),
    security: {
      passwordStorage: "scrypt salted hash",
      session: "http-only same-site cookie",
      versioning: "every CMS edit creates a restore point"
    }
  };
}

async function cmsPayload() {
  const content = await readCmsContent();
  return {
    ok: true,
    content,
    blocks: cmsBlocksForUi(content),
    versions: await listCmsVersions()
  };
}

async function setupCmsAdmin(body, request) {
  if (await cmsAdminExists()) throw httpError("CMS admin has already been set up.", 409);
  const password = String(body.password || "");
  assertStrongCmsPassword(password);
  const passwordHash = await hashCmsPassword(password);
  await mkdir(path.dirname(cmsAdminPath), { recursive: true });
  await writeFile(cmsAdminPath, `${JSON.stringify({
    createdAt: new Date().toISOString(),
    password: passwordHash
  }, null, 2)}\n`, "utf8");
  const session = await createCmsSession(request);
  return {
    payload: { ok: true, authenticated: true, setupRequired: false },
    headers: { "Set-Cookie": session.cookie }
  };
}

async function loginCmsAdmin(body, request) {
  const admin = await readCmsAdmin();
  const valid = await verifyCmsPassword(String(body.password || ""), admin.password);
  if (!valid) throw httpError("Incorrect admin password.", 401);
  const session = await createCmsSession(request);
  return {
    payload: { ok: true, authenticated: true, setupRequired: false },
    headers: { "Set-Cookie": session.cookie }
  };
}

async function saveCmsBlock(body) {
  const blockId = String(body.blockId || "").trim();
  const rawValue = String(body.rawValue ?? "");
  const changeNote = String(body.changeNote || "").trim();
  const content = await readCmsContent();
  const block = content.blocks?.[blockId];
  if (!block) throw httpError("Choose a valid CMS content block.", 400);
  await saveCmsVersion(`before-${blockId}`);
  block.value = parseCmsBlockValue(block, rawValue);
  block.updatedAt = new Date().toISOString();
  content.updatedAt = block.updatedAt;
  content.history = [
    {
      id: randomBytes(8).toString("hex"),
      blockId,
      label: block.label,
      note: changeNote || "Content block updated",
      changedAt: block.updatedAt
    },
    ...(content.history || [])
  ].slice(0, 80);
  await writeCmsContent(content);
  applyCmsContentToRuntime(content);
  return {
    ok: true,
    content,
    blocks: cmsBlocksForUi(content),
    versions: await listCmsVersions()
  };
}

async function restoreCmsVersion(file) {
  await saveCmsVersion("before-cms-restore");
  const restored = JSON.parse(await readFile(safeCmsVersionPath(file), "utf8"));
  const content = normalizeCmsContent(restored);
  content.updatedAt = new Date().toISOString();
  content.history = [
    {
      id: randomBytes(8).toString("hex"),
      blockId: "restore",
      label: "CMS restore",
      note: `Restored CMS content from ${path.basename(String(file || ""))}`,
      changedAt: content.updatedAt
    },
    ...(content.history || [])
  ].slice(0, 80);
  await writeCmsContent(content);
  applyCmsContentToRuntime(content);
  return {
    ok: true,
    content,
    blocks: cmsBlocksForUi(content),
    versions: await listCmsVersions()
  };
}

async function readCmsContent() {
  try {
    return normalizeCmsContent(JSON.parse(await readFile(cmsContentPath, "utf8")));
  } catch {
    const content = defaultCmsContent();
    await writeCmsContent(content);
    return content;
  }
}

async function writeCmsContent(content) {
  await mkdir(path.dirname(cmsContentPath), { recursive: true });
  await writeFile(cmsContentPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
}

function defaultCmsContent() {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    updatedAt: now,
    blocks: {
      defaultScInstructions: cmsTextBlock("Default SC Instructions", "The baseline guidance pre-filled into the Prep screen.", defaultScInstructions(), now),
      helperIntro: cmsTextBlock("How The Helper Works Intro", "The short explanation shown on the Prep page.", helperIntroText(), now),
      helperSteps: cmsJsonBlock("How The Helper Works Steps", "The explanation steps shown on the Prep page.", helperSteps(), now),
      additionalDemoSources: cmsJsonBlock("Additional Sources / Demo Logic", "Add internal playbooks, source notes, reusable rules, and generation logic the helper should consider when creating demos.", defaultAdditionalDemoSources(), now),
      demoStrategies: cmsJsonBlock("Demo Strategies", "Selectable demo strategy playbooks and behavior rules.", demoStrategies, now),
      industryPlaybooks: cmsJsonBlock("Industry Playbooks", "Industry-specific terminology, KPIs, workflows, pain points, and avoid rules.", industryPlaybooks, now),
      targetAudiences: cmsJsonBlock("Target Audiences", "Company-size/segment playbooks such as Startup, Mid-Market, and Enterprise.", demoAudienceConfiguration.targetAudiences, now),
      audienceTypes: cmsJsonBlock("Audience Types", "Stakeholder/audience type playbooks such as Prospect, Executive, Technical, Customer, and Marketing.", demoAudienceConfiguration.audienceTypes, now),
      recommendedContextVariables: cmsJsonBlock("Recommended Context Variables", "Discovery variables the helper should consider.", demoAudienceConfiguration.recommendedContextVariables, now),
      recommendedDemoGoals: cmsJsonBlock("Recommended Demo Goals", "Demo goal options used by audience guidance.", demoAudienceConfiguration.recommendedDemoGoals, now),
      manifestDemoModes: cmsJsonBlock("Manifest Demo Options", "Plain demo versus customer-story behavior.", manifestDemoModes, now),
      outputLanguages: cmsJsonBlock("Output Languages", "Language choices available in Prep.", outputLanguages, now)
    },
    history: []
  };
}

function normalizeCmsContent(content) {
  const defaults = defaultCmsContent();
  const normalized = {
    ...defaults,
    ...content,
    blocks: { ...defaults.blocks, ...(content?.blocks || {}) },
    history: Array.isArray(content?.history) ? content.history : []
  };
  for (const [id, fallback] of Object.entries(defaults.blocks)) {
    const existing = normalized.blocks[id] || {};
    normalized.blocks[id] = {
      id,
      kind: fallback.kind,
      label: fallback.label,
      description: fallback.description,
      value: existing.value ?? fallback.value,
      updatedAt: existing.updatedAt || fallback.updatedAt
    };
  }
  return normalized;
}

function cmsTextBlock(label, description, value, updatedAt) {
  return { id: "", kind: "text", label, description, value: String(value || ""), updatedAt };
}

function cmsJsonBlock(label, description, value, updatedAt) {
  return { id: "", kind: "json", label, description, value: structuredClone(value), updatedAt };
}

function cmsBlocksForUi(content) {
  return Object.entries(content.blocks || {}).map(([id, block]) => ({
    id,
    kind: block.kind,
    label: block.label,
    description: block.description,
    updatedAt: block.updatedAt,
    value: block.value
  }));
}

function parseCmsBlockValue(block, rawValue) {
  if (block.kind === "text") {
    const value = String(rawValue || "").trim();
    if (!value) throw httpError("Text content cannot be blank.", 400);
    return value;
  }
  try {
    const parsed = JSON.parse(rawValue);
    validateCmsJsonBlock(block, parsed);
    return parsed;
  } catch (error) {
    if (error.statusCode) throw error;
    throw httpError(`Invalid JSON: ${error.message}`, 400);
  }
}

function validateCmsJsonBlock(block, value) {
  const id = block.id;
  if (["demoStrategies", "industryPlaybooks", "targetAudiences", "audienceTypes", "manifestDemoModes", "helperSteps", "additionalDemoSources"].includes(id)) {
    if (!Array.isArray(value)) throw httpError(`${block.label} must be a JSON array.`, 400);
    for (const item of value) {
      if (!item || typeof item !== "object") throw httpError(`${block.label} entries must be objects.`, 400);
      if (id === "helperSteps") {
        if (!item.title || !item.body) throw httpError("Each helper step needs title and body.", 400);
      } else if (id === "additionalDemoSources") {
        if (!item.id || !item.label) throw httpError("Each additional source needs id and label.", 400);
        if (!item.content && !item.guidance && !item.logic) throw httpError("Each additional source needs content, guidance, or logic.", 400);
      } else if (!item.id || !item.label) {
        throw httpError(`Each ${block.label} entry needs id and label.`, 400);
      }
    }
  }
  if (["recommendedContextVariables", "recommendedDemoGoals"].includes(id) && !Array.isArray(value)) {
    throw httpError(`${block.label} must be a JSON array.`, 400);
  }
  if (id === "outputLanguages" && (!value || typeof value !== "object" || Array.isArray(value))) {
    throw httpError("Output Languages must be a JSON object keyed by language code.", 400);
  }
}

function applyCmsContentToRuntime(content) {
  const blocks = content.blocks || {};
  defaultScInstructionsOverride = String(blocks.defaultScInstructions?.value || "").trim();
  helperIntroOverride = String(blocks.helperIntro?.value || "").trim();
  helperStepsOverride = Array.isArray(blocks.helperSteps?.value) ? structuredClone(blocks.helperSteps.value) : null;
  additionalDemoSources = Array.isArray(blocks.additionalDemoSources?.value) ? structuredClone(blocks.additionalDemoSources.value) : [];
  if (Array.isArray(blocks.demoStrategies?.value)) demoStrategies = structuredClone(blocks.demoStrategies.value);
  if (Array.isArray(blocks.industryPlaybooks?.value)) industryPlaybooks = structuredClone(blocks.industryPlaybooks.value);
  if (Array.isArray(blocks.manifestDemoModes?.value)) manifestDemoModes = structuredClone(blocks.manifestDemoModes.value);
  if (blocks.outputLanguages?.value && typeof blocks.outputLanguages.value === "object" && !Array.isArray(blocks.outputLanguages.value)) {
    outputLanguages = structuredClone(blocks.outputLanguages.value);
  }
  demoAudienceConfiguration = {
    ...demoAudienceConfiguration,
    targetAudiences: Array.isArray(blocks.targetAudiences?.value) ? structuredClone(blocks.targetAudiences.value) : demoAudienceConfiguration.targetAudiences,
    audienceTypes: Array.isArray(blocks.audienceTypes?.value) ? structuredClone(blocks.audienceTypes.value) : demoAudienceConfiguration.audienceTypes,
    recommendedContextVariables: Array.isArray(blocks.recommendedContextVariables?.value) ? structuredClone(blocks.recommendedContextVariables.value) : demoAudienceConfiguration.recommendedContextVariables,
    recommendedDemoGoals: Array.isArray(blocks.recommendedDemoGoals?.value) ? structuredClone(blocks.recommendedDemoGoals.value) : demoAudienceConfiguration.recommendedDemoGoals
  };
}

async function saveCmsVersion(label) {
  await mkdir(cmsVersionsDir, { recursive: true });
  const content = await readCmsContent();
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const safeLabel = String(label || "cms-version").replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const file = `${stamp}-${safeLabel}.json`;
  await writeFile(path.join(cmsVersionsDir, file), `${JSON.stringify(content, null, 2)}\n`, "utf8");
  return file;
}

async function listCmsVersions() {
  await mkdir(cmsVersionsDir, { recursive: true });
  return (await readdir(cmsVersionsDir)).filter((file) => file.endsWith(".json")).sort().reverse();
}

function safeCmsVersionPath(file) {
  const clean = path.basename(String(file || ""));
  if (!clean.endsWith(".json")) throw httpError("Choose a JSON CMS version.", 400);
  return path.join(cmsVersionsDir, clean);
}

async function cmsAdminExists() {
  try {
    await readFile(cmsAdminPath, "utf8");
    return true;
  } catch {
    return false;
  }
}

async function readCmsAdmin() {
  try {
    return JSON.parse(await readFile(cmsAdminPath, "utf8"));
  } catch {
    throw httpError("Set up the CMS admin password first.", 401);
  }
}

function assertStrongCmsPassword(password) {
  if (password.length < 12) throw httpError("Use an admin password of at least 12 characters.", 400);
}

async function hashCmsPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return {
    algorithm: "scrypt",
    salt,
    hash: Buffer.from(derived).toString("hex")
  };
}

async function verifyCmsPassword(password, record) {
  if (!record?.salt || !record?.hash) return false;
  const derived = Buffer.from(await scryptAsync(password, record.salt, 64));
  const expected = Buffer.from(record.hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

async function createCmsSession(request) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const sessions = await readCmsSessions();
  const tokenHash = hashToken(token);
  sessions[tokenHash] = {
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 8 * 60 * 60 * 1000).toISOString()
  };
  await writeCmsSessions(pruneCmsSessions(sessions));
  return { cookie: cmsSessionCookie(token, request) };
}

async function isCmsAuthenticated(request) {
  try {
    await requireCmsAuth(request);
    return true;
  } catch {
    return false;
  }
}

async function requireCmsAuth(request) {
  const token = parseCookies(request.headers.cookie).nsdh_admin_session;
  if (!token) throw httpError("CMS login required.", 401);
  const sessions = pruneCmsSessions(await readCmsSessions());
  const session = sessions[hashToken(token)];
  if (!session) throw httpError("CMS login required.", 401);
  await writeCmsSessions(sessions);
  return true;
}

async function destroyCmsSession(request) {
  const token = parseCookies(request.headers.cookie).nsdh_admin_session;
  if (!token) return;
  const sessions = await readCmsSessions();
  delete sessions[hashToken(token)];
  await writeCmsSessions(sessions);
}

async function readCmsSessions() {
  try {
    return JSON.parse(await readFile(cmsSessionsPath, "utf8"));
  } catch {
    return {};
  }
}

async function writeCmsSessions(sessions) {
  await mkdir(path.dirname(cmsSessionsPath), { recursive: true });
  await writeFile(cmsSessionsPath, `${JSON.stringify(sessions, null, 2)}\n`, "utf8");
}

function pruneCmsSessions(sessions) {
  const now = Date.now();
  return Object.fromEntries(Object.entries(sessions || {}).filter(([, session]) => Date.parse(session.expiresAt || "") > now));
}

function cmsSessionCookie(token, request) {
  const secure = request.headers["x-forwarded-proto"] === "https" || request.socket.encrypted;
  return [
    `nsdh_admin_session=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=28800",
    secure ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

function clearCmsSessionCookie() {
  return "nsdh_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0";
}

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(String(cookieHeader || "").split(";").map((part) => {
    const [name, ...rest] = part.trim().split("=");
    return [name, rest.join("=")];
  }).filter(([name]) => name));
}

function hashToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

function httpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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
  if (defaultScInstructionsOverride) return defaultScInstructionsOverride;
  return [
    "Lead with the audience's business problem and desired outcome before showing screens.",
    "Start with a short general or executive NetSuite overview, then move from the highest-value proof moments to supporting detail.",
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

function helperIntroText() {
  return helperIntroOverride || "The tool uses Codex-style reasoning plus editable SC playbooks to turn company context, discovery notes, audience choices, and demo strategy into practical demo assets.";
}

function helperSteps() {
  return helperStepsOverride || [
    { title: "1. Brief", body: "Add the company site, demo request, discovery notes, and SC instructions." },
    { title: "2. Shape", body: "Choose audience type, target segment, strategy, industry, language, and story mode." },
    { title: "3. Learn", body: "The helper interprets the context and infers likely ERP priorities and demo pressure points." },
    { title: "4. Generate", body: "It creates an editable manifest with navigation, narration, proof points, and safe actions." },
    { title: "5. Check", body: "The Intelligence tab scores risk, discovery gaps, pacing, stakeholders, and winning moments." },
    { title: "6. Coach", body: "The SC guide gives the demo story, talk track, setup prompt, and asset prompt." },
    { title: "7. Rehearse", body: "Rehearsal checks routes, buffers account prep, captures timing, and warms the flow." },
    { title: "8. Run", body: "The live demo drives NetSuite and narrates with the selected voice engine." }
  ];
}

function helperStepsHtml() {
  return helperSteps().map((step) => `<div class="step"><strong>${escapeHtml(step.title)}</strong><span>${escapeHtml(step.body)}</span></div>`).join("");
}

function defaultAdditionalDemoSources() {
  return [
    {
      id: "standard-reports-first",
      label: "Use Standard NetSuite Reports First",
      sourceType: "SC best practice",
      active: true,
      appliesTo: ["finance", "prospect", "standard_platform_demo"],
      content: "For prospect-facing finance demos, prioritize standard NetSuite reports and dashboards before custom reporting or saved-search detail.",
      guidance: "Use this as a routing and narration rule when the demo touches financial reporting, P&L, drilldown, export, or cash visibility.",
      logic: "If the demo asks for reporting or finance visibility, keep standard reports in the primary path and park custom reporting as an optional follow-up."
    }
  ];
}

function activeAdditionalDemoSources(context = {}) {
  const searchable = [
    context.topic,
    context.preDemoNotes,
    context.demoScope,
    context.audience?.label,
    context.audience?.value,
    context.marketSegment?.label,
    context.marketSegment?.value,
    context.demoStrategy?.label,
    context.demoStrategy?.id,
    context.industry?.label,
    context.industry?.id
  ].filter(Boolean).join(" ").toLowerCase();

  return additionalDemoSources
    .filter((source) => source && source.active !== false)
    .filter((source) => {
      const appliesTo = Array.isArray(source.appliesTo) ? source.appliesTo : [];
      if (!appliesTo.length) return true;
      return appliesTo.some((term) => searchable.includes(String(term || "").toLowerCase()));
    })
    .slice(0, 12);
}

function additionalDemoSourcesSummary(sources = []) {
  return (sources || [])
    .filter(Boolean)
    .map((source) => {
      const text = source.guidance || source.logic || source.content || "";
      return `${source.label}: ${text}`;
    })
    .join(" ");
}

function additionalDemoSourcesMarkdown(sources = []) {
  const clean = (sources || []).filter(Boolean);
  if (!clean.length) return "- No additional Admin sources matched this demo context.";
  return clean.map((source) => [
    `- ${source.label}${source.sourceType ? ` (${source.sourceType})` : ""}`,
    source.content ? `  - Source note: ${source.content}` : "",
    source.guidance ? `  - Guidance: ${source.guidance}` : "",
    source.logic ? `  - Logic: ${source.logic}` : ""
  ].filter(Boolean).join("\n")).join("\n");
}

async function readScGuide() {
  try {
    return await readFile(scGuidePath, "utf8");
  } catch {
    return "";
  }
}

async function readOrGenerateScGuide(manifest) {
  const existing = await readScGuide();
  if (existing.includes("## Personalized Demo Story And Runbook")
    && existing.includes("## Demo Asset Generation Prompt")
    && existing.includes("Narrative asset brief")) {
    return existing;
  }

  const guide = generateScGuide(manifest, manifest.context?.demoRequest || {}, manifest.context?.company || {});
  await mkdir(path.dirname(scGuidePath), { recursive: true });
  await writeFile(scGuidePath, guide, "utf8");
  return guide;
}

async function exportScGuideDocx() {
  const manifest = await readManifest();
  const guide = await readOrGenerateScGuide(manifest);
  if (!guide.trim()) throw new Error("Create an SC guide before exporting to Word.");
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
  const demoScope = String(body.demoScope || "").trim();
  const rawPreDemoNotes = String(body.preDemoNotes || "").trim();
  const preDemoNotes = inputMode === "request-only" ? "" : rawPreDemoNotes;
  const rawTopic = String(body.topic || "").trim();
  const inferredOrRequestedTopic = inputMode === "notes-only"
    ? inferDemoRequestFromNotes(preDemoNotes, company)
    : rawTopic || inferDemoRequestFromNotes(preDemoNotes, company);
  const topic = demoScope && !inferredOrRequestedTopic.toLowerCase().includes(demoScope.toLowerCase())
    ? `${inferredOrRequestedTopic} Demo scope: ${demoScope}.`
    : inferredOrRequestedTopic;
  const voice = String(body.voice || "Moira").trim();
  const voiceProvider = normalizeVoiceProvider(body.voiceProvider);
  const audience = normalizeAudience(body.audience);
  const marketSegment = normalizeMarketSegment(body.marketSegment);
  const outputLanguage = normalizeOutputLanguage(body.outputLanguage);
  const manifestDemoMode = normalizeManifestDemoMode(body.manifestDemoMode || body.demoMode);
  const demoStrategy = normalizeDemoStrategy(body.demoStrategy || body.strategy);
  const industry = normalizeIndustry(body.industry);
  const flowPrinciples = demoFlowPrinciples({ demoScope, audience, marketSegment, demoStrategy, industry });
  const adminSources = activeAdditionalDemoSources({ topic, preDemoNotes, demoScope, audience, marketSegment, demoStrategy, industry });
  const adminSourceInstruction = additionalDemoSourcesSummary(adminSources);

  const next = structuredClone(manifest);
  next.audience = `${audience.label} - ${marketSegment.label}`;
  next.defaults = next.defaults || {};
  next.defaults.valueStatementIntensity = valueIntensity;
  next.defaults.outputLanguage = outputLanguage.value;
  next.defaults.manifestDemoMode = manifestDemoMode.id;
  next.defaults.demoStrategy = demoStrategy.id;
  next.defaults.industry = industry.id;
  next.defaults.audio = next.defaults.audio || {};
  next.defaults.audio.provider = voiceProvider;
  next.defaults.audio.voice = voice;
  next.context = next.context || {};
  next.context.company = company;
  next.context.preDemoNotes = preDemoNotes;
  next.context.demoScope = demoScope;
  next.context.audience = audience;
  next.context.marketSegment = marketSegment;
  next.context.targetAudience = marketSegment;
  next.context.manifestDemoMode = manifestDemoMode;
  next.context.demoStrategy = demoStrategy;
  next.context.industry = industry;
  next.context.additionalDemoSources = adminSources;
  next.context.demoPrep = flowPrinciples;
  next.context.outputLanguage = {
    ...outputLanguage,
    instruction: outputLanguageInstruction(outputLanguage)
  };
  next.context.audiencePlaybook = buildAudiencePlaybook(audience, marketSegment);
  next.context.setupPlan = inferSetupPlan({ topic, preDemoNotes, instructions, demoScope }, company, audience, marketSegment);
  next.context.demoRequest = {
    topic,
    demoScope,
    audience: audience.value,
    marketSegment: marketSegment.value,
    targetAudience: marketSegment.value,
    outputLanguage: outputLanguage.value,
    manifestDemoMode: manifestDemoMode.id,
    manifestDemoModeLabel: manifestDemoMode.label,
    manifestDemoModeInstruction: manifestDemoMode.instruction,
    demoStrategy: demoStrategy.id,
    demoStrategyLabel: demoStrategy.label,
    demoStrategyInstruction: demoStrategyInstruction(demoStrategy, industry),
    industry: industry.id,
    industryLabel: industry.label,
    industryInstruction: industryInstruction(industry),
    outputLanguageInstruction: outputLanguageInstruction(outputLanguage),
    audienceInstruction: audienceExecutionInstruction(audience, marketSegment),
    inputMode,
    source: inputModeSource(inputMode),
    instructions,
    additionalDemoSources: adminSources,
    learnedAt: new Date().toISOString(),
    instruction: `Use NetSuite navigation/search first, use standard reports for prospect-facing demos, and keep custom report links only as explicit fallbacks. Start with a short general or executive NetSuite overview, then order the demo from highest-value proof moments to supporting detail. Demo scope: ${demoScope || "Use the generated request and notes as scope."} ${audienceExecutionInstruction(audience, marketSegment)} ${demoStrategyInstruction(demoStrategy, industry)} ${adminSourceInstruction ? `Additional Admin logic to consider: ${adminSourceInstruction}` : ""}`
  };
  next.context.navigationPolicy = {
    preferred: ["NetSuite global search", "NetSuite navigation bar"],
    avoid: ["custom saved reports for prospect demos", "deep links unless used as fallback after a learned route"],
    reportPolicy: "Use standard NetSuite reports for prospect-facing demos unless the user explicitly asks for a custom report."
  };

  const mappedSegments = next.segments.map((segment) => {
    if (segment.id === "open-pl") {
      return {
        ...segment,
        title: "Open The Standard Income Statement",
        objective: "Use NetSuite search/navigation to open a standard profitability report.",
        valueStatement: manifestDemoMode.id === "plain_demo" ? standardValueLine("reporting") : companyValueLine(company, "reporting"),
        narration: openingNarration(audience, company, manifestDemoMode),
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
        valueStatement: manifestDemoMode.id === "plain_demo" ? standardValueLine("filters") : companyValueLine(company, "filters"),
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

    return {
      ...segment,
      narration: manifestDemoMode.id === "plain_demo" ? plainDemoNarration(segment) : prospectTone(segment.narration)
    };
  });
  next.segments = prioritizeDemoSegments(ensureOpeningOverviewSegment(mappedSegments, {
    company,
    audience,
    marketSegment,
    demoScope,
    manifestDemoMode,
    demoStrategy,
    industry,
    flowPrinciples
  }));

  return next;
}

function demoFlowPrinciples({ demoScope, audience, marketSegment, demoStrategy, industry }) {
  const strategy = normalizeDemoStrategy(demoStrategy?.id || demoStrategy);
  const industryPlaybook = normalizeIndustry(industry?.id || industry);
  const scope = String(demoScope || "").trim();
  const scopeLine = scope
    ? `Stay inside this demo scope unless the SC deliberately branches: ${scope}.`
    : "Use the demo request and discovery notes as scope; avoid adding modules or setup that were not requested.";

  return {
    scope: scope || "",
    opening: "Start with a short general or executive NetSuite overview before the first detailed workflow.",
    ordering: "Order the demo from strongest business impact to supporting detail: executive overview, trusted reporting, filters, drilldown, export, cash visibility, forecast controls, then close.",
    scopeInstruction: scopeLine,
    audienceInstruction: audienceExecutionInstruction(audience, marketSegment),
    strategyInstruction: demoStrategyInstruction(strategy, industryPlaybook),
    principles: [
      "Start with the general NetSuite story and why the platform matters to leadership.",
      "Show the highest-value proof moments before lower-level configuration or optional detail.",
      "Use the stated demo scope as a hard planning input even when the notes do not mention it.",
      "Keep standard NetSuite reports and navigation in the main path.",
      "Defer lower-value or out-of-scope topics to Q&A or appendix."
    ]
  };
}

function ensureOpeningOverviewSegment(segments, context) {
  const overview = executiveOverviewSegment(context);
  const remaining = (segments || []).filter((segment) => segment.id !== overview.id);
  return [overview, ...remaining];
}

function executiveOverviewSegment({ company, audience, marketSegment, demoScope, manifestDemoMode, demoStrategy, industry, flowPrinciples }) {
  const companyName = company?.companyName || "the prospect";
  const mode = normalizeManifestDemoMode(manifestDemoMode?.id || manifestDemoMode);
  const strategy = normalizeDemoStrategy(demoStrategy?.id || demoStrategy);
  const industryPlaybook = normalizeIndustry(industry?.id || industry);
  const scopeLine = demoScope
    ? ` Keep the live path inside this scope: ${demoScope}.`
    : " Keep the live path focused on the generated request and the discovery-backed priorities.";
  const narration = mode.id === "plain_demo"
    ? `Before we open the first report, start with the executive view of NetSuite: one platform for finance visibility, operational control, and decisions. We will begin with the highest-value proof points, then move into the detail only where it helps the audience trust the flow.${scopeLine}`
    : `Before we open the first report, frame the executive view for ${companyName}: NetSuite is the operating system where finance can see performance, prove the detail, and understand cash from one controlled place. We will start with the highest-value proof moments, then move into supporting detail.${scopeLine}`;

  return {
    id: "executive-overview",
    title: "Frame The Executive NetSuite Overview",
    objective: "Set up the general NetSuite platform story before opening detailed finance workflows.",
    valueStatement: `${companyName} first sees why NetSuite matters at the executive level: visibility, control, trusted numbers, and a clear path from performance to cash decisions.`,
    narration,
    actions: [
      {
        type: "note",
        text: `Executive overview. Audience: ${audience.label}. Target: ${marketSegment.label}. Strategy: ${strategy.label}. Industry: ${industryPlaybook.label}. ${flowPrinciples?.scopeInstruction || ""}`
      },
      { type: "wait", ms: 400 }
    ],
    verifications: []
  };
}

function prioritizeDemoSegments(segments) {
  const preferredOrder = new Map([
    ["executive-overview", 0],
    ["open-pl", 10],
    ["pl-executive-readout", 20],
    ["pl-filters", 30],
    ["pl-drilldown", 40],
    ["pl-export-options", 50],
    ["open-cash360-dashboard", 60],
    ["cash360-actions", 70],
    ["cash360-forecast", 80],
    ["cash360-preferences", 90],
    ["close", 100]
  ]);

  return (segments || [])
    .map((segment, index) => ({ segment, index }))
    .sort((left, right) => {
      const leftRank = preferredOrder.get(left.segment.id) ?? 500 + left.index;
      const rightRank = preferredOrder.get(right.segment.id) ?? 500 + right.index;
      return leftRank === rightRank ? left.index - right.index : leftRank - rightRank;
    })
    .map((item) => item.segment);
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
  if (voiceProviders[provider]) return provider;
  return "say";
}

function voiceProviderConfig(value) {
  return voiceProviders[normalizeVoiceProvider(value)];
}

function effectiveProviderApiKey(provider, suppliedKey = "") {
  const config = voiceProviderConfig(provider);
  if (!config.requiresApiKey) return "";
  return String(suppliedKey || "").trim() || process.env[config.apiKeyEnv] || "";
}

function providerRuntimeEnv(provider, suppliedKey = "") {
  const config = voiceProviderConfig(provider);
  const apiKey = effectiveProviderApiKey(provider, suppliedKey);
  return config.requiresApiKey && apiKey ? { [config.apiKeyEnv]: apiKey } : {};
}

function normalizeOutputLanguage(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (outputLanguages[raw]) return outputLanguages[raw];
  const byLabel = Object.values(outputLanguages).find((language) => language.label.toLowerCase() === raw);
  return byLabel || outputLanguages[defaultOutputLanguage];
}

function normalizeManifestDemoMode(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (["plain", "plain_demo", "product_demo", "standard_demo"].includes(raw)) return manifestDemoModes[0];
  if (["customer", "customer_story", "story", "personalized", "personalized_story"].includes(raw)) return manifestDemoModes[1];
  return manifestDemoModes[1];
}

function normalizeDemoStrategy(value) {
  return resolveNamedConfig(demoStrategies, value, defaultDemoStrategy, {
    discovery: "discovery_demo",
    vision: "vision_demo",
    standard: "standard_platform_demo",
    platform: "standard_platform_demo",
    "standard-platform": "standard_platform_demo",
    "standard-platform-demo": "standard_platform_demo",
    "platform-demo": "standard_platform_demo",
    executive: "executive_alignment",
    "executive-demo": "executive_alignment",
    "executive-alignment-demo": "executive_alignment",
    technical: "technical_validation",
    "technical-demo": "technical_validation",
    competitive: "competitive_defense",
    "competitive-demo": "competitive_defense",
    expansion: "expansion_demo",
    renewal: "renewal_demo",
    workshop: "workshop_session",
    poc: "proof_of_concept",
    "proof-of-concept": "proof_of_concept",
    training: "training_session"
  });
}

function normalizeIndustry(value) {
  return resolveNamedConfig(industryPlaybooks, value, defaultIndustry, {
    general: "general_business",
    "general-business": "general_business",
    unknown: "general_business",
    wholesale: "wholesale_distribution",
    distribution: "wholesale_distribution",
    "wholesale-distribution": "wholesale_distribution",
    software: "saas",
    "professional-services": "services",
    nonprofit: "nonprofit",
    "non-profit": "nonprofit",
    healthcare: "healthcare",
    health: "healthcare",
    construction: "construction",
    finance: "financial_services",
    "financial-services": "financial_services"
  });
}

function resolveNamedConfig(items, value, fallbackId, aliases = {}) {
  const raw = String(value || "").trim().toLowerCase();
  const compact = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const underscored = compact.replaceAll("-", "_");
  const aliasId = aliases[raw] || aliases[compact] || aliases[underscored] || aliases[raw.replace(/[^a-z0-9]+/g, "")];
  return items.find((item) => item.id === raw || item.id === compact || item.id === underscored || item.id === aliasId || item.label.toLowerCase() === raw)
    || items.find((item) => item.id === fallbackId)
    || items[0];
}

function outputLanguageInstruction(language) {
  const normalized = normalizeOutputLanguage(language?.value || language);
  if (normalized.value === "en") {
    return "Write SC-facing output, setup guidance, and narrator talk tracks in English.";
  }
  return `Write SC-facing output, setup guidance, and narrator talk tracks in ${normalized.label}. Preserve NetSuite product names, field labels, menu labels, report names, and account terms as they appear in the NetSuite UI.`;
}

function selectOptionsHtml(items, selectedId) {
  return items
    .map((item) => `<option value="${escapeHtml(item.id)}"${item.id === selectedId ? " selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("\n");
}

function languageOptionsHtml(selectedValue = defaultOutputLanguage) {
  const normalized = normalizeOutputLanguage(selectedValue).value;
  return Object.values(outputLanguages)
    .map((language) => `<option value="${escapeHtml(language.value)}"${language.value === normalized ? " selected" : ""}>${escapeHtml(language.label)}</option>`)
    .join("\n");
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
  const config = resolveAudienceConfig(demoAudienceConfiguration.audienceTypes, value, defaultAudienceType, {
    "existing-customer": "customer",
    "already-existing-customer": "customer",
    "already existing customer": "customer",
    "marketing-audience": "marketing",
    "operational-end-user": "operational",
    "operational / end user": "operational",
    enduser: "operational"
  });
  return audienceConfigShape(config, "audience-type");
}

function normalizeMarketSegment(value) {
  const config = resolveAudienceConfig(demoAudienceConfiguration.targetAudiences, value, defaultTargetAudience, {
    "mid-market": "mid_market",
    midmarket: "mid_market",
    "emerging-smb": "emerging",
    "emerging / smb": "emerging",
    smb: "emerging",
    "public-sector": "public_sector",
    "public-sector-government": "public_sector",
    "public sector / government": "public_sector",
    government: "public_sector"
  });
  return audienceConfigShape(config, "target-audience");
}

function resolveAudienceConfig(items, value, fallbackId, aliases = {}) {
  const raw = String(value || "").trim().toLowerCase();
  const compact = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const aliasId = aliases[raw] || aliases[compact] || aliases[raw.replace(/[^a-z0-9]+/g, "")];
  return items.find((item) => item.id === raw || item.id === compact || item.id === aliasId || item.label.toLowerCase() === raw)
    || items.find((item) => item.id === fallbackId)
    || items[0];
}

function audienceConfigShape(config, kind) {
  const primaryFocus = config.primary_focus || [];
  const includeInDemo = config.include_in_demo || [];
  const avoidInDemo = config.avoid_in_demo || [];
  const demoStyle = config.demo_style || [];
  const focusText = joinHuman(primaryFocus.slice(0, 4)) || "the audience's key decision criteria";
  const includeText = joinHuman(includeInDemo.slice(0, 4)) || "the strongest proof points";
  const avoidText = joinHuman(avoidInDemo.slice(0, 4)) || "low-value distractions";
  const styleText = joinHuman(demoStyle.slice(0, 4)) || "clear and outcome-led";

  return {
    id: config.id,
    value: config.id,
    label: config.label,
    description: config.description,
    kind,
    primaryFocus,
    includeInDemo,
    avoidInDemo,
    demoStyle,
    interests: primaryFocus,
    guideAngle: `${config.description} Focus on ${focusText}. Include ${includeText}. Avoid ${avoidText}.`,
    narratorAngle: `For ${config.label}, keep the narration ${styleText} and anchored in ${focusText}.`,
    demoBias: `For ${config.label}, use a ${styleText} demo style. Prioritize ${focusText}; include ${includeText}; avoid ${avoidText}.`
  };
}

function buildAudiencePlaybook(audience, marketSegment) {
  const interests = uniqueItems([...(audience.primaryFocus || []), ...(marketSegment.primaryFocus || [])]);
  const includeInDemo = uniqueItems([...(audience.includeInDemo || []), ...(marketSegment.includeInDemo || [])]);
  const avoidInDemo = uniqueItems([...(audience.avoidInDemo || []), ...(marketSegment.avoidInDemo || [])]);
  const demoStyle = uniqueItems([...(audience.demoStyle || []), ...(marketSegment.demoStyle || [])]);

  return {
    audienceType: audience.label,
    audienceTypeId: audience.value,
    audienceDescription: audience.description,
    targetAudience: marketSegment.label,
    targetAudienceId: marketSegment.value,
    targetAudienceDescription: marketSegment.description,
    targetSegment: marketSegment.label,
    interests,
    includeInDemo,
    avoidInDemo,
    demoStyle,
    recommendedContextVariables: demoAudienceConfiguration.recommendedContextVariables,
    recommendedDemoGoals: demoAudienceConfiguration.recommendedDemoGoals,
    demoBias: `${audience.guideAngle} ${marketSegment.demoBias}`
  };
}

function audiencePlaybookFor(manifest, audience, marketSegment) {
  const playbook = manifest.context?.audiencePlaybook;
  if (playbook?.includeInDemo?.length && playbook?.avoidInDemo?.length && playbook?.demoStyle?.length) return playbook;
  return buildAudiencePlaybook(audience, marketSegment);
}

function audienceExecutionInstruction(audience, marketSegment) {
  return `Demo to the ${audience.label} audience type in a ${marketSegment.label} target audience context. ${audience.guideAngle} ${marketSegment.demoBias}`;
}

function demoStrategyInstruction(strategy, industry) {
  const normalizedStrategy = normalizeDemoStrategy(strategy?.id || strategy);
  const normalizedIndustry = normalizeIndustry(industry?.id || industry);
  const workflowGuidance = joinHuman((normalizedStrategy.includeWorkflows || []).slice(0, 5));
  const behaviorGuidance = joinHuman((normalizedStrategy.behaviorRules || []).slice(0, 5));
  return `Demo strategy: ${normalizedStrategy.label}. Keep the tone ${normalizedStrategy.tone}, pacing ${normalizedStrategy.pacing}, technical depth ${normalizedStrategy.technicalDepth}, and story style ${normalizedStrategy.storytelling}. ${workflowGuidance ? `Prioritize ${workflowGuidance}. ` : ""}${behaviorGuidance ? `Behavior rules: ${behaviorGuidance}. ` : ""}Adapt the examples to ${normalizedIndustry.label} using ${joinHuman(normalizedIndustry.terminology.slice(0, 4)) || "industry-relevant language"}.`;
}

function industryInstruction(industry) {
  const normalized = normalizeIndustry(industry?.id || industry);
  return `Industry playbook: ${normalized.label}. Use terminology such as ${joinHuman(normalized.terminology.slice(0, 4))}, emphasize KPIs such as ${joinHuman(normalized.kpis.slice(0, 4))}, and avoid ${joinHuman(normalized.avoid.slice(0, 3)) || "unverified industry claims"}.`;
}

function uniqueItems(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function inferSetupPlan(source, company, audience, marketSegment) {
  const combined = `${source.topic || ""}\n${source.preDemoNotes || ""}\n${source.instructions || ""}\n${source.demoScope || ""}`.toLowerCase();
  const requestedCreate = /(create|setup|set up|configure|build|prepare|seed|sample|demo data|test data|record|transaction|import|upload)/.test(combined);
  const excludesPurchaseOrders = /(don['’]?t operate with po|do not operate with po|no po['’]?s|no purchase orders|without purchase orders|not using purchase orders)/.test(combined);
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
  if (!excludesPurchaseOrders && /(purchase order|procure to pay|procure-to-pay)/.test(combined)) add("transaction", "sample purchase order", "needed to demonstrate future outflow or procure-to-pay context", "high");
  if (/(bank|cash account|account category|cash 360|forecast category)/.test(combined)) add("configuration", "Cash 360 account/category setup", "needed if Cash 360 requires specific accounts, categories, or forecast assumptions");
  if (/(subsidiary|entity|consolidat|multi.?entity)/.test(combined)) add("configuration", "subsidiary or entity demo context", "needed to demonstrate multi-entity filtering or consolidation");
  if (/(saved search|dashboard|kpi|portlet|report customization)/.test(combined)) add("configuration", "demo dashboard/search/report view", "needed if the demo requires a prepared view beyond standard reports");
  if (/(role|permission|approval|workflow|segregation)/.test(combined)) add("configuration", "role/permission or approval setup", "needed if the story requires controls, approvals, or role-based access", "high");
  if (/(fixed asset|fixed assets|asset management|depreciation|intangible asset)/.test(combined)) add("configuration", "fixed assets demo context", "needed if fixed assets are in scope for the personalized story or setup prompt");
  if (/(fp&a|fpa|planning|budget|budgeting|forecast planning)/.test(combined)) add("configuration", "planning and budgeting demo context", "needed if FP&A, budgets, or planning are in scope for the demo");
  if (/(service sku|services sku|services first|financials first|service item|project profitability)/.test(combined)) add("item", "services SKU or project demo context", "needed if the scoped demo should show services-led financials or project profitability");

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

function standardValueLine(theme) {
  if (theme === "filters") {
    return "Finance teams can re-run the same standard report by period, subsidiary, and accounting book without changing the source of truth.";
  }
  return "Finance teams get a fast, trusted performance view from a standard NetSuite report before moving into drilldown, export, and cash visibility.";
}

function openingNarration(audience, company, manifestDemoMode) {
  if (manifestDemoMode.id === "plain_demo") {
    return "We'll start with the standard income statement. It gives a finance team a controlled view of revenue, margin, overheads, and net profit before moving into filters, drilldown, export, and cash visibility.";
  }

  return prospectTone(
    `${audience.narratorAngle} ${company.companyName ? `For ${company.companyName}, ` : ""}let's start where a finance leader usually wants to start: the standard income statement. This gives a quick view of revenue, margin, overheads, and net profit from one controlled place in NetSuite.`
  );
}

function plainDemoNarration(segment) {
  return String(segment.narration || "")
    .replace(/\b[Aa] prospect\b/g, "the audience")
    .replace(/\b[Tt]he prospect\b/g, "the audience")
    .replace(/\b[Cc]ustomer story\b/g, "demo flow")
    .replace(/\b[Ss]tory\b/g, "flow");
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
    instructions: manifest.context?.demoRequest?.instructions,
    demoScope: manifest.context?.demoScope || manifest.context?.demoRequest?.demoScope
  }, manifest.context?.company || {}, normalizeAudience(manifest.context?.audience?.value), normalizeMarketSegment(manifest.context?.targetAudience?.value || manifest.context?.marketSegment?.value));
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
  const audience = normalizeAudience(manifest.context?.audience?.value || manifest.context?.demoRequest?.audience);
  const marketSegment = normalizeMarketSegment(manifest.context?.targetAudience?.value || manifest.context?.marketSegment?.value || manifest.context?.demoRequest?.targetAudience || manifest.context?.demoRequest?.marketSegment);
  const manifestDemoMode = normalizeManifestDemoMode(manifest.context?.manifestDemoMode?.id || manifest.context?.demoRequest?.manifestDemoMode || manifest.defaults?.manifestDemoMode);
  const outputLanguage = normalizeOutputLanguage(manifest.context?.outputLanguage?.value || manifest.context?.demoRequest?.outputLanguage || manifest.defaults?.outputLanguage);
  const demoStrategy = normalizeDemoStrategy(manifest.context?.demoStrategy?.id || manifest.context?.demoRequest?.demoStrategy || manifest.defaults?.demoStrategy);
  const industry = normalizeIndustry(manifest.context?.industry?.id || manifest.context?.demoRequest?.industry || manifest.defaults?.industry);
  const demoScope = String(manifest.context?.demoScope || manifest.context?.demoRequest?.demoScope || "").trim();
  const flowPrinciples = manifest.context?.demoPrep || demoFlowPrinciples({ demoScope, audience, marketSegment, demoStrategy, industry });
  const playbook = audiencePlaybookFor(manifest, audience, marketSegment);
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
- Audience type description: ${audience.description}
- Target audience: ${marketSegment.label}
- Target audience description: ${marketSegment.description}
- Manifest demo option: ${manifestDemoMode.label}
- Demo strategy: ${demoStrategy.label}
- Strategy instruction: ${demoStrategyInstruction(demoStrategy, industry)}
- Industry playbook: ${industry.label}
- Industry instruction: ${industryInstruction(industry)}
- Output language: ${outputLanguage.label}
- Demo scope: ${demoScope || "Not specified"}
- Demo prep order: ${flowPrinciples.ordering}
- Scope rule: ${flowPrinciples.scopeInstruction}
- Audience interests: ${playbook.interests?.join(", ") || "trusted reporting and cash visibility"}
- Include in demo: ${playbook.includeInDemo?.join(", ") || "strong proof points"}
- Avoid in demo: ${playbook.avoidInDemo?.join(", ") || "low-value distractions"}
- Demo style: ${playbook.demoStyle?.join(", ") || "business-focused"}
- Demo request: ${manifest.context?.demoRequest?.topic || "Not provided"}
- Demo input mode: ${manifest.context?.demoRequest?.inputMode || "request-and-notes"}
- Manifest mode instruction: ${manifestDemoMode.instruction}
- Language instruction: ${outputLanguageInstruction(outputLanguage)}

REQUESTED OR INFERRED SETUP ITEMS
${items}

TASK
1. Open or use the existing NetSuite browser session for the target account.
2. Confirm the visible account, role, and logged-in state.
3. Inspect whether the setup items already exist.
4. Produce a short gap list: existing, missing, risky, and not required.
5. Treat the demo scope as a planning rule even if it is not repeated in the notes.
6. Ask for confirmation before creating anything.
7. After confirmation, create only the approved demo data/configuration.
8. Prefer standard NetSuite objects and standard reports.
9. Keep setup aligned to the value-first demo order: executive overview, standard reporting, proof detail, cash visibility, then lower-value supporting controls.
10. Avoid custom reports unless explicitly required by the approved setup.
11. When finished, summarize exactly what was created, where it can be found, and what demo segment uses it.
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

async function writeImprovedScGuide(manifest, guide, intelligence) {
  const improved = improveScGuideWithIntelligence(guide, intelligence);
  await mkdir(path.dirname(scGuidePath), { recursive: true });
  await writeFile(scGuidePath, improved, "utf8");
  const archiveDir = path.join(projectRoot, "artifacts/sc-guides");
  await mkdir(archiveDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  await writeFile(path.join(archiveDir, `${stamp}-${companyFileSlug(manifest)}-improved-sc-guide.md`), improved, "utf8");
  return improved;
}

function improveScGuideWithIntelligence(guide, intelligence) {
  const baseGuide = stripMarkdownSection(guide, "Intelligence Improvements To Apply");
  const risk = intelligence.demo_risk_analyzer || {};
  const notes = intelligence.pre_demo_notes_analyzer || {};
  const demoHeatmap = intelligence.demo_heatmap_analyzer || {};
  const avoid = intelligence.what_not_to_demo_engine || {};
  const timing = intelligence.demo_timing_pacing_analyzer || {};
  const winning = intelligence.winning_moment_detection || {};
  const questions = followUpQuestionsFromIntelligence(intelligence);
  const improvementSection = `## Intelligence Improvements To Apply

### Follow-Up Discovery Questions

${questions}

### SC Guide Improvements

${[
  ...(risk.recommendations || []).slice(0, 5),
  ...(demoHeatmap.needs_work_areas || []).slice(0, 4).map((area) => `Strengthen this area in the story: ${area}.`),
  ...(notes.recommendations || []).slice(0, 4),
  timing.overrun_risk !== "low" ? `Pre-select a cut path because timing risk is ${timing.overrun_risk}.` : "",
  ...(winning.details || []).slice(0, 3).map((item) => `Slow down during "${item.moment}" and land this proof: ${item.why_it_lands}`)
].filter(Boolean).map((item) => `- ${item}`).join("\n")}

### Demo Guardrails

${(avoid.avoid_showing || []).slice(0, 8).map((item) => `- ${item}`).join("\n") || "- Keep the live path aligned to the selected audience, strategy, and scope."}
`;

  return `${baseGuide.trim()}\n\n${improvementSection}\n`;
}

function stripMarkdownSection(markdown, heading) {
  const lines = String(markdown || "").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return String(markdown || "");
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      end = index;
      break;
    }
  }
  return [...lines.slice(0, start), ...lines.slice(end)].join("\n").trim();
}

function followUpQuestionsFromIntelligence(intelligence) {
  const discovery = intelligence.discovery_gap_analyzer || {};
  const notes = intelligence.pre_demo_notes_analyzer || {};
  const demoHeatmap = intelligence.demo_heatmap_analyzer || {};
  const risk = intelligence.demo_risk_analyzer || {};
  const questions = uniqueItems([
    ...(discovery.recommended_follow_up_questions || []),
    ...(notes.risk_areas || []).slice(0, 4).map((area) => followUpQuestionForRiskArea(area)),
    ...(demoHeatmap.needs_work_areas || []).slice(0, 4).map((area) => `What discovery detail would help us strengthen ${area.toLowerCase()} in the demo story?`),
    ...(risk.warnings || []).slice(0, 3).map((warning) => `What should we clarify to reduce this demo risk: ${warning}`)
  ]).filter(Boolean);

  return questions.length
    ? questions.slice(0, 12).map((question, index) => `${index + 1}. ${question}`).join("\n")
    : "1. What is the single business outcome the audience must believe after the demo?\n2. Which stakeholder has the most influence over the next step?\n3. What current-system pain should the opening story make visible?";
}

function followUpQuestionForRiskArea(area) {
  const questions = {
    "Current systems": "Which systems, spreadsheets, and workarounds are used today, and where does the process break first?",
    "Business pain": "What is the most expensive or visible pain the demo must prove NetSuite can improve?",
    "Stakeholders and roles": "Who will attend the demo, what is each person's role, and what does each need to believe?",
    "Success criteria": "How will the customer measure whether this project and demo were successful?",
    "Scope clarity": "What is definitely in scope for this demo, what is phase 2, and what should be parked for Q&A?",
    "Process detail": "Which exact process should the demo story follow from start to finish?",
    "Technical and integration context": "Which systems must integrate with NetSuite, and which technical topics should stay in Q&A?",
    "Timeline and urgency": "What date, event, audit, or business pressure makes this project urgent now?",
    "Risks and constraints": "Which compliance, country, language, approval, or reporting constraints could derail confidence?",
    "Competitive or decision context": "What other options are they comparing against, and what would make NetSuite the safer choice?"
  };
  return questions[area] || `What discovery detail is missing for ${String(area || "this risk area").toLowerCase()}?`;
}

function markManifestGuideOnly(manifest) {
  const next = structuredClone(manifest);
  next.context = next.context || {};
  next.context.manifestBuild = {
    status: "guide-ready-manifest-not-built",
    source: "sc-guide",
    createdFromGuide: false,
    updatedAt: new Date().toISOString(),
    instruction: "The SC guide has been generated. Create the runnable manifest from the guide before relying on the Manifest tab or browser rehearsal."
  };
  return next;
}

function applyGuideToRunnableManifest(manifest, guide) {
  const next = structuredClone(manifest);
  const audience = normalizeAudience(next.context?.audience?.value || next.context?.demoRequest?.audience || next.audience);
  const marketSegment = normalizeMarketSegment(next.context?.targetAudience?.value || next.context?.marketSegment?.value || next.context?.demoRequest?.targetAudience || next.context?.demoRequest?.marketSegment);
  const demoStrategy = normalizeDemoStrategy(next.context?.demoStrategy?.id || next.context?.demoRequest?.demoStrategy || next.defaults?.demoStrategy);
  const industry = normalizeIndustry(next.context?.industry?.id || next.context?.demoRequest?.industry || next.defaults?.industry);
  const demoScope = String(next.context?.demoScope || next.context?.demoRequest?.demoScope || "").trim();
  const manifestDemoMode = normalizeManifestDemoMode(next.context?.manifestDemoMode?.id || next.context?.demoRequest?.manifestDemoMode || next.defaults?.manifestDemoMode);
  const flowPrinciples = next.context?.demoPrep || demoFlowPrinciples({ demoScope, audience, marketSegment, demoStrategy, industry });
  const company = next.context?.company || {};
  const runbook = markdownSection(guide, "Personalized Demo Story And Runbook") || guide;
  next.segments = (next.segments || []).map((segment) => applyRunbookToSegment(segment, runbook));
  next.segments = prioritizeDemoSegments(ensureOpeningOverviewSegment(next.segments, {
    company,
    audience,
    marketSegment,
    demoScope,
    manifestDemoMode,
    demoStrategy,
    industry,
    flowPrinciples
  }));
  next.context = next.context || {};
  next.context.manifestBuild = {
    status: "runnable-manifest-created",
    source: "sc-guide",
    createdFromGuide: true,
    updatedAt: new Date().toISOString(),
    instruction: "This manifest was refreshed from the SC guide and is ready for browser dry-run or rehearsal."
  };
  return next;
}

function applyRunbookToSegment(segment, runbook) {
  const details = runbookDetailsForSegment(runbook, segment.title);
  if (!details) return segment;
  return {
    ...segment,
    objective: details.storyPurpose || segment.objective,
    narration: details.whatToSay || segment.narration,
    valueStatement: details.proofPoint || segment.valueStatement,
    scTip: details.scTip || segment.scTip
  };
}

function runbookDetailsForSegment(runbook, title) {
  const source = String(runbook || "");
  const index = source.toLowerCase().indexOf(String(title || "").toLowerCase());
  if (index < 0) return null;
  const block = source.slice(index, Math.min(source.length, index + 900));
  const extract = (label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = block.match(new RegExp(`- ${escaped}:\\s*([^\\n]+)`, "i"));
    return match?.[1]?.trim() || "";
  };
  return {
    storyPurpose: extract("Story purpose"),
    whatToSay: extract("What to say"),
    proofPoint: extract("Proof point to land"),
    scTip: extract("SC tip")
  };
}

function generateScGuide(manifest, body, company) {
  const instructions = String(body.instructions || "").trim() || defaultScInstructions();
  const notes = String(body.preDemoNotes || "").trim() || "No additional pre-demo notes were provided.";
  const demoScope = String(body.demoScope || manifest.context?.demoScope || manifest.context?.demoRequest?.demoScope || "").trim();
  const companyName = company.companyName || "The prospect";
  const audience = normalizeAudience(body.audience || manifest.context?.audience?.value || manifest.context?.demoRequest?.audience || manifest.audience);
  const marketSegment = normalizeMarketSegment(body.marketSegment || manifest.context?.targetAudience?.value || manifest.context?.marketSegment?.value || manifest.context?.demoRequest?.targetAudience || manifest.context?.demoRequest?.marketSegment);
  const outputLanguage = normalizeOutputLanguage(body.outputLanguage || manifest.context?.outputLanguage?.value || manifest.context?.demoRequest?.outputLanguage || manifest.defaults?.outputLanguage);
  const manifestDemoMode = normalizeManifestDemoMode(body.manifestDemoMode || manifest.context?.manifestDemoMode?.id || manifest.context?.demoRequest?.manifestDemoMode || manifest.defaults?.manifestDemoMode);
  const demoStrategy = normalizeDemoStrategy(body.demoStrategy || manifest.context?.demoStrategy?.id || manifest.context?.demoRequest?.demoStrategy || manifest.defaults?.demoStrategy);
  const industry = normalizeIndustry(body.industry || manifest.context?.industry?.id || manifest.context?.demoRequest?.industry || manifest.defaults?.industry);
  const playbook = audiencePlaybookFor(manifest, audience, marketSegment);
  const flowPrinciples = manifest.context?.demoPrep || demoFlowPrinciples({ demoScope, audience, marketSegment, demoStrategy, industry });
  const adminSources = Array.isArray(manifest.context?.additionalDemoSources)
    ? manifest.context.additionalDemoSources
    : activeAdditionalDemoSources({
      topic: manifest.context?.demoRequest?.topic,
      preDemoNotes: notes,
      demoScope,
      audience,
      marketSegment,
      demoStrategy,
      industry
    });
  const setupPlan = manifest.context?.setupPlan || inferSetupPlan({
    topic: manifest.context?.demoRequest?.topic,
    preDemoNotes: manifest.context?.preDemoNotes,
    instructions,
    demoScope
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
  const storyRunbook = scStoryRunbookText({
    companyName,
    audience,
    marketSegment,
    playbook,
    priorities,
    segments,
    outputLanguage,
    manifestDemoMode,
    demoStrategy,
    industry,
    demoScope,
    flowPrinciples
  });
  const assetPrompt = demoAssetPromptText({
    companyName,
    audience,
    marketSegment,
    playbook,
    priorities,
    signals,
    segments,
    outputLanguage,
    notes,
    manifestDemoMode,
    demoStrategy,
    industry,
    demoRequest: manifest.context?.demoRequest?.topic || "Not provided",
    demoScope,
    flowPrinciples
  });

  return `# SC Demo Guide: ${companyName}

## Demo Thesis

Show how NetSuite helps ${companyName} move from trusted standard reporting into cash visibility, drilldown, and action. Lead with the outcomes most likely to matter: ${joinHuman(priorities.slice(0, 4)) || "visibility, control, and speed"}.

## Audience Angle

- Selected audience: ${audience.label}
- Audience type description: ${audience.description}
- Target audience: ${marketSegment.label}
- Target audience description: ${marketSegment.description}
- Manifest demo option: ${manifestDemoMode.label}
- Demo strategy: ${demoStrategy.label}
- Strategy guidance: ${demoStrategyInstruction(demoStrategy, industry)}
- Industry playbook: ${industry.label}
- Industry guidance: ${industryInstruction(industry)}
- Output language: ${outputLanguage.label}
- Language guidance: ${outputLanguageInstruction(outputLanguage)}
- Demo input: ${inputMode}
- Demo scope: ${demoScope || "Not specified. Keep the scope to the generated manifest and the SC's live judgement."}
- Demo prep order: ${flowPrinciples.ordering}
- Scope rule: ${flowPrinciples.scopeInstruction}
- Demo angle: ${playbook.demoBias}
- Likely interests: ${playbook.interests.join(", ")}
- Include in demo: ${playbook.includeInDemo.join(", ")}
- Avoid in demo: ${playbook.avoidInDemo.join(", ")}
- Demo style: ${playbook.demoStyle.join(", ")}
- Context variables to consider: ${playbook.recommendedContextVariables.join(", ")}
- Recommended demo goals: ${playbook.recommendedDemoGoals.join(", ")}
- Manifest mode instruction: ${manifestDemoMode.instruction}

## Additional Admin Sources And Logic Considered

${additionalDemoSourcesMarkdown(adminSources)}

## Personalized Demo Story And Runbook

${outputLanguageInstruction(outputLanguage)}

${storyRunbook}

## Tips And Tricks For The SC

- Name the business reason before each click. The click is proof, not the story.
- Use the search bar and standard navigation so the flow feels natural and repeatable.
- If the audience asks for detail, drill once, then come back to the executive view.
- Keep custom reporting out of the main path unless the customer explicitly asks for it.
- For ${marketSegment.label.toLowerCase()} teams, emphasize ${joinHuman(marketSegment.interests.slice(0, 2))}.
- For ${audience.label.toLowerCase()}, frame the proof around ${audience.guideAngle}
- If setup data is missing, pause and use the NetSuite prep prompt instead of improvising live.

## Company Context

- Website: ${company.url || "Not provided"}
- Website signal: ${company.description || company.title || "No website summary available"}
- Demo scope: ${demoScope || "Not specified"}
- Likely priorities: ${priorities.join(", ") || "trusted reporting, cash visibility, drilldown"}
- Industry signals: ${signals.join(", ") || "financial visibility and operational control"}

## Pre-Demo Notes

${notes}

## Demo Asset Generation Prompt

${assetPrompt}

## NetSuite Prep Summary

- Target account: ${account.account} (${account.host})
- Role: ${account.role}
- Setup status: ${setupPlan.status}
- Safety note: ${setupPlan.accountCreateWarning}

${setupPlan.items?.length
  ? setupPlan.items.map((item) => `- ${item.label}: ${item.reason} (${item.risk} risk)`).join("\n")
  : "- No create-in-account prep items were inferred. Keep this demo read-only unless the SC explicitly adds setup requirements."}

Use the setup prompt in the app if these items need to be created. It always requires front-end browser access, back-end NetSuite access, account confirmation, and approval before writes.

## Discovery Hooks During The Demo

- "Is this the level of reporting your finance team starts with today?"
- "Where do teams currently go when someone challenges a number?"
- "How often does cash forecasting live outside the ERP?"
- "Which view would your CFO want first: consolidated performance, entity-level detail, or working capital?"

## SC Instructions Used By The Generator

${instructions
  .split("\n")
  .map((line) => `- ${line.trim()}`)
  .join("\n")}
`;
}

function guideOutputsPayload(manifest, guide = "") {
  const context = guideContextFromManifest(manifest);
  const setupPrompt = setupPromptPayload(manifest).prompt;
  const scRunbook = markdownSection(guide, "Personalized Demo Story And Runbook") || scStoryRunbookText(context);
  const assetPrompt = markdownSection(guide, "Demo Asset Generation Prompt") || demoAssetPromptText(context);
  return {
    scRunbook,
    assetGenerationPrompt: assetPrompt,
    personalizedExperienceFlow: scRunbook,
    normalDemoFlow: scRunbook,
    customizationPrompts: markdownSection(guide, "Customization Prompts For NetSuite") || setupPrompt
  };
}

function guideContextFromManifest(manifest) {
  const company = manifest.context?.company || {};
  const audience = normalizeAudience(manifest.context?.audience?.value || manifest.context?.demoRequest?.audience || manifest.audience);
  const marketSegment = normalizeMarketSegment(manifest.context?.targetAudience?.value || manifest.context?.marketSegment?.value || manifest.context?.demoRequest?.targetAudience || manifest.context?.demoRequest?.marketSegment);
  const outputLanguage = normalizeOutputLanguage(manifest.context?.outputLanguage?.value || manifest.context?.demoRequest?.outputLanguage || manifest.defaults?.outputLanguage);
  const manifestDemoMode = normalizeManifestDemoMode(manifest.context?.manifestDemoMode?.id || manifest.context?.demoRequest?.manifestDemoMode || manifest.defaults?.manifestDemoMode);
  const demoStrategy = normalizeDemoStrategy(manifest.context?.demoStrategy?.id || manifest.context?.demoRequest?.demoStrategy || manifest.defaults?.demoStrategy);
  const industry = normalizeIndustry(manifest.context?.industry?.id || manifest.context?.demoRequest?.industry || manifest.defaults?.industry);
  const demoScope = String(manifest.context?.demoScope || manifest.context?.demoRequest?.demoScope || "").trim();
  const playbook = audiencePlaybookFor(manifest, audience, marketSegment);
  const flowPrinciples = manifest.context?.demoPrep || demoFlowPrinciples({ demoScope, audience, marketSegment, demoStrategy, industry });
  return {
    companyName: company.companyName || "The prospect",
    audience,
    marketSegment,
    manifestDemoMode,
    demoStrategy,
    industry,
    outputLanguage,
    playbook,
    demoScope,
    flowPrinciples,
    priorities: company.likelyPriorities || [],
    signals: company.industrySignals || [],
    notes: manifest.context?.preDemoNotes || "No additional pre-demo notes were provided.",
    demoRequest: manifest.context?.demoRequest?.topic || "Not provided",
    segments: manifest.segments || []
  };
}

function markdownSection(markdown, heading) {
  const lines = String(markdown || "").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return "";
  const collected = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) break;
    collected.push(lines[index]);
  }
  return collected.join("\n").trim();
}

function normalDemoFlowText(segments) {
  return segments
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
    .join("\n\n");
}

function scStoryRunbookText({ companyName, audience, marketSegment, playbook, priorities, segments, outputLanguage, manifestDemoMode, demoStrategy, industry, demoScope, flowPrinciples }) {
  const mode = normalizeManifestDemoMode(manifestDemoMode?.id || manifestDemoMode);
  const strategy = normalizeDemoStrategy(demoStrategy?.id || demoStrategy);
  const industryPlaybook = normalizeIndustry(industry?.id || industry);
  const prepPrinciples = flowPrinciples || demoFlowPrinciples({ demoScope, audience, marketSegment, demoStrategy: strategy, industry: industryPlaybook });
  const story = mode.id === "plain_demo"
    ? plainDemoFlowText({ companyName, audience, marketSegment, playbook, priorities })
    : personalizedStoryFlowText({ companyName, audience, marketSegment, playbook, priorities, segments });
  const runbook = segments
    .map((segment, index) => {
      const navigation = (segment.actions || [])
        .filter((action) => ["globalSearchOpen", "goto", "clickText", "clickRole"].includes(action.type))
        .map(describeNavigationAction)
        .filter(Boolean)
        .join(" -> ") || "Stay on the current view and explain what the audience should notice.";
      const proof = segment.valueStatement || "Tie the screen back to the business outcome for this audience.";
      const talkTrack = segment.narration || "Explain the business reason for this step before clicking.";
      return `${index + 1}. ${segment.title}
   - Story purpose: ${segment.objective || segment.title}
   - What to do: ${navigation}
   - What to say: ${talkTrack}
   - Proof point to land: ${proof}
   - SC tip: Keep this step aligned to ${joinHuman(playbook.interests.slice(0, 3)) || "the audience priorities"}.`;
    })
    .join("\n\n");

  return `Story arc:

${story}

Exact runbook:

Demo prep rules:

- ${prepPrinciples.opening}
- ${prepPrinciples.ordering}
- ${prepPrinciples.scopeInstruction}

${runbook}

Closing move:

${mode.id === "plain_demo"
  ? "Bring the audience back to the standard demo flow: trusted performance reporting, explainable detail, controlled sharing, and forward-looking cash visibility."
  : `Bring the audience back to the main business question. For ${companyName || "the prospect"}, the thread is not just that NetSuite has reports and Cash 360. The thread is that finance can start with a trusted performance view, prove the details, and then move into cash decisions without leaving the operating system.`}

Language note:

${outputLanguageInstruction(outputLanguage)}

Manifest mode:

${mode.label}: ${mode.instruction}

Demo strategy:

${strategy.label}: ${demoStrategyInstruction(strategy, industryPlaybook)}

Industry lens:

${industryPlaybook.label}: ${industryInstruction(industryPlaybook)}`;
}

function plainDemoFlowText({ audience, marketSegment, playbook, priorities }) {
  return `This is a plain NetSuite finance demo, so keep the storyline product-led and easy to follow. Start with the standard income statement, show how finance changes the reporting lens with filters, prove trust through drilldown, show controlled export options, then move into Cash 360 for current cash position and forecast visibility.

The audience is still ${audience.label.toLowerCase()} in a ${marketSegment.label.toLowerCase()} context, so emphasize ${joinHuman(playbook.interests.slice(0, 4)) || joinHuman((priorities || []).slice(0, 4)) || "trusted reporting, usable workflows, and cash visibility"}. Keep persona references light. The aim is a clean, reusable demo path an SC can run for many customers without rewriting the manifest.`;
}

function demoAssetPromptText({ companyName, audience, marketSegment, playbook, priorities, signals, segments, outputLanguage, notes, manifestDemoMode, demoStrategy, industry, demoRequest, demoScope, flowPrinciples }) {
  const mode = normalizeManifestDemoMode(manifestDemoMode?.id || manifestDemoMode);
  const strategy = normalizeDemoStrategy(demoStrategy?.id || demoStrategy);
  const industryPlaybook = normalizeIndustry(industry?.id || industry);
  const prepPrinciples = flowPrinciples || demoFlowPrinciples({ demoScope, audience, marketSegment, demoStrategy: strategy, industry: industryPlaybook });
  const persona = demoPersonaFor(audience, marketSegment);
  const storySegments = segments
    .filter((segment) => ["open-pl", "pl-drilldown", "open-cash360-dashboard", "cash360-forecast", "close"].includes(segment.id))
    .map((segment) => `- ${segment.title}: ${segment.valueStatement || segment.objective || segment.title}`)
    .join("\n");

  return `Narrative asset brief

PROMPT

Create a short PowerPoint support section for the SC demo. It should align to the personalized SC story and bring the persona to life. Do not turn the deck into a detailed requirements document. The live NetSuite demo remains the proof; the slides should make the human story easy to remember.

Story setup:
- Company/prospect: ${companyName || "The prospect"}
- Audience type: ${audience.label}
- Target audience: ${marketSegment.label}
- Demo strategy: ${strategy.label}
- Industry playbook: ${industryPlaybook.label}
- Manifest demo option: ${mode.label}
- Demo request: ${demoRequest || "Finance demo from P&L to Cash 360"}
- Demo scope: ${demoScope || "Use only the generated manifest and discovery-backed priorities as scope."}
- Persona: ${mode.id === "plain_demo" ? "Use a light finance-team persona, not a named customer character." : `${persona.name}, ${persona.role}`}
- Persona pressure: ${mode.id === "plain_demo" ? "They are trying to understand performance and cash without drowning in spreadsheets." : persona.question}
- Likely priorities: ${joinHuman((priorities || []).slice(0, 5)) || "trusted reporting, faster finance decisions, and cash visibility"}
- Industry cues: ${joinHuman((signals || []).slice(0, 3)) || joinHuman(industryPlaybook.terminology.slice(0, 3)) || "financial visibility and operational control"}
- Prep order: ${prepPrinciples.ordering}
- Scope rule: ${prepPrinciples.scopeInstruction}
- Output language: ${normalizeOutputLanguage(outputLanguage?.value || outputLanguage).label}

Create 5 slides:
1. Persona under pressure: show the person trying to close the books, answer leadership, or defend the numbers while data is split across tools and spreadsheets.
2. Why it hurts: make the business tension visible in one scene, using ${joinHuman(playbook.interests.slice(0, 3)) || "the audience priorities"}.
3. Turning point: NetSuite gives the persona a general executive view first, then a trusted finance path.
4. Live demo journey: use simple placeholders for the product proof moments, in this order:
${storySegments || "- Executive overview\n- Standard income statement\n- Filters\n- Drilldown\n- Export\n- Cash 360\n- Forecast controls"}
5. Resolution: the persona can close with more confidence, explain the numbers, and move from reporting to decisions.

Asset direction:
- Use one consistent realistic persona throughout the deck so the audience follows one human story.
- Include 2 to 3 supporting stock-image prompts for the persona: under pressure, collaborating with finance/IT, and confident after the issue is solved.
- Include light slide notes for the SC: what to say, what feeling to land, and when to switch into the live NetSuite demo.
- Leave placeholders for real NetSuite screenshots captured during rehearsal. Do not invent product screenshots.
- Keep it clean, executive-friendly, and easy to present in 5 minutes.
- Avoid ${joinHuman(playbook.avoidInDemo.slice(0, 5)) || "feature dumping and generic claims"}.
- ${outputLanguageInstruction(outputLanguage)}`;
}

function personalizedStoryFlowText({ companyName, audience, marketSegment, playbook, priorities, segments }) {
  const persona = demoPersonaFor(audience, marketSegment);
  const opening = `${persona.name}, ${persona.role}, is trying to answer one practical question: ${persona.question}`;
  const context = `${persona.name} cares most about ${joinHuman(playbook.interests.slice(0, 3)) || joinHuman(priorities.slice(0, 3)) || "trusted reporting and cash visibility"}.`;
  const beats = [
    `1. Start with the standard income statement as ${persona.name}'s executive checkpoint. Show that revenue, expenses, and net income are available without leaving the finance system.`,
    `2. Use filters as the control moment. Position period, subsidiary, and accounting book as the way ${persona.name} changes the lens without changing the source of truth.`,
    `3. Drill down once to prove trust. The point is not the click itself; it is that ${persona.name} can defend a number when leadership challenges it.`,
    `4. Show export options as the collaboration moment. Keep it light: exporting is available, but the story is that fewer decisions should depend on disconnected spreadsheets.`,
    `5. Move into Cash 360 as the forward-looking moment. ${persona.name} moves from what happened to what is likely to happen next.`,
    `6. Close by connecting performance and liquidity. For a ${marketSegment.label.toLowerCase()} ${audience.label.toLowerCase()} audience, land the story on ${marketSegment.demoBias}`
  ];

  const segmentTips = segments
    .filter((segment) => ["open-pl", "pl-drilldown", "open-cash360-dashboard", "cash360-forecast", "close"].includes(segment.id))
    .map((segment) => `- ${segment.title}: ${persona.name} should hear "${segment.valueStatement}"`)
    .join("\n");

  return `${opening}

${context}

Story beats:

${beats.join("\n")}

Persona-led callouts:

${segmentTips}`;
}

function demoPersonaFor(audience, marketSegment) {
  if (audience.value === "marketing") {
    return {
      name: "Maya",
      role: "a finance transformation storyteller",
      question: "how can we explain NetSuite's finance story in a way that lands quickly for a broader audience?"
    };
  }

  if (audience.value === "customer") {
    return {
      name: "Elena",
      role: "an existing NetSuite finance leader",
      question: "what are we already licensed for that could help the team run finance with less manual effort?"
    };
  }

  if (audience.value === "executive") {
    return {
      name: "Jordan",
      role: "a CFO sponsor",
      question: "will this improve visibility, reduce risk, and help the business make faster finance decisions?"
    };
  }

  if (audience.value === "operational") {
    return {
      name: "Sam",
      role: "a finance operations manager",
      question: "can the team complete routine work faster without chasing spreadsheets or switching systems?"
    };
  }

  if (audience.value === "technical") {
    return {
      name: "Taylor",
      role: "an IT architect",
      question: "does the process fit our security, integration, administration, and extensibility expectations?"
    };
  }

  if (audience.value === "partner") {
    return {
      name: "Casey",
      role: "an implementation partner",
      question: "can we deploy this repeatably while still adapting it to the customer's operating model?"
    };
  }

  if (marketSegment.value === "public_sector") {
    return {
      name: "Morgan",
      role: "a public sector finance leader",
      question: "can we improve transparency and control while meeting audit, accessibility, and procurement expectations?"
    };
  }

  if (marketSegment.value === "enterprise") {
    return {
      name: "Priya",
      role: "an enterprise CFO",
      question: "can we trust consolidated numbers, trace the detail, and manage cash without adding more manual governance?"
    };
  }

  if (marketSegment.value === "emerging") {
    return {
      name: "Sofia",
      role: "a finance lead at a growing company",
      question: "can we get dependable visibility without building a heavy finance process too early?"
    };
  }

  if (marketSegment.value === "startup") {
    return {
      name: "Nora",
      role: "a startup finance lead",
      question: "can we get dependable finance visibility quickly without slowing the team down?"
    };
  }

  return {
    name: "Alex",
    role: "a mid-market finance director",
    question: "can we close faster, trust the numbers, and understand cash without stitching spreadsheets together?"
  };
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

function demoIntelligencePayload(manifest, scGuide = "") {
  const context = demoIntelligenceContext(manifest, scGuide);
  const discovery = discoveryGapAnalysis(context);
  const stakeholderCoverage = stakeholderCoverageAnalysis(context);
  const winning = winningMomentAnalysis(context);
  const avoid = whatNotToDemoAnalysis(context);
  const timing = timingAndPacingAnalysis(context);
  const risk = demoRiskAnalysis(context, discovery, stakeholderCoverage, timing, winning);
  const rehearsalCoach = rehearsalCoachAnalysis(context, risk, timing, stakeholderCoverage);
  const competitive = competitivePositioningGuidance(context);
  const preDemoNotes = preDemoNotesAnalysis(context, discovery);
  const demoHeatmap = demoHeatmapAnalysis(context, risk, discovery, stakeholderCoverage, timing, winning, rehearsalCoach);
  risk.score_details = demoScoreDetails(risk, demoHeatmap, timing, discovery, preDemoNotes);

  return {
    generated_at: new Date().toISOString(),
    positioning: "AI-powered Demo Intelligence and Demo Coaching Platform for Solution Consulting",
    demo_metadata: {
      customer_name: context.company.companyName || context.company.title || manifest.name || "Current demo",
      customer_url: context.company.url || "",
      demo_name: manifest.name || "NetSuite demo",
      demo_goal: context.topic || manifest.context?.demoRequest?.topic || "",
      demo_scope: context.demoScope || "",
      customer_description: context.company.description || context.company.title || "",
      likely_priorities: context.company.likelyPriorities || [],
      audience_type: context.audience.label,
      target_segment: context.marketSegment.label,
      industry: context.industry.label,
      strategy: context.strategy.label,
      language: normalizeOutputLanguage(manifest.context?.outputLanguage?.value || manifest.context?.demoRequest?.outputLanguage || manifest.defaults?.outputLanguage).label,
      narration_voice: manifest.defaults?.audio?.voice || "Moira",
      manifest_ready: context.manifestFlowReady
    },
    demo_strategy: {
      id: context.strategy.id,
      label: context.strategy.label,
      description: context.strategy.description,
      tone: context.strategy.tone,
      pacing: context.strategy.pacing,
      technical_depth: context.strategy.technicalDepth,
      storytelling_style: context.strategy.storytelling
    },
    industry_playbook: {
      id: context.industry.id,
      label: context.industry.label,
      description: context.industry.description,
      terminology: context.industry.terminology,
      kpis: context.industry.kpis,
      workflows: context.industry.workflows,
      pain_points: context.industry.painPoints,
      emotional_drivers: context.industry.emotionalDrivers
    },
    demo_risk_analyzer: risk,
    discovery_gap_analyzer: discovery,
    stakeholder_coverage_analyzer: stakeholderCoverage,
    winning_moment_detection: winning,
    what_not_to_demo_engine: avoid,
    demo_timing_pacing_analyzer: timing,
    ai_rehearsal_coach: rehearsalCoach,
    demo_heatmap_analyzer: demoHeatmap,
    pre_demo_notes_analyzer: preDemoNotes,
    competitive_positioning_mode: competitive,
    internal_best_practices_library: bestPracticeRecommendations(context, winning)
  };
}

function demoIntelligenceContext(manifest, scGuide = "") {
  const audience = normalizeAudience(manifest.context?.audience?.value || manifest.context?.demoRequest?.audience || manifest.audience);
  const marketSegment = normalizeMarketSegment(manifest.context?.targetAudience?.value || manifest.context?.marketSegment?.value || manifest.context?.demoRequest?.targetAudience || manifest.context?.demoRequest?.marketSegment);
  const strategy = normalizeDemoStrategy(manifest.context?.demoStrategy?.id || manifest.context?.demoRequest?.demoStrategy || manifest.defaults?.demoStrategy);
  const industry = normalizeIndustry(manifest.context?.industry?.id || manifest.context?.demoRequest?.industry || manifest.defaults?.industry);
  const company = manifest.context?.company || {};
  const scGuideText = String(scGuide || "");
  const scRunbook = markdownSection(scGuideText, "Personalized Demo Story And Runbook");
  const assetPrompt = markdownSection(scGuideText, "Demo Asset Generation Prompt");
  const setupPrompt = markdownSection(scGuideText, "NetSuite Prep Summary");
  const manifestFlowReady = manifest.context?.manifestBuild?.createdFromGuide === true;
  const manifestSegments = manifest.segments || [];
  const segments = manifestFlowReady ? manifestSegments : guideSegmentsFromRunbook(scRunbook, manifestSegments);
  const actions = manifestFlowReady
    ? segments.flatMap((segment) => (segment.actions || []).map((action) => ({ ...action, segmentId: segment.id, segmentTitle: segment.title })))
    : [];
  const adminSources = Array.isArray(manifest.context?.additionalDemoSources)
    ? manifest.context.additionalDemoSources
    : activeAdditionalDemoSources({
      topic: manifest.context?.demoRequest?.topic,
      preDemoNotes: manifest.context?.preDemoNotes,
      demoScope: manifest.context?.demoScope || manifest.context?.demoRequest?.demoScope,
      audience,
      marketSegment,
      demoStrategy: strategy,
      industry
    });
  const text = [
    manifest.name,
    manifest.audience,
    manifest.context?.demoRequest?.topic,
    manifest.context?.demoScope,
    manifest.context?.demoRequest?.demoScope,
    manifest.context?.demoRequest?.instructions,
    manifest.context?.demoPrep?.opening,
    manifest.context?.demoPrep?.ordering,
    manifest.context?.demoPrep?.scopeInstruction,
    manifest.context?.preDemoNotes,
    scGuideText,
    company.companyName,
    company.description,
    ...(company.likelyPriorities || []),
    ...(company.industrySignals || []),
    manifest.context?.manifestBuild?.status,
    ...adminSources.flatMap((source) => [source.label, source.content, source.guidance, source.logic]),
    ...segments.flatMap((segment) => [
      segment.title,
      segment.objective,
      segment.valueStatement,
      segment.narration,
      ...(segment.actions || []).flatMap((action) => [action.type, action.query, action.text, action.name, action.url])
    ])
  ].filter(Boolean).join("\n").toLowerCase();

  return {
    manifest,
    audience,
    marketSegment,
    strategy,
    industry,
    company,
    segments,
    actions,
    manifestFlowReady,
    additionalDemoSources: adminSources,
    text,
    scGuide: scGuideText,
    scGuideLower: scGuideText.toLowerCase(),
    scRunbook,
    assetPrompt,
    setupPrompt,
    demoScope: String(manifest.context?.demoScope || manifest.context?.demoRequest?.demoScope || ""),
    notes: String(manifest.context?.preDemoNotes || ""),
    topic: String(manifest.context?.demoRequest?.topic || ""),
    playbook: audiencePlaybookFor(manifest, audience, marketSegment),
    navigationActions: actions.filter((action) => ["globalSearchOpen", "goto", "clickText", "clickRole"].includes(action.type)),
    clickLikeActions: actions.filter((action) => !["waitForText", "waitForAnyText", "screenshot"].includes(action.type)),
    valueStatementCount: segments.filter((segment) => String(segment.valueStatement || "").trim()).length,
    technicalSignalCount: countKeywordHits(text, ["api", "script", "suitelet", "backend", "configuration", "permission", "role", "workflow", "integration", "saved search", "field", "preference", "setup"]),
    businessSignalCount: countKeywordHits(text, ["roi", "cost", "margin", "cash", "working capital", "risk", "control", "close", "forecast", "faster", "time", "efficiency", "productivity", "visibility", "outcome"])
  };
}

function guideSegmentsFromRunbook(scRunbook, fallbackSegments = []) {
  const source = String(scRunbook || "");
  if (!source.trim()) return fallbackSegments;
  const matches = Array.from(source.matchAll(/(?:^|\n)(\d+)\.\s+([^\n]+)\n([\s\S]*?)(?=\n\d+\.\s+|\n\nClosing move:|\n\nLanguage note:|$)/g));
  if (!matches.length) return fallbackSegments;
  return matches.map((match, index) => {
    const title = match[2].trim();
    const block = match[3] || "";
    const storyPurpose = runbookLine(block, "Story purpose") || runbookLine(block, "Show");
    const whatToSay = runbookLine(block, "What to say") || runbookLine(block, "Talk track");
    const proofPoint = runbookLine(block, "Proof point to land") || runbookLine(block, "Why it matters");
    const fallback = fallbackSegments.find((segment) => segment.title === title || segment.id === slugify(title));
    return {
      id: fallback?.id || slugify(title) || `guide-segment-${index + 1}`,
      title,
      objective: storyPurpose || fallback?.objective || title,
      narration: whatToSay || fallback?.narration || storyPurpose || title,
      valueStatement: proofPoint || fallback?.valueStatement || storyPurpose || title,
      actions: fallback?.actions || [],
      valueMoment: fallback?.valueMoment
    };
  });
}

function runbookLine(block, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(block || "").match(new RegExp(`- ${escaped}:\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim() || "";
}

function demoRiskAnalysis(context, discovery, stakeholderCoverage, timing, winning) {
  const warnings = [];
  const recommendations = [];
  const { text, segments, actions, audience, strategy, businessSignalCount, technicalSignalCount, valueStatementCount } = context;

  const addRisk = (warning, recommendation) => {
    if (!warnings.includes(warning)) warnings.push(warning);
    if (recommendation && !recommendations.includes(recommendation)) recommendations.push(recommendation);
  };

  if (discovery.missing_discovery_items.length >= 6) {
    addRisk("Discovery context is thin for a highly tailored demo.", "Ask for current system, success metrics, executive sponsor, timeline, and competitive context before finalizing the story.");
  }
  if (segments.length > 12 || actions.length > 70) {
    addRisk("Too many workflows or actions may turn the demo into a feature tour.", "Cut lower-priority sections and keep only the proof moments that support the selected strategy.");
  }
  if (context.navigationActions.length > 18) {
    addRisk("Navigation path is long enough to create pacing risk.", "Use NetSuite search/navigation for the shortest route and remove non-essential page transitions.");
  }
  if (valueStatementCount < Math.ceil(segments.length * 0.55)) {
    addRisk("Several segments do not clearly land a business outcome.", "Add a short outcome sentence to each major page and transition.");
  }
  if (businessSignalCount < 7) {
    addRisk("Business impact language is light.", "Mention measurable outcomes earlier, such as close speed, cash visibility, margin control, risk reduction, or fewer spreadsheet handoffs.");
  }
  if (!/(roi|return|cost|margin|cash|working capital|time savings|efficiency|risk reduction|faster close|forecast accuracy)/.test(text)) {
    addRisk("No measurable outcome or ROI discussion is visible.", "Add one quantified or measurable outcome to the opening and closing talk track.");
  }
  if (strategy.id === "executive_alignment" && technicalSignalCount > 8) {
    addRisk("Technical depth is too high for an executive alignment demo.", "Move configuration, setup, and integration details into appendix or Q&A.");
  }
  if (audience.value === "prospect" && /(setup|preference|configuration|custom|saved search|script|field)/.test(text) && technicalSignalCount > 7) {
    addRisk("Prospect-facing flow may show too much setup or internal product detail.", "Keep the live path centered on standard reports, proof moments, and business outcomes.");
  }
  if (context.manifest.context?.manifestDemoMode?.id === "customer_story" && !/(persona|story|pressure|pain|challenge|current state|before|after)/.test(text)) {
    addRisk("Customer story mode is selected, but the story arc is weak.", "Name the persona pressure, current-state pain, turning point, and outcome.");
  }
  if (stakeholderCoverage.low_coverage_roles.length >= 3) {
    addRisk("Stakeholder coverage is imbalanced.", `Add one proof point for ${stakeholderCoverage.low_coverage_roles.slice(0, 2).join(" and ")}.`);
  }
  if (timing.overrun_risk === "high") {
    addRisk("Estimated runtime has high overrun risk.", "Pre-select cuts before the meeting and slow down only during the winning moments.");
  }
  if (!/(close|summary|next step|recap|takeaway|decision|outcome)/.test(String(segments.at(-1)?.narration || segments.at(-1)?.valueStatement || "").toLowerCase())) {
    addRisk("Close or summary may not land strongly enough.", "End by restating the business problem, proof shown, and the next decision.");
  }
  if (!winning.winning_moments.length) {
    addRisk("No strong winning moment was detected.", "Create at least one memorable proof moment that the SC can slow down and reinforce.");
  }

  const demoQualityScore = boundedScore(92 - warnings.length * 5 - Math.max(0, timing.estimated_minutes - 35) + Math.min(8, winning.winning_moments.length * 2));
  const demoRiskScore = boundedScore(18 + warnings.length * 8 + Math.max(0, timing.estimated_minutes - 30) + Math.max(0, context.navigationActions.length - 14) * 2);

  return {
    demo_quality_score: demoQualityScore,
    demo_risk_score: demoRiskScore,
    warnings,
    recommendations,
    score_explanation: `Quality reflects audience fit, discovery strength, business outcome density, pacing, stakeholder coverage, and memorable proof moments. Risk increases with missing discovery, long navigation, technical depth, weak close, and overrun exposure.`
  };
}

function coveragePercent(found, total) {
  return total > 0 ? boundedScore((found / total) * 100) : 0;
}

function heatmapItem(label, score, evidence, recommendation) {
  const cleanScore = boundedScore(score);
  const status = heatmapStatus(cleanScore);
  return {
    label,
    score: cleanScore,
    status: status.id,
    status_label: status.label,
    evidence,
    recommendation
  };
}

function heatmapStatus(score) {
  if (score >= 85) return { id: "strong", label: "Super strong" };
  if (score >= 70) return { id: "healthy", label: "Strong" };
  if (score >= 50) return { id: "watch", label: "Needs work" };
  return { id: "risk", label: "Risk area" };
}

function wordCount(value) {
  const text = String(value || "").trim();
  return text ? text.split(/\s+/).length : 0;
}

function demoHeatmapAnalysis(context, risk, discovery, stakeholderCoverage, timing, winning, rehearsalCoach) {
  const discoveryCoverage = coveragePercent(discovery.found_discovery_items.length, discovery.found_discovery_items.length + discovery.missing_discovery_items.length);
  const stakeholderScores = stakeholderCoverage.stakeholder_coverage || [];
  const stakeholderBalance = stakeholderScores.length
    ? boundedScore(stakeholderScores.slice(0, 5).reduce((total, item) => total + item.coverage, 0) / Math.min(5, stakeholderScores.length))
    : 40;
  const playbookHits = countKeywordHits(context.text, [
    ...(context.playbook.interests || []).slice(0, 5),
    ...(context.playbook.includeInDemo || []).slice(0, 5)
  ]);
  const storySignals = countKeywordHits(context.text, ["executive", "overview", "story", "persona", "pressure", "before", "after", "outcome", "close"]);
  const technicalFit = context.audience.value === "technical" || context.strategy.id === "technical_validation"
    ? boundedScore(62 + context.technicalSignalCount * 4)
    : boundedScore(95 - Math.max(0, context.technicalSignalCount - 7) * 6);
  const navigationScore = boundedScore(100 - Math.max(0, context.navigationActions.length - 10) * 5 - Math.max(0, context.clickLikeActions.length - 42));
  const pacingScore = timing.overrun_risk === "low" ? 88 : timing.overrun_risk === "medium" ? 66 : 42;
  const scopeScore = context.demoScope
    ? boundedScore(78 + (context.text.includes(context.demoScope.toLowerCase().slice(0, 18)) ? 12 : 0))
    : 58;

  const heatmap = [
    heatmapItem("Executive opening", boundedScore(55 + (context.segments.some((segment) => segment.id === "executive-overview") ? 30 : 0) + storySignals * 2), "Checks whether the demo starts with the leadership story before detail.", "Add a short executive NetSuite overview before opening the first detailed workflow."),
    heatmapItem("Audience fit", boundedScore(58 + playbookHits * 5), `Matched ${playbookHits} audience/playbook signals in the manifest.`, "Use the selected audience and target segment language in the opening, proof moments, and close."),
    heatmapItem("Business outcome density", boundedScore(45 + context.businessSignalCount * 5 + context.valueStatementCount * 3), `${context.businessSignalCount} business signals and ${context.valueStatementCount} segment proof points detected.`, "Name the business reason before each click and add measurable outcome language."),
    heatmapItem("Discovery alignment", discoveryCoverage, `${discovery.found_discovery_items.length} discovery categories found; ${discovery.missing_discovery_items.length} still missing.`, "Fill the highest-risk discovery gaps before final rehearsal."),
    heatmapItem("Stakeholder balance", stakeholderBalance, stakeholderCoverage.recommendation, "Add one proof point or question for under-covered stakeholders."),
    heatmapItem("Pacing control", pacingScore, `Estimated runtime is ${timing.estimated_runtime}; overrun risk is ${timing.overrun_risk}.`, "Pre-select cuts and keep lower-value sections for Q&A."),
    heatmapItem("Navigation simplicity", navigationScore, `${context.navigationActions.length} navigation actions and ${context.clickLikeActions.length} click-like actions detected.`, "Use NetSuite search/navigation for the shortest route and cut wandering transitions."),
    heatmapItem("Technical depth fit", technicalFit, `${context.technicalSignalCount} technical/setup signals detected for ${context.audience.label}.`, "Move technical setup into appendix unless the audience is technical."),
    heatmapItem("Winning moments", boundedScore(35 + winning.winning_moments.length * 14), `${winning.winning_moments.length} memorable proof moments detected.`, "Create one or two moments where the SC slows down and lands the proof."),
    heatmapItem("Scope discipline", scopeScore, context.demoScope ? `Scope captured: ${context.demoScope}` : "No explicit demo scope captured.", "Add scope in Prep so the manifest avoids unrelated modules and setup.")
  ];

  const strongest = heatmap.filter((item) => item.score >= 80).map((item) => item.label);
  const needsWork = heatmap.filter((item) => item.score < 70).map((item) => item.label);
  return {
    summary: strongest.length
      ? `Strongest areas: ${joinHuman(strongest.slice(0, 3))}. ${needsWork.length ? `Needs work: ${joinHuman(needsWork.slice(0, 3))}.` : "No major weak area detected."}`
      : "The demo has usable structure, but no area is clearly dominant yet.",
    strongest_areas: strongest,
    needs_work_areas: needsWork,
    heatmap
  };
}

function demoScoreDetails(risk, demoHeatmap, timing, discovery, preDemoNotes) {
  const strongest = demoHeatmap.strongest_areas || [];
  const needsWork = demoHeatmap.needs_work_areas || [];
  const warningCount = risk.warnings?.length || 0;
  return {
    demo_quality_summary: `${risk.demo_quality_score}/100 reflects demo structure, business outcome density, pacing, stakeholder coverage, discovery alignment, and winning moments.`,
    demo_risk_summary: `${risk.demo_risk_score}/100 risk is driven by ${warningCount} warning${warningCount === 1 ? "" : "s"}, ${timing.overrun_risk} pacing risk, and ${discovery.missing_discovery_items.length} missing discovery categories.`,
    what_is_strong: strongest.length ? strongest.slice(0, 4) : ["No dominant strength detected yet"],
    what_needs_work: needsWork.length ? needsWork.slice(0, 4) : ["No major weak area detected"],
    quality_explanation: strongest.length
      ? `The demo is strongest around ${joinHuman(strongest.slice(0, 3))}.`
      : "The demo has a workable foundation, but it needs clearer standout proof moments.",
    risk_explanation: needsWork.length
      ? `Risk is concentrated around ${joinHuman(needsWork.slice(0, 3))}.`
      : "Risk is currently controlled; keep rehearsal focused on pacing and proof moments.",
    notes_dependency: `Pre-demo notes health is ${preDemoNotes.overall_score}/100. Weak notes can make a strong manifest feel generic, so fill the note gaps before final prep.`
  };
}

function discoveryGapAnalysis(context) {
  const source = `${context.notes}\n${context.topic}\n${context.demoScope}\n${context.company.description || ""}\n${(context.company.likelyPriorities || []).join(" ")}`.toLowerCase();
  const checks = [
    ["Current ERP system", /(current system|erp|quickbooks|sage|sap|dynamics|xero|excel|spreadsheet|netsuite|oracle|workday)/],
    ["Biggest operational challenge", /(challenge|pain|problem|manual|slow|broken|issue|bottleneck|risk|struggle)/],
    ["Executive sponsor", /(cfo|ceo|coo|sponsor|executive|vp finance|controller|leadership)/],
    ["Success metrics", /(success metric|kpi|measure|target|goal|roi|reduce|improve|faster|days|percentage|accuracy)/],
    ["Implementation timeline", /(timeline|go live|deadline|quarter|month|implementation|rollout|by q[1-4]|urgent)/],
    ["Primary business driver", /(driver|why now|growth|scale|audit|ipo|funding|cost|cash|close|compliance|acquisition)/],
    ["Budget indicators", /(budget|funding|approved|business case|investment|cost range|spend)/],
    ["Technical constraints", /(integration|api|security|permission|data migration|technical|architecture|sso|compliance)/],
    ["Stakeholder roles", /(stakeholder|cfo|finance|operations|it|sales|marketing|procurement|hr|supply chain)/],
    ["Competitive situation", /(competitor|competing|shortlist|sap|dynamics|sage|workday|quickbooks|acumatica|odoo)/],
    ["Industry priorities", /(manufactur|distribution|retail|saas|services|nonprofit|healthcare|construction|financial services|inventory|project|subscription)/]
  ];
  const found = [];
  const missing = [];
  for (const [label, pattern] of checks) {
    if (pattern.test(source)) found.push(label);
    else missing.push(label);
  }
  return {
    missing_discovery_items: missing,
    found_discovery_items: found,
    recommended_follow_up_questions: missing.slice(0, 6).map((item) => discoveryQuestionFor(item))
  };
}

function discoveryQuestionFor(item) {
  const questions = {
    "Current ERP system": "What system or spreadsheets are they using today, and what breaks first?",
    "Biggest operational challenge": "What is the single problem the demo must prove we can improve?",
    "Executive sponsor": "Who owns the business outcome and what do they personally care about?",
    "Success metrics": "How will they judge whether this project was worth doing?",
    "Implementation timeline": "Is there a date, event, audit, renewal, or growth milestone driving urgency?",
    "Primary business driver": "Why is this being evaluated now instead of later?",
    "Budget indicators": "Is there an approved initiative, business case, or expected investment range?",
    "Technical constraints": "Are there security, integration, data, or architecture constraints the demo must respect?",
    "Stakeholder roles": "Which roles will attend, and who can block or sponsor the decision?",
    "Competitive situation": "What other options are they comparing against, if any?",
    "Industry priorities": "Which industry-specific pressures should shape the language and proof moments?"
  };
  return questions[item] || `Clarify ${item.toLowerCase()} before demo generation.`;
}

function preDemoNotesAnalysis(context, discovery) {
  const notes = String(context.notes || "");
  const source = notes.toLowerCase();
  const words = notes.trim() ? notes.trim().split(/\s+/).length : 0;
  const checks = [
    {
      label: "Current systems",
      patterns: [/current system|erp|access|jedox|payhawk|quickbooks|sage|sap|dynamics|xero|spreadsheet|excel/],
      why: "Shows what the customer is replacing or working around.",
      recommendation: "Name the current ERP, planning tools, expense tools, reporting tools, and any spreadsheet dependency."
    },
    {
      label: "Business pain",
      patterns: [/challenge|pain|problem|manual|slow|broken|issue|bottleneck|risk|struggle|email heavy|not centralized|spreadsheet/],
      why: "Gives the demo a reason to exist.",
      recommendation: "Write the top three pains in plain business language and connect each one to a demo proof point."
    },
    {
      label: "Stakeholders and roles",
      patterns: [/cfo|controller|finance|it director|project manager|business analyst|operations|head of|manager|stakeholder|sponsor/],
      why: "Helps the SC cover the people in the room.",
      recommendation: "List attendees by role and add what each person likely needs to believe after the demo."
    },
    {
      label: "Success criteria",
      patterns: [/success|kpi|measure|target|goal|outcome|reduce|improve|faster|days|accuracy|must show|highlight|prove/],
      why: "Defines how the audience will judge whether the demo landed.",
      recommendation: "Add the measurable outcomes or decision criteria the demo must prove."
    },
    {
      label: "Scope clarity",
      patterns: [/scope|phase|financials|fixed assets|fp&a|fpa|inventory|procure|p2p|ar\/ap|a\/r|a\/p|services sku|advanced inventory|cash 360|reporting/],
      why: "Prevents the demo from drifting into unrelated areas.",
      recommendation: "State what is in scope, what is phase 2, and what should only be answered if asked."
    },
    {
      label: "Process detail",
      patterns: [/approval|invoice|bill|po|purchase order|project|revenue recognition|recognition|dunning|collections|cash|consolidation|multibook|tax|e-invoicing/],
      why: "Turns discovery into a realistic story instead of a generic flow.",
      recommendation: "Capture the key process, where it breaks today, and what a better future process should feel like."
    },
    {
      label: "Technical and integration context",
      patterns: [/integration|architecture|api|odbc|crm|ibos|e-invoicing|data|database|security|role|permission|backend/],
      why: "Helps keep technical concerns visible without over-demoing them.",
      recommendation: "Note the systems to integrate, technical constraints, and which topics belong in Q&A."
    },
    {
      label: "Timeline and urgency",
      patterns: [/timeline|go live|deadline|urgent|quarter|month|rollout|phase 1|phase 2|project date|by q[1-4]/],
      why: "Shapes pacing, depth, and how hard the close should land.",
      recommendation: "Add timing pressure, project phase, decision date, or why this matters now."
    },
    {
      label: "Risks and constraints",
      patterns: [/risk|constraint|local gaap|tax|language|country|countries|compliance|audit|approval matrix|threshold|legal entity|subsidiary/],
      why: "Surfaces the topics that could derail confidence if ignored.",
      recommendation: "Call out compliance, country, language, approval, and reporting constraints before generation."
    },
    {
      label: "Competitive or decision context",
      patterns: [/competitor|shortlist|compare|evaluation|business case|approved budget|budget|decision|procurement|vendor selection/],
      why: "Shows what the SC must position against or de-risk.",
      recommendation: "Add who else they are evaluating and what would make NetSuite the preferred option."
    }
  ];

  const heatmap = checks.map((check) => {
    const hitCount = check.patterns.reduce((total, pattern) => total + (pattern.test(source) ? 1 : 0), 0);
    const score = hitCount > 0
      ? boundedScore(72 + Math.min(18, hitCount * 6))
      : words > 250 ? 38 : 22;
    return heatmapItem(
      check.label,
      score,
      hitCount ? check.why : `Missing or too light. ${check.why}`,
      check.recommendation
    );
  });

  const lengthScore = words > 1800 ? 92 : words > 900 ? 84 : words > 350 ? 68 : words > 120 ? 48 : words > 0 ? 28 : 0;
  const coverageScore = coveragePercent(discovery.found_discovery_items.length, discovery.found_discovery_items.length + discovery.missing_discovery_items.length);
  const categoryScore = heatmap.length
    ? heatmap.reduce((total, item) => total + item.score, 0) / heatmap.length
    : 0;
  const overallScore = boundedScore(categoryScore * 0.6 + lengthScore * 0.2 + coverageScore * 0.2);
  const riskAreas = heatmap.filter((item) => item.score < 60).map((item) => item.label);
  const strongAreas = heatmap.filter((item) => item.score >= 80).map((item) => item.label);
  const recommendations = uniqueItems([
    ...heatmap.filter((item) => item.score < 70).slice(0, 5).map((item) => item.recommendation),
    discovery.missing_discovery_items.length ? `Ask follow-up questions for ${joinHuman(discovery.missing_discovery_items.slice(0, 3))}.` : "",
    words < 200 ? "Add more raw discovery notes before relying on heavy personalization." : ""
  ]);

  return {
    overall_score: overallScore,
    discovery_coverage_score: coverageScore,
    word_count: words,
    summary: overallScore >= 80
      ? "The notes are strong enough to support a tailored demo story."
      : overallScore >= 65
        ? "The notes are usable, but a few gaps could make the demo less specific."
        : "The notes carry meaningful risk. The SC should add discovery context before final prep.",
    coverage_summary: `${discovery.found_discovery_items.length} discovery categories found, ${discovery.missing_discovery_items.length} missing.`,
    strong_areas: strongAreas,
    risk_areas: riskAreas,
    recommendations,
    heatmap
  };
}

function stakeholderCoverageAnalysis(context) {
  const roleRules = [
    ["CFO", ["cfo", "margin", "profit", "cash", "forecast", "close", "risk", "kpi", "executive"]],
    ["Finance", ["finance", "income statement", "p&l", "report", "ledger", "close", "cash", "drilldown", "export"]],
    ["Operations", ["operations", "workflow", "fulfillment", "inventory", "order", "process", "handoff"]],
    ["IT", ["it", "api", "integration", "security", "permission", "role", "architecture", "admin"]],
    ["Sales", ["sales", "customer", "order", "quote", "pipeline", "revenue"]],
    ["Marketing", ["marketing", "story", "brand", "campaign", "differentiation", "experience"]],
    ["HR", ["hr", "employee", "workforce", "people", "payroll"]],
    ["Supply Chain", ["supply chain", "supplier", "inventory", "warehouse", "purchase order", "stock"]],
    ["Procurement", ["procurement", "vendor", "supplier", "purchase", "bill", "approval"]],
    ["Executive Leadership", ["executive", "leadership", "board", "strategy", "risk", "growth", "outcome"]]
  ];
  const rawScores = roleRules.map(([role, terms]) => {
    let score = countKeywordHits(context.text, terms);
    if (role === "Finance") score += Math.max(4, context.segments.length > 0 ? 3 : 0);
    if (role === "CFO" && /(cash|profit|margin|forecast|income statement)/.test(context.text)) score += 3;
    if (context.audience.value === "technical" && role === "IT") score += 4;
    if (context.audience.value === "executive" && role === "Executive Leadership") score += 4;
    return { role, score };
  });
  const maxScore = Math.max(1, ...rawScores.map((item) => item.score));
  const stakeholderCoverage = rawScores
    .map((item) => ({ role: item.role, coverage: Math.min(100, Math.round((item.score / maxScore) * 100)) }))
    .sort((a, b) => b.coverage - a.coverage);
  const lowCoverageRoles = stakeholderCoverage.filter((item) => item.coverage > 0 && item.coverage < 35).map((item) => item.role);
  const uncoveredRoles = stakeholderCoverage.filter((item) => item.coverage === 0).map((item) => item.role);
  const recommendation = lowCoverageRoles.length
    ? `Add a short proof point or discovery question for ${joinHuman(lowCoverageRoles.slice(0, 3))}.`
    : uncoveredRoles.length
      ? `If ${uncoveredRoles[0]} will attend, add one relevant proof point.`
      : "Coverage is reasonably balanced for the selected flow.";

  return {
    stakeholder_coverage: stakeholderCoverage,
    low_coverage_roles: lowCoverageRoles,
    uncovered_roles: uncoveredRoles,
    recommendation
  };
}

function winningMomentAnalysis(context) {
  const momentRules = [
    ["executive", "Executive NetSuite overview", "Slow down here to frame the platform story before showing detailed workflow."],
    ["standard income statement", "Trusted performance view", "Slow down here to anchor the audience in the source of truth."],
    ["income statement", "Trusted performance view", "Slow down here to anchor the audience in the source of truth."],
    ["filter", "Controlled reporting lens", "Use this as the moment where finance changes the view without changing the numbers."],
    ["drill", "Trust through drilldown", "Land that summary numbers can be defended when challenged."],
    ["export", "Controlled sharing without spreadsheet dependency", "Keep this short and frame it as collaboration, not the main operating model."],
    ["cash 360", "Cash 360 visibility", "Use this as the bridge from past performance to future liquidity."],
    ["forecast", "Forward-looking cash planning", "Pause here because this is often the emotional win for finance leaders."],
    ["approval", "Control and accountability", "Make the control story visible without going into setup."],
    ["dashboard", "Executive visibility", "Connect the view to faster leadership decisions."]
  ];
  const details = [];
  for (const segment of context.segments) {
    const guideSignal = segmentGuideSnippet(context, segment);
    const segmentText = `${segment.id} ${segment.title} ${segment.objective} ${segment.valueStatement} ${segment.narration} ${guideSignal}`.toLowerCase();
    const rule = momentRules.find(([keyword]) => segmentText.includes(keyword));
    const hasBusinessProof = /(cash|close|forecast|trusted|risk|control|visibility|margin|outcome|working capital|audit|consolidat)/.test(segmentText);
    if (rule || segment.valueMoment === "major" || hasBusinessProof) {
      details.push({
        segment: segment.title,
        moment: rule?.[1] || segment.title,
        source: guideSignal ? "Manifest and SC guide" : "Manifest",
        why_it_lands: segment.valueStatement || rule?.[2] || "This is a memorable business proof point.",
        coaching_tip: rule?.[2] || "Slow down, narrate the business reason, then show the proof."
      });
    }
  }
  const uniqueDetails = [];
  for (const detail of details) {
    if (!uniqueDetails.some((item) => item.moment === detail.moment)) uniqueDetails.push(detail);
  }
  return {
    winning_moments: uniqueDetails.slice(0, 6).map((item) => item.moment),
    details: uniqueDetails.slice(0, 6)
  };
}

function whatNotToDemoAnalysis(context) {
  const base = [];
  const strategyAvoid = context.strategy.avoid || [];
  const industryAvoid = context.industry.avoid || [];
  const audienceAvoid = context.playbook.avoidInDemo || [];
  const conditional = [];
  const manifestAvoid = [];
  const scope = context.demoScope.toLowerCase();
  const hasSetupOrPrefs = /(setup|preference|configuration|custom|saved search|script|field)/.test(context.text);
  const hasCash360Prefs = context.segments.some((segment) => /preference|forecast controls/i.test(segment.title));
  const hasExportDetail = context.segments.some((segment) => /export|print|word|csv/i.test(segment.title));
  const hasTechnicalSignals = context.technicalSignalCount > 7;
  const hasPurchaseOrder = /(purchase order|procure|p2p)/.test(context.text);
  const excludesPurchaseOrders = /(don['’]?t operate with po|do not operate with po|no po['’]?s|no purchase orders|without purchase orders|not using purchase orders)/.test(context.text);

  if (hasSetupOrPrefs) manifestAvoid.push("Do not turn setup or preferences into the main demo path");
  if (hasCash360Prefs) manifestAvoid.push("Keep Cash 360 preferences short unless the audience asks about forecast assumptions");
  if (hasExportDetail) manifestAvoid.push("Do not walk through every export format; prove availability and move on");
  if (hasTechnicalSignals && context.audience.value !== "technical") manifestAvoid.push("Do not over-explain APIs, backend setup, roles, or configuration");
  if (excludesPurchaseOrders && hasPurchaseOrder) manifestAvoid.push("Do not lead with purchase orders when the notes say the customer does not operate with POs today");
  if (scope && !/(fixed assets|asset)/.test(scope)) manifestAvoid.push("Do not add fixed assets unless the SC explicitly brings it into scope");
  if (scope && !/(inventory|advanced inventory)/.test(scope)) manifestAvoid.push("Do not branch into inventory unless it supports the scoped story");

  if (context.audience.value !== "technical") conditional.push("API or backend setup unless asked");
  if (context.strategy.id !== "technical_validation") conditional.push("Permission configuration deep dives");
  if (context.segments.length > 10) conditional.push("Optional sections after the main proof moments");
  return {
    avoid_showing: uniqueItems([...base, ...manifestAvoid, ...strategyAvoid, ...industryAvoid, ...audienceAvoid, ...conditional]).slice(0, 14),
    rationale: "These items are based on the current manifest, SC guide, selected audience, demo strategy, industry playbook, and scope. They are the areas most likely to reduce clarity, pace, or audience alignment if the SC over-demos them."
  };
}

function timingAndPacingAnalysis(context) {
  const segmentTimings = context.segments.map((segment) => {
    const actions = segment.actions || [];
    const actionMinutes = actions.reduce((total, action) => total + actionEstimatedMinutes(action), 0);
    const narrationWords = wordCount(`${segment.narration || ""} ${segment.valueStatement || ""}`);
    const guideWords = Math.min(120, wordCount(segmentGuideSnippet(context, segment)));
    const narrationMinutes = Math.max(0.45, narrationWords / 155);
    const guideTalkTrackMinutes = guideWords ? Math.max(0.25, guideWords / 175) : 0;
    const majorMomentBuffer = segment.valueMoment === "major" || /executive|cash|forecast|drill|close|outcome/i.test(`${segment.title} ${segment.valueStatement}`) ? 0.35 : 0.15;
    const estimatedMinutes = Math.max(0.9, actionMinutes + narrationMinutes + guideTalkTrackMinutes + majorMomentBuffer);
    return {
      segment: segment.title,
      estimated_minutes: roundOne(estimatedMinutes),
      pacing_risk: actions.length >= 7 || estimatedMinutes >= 4 || /(preference|setup|configuration|custom|admin)/i.test(segment.title) ? "high" : actions.length >= 5 || estimatedMinutes >= 2.6 ? "medium" : "low",
      basis: context.manifestFlowReady
        ? `${actions.length} manifest actions, ${narrationWords} narration/proof words${guideWords ? `, ${guideWords} SC guide words` : ""}`
        : `${narrationWords} SC guide/runbook words. Runnable manifest actions are ignored until the manifest is created from the guide.`
    };
  });
  const estimatedMinutes = roundOne(segmentTimings.reduce((total, item) => total + item.estimated_minutes, 0));
  const highRiskSections = segmentTimings.filter((item) => item.pacing_risk === "high").map((item) => item.segment);
  const overrunRisk = estimatedMinutes > 45 || highRiskSections.length >= 3 ? "high" : estimatedMinutes > 30 || highRiskSections.length ? "medium" : "low";
  const recommendedCuts = [];
  if (estimatedMinutes > 35) recommendedCuts.push("Pre-cut optional preference/setup sections unless the audience asks.");
  if (context.segments.some((segment) => /(export|print|word|csv)/i.test(segment.title))) recommendedCuts.push("Keep export options to a quick proof point; do not walk through every format.");
  if (highRiskSections.length) recommendedCuts.push(`Shorten ${highRiskSections[0]} or move it to Q&A.`);

  return {
    estimated_runtime: `${Math.round(estimatedMinutes)} minutes`,
    estimated_minutes: estimatedMinutes,
    overrun_risk: overrunRisk,
    basis: context.manifestFlowReady
      ? "Estimated from runnable manifest actions, explicit waits/highlights/clicks, narration length, value statements, and matching SC guide runbook text."
      : "Estimated from the SC guide/runbook and prep context. Runnable manifest actions are ignored until the manifest is explicitly created from the guide.",
    section_timing: segmentTimings,
    high_risk_sections: highRiskSections,
    recommended_cuts: uniqueItems(recommendedCuts)
  };
}

function actionEstimatedMinutes(action) {
  if (action.type === "wait") return roundOne((Number(action.ms) || 1000) / 60000);
  if (action.type === "highlightText") return roundOne(((Number(action.durationMs) || 900) / 60000) + 0.12);
  if (action.type === "globalSearchOpen") return 1.15;
  if (action.type === "goto") return 0.9;
  if (action.type === "clickText" || action.type === "clickRole") return 0.45;
  if (action.type === "waitForText" || action.type === "waitForAnyText") return 0.25;
  if (action.type === "screenshot") return 0.18;
  if (action.type === "note") return 0.15;
  return 0.25;
}

function segmentGuideSnippet(context, segment) {
  const runbook = context.scRunbook || context.scGuide || "";
  if (!runbook || !segment?.title) return "";
  const title = String(segment.title).trim();
  const index = runbook.toLowerCase().indexOf(title.toLowerCase());
  if (index < 0) return "";
  return runbook.slice(index, Math.min(runbook.length, index + 700));
}

function rehearsalCoachAnalysis(context, risk, timing, stakeholderCoverage) {
  const guideSignals = countKeywordHits(context.scGuideLower, ["story", "runbook", "what to say", "proof point", "sc tip", "closing move", "demo prep rules"]);
  const businessValueScore = boundedScore(64 + context.businessSignalCount * 3 + context.valueStatementCount * 2 + Math.min(8, guideSignals) - risk.warnings.length * 3);
  const clarityScore = boundedScore(88 - Math.max(0, context.navigationActions.length - 12) * 2 - Math.max(0, context.segments.length - 11) * 3 + (context.scRunbook ? 5 : 0));
  const executiveAlignmentScore = boundedScore(58 + countKeywordHits(context.text, ["cash", "risk", "margin", "forecast", "kpi", "executive", "outcome", "close", "overview", "leadership"]) * 4);
  const recommendations = uniqueItems([
    timing.overrun_risk !== "low" ? "Rehearse with a visible timer and pre-select the first section to cut." : "",
    businessValueScore < 80 ? "Mention the business outcome before the first product click." : "",
    clarityScore < 80 ? "Reduce navigation time and keep transitions shorter." : "",
    executiveAlignmentScore < 75 ? "Bring executive outcomes into the opening and close." : "",
    stakeholderCoverage.low_coverage_roles.length ? `Add a question for ${stakeholderCoverage.low_coverage_roles[0]} during rehearsal.` : "",
    !context.scRunbook ? "Regenerate the SC guide so rehearsal coaching can use the runbook." : "",
    "Practice slowing down during the winning moments instead of slowing down during navigation."
  ]);

  return {
    status: "ready-for-rehearsal-feedback",
    basis: "Scores are derived from the manifest structure, SC guide/runbook text, navigation count, business outcome language, and pacing estimate.",
    business_value_score: businessValueScore,
    clarity_score: clarityScore,
    executive_alignment_score: executiveAlignmentScore,
    suggested_metrics_for_future_rehearsal_transcripts: [
      "filler word count",
      "average section duration",
      "business outcome references",
      "technical jargon density",
      "stakeholder references",
      "pacing consistency",
      "confidence score"
    ],
    recommendations
  };
}

function competitivePositioningGuidance(context) {
  const guidance = [
    {
      topic: "Unified Suite",
      why_it_matters: "Use only if the customer is struggling with disconnected systems or manual handoffs.",
      recommended_demo_moment: "Move from standard reporting into Cash 360 to show connected finance visibility."
    },
    {
      topic: "Standard reports and drilldown",
      why_it_matters: "Use only if trust in numbers, auditability, or spreadsheet dependency is part of discovery.",
      recommended_demo_moment: "Drill from the income statement into supporting detail, then return to the main report."
    }
  ];
  if (context.strategy.id === "competitive_defense") {
    guidance.unshift({
      topic: "Approved competitive positioning required",
      why_it_matters: "Competitive defense should use curated battlecards and approved differentiators only.",
      recommended_demo_moment: "Choose one approved differentiator and tie it to a customer pain already discovered."
    });
  }
  return {
    warning: "Competitive insights are advisory only and may not always reflect current competitor capabilities. Validate important claims before customer use.",
    guidance_only: true,
    competitive_focus: guidance
  };
}

function bestPracticeRecommendations(context, winning) {
  return {
    reusable_patterns_to_capture: [
      "Opening story that names the business pressure before the first click",
      "Tell-show-tell phrasing for each major page",
      "One-click drilldown proof that builds trust without derailing",
      "Clean close that restates pain, proof, and next decision"
    ],
    recommended_structures: [
      `${context.strategy.label}: ${context.strategy.storytelling}`,
      `${context.industry.label}: emphasize ${joinHuman(context.industry.kpis.slice(0, 3))}`,
      `Winning moments to reuse: ${joinHuman(winning.winning_moments.slice(0, 3)) || "define one memorable proof moment during rehearsal"}`
    ]
  };
}

function countKeywordHits(text, keywords) {
  const source = String(text || "").toLowerCase();
  return keywords.reduce((total, keyword) => {
    const escaped = String(keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return total + (source.match(new RegExp(`\\b${escaped}\\b`, "g")) || []).length;
  }, 0);
}

function boundedScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function roundOne(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

async function listVoices(provider = "say", apiKey = "") {
  const normalizedProvider = normalizeVoiceProvider(provider);
  const config = voiceProviderConfig(normalizedProvider);
  if (normalizedProvider === "elevenlabs") {
    return listElevenLabsVoices(apiKey);
  }

  const output = await collectProcess("say", ["-v", "?"]).catch(() => "");
  const preferred = new Set([
    "Alex",
    "Daniel",
    "Fred",
    "Oliver",
    "Rishi",
    "Aaron",
    "Eddy (English (UK))",
    "Eddy (English (US))",
    "Reed (English (UK))",
    "Reed (English (US))",
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
    { name: "Samantha", locale: "en_US", sample: "Hello! My name is Samantha." },
    { name: "Daniel", locale: "en_GB", sample: "Hello! My name is Daniel." },
    { name: "Alex", locale: "en_US", sample: "Hello! My name is Alex." }
  ];

  return {
    provider: "say",
    providerLabel: config.label,
    requiresApiKey: config.requiresApiKey,
    apiKeyLabel: config.apiKeyLabel,
    configured: true,
    voices: localVoices.map((voice) => ({
      id: voice.name,
      provider: "say",
      gender: inferLocalVoiceGender(voice.name),
      ...voice
    }))
  };
}

async function listElevenLabsVoices(apiKey = "") {
  const config = voiceProviderConfig("elevenlabs");
  const effectiveApiKey = effectiveProviderApiKey("elevenlabs", apiKey);
  if (!effectiveApiKey) {
    return {
      provider: "elevenlabs",
      providerLabel: config.label,
      requiresApiKey: config.requiresApiKey,
      apiKeyEnv: config.apiKeyEnv,
      apiKeyLabel: config.apiKeyLabel,
      configured: false,
      message: "Add an ElevenLabs API key here, or set ELEVENLABS_API_KEY before starting the app, to load cloud voices and run cloud narration.",
      voices: fallbackElevenLabsVoices()
    };
  }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": effectiveApiKey }
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
        gender: inferCloudVoiceGender(voice),
        sample: voice.description || "ElevenLabs cloud voice"
      }));
    return {
      provider: "elevenlabs",
      providerLabel: config.label,
      requiresApiKey: config.requiresApiKey,
      apiKeyEnv: config.apiKeyEnv,
      apiKeyLabel: config.apiKeyLabel,
      configured: true,
      voices: voices.length ? voices : fallbackElevenLabsVoices()
    };
  } catch (error) {
    return {
      provider: "elevenlabs",
      providerLabel: config.label,
      requiresApiKey: config.requiresApiKey,
      apiKeyEnv: config.apiKeyEnv,
      apiKeyLabel: config.apiKeyLabel,
      configured: false,
      message: `Could not load ElevenLabs voices: ${error.message}`,
      voices: fallbackElevenLabsVoices()
    };
  }
}

function fallbackElevenLabsVoices() {
  return [
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", locale: "cloud", provider: "elevenlabs", gender: "female", sample: "Clear, friendly cloud narrator" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", locale: "cloud", provider: "elevenlabs", gender: "female", sample: "Warm, expressive cloud narrator" },
    { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", locale: "cloud", provider: "elevenlabs", gender: "male", sample: "Confident, polished cloud narrator" },
    { id: "TxGEqnHWrfWFTfGW9XjXj", name: "Josh", locale: "cloud", provider: "elevenlabs", gender: "male", sample: "Natural, conversational cloud narrator" }
  ];
}

function inferLocalVoiceGender(name) {
  const raw = String(name || "").toLowerCase();
  if (/(alex|daniel|fred|oliver|rishi|aaron|eddy|reed|rocko|grandpa)/.test(raw)) return "male";
  if (/(moira|samantha|karen|tessa|kathy|shelley|sandy|grandma)/.test(raw)) return "female";
  return "neutral";
}

function inferCloudVoiceGender(voice) {
  const name = String(voice?.name || "").toLowerCase();
  const labels = [
    voice?.labels?.gender,
    voice?.labels?.accent,
    voice?.labels?.description,
    voice?.description
  ].filter(Boolean).join(" ").toLowerCase();
  if (/(^|\b)(female|woman|feminine|rachel|bella|domi|elli|glinda|serena|matilda|emily)(\b|$)/.test(`${name} ${labels}`)) return "female";
  if (/(^|\b)(male|man|masculine|adam|josh|antoni|arnold|sam|charlie)(\b|$)/.test(`${name} ${labels}`)) return "male";
  return "neutral";
}

async function playVoiceSample(body) {
  const voice = String(body.voice || "Moira").trim();
  const provider = normalizeVoiceProvider(body.voiceProvider);
  const line = String(body.line || "Let's show how NetSuite gives finance teams a clearer view of performance and cash.").trim();
  if (provider === "elevenlabs") {
    await speakWithElevenLabs(line, voice, body.voiceApiKey);
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

async function speakWithElevenLabs(text, voiceId, suppliedApiKey = "") {
  const apiKey = effectiveProviderApiKey("elevenlabs", suppliedApiKey);
  if (!apiKey) throw new Error("ElevenLabs needs an API key. Add it in the narration settings or set ELEVENLABS_API_KEY before starting the app.");

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
  const voiceEnv = providerRuntimeEnv(voiceProvider, body.voiceApiKey);
  if (mode === "live" && voiceProviderConfig(voiceProvider).requiresApiKey && !Object.keys(voiceEnv).length) {
    throw new Error(`${voiceProviderConfig(voiceProvider).label} needs an API key. Add it in Narrator Voice before running the live demo.`);
  }
  if (mode === "rehearse") {
    const prep = await prepareAccountBuffer();
    const run = await runProcess("node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", "--rehearse", "--audio=none", `--value-intensity=${valueIntensity}`]);
    return {
      ...run,
      log: `${prep.log}\n\n${run.log || ""}`
    };
  }
  if (mode === "browser-dry-run") {
    const prep = await prepareAccountBuffer();
    const dry = await runProcess("node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", "--dry-run", "--audio=none", `--value-intensity=${valueIntensity}`]);
    const open = await runProcess("node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", "--open-browser"]);
    return {
      ok: dry.ok && open.ok,
      log: `${prep.log}\n\nRunnable manifest dry-run:\n${dry.log || ""}\n\nBrowser launch:\n${open.log || ""}`
    };
  }

  const commands = {
    open: ["node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", "--open-browser"]],
    dry: ["node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", "--dry-run", "--audio=none", `--value-intensity=${valueIntensity}`]],
    live: ["node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", `--audio=${voiceProvider}`, `--value-intensity=${valueIntensity}`, `--voice=${voice}`]]
  };
  const command = commands[mode];
  if (!command) throw new Error(`Unknown run mode: ${mode}`);
  return runProcess(command[0], command[1], { env: voiceEnv });
}

async function prepareAccountBuffer() {
  const manifest = await readManifest();
  const payload = setupPromptPayload(manifest);
  const bufferDir = path.join(projectRoot, "artifacts/prep-buffer");
  await mkdir(bufferDir, { recursive: true });
  const file = path.join(bufferDir, `${companyFileSlug(manifest)}-account-prep-buffer.json`);
  const createdAt = new Date().toISOString();
  const buffer = {
    createdAt,
    account: payload.account,
    setupPlan: payload.setupPlan,
    promptFile: path.join(projectRoot, "artifacts/codex-prompts", `${companyFileSlug(manifest)}-netsuite-setup-prompt.md`),
    status: payload.setupPlan.items?.length ? "setup-items-detected" : "read-only-ready",
    note: "Written before rehearsal so the SC can see whether the NetSuite account may need setup before the live demo."
  };
  await writeFile(file, `${JSON.stringify(buffer, null, 2)}\n`, "utf8");
  await mkdir(path.dirname(buffer.promptFile), { recursive: true });
  await writeFile(buffer.promptFile, payload.prompt, "utf8");

  const items = payload.setupPlan.items || [];
  const log = [
    "Account prep buffer created before rehearsal.",
    `Account: ${payload.account.account} (${payload.account.host})`,
    `Role: ${payload.account.role}`,
    `Setup status: ${payload.setupPlan.status}`,
    items.length
      ? `Potential setup items: ${items.map((item) => item.label).join(", ")}`
      : "Potential setup items: none inferred; keep demo read-only unless requirements change.",
    `Buffer file: ${file}`,
    `Codex setup prompt: ${buffer.promptFile}`
  ].join("\n");

  return { ok: true, file, log };
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    if (currentRun) {
      resolve({ ok: false, code: 1, log: "A demo is already running. Stop it before starting another run." });
      return;
    }

    const child = spawn(command, args, { cwd: projectRoot, detached: true, env: { ...process.env, ...(options.env || {}) } });
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

function json(response, payload, status = 200, headers = {}) {
  response.writeHead(status, { "content-type": "application/json", ...headers });
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
      body.night {
        color-scheme: dark;
        --ink: #edf3f6;
        --muted: #9fb0bc;
        --line: #314251;
        --soft: #101820;
        --accent: #20a39e;
        --accent-dark: #79d8d5;
        --danger: #ff8a75;
        background: #0b1117;
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
      .header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .theme-toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 7px 10px;
        border: 1px solid var(--line);
        border-radius: 6px;
        font-size: 13px;
        background: #fff;
        cursor: pointer;
        user-select: none;
      }
      .theme-toggle input {
        width: auto;
        margin: 0;
        accent-color: var(--accent);
      }
      body.night header,
      body.night .tabs {
        background: #0d151d;
      }
      body.night .theme-toggle,
      body.night textarea,
      body.night select,
      body.night input,
      body.night .panel,
      body.night .step,
      body.night .tab,
      body.night .segment-option {
        background: #121c25;
        color: var(--ink);
      }
      body.night button.secondary,
      body.night button.danger {
        background: #121c25;
      }
      body.night .segment-option:has(input:checked) {
        background: #102b31;
        color: var(--accent-dark);
      }
      body.night .status {
        background: #060a0f;
        color: #dce7ef;
      }
      body.night .help-tooltip {
        background: #edf3f6;
        color: #0b1117;
      }
      main {
        width: 100%;
        min-height: calc(100vh - 116px);
      }
    aside {
      border-right: 1px solid var(--line);
      background: var(--soft);
      padding: 20px;
      overflow: auto;
    }
    section {
      padding: 20px;
      overflow: visible;
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
      .conditional-setting[hidden] { display: none; }
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
    .score-grid,
    .analysis-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .score-card,
    .analysis-item {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #fbfcfd;
    }
    .score-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 5px 8px;
      min-height: 0;
      padding: 8px 10px;
    }
    body.night .score-card,
    body.night .analysis-item {
      background: #0f1821;
    }
    .score-value {
      display: block;
      font-size: 24px;
      line-height: 1;
      font-weight: 800;
      margin: 0;
    }
    .score-body {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.4;
      grid-column: 1 / -1;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .score-pill {
      display: inline-flex;
      width: fit-content;
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 700;
      color: #10201b;
      background: #dff4e8;
      align-self: center;
    }
    .score-pill.watch { background: #fff1c6; color: #3b2b00; }
    .score-pill.risk { background: #ffd8d1; color: #4a1409; }
    body.night .score-pill { color: #0b1218; }
    .score-label,
    .analysis-item strong {
      display: block;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .score-card .score-label,
    .score-card .hint {
      grid-column: 1 / -1;
      margin: 0;
    }
    .score-card .hint {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 11px;
    }
    .intel-summary {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(220px, .7fr);
      gap: 14px;
      border: 1px solid #bddbe1;
      border-radius: 8px;
      padding: 12px;
      background: linear-gradient(135deg, #f5fbfb, #ffffff);
      margin: 12px 0;
    }
    body.night .intel-summary {
      background: linear-gradient(135deg, #0f1d23, #0f1821);
      border-color: #24404a;
    }
    .intel-summary h3,
    .priority-card h3 {
      margin: 0 0 8px;
      font-size: 14px;
    }
    .intel-summary ul {
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.45;
      font-size: 13px;
    }
    .priority-intelligence-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin: 12px 0 14px;
    }
    .priority-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #fff;
    }
    body.night .priority-card { background: #0f1821; }
    .intelligence-overview-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .heatmap-panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #fff;
    }
    body.night .heatmap-panel { background: #0f1821; }
    .heatmap-panel h3 {
      margin: 0 0 8px;
      font-size: 14px;
    }
    .score-explainer {
      margin-top: 14px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
      gap: 10px;
    }
    .score-explainer .analysis-item { background: white; }
    body.night .score-explainer .analysis-item { background: #0f1821; }
    .heatmap-list {
      display: grid;
      gap: 9px;
    }
    .heatmap-item {
      border: 1px solid var(--line);
      border-left: 5px solid #c9d2dc;
      border-radius: 8px;
      padding: 10px;
      background: #fbfcfd;
    }
    body.night .heatmap-item { background: #0b1218; }
    .heatmap-item.strong { border-left-color: #16854f; }
    .heatmap-item.healthy { border-left-color: #2b7bbb; }
    .heatmap-item.watch { border-left-color: #c48200; }
    .heatmap-item.risk { border-left-color: #c94b35; }
    .heatmap-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      font-size: 13px;
      font-weight: 700;
    }
    .heatmap-score {
      font-variant-numeric: tabular-nums;
      color: var(--ink);
    }
    .heatmap-track {
      height: 8px;
      border-radius: 999px;
      background: var(--line);
      overflow: hidden;
      margin: 8px 0;
    }
    .heatmap-fill {
      height: 100%;
      border-radius: inherit;
      background: #2b7bbb;
    }
    .heatmap-item.strong .heatmap-fill { background: #16854f; }
    .heatmap-item.healthy .heatmap-fill { background: #2b7bbb; }
    .heatmap-item.watch .heatmap-fill { background: #c48200; }
    .heatmap-item.risk .heatmap-fill { background: #c94b35; }
    .heatmap-status {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: var(--muted);
    }
    .heatmap-copy {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .heatmap-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 10px;
    }
    .heatmap-page {
      color: var(--muted);
      font-size: 12px;
    }
    .heatmap-nav {
      padding: 6px 9px;
      font-size: 12px;
    }
    .intelligence-dashboard {
      display: grid;
      gap: 18px;
    }
    .readiness-hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(190px, .32fr);
      gap: 20px;
      padding: 22px;
      border: 1px solid #bedde0;
      border-radius: 12px;
      background: linear-gradient(135deg, #f5fbfb 0%, #ffffff 58%, #eef7f7 100%);
      box-shadow: 0 12px 28px rgba(24, 33, 47, .06);
    }
    body.night .readiness-hero {
      background: linear-gradient(135deg, #0f1d23 0%, #101820 62%, #12272b 100%);
      border-color: #254650;
    }
    .hero-eyebrow {
      margin: 0 0 6px;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-weight: 800;
    }
    .readiness-hero h2 {
      margin: 0;
      font-size: clamp(24px, 4vw, 38px);
      line-height: 1.05;
      letter-spacing: 0;
    }
    .hero-subline {
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.45;
    }
    .readiness-score {
      display: grid;
      align-content: center;
      justify-items: center;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 18px;
      background: rgba(255,255,255,.72);
      min-height: 150px;
    }
    body.night .readiness-score { background: rgba(11,18,24,.72); }
    .score-number {
      font-size: 54px;
      line-height: 1;
      font-weight: 850;
      color: var(--accent-dark);
      font-variant-numeric: tabular-nums;
    }
    body.night .score-number { color: #69d0d0; }
    .score-caption {
      margin-top: 6px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .06em;
    }
    .insight-badges,
    .metadata-chips,
    .ai-actions-bar,
    .heatmap-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .insight-badges { margin-top: 16px; }
    .insight-badge,
    .metadata-chip {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 7px 10px;
      background: #fff;
      color: var(--ink);
      font-size: 12px;
      line-height: 1.25;
    }
    body.night .insight-badge,
    body.night .metadata-chip { background: #0f1821; }
    .insight-badge strong,
    .metadata-chip strong {
      color: var(--accent-dark);
      margin-right: 4px;
    }
    details.metadata-chip summary {
      cursor: pointer;
      list-style: none;
    }
    details.metadata-chip summary::-webkit-details-marker { display: none; }
    details.metadata-chip p {
      margin: 8px 0 0;
      max-width: 260px;
      white-space: normal;
      color: var(--muted);
      line-height: 1.35;
    }
    .dashboard-section {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px;
      background: #fff;
    }
    body.night .dashboard-section { background: #0f1821; }
    .section-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: start;
      margin-bottom: 12px;
    }
    .section-head h2,
    .section-head h3 {
      margin: 0;
      font-size: 17px;
    }
    .section-head p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.4;
    }
    .ai-actions-bar {
      justify-content: space-between;
      align-items: center;
    }
    .ai-actions-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    details.custom-ai {
      margin-top: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: #fbfcfd;
    }
    body.night details.custom-ai { background: #0b1218; }
    details.custom-ai summary {
      cursor: pointer;
      font-weight: 800;
      color: var(--accent-dark);
    }
    .briefing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
      gap: 10px;
    }
    .briefing-item {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 11px;
      background: #fbfcfd;
      min-height: 96px;
    }
    body.night .briefing-item { background: #0b1218; }
    .briefing-item strong {
      display: block;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: var(--accent-dark);
      margin-bottom: 6px;
    }
    .briefing-item p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.4;
    }
    .intelligence-card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
      gap: 12px;
    }
    .intelligence-card {
      text-align: left;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 13px;
      background: #fff;
      color: var(--ink);
      min-height: 190px;
      display: grid;
      gap: 8px;
      align-content: start;
      transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
    }
    .intelligence-card:hover,
    .intelligence-card.active {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(24, 33, 47, .08);
      border-color: var(--accent);
    }
    body.night .intelligence-card { background: #0f1821; }
    .card-title-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: start;
    }
    .card-icon {
      width: 30px;
      height: 30px;
      display: inline-grid;
      place-items: center;
      border-radius: 8px;
      background: #eef8f8;
      color: var(--accent-dark);
      font-weight: 850;
    }
    body.night .card-icon { background: #102b31; color: #69d0d0; }
    .card-title {
      font-size: 15px;
      font-weight: 850;
      margin: 0;
    }
    .card-summary {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.35;
    }
    .status-badge {
      display: inline-flex;
      width: fit-content;
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: .03em;
      background: #dff4e8;
      color: #10201b;
    }
    .status-badge.warning { background: #fff1c6; color: #3b2b00; }
    .status-badge.critical { background: #ffd8d1; color: #4a1409; }
    .status-badge.advisory { background: #e8edf3; color: #26313d; }
    .card-metric {
      font-size: 22px;
      line-height: 1;
      font-weight: 850;
      color: var(--accent-dark);
    }
    body.night .card-metric { color: #69d0d0; }
    .preview-list {
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .detail-panel {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px;
      background: #fbfcfd;
      min-height: 170px;
    }
    body.night .detail-panel { background: #0b1218; }
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .heatmap-tab-button {
      background: #fff;
      border-color: var(--line);
      color: var(--accent-dark);
    }
    .heatmap-tab-button.active {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }
    .simple-heatmap-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .compact-heatmap-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 11px;
      background: #fbfcfd;
    }
    body.night .compact-heatmap-card { background: #0b1218; }
    .compact-heatmap-card strong {
      display: block;
      font-size: 13px;
      margin-bottom: 6px;
    }
    .competitive-summary {
      cursor: pointer;
      font-weight: 850;
      color: var(--accent-dark);
    }
    .competitive-summary::marker { color: var(--danger); }
    .pill-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }
    .pill {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 5px 8px;
      font-size: 12px;
      color: var(--accent-dark);
      background: #eef8f8;
    }
    body.night .pill {
      background: #102b31;
      color: var(--accent-dark);
    }
    .compact-list {
      margin: 8px 0 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.45;
    }
    .coverage-row {
      display: grid;
      grid-template-columns: 140px minmax(0, 1fr) 44px;
      gap: 8px;
      align-items: center;
      margin: 8px 0;
      font-size: 13px;
    }
    .coverage-track {
      height: 8px;
      border-radius: 999px;
      background: var(--line);
      overflow: hidden;
    }
    .coverage-fill {
      height: 100%;
      border-radius: inherit;
      background: var(--accent);
    }
    .advisory {
      border-left: 4px solid var(--danger);
      padding: 10px 12px;
      background: #fff7f5;
      color: var(--ink);
      border-radius: 6px;
    }
    body.night .advisory {
      background: #281713;
    }
    .cms-auth-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .cms-editor-grid {
      display: grid;
      grid-template-columns: minmax(260px, .36fr) minmax(0, 1fr);
      gap: 16px;
      margin-top: 14px;
    }
    #cmsEditor {
      min-height: 52vh;
      font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .cms-readable {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      min-height: 220px;
      max-height: 42vh;
      overflow: auto;
      background: #fbfcfd;
      color: var(--ink);
      line-height: 1.45;
    }
    body.night .cms-readable { background: #0b1218; }
    .cms-readable h3 {
      margin: 0 0 8px;
      font-size: 15px;
    }
    .cms-readable .readable-card {
      border-bottom: 1px solid var(--line);
      padding: 10px 0;
    }
    .cms-readable .readable-card:first-child { padding-top: 0; }
    .cms-readable .readable-card:last-child { border-bottom: 0; }
    .cms-readable p,
    .cms-readable ul {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 13px;
    }
    .cms-history {
      max-height: 260px;
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: #fbfcfd;
      margin-top: 10px;
    }
    body.night .cms-history { background: #0b1218; }
    .cms-history-item {
      border-bottom: 1px solid var(--line);
      padding: 8px 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .cms-history-item:last-child { border-bottom: 0; }
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
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
      gap: 18px;
      width: 100%;
    }
    .prep-grid {
      grid-template-columns: minmax(0, 1.45fr) minmax(320px, .75fr);
      grid-template-areas:
        "instructions scope"
        "audience voice"
        "audience narrator"
        "audience actions"
        "how how";
      align-items: start;
    }
    .prep-instructions { grid-area: instructions; }
    .prep-scope { grid-area: scope; }
    .prep-audience { grid-area: audience; }
    .prep-voice { grid-area: voice; }
    .prep-narrator { grid-area: narrator; }
    .prep-actions { grid-area: actions; }
    .prep-how { grid-area: how; }
    .field-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0 16px;
    }
    .field-full { grid-column: 1 / -1; }
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
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
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
      .presenter-avatar.male .hair-back {
        width: 72px;
        height: 56px;
        left: 33px;
        top: 19px;
        border-radius: 30px 30px 18px 18px;
        background: linear-gradient(155deg, #44312c 0%, #201816 72%);
      }
      .presenter-avatar.male .hair-front {
        height: 25px;
        top: -4px;
        border-radius: 28px 28px 14px 14px;
        background: linear-gradient(155deg, #4b3631 0%, #201816 76%);
      }
      .presenter-avatar.male .hair-front::after {
        width: 24px;
        height: 19px;
        right: 8px;
        top: 1px;
        border-radius: 16px 16px 8px 8px;
        transform: rotate(-3deg);
      }
      .presenter-avatar.male .head {
        border-radius: 28px 28px 30px 30px;
      }
      .presenter-avatar.male .brow {
        height: 4px;
        background: #2c211d;
      }
      .presenter-avatar.male .shoulders {
        background: linear-gradient(135deg, #263b54 0%, #162536 100%);
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
    .guide-outputs {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
      margin-top: 12px;
    }
    .guide-outputs textarea {
      min-height: 260px;
      font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    #scRunbook { min-height: 460px; }
    #assetGenerationPrompt { min-height: 340px; }
    #setupPrompt {
      min-height: 280px;
      font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    @media (max-width: 880px) {
      .grid { grid-template-columns: 1fr; }
      .prep-grid {
        grid-template-columns: 1fr;
        grid-template-areas:
          "instructions"
          "scope"
          "audience"
          "voice"
          "narrator"
          "actions"
          "how";
      }
      .field-grid { grid-template-columns: 1fr; }
      .intelligence-overview-grid,
      .intel-summary,
      .priority-intelligence-grid,
      .readiness-hero,
      .cms-auth-grid,
      .cms-editor-grid { grid-template-columns: 1fr; }
      .steps { grid-template-columns: 1fr 1fr; }
      aside { border-right: 0; border-bottom: 1px solid var(--line); }
    }
  </style>
</head>
  <body>
    <header>
      <h1>NetSuite Demo Helper</h1>
      <div class="header-actions">
        <label class="theme-toggle" for="nightMode">
          <input type="checkbox" id="nightMode">
          Night mode
        </label>
      </div>
    </header>
  <nav class="tabs" aria-label="Workspace screens">
    <button class="tab active" data-tab="prep" data-help="Set up the audience, company context, demo input, notes, voice, and demo value emphasis.">Prep</button>
    <button class="tab" data-tab="guide" data-help="Review the personalized SC demo story, setup prompt, and export it to Word.">SC Guide</button>
    <button class="tab" data-tab="intelligence" data-help="Review demo quality, risks, discovery gaps, stakeholder coverage, winning moments, and coaching recommendations.">Intelligence</button>
    <button class="tab" data-tab="manifest" data-help="Review or edit the detailed automation manifest that drives the demo.">Manifest</button>
    <button class="tab" data-tab="run" data-help="Open NetSuite, dry run, rehearse, run the live demo, or stop an active run.">Run</button>
    <button class="tab" data-tab="admin" data-help="Protected admin area for editing shared helper text, demo logic, sources, and playbooks with version history.">Admin</button>
  </nav>
  <main>
    <section class="screen active" id="screen-prep">
      <div class="grid prep-grid">
        <div class="panel prep-instructions">
          <h2>SC Demo Instructions</h2>
          <label for="instructions">What the demo generator should always do and avoid</label>
          <textarea id="instructions" style="min-height:95px">${escapeHtml(defaultScInstructions())}</textarea>
        </div>

        <div class="panel prep-scope">
          <h2>Demo Scope</h2>
          <label for="demoScope">What should this demo cover?</label>
          <textarea id="demoScope" style="min-height:95px" placeholder="Example: financials first services SKU, P2P phase 2, fixed assets, FP&A, advanced inventory."></textarea>
          <p class="hint">This is treated as a planning rule even when the notes do not mention it.</p>
        </div>

        <div class="panel prep-audience">
          <h2>Demo Audience</h2>
          <div class="field-grid">
            <div class="field">
              <label for="audience">Audience type</label>
              <select id="audience">
                ${selectOptionsHtml(demoAudienceConfiguration.audienceTypes, defaultAudienceType)}
              </select>
              <p class="hint" id="audienceHint"></p>
            </div>

            <div class="field">
              <label for="marketSegment">Target audience</label>
              <select id="marketSegment">
                ${selectOptionsHtml(demoAudienceConfiguration.targetAudiences, defaultTargetAudience)}
              </select>
              <p class="hint" id="targetAudienceHint"></p>
            </div>

            <div class="field">
              <label for="demoStrategy">Demo strategy</label>
              <select id="demoStrategy">
                ${selectOptionsHtml(demoStrategies, defaultDemoStrategy)}
              </select>
              <p class="hint" id="demoStrategyHint"></p>
            </div>

            <div class="field">
              <label for="industry">Industry playbook</label>
              <select id="industry">
                ${selectOptionsHtml(industryPlaybooks, defaultIndustry)}
              </select>
              <p class="hint" id="industryHint"></p>
            </div>

            <div class="field">
              <label for="companyUrl">Company website</label>
              <input id="companyUrl" placeholder="https://www.example.com">
            </div>

            <div class="field">
              <label for="inputMode">Demo generation input</label>
              <select id="inputMode">
                <option value="request-and-notes" selected>Use demo request and pre-demo notes</option>
                <option value="request-only">Use demo request only</option>
                <option value="notes-only">Use pre-demo notes only</option>
              </select>
            </div>

            <div class="field">
              <label for="manifestDemoMode">Manifest demo option</label>
              <select id="manifestDemoMode">
                ${selectOptionsHtml(manifestDemoModes, "customer_story")}
              </select>
              <p class="hint" id="manifestDemoModeHint"></p>
            </div>

            <div class="field">
              <label for="outputLanguage">Output language</label>
              <select id="outputLanguage">
                ${languageOptionsHtml(defaultOutputLanguage)}
              </select>
            </div>

            <div class="field field-full">
              <label for="topic">Demo request</label>
              <textarea id="topic" style="min-height:135px">Finance demo for a prospect: standard income statement, filters, drilldown, export, and Cash 360.</textarea>
            </div>

            <div class="field field-full">
              <label for="preDemoNotes">Pre-demo notes</label>
              <textarea id="preDemoNotes" style="min-height:170px" placeholder="Paste discovery notes, pain points, role notes, current systems, concerns, and success criteria."></textarea>
            </div>
          </div>
        </div>

        <div class="panel prep-voice">
          <h2>Narrator Voice</h2>
          <label for="voiceProvider">Narration engine</label>
          <select id="voiceProvider">
            <option value="say" selected>Local Mac voice</option>
            <option value="elevenlabs">ElevenLabs cloud voice (free account/API key)</option>
            </select>
            <p class="hint" id="voiceProviderHint">Local voices work without an API key. Cloud voices need ELEVENLABS_API_KEY when starting the app.</p>

            <div class="conditional-setting" id="voiceApiKeyWrap" hidden>
              <label for="voiceApiKey">Narration API key</label>
              <input id="voiceApiKey" type="password" autocomplete="off" placeholder="Paste the API key for the selected narration service">
              <p class="hint" id="voiceApiKeyHint">The key is used for this browser session and is not saved into the manifest.</p>
            </div>

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

        <div class="panel narrator-card prep-narrator">
          ${presenterAvatarHtml("avatar")}
          <div>
            <h2 id="narratorName">Narrator</h2>
            <p class="hint" id="narratorSegment">Ready</p>
            <p id="narratorLine">The narrator is ready.</p>
            <div class="voice-wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
          </div>
        </div>

        <div class="panel prep-actions">
          <div class="row">
            <button id="learn" data-help="Checks the company website, applies your instructions and notes, then creates a fresh manifest and SC guide.">Learn / Create Demo</button>
            <button class="secondary" id="reload" data-help="Reloads the latest saved manifest and guide without changing anything.">Reload</button>
          </div>
          <p class="hint">This checks the company site, combines it with your notes and instructions, then creates both the editable manifest and a lighter SC guide.</p>
        </div>

        <div class="panel full prep-how">
          <h2>How NetSuite Demo Helper Works</h2>
          <p class="hint">${escapeHtml(helperIntroText())}</p>
          <p class="hint">Current version: local SC workspace. Target version: standalone NSDemoHelper app for Mac and Windows, with update checks from GitHub releases.</p>
          <div class="steps">
            ${helperStepsHtml()}
          </div>
        </div>
      </div>
    </section>

    <section class="screen" id="screen-manifest">
      <div class="row">
        <button id="save" data-help="Saves the JSON currently shown in the manifest editor.">Save Manifest</button>
        <button class="secondary" id="createManifestFromGuide" data-help="Refreshes the runnable manifest from the current SC guide and marks it ready for browser dry-run.">Create Manifest From SC Guide</button>
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
      <div class="guide-outputs">
        <div>
          <label for="scRunbook">Personalized SC story and runbook</label>
          <textarea id="scRunbook" spellcheck="false" readonly></textarea>
        </div>
        <div>
          <label for="assetGenerationPrompt">Demo asset / PowerPoint generation prompt</label>
          <textarea id="assetGenerationPrompt" spellcheck="false" readonly></textarea>
        </div>
      </div>
      <textarea id="scGuide" spellcheck="false" readonly hidden></textarea>
      <div class="band">
        <h2>NetSuite Customization / Setup Prompt</h2>
        <p class="hint" id="setupAccountSummary">Target account will appear after a demo is generated.</p>
        <p class="hint" id="setupItemSummary">Setup items will appear here when the helper detects data or configuration that may need to be created.</p>
        <label for="setupPrompt">Prompt for Codex account setup</label>
        <textarea id="setupPrompt" spellcheck="false" readonly></textarea>
        <div class="row" style="margin-top:10px">
          <button id="executeSetupPrompt" data-help="After confirmation, opens the NetSuite browser, copies the setup prompt, and opens Codex for the account setup handoff.">Execute Now</button>
        </div>
      </div>
    </section>

    <section class="screen" id="screen-intelligence">
      <div class="intelligence-dashboard">
        <section class="readiness-hero" id="readinessHero">
          <div>
            <p class="hero-eyebrow">Demo Intelligence Dashboard</p>
            <h2 id="readinessTitle">Demo readiness</h2>
            <p class="hero-subline" id="readinessSubtitle">Refresh intelligence to see readiness, risks, and next best actions.</p>
            <div class="insight-badges" id="readinessBadges"></div>
          </div>
          <div class="readiness-score">
            <div class="score-number" id="readinessScore">-</div>
            <div class="score-caption">Readiness score</div>
          </div>
        </section>

        <section class="metadata-chips" id="metadataChips" aria-label="Demo metadata"></section>

        <section class="dashboard-section">
          <div class="ai-actions-bar">
            <div>
              <h2 style="margin:0">AI Actions</h2>
              <p class="hint">Use these after reviewing the readiness score and risks.</p>
            </div>
            <div class="ai-actions-buttons">
              <button id="improveGuideFromIntel" data-help="Updates the SC guide with the Intelligence recommendations and guardrails.">Improve SC Guide</button>
              <button class="secondary" id="createFollowUps" data-help="Creates follow-up discovery questions from the Intelligence heatmaps and risk areas.">Generate Follow-Up Questions</button>
              <button class="secondary" id="compressDemo" data-help="Creates a shorter demo coaching prompt based on timing and risk.">Compress Demo</button>
              <button class="secondary" id="generateExecutiveVersion" data-help="Creates an executive-focused version of the demo guidance.">Generate Executive Version</button>
              <button class="secondary" id="rebuildTechnicalAudience" data-help="Creates guidance to rebuild the demo for a technical audience.">Rebuild For Technical Audience</button>
              <button class="secondary" id="refreshIntelligence" data-help="Re-analyzes the current SC guide, pre-demo notes, audience choices, and runnable manifest status.">Refresh Intelligence</button>
            </div>
          </div>
          <details class="custom-ai">
            <summary>Custom AI Instruction</summary>
            <textarea id="customAiInstruction" spellcheck="false" placeholder="Write a custom instruction for how the intelligence should be used, for example: make this sharper for a CFO and reduce the technical detail." style="min-height:95px;margin-top:10px"></textarea>
            <div class="row" style="margin-top:10px">
              <button class="secondary" id="copyCustomAiInstruction">Prepare Custom Instruction</button>
            </div>
          </details>
          <textarea id="intelligenceActionOutput" spellcheck="false" readonly placeholder="AI action output will appear here." style="min-height:120px;margin-top:12px"></textarea>
        </section>

        <section class="dashboard-section">
          <div class="section-head">
            <div>
              <h2>SC Briefing</h2>
              <p>Concise preparation guidance before opening the detailed cards.</p>
            </div>
          </div>
          <div class="briefing-grid" id="scBriefing"></div>
        </section>

        <section class="dashboard-section">
          <div class="section-head">
            <div>
              <h2>Intelligence Areas</h2>
              <p>Open one card at a time for deeper coaching detail.</p>
            </div>
          </div>
          <div class="intelligence-card-grid" id="intelligenceCardGrid"></div>
        </section>

        <section class="detail-panel" id="intelligenceDetailPanel">
          <p class="hint">Choose an intelligence card to see the detailed analysis.</p>
        </section>

        <section class="dashboard-section">
          <div class="section-head">
            <div>
              <h2>Demo Intelligence Heatmap</h2>
              <p id="heatmapRecommendation">Select a heatmap lens to see where the demo is strong and where it needs work.</p>
            </div>
          </div>
          <div class="heatmap-tabs" id="heatmapTabs">
            <button class="secondary heatmap-tab-button active" data-heatmap-tab="demo">Demo Strength</button>
            <button class="secondary heatmap-tab-button" data-heatmap-tab="stakeholder">Stakeholder Focus</button>
            <button class="secondary heatmap-tab-button" data-heatmap-tab="discovery">Discovery Quality</button>
            <button class="secondary heatmap-tab-button" data-heatmap-tab="business">Business Alignment</button>
          </div>
          <div id="intelligenceHeatmap"></div>
        </section>

        <details class="dashboard-section" id="competitiveAdvisory">
          <summary class="competitive-summary">Competitive Guidance — Advisory Only</summary>
          <div class="advisory" style="margin-top:12px">Competitive insights are advisory only and may be incomplete or outdated. Validate important claims before customer use.</div>
          <div id="competitiveAnalyzer" style="margin-top:12px"></div>
        </details>
      </div>
    </section>

    <section class="screen" id="screen-run">
      <div class="grid">
        <div class="panel">
          <h2>Run Controls</h2>
          <div class="row">
            <button class="secondary" id="openBrowser" data-help="Opens or reuses the NetSuite browser session so you can sign in before running the demo.">Open NetSuite Browser</button>
            <button class="secondary" data-run="dry" data-help="Checks the planned demo steps without controlling NetSuite or playing audio.">Dry Run</button>
            <button class="secondary" data-run="browser-dry-run" data-help="Creates the prep buffer, validates the runnable manifest, and opens the NetSuite browser without live narration.">Browser Dry-Run</button>
            <button class="secondary" data-run="rehearse" data-help="Creates an account prep buffer and Codex setup prompt, then runs the browser rehearsal without narration.">Rehearse + Prep Account</button>
            <button data-run="live" data-help="Runs the full NetSuite automation with narrator audio using the selected voice.">Live Demo</button>
            <button class="danger" id="stopRun" disabled data-help="Stops the currently running demo automation.">Stop</button>
          </div>
          <p class="hint">Rehearse + Prep Account first. Then use Live Demo when the manifest, SC guide, and account prep buffer look right.</p>
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

    <section class="screen" id="screen-admin">
      <div class="grid">
        <div class="panel full">
          <h2>Admin</h2>
          <p class="hint">Protected local admin area for changing the helper's built-in guidance, playbooks, labels, explanatory text, and additional demo logic sources. Active sources are matched to the demo context and included when the helper creates the manifest and SC guide. Passwords are stored as salted scrypt hashes and every CMS save creates a rollback version.</p>
          <div class="cms-auth-grid" id="cmsAuthArea">
            <div class="analysis-item" id="cmsSetupPanel" hidden>
              <strong>Create Admin Login</strong>
              <p class="hint">First run only. Use a password of at least 12 characters. It is stored locally as a salted hash, not as plain text.</p>
              <label for="cmsSetupPassword">Admin password</label>
              <input id="cmsSetupPassword" type="password" autocomplete="new-password">
              <label for="cmsSetupPasswordConfirm">Confirm password</label>
              <input id="cmsSetupPasswordConfirm" type="password" autocomplete="new-password">
              <div class="row" style="margin-top:10px">
                <button id="cmsSetupButton">Create Admin Login</button>
              </div>
            </div>
            <div class="analysis-item" id="cmsLoginPanel" hidden>
              <strong>Login</strong>
              <p class="hint">Login unlocks editing for this local browser session. Sessions expire automatically.</p>
              <label for="cmsLoginPassword">Admin password</label>
              <input id="cmsLoginPassword" type="password" autocomplete="current-password">
              <div class="row" style="margin-top:10px">
                <button id="cmsLoginButton">Login</button>
              </div>
            </div>
            <div class="analysis-item" id="cmsSessionPanel" hidden>
              <strong>CMS unlocked</strong>
              <p class="hint" id="cmsSecuritySummary">Content editing is available.</p>
              <div class="row" style="margin-top:10px">
                <button class="secondary" id="cmsReloadButton">Reload CMS</button>
                <button class="secondary" id="cmsLogoutButton">Logout</button>
              </div>
            </div>
          </div>
          <p class="hint" id="cmsStatus">CMS status will appear here.</p>
        </div>

        <div class="panel full" id="cmsEditorPanel" hidden>
          <h2>Content Editor</h2>
          <div class="cms-editor-grid">
            <div>
              <label for="cmsBlockSelect">Content block</label>
              <select id="cmsBlockSelect"></select>
              <p class="hint" id="cmsBlockDescription"></p>
              <label for="cmsChangeNote">Change note</label>
              <input id="cmsChangeNote" placeholder="Example: tighten enterprise demo guidance">
              <div class="row" style="margin-top:10px">
                <button id="cmsSaveButton">Save Content Block</button>
              </div>
              <div class="band">
                <label for="cmsVersionSelect">Restore older CMS version</label>
                <select id="cmsVersionSelect"></select>
                <div class="row" style="margin-top:10px">
                  <button class="secondary" id="cmsRestoreButton">Restore Selected Version</button>
                </div>
                <p class="hint">Restoring also creates a backup of the current CMS content first.</p>
              </div>
              <div class="cms-history" id="cmsHistory"></div>
            </div>
            <div>
              <label for="cmsReadable">Readable preview</label>
              <div class="cms-readable" id="cmsReadable"></div>
              <label for="cmsEditor" style="margin-top:14px">Raw JSON / editable content</label>
              <textarea id="cmsEditor" spellcheck="false"></textarea>
              <p class="hint" id="cmsEditorHint">Text blocks save as plain text. Playbook blocks save as JSON and are validated before they become active.</p>
            </div>
          </div>
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
    const scRunbook = document.getElementById("scRunbook");
    const assetGenerationPrompt = document.getElementById("assetGenerationPrompt");
    const setupPrompt = document.getElementById("setupPrompt");
    const setupAccountSummary = document.getElementById("setupAccountSummary");
    const setupItemSummary = document.getElementById("setupItemSummary");
    const intelligenceActionOutput = document.getElementById("intelligenceActionOutput");
    const customAiInstruction = document.getElementById("customAiInstruction");
    const voiceSelect = document.getElementById("voiceSelect");
    const voiceProviderSelect = document.getElementById("voiceProvider");
    const voiceProviderHint = document.getElementById("voiceProviderHint");
    const voiceApiKeyWrap = document.getElementById("voiceApiKeyWrap");
    const voiceApiKeyField = document.getElementById("voiceApiKey");
    const voiceApiKeyHint = document.getElementById("voiceApiKeyHint");
    const audienceSelect = document.getElementById("audience");
    const audienceHint = document.getElementById("audienceHint");
    const targetAudienceSelect = document.getElementById("marketSegment");
    const targetAudienceHint = document.getElementById("targetAudienceHint");
    const demoStrategySelect = document.getElementById("demoStrategy");
    const demoStrategyHint = document.getElementById("demoStrategyHint");
    const industrySelect = document.getElementById("industry");
    const industryHint = document.getElementById("industryHint");
    const inputModeSelect = document.getElementById("inputMode");
    const manifestDemoModeSelect = document.getElementById("manifestDemoMode");
    const manifestDemoModeHint = document.getElementById("manifestDemoModeHint");
    const outputLanguageSelect = document.getElementById("outputLanguage");
    const nightModeToggle = document.getElementById("nightMode");
    const demoScopeField = document.getElementById("demoScope");
    const topicField = document.getElementById("topic");
    const preDemoNotesField = document.getElementById("preDemoNotes");
    const buttonHelpTooltip = document.getElementById("buttonHelpTooltip");
    const cmsSetupPanel = document.getElementById("cmsSetupPanel");
    const cmsLoginPanel = document.getElementById("cmsLoginPanel");
    const cmsSessionPanel = document.getElementById("cmsSessionPanel");
    const cmsEditorPanel = document.getElementById("cmsEditorPanel");
    const cmsStatus = document.getElementById("cmsStatus");
    const cmsBlockSelect = document.getElementById("cmsBlockSelect");
    const cmsBlockDescription = document.getElementById("cmsBlockDescription");
    const cmsChangeNote = document.getElementById("cmsChangeNote");
    const cmsEditor = document.getElementById("cmsEditor");
    const cmsReadable = document.getElementById("cmsReadable");
    const cmsVersionSelect = document.getElementById("cmsVersionSelect");
    const cmsHistory = document.getElementById("cmsHistory");
    const cmsSecuritySummary = document.getElementById("cmsSecuritySummary");
    const audienceTypeConfig = ${JSON.stringify(demoAudienceConfiguration.audienceTypes)};
    const targetAudienceConfig = ${JSON.stringify(demoAudienceConfiguration.targetAudiences)};
    const demoStrategyConfig = ${JSON.stringify(demoStrategies)};
    const industryConfig = ${JSON.stringify(industryPlaybooks)};
    const manifestDemoModeConfig = ${JSON.stringify(manifestDemoModes)};
    const outputLanguageConfig = ${JSON.stringify(Object.values(outputLanguages))};
    const defaultAudienceType = ${JSON.stringify(defaultAudienceType)};
    const defaultTargetAudience = ${JSON.stringify(defaultTargetAudience)};
    const defaultOutputLanguage = ${JSON.stringify(defaultOutputLanguage)};
    const defaultDemoStrategy = ${JSON.stringify(defaultDemoStrategy)};
    const defaultIndustry = ${JSON.stringify(defaultIndustry)};
    let runInProgress = false;
    let latestSetupPrompt = null;
    let latestIntelligence = null;
    let selectedIntelligenceCard = "risks";
    let activeHeatmapTab = "demo";
    let cmsBlocks = [];
    const heatmapPages = { demo: 0, notes: 0 };
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

    async function loadCmsStatus() {
      try {
        const payload = await api("/api/cms/status");
        renderCmsAuth(payload);
        if (payload.authenticated) await loadCmsContent();
      } catch (error) {
        cmsStatus.textContent = error.message;
      }
    }

    function renderCmsAuth(payload) {
      cmsSetupPanel.hidden = !payload.setupRequired;
      cmsLoginPanel.hidden = payload.setupRequired || payload.authenticated;
      cmsSessionPanel.hidden = !payload.authenticated;
      cmsEditorPanel.hidden = !payload.authenticated;
      cmsStatus.textContent = payload.setupRequired
        ? "Create the local CMS admin password before editing shared content."
        : payload.authenticated
          ? "CMS unlocked. Choose a content block, edit it, and save with a short change note."
          : "Login required before CMS content can be edited.";
      const security = payload.security || {};
      cmsSecuritySummary.textContent = [security.passwordStorage, security.session, security.versioning].filter(Boolean).join(" | ");
    }

    async function loadCmsContent() {
      const payload = await api("/api/cms");
      renderCms(payload);
    }

    function renderCms(payload) {
      cmsBlocks = payload.blocks || [];
      const previous = cmsBlockSelect.value;
      cmsBlockSelect.innerHTML = cmsBlocks.map((block) => "<option value='" + escapeClientHtml(block.id) + "'>" + escapeClientHtml(block.label) + "</option>").join("");
      if (previous && cmsBlocks.some((block) => block.id === previous)) cmsBlockSelect.value = previous;
      renderSelectedCmsBlock();
      cmsVersionSelect.innerHTML = (payload.versions || []).length
        ? payload.versions.map((file) => "<option value='" + escapeClientHtml(file) + "'>" + escapeClientHtml(file) + "</option>").join("")
        : "<option value=''>No CMS versions yet</option>";
      cmsHistory.innerHTML = (payload.content?.history || []).slice(0, 12).map((item) =>
        "<div class='cms-history-item'><strong>" + escapeClientHtml(item.label || item.blockId) + "</strong><br>" +
        escapeClientHtml(item.note || "Updated") + "<br><span>" + escapeClientHtml(item.changedAt || "") + "</span></div>"
      ).join("") || "<p class='hint'>No CMS changes yet.</p>";
    }

    function renderSelectedCmsBlock() {
      const block = cmsBlocks.find((item) => item.id === cmsBlockSelect.value) || cmsBlocks[0];
      if (!block) {
        cmsEditor.value = "";
        cmsBlockDescription.textContent = "";
        return;
      }
      cmsBlockSelect.value = block.id;
      cmsBlockDescription.textContent = block.description + " Last updated: " + (block.updatedAt || "never");
      cmsEditor.value = block.kind === "json"
        ? JSON.stringify(block.value, null, 2)
        : String(block.value || "");
      document.getElementById("cmsEditorHint").textContent = block.kind === "json"
        ? "This block is JSON. The app validates the structure before it becomes active."
        : "This block is plain text. It cannot be saved blank.";
      renderCmsReadableFromEditor();
    }

    function renderCmsReadableFromEditor() {
      const block = cmsBlocks.find((item) => item.id === cmsBlockSelect.value) || cmsBlocks[0];
      if (!block) {
        cmsReadable.innerHTML = "<p class='hint'>Choose a content block to preview it.</p>";
        return;
      }
      if (block.kind === "text") {
        cmsReadable.innerHTML = readableTextHtml(cmsEditor.value);
        return;
      }
      try {
        cmsReadable.innerHTML = readableJsonHtml(JSON.parse(cmsEditor.value));
      } catch (error) {
        cmsReadable.innerHTML = "<p class='hint'>The JSON preview will update once the JSON is valid.</p>";
      }
    }

    function readableTextHtml(value) {
      const lines = String(value || "").split(/\\n+/).map((line) => line.trim()).filter(Boolean);
      return lines.length
        ? lines.map((line) => "<p>" + escapeClientHtml(line) + "</p>").join("")
        : "<p class='hint'>No text yet.</p>";
    }

    function readableJsonHtml(value) {
      if (Array.isArray(value)) {
        return value.map((item, index) => readableObjectCard(item, index)).join("") || "<p class='hint'>Empty list.</p>";
      }
      if (value && typeof value === "object") {
        return Object.entries(value).map(([key, item]) => readableObjectCard({ id: key, ...(item || {}) }, key)).join("");
      }
      return "<p>" + escapeClientHtml(value) + "</p>";
    }

    function readableObjectCard(item, fallback) {
      if (!item || typeof item !== "object") return "<div class='readable-card'><p>" + escapeClientHtml(item) + "</p></div>";
      const title = item.label || item.title || item.id || fallback;
      const description = item.description || item.body || item.instruction || item.tone || "";
      const lists = Object.entries(item)
        .filter(([, value]) => Array.isArray(value) && value.length)
        .slice(0, 4)
        .map(([key, values]) => "<p><strong>" + escapeClientHtml(readableLabel(key)) + ":</strong> " + escapeClientHtml(values.slice(0, 6).join(", ")) + "</p>")
        .join("");
      const scalar = Object.entries(item)
        .filter(([key, value]) => !["id", "label", "title", "description", "body", "instruction"].includes(key) && !Array.isArray(value) && value && typeof value !== "object")
        .slice(0, 4)
        .map(([key, value]) => "<p><strong>" + escapeClientHtml(readableLabel(key)) + ":</strong> " + escapeClientHtml(value) + "</p>")
        .join("");
      return "<div class='readable-card'><h3>" + escapeClientHtml(title) + "</h3>" +
        (description ? "<p>" + escapeClientHtml(description) + "</p>" : "") + scalar + lists + "</div>";
    }

    function readableLabel(value) {
      return String(value || "").replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
    }

    function reloadAfterCmsChange(message) {
      cmsStatus.textContent = message + " Reloading the app so the updated CMS content is used everywhere.";
      sessionStorage.setItem("nsdhActiveTab", "admin");
      setTimeout(() => window.location.reload(), 600);
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

      function applyNightMode(save = true) {
        document.body.classList.toggle("night", nightModeToggle.checked);
        if (save) localStorage.setItem("nsDemoHelperNightMode", nightModeToggle.checked ? "1" : "0");
      }

      nightModeToggle.checked = localStorage.getItem("nsDemoHelperNightMode") === "1";
      applyNightMode(false);
      nightModeToggle.onchange = () => applyNightMode();

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
      renderGuideOutputs(payload.guide || "", payload.guideOutputs);
      renderSetupPrompt(payload.setupPrompt);
      if (payload.manifest) {
          setAudience(payload.manifest.context?.audience?.value || payload.manifest.context?.demoRequest?.audience || payload.manifest.audience || defaultAudienceType);
          setMarketSegment(payload.manifest.context?.targetAudience?.value || payload.manifest.context?.marketSegment?.value || payload.manifest.context?.demoRequest?.targetAudience || payload.manifest.context?.demoRequest?.marketSegment || defaultTargetAudience);
          setDemoStrategy(payload.manifest.context?.demoStrategy?.id || payload.manifest.context?.demoRequest?.demoStrategy || payload.manifest.defaults?.demoStrategy || defaultDemoStrategy);
          setIndustry(payload.manifest.context?.industry?.id || payload.manifest.context?.demoRequest?.industry || payload.manifest.defaults?.industry || defaultIndustry);
          setManifestDemoMode(payload.manifest.context?.manifestDemoMode?.id || payload.manifest.context?.demoRequest?.manifestDemoMode || payload.manifest.defaults?.manifestDemoMode || "customer_story");
          setOutputLanguage(payload.manifest.context?.outputLanguage?.value || payload.manifest.context?.demoRequest?.outputLanguage || payload.manifest.defaults?.outputLanguage || defaultOutputLanguage);
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
          syncVoiceProviderSettings();
          updateAvatarPersona();
        if (payload.manifest.context?.demoRequest?.instructions) {
          document.getElementById("instructions").value = payload.manifest.context.demoRequest.instructions;
        }
        demoScopeField.value = payload.manifest.context?.demoScope || payload.manifest.context?.demoRequest?.demoScope || "";
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
      renderIntelligence(payload.intelligence);
    }

    function renderGuideOutputs(guide, outputs = {}) {
      scRunbook.value = outputs.scRunbook || sectionFromGuide(guide, "Personalized Demo Story And Runbook") || outputs.personalizedExperienceFlow || "";
      assetGenerationPrompt.value = outputs.assetGenerationPrompt || sectionFromGuide(guide, "Demo Asset Generation Prompt") || "";
    }

    function sectionFromGuide(guide, heading) {
      const lines = String(guide || "").split(/\\r?\\n/);
      const start = lines.findIndex((line) => line.trim() === "## " + heading);
      if (start < 0) return "";
      const collected = [];
      for (let index = start + 1; index < lines.length; index += 1) {
        if (lines[index].startsWith("## ")) break;
        collected.push(lines[index]);
      }
      return collected.join("\\n").trim();
    }

    function setAudience(value) {
      audienceSelect.value = normalizeUiAudience(value, audienceTypeConfig, defaultAudienceType, {
        "existing-customer": "customer",
        "already-existing-customer": "customer",
        "marketing-audience": "marketing",
        enduser: "operational"
      });
      updateAudienceHints();
    }

    function setMarketSegment(value) {
      targetAudienceSelect.value = normalizeUiAudience(value, targetAudienceConfig, defaultTargetAudience, {
        "mid-market": "mid_market",
        midmarket: "mid_market",
        "public-sector": "public_sector",
        "public-sector-government": "public_sector",
        "emerging-smb": "emerging"
      });
      updateAudienceHints();
    }

    function selectedMarketSegment() {
      return targetAudienceSelect.value || defaultTargetAudience;
    }

    function setDemoStrategy(value) {
      demoStrategySelect.value = normalizeUiAudience(value, demoStrategyConfig, defaultDemoStrategy, {
        discovery: "discovery_demo",
        vision: "vision_demo",
        standard: "standard_platform_demo",
        platform: "standard_platform_demo",
        "standard-platform": "standard_platform_demo",
        "standard-platform-demo": "standard_platform_demo",
        "platform-demo": "standard_platform_demo",
        executive: "executive_alignment",
        technical: "technical_validation",
        competitive: "competitive_defense",
        expansion: "expansion_demo",
        renewal: "renewal_demo",
        workshop: "workshop_session",
        poc: "proof_of_concept",
        training: "training_session"
      });
      updateStrategyIndustryHints();
    }

    function setIndustry(value) {
      industrySelect.value = normalizeUiAudience(value, industryConfig, defaultIndustry, {
        general: "general_business",
        unknown: "general_business",
        wholesale: "wholesale_distribution",
        distribution: "wholesale_distribution",
        software: "saas",
        "professional-services": "services",
        nonprofit: "nonprofit",
        "non-profit": "nonprofit",
        finance: "financial_services"
      });
      updateStrategyIndustryHints();
    }

    function setOutputLanguage(value) {
      outputLanguageSelect.value = normalizeUiOutputLanguage(value);
    }

    function setManifestDemoMode(value) {
      manifestDemoModeSelect.value = normalizeUiAudience(value, manifestDemoModeConfig, "customer_story", {
        plain: "plain_demo",
        "plain-demo": "plain_demo",
        "product-demo": "plain_demo",
        story: "customer_story",
        customer: "customer_story",
        "customer-story": "customer_story"
      });
      updateManifestDemoModeHint();
    }

    function normalizeUiAudience(value, items, fallback, aliases = {}) {
      const raw = String(value || "").trim().toLowerCase();
      const compact = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const id = aliases[raw] || aliases[compact] || aliases[raw.replace(/[^a-z0-9]+/g, "")] || compact;
      return items.some((item) => item.id === id) ? id : fallback;
    }

    function normalizeUiOutputLanguage(value) {
      const raw = String(value || "").trim().toLowerCase();
      const language = outputLanguageConfig.find((item) => item.value === raw || item.label.toLowerCase() === raw);
      return language ? language.value : defaultOutputLanguage;
    }

    function selectedConfig(items, value, fallback) {
      return items.find((item) => item.id === value) || items.find((item) => item.id === fallback) || items[0];
    }

    function updateAudienceHints() {
      const audience = selectedConfig(audienceTypeConfig, audienceSelect.value, defaultAudienceType);
      const target = selectedConfig(targetAudienceConfig, targetAudienceSelect.value, defaultTargetAudience);
      audienceHint.textContent = audience.description + " Focus: " + audience.primary_focus.slice(0, 4).join(", ") + ". Style: " + audience.demo_style.join(", ") + ".";
      targetAudienceHint.textContent = target.description + " Include: " + target.include_in_demo.slice(0, 4).join(", ") + ". Avoid: " + target.avoid_in_demo.slice(0, 3).join(", ") + ".";
    }

    function updateManifestDemoModeHint() {
      const mode = selectedConfig(manifestDemoModeConfig, manifestDemoModeSelect.value, "customer_story");
      manifestDemoModeHint.textContent = mode.description;
    }

    function updateStrategyIndustryHints() {
      const strategy = selectedConfig(demoStrategyConfig, demoStrategySelect.value, defaultDemoStrategy);
      const industry = selectedConfig(industryConfig, industrySelect.value, defaultIndustry);
      demoStrategyHint.textContent = strategy.description + " Tone: " + strategy.tone + ". Pacing: " + strategy.pacing + ".";
      industryHint.textContent = industry.description + " KPIs: " + industry.kpis.slice(0, 4).join(", ") + ".";
    }

    function renderIntelligence(intelligence) {
      if (!intelligence) return;
      latestIntelligence = intelligence;
      const risk = intelligence.demo_risk_analyzer || {};
      const discovery = intelligence.discovery_gap_analyzer || {};
      const stakeholder = intelligence.stakeholder_coverage_analyzer || {};
      const winning = intelligence.winning_moment_detection || {};
      const avoid = intelligence.what_not_to_demo_engine || {};
      const timing = intelligence.demo_timing_pacing_analyzer || {};
      const coach = intelligence.ai_rehearsal_coach || {};
      const demoHeatmap = intelligence.demo_heatmap_analyzer || {};
      const notes = intelligence.pre_demo_notes_analyzer || {};
      const competitive = intelligence.competitive_positioning_mode || {};
      const strategy = intelligence.demo_strategy || {};
      const industry = intelligence.industry_playbook || {};
      const metadata = intelligence.demo_metadata || {};
      const readiness = readinessScore(risk, notes, coach);
      const strength = firstClean([...(risk.score_details?.what_is_strong || []), ...(demoHeatmap.strongest_areas || []), ...(winning.winning_moments || [])]) || "Clear proof moments are available";
      const biggestRisk = firstClean([...(risk.warnings || []), ...(demoHeatmap.needs_work_areas || [])]) || "No major risk detected";
      const missing = firstClean([...(discovery.missing_discovery_items || []), ...(notes.risk_areas || [])]) || "No major discovery gap";
      const title = metadata.customer_name ? metadata.customer_name + " demo readiness" : "Demo readiness";

      document.getElementById("readinessTitle").textContent = title;
      document.getElementById("readinessSubtitle").textContent =
        [metadata.strategy, metadata.audience_type, metadata.target_segment, metadata.industry].filter(Boolean).join(" | ") ||
        "Use this dashboard to decide whether the demo is ready and where to focus next.";
      document.getElementById("readinessScore").textContent = readiness;
      document.getElementById("readinessBadges").innerHTML = [
        insightBadge("Biggest Strength", strength),
        insightBadge("Biggest Risk", biggestRisk),
        insightBadge("Missing Discovery", missing)
      ].join("");
      document.getElementById("metadataChips").innerHTML = [
        metadataChip("Strategy", metadata.strategy || strategy.label, strategy.description),
        metadataChip("Industry", metadata.industry || industry.label, industry.description),
        metadataChip("Audience", metadata.audience_type, "Primary audience type selected for this demo."),
        metadataChip("Segment", metadata.target_segment, "Target customer segment selected for this demo."),
        metadataChip("Language", metadata.language, "Output language for generated demo assets."),
        metadataChip("Narration Voice", metadata.narration_voice, "Voice selected for narration.")
      ].join("");
      document.getElementById("scBriefing").innerHTML = scBriefingHtml(metadata, strategy, industry, winning, risk, discovery);

      const cards = intelligenceCards({ risk, discovery, stakeholder, winning, avoid, timing, coach, competitive, notes });
      if (!cards.some((card) => card.id === selectedIntelligenceCard)) selectedIntelligenceCard = cards[0]?.id || "risks";
      document.getElementById("intelligenceCardGrid").innerHTML = cards.map(intelligenceCardHtml).join("");
      renderIntelligenceDetail(cards);
      renderIntelligenceHeatmap(intelligence);
      renderCompetitiveAdvisory(competitive);
    }

    function firstClean(items = []) {
      return (items || []).map((item) => String(item || "").trim()).find(Boolean) || "";
    }

    function readinessScore(risk, notes, coach) {
      const quality = Number(risk.demo_quality_score);
      const riskScore = Number(risk.demo_risk_score);
      const notesScore = Number(notes.overall_score);
      const clarity = Number(coach.clarity_score);
      const parts = [
        Number.isFinite(quality) ? quality * .42 : null,
        Number.isFinite(riskScore) ? (100 - riskScore) * .26 : null,
        Number.isFinite(notesScore) ? notesScore * .18 : null,
        Number.isFinite(clarity) ? clarity * .14 : null
      ].filter((value) => value !== null);
      return Math.max(0, Math.min(100, Math.round(parts.reduce((sum, value) => sum + value, 0) || quality || 0)));
    }

    function insightBadge(label, value) {
      return "<span class='insight-badge'><strong>" + escapeClientHtml(label) + ":</strong>" + escapeClientHtml(value || "-") + "</span>";
    }

    function metadataChip(label, value, rationale = "") {
      return "<details class='metadata-chip'><summary><strong>" + escapeClientHtml(label) + ":</strong>" + escapeClientHtml(value || "-") + "</summary>" +
        (rationale ? "<p>" + escapeClientHtml(rationale) + "</p>" : "") + "</details>";
    }

    function scBriefingHtml(metadata, strategy, industry, winning, risk, discovery) {
      const drivers = uniqueClientItems([
        ...(metadata.likely_priorities || []),
        ...(industry.kpis || []),
        ...(industry.pain_points || []),
        ...(risk.score_details?.what_is_strong || [])
      ]).slice(0, 4);
      const criticalMoments = uniqueClientItems([
        ...(winning.winning_moments || []),
        ...(risk.score_details?.what_needs_work || []),
        ...(discovery.recommended_follow_up_questions || [])
      ]).slice(0, 3);
      return [
        briefingItem("Customer Situation", metadata.customer_description || metadata.customer_name || "Use the pre-demo notes and company context to frame the situation."),
        briefingItem("Demo Goal", metadata.demo_goal || metadata.demo_scope || "Make the customer confident the selected NetSuite story addresses their current priorities."),
        briefingItem("Key Business Drivers", drivers.join(", ") || "Visibility, control, speed, and trusted decisions."),
        briefingItem("Recommended Tone", [strategy.tone, strategy.pacing].filter(Boolean).join(". ") || "Consultative and outcome-led."),
        briefingItem("Critical Demo Moments", criticalMoments.join(" | ") || "Open with the executive story, slow down on proof moments, and close with business impact.")
      ].join("");
    }

    function briefingItem(title, body) {
      return "<div class='briefing-item'><strong>" + escapeClientHtml(title) + "</strong><p>" + escapeClientHtml(body || "-") + "</p></div>";
    }

    function intelligenceCards(data) {
      const { risk, discovery, stakeholder, winning, avoid, timing, coach, competitive, notes } = data;
      const stakeholderItems = stakeholder.stakeholder_coverage || [];
      const competitiveFocus = competitive.competitive_focus || [];
      return [
        {
          id: "risks",
          icon: "!",
          title: "Demo Risks",
          summary: risk.warnings?.[0] || "No major demo risk detected.",
          metric: (risk.demo_risk_score ?? "-") + " risk",
          status: statusForRisk(risk.demo_risk_score),
          previews: (risk.warnings || risk.recommendations || []).slice(0, 3),
          detail: listBlock("Warnings", risk.warnings) + listBlock("Recommendations", risk.recommendations) + hintBlock(risk.score_explanation)
        },
        {
          id: "discovery",
          icon: "?",
          title: "Discovery Gaps",
          summary: (discovery.missing_discovery_items || []).length + " missing discovery items detected.",
          metric: (notes.overall_score ?? "-") + "/100",
          status: statusForScore(notes.overall_score),
          previews: [...(discovery.missing_discovery_items || []), ...(notes.risk_areas || [])].slice(0, 3),
          detail: analysisItem("Pre-demo notes score", notes.overall_score ? notes.overall_score + "/100" : "-", notes.summary) +
            listBlock("Missing discovery items", discovery.missing_discovery_items) +
            listBlock("Follow-up questions", discovery.recommended_follow_up_questions) +
            listBlock("Notes recommendations", notes.recommendations) +
            pillList(discovery.found_discovery_items || [])
        },
        {
          id: "stakeholders",
          icon: "S",
          title: "Stakeholder Coverage",
          summary: stakeholder.recommendation || "Coverage looks balanced enough for rehearsal.",
          metric: stakeholderItems.length + " roles",
          status: stakeholderItems.some((item) => Number(item.coverage) < 25) ? "warning" : "strong",
          previews: stakeholderItems.slice(0, 3).map((item) => item.role + ": " + item.coverage + "%"),
          detail: coverageRows(stakeholderItems) + hintBlock(stakeholder.recommendation)
        },
        {
          id: "timing",
          icon: "T",
          title: "Timing & Pacing",
          summary: "Estimated runtime: " + (timing.estimated_runtime || "unknown") + ".",
          metric: timing.overrun_risk || "unknown",
          status: timing.overrun_risk === "high" ? "critical" : timing.overrun_risk === "medium" ? "warning" : "strong",
          previews: [...(timing.high_risk_sections || []), ...(timing.recommended_cuts || [])].slice(0, 3),
          detail: analysisItem("Estimated runtime", timing.estimated_runtime, "Overrun risk: " + (timing.overrun_risk || "unknown")) +
            hintBlock(timing.basis) + timingRows(timing.section_timing || []) +
            listBlock("Recommended cuts", timing.recommended_cuts)
        },
        {
          id: "winning",
          icon: "W",
          title: "Winning Moments",
          summary: (winning.winning_moments || [])[0] || "No clear winning moment detected yet.",
          metric: (winning.winning_moments || []).length + " moments",
          status: (winning.winning_moments || []).length >= 3 ? "strong" : "warning",
          previews: (winning.winning_moments || []).slice(0, 3),
          detail: listBlock("Moments to slow down for", winning.winning_moments) +
            (winning.details || []).map((item) => analysisItem(item.moment, item.segment, item.coaching_tip)).join("")
        },
        {
          id: "avoid",
          icon: "X",
          title: "What NOT To Demo",
          summary: "Keep low-value or risky areas out of the main path.",
          metric: (avoid.avoid_showing || []).length + " avoid",
          status: "warning",
          previews: (avoid.avoid_showing || []).slice(0, 3),
          detail: listBlock("Avoid showing", avoid.avoid_showing) + hintBlock(avoid.rationale)
        },
        {
          id: "coach",
          icon: "C",
          title: "Rehearsal Coach",
          summary: coach.status || "Use rehearsal later for pacing and transcript coaching.",
          metric: (coach.clarity_score ?? "-") + " clarity",
          status: statusForScore(coach.clarity_score),
          previews: (coach.recommendations || []).slice(0, 3),
          detail: analysisItem("Status", coach.status, "Use rehearsal output later for transcript and pacing feedback.") +
            hintBlock(coach.basis) +
            listBlock("Coaching recommendations", coach.recommendations) +
            listBlock("Future transcript metrics", coach.suggested_metrics_for_future_rehearsal_transcripts)
        },
        {
          id: "competitive",
          icon: "A",
          title: "Competitive Positioning",
          summary: "Advisory guidance only. Validate claims before customer use.",
          metric: competitiveFocus.length + " topics",
          status: "advisory",
          previews: competitiveFocus.slice(0, 3).map((item) => item.topic),
          detail: "<div class='advisory'>Competitive insights are advisory only and may be incomplete or outdated. Validate important claims before customer use.</div>" +
            competitiveFocus.map((item) => analysisItem(item.topic, item.why_it_matters, item.recommended_demo_moment)).join("")
        }
      ];
    }

    function intelligenceCardHtml(card) {
      const active = card.id === selectedIntelligenceCard ? " active" : "";
      const previews = (card.previews || []).filter(Boolean).slice(0, 3);
      return "<button class='intelligence-card" + active + "' data-intel-card='" + escapeClientHtml(card.id) + "'>" +
        "<div class='card-title-row'><span class='card-icon'>" + escapeClientHtml(card.icon) + "</span><span class='status-badge " + escapeClientHtml(card.status) + "'>" + escapeClientHtml(card.status) + "</span></div>" +
        "<h3 class='card-title'>" + escapeClientHtml(card.title) + "</h3>" +
        "<div class='card-metric'>" + escapeClientHtml(card.metric || "-") + "</div>" +
        "<p class='card-summary'>" + escapeClientHtml(card.summary || "") + "</p>" +
        (previews.length ? "<ul class='preview-list'>" + previews.map((item) => "<li>" + escapeClientHtml(item) + "</li>").join("") + "</ul>" : "<p class='hint'>No preview items detected.</p>") +
      "</button>";
    }

    function renderIntelligenceDetail(cards) {
      const card = cards.find((item) => item.id === selectedIntelligenceCard) || cards[0];
      if (!card) return;
      document.getElementById("intelligenceDetailPanel").innerHTML =
        "<div class='section-head'><div><h2>" + escapeClientHtml(card.title) + "</h2><p>" + escapeClientHtml(card.summary || "") + "</p></div>" +
        "<span class='status-badge " + escapeClientHtml(card.status) + "'>" + escapeClientHtml(card.status) + "</span></div>" +
        "<div class='detail-grid'>" + (card.detail || "<p class='hint'>No detail available yet.</p>") + "</div>";
    }

    function statusForScore(score) {
      const value = Number(score);
      if (!Number.isFinite(value)) return "advisory";
      if (value >= 80) return "strong";
      if (value >= 55) return "warning";
      return "critical";
    }

    function statusForRisk(score) {
      const value = Number(score);
      if (!Number.isFinite(value)) return "advisory";
      if (value >= 75) return "critical";
      if (value >= 45) return "warning";
      return "strong";
    }

    function renderIntelligenceHeatmap(intelligence) {
      document.querySelectorAll(".heatmap-tab-button").forEach((button) => {
        button.classList.toggle("active", button.dataset.heatmapTab === activeHeatmapTab);
      });
      const items = heatmapLensItems(intelligence, activeHeatmapTab);
      document.getElementById("heatmapRecommendation").textContent = heatmapLensRecommendation(intelligence, activeHeatmapTab);
      document.getElementById("intelligenceHeatmap").innerHTML =
        "<div class='simple-heatmap-grid'>" + items.slice(0, 6).map(heatmapCardHtml).join("") + "</div>";
    }

    function heatmapLensItems(intelligence, lens) {
      const demoHeatmap = intelligence.demo_heatmap_analyzer || {};
      const notes = intelligence.pre_demo_notes_analyzer || {};
      const stakeholder = intelligence.stakeholder_coverage_analyzer || {};
      const risk = intelligence.demo_risk_analyzer || {};
      if (lens === "stakeholder") {
        return (stakeholder.stakeholder_coverage || []).map((item) => ({
          label: item.role,
          score: item.coverage,
          evidence: item.coverage + "% coverage detected.",
          recommendation: item.coverage < 40 ? "Add a proof point or discovery question for this stakeholder." : "Coverage is visible enough for the current story."
        }));
      }
      if (lens === "discovery") return notes.heatmap || [];
      if (lens === "business") {
        const filtered = (demoHeatmap.heatmap || []).filter((item) => /business|executive|audience|winning|scope|alignment|outcome/i.test(item.label)).slice(0, 6);
        return filtered.length ? filtered : (demoHeatmap.heatmap || []).slice(0, 4);
      }
      return demoHeatmap.heatmap || [];
    }

    function heatmapLensRecommendation(intelligence, lens) {
      const demoHeatmap = intelligence.demo_heatmap_analyzer || {};
      const notes = intelligence.pre_demo_notes_analyzer || {};
      const stakeholder = intelligence.stakeholder_coverage_analyzer || {};
      if (lens === "stakeholder") return stakeholder.recommendation || "Check that every important stakeholder has at least one relevant proof moment.";
      if (lens === "discovery") return (notes.recommendations || [])[0] || "Fill the largest discovery gap before rehearsal.";
      if (lens === "business") return "Make the business reason visible before each click, then land the proof in plain language.";
      return (demoHeatmap.needs_work_areas || []).length
        ? "Focus first on: " + demoHeatmap.needs_work_areas.slice(0, 3).join(", ") + "."
        : "The demo strength profile looks healthy. Keep the winning moments prominent.";
    }

    function heatmapCardHtml(item) {
      const score = Math.max(0, Math.min(100, Number(item.score) || 0));
      const status = item.status || heatmapClass(score);
      return "<div class='compact-heatmap-card'>" +
        "<div class='heatmap-head'><strong>" + escapeClientHtml(item.label || "Heatmap item") + "</strong><span class='heatmap-score'>" + Math.round(score) + "/100</span></div>" +
        "<div class='heatmap-track'><div class='heatmap-fill' style='width:" + score + "%'></div></div>" +
        "<span class='status-badge " + escapeClientHtml(statusForHeatmap(status)) + "'>" + escapeClientHtml(item.status_label || status) + "</span>" +
        "<p class='heatmap-copy'>" + escapeClientHtml(item.evidence || "") + "</p>" +
        "<p class='heatmap-copy'><strong>Recommendation:</strong> " + escapeClientHtml(item.recommendation || "") + "</p>" +
      "</div>";
    }

    function statusForHeatmap(status) {
      if (status === "strong" || status === "healthy") return "strong";
      if (status === "risk") return "critical";
      return "warning";
    }

    function renderCompetitiveAdvisory(competitive) {
      const focus = competitive.competitive_focus || [];
      document.getElementById("competitiveAnalyzer").innerHTML =
        (competitive.warning ? "<p class='hint'>" + escapeClientHtml(competitive.warning) + "</p>" : "") +
        focus.map((item) => analysisItem(item.topic, item.why_it_matters, item.recommended_demo_moment)).join("");
    }

    function actionTextFor(mode) {
      if (!latestIntelligence) return "Refresh Intelligence first so the helper has current analysis.";
      const risk = latestIntelligence.demo_risk_analyzer || {};
      const discovery = latestIntelligence.discovery_gap_analyzer || {};
      const timing = latestIntelligence.demo_timing_pacing_analyzer || {};
      const winning = latestIntelligence.winning_moment_detection || {};
      const avoid = latestIntelligence.what_not_to_demo_engine || {};
      const metadata = latestIntelligence.demo_metadata || {};
      const common = [
        "Customer/demo: " + (metadata.customer_name || "current demo"),
        "Strategy: " + (metadata.strategy || "-"),
        "Audience: " + (metadata.audience_type || "-") + " / " + (metadata.target_segment || "-"),
        "Biggest risks: " + ((risk.warnings || []).slice(0, 3).join("; ") || "none detected"),
        "Missing discovery: " + ((discovery.missing_discovery_items || []).slice(0, 3).join("; ") || "none detected"),
        "Winning moments: " + ((winning.winning_moments || []).slice(0, 3).join("; ") || "none detected"),
        "Avoid showing: " + ((avoid.avoid_showing || []).slice(0, 4).join("; ") || "none detected")
      ];
      const modes = {
        compress: "Compress this demo into a shorter, sharper flow. Keep only the highest-impact proof moments, reduce lower-value sections, and preserve the strongest executive story. Pay special attention to timing: " + (timing.estimated_runtime || "unknown") + ".",
        executive: "Generate an executive version of this demo. Use concise business language, reduce clicks, emphasize KPIs, risk reduction, financial impact, and decision confidence.",
        technical: "Rebuild this demo for a technical audience. Keep business context, but add architecture, permissions, integration, auditability, data flow, and implementation-fit questions without making unsupported claims.",
        custom: "Apply this custom instruction to the demo intelligence: " + (customAiInstruction.value.trim() || "No custom instruction entered.")
      };
      return [modes[mode] || modes.custom, "", "Context to use:", ...common.map((line) => "- " + line)].join("\\n");
    }

    function scoreCard(label, value, note, body = "", lowerIsBetter = false) {
      const displayValue = Number.isFinite(Number(value)) ? Math.round(Number(value)) : "-";
      const numeric = Number(value);
      const effective = lowerIsBetter && Number.isFinite(numeric) ? 100 - numeric : numeric;
      const status = Number.isFinite(effective) ? heatmapClass(effective) : "watch";
      const statusLabel = status === "strong" ? "Super strong" : status === "healthy" ? "Strong" : status === "watch" ? "Needs work" : "Risk area";
      return "<div class='score-card'><span class='score-label'>" + escapeClientHtml(label) + "</span><span class='score-value'>" + displayValue + "</span><span class='score-pill " + status + "'>" + escapeClientHtml(statusLabel) + "</span><span class='hint'>" + escapeClientHtml(note || "") + "</span><span class='score-body'>" + escapeClientHtml(body || "") + "</span></div>";
    }

    function uniqueClientItems(items = []) {
      const seen = new Set();
      return (items || []).filter((item) => {
        const clean = String(item || "").trim();
        if (!clean || seen.has(clean.toLowerCase())) return false;
        seen.add(clean.toLowerCase());
        return true;
      });
    }

    function heatmapClass(score) {
      const value = Number(score) || 0;
      if (value >= 85) return "strong";
      if (value >= 70) return "healthy";
      if (value >= 50) return "watch";
      return "risk";
    }

    function listBlock(title, items = []) {
      const clean = (items || []).filter(Boolean);
      if (!clean.length) return "<p class='hint'>" + escapeClientHtml(title) + ": none detected.</p>";
      return "<strong class='score-label'>" + escapeClientHtml(title) + "</strong><ul class='compact-list'>" + clean.map((item) => "<li>" + escapeClientHtml(item) + "</li>").join("") + "</ul>";
    }

    function analysisItem(title, value, note) {
      return "<div class='analysis-item'><strong>" + escapeClientHtml(title || "") + "</strong><span>" + escapeClientHtml(value || "") + "</span><p class='hint'>" + escapeClientHtml(note || "") + "</p></div>";
    }

    function hintBlock(text) {
      return text ? "<p class='hint'>" + escapeClientHtml(text) + "</p>" : "";
    }

    function pillList(items = []) {
      const clean = (items || []).filter(Boolean);
      if (!clean.length) return "";
      return "<div class='pill-list'>" + clean.map((item) => "<span class='pill'>" + escapeClientHtml(item) + "</span>").join("") + "</div>";
    }

    function boundedHeatmapPage(key, items = []) {
      const pageCount = Math.max(1, Math.ceil((items || []).length / 3));
      return Math.max(0, Math.min(pageCount - 1, Number(heatmapPages[key]) || 0));
    }

    function heatmapRows(items = [], key = "demo") {
      if (!items.length) return "<p class='hint'>No heatmap data available yet.</p>";
      const pageSize = 3;
      const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
      const page = boundedHeatmapPage(key, items);
      const visibleItems = items.slice(page * pageSize, page * pageSize + pageSize);
      const controls = items.length > pageSize
        ? "<div class='heatmap-controls'>" +
          "<button class='secondary heatmap-nav' data-heatmap-key='" + escapeClientHtml(key) + "' data-heatmap-step='-1' " + (page <= 0 ? "disabled" : "") + ">Previous</button>" +
          "<span class='heatmap-page'>Showing " + (page * pageSize + 1) + "-" + Math.min(items.length, page * pageSize + pageSize) + " of " + items.length + "</span>" +
          "<button class='secondary heatmap-nav' data-heatmap-key='" + escapeClientHtml(key) + "' data-heatmap-step='1' " + (page >= pageCount - 1 ? "disabled" : "") + ">Next</button>" +
        "</div>"
        : "";
      return "<div class='heatmap-list'>" + visibleItems.map((item) => {
        const score = Math.max(0, Math.min(100, Number(item.score) || 0));
        const status = item.status || heatmapClass(score);
        return "<div class='heatmap-item " + escapeClientHtml(status) + "'>" +
          "<div class='heatmap-head'><span>" + escapeClientHtml(item.label) + "</span><span class='heatmap-score'>" + Math.round(score) + "/100</span></div>" +
          "<div class='heatmap-track'><div class='heatmap-fill' style='width:" + score + "%'></div></div>" +
          "<div class='heatmap-status'>" + escapeClientHtml(item.status_label || status) + "</div>" +
          "<p class='heatmap-copy'>" + escapeClientHtml(item.evidence || "") + "</p>" +
          "<p class='heatmap-copy'><strong>Improve:</strong> " + escapeClientHtml(item.recommendation || "") + "</p>" +
        "</div>";
      }).join("") + "</div>" + controls;
    }

    function timingRows(items = []) {
      if (!items.length) return "";
      return "<strong class='score-label'>Section timing</strong>" + items.slice(0, 10).map((item) => {
        const risk = item.pacing_risk || "low";
        const score = risk === "high" ? 35 : risk === "medium" ? 62 : 88;
        return "<div class='heatmap-item " + heatmapClass(score) + "'>" +
          "<div class='heatmap-head'><span>" + escapeClientHtml(item.segment) + "</span><span class='heatmap-score'>" + escapeClientHtml(item.estimated_minutes) + " min</span></div>" +
          "<div class='heatmap-status'>" + escapeClientHtml(risk) + " pacing risk</div>" +
          "<p class='heatmap-copy'>" + escapeClientHtml(item.basis || "") + "</p>" +
        "</div>";
      }).join("");
    }

    function coverageRows(items = []) {
      if (!items.length) return "<p class='hint'>No stakeholder coverage detected yet.</p>";
      return items.slice(0, 8).map((item) => {
        const coverage = Math.max(0, Math.min(100, Number(item.coverage) || 0));
        return "<div class='coverage-row'><span>" + escapeClientHtml(item.role) + "</span><div class='coverage-track'><div class='coverage-fill' style='width:" + coverage + "%'></div></div><span>" + coverage + "%</span></div>";
      }).join("");
    }

    function escapeClientHtml(value) {
      return String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char]));
    }

      function selectedVoiceApiKey() {
        return voiceApiKeyField.value.trim();
      }

      function voiceApiKeyStorageKey() {
        return "nsDemoHelperApiKey:" + (voiceProviderSelect.value || "say");
      }

      function syncVoiceProviderSettings(payload = {}) {
        const provider = voiceProviderSelect.value || "say";
        const requiresApiKey = payload.requiresApiKey ?? provider !== "say";
        voiceApiKeyWrap.hidden = !requiresApiKey;
        if (requiresApiKey) {
          const savedKey = sessionStorage.getItem(voiceApiKeyStorageKey()) || "";
          if (!voiceApiKeyField.value && savedKey) voiceApiKeyField.value = savedKey;
          voiceApiKeyHint.textContent = payload.apiKeyLabel
            ? payload.apiKeyLabel + " is used only for this browser session and is not saved into the manifest."
            : "The key is used only for this browser session and is not saved into the manifest.";
        } else {
          voiceApiKeyField.value = "";
        }
      }

      function selectedVoiceGender(fallbackVoice = "") {
        const selected = voiceSelect.selectedOptions[0];
        if (selected?.dataset?.gender) return selected.dataset.gender;
        const raw = String(fallbackVoice || voiceSelect.value || "").toLowerCase();
        if (/(adam|josh|alex|daniel|fred|oliver|rishi|aaron|eddy|reed)/.test(raw)) return "male";
        if (/(rachel|bella|moira|samantha|karen|tessa|kathy|shelley|sandy)/.test(raw)) return "female";
        return "neutral";
      }

      function updateAvatarPersona(fallbackVoice = "") {
        const gender = selectedVoiceGender(fallbackVoice);
        for (const avatar of [document.getElementById("avatar"), document.getElementById("runAvatar")]) {
          if (!avatar) continue;
          avatar.classList.toggle("male", gender === "male");
          avatar.classList.toggle("female", gender !== "male");
        }
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

      audienceSelect.onchange = updateAudienceHints;
      targetAudienceSelect.onchange = updateAudienceHints;
      demoStrategySelect.onchange = updateStrategyIndustryHints;
      industrySelect.onchange = updateStrategyIndustryHints;
      manifestDemoModeSelect.onchange = updateManifestDemoModeHint;
      inputModeSelect.onchange = syncInputMode;
      voiceProviderSelect.onchange = () => {
        syncVoiceProviderSettings();
        loadVoices();
      };
      voiceSelect.onchange = () => updateAvatarPersona();
      voiceApiKeyField.oninput = () => {
        if (voiceApiKeyField.value.trim()) sessionStorage.setItem(voiceApiKeyStorageKey(), voiceApiKeyField.value.trim());
        else sessionStorage.removeItem(voiceApiKeyStorageKey());
      };
      voiceApiKeyField.onchange = () => loadVoices(voiceSelect.value);

    async function load() {
      render(await api("/api/manifest"));
    }

      async function loadVoices(preferredVoice = "") {
        const provider = voiceProviderSelect.value || "say";
        syncVoiceProviderSettings();
        const payload = await api("/api/voices", {
          method: "POST",
          body: JSON.stringify({
            provider,
            apiKey: selectedVoiceApiKey()
          })
        });
        voiceSelect.innerHTML = "";
        for (const voice of payload.voices || []) {
          const option = document.createElement("option");
          option.value = voice.id || voice.name;
          option.dataset.gender = voice.gender || "neutral";
          option.dataset.provider = voice.provider || provider;
          option.textContent = voice.name + " (" + voice.locale + (voice.gender ? ", " + voice.gender : "") + ")";
          voiceSelect.appendChild(option);
        }
        syncVoiceProviderSettings(payload);
        voiceProviderHint.textContent = payload.message || (provider === "elevenlabs"
          ? "Cloud voices use ElevenLabs. Add the API key here or set ELEVENLABS_API_KEY before starting the app."
          : "Local voices work without an API key.");
        const values = Array.from(voiceSelect.options).map((option) => option.value);
        if (preferredVoice && values.includes(preferredVoice)) {
          voiceSelect.value = preferredVoice;
        } else if (provider === "say" && values.includes("Moira")) {
          voiceSelect.value = "Moira";
        } else if (provider === "elevenlabs" && values.includes("21m00Tcm4TlvDq8ikWAM")) {
          voiceSelect.value = "21m00Tcm4TlvDq8ikWAM";
        }
        updateAvatarPersona(preferredVoice);
      }

    async function loadGuide() {
      const payload = await api("/api/sc-guide");
      scGuide.value = payload.guide || "";
      renderGuideOutputs(payload.guide || "", payload.guideOutputs);
      const setupPayload = await api("/api/setup-prompt");
      renderSetupPrompt(setupPayload.setupPrompt);
    }

    async function loadIntelligence() {
      const payload = await api("/api/intelligence");
      renderIntelligence(payload.intelligence);
    }

    document.querySelectorAll(".tab").forEach((button) => {
      button.onclick = async () => {
        document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
        document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
        button.classList.add("active");
        document.getElementById("screen-" + button.dataset.tab).classList.add("active");
        sessionStorage.setItem("nsdhActiveTab", button.dataset.tab);
        if (button.dataset.tab === "admin") await loadCmsStatus();
      };
    });

    document.addEventListener("click", (event) => {
      const intelligenceCard = event.target.closest("[data-intel-card]");
      if (intelligenceCard) {
        selectedIntelligenceCard = intelligenceCard.dataset.intelCard;
        if (latestIntelligence) renderIntelligence(latestIntelligence);
        return;
      }
      const heatmapTab = event.target.closest("[data-heatmap-tab]");
      if (heatmapTab) {
        activeHeatmapTab = heatmapTab.dataset.heatmapTab || "demo";
        if (latestIntelligence) renderIntelligenceHeatmap(latestIntelligence);
        return;
      }
      const button = event.target.closest("[data-heatmap-key]");
      if (!button || button.disabled) return;
      const key = button.dataset.heatmapKey;
      const step = Number(button.dataset.heatmapStep) || 0;
      heatmapPages[key] = (Number(heatmapPages[key]) || 0) + step;
      if (latestIntelligence) renderIntelligence(latestIntelligence);
    });

    document.getElementById("reload").onclick = async () => { await load(); await loadGuide(); };
    document.getElementById("reloadManifest").onclick = load;
    document.getElementById("refreshGuide").onclick = loadGuide;
    document.getElementById("refreshIntelligence").onclick = loadIntelligence;
    cmsBlockSelect.onchange = renderSelectedCmsBlock;
    cmsEditor.oninput = renderCmsReadableFromEditor;
    document.getElementById("cmsSetupButton").onclick = async () => {
      const password = document.getElementById("cmsSetupPassword").value;
      const confirmPassword = document.getElementById("cmsSetupPasswordConfirm").value;
      if (password !== confirmPassword) {
        cmsStatus.textContent = "Passwords do not match.";
        return;
      }
      try {
        await api("/api/cms/setup", { method: "POST", body: JSON.stringify({ password }) });
        document.getElementById("cmsSetupPassword").value = "";
        document.getElementById("cmsSetupPasswordConfirm").value = "";
        await loadCmsStatus();
      } catch (error) {
        cmsStatus.textContent = error.message;
      }
    };
    document.getElementById("cmsLoginButton").onclick = async () => {
      try {
        await api("/api/cms/login", {
          method: "POST",
          body: JSON.stringify({ password: document.getElementById("cmsLoginPassword").value })
        });
        document.getElementById("cmsLoginPassword").value = "";
        await loadCmsStatus();
      } catch (error) {
        cmsStatus.textContent = error.message;
      }
    };
    document.getElementById("cmsLogoutButton").onclick = async () => {
      try {
        await api("/api/cms/logout", { method: "POST", body: "{}" });
        cmsBlocks = [];
        renderCmsAuth({ setupRequired: false, authenticated: false, security: {} });
      } catch (error) {
        cmsStatus.textContent = error.message;
      }
    };
    document.getElementById("cmsReloadButton").onclick = loadCmsContent;
    document.getElementById("cmsSaveButton").onclick = async () => {
      try {
        await api("/api/cms/save", {
          method: "POST",
          body: JSON.stringify({
            blockId: cmsBlockSelect.value,
            rawValue: cmsEditor.value,
            changeNote: cmsChangeNote.value
          })
        });
        reloadAfterCmsChange("CMS content saved.");
      } catch (error) {
        cmsStatus.textContent = error.message;
      }
    };
    document.getElementById("cmsRestoreButton").onclick = async () => {
      if (!cmsVersionSelect.value) return;
      if (!window.confirm("Restore this older CMS version? A backup of the current CMS content will be created first.")) return;
      try {
        await api("/api/cms/restore", {
          method: "POST",
          body: JSON.stringify({ file: cmsVersionSelect.value })
        });
        reloadAfterCmsChange("CMS version restored.");
      } catch (error) {
        cmsStatus.textContent = error.message;
      }
    };
    document.getElementById("createFollowUps").onclick = async () => {
      setBusy(true);
      try {
        const payload = await api("/api/intelligence/follow-up-questions", { method: "POST", body: "{}" });
        intelligenceActionOutput.value = payload.questions || "";
        setStatus("Follow-up discovery questions created from Intelligence.");
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(false);
      }
    };
    document.getElementById("improveGuideFromIntel").onclick = async () => {
      setBusy(true);
      try {
        const payload = await api("/api/intelligence/improve-guide", { method: "POST", body: "{}" });
        scGuide.value = payload.guide || "";
        renderGuideOutputs(payload.guide || "", payload.guideOutputs);
        renderIntelligence(payload.intelligence);
        intelligenceActionOutput.value = "SC guide improved with Intelligence recommendations. Review the SC Guide tab for the updated runbook and improvement section.";
        setStatus("SC guide improved using Intelligence recommendations.");
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(false);
      }
    };
    document.getElementById("compressDemo").onclick = () => {
      intelligenceActionOutput.value = actionTextFor("compress");
      setStatus("Compressed demo instruction prepared from Intelligence.");
    };
    document.getElementById("generateExecutiveVersion").onclick = () => {
      intelligenceActionOutput.value = actionTextFor("executive");
      setStatus("Executive version instruction prepared from Intelligence.");
    };
    document.getElementById("rebuildTechnicalAudience").onclick = () => {
      intelligenceActionOutput.value = actionTextFor("technical");
      setStatus("Technical audience rebuild instruction prepared from Intelligence.");
    };
    document.getElementById("copyCustomAiInstruction").onclick = () => {
      intelligenceActionOutput.value = actionTextFor("custom");
      setStatus("Custom AI instruction prepared from Intelligence.");
    };
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
    document.getElementById("createManifestFromGuide").onclick = async () => {
      setBusy(true);
      try {
        const payload = await api("/api/manifest/from-guide", { method: "POST", body: "{}" });
        render(payload);
        setStatus("Runnable manifest refreshed from the SC guide. Use Browser Dry-Run before Live Demo.");
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(false);
      }
    };

    document.getElementById("learn").onclick = async () => {
      setBusy(true);
      try {
        const createRunnableManifest = window.confirm(
          "Do you also want to create the runnable browser manifest from the SC guide now?\\n\\n" +
          "Yes: the helper creates the SC guide, refreshes the manifest from that guide, validates the dry-run path, and opens the NetSuite browser.\\n\\n" +
          "No: the helper creates the SC guide and Intelligence view only; you can create the manifest later from the Manifest or Run workflow."
        );
        setStatus(createRunnableManifest
          ? "Checking company context, creating the SC guide, and building the runnable manifest..."
          : "Checking company context and creating the SC guide...");
        const payload = await api("/api/learn", {
          method: "POST",
          body: JSON.stringify({
            topic: document.getElementById("topic").value,
            inputMode: inputModeSelect.value,
            manifestDemoMode: manifestDemoModeSelect.value,
            demoStrategy: demoStrategySelect.value,
            industry: industrySelect.value,
            audience: audienceSelect.value,
              marketSegment: selectedMarketSegment(),
              outputLanguage: outputLanguageSelect.value,
              instructions: document.getElementById("instructions").value,
              demoScope: demoScopeField.value,
              companyUrl: document.getElementById("companyUrl").value,
              preDemoNotes: preDemoNotesField.value,
              valueIntensity: document.getElementById("intensity").value,
              voiceProvider: voiceProviderSelect.value,
            voice: voiceSelect.value,
            createRunnableManifest
          })
        });
        render(payload);
        scGuide.value = payload.guide || "";
        renderGuideOutputs(payload.guide || "", payload.guideOutputs);
        if (createRunnableManifest) {
          setStatus("SC guide and runnable manifest created. Starting browser dry-run...");
          const runPayload = await apiWithLog("/api/run", {
            method: "POST",
            body: JSON.stringify({
              mode: "browser-dry-run",
              valueIntensity: document.getElementById("intensity").value,
              voiceProvider: voiceProviderSelect.value,
              voiceApiKey: selectedVoiceApiKey(),
              voice: voiceSelect.value
            })
          });
          setStatus("SC guide and runnable manifest created. Browser dry-run complete.\\n\\n" + (runPayload.log || ""));
        } else {
          setStatus("SC guide and Intelligence created. Runnable manifest was not built yet.");
        }
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
              voiceApiKey: selectedVoiceApiKey(),
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
              voiceApiKey: selectedVoiceApiKey(),
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
          updateAvatarPersona(state.voice);
          document.getElementById("narratorName").textContent = "Narrator: " + (state.voice || voiceSelect.value || "Moira");
        document.getElementById("narratorSegment").textContent = state.segmentTitle || "Ready";
        document.getElementById("runNarratorSegment").textContent = state.segmentTitle || "Ready";
        document.getElementById("narratorLine").textContent = state.text || "The narrator is ready.";
        document.getElementById("runNarratorLine").textContent = state.text || "The narrator is ready.";
      } catch {}
    }

      (async () => {
        updateAudienceHints();
        updateStrategyIndustryHints();
        updateManifestDemoModeHint();
        syncVoiceProviderSettings();
        await loadVoices();
        await load();
      await loadGuide();
      const activeTab = sessionStorage.getItem("nsdhActiveTab");
      if (activeTab && document.querySelector('.tab[data-tab="' + activeTab + '"]')) {
        document.querySelector('.tab[data-tab="' + activeTab + '"]').click();
      }
      await pollNarrator();
      setInterval(pollNarrator, 1500);
    })().catch((error) => setStatus(error.message));
  </script>
</body>
</html>`);
}

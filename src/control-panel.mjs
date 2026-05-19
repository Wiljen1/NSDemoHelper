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
const latestIntelligencePath = path.join(projectRoot, "artifacts/runtime/latest-intelligence.json");
const latestPreDemoIntelligencePath = path.join(projectRoot, "artifacts/runtime/latest-pre-demo-intelligence.json");
const cmsContentPath = path.join(projectRoot, "artifacts/cms/content.json");
const cmsVersionsDir = path.join(projectRoot, "artifacts/cms/versions");
const buttonInstructionsDir = path.join(projectRoot, "artifacts/button-api-instructions");
const cmsAdminPath = path.join(projectRoot, ".auth/cms-admin.json");
const cmsSessionsPath = path.join(projectRoot, ".auth/cms-sessions.json");
const port = Number(process.env.PORT || 4173);
const scryptAsync = promisify(scryptCallback);
let currentRun = null;
let currentCodexOperator = null;
let defaultScInstructionsOverride = "";
let helperIntroOverride = "";
let helperStepsOverride = null;
let additionalDemoSources = [];
let dryRunCreationGuidanceOverride = "";
let preDemoIntelligenceGuidanceOverride = "";
let scStoryRunbookGuidanceOverride = "";
let demoAssetPromptGuidanceOverride = "";
let codexAccountSetupGuidanceOverride = "";
let liveDemoFunctionalityEnabled = true;

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
const defaultDemoStrategy = "standard_platform_demo";
const defaultIndustry = "general_business";
const cash360SegmentIds = new Set(["open-cash360-dashboard", "cash360-actions", "cash360-forecast", "cash360-preferences"]);

function defaultTestPrepData() {
  return {
    topic: "Prepare a prospect-facing NetSuite finance-first demo for Air Charter Service. Focus on executive visibility, multi-country consolidation, local GAAP, tax and e-invoicing context, approvals, project or flight profitability, integration fit, SuiteProjects, and Fixed Asset Management.",
    inputMode: "request-and-notes",
    manifestDemoMode: "customer_story",
    demoStrategy: "standard_platform_demo",
    industry: "general_business",
    audience: "prospect",
    marketSegment: "mid_market",
    outputLanguage: "en",
    demoScope: "Financials first Services premium, including core financials, multi-entity reporting, approvals, SuiteProjects for flight or booking profitability, and Fixed Asset Management. Advanced inventory, FP&A, Payhawk or expenses, and broader procure-to-pay are discovery or phase considerations unless confirmed.",
    competition: "Known competition/status quo: SAP S/4HANA and Microsoft Dynamics are being considered alongside the current architecture of Access ERP, Jedox consolidation/planning, spreadsheets, email-heavy AP, and Payhawk/Access Expense in parts of the business.",
    companyUrl: "https://www.aircharterservice.com/",
    preDemoNotes: `# Discovery & Demo Preparation Notes

## Current Scope & Discussion Areas

* Procure-to-Pay Phase 2 discussion
* Number of Payhawk expense users?
* Budget holders and approval workflows
* FP&A requirements
* Advanced Inventory requirements
* Multi-Book accounting considerations
* ACS considerations
* Role separation between AR/AP teams and finance operations

---

# Key Stakeholders

| Name        | Role                           | Notes                                                   |
| ----------- | ------------------------------ | ------------------------------------------------------- |
| Paul Miles  | Project Manager                | Overall project coordination                            |
| Henry Davis | Business Analyst               | Business process analysis                               |
| Rob         | IT Director                    | Responsible for technical architecture and integrations |
| Jo          | Head of IT Operations          | Responsible for production operations                   |
| Jonathan    | Financial Controller           | Core finance stakeholder                                |
| Tom         | Finance Transformation Manager | Previously Financial Controller                         |
| Cary        | Group CFO                      | Executive sponsor / financial leadership                |

---

# Project Context

The customer initially explored a standalone Procure-to-Pay initiative but has since expanded the conversation into a broader ERP transformation project.

The organization operates across multiple countries and legal entities, creating significant consolidation and reporting complexity.

---

# Current Systems & Processes

## Expense Management

* Payhawk is currently used for part of the business expense process
* Not used for the core air charter business
* Some entities still rely on Access Expense or manual/paper-based processes

## Consolidation & Reporting

Current challenges:

* Group consolidations
* Multi-country reporting
* UK-centric ERP limitations
* Local GAAP chart of accounts requirements
* Country-specific tax reporting
* E-invoicing complexity
* Difficulty scaling into new regions/entities

Consolidation is currently performed in Jedox due to limitations in the existing ERP system.

Important positioning opportunity:

* NetSuite OneWorld and native consolidation capabilities should be highlighted strongly during the demo.

---

# International & Localization Requirements

Need clarity on:

* Active countries/legal entities
* Language requirements by country
* Dual-language requirements in some regions
* Country-specific tax and e-invoicing regulations

Important discovery question:

> Which countries are currently sending and/or receiving e-invoices?

---

# Integration Challenges

Integration complexity is a major concern.

Key focus areas:

* Existing architecture compatibility
* Integration flexibility
* ODBC/reporting requirements
* Data flow between systems
* CRM integration strategy

Current CRM:

* IBOS CRM
* Potential future replacement opportunity
* Current scope remains finance-focused

Likely integration requirements:

* Booking references
* Credit notes
* Flight/project data synchronization

---

# Core Business Process - Flight Project Tracking

Each flight is treated as a unique project.

Key project tracking requirements:

* Flight start/end date
* Route information
* Aircraft type
* Broker involved
* Customer information
* Associated transactions
* Revenue and cost tracking
* Operational ownership

The customer wants complete financial visibility tied directly to each flight/project.

---

# Aircraft Management Business Model

Veluxis operates as a private jet management company.

Business model:

* Wealthy individuals/companies own aircraft
* Veluxis manages operations on their behalf
* Veluxis arranges:

  * maintenance
  * charter flights
  * operational coordination

Operational complexity:

* Costs are incurred by Veluxis
* Costs are then recharged/disbursed to aircraft owners
* Current handling relies heavily on separate balance sheet accounts

Potential demo focus:

* Intercompany/accounting visibility
* Project profitability
* Cost allocation transparency

---

# Procure-to-Pay & AP Challenges

Current process is highly manual and email-driven.

Current state:

* No formal PO process
* Each booking/flight is bespoke
* Brokers send invoices from airlines
* Heavy reliance on email communication
* Manual payment coordination
* Limited centralized visibility

Potential opportunity areas:

* Approval workflows
* Vendor bill automation
* Centralized document management
* Workflow tracking
* Payment visibility

---

# Accounts Receivable & Dunning

The organization can report effectively on outstanding balances.

Main challenge:

* Delayed customer payments often caused by incomplete or incorrect supporting documentation
* No centralized storage for customer-facing information

Potential positioning:

* Document management
* Transaction visibility
* Automated communication
* Customer record centralization

---

# Revenue Recognition

Revenue recognition occurs:

* On the date/month the flight takes place

Revenue must be tracked by:

* Legal entity
* Office/location
* Business type

Examples:

* Cargo flights
* Private jets
* Passenger flights

Complexity example:

* Revenue may involve both Dubai and India operations simultaneously

Need visibility into:

* Entity ownership
* Department allocation
* Cross-border operational reporting

---

# FP&A & Budgeting

Current state:

* FP&A primarily handled in Jedox
* Additional budgeting work handled in spreadsheets
* Budgets maintained globally in GBP
* Budget data is not written back into ERP dimensions

Future opportunity:

* FP&A modernization
* Planning and budgeting centralization
* Expanded reporting visibility

Potential Phase 2 discussion:

* Native planning/budgeting capabilities

---

# Fixed Assets & Expense Deferrals

## Fixed Assets

Current process:

* Spreadsheets
* Straight-line depreciation
* Office equipment
* Intangible assets

## Expense Deferrals

* Limited use currently
* Primarily bill-related

---

# Reporting & Analytics

ODBC access is important.

However:

* Many required reports appear achievable with standard NetSuite reporting

Important demo guidance:

* Strongly highlight out-of-the-box reporting capabilities
* Avoid over-positioning custom reports unless truly necessary

---

# Templates & Document Configuration

Customer sends templates externally.

Demo should include:

* Template configuration capabilities
* Document customization
* Customer-facing output flexibility

---

# E-Invoicing

Current approach:

* Third-party provider handles many e-invoicing submissions

Some countries may benefit from direct handling internally, while others prefer outsourcing.

Need clarity on:

* Sending vs receiving requirements
* Country-by-country obligations
* Integration expectations

---

# Approval Workflows

Approval matrix already exists with thresholds and hierarchies.

Current challenge:

* Approvers often lack visibility/context into what they are approving

Potential demo focus:

* Approval visibility
* Supporting documentation
* Workflow clarity
* Context-aware approvals
* Mobile approvals`
  };
}

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
    if (request.method === "GET" && request.url === "/api/codex/status") return json(response, await codexRuntimeStatus());
    if (request.method === "GET" && request.url === "/api/feature-flags") return json(response, { ok: true, featureFlags: featureFlagsPayload() });
    if (request.method === "POST" && request.url === "/api/codex/stop") return json(response, stopCurrentCodexOperator());
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
    if (request.method === "POST" && request.url === "/api/cms/feature-flags") {
      await requireCmsAuth(request);
      const body = await readBody(request);
      return json(response, await saveFeatureFlags(body));
    }
    if (request.method === "POST" && request.url === "/api/cms/restore") {
      await requireCmsAuth(request);
      const body = await readBody(request);
      return json(response, await restoreCmsVersion(body.file));
    }
    if (request.method === "GET" && request.url === "/api/button-instructions") {
      return json(response, await buttonInstructionsPayload());
    }
    if (request.method === "POST" && request.url === "/api/button-instructions/export") {
      return json(response, await exportButtonInstructionFiles());
    }
    if (request.method === "GET" && request.url?.startsWith("/api/button-instructions/download/")) {
      const fileName = decodeURIComponent(path.basename(request.url.replace("/api/button-instructions/download/", "")));
      if (!fileName.endsWith(".json")) return json(response, { ok: false, error: "Only JSON instruction files are available here." }, 400);
      return sendFile(response, path.join(buttonInstructionsDir, fileName), "application/json");
    }
    if (request.method === "GET" && request.url === "/api/manifest") return json(response, await manifestPayload());
    if (request.method === "GET" && request.url === "/api/intelligence") {
      const manifest = await readManifest();
      const guide = await readOrGenerateScGuide(manifest);
      const intelligence = await demoIntelligencePayloadWithCodex(manifest, guide);
      return json(response, { ok: true, intelligence, preDemoIntelligence: preDemoIntelligenceFromDemoIntelligencePayload(intelligence) });
    }
    if (request.method === "POST" && request.url === "/api/intelligence") {
      const body = await readBody(request);
      const manifest = await readManifest();
      const guide = await readOrGenerateScGuide(manifest);
      const draftManifest = await manifestWithCurrentPrepInputsAndWebsite(manifest, body, {
        preferStoredPreDemoWebsiteContext: true,
        allowWebsiteScan: false
      });
      const intelligence = await demoIntelligencePayloadWithCodex(draftManifest, guide);
      return json(response, { ok: true, draft: true, intelligence, preDemoIntelligence: preDemoIntelligenceFromDemoIntelligencePayload(intelligence) });
    }
    if (request.method === "POST" && request.url === "/api/pre-demo-intelligence") {
      const body = await readBody(request);
      const manifest = await readManifest();
      const draftManifest = await manifestWithCurrentPrepInputsAndWebsite(manifest, body, {
        preferStoredPreDemoWebsiteContext: true,
        allowWebsiteScan: true
      });
      const preDemoIntelligence = await preDemoIntelligencePayloadWithCodex(draftManifest);
      return json(response, { ok: true, draft: true, preDemoIntelligence });
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
    if (request.method === "POST" && request.url === "/api/dry-run-prompt/refresh") {
      ensureLiveDemoFunctionalityEnabled();
      await saveVersion("before-dry-run-prompt-refresh");
      const manifest = await readManifest();
      const guide = await readOrGenerateScGuide(manifest);
      const nextManifest = refreshDryRunPromptMetadata(manifest, guide);
      await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
      const namedManifestPath = await writeNamedManifestCopy(nextManifest);
      return json(response, {
        ok: true,
        manifest: nextManifest,
        versions: await listVersions(),
        guide,
        guideOutputs: guideOutputsPayload(nextManifest, guide),
        namedManifestPath,
        setupPrompt: setupPromptPayload(nextManifest, guide)
      });
    }
    if (request.method === "GET" && request.url === "/api/setup-prompt") {
      const manifest = await readManifest();
      const guide = await readOrGenerateScGuide(manifest);
      return json(response, { ok: true, setupPrompt: setupPromptPayload(manifest, guide) });
    }
    if (request.method === "POST" && request.url === "/api/intelligence/follow-up-questions") {
      const body = await readBody(request);
      const savedManifest = await readManifest();
      const manifest = hasPrepPayload(body)
        ? await manifestWithCurrentPrepInputsAndWebsite(savedManifest, body, {
            preferStoredPreDemoWebsiteContext: true,
            allowWebsiteScan: false
          })
        : savedManifest;
      const guide = await readOrGenerateScGuide(savedManifest);
      const intelligence = await demoIntelligencePayloadWithCodex(manifest, guide);
      const questionsPayload = await codexDiscoveryFollowUpQuestions(manifest, guide, intelligence, {
        additionalComments: body.additionalComments
      });
      return json(response, {
        ok: true,
        ...questionsPayload,
        intelligence,
        preDemoIntelligence: preDemoIntelligenceFromDemoIntelligencePayload(intelligence)
      });
    }
    if (request.method === "POST" && request.url === "/api/intelligence/improve-guide") {
      const manifest = await readManifest();
      const guide = await readOrGenerateScGuide(manifest);
      const intelligence = await demoIntelligencePayloadWithCodex(manifest, guide);
      const improvedGuide = await writeImprovedScGuide(manifest, guide, intelligence);
      const updatedIntelligence = await demoIntelligencePayloadWithCodex(manifest, improvedGuide);
      return json(response, {
        ok: true,
        guide: improvedGuide,
        guideOutputs: guideOutputsPayload(manifest, improvedGuide),
        intelligence: updatedIntelligence,
        preDemoIntelligence: preDemoIntelligenceFromDemoIntelligencePayload(updatedIntelligence)
      });
    }
    if (request.method === "POST" && request.url === "/api/intelligence/apply-action") {
      const body = await readBody(request);
      const manifest = await readManifest();
      const guide = await readOrGenerateScGuide(manifest);
      const intelligence = await demoIntelligencePayloadWithCodex(manifest, guide);
      const updatedGuide = await writeActionScGuide(manifest, guide, intelligence, body);
      const updatedIntelligence = await demoIntelligencePayloadWithCodex(manifest, updatedGuide);
      return json(response, {
        ok: true,
        guide: updatedGuide,
        guideOutputs: guideOutputsPayload(manifest, updatedGuide),
        intelligence: updatedIntelligence,
        preDemoIntelligence: preDemoIntelligenceFromDemoIntelligencePayload(updatedIntelligence),
        message: "Applied action to SC guide."
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
      const intelligence = await demoIntelligencePayloadWithCodex(parsedManifest, guide);
      return json(response, { ok: true, manifest: JSON.parse(nextManifest), versions: await listVersions(), namedManifestPath, guideOutputs: guideOutputsPayload(parsedManifest, guide), setupPrompt: setupPromptPayload(parsedManifest, guide), intelligence, preDemoIntelligence: preDemoIntelligenceFromDemoIntelligencePayload(intelligence) });
    }

    if (request.method === "POST" && request.url === "/api/manifest/from-guide") {
      ensureLiveDemoFunctionalityEnabled();
      await saveVersion("before-manifest-from-guide");
      const manifest = await readManifest();
      const guide = await readOrGenerateScGuide(manifest);
      const nextManifest = applyDryRunCreationPromptToRunnableManifest(manifest, guide, { runSource: "dry-run-tab" });
      await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
      const namedManifestPath = await writeNamedManifestCopy(nextManifest);
      const intelligence = await demoIntelligencePayloadWithCodex(nextManifest, guide);
      return json(response, { ok: true, manifest: nextManifest, versions: await listVersions(), namedManifestPath, guideOutputs: guideOutputsPayload(nextManifest, guide), setupPrompt: setupPromptPayload(nextManifest, guide), intelligence, preDemoIntelligence: preDemoIntelligenceFromDemoIntelligencePayload(intelligence) });
    }

    if (request.method === "POST" && request.url === "/api/learn") {
      const body = await readBody(request);
      await saveVersion("before-learn");
      const manifest = await readManifest();
      const company = await analyseCompany(body.companyUrl, notesForCompanyAnalysis(body));
      company.codexPrepAnalysis = await codexPrepOperatorAnalysis(manifest, body, company);
      if (!company.codexPrepAnalysis.ok) {
        throw new Error(`Codex prep operator failed: ${company.codexPrepAnalysis.error || "No output returned"}`);
      }
      const learned = applyLearningRequest(manifest, body, company);
      const guide = await writeScGuide(learned, body, company);
      if (body.createRunnableManifest) ensureLiveDemoFunctionalityEnabled();
      const finalManifest = body.createRunnableManifest
        ? applyDryRunCreationPromptToRunnableManifest(learned, guide, { runSource: "learn-create-demo-dry-run" })
        : markManifestGuideOnly(learned, guide);
      await writeFile(manifestPath, `${JSON.stringify(finalManifest, null, 2)}\n`, "utf8");
      const namedManifestPath = await writeNamedManifestCopy(finalManifest);
      const intelligence = await demoIntelligencePayloadWithCodex(finalManifest, guide);
      return json(response, { ok: true, manifest: finalManifest, versions: await listVersions(), company, guide, guideOutputs: guideOutputsPayload(finalManifest, guide), namedManifestPath, setupPrompt: setupPromptPayload(finalManifest, guide), intelligence, preDemoIntelligence: preDemoIntelligenceFromDemoIntelligencePayload(intelligence), runnableManifestCreated: Boolean(body.createRunnableManifest) });
    }

    if (request.method === "POST" && request.url === "/api/restore") {
      const body = await readBody(request);
      await saveVersion("before-restore");
      const source = safeVersionPath(body.file);
      await writeFile(manifestPath, await readFile(source, "utf8"), "utf8");
      const manifest = await readManifest();
      const guide = await readOrGenerateScGuide(manifest);
      const intelligence = await demoIntelligencePayloadWithCodex(manifest, guide);
      return json(response, { ok: true, manifest, versions: await listVersions(), guideOutputs: guideOutputsPayload(manifest, guide), setupPrompt: setupPromptPayload(manifest, guide), intelligence, preDemoIntelligence: preDemoIntelligenceFromDemoIntelligencePayload(intelligence) });
    }

    if (request.method === "POST" && request.url === "/api/run") {
      ensureLiveDemoFunctionalityEnabled();
      const body = await readBody(request);
      return json(response, await runCommand(body));
    }

    if (request.method === "POST" && request.url === "/api/dataset-analysis") {
      ensureLiveDemoFunctionalityEnabled();
      const body = await readBody(request);
      return json(response, await runDatasetAnalysis(body));
    }

    if (request.method === "POST" && request.url === "/api/dataset-analysis/execute-prompt") {
      ensureLiveDemoFunctionalityEnabled();
      const body = await readBody(request);
      return json(response, await executeDatasetSetupPrompt(body));
    }

    if (request.method === "POST" && request.url === "/api/stop") {
      return json(response, stopCurrentRun());
    }

    if (request.method === "POST" && request.url === "/api/voice-sample") {
      ensureLiveDemoFunctionalityEnabled();
      const body = await readBody(request);
      return json(response, await playVoiceSample(body));
    }

    if (request.method === "POST" && request.url === "/api/export-guide-docx") {
      return json(response, await exportScGuideDocx());
    }
    if (request.method === "POST" && request.url === "/api/export-follow-up-questions-docx") {
      const body = await readBody(request);
      return json(response, await exportFollowUpQuestionsDocx(body));
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
  const guide = await readSavedOrLocalScGuide(manifest);
  const intelligence = await readLatestIntelligence(manifest, guide);
  return {
    featureFlags: featureFlagsPayload(),
    manifest,
    versions: await listVersions(),
    guide,
    guideOutputs: guideOutputsPayload(manifest, guide),
    setupPrompt: setupPromptPayload(manifest, guide),
    intelligence,
    preDemoIntelligence: await readLatestPreDemoIntelligence(manifest, intelligence)
  };
}

function featureFlagsPayload() {
  return {
    liveDemoFunctionality: liveDemoFunctionalityEnabled
  };
}

function ensureLiveDemoFunctionalityEnabled() {
  if (!liveDemoFunctionalityEnabled) {
    throw httpError("Live demo functionality is switched off in Admin. Turn it on to use dry-run, dataset analysis, run controls, narration, or live demo automation.", 403);
  }
}

function manifestWithCurrentPrepInputs(manifest, body = {}) {
  const next = JSON.parse(JSON.stringify(manifest || {}));
  next.context = next.context || {};
  next.context.demoRequest = next.context.demoRequest || {};
  next.defaults = next.defaults || {};

  const inputMode = normalizeInputMode(body.inputMode || next.context.demoRequest.inputMode);
  const topic = String(body.topic ?? next.context.demoRequest.topic ?? "").trim();
  const preDemoNotes = inputMode === "request-only"
    ? ""
    : String(body.preDemoNotes ?? next.context.preDemoNotes ?? "").trim();
  const demoScope = String(body.demoScope ?? next.context.demoScope ?? next.context.demoRequest.demoScope ?? "").trim();
  const competition = String(body.competition ?? next.context.competition ?? next.context.demoRequest.competition ?? "").trim();
  const audience = normalizeAudience(body.audience || next.context.audience?.value || next.context.demoRequest.audience);
  const marketSegment = normalizeMarketSegment(body.marketSegment || next.context.targetAudience?.value || next.context.marketSegment?.value || next.context.demoRequest.targetAudience || next.context.demoRequest.marketSegment);
  const demoStrategy = normalizeDemoStrategy(body.demoStrategy || next.context.demoStrategy?.id || next.context.demoRequest.demoStrategy || next.defaults.demoStrategy);
  const industry = normalizeIndustry(body.industry || next.context.industry?.id || next.context.demoRequest.industry || next.defaults.industry);
  const manifestDemoMode = normalizeManifestDemoMode(body.manifestDemoMode || next.context.manifestDemoMode?.id || next.context.demoRequest.manifestDemoMode || next.defaults.manifestDemoMode);
  const outputLanguage = normalizeOutputLanguage(body.outputLanguage || next.context.outputLanguage?.value || next.context.demoRequest.outputLanguage || next.defaults.outputLanguage);
  const companyUrl = normalizeCompanyUrl(body.companyUrl || next.context.company?.url || "");

  next.context.preDemoNotes = preDemoNotes;
  next.context.demoScope = demoScope;
  next.context.competition = competition;
  next.context.audience = audience;
  next.context.marketSegment = marketSegment;
  next.context.targetAudience = marketSegment;
  next.context.demoStrategy = demoStrategy;
  next.context.industry = industry;
  next.context.manifestDemoMode = manifestDemoMode;
  next.context.outputLanguage = outputLanguage;
  next.context.company = {
    ...(next.context.company || {}),
    ...(companyUrl ? { url: companyUrl } : {})
  };
  if (!next.context.company.companyName && companyUrl) {
    next.context.company.companyName = websiteNameSlug(companyUrl) || "The prospect";
  }

  next.context.demoRequest = {
    ...next.context.demoRequest,
    topic: inputMode === "notes-only" ? "" : topic,
    inputMode,
    source: inputMode === "notes-only" ? "pre-demo-notes" : inputMode === "request-only" ? "demo-request" : "demo-request-and-pre-demo-notes",
    audience: audience.id,
    marketSegment: marketSegment.id,
    targetAudience: marketSegment.id,
    manifestDemoMode: manifestDemoMode.id,
    manifestDemoModeLabel: manifestDemoMode.label,
    demoStrategy: demoStrategy.id,
    demoStrategyLabel: demoStrategy.label,
    industry: industry.id,
    industryLabel: industry.label,
    outputLanguage: outputLanguage.value,
    demoScope,
    competition,
    instructions: String(body.instructions ?? next.context.demoRequest.instructions ?? "")
  };
  next.defaults.valueStatementIntensity = body.valueIntensity || next.defaults.valueStatementIntensity || "balanced";
  next.defaults.audio = {
    ...(next.defaults.audio || {}),
    provider: normalizeVoiceProvider(body.voiceProvider || next.defaults.audio?.provider || "say"),
    voice: body.voice || next.defaults.audio?.voice || "Moira"
  };
  next.context.draftPrepScoredAt = new Date().toISOString();
  next.context.draftPrepSource = "current-prep-fields";
  return next;
}

async function manifestWithCurrentPrepInputsAndWebsite(manifest, body = {}, options = {}) {
  const next = manifestWithCurrentPrepInputs(manifest, body);
  const companyUrl = normalizeCompanyUrl(body.companyUrl || next.context?.company?.url || "");
  if (!companyUrl) return next;
  const notes = notesForCompanyAnalysis(body);
  if (options.preferStoredPreDemoWebsiteContext) {
    const storedWebsiteContext = await readStoredPreDemoWebsiteContext(companyUrl, notes);
    if (storedWebsiteContext) {
      attachWebsiteContextToManifest(next, storedWebsiteContext, notes);
      return next;
    }
  }
  if (options.allowWebsiteScan === false) {
    const existingContext = normalizedWebsiteContext(next.context?.company?.websiteContext);
    if (hasUsableWebsiteContext(existingContext) && sameCompanyUrl(existingContext.url, companyUrl)) {
      attachWebsiteContextToManifest(next, refreshWebsiteContextForNotes(existingContext, notes), notes);
      return next;
    }
    const pendingContext = websiteContextFromContent({
      url: companyUrl,
      notes,
      source: "pre-demo-intelligence-required"
    });
    pendingContext.summary = "Website context has not been scanned for this URL yet. Run Pre-demo scoring first so Demo Intelligence can reuse the saved website context without scanning again.";
    pendingContext.interesting_points = [];
    pendingContext.evidence = [];
    attachWebsiteContextToManifest(next, pendingContext, notes);
    return next;
  }
  const company = await analyseCompany(companyUrl, notes);
  next.context.company = {
    ...(next.context.company || {}),
    ...company
  };
  next.context.websiteContextScannedAt = company.websiteContext?.scanned_at || new Date().toISOString();
  return next;
}

async function readStoredPreDemoWebsiteContext(companyUrl, notes = "") {
  const savedPreDemo = await readLatestJson(latestPreDemoIntelligencePath);
  const websiteContext = normalizedWebsiteContext(savedPreDemo?.website_context);
  if (!hasUsableWebsiteContext(websiteContext) || !sameCompanyUrl(websiteContext.url, companyUrl)) return null;
  return refreshWebsiteContextForNotes(websiteContext, notes);
}

function attachWebsiteContextToManifest(manifest, websiteContext, notes = "") {
  const context = refreshWebsiteContextForNotes(websiteContext, notes);
  manifest.context = manifest.context || {};
  manifest.context.company = {
    ...(manifest.context.company || {}),
    url: normalizeCompanyUrl(context.url || manifest.context.company?.url || ""),
    title: context.title || manifest.context.company?.title || "",
    description: context.description || manifest.context.company?.description || "",
    companyName: manifest.context.company?.companyName || deriveCompanyNameFromWebsiteContext(context),
    likelyPriorities: inferPriorities(websiteContextComparableText(context), notes),
    industrySignals: inferIndustrySignals(websiteContextComparableText(context), notes),
    websiteContext: context,
    source: context.source || "pre-demo-intelligence"
  };
  manifest.context.websiteContextScannedAt = context.scanned_at || manifest.context.websiteContextScannedAt || new Date().toISOString();
}

function refreshWebsiteContextForNotes(websiteContext, notes = "") {
  const context = normalizedWebsiteContext(websiteContext);
  const comparisonText = websiteContextComparableText(context);
  return {
    ...context,
    contradictions_or_checks: websiteContradictionsOrChecks(comparisonText, notes),
    scanned_at: context.scanned_at || new Date().toISOString()
  };
}

function hasUsableWebsiteContext(websiteContext) {
  const context = normalizedWebsiteContext(websiteContext);
  if (context.source === "pre-demo-intelligence-required") return false;
  return Boolean(context.url && (context.summary || context.title || context.description || context.interesting_points.length || context.evidence.length));
}

function sameCompanyUrl(left, right) {
  const normalize = (value) => {
    const url = normalizeCompanyUrl(value);
    if (!url) return "";
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
      const pathName = parsed.pathname.replace(/\/+$/, "");
      return `${host}${pathName && pathName !== "/" ? pathName : ""}`;
    } catch {
      return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
    }
  };
  return normalize(left) === normalize(right);
}

function websiteContextComparableText(websiteContext) {
  const context = normalizedWebsiteContext(websiteContext);
  return [
    context.title,
    context.description,
    context.summary,
    ...(context.interesting_points || []),
    ...(context.evidence || [])
  ].filter(Boolean).join("\n");
}

function deriveCompanyNameFromWebsiteContext(websiteContext) {
  const context = normalizedWebsiteContext(websiteContext);
  if (context.title || context.url) {
    try {
      return deriveCompanyName(context.title, normalizeCompanyUrl(context.url));
    } catch {}
  }
  return context.url ? websiteNameSlug(context.url) || "The prospect" : "The prospect";
}

function hasPrepPayload(body = {}) {
  return ["topic", "inputMode", "demoScope", "competition", "audience", "marketSegment", "demoStrategy", "industry", "manifestDemoMode", "outputLanguage", "companyUrl", "preDemoNotes", "instructions"].some((key) => Object.hasOwn(body, key));
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
    featureFlags: featureFlagsPayload(),
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
    versions: await listCmsVersions(),
    featureFlags: featureFlagsPayload()
  };
}

async function buttonInstructionsPayload() {
  const generatedAt = new Date().toISOString();
  const buttons = buttonInstructionCatalog();
  const files = await listButtonInstructionFiles(buttons);
  return {
    ok: true,
    generatedAt,
    description: "Reference JSON payloads for the NetSuite Demo Helper buttons that call the local API.",
    note: "These examples show the shape of the JSON sent by each button. Runtime values come from the visible form fields, selected voice, selected manifest version, or edited text.",
    buttons,
    files
  };
}

async function exportButtonInstructionFiles() {
  const payload = await buttonInstructionsPayload();
  await mkdir(buttonInstructionsDir, { recursive: true });
  const index = {
    ...payload,
    files: payload.buttons.map((button) => ({
      id: button.id,
      label: button.label,
      file: `${button.id}.json`,
      downloadUrl: `/api/button-instructions/download/${button.id}.json`
    }))
  };
  await writeFile(path.join(buttonInstructionsDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  for (const button of payload.buttons) {
    await writeFile(path.join(buttonInstructionsDir, `${button.id}.json`), `${JSON.stringify(button, null, 2)}\n`, "utf8");
  }
  return {
    ok: true,
    generatedAt: payload.generatedAt,
    directory: buttonInstructionsDir,
    files: [
      {
        id: "index",
        label: "Complete button/API instruction index",
        file: "index.json",
        downloadUrl: "/api/button-instructions/download/index.json"
      },
      ...index.files
    ]
  };
}

async function listButtonInstructionFiles(buttons = buttonInstructionCatalog()) {
  try {
    const existing = new Set((await readdir(buttonInstructionsDir)).filter((file) => file.endsWith(".json")));
    const files = [
      existing.has("index.json")
        ? {
            id: "index",
            label: "Complete button/API instruction index",
            file: "index.json",
            downloadUrl: "/api/button-instructions/download/index.json"
          }
        : null,
      ...buttons.map((button) => existing.has(`${button.id}.json`)
        ? {
            id: button.id,
            label: button.label,
            file: `${button.id}.json`,
            downloadUrl: `/api/button-instructions/download/${button.id}.json`
          }
        : null)
    ].filter(Boolean);
    return files;
  } catch {
    return [];
  }
}

function buttonInstructionCatalog() {
  const prepPayload = buttonPrepPayloadExample();
  const runPayload = {
    mode: "live",
    valueIntensity: "balanced",
    voiceProvider: "say",
    voiceApiKey: "",
    voice: "Samantha"
  };
  const guideActionPayload = {
    mode: "executive",
    instruction: "Editable output from the AI action preview. This text is applied to the SC guide only when the user clicks Apply Edited Output To SC Guide."
  };
  const buttons = [
    buttonInstruction("pre-demo-scoring", "Pre-demo scoring", "Prep", "POST", "/api/pre-demo-intelligence", prepPayload, "Runs a Codex pre-demo operator to score only the pre-demo input quality. This is where the company website is scanned once and stored for reuse.", true),
    buttonInstruction("learn-create-demo", "Learn / Create Demo", "Prep", "POST", "/api/learn", { ...prepPayload, createRunnableManifest: false }, "Runs the Codex prep operator, generates the SC guide, generates Demo Intelligence once, then derives Pre-Demo Intelligence from that result.", true),
    buttonInstruction("learn-create-demo-dry-run", "Learn / Create Demo & Dry-Run", "Prep", "POST", "/api/learn", { ...prepPayload, createRunnableManifest: true }, "Same as Learn / Create Demo, plus creates the dry-run creation prompt and builds the runnable manifest from that prompt. The browser dry-run is then started through /api/run.", true, [
      { method: "POST", endpoint: "/api/run", body: { ...runPayload, mode: "browser-dry-run" } }
    ]),
    buttonInstruction("reload-workspace", "Reload", "Prep", "GET", "/api/manifest", null, "Reloads the saved manifest, SC guide, setup prompt, Demo Intelligence, and derived Pre-Demo Intelligence.", true, [
      { method: "GET", endpoint: "/api/sc-guide", body: null },
      { method: "GET", endpoint: "/api/setup-prompt", body: null }
    ]),
    buttonInstruction("play-sample-voice", "Play Sample", "Prep", "POST", "/api/voice-sample", {
      voice: "Samantha",
      voiceProvider: "say",
      voiceApiKey: "",
      line: "Let's show how NetSuite gives finance teams a clearer view of performance and the decisions behind it."
    }, "Plays a short sample through the selected narration provider.", false),
    buttonInstruction("voice-provider-change", "Narration engine / Voice refresh", "Prep", "POST", "/api/voices", {
      provider: "elevenlabs",
      apiKey: "session-only-api-key-if-cloud-provider-is-selected"
    }, "Loads available voices for the selected narration provider. API keys are session-only and are not saved in the manifest.", false),
    buttonInstruction("codex-backbone-status", "Codex active / Backbone check", "Header", "GET", "/api/codex/status", null, "Checks whether the local Codex runtime is available.", false),
    buttonInstruction("stop-codex-action", "Stop Codex Action", "Header", "POST", "/api/codex/stop", {}, "Requests cancellation of the currently running Codex background action.", false),
    buttonInstruction("export-guide-word", "Export To Word", "SC Guide", "POST", "/api/export-guide-docx", {}, "Exports the current SC guide as a Word document.", false),
    buttonInstruction("execute-setup-prompt", "Execute Now", "SC Guide", "POST", "/api/execute-setup-prompt", {
      confirmed: true,
      account: "td2963620"
    }, "After user confirmation, prepares the Codex handoff for NetSuite account setup.", true),
    buttonInstruction("save-dry-run-manifest", "Save Manifest", "Dry-Run", "POST", "/api/manifest", {
      manifest: "{\\n  \"name\": \"Edited manifest JSON from the editor\"\\n}"
    }, "Saves the edited manifest JSON and refreshes the guide/setup/intelligence payloads.", true),
    buttonInstruction("create-dry-run-from-prompt", "Create Dry-Run From Prompt", "Dry-Run", "POST", "/api/manifest/from-guide", {}, "Builds the runnable dry-run manifest from the SC Guide tab's Dry-run creation prompt, then refreshes Demo Intelligence once and derives Pre-Demo Intelligence.", true),
    buttonInstruction("refresh-dry-run-creation-prompt", "Recreate Dry-Run Creation Prompt", "SC Guide / Run", "POST", "/api/dry-run-prompt/refresh", {}, "Refreshes the Dry-run creation prompt timestamp and hash from the latest SC guide without running full Codex Intelligence.", false),
    buttonInstruction("reload-manifest", "Reload Manifest", "Dry-Run", "GET", "/api/manifest", null, "Reloads the saved dry-run manifest and associated generated outputs.", true),
    buttonInstruction("restore-version", "Restore Selected", "Dry-Run", "POST", "/api/restore", {
      file: "2026-05-19T00-00-00-000Z-aircharterservice-before-learn.json"
    }, "Restores an earlier manifest version and refreshes generated outputs.", true),
    buttonInstruction("run-dataset-analysis", "Run Dataset Analysis", "Dataset Analysis", "POST", "/api/dataset-analysis", {
      valueIntensity: "balanced"
    }, "Refreshes the dry-run manifest from the Dry-run creation prompt, opens/reuses NetSuite for login, runs the dry-run through the browser, scores dataset readiness, and generates a Codex setup prompt.", false),
    buttonInstruction("execute-dataset-prompt", "Execute Dataset Prompt In Codex", "Dataset Analysis", "POST", "/api/dataset-analysis/execute-prompt", {
      confirmed: true,
      account: "td2963620"
    }, "After user confirmation, copies the dataset setup prompt, opens NetSuite and Codex, and prepares the Codex handoff. Codex must verify front-end and back-end NetSuite access before write actions.", true),
    buttonInstruction("reanalyze-updated-guide", "Re-analyze Updated Guide", "Demo Intelligence", "POST", "/api/intelligence", prepPayload, "Runs full Codex-backed Demo Intelligence from the current Prep fields, reusing the saved Pre-Demo website context instead of scanning the website again.", true),
    buttonInstruction("generate-discovery-followups", "Generate Discovery Follow-Up Questions", "Demo Intelligence / Pre-Demo Intelligence", "POST", "/api/intelligence/follow-up-questions", {
      ...prepPayload,
      additionalComments: "Optional SC comments to steer the discovery questions."
    }, "Runs a Codex discovery operator. Output is for discovery only and is not applied to the SC guide.", true),
    buttonInstruction("apply-all-recommendations", "Apply All Recommendations To SC Guide", "Demo Intelligence", "POST", "/api/intelligence/improve-guide", {}, "Runs Codex to rewrite the SC guide using visible intelligence recommendations, then refreshes Demo Intelligence and derived Pre-Demo Intelligence.", true),
    buttonInstruction("apply-edited-ai-output", "Apply Edited Output To SC Guide", "Demo Intelligence", "POST", "/api/intelligence/apply-action", guideActionPayload, "Applies the editable AI action output to the SC guide. Shorten, executive, technical, and custom preview buttons are local until this button is clicked.", true),
    buttonInstruction("refresh-pre-demo-scoring", "Refresh Pre-Demo Scoring", "Pre-Demo Intelligence", "POST", "/api/pre-demo-intelligence", prepPayload, "Runs the Codex pre-demo operator again for the current Prep inputs. If the same website was already scanned, it reuses that website context and refreshes the notes comparison.", true),
    buttonInstruction("export-discovery-followups", "Export Follow-Up Questions To Word", "Pre-Demo Intelligence", "POST", "/api/export-follow-up-questions-docx", {
      ...prepPayload,
      additionalComments: "Optional SC comments included in the export.",
      questions: ["Which success metric should the demo prove?"],
      questionsMarkdown: "# Optional Codex-generated question markdown"
    }, "Exports the current recommended discovery follow-up questions and SC comments as a Word document.", false),
    buttonInstruction("dry-run-prep", "Dry-Run Prep", "Run", "POST", "/api/run", { ...runPayload, mode: "dry-run-prep" }, "Confirms the Dry-run creation prompt timestamp, rebuilds the runnable manifest from that prompt, prepares the buffer, and opens NetSuite for login.", false),
    buttonInstruction("buffer-dry-run", "Buffer Dry-Run", "Run", "POST", "/api/run", { ...runPayload, mode: "buffer-dry-run" }, "Confirms the Dry-run creation prompt timestamp, rebuilds the dry-run manifest from that prompt, then clicks through it without narration.", false),
    buttonInstruction("live-demo", "Live Demo", "Run", "POST", "/api/run", runPayload, "Confirms the Dry-run creation prompt timestamp, refreshes the runnable manifest from that prompt, then runs the live demo with narration.", false),
    buttonInstruction("stop-demo-run", "Stop", "Run", "POST", "/api/stop", {}, "Stops the currently running browser demo automation.", false),
    buttonInstruction("cms-create-admin-login", "Create Admin Login", "Admin", "POST", "/api/cms/setup", {
      password: "at-least-12-characters"
    }, "Creates the local Admin login using a salted scrypt hash.", false),
    buttonInstruction("cms-login", "Login", "Admin", "POST", "/api/cms/login", {
      password: "admin-password"
    }, "Starts a local Admin session with an http-only same-site cookie.", false),
    buttonInstruction("cms-logout", "Logout", "Admin", "POST", "/api/cms/logout", {}, "Clears the Admin session cookie.", false),
    buttonInstruction("cms-reload", "Reload CMS", "Admin", "GET", "/api/cms", null, "Reloads editable CMS content blocks and version history.", false),
    buttonInstruction("cms-save-content-block", "Save Content Block", "Admin", "POST", "/api/cms/save", {
      blockId: "preDemoIntelligenceGuidance",
      rawValue: "Updated text or JSON string for the selected content block.",
      changeNote: "Explain what changed."
    }, "Saves one Admin content block and creates a rollback version.", false),
    buttonInstruction("cms-restore-version", "Restore Selected Version", "Admin", "POST", "/api/cms/restore", {
      file: "2026-05-19T00-00-00-000Z-before-cms-save.json"
    }, "Restores a previous CMS content snapshot.", false),
    buttonInstruction("export-button-api-json", "Generate Button/API JSON Files", "Admin", "POST", "/api/button-instructions/export", {}, "Writes one JSON file per API-driving button plus an index file for download.", false)
  ];
  if (!liveDemoFunctionalityEnabled) {
    const liveDemoOnly = new Set([
      "learn-create-demo-dry-run",
      "play-sample-voice",
      "voice-provider-change",
      "save-dry-run-manifest",
      "create-dry-run-from-prompt",
      "refresh-dry-run-creation-prompt",
      "reload-manifest",
      "restore-version",
      "run-dataset-analysis",
      "execute-dataset-prompt",
      "dry-run-prep",
      "buffer-dry-run",
      "live-demo"
    ]);
    return buttons.filter((button) => !liveDemoOnly.has(button.id));
  }
  return buttons;
}

function buttonInstruction(id, label, screen, method, endpoint, body, description, codexBacked, followUpRequests = []) {
  return {
    id,
    label,
    screen,
    method,
    endpoint,
    requestBodyExample: body,
    followUpRequests,
    codexBacked,
    description
  };
}

function buttonPrepPayloadExample() {
  const defaults = defaultTestPrepData();
  return {
    topic: defaults.topic,
    inputMode: defaults.inputMode,
    manifestDemoMode: defaults.manifestDemoMode,
    demoStrategy: defaults.demoStrategy,
    industry: defaults.industry,
    audience: defaults.audience,
    marketSegment: defaults.marketSegment,
    outputLanguage: defaults.outputLanguage,
    instructions: "Use standard reports first, lead with business outcomes, and avoid low-value setup.",
    demoScope: defaults.demoScope,
    competition: defaults.competition,
    companyUrl: defaults.companyUrl,
    preDemoNotes: defaults.preDemoNotes,
    valueIntensity: "balanced",
    voiceProvider: "say",
    voice: "Samantha"
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

async function saveFeatureFlags(body = {}) {
  const content = await readCmsContent();
  const block = content.blocks?.featureFlags;
  if (!block) throw httpError("Feature flags CMS block is not available.", 400);
  await saveCmsVersion("before-feature-flags");
  const current = block.value && typeof block.value === "object" && !Array.isArray(block.value) ? block.value : {};
  block.value = {
    ...current,
    liveDemoFunctionality: body.liveDemoFunctionality !== false
  };
  block.updatedAt = new Date().toISOString();
  content.updatedAt = block.updatedAt;
  content.history = [
    {
      id: randomBytes(8).toString("hex"),
      blockId: "featureFlags",
      label: "Feature Flags",
      note: `Live demo functionality ${block.value.liveDemoFunctionality ? "enabled" : "disabled"}`,
      changedAt: block.updatedAt
    },
    ...(content.history || [])
  ].slice(0, 80);
  await writeCmsContent(content);
  applyCmsContentToRuntime(content);
  return {
    ok: true,
    featureFlags: featureFlagsPayload(),
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
      featureFlags: cmsJsonBlock("Feature Flags", "Admin-controlled app capabilities. Switch live demo functionality off to focus the app on prep, SC guide, and intelligence only.", { liveDemoFunctionality: true }, now),
      helperSteps: cmsJsonBlock("How The Helper Works Steps", "The explanation steps shown on the Prep page.", helperSteps(), now),
      additionalDemoSources: cmsJsonBlock("Additional Sources / Demo Logic", "Add internal playbooks, source notes, reusable rules, and generation logic the helper should consider when creating demos.", defaultAdditionalDemoSources(), now),
      preDemoIntelligenceGuidance: cmsTextBlock("Pre-Demo Intelligence Guidance", "Editable rules sent to Codex for scoring pre-demo notes and discovery quality.", defaultPreDemoIntelligenceGuidance(), now),
      scStoryRunbookGuidance: cmsTextBlock("Personalized SC Story And Runbook Logic", "Admin-only rules sent to Codex for creating the Personalized Demo Story And Runbook section.", defaultScStoryRunbookGuidance(), now),
      demoAssetPromptGuidance: cmsTextBlock("Demo Asset / PowerPoint Prompt Logic", "Admin-only rules sent to Codex for creating the Demo Asset Generation Prompt section.", defaultDemoAssetPromptGuidance(), now),
      codexAccountSetupGuidance: cmsTextBlock("Codex Account Setup Prompt Logic", "Admin-only rules used after the Personalized SC Story And Runbook is completed to derive the NetSuite Prep Summary and account setup prompt.", defaultCodexAccountSetupGuidance(), now),
      dryRunCreationGuidance: cmsTextBlock("Dry-Run Creation Prompt Logic", "Admin-only rules used after the Personalized SC Story And Runbook is completed to create the Dry-run creation prompt.", defaultDryRunCreationGuidance(), now),
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
  if (id === "featureFlags") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw httpError("Feature Flags must be a JSON object.", 400);
    if (typeof value.liveDemoFunctionality !== "boolean") throw httpError("Feature Flags needs a boolean liveDemoFunctionality value.", 400);
  }
}

function applyCmsContentToRuntime(content) {
  const blocks = content.blocks || {};
  defaultScInstructionsOverride = String(blocks.defaultScInstructions?.value || "").trim();
  helperIntroOverride = String(blocks.helperIntro?.value || "").trim();
  liveDemoFunctionalityEnabled = blocks.featureFlags?.value?.liveDemoFunctionality !== false;
  helperStepsOverride = Array.isArray(blocks.helperSteps?.value) ? structuredClone(blocks.helperSteps.value) : null;
  additionalDemoSources = Array.isArray(blocks.additionalDemoSources?.value) ? structuredClone(blocks.additionalDemoSources.value) : [];
  preDemoIntelligenceGuidanceOverride = String(blocks.preDemoIntelligenceGuidance?.value || "").trim();
  scStoryRunbookGuidanceOverride = String(blocks.scStoryRunbookGuidance?.value || "").trim();
  demoAssetPromptGuidanceOverride = String(blocks.demoAssetPromptGuidance?.value || "").trim();
  codexAccountSetupGuidanceOverride = String(blocks.codexAccountSetupGuidance?.value || "").trim();
  dryRunCreationGuidanceOverride = String(blocks.dryRunCreationGuidance?.value || "").trim();
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
    "Open with the biggest business hitters first: executive visibility, trusted numbers, process control, close speed, auditability, and fewer spreadsheets.",
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
  return helperIntroOverride || "The tool detects the local Codex app and uses Codex background operators to turn company context, discovery notes, audience choices, demo scope, and strategy into practical SC demo assets.";
}

function helperSteps() {
  return helperStepsOverride || [
    { title: "1. Brief", body: "Add the company site, demo request, discovery notes, and SC instructions." },
    { title: "2. Shape", body: "Choose audience type, target segment, strategy, industry, language, and story mode." },
    { title: "3. Learn", body: "Codex reviews the context and infers likely ERP priorities and demo pressure points." },
    { title: "4. Generate", body: "Codex authors the SC guide; the helper turns it into an editable manifest with navigation, narration, proof points, and safe actions." },
    { title: "5. Check", body: "Codex reviews the guide and manifest; the Intelligence tab structures the risks, gaps, pacing, stakeholders, and winning moments." },
    { title: "6. Coach", body: "The SC guide gives the demo story, talk track, setup prompt, and asset prompt." },
    { title: "7. Rehearse", body: "Rehearsal checks routes, buffers account prep, captures timing, and warms the flow." },
    { title: "8. Run", body: "The live demo drives NetSuite and narrates with the selected voice engine." }
  ];
}

function helperStepsHtml() {
  return helperSteps().map((step) => `<div class="step"><strong>${escapeHtml(step.title)}</strong><span>${escapeHtml(step.body)}</span></div>`).join("");
}

function preDemoIntelligenceGuidance() {
  return preDemoIntelligenceGuidanceOverride || defaultPreDemoIntelligenceGuidance();
}

function defaultPreDemoIntelligenceGuidance() {
  return [
    "Score the quality of discovery notes before full demo generation.",
    "Look for current systems, business pain, stakeholders, success criteria, scope clarity, process detail, technical/integration context, urgency, risks, and decision context.",
    "Keep this lighter than Demo Intelligence. It should help an SC decide what discovery is missing before asking Codex to build the full guide.",
    "Do not score generated demo flow, manifest pacing, rehearsal quality, or demo run behavior on this page.",
    "Make follow-up questions specific to what is missing from the notes, company website context, selected audience, target segment, strategy, industry, and scope."
  ].join("\n");
}

function dryRunCreationGuidance() {
  return dryRunCreationGuidanceOverride || defaultDryRunCreationGuidance();
}

function scStoryRunbookGuidance() {
  return scStoryRunbookGuidanceOverride || defaultScStoryRunbookGuidance();
}

function demoAssetPromptGuidance() {
  return demoAssetPromptGuidanceOverride || defaultDemoAssetPromptGuidance();
}

function codexAccountSetupGuidance() {
  return codexAccountSetupGuidanceOverride || defaultCodexAccountSetupGuidance();
}

function defaultScStoryRunbookGuidance() {
  return [
    "Create the Personalized Demo Story And Runbook as the main SC-facing story, not a generic product walkthrough.",
    "Interpret the prep JSON as hard context: audience, target segment, strategy, industry, company website, demo scope, input mode, demo request, and pre-demo notes all shape the runbook.",
    "Start with the general or executive NetSuite overview, then order proof moments from strongest business impact to supporting detail.",
    "Use personas when the demo mode is customer story: name the business pressure, the person feeling it, what they need to prove, and how the demo resolves it.",
    "For each runbook step include what to do, what to say, the proof point to land, and the SC tip.",
    "Keep the SC practical: include navigation intent, discovery hooks, setup assumptions, timing caution, and what to avoid.",
    "Stay inside the demo scope even if the notes mention adjacent areas. Put out-of-scope ideas into parking-lot language."
  ].join("\n");
}

function defaultDemoAssetPromptGuidance() {
  return [
    "Create the Demo Asset Generation Prompt as a concise prompt for supporting slides or presentation assets.",
    "Align assets to the Personalized Demo Story And Runbook rather than repeating every requirement from the notes.",
    "Bring the personas to life visually: who is under pressure, what is hard today, and what changes after the NetSuite story lands.",
    "Prefer a small number of useful assets: persona slide, current-state pain slide, future-state proof slide, and optional closing visual.",
    "Include stock-image or AI-image direction for realistic business personas and scenes, but avoid fake customer logos or unsupported claims.",
    "Keep it useful for an SC creating a PPT companion, not a full implementation deck."
  ].join("\n");
}

function defaultCodexAccountSetupGuidance() {
  return [
    "Derive the NetSuite Prep Summary and Prompt For Codex Account Setup from the completed Personalized Demo Story And Runbook.",
    "Treat the story/runbook as the source of truth: setup exists only to support the story, demo scope, and dry-run route.",
    "Separate safe read-only checks from any write actions.",
    "Always require Codex to verify front-end browser access, back-end NetSuite access, account, role, and logged-in state before proposing setup changes.",
    "List only setup items that directly support the finalized story, demo scope, or dry-run route.",
    "When setup is uncertain, ask Codex to inspect first and produce a gap list before creating anything.",
    "Require explicit confirmation before creating, editing, saving, approving, posting, importing, or deleting anything.",
    "Prefer standard NetSuite objects, standard reports, and minimal demo data. Do not create custom reports unless the SC guide explicitly requires them."
  ].join("\n");
}

function defaultDryRunCreationGuidance() {
  return [
    "Convert the SC guide into a repeatable browser dry-run manifest, not a new SC guide.",
    "Use NetSuite navigation bar and global search first.",
    "Use standard NetSuite reports, dashboards, centers, lists, and forms before custom reports.",
    "Start with a general or executive overview, then move from highest business proof to supporting detail.",
    "Include verification text after navigation so the dry-run can detect whether it is on the right page.",
    "Keep the route read-only unless an approved setup prompt has already prepared records or configuration.",
    "Mark uncertain selectors, slow pages, or account setup assumptions as rehearsal risks."
  ].join("\n");
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
      guidance: "Use this as a routing and narration rule when the demo touches financial reporting, P&L, drilldown, export, or finance visibility.",
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
    && existing.includes("## Codex Backbone")) {
    return existing;
  }

  return writeScGuide(manifest, guideBodyFromManifest(manifest), manifest.context?.company || {});
}

async function readSavedOrLocalScGuide(manifest) {
  const existing = await readScGuide();
  if (existing.trim()) return existing;
  return generateScGuide(manifest, guideBodyFromManifest(manifest), manifest.context?.company || {});
}

function guideBodyFromManifest(manifest) {
  const request = manifest.context?.demoRequest || {};
  return {
    topic: request.topic || manifest.name || "",
    inputMode: request.inputMode || "request-and-notes",
    demoScope: manifest.context?.demoScope || request.demoScope || "",
    competition: manifest.context?.competition || request.competition || "",
    audience: manifest.context?.audience?.value || request.audience || manifest.audience || "prospect",
    marketSegment: manifest.context?.marketSegment?.value || manifest.context?.targetAudience?.value || request.marketSegment || request.targetAudience || "mid_market",
    demoStrategy: manifest.context?.demoStrategy?.id || request.demoStrategy || manifest.defaults?.demoStrategy || "standard_platform_demo",
    industry: manifest.context?.industry?.id || request.industry || manifest.defaults?.industry || "general_business",
    manifestDemoMode: manifest.context?.manifestDemoMode?.id || request.manifestDemoMode || "customer_story",
    outputLanguage: manifest.context?.outputLanguage?.value || request.outputLanguage || manifest.defaults?.outputLanguage || "en",
    valueIntensity: manifest.defaults?.valueStatementIntensity || request.valueIntensity || "balanced",
    instructions: request.instructions || defaultScInstructions(),
    preDemoNotes: manifest.context?.preDemoNotes || request.preDemoNotes || ""
  };
}

async function exportScGuideDocx() {
  const manifest = await readManifest();
  const guide = await readOrGenerateScGuide(manifest);
  if (!guide.trim()) throw new Error("Create an SC guide before exporting to Word.");
  const fileName = `${companyFileSlug(manifest)}-sc-demo-guide.docx`;
  const result = await writeMarkdownDocx(guide, fileName);
  return {
    ok: true,
    path: result.outputPath,
    downloadUrl: result.downloadUrl
  };
}

async function exportFollowUpQuestionsDocx(body = {}) {
  const savedManifest = await readManifest();
  const manifest = hasPrepPayload(body) ? manifestWithCurrentPrepInputs(savedManifest, body) : savedManifest;
  const preDemo = body.preDemoIntelligence && typeof body.preDemoIntelligence === "object"
    ? body.preDemoIntelligence
    : preDemoIntelligencePayload(manifest);
  const markdown = followUpQuestionsExportMarkdown(manifest, preDemo, body);
  const fileName = `${companyFileSlug(manifest)}-discovery-follow-up-questions.docx`;
  const result = await writeMarkdownDocx(markdown, fileName);
  return {
    ok: true,
    path: result.outputPath,
    downloadUrl: result.downloadUrl
  };
}

async function writeMarkdownDocx(markdown, fileName) {
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

  const children = markdownToDocxChildren(markdown, { AlignmentType, BorderStyle, HeadingLevel, Paragraph, ShadingType, TextRun });
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
    outputPath,
    downloadUrl: `/api/download/${encodeURIComponent(fileName)}`
  };
}

function followUpQuestionsExportMarkdown(manifest, preDemo, body = {}) {
  const metadata = preDemo.metadata || {};
  const additionalComments = String(body.additionalComments || "").trim();
  const codexQuestions = String(body.questionsMarkdown || body.codexQuestions || "").trim();
  const questions = stringArray(body.questions?.length ? body.questions : preDemo.recommended_follow_up_questions);
  const missing = stringArray(preDemo.missing_discovery_items);
  const covered = stringArray(preDemo.found_discovery_items);
  const recommendations = stringArray(preDemo.recommendations);
  const questionSection = codexQuestions
    ? codexQuestions
    : questions.map((question, index) => `${index + 1}. ${question}`).join("\n");
  return `# Discovery Follow-Up Questions

## Demo Context
- Customer: ${metadata.customer_name || manifest.context?.company?.companyName || manifest.name || "Current demo"}
- Website: ${metadata.customer_url || manifest.context?.company?.url || "Not provided"}
- Audience: ${metadata.audience_type || manifest.context?.audience?.label || "Not selected"}
- Target segment: ${metadata.target_segment || manifest.context?.marketSegment?.label || manifest.context?.targetAudience?.label || "Not selected"}
- Industry: ${metadata.industry || manifest.context?.industry?.label || "Not selected"}
- Demo strategy: ${metadata.demo_strategy || manifest.context?.demoStrategy?.label || "Not selected"}
- Demo scope: ${metadata.demo_scope || manifest.context?.demoScope || "Not specified"}
- Notes score: ${preDemo.overall_score ?? "-"} / 100

## Additional SC Comments
${additionalComments || "No additional SC comments were added."}

## Recommended Follow-Up Questions
${questionSection || "No follow-up questions were generated yet."}

## Missing Discovery Items
${missing.length ? missing.map((item) => `- ${item}`).join("\n") : "- None detected."}

## Already Covered
${covered.length ? covered.map((item) => `- ${item}`).join("\n") : "- No covered discovery items were detected yet."}

## Recommended Note Improvements
${recommendations.length ? recommendations.map((item) => `- ${item}`).join("\n") : "- No additional note improvements detected."}
`;
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
  const competition = String(body.competition || "").trim();
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
  const includeCash360 = cash360RequestedFromText(topic, preDemoNotes, demoScope);

  const next = structuredClone(manifest);
  if (!includeCash360) {
    next.id = "netsuite-finance-standard-reporting";
    next.name = "NetSuite Finance Demo: Standard Reporting and Drilldown";
  }
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
  next.context.codexPrepAnalysis = company.codexPrepAnalysis || null;
  next.context.preDemoNotes = preDemoNotes;
  next.context.demoScope = demoScope;
  next.context.competition = competition;
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
    competition,
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
    includeCash360,
    instructions,
    additionalDemoSources: adminSources,
    learnedAt: new Date().toISOString(),
    instruction: `Use NetSuite navigation/search first, use standard reports for prospect-facing demos, and keep custom report links only as explicit fallbacks. Start with a short general or executive NetSuite overview, then order the demo from highest-value proof moments to supporting detail. Demo scope: ${demoScope || "Use the generated request and notes as scope."} ${competition ? `Competition/status quo context to consider: ${competition}. ` : ""}${audienceExecutionInstruction(audience, marketSegment)} ${demoStrategyInstruction(demoStrategy, industry)} ${adminSourceInstruction ? `Additional Admin logic to consider: ${adminSourceInstruction}` : ""}`
  };
  next.context.navigationPolicy = {
    preferred: ["NetSuite global search", "NetSuite navigation bar"],
    avoid: ["custom saved reports for prospect demos", "deep links unless used as fallback after a learned route"],
    reportPolicy: "Use standard NetSuite reports for prospect-facing demos unless the user explicitly asks for a custom report."
  };

  const mappedSegments = next.segments
    .filter((segment) => includeCash360 || !isCash360Segment(segment))
    .map((segment) => {
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

    if (segment.id === "close" && !includeCash360) {
      return {
        ...segment,
        valueStatement: `${company.companyName || "The prospect"} leaves with a clear finance story: trusted reporting, explainable detail, controlled sharing, and a practical next step.`,
        narration: "That is the finance story end to end: a trusted performance view, explainability through filters and drilldown, controlled sharing through exports, and a clear path from insight to action."
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
    ordering: "Order the demo from strongest business impact to supporting detail: executive overview, trusted reporting, filters, drilldown, controlled sharing, the next in-scope proof point, then close.",
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
    : `Before we open the first report, frame the executive view for ${companyName}: NetSuite is the operating system where finance can see performance, prove the detail, and make decisions from one controlled place. We will start with the highest-value proof moments, then move into supporting detail.${scopeLine}`;

  return {
    id: "executive-overview",
    title: "Frame The Executive NetSuite Overview",
    objective: "Set up the general NetSuite platform story before opening detailed finance workflows.",
    valueStatement: `${companyName} first sees why NetSuite matters at the executive level: visibility, control, trusted numbers, and a clear path from summary to action.`,
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
  if (/(cash forecast|cash position|cash visibility|cash flow|working capital|liquidity)/.test(combined)) {
    focus.push("cash and working-capital visibility");
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

  const defaultFocus = ["standard income statement, filters, drilldown, export, and the next in-scope finance proof point"];
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

function isCash360Segment(segment = {}) {
  const text = [
    segment.id,
    segment.title,
    segment.objective,
    segment.narration,
    segment.valueStatement,
    ...(segment.actions || []).flatMap((action) => [action.query, action.text, action.url, action.resultText])
  ].filter(Boolean).join(" ").toLowerCase();
  return cash360SegmentIds.has(segment.id) || /cash\s*360|cash360/.test(text);
}

function hasCash360Segments(segments = []) {
  return (segments || []).some((segment) => isCash360Segment(segment));
}

function cash360RequestedFromText(...values) {
  const text = values.filter(Boolean).join("\n").toLowerCase();
  return /cash\s*360|cash360|cash forecast(?:ing)?|cash position|cash planning|cash visibility|cash flow|liquidity|working capital|forecast controls/.test(text);
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
  if (/(cash\s*360|cash360|forecast category)/.test(combined)) add("configuration", "Cash 360 account/category setup", "needed if Cash 360 requires specific accounts, categories, or forecast assumptions");
  else if (/(bank|cash account|account category)/.test(combined)) add("configuration", "bank or cash account demo context", "needed if the story should show banking, account categories, or cash-related reporting");
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
  const fallbackContext = websiteContextFromContent({ url, notes, source: url ? "url-unavailable" : "notes-only" });
  const fallback = {
    companyName: url ? new URL(url).hostname.replace(/^www\./, "") : "The prospect",
    url,
    title: "",
    description: "",
    likelyPriorities: inferPriorities("", notes),
    industrySignals: inferIndustrySignals("", notes),
    websiteContext: fallbackContext,
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
    const websiteContext = websiteContextFromContent({ url, title, description, text, notes, source: "company-website" });
    return {
      companyName: deriveCompanyName(title, url),
      url,
      title,
      description,
      likelyPriorities: inferPriorities(combined, notes),
      industrySignals: inferIndustrySignals(combined, notes),
      websiteContext,
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

function websiteContextFromContent({ url = "", title = "", description = "", text = "", notes = "", source = "unknown" } = {}) {
  const combined = `${title}\n${description}\n${text}`.trim();
  const summary = websiteSummaryFromContent(title, description, text, url);
  const interestingPoints = websiteInterestingPoints(combined, url);
  return {
    source,
    url,
    title: title || "",
    description: description || "",
    summary,
    interesting_points: interestingPoints,
    evidence: websiteEvidenceSnippets(combined),
    contradictions_or_checks: websiteContradictionsOrChecks(combined, notes),
    scanned_at: new Date().toISOString()
  };
}

function websiteSummaryFromContent(title = "", description = "", text = "", url = "") {
  const cleanDescription = sentenceClean(description);
  if (cleanDescription) return cleanDescription;
  const titleText = sentenceClean(title);
  const firstSentence = firstUsefulSentence(text);
  if (titleText && firstSentence && !firstSentence.toLowerCase().includes(titleText.toLowerCase())) return `${titleText}. ${firstSentence}`;
  return titleText || firstSentence || (url ? `Website was reachable at ${url}, but no clear summary text was detected.` : "No website was supplied.");
}

function websiteInterestingPoints(text = "", url = "") {
  const lower = String(text || "").toLowerCase();
  const points = [];
  const add = (condition, point) => {
    if (condition && !points.includes(point)) points.push(point);
  };
  add(/private\s+jet|private\s+aviation|jet charter/.test(lower), "Private jet charter or private aviation appears to be a visible business line.");
  add(/cargo|freight/.test(lower), "Cargo or freight charter appears relevant, which may affect project, margin, and cost tracking examples.");
  add(/group\s+charter|passenger|commercial\s+jet/.test(lower), "Group passenger or commercial charter language appears on the website.");
  add(/aircraft\s+management|jet\s+management|managed\s+aircraft/.test(lower), "Aircraft management appears relevant and may need a distinct finance story from core charter brokerage.");
  add(/global|worldwide|international|countries|offices/.test(lower), "The website suggests an international or multi-location operating model.");
  add(/24\/7|twenty.?four|urgent|rapid|time.?critical|emergency/.test(lower), "Time-critical service delivery appears important and may shape the business-pressure story.");
  add(/bespoke|tailored|specialist|expert/.test(lower), "The customer proposition appears service-led and bespoke, which supports a services/project profitability demo angle.");
  add(/sports|music|entertainment|government|evacuation|humanitarian/.test(lower), "The website mentions specialized customer scenarios that could become persona or use-case examples.");
  if (!points.length && url) points.push("Website was scanned, but only limited business signals were detected from the homepage.");
  return points.slice(0, 8);
}

function websiteEvidenceSnippets(text = "") {
  const sentences = String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map(sentenceClean)
    .filter((sentence) => sentence.length >= 45 && sentence.length <= 220);
  const keywords = [/private/i, /cargo/i, /global|worldwide|international/i, /charter/i, /aircraft/i, /management/i, /group/i, /urgent|time/i];
  const chosen = [];
  for (const pattern of keywords) {
    const hit = sentences.find((sentence) => pattern.test(sentence) && !chosen.includes(sentence));
    if (hit) chosen.push(hit);
    if (chosen.length >= 5) break;
  }
  return chosen.length ? chosen : sentences.slice(0, 3);
}

function websiteContradictionsOrChecks(websiteText = "", notes = "") {
  const website = String(websiteText || "").toLowerCase();
  const noteText = String(notes || "").toLowerCase();
  const checks = [];
  const add = (condition, text) => {
    if (condition && !checks.includes(text)) checks.push(text);
  };
  const websiteLooksService = /(service|charter|aviation|private\s+jet|cargo|freight|aircraft|broker|travel)/.test(website);
  add(
    websiteLooksService && /(advanced inventory|warehouse|stock|manufacturing inventory|inventory management)/.test(noteText) && !/(inventory|warehouse|stock|manufactur|retail)/.test(website),
    "Pre-demo notes mention inventory-heavy scope, but the website reads primarily like a services/charter business. Confirm whether inventory is real demo scope, phase two, or a parking-lot topic."
  );
  add(
    /veluxis/.test(noteText) && !/veluxis/.test(website),
    "Pre-demo notes mention Veluxis, but the scanned website context does not. Confirm whether Veluxis should be part of this demo story or treated as a separate operating model."
  );
  add(
    /(manufacturing|factory|production line|bill of materials|work order)/.test(noteText) && !/(manufacturing|factory|production|industrial)/.test(website),
    "Notes mention manufacturing-style language that is not obvious from the scanned website. Confirm whether this is relevant to the customer or an unrelated template/example."
  );
  add(
    /(retail|ecommerce|e-commerce|storefront|pos)/.test(noteText) && !/(retail|shop|store|ecommerce|e-commerce)/.test(website),
    "Notes mention retail/ecommerce language that is not obvious from the scanned website. Confirm whether that belongs in the demo scope."
  );
  add(
    /(nonprofit|donor|fundraising|grant)/.test(noteText) && !/(nonprofit|charity|donor|fundraising|grant)/.test(website),
    "Notes mention nonprofit/fundraising language that is not visible in the scanned website context."
  );
  add(
    website && noteText && /(air charter|private jet|cargo|aircraft)/.test(website) && !/(charter|aviation|aircraft|flight|cargo|broker|jet)/.test(noteText),
    "The website clearly suggests an aviation/charter business, but the pre-demo notes barely mention that operating model. Add discovery detail on flight/booking profitability, route, broker, supplier/operator costs, and legal entity handling."
  );
  return checks.slice(0, 6);
}

function sentenceClean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().replace(/\s+([.,;:!?])/g, "$1");
}

function firstUsefulSentence(text = "") {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map(sentenceClean)
    .find((sentence) => sentence.length >= 45 && sentence.length <= 240) || "";
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
  const priorities = new Set(["trusted reporting", "drilldown from summary to detail"]);
  if (/(spreadsheet|excel|manual|reconciliation|close|month end|month-end)/.test(combined)) priorities.add("faster close with fewer spreadsheets");
  if (/(global|international|subsidiar|consolidat|multi.?entity|group)/.test(combined)) priorities.add("multi-entity consolidation");
  if (/(inventory|warehouse|supply chain|distribution|stock|fulfillment)/.test(combined)) priorities.add("inventory and supply chain visibility");
  if (/(project|billable|utilization|client|services)/.test(combined)) priorities.add("project profitability");
  if (/(cash forecast|cash position|cash visibility|cash flow|working capital|liquidity|collections|payables|receivables)/.test(combined)) priorities.add("cash forecasting and working capital control");
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
  return "Finance teams get a fast, trusted performance view from a standard NetSuite report before moving into drilldown, export, and the next proof point in scope.";
}

function openingNarration(audience, company, manifestDemoMode) {
  if (manifestDemoMode.id === "plain_demo") {
    return "We'll start with the standard income statement. It gives a finance team a controlled view of revenue, margin, overheads, and net profit before moving into filters, drilldown, export, and the next proof point in scope.";
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

function setupPromptPayload(manifest, guide = "") {
  const account = accountContext(manifest);
  const setupPlan = manifest.context?.setupPlan || inferSetupPlan({
    topic: manifest.context?.demoRequest?.topic,
    preDemoNotes: manifest.context?.preDemoNotes,
    instructions: manifest.context?.demoRequest?.instructions,
    demoScope: manifest.context?.demoScope || manifest.context?.demoRequest?.demoScope
  }, manifest.context?.company || {}, normalizeAudience(manifest.context?.audience?.value), normalizeMarketSegment(manifest.context?.targetAudience?.value || manifest.context?.marketSegment?.value));
  const storyRunbook = markdownSection(guide, "Personalized Demo Story And Runbook") || "";
  const codexPrepSection = markdownSection(guide, "Prompt For Codex Account Setup")
    || markdownSection(guide, "NetSuite Prep Summary")
    || "";
  const prompt = storyRunbook
    ? generateSetupPromptFromScStory(manifest, account, setupPlan, storyRunbook, codexPrepSection)
    : codexPrepSection
    ? generateSetupPromptFromCodexGuide(manifest, account, setupPlan, codexPrepSection)
    : generateSetupPrompt(manifest, account, setupPlan);
  const promptSource = storyRunbook
    ? "system-generated-from-sc-story-runbook"
    : codexPrepSection
    ? "legacy-codex-sc-guide-netSuite-prep-summary"
    : "local-setup-guardrail-fallback";

  return {
    account,
    setupPlan,
    promptSource,
    storyRunbookSource: storyRunbook ? "codex-sc-guide-personalized-story-runbook" : "",
    codexPrepSection,
    prompt,
    promptPreview: prompt.split("\n").slice(0, 18).join("\n")
  };
}

function generateSetupPromptFromScStory(manifest, account, setupPlan, storyRunbook, codexPrepSection = "") {
  const company = manifest.context?.company || {};
  const setupAlignmentTarget = liveDemoFunctionalityEnabled ? "story, demo scope, and dry-run route" : "story and demo scope";
  const items = setupPlan.items?.length
    ? setupPlan.items.map((item, index) => `${index + 1}. ${item.label} (${item.type}, ${item.risk} risk): ${item.reason}`).join("\n")
    : "No additional local setup items were inferred. Treat the completed SC story as the source of truth and keep the account read-only unless setup is explicitly approved.";

  return `You are preparing a NetSuite demo account for NetSuite Demo Helper.

SOURCE OF THIS PROMPT
- This setup prompt is generated after the Personalized Demo Story And Runbook has been completed.
- The completed story/runbook is the source of truth for what should exist in NetSuite.
- The NetSuite Prep Summary is supporting context only; if it conflicts with the story, follow the story and ask the SC to confirm.
- Local app logic is included only for account safety, account identity, and confirmation guardrails.
- If the story says the demo is read-only or only needs rehearsal checks, do not create records or configuration.

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
- Website: ${company.url || "Not provided"}
- Demo request: ${manifest.context?.demoRequest?.topic || "Not provided"}
- Demo scope: ${manifest.context?.demoScope || manifest.context?.demoRequest?.demoScope || "Not specified"}
- Audience: ${manifest.context?.audience?.label || manifest.context?.audience?.value || manifest.audience || "Not selected"}
- Target segment: ${manifest.context?.marketSegment?.label || manifest.context?.targetAudience?.label || "Not selected"}
- Strategy: ${manifest.context?.demoStrategy?.label || manifest.context?.demoStrategy?.id || "Not selected"}

COMPLETED PERSONALIZED SC STORY AND RUNBOOK
${storyRunbook.trim()}

NETSUITE PREP SUMMARY DERIVED FROM THE STORY
${codexPrepSection.trim() || "No separate NetSuite Prep Summary was found. Infer setup needs from the completed story/runbook, demo scope, and local safety cross-check items."}

ADMIN ACCOUNT SETUP PROMPT LOGIC
${codexAccountSetupGuidance()}

LOCAL SAFETY CROSS-CHECK ITEMS
${items}

TASK
1. Open or use the existing NetSuite browser session for the target account.
2. Confirm the visible account, role, and logged-in state.
3. Inspect whether the completed story/runbook can be demonstrated with the current account data and configuration.
4. Produce a short gap list: existing, missing, risky, not required.
5. Separate safe read-only checks from any write actions.
6. Ask for confirmation before creating or changing anything.
7. After confirmation, create only the explicitly approved demo data/configuration.
8. Prefer standard NetSuite objects, standard reports, and read-only verification wherever possible.
9. Keep setup aligned to the completed SC ${setupAlignmentTarget}.
10. Avoid custom reports unless explicitly required by the approved setup.
11. When finished, summarize exactly what was checked or created, where it can be found, and what story/runbook step uses it.
`;
}

function generateSetupPromptFromCodexGuide(manifest, account, setupPlan, codexPrepSection) {
  const company = manifest.context?.company || {};
  const items = setupPlan.items?.length
    ? setupPlan.items.map((item, index) => `${index + 1}. ${item.label} (${item.type}, ${item.risk} risk): ${item.reason}`).join("\n")
    : "No additional local setup items were inferred. Treat the Codex-authored guide section as the source of truth and keep the account read-only unless setup is explicitly approved.";

  return `You are preparing a NetSuite demo account for NetSuite Demo Helper.

SOURCE OF THIS PROMPT
- The task below is based on the Codex-authored SC guide section named "NetSuite Prep Summary".
- Local app logic is included only for account safety, account identity, and confirmation guardrails.
- If the Codex-authored section says the demo is read-only or only needs rehearsal checks, do not create records or configuration.

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
- Website: ${company.url || "Not provided"}
- Demo request: ${manifest.context?.demoRequest?.topic || "Not provided"}
- Demo scope: ${manifest.context?.demoScope || manifest.context?.demoRequest?.demoScope || "Not specified"}
- Audience: ${manifest.context?.audience?.label || manifest.context?.audience?.value || manifest.audience || "Not selected"}
- Target segment: ${manifest.context?.marketSegment?.label || manifest.context?.targetAudience?.label || "Not selected"}
- Strategy: ${manifest.context?.demoStrategy?.label || manifest.context?.demoStrategy?.id || "Not selected"}

CODEX-AUTHORED NETSUITE PREP GUIDANCE
${codexPrepSection.trim()}

ADMIN ACCOUNT SETUP PROMPT LOGIC
${codexAccountSetupGuidance()}

LOCAL SAFETY CROSS-CHECK ITEMS
${items}

TASK
1. Open or use the existing NetSuite browser session for the target account.
2. Confirm the visible account, role, and logged-in state.
3. Inspect whether the Codex-authored prep guidance is already satisfied.
4. Produce a short gap list: existing, missing, risky, not required.
5. Ask for confirmation before creating or changing anything.
6. After confirmation, create only the explicitly approved demo data/configuration.
7. Prefer standard NetSuite objects, standard reports, and read-only verification wherever possible.
8. Keep setup aligned to the Codex-authored SC story and demo scope.
9. Avoid custom reports unless explicitly required by the approved setup.
10. When finished, summarize exactly what was checked or created, where it can be found, and what demo segment uses it.
`;
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
- Audience interests: ${playbook.interests?.join(", ") || "trusted reporting and finance visibility"}
- Include in demo: ${playbook.includeInDemo?.join(", ") || "strong proof points"}
- Avoid in demo: ${playbook.avoidInDemo?.join(", ") || "low-value distractions"}
- Demo style: ${playbook.demoStyle?.join(", ") || "business-focused"}
- Demo request: ${manifest.context?.demoRequest?.topic || "Not provided"}
- Demo input mode: ${manifest.context?.demoRequest?.inputMode || "request-and-notes"}
- Manifest mode instruction: ${manifestDemoMode.instruction}
- Language instruction: ${outputLanguageInstruction(outputLanguage)}

ADMIN ACCOUNT SETUP PROMPT LOGIC
${codexAccountSetupGuidance()}

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
9. Keep setup aligned to the value-first demo order: executive overview, standard reporting, proof detail, the next in-scope business proof point, then lower-value supporting controls.
10. Avoid custom reports unless explicitly required by the approved setup.
11. When finished, summarize exactly what was created, where it can be found, and what demo segment uses it.
`;
}

async function writeScGuide(manifest, body, company) {
  const localDraft = generateScGuide(manifest, body, company);
  const codexGuide = await codexScGuideOperator(manifest, body, company, localDraft);
  if (!codexGuide.ok) {
    throw new Error(`Codex SC guide operator failed: ${codexGuide.error || "No output returned"}`);
  }
  const guide = normalizeCodexScGuide(codexGuide.output, localDraft, codexGuide);
  await mkdir(path.dirname(scGuidePath), { recursive: true });
  await writeFile(scGuidePath, guide, "utf8");
  const archiveDir = path.join(projectRoot, "artifacts/sc-guides");
  await mkdir(archiveDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  await writeFile(path.join(archiveDir, `${stamp}-${companyFileSlug(company)}-sc-guide.md`), guide, "utf8");
  return guide;
}

async function writeImprovedScGuide(manifest, guide, intelligence) {
  const localDraft = improveScGuideWithIntelligence(guide, intelligence);
  const codexGuide = await codexScGuideRevisionOperator(manifest, guide, intelligence, {
    mode: "apply_all_recommendations",
    label: "Apply All Intelligence Recommendations",
    instruction: "Rewrite the SC guide by applying the dashboard's recommendations in one pass. Preserve useful story detail, sharpen the highest-risk areas, and keep the result practical for an SC.",
    localDraft
  });
  if (!codexGuide.ok) {
    throw new Error(`Codex SC guide improvement failed: ${codexGuide.error || "No output returned"}`);
  }
  const improved = normalizeCodexScGuide(codexGuide.output, localDraft, codexGuide);
  await mkdir(path.dirname(scGuidePath), { recursive: true });
  await writeFile(scGuidePath, improved, "utf8");
  const archiveDir = path.join(projectRoot, "artifacts/sc-guides");
  await mkdir(archiveDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  await writeFile(path.join(archiveDir, `${stamp}-${companyFileSlug(manifest)}-improved-sc-guide.md`), improved, "utf8");
  return improved;
}

async function writeActionScGuide(manifest, guide, intelligence, body = {}) {
  const localDraft = applyIntelligenceActionToGuide(guide, intelligence, body);
  const codexGuide = await codexScGuideRevisionOperator(manifest, guide, intelligence, {
    mode: String(body.mode || "custom"),
    label: aiActionLabel(body.mode),
    instruction: body.instruction || "",
    localDraft
  });
  if (!codexGuide.ok) {
    throw new Error(`Codex SC guide action failed: ${codexGuide.error || "No output returned"}`);
  }
  const updated = normalizeCodexScGuide(codexGuide.output, localDraft, codexGuide);
  await mkdir(path.dirname(scGuidePath), { recursive: true });
  await writeFile(scGuidePath, updated, "utf8");
  const archiveDir = path.join(projectRoot, "artifacts/sc-guides");
  await mkdir(archiveDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const mode = String(body.mode || "action").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  await writeFile(path.join(archiveDir, `${stamp}-${companyFileSlug(manifest)}-${mode}-sc-guide.md`), updated, "utf8");
  return updated;
}

function aiActionLabel(mode) {
  return {
    followups: "Generate Discovery Follow-Up Questions",
    compress: "Shorten Demo",
    executive: "Generate Executive Demo",
    technical: "Generate Tech-Audience Demo",
    custom: "Custom Additional SC Guide Instruction"
  }[mode] || "Custom Additional SC Guide Instruction";
}

function applyIntelligenceActionToGuide(guide, intelligence, body = {}) {
  const mode = String(body.mode || "custom").trim();
  const baseGuide = stripMarkdownSection(guide, "Applied AI Action");
  return `${baseGuide.trim()}\n\n${guideSectionForAiAction(mode, intelligence, body.instruction)}\n`;
}

function guideSectionForAiAction(mode, intelligence, instruction = "") {
  const metadata = intelligence.demo_metadata || {};
  const risk = intelligence.demo_risk_analyzer || {};
  const discovery = intelligence.discovery_gap_analyzer || {};
  const timing = intelligence.demo_timing_pacing_analyzer || {};
  const winning = intelligence.winning_moment_detection || {};
  const avoid = intelligence.what_not_to_demo_engine || {};
  const stakeholder = intelligence.stakeholder_coverage_analyzer || {};
  const title = {
    followups: "Follow-Up Discovery Questions",
    compress: "Shortened Demo Version",
    executive: "Executive Demo Version",
    technical: "Technical-Audience Demo Version",
    custom: "Custom AI Instruction"
  }[mode] || "Custom AI Instruction";
  const editedInstruction = String(instruction || "").trim();

  if (editedInstruction && ["compress", "executive", "technical", "custom"].includes(mode)) {
    return `## Applied AI Action

### ${title}

${editedInstruction}
`;
  }

  if (mode === "followups") {
    return `## Applied AI Action

### ${title}

Use these questions before final rehearsal for ${metadata.customer_name || "the customer"}:

${followUpQuestionsFromIntelligence(intelligence)}
`;
  }

  if (mode === "compress") {
    return `## Applied AI Action

### ${title}

Goal: shorten the demo while keeping the strongest proof moments.

- Keep first: ${(winning.winning_moments || []).slice(0, 3).join(", ") || "the executive overview, strongest proof moment, and closing outcome"}.
- Cut or move to Q&A: ${(timing.recommended_cuts || []).slice(0, 4).join(", ") || "lower-value configuration, preferences, and repeated drilldowns"}.
- Watch risk: ${(risk.warnings || []).slice(0, 3).join("; ") || "keep pacing tight and avoid feature-tour behavior"}.
- Suggested runtime target: 20-30 minutes unless the meeting is explicitly longer.
- SC move: state the business outcome, show the shortest proof path, then move on.
`;
  }

  if (mode === "executive") {
    return `## Applied AI Action

### ${title}

Goal: make the demo sharper for executives.

- Lead with: ${metadata.demo_goal || "the business outcome and why it matters now"}.
- Emphasize: ${(winning.winning_moments || []).slice(0, 3).join(", ") || "executive visibility, risk reduction, cash confidence, and trusted reporting"}.
- Avoid: ${(avoid.avoid_showing || []).slice(0, 5).join(", ") || "setup detail, configuration walkthroughs, and long navigation"}.
- Keep language around KPIs, risk, time-to-decision, confidence in numbers, and operational control.
- Add one explicit close: "Based on what we proved, which outcome would matter most to validate next?"
`;
  }

  if (mode === "technical") {
    return `## Applied AI Action

### ${title}

Goal: rebuild the same story for IT, administrators, and technical stakeholders without losing the business context.

- Add technical validation around: permissions, auditability, integrations, data flow, reporting controls, and environment readiness.
- Clarify discovery: ${(discovery.missing_discovery_items || []).slice(0, 5).join(", ") || "current systems, integrations, data migration, security, and constraints"}.
- Keep business anchor: every technical proof should explain what risk or operational friction it reduces.
- Be transparent: do not invent implementation or competitor claims.
- Stakeholder check: ${stakeholder.recommendation || "confirm which technical stakeholders can sponsor or block the next step"}.
`;
  }

  return `## Applied AI Action

### ${title}

Instruction to apply:

${String(instruction || "No custom instruction was provided.").trim()}

Context to preserve:

- Customer/demo: ${metadata.customer_name || "current demo"}
- Strategy: ${metadata.strategy || "-"}
- Audience: ${metadata.audience_type || "-"} / ${metadata.target_segment || "-"}
- Key risks: ${(risk.warnings || []).slice(0, 3).join("; ") || "none detected"}
- Winning moments: ${(winning.winning_moments || []).slice(0, 3).join("; ") || "none detected"}
`;
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

async function codexDiscoveryFollowUpQuestions(manifest, guide, intelligence, options = {}) {
  const company = manifest.context?.company || {};
  const sessionTitle = `created by demo helper - ${company.companyName || websiteNameSlug(company.url) || "customer"}`;
  const prompt = codexDiscoveryPrompt(manifest, guide, intelligence, sessionTitle, options);
  const result = await runCachedCodexOperator({
    cachePrefix: "discovery-follow-up-questions",
    cacheVersion: "codex-discovery-followups-v1",
    cacheParts: {
      manifestContext: manifest.context || {},
      guide: stableGuideForCodexCache(guide),
      intelligence,
      additionalComments: options.additionalComments || ""
    },
    prompt,
    sessionTitle,
    fileStem: `${companyFileSlug(manifest)}-discovery-follow-up-questions`,
    timeoutMs: 240000
  });
  if (!result.ok) {
    throw new Error(`Codex discovery operator failed: ${result.error || "No output returned"}`);
  }
  const questions = result.output?.trim();
  if (!questions) throw new Error("Codex discovery operator did not return follow-up questions.");
  return {
    questions,
    operator: "codex-background-operator",
    sessionTitle,
    promptFile: result.promptFile,
    outputFile: result.outputFile,
    codexLog: result.log,
    codexError: ""
  };
}

async function codexPrepOperatorAnalysis(manifest, body, company) {
  const sessionTitle = `created by demo helper - ${company.companyName || websiteNameSlug(company.url) || "customer"}`;
  const prompt = codexPrepPrompt(manifest, body, company, sessionTitle);
  const result = await runCachedCodexOperator({
    cachePrefix: "prep-analysis",
    cacheVersion: "codex-prep-analysis-v1",
    cacheParts: {
      manifestContext: manifest.context || {},
      manifestName: manifest.name || "",
      body,
      company,
      adminSources: additionalDemoSources
    },
    prompt,
    sessionTitle,
    fileStem: `${companyFileSlug(company)}-prep-analysis`,
    timeoutMs: 240000
  });
  return {
    ok: result.ok,
    analysis: result.output?.trim() || `Codex prep operator did not return analysis.${result.error ? ` Error: ${result.error}` : ""}`,
    promptFile: result.promptFile,
    outputFile: result.outputFile,
    sessionTitle,
    error: result.error || ""
  };
}

async function codexScGuideOperator(manifest, body, company, localDraft) {
  const sessionTitle = `created by demo helper - ${company.companyName || websiteNameSlug(company.url) || "customer"} - SC guide`;
  const prompt = codexScGuidePrompt(manifest, body, company, localDraft, sessionTitle);
  return runCachedCodexOperator({
    cachePrefix: "sc-guide",
    cacheVersion: "codex-sc-guide-v1",
    cacheParts: {
      manifestContext: manifest.context || {},
      segments: manifest.segments || [],
      body,
      company,
      localDraft,
      guidance: {
        liveDemoFunctionality: liveDemoFunctionalityEnabled,
        scStoryRunbookGuidance: scStoryRunbookGuidance(),
        demoAssetPromptGuidance: demoAssetPromptGuidance(),
        codexAccountSetupGuidance: codexAccountSetupGuidance(),
        dryRunCreationGuidance: dryRunCreationGuidance()
      }
    },
    prompt,
    sessionTitle,
    fileStem: `${companyFileSlug(company)}-sc-guide`,
    timeoutMs: 300000
  });
}

async function codexScGuideRevisionOperator(manifest, currentGuide, intelligence, options = {}) {
  const company = manifest.context?.company || {};
  const sessionTitle = `created by demo helper - ${company.companyName || websiteNameSlug(company.url) || "customer"} - ${options.label || "SC guide revision"}`;
  const prompt = codexScGuideRevisionPrompt(manifest, currentGuide, intelligence, options, sessionTitle);
  return runCachedCodexOperator({
    cachePrefix: "sc-guide-revision",
    cacheVersion: "codex-sc-guide-revision-v1",
    cacheParts: {
      manifestContext: manifest.context || {},
      currentGuide: stableGuideForCodexCache(currentGuide),
      intelligence,
      options: {
        liveDemoFunctionality: liveDemoFunctionalityEnabled,
        mode: options.mode || "custom",
        label: options.label || "",
        instruction: options.instruction || "",
        localDraft: stableGuideForCodexCache(options.localDraft || "")
      }
    },
    prompt,
    sessionTitle,
    fileStem: `${companyFileSlug(manifest)}-${options.mode || "guide-revision"}`,
    timeoutMs: 300000
  });
}

function normalizeCodexScGuide(output, localDraft, operator) {
  const guide = String(output || "").trim();
  const requiredSections = [
    "## Personalized Demo Story And Runbook",
    "## Demo Asset Generation Prompt",
    "## NetSuite Prep Summary"
  ];
  const hasRequiredSections = requiredSections.every((section) => guide.includes(section));
  if (!guide || !hasRequiredSections) {
    throw new Error("Codex SC guide output did not include the required SC guide sections.");
  }
  const operatorNote = [
    "## Codex Backbone",
    "",
    `- Operator: codex-background-operator`,
    `- Task: ${operator.sessionTitle || "created by demo helper"}`,
    operator.promptFile ? `- Prompt file: ${operator.promptFile}` : "",
    operator.outputFile ? `- Output file: ${operator.outputFile}` : "",
    "- Local templates were used only as structure and formatting guardrails; Codex authored the SC guide content from the prep inputs."
  ].filter(Boolean).join("\n");
  return `${guide}\n\n${operatorNote}\n`;
}

function codexDiscoveryPrompt(manifest, guide, intelligence, sessionTitle, options = {}) {
  const company = manifest.context?.company || {};
  const metadata = intelligence.demo_metadata || {};
  const discovery = intelligence.discovery_gap_analyzer || {};
  const notes = intelligence.pre_demo_notes_analyzer || {};
  const risk = intelligence.demo_risk_analyzer || {};
  const demoHeatmap = intelligence.demo_heatmap_analyzer || {};
  const source = manifest.context || {};
  const request = source.demoRequest || {};
  const additionalComments = String(options.additionalComments || "").trim();
  return `Task title: ${sessionTitle}

You are a senior NetSuite Solution Consultant and demo strategist. Your job is to review the company website context, demo request, demo scope, SC instructions, pre-demo notes, current generated SC guide, and existing intelligence signals, then create truly useful discovery follow-up questions.

Use web/search if available to check the company website and business context. Do not invent facts or competitor claims. If website information is unavailable, say so and rely on the supplied notes.

The goal is NOT generic discovery. The goal is to identify what is truly missing before an SC can create and deliver a strong, tailored demo for this exact company.

Company and demo context:
- Customer/company: ${company.companyName || metadata.customer_name || "Unknown"}
- Website: ${company.url || "Not provided"}
- Website title/description: ${company.title || ""} ${company.description || ""}
- Audience type: ${metadata.audience_type || source.audience?.label || request.audience || "Not selected"}
- Target segment: ${metadata.target_segment || source.targetAudience?.label || request.marketSegment || "Not selected"}
- Demo strategy: ${metadata.strategy || source.demoStrategy?.label || request.demoStrategy || "Not selected"}
- Industry: ${metadata.industry || source.industry?.label || request.industry || "Not selected"}
- Demo input mode: ${request.inputMode || "request-and-notes"}
- Demo request: ${request.topic || "Not provided"}
- Demo scope: ${source.demoScope || request.demoScope || "Not provided"}

SC instructions:
${request.instructions || defaultScInstructions()}

Pre-demo notes:
${source.preDemoNotes || "No pre-demo notes were provided."}

Additional SC comments for this question generation:
${additionalComments || "No additional SC comments were provided."}

Current intelligence:
- Missing discovery items: ${(discovery.missing_discovery_items || []).join(", ") || "None detected"}
- Notes risk areas: ${(notes.risk_areas || []).join(", ") || "None detected"}
- Demo risks: ${(risk.warnings || []).join("; ") || "None detected"}
- Demo improvement areas: ${(demoHeatmap.needs_work_areas || []).join(", ") || "None detected"}

Current SC guide excerpt:
${String(guide || "").slice(0, 9000)}

Output format:
# Codex Discovery Follow-Up Questions
Task title: ${sessionTitle}

## What Is Already Clear
- 3 to 6 bullets based only on supplied evidence.

## Most Important Missing Context
- 5 to 8 bullets. Be specific and explain why each gap matters for demo design.

## Questions To Ask Before The Demo
Create 10 to 14 questions. Each question must be specific to this company, this audience, the website context, the notes, and the selected demo strategy.

Use this exact format for each:
1. [Priority: High/Medium] Question?
   - Why it matters:
   - Demo impact:

## Do Not Ask Again
- List any topics that are already sufficiently answered in the notes.

Rules:
- Avoid generic questions unless the missing context is genuinely generic.
- Do not ask about things already answered in the notes.
- Prefer questions that change the demo story, scope, navigation path, account setup, stakeholder emphasis, or proof moments.
- Keep it practical for an SC preparing a NetSuite demo.`;
}

function codexPrepPrompt(manifest, body, company, sessionTitle) {
  return `Task title: ${sessionTitle}

You are the background Codex prep operator for NetSuite Demo Helper. Act like a senior Solution Consultant preparing a customer-specific NetSuite demo.

Use web/search if available to check the company website and business context. Do not invent unsupported facts. Use the website only to infer business model, likely operating pressures, stakeholder priorities, and ERP-demo implications.

Company:
- Name: ${company.companyName || "Unknown"}
- Website: ${company.url || body.companyUrl || "Not provided"}
- Website title/description: ${company.title || ""} ${company.description || ""}

Prep inputs from the main page:
- Demo request: ${body.topic || "Not provided"}
- Demo input mode: ${body.inputMode || "request-and-notes"}
- Demo scope: ${body.demoScope || "Not provided"}
- Audience type: ${body.audience || "Not selected"}
- Target audience: ${body.marketSegment || "Not selected"}
- Demo strategy: ${body.demoStrategy || body.strategy || "Not selected"}
- Industry: ${body.industry || "Not selected"}
- Output language: ${body.outputLanguage || "en"}
- Manifest option: ${body.manifestDemoMode || body.demoMode || "Not selected"}
- Value intensity: ${body.valueIntensity || "balanced"}

SC instructions:
${body.instructions || defaultScInstructions()}

Pre-demo notes:
${body.preDemoNotes || "No pre-demo notes were provided."}

Existing manifest context:
${JSON.stringify({
    name: manifest.name,
    audience: manifest.audience,
    existingDemoRequest: manifest.context?.demoRequest?.topic,
    existingScope: manifest.context?.demoScope,
    existingCompany: manifest.context?.company?.companyName
  }, null, 2)}

Output format:
# Codex Prep Operator Analysis
Task title: ${sessionTitle}

## Company Context That Should Shape The Demo
- 4 to 7 bullets.

## Likely ERP Priorities
- 5 to 8 bullets, ordered from highest demo value to lowest.

## Recommended Demo Direction
- Explain the optimal demo story, starting with executive/platform overview and then highest-value proof moments.

## Scope And Account Prep Implications
- Note what may need to exist in NetSuite for the demo to work.

## Discovery Gaps That Could Hurt The Demo
- List the gaps that must be clarified before the SC can confidently tailor the demo.

Rules:
- Keep it practical and SC-focused.
- Do not create a final demo script here.
- Do not invent product capabilities or competitor claims.
- Use the selected audience, target segment, strategy, scope, and notes as hard inputs.`;
}

function codexScGuidePrompt(manifest, body, company, localDraft, sessionTitle) {
  const dryRunInstruction = liveDemoFunctionalityEnabled
    ? `Dry-Run Creation Prompt:
Do not output this section in the SC guide. The app generates it afterward from the completed story/runbook using the admin-owned Dry-Run Creation Prompt Logic.`
    : `Live demo functionality is currently switched off in Admin. Do not plan for browser dry-runs, live narration, dataset analysis, or dry-run creation prompts. Focus the SC guide on prep, story, setup guidance, assets, and intelligence-ready content.`;
  const dryRunSequenceRule = liveDemoFunctionalityEnabled
    ? `4. Do not output a "Dry-Run Creation Prompt" section. The helper generates that afterward from the completed story/runbook and the admin dry-run logic.`
    : `4. Do not output or reference a "Dry-Run Creation Prompt" section. Live demo functionality is disabled.`;
  return `Task title: ${sessionTitle}

You are the Codex backbone for NetSuite Demo Helper. Create the SC guide content for this demo. Act like a senior NetSuite Solution Consultant with 10+ years of experience.

This is not a generic AI writing task. Use all prep inputs, the website/company context, SC instructions, audience configuration, target segment, demo strategy, industry, demo scope, admin sources, Codex prep analysis, and the local structural draft below.

Rules:
- Use the local draft only as a structure and formatting guardrail. Do not blindly copy it.
- Make the story practical for an SC preparing and delivering a demo.
- Start with a general/executive NetSuite overview, then order proof moments from highest business impact to supporting detail.
- Stay inside the demo scope.
- Use standard NetSuite reports and standard navigation for prospect-facing finance demos unless the notes explicitly require otherwise.
- Do not invent NetSuite capabilities, competitor claims, or customer facts.
- Preserve NetSuite UI labels and product names.
- Do not use the phrase "value statement" in narrator-facing text.
- Keep the output in ${normalizeOutputLanguage(body.outputLanguage || manifest.context?.outputLanguage?.value || "en").label}.

Admin-owned output section logic:

Personalized Demo Story And Runbook:
${scStoryRunbookGuidance()}

Demo Asset Generation Prompt (derive only after the story/runbook is complete):
${demoAssetPromptGuidance()}

NetSuite Prep Summary (derive only after the story/runbook is complete; the app turns this into the Prompt For Codex Account Setup afterward):
${codexAccountSetupGuidance()}

${dryRunInstruction}

Company context:
${JSON.stringify(company || {}, null, 2)}

Main-page inputs:
${JSON.stringify({
    demoRequest: body.topic || manifest.context?.demoRequest?.topic,
    inputMode: body.inputMode || manifest.context?.demoRequest?.inputMode,
    demoScope: body.demoScope || manifest.context?.demoScope,
    competition: body.competition || manifest.context?.competition || manifest.context?.demoRequest?.competition,
    audience: body.audience || manifest.context?.audience?.value,
    marketSegment: body.marketSegment || manifest.context?.marketSegment?.value,
    demoStrategy: body.demoStrategy || manifest.context?.demoStrategy?.id,
    industry: body.industry || manifest.context?.industry?.id,
    manifestDemoMode: body.manifestDemoMode || manifest.context?.manifestDemoMode?.id,
    outputLanguage: body.outputLanguage || manifest.context?.outputLanguage?.value,
    valueIntensity: body.valueIntensity || manifest.defaults?.valueStatementIntensity,
    instructions: body.instructions || manifest.context?.demoRequest?.instructions,
    preDemoNotes: body.preDemoNotes || manifest.context?.preDemoNotes
  }, null, 2)}

Codex prep operator analysis:
${company.codexPrepAnalysis?.analysis || manifest.context?.codexPrepAnalysis?.analysis || "No Codex prep analysis available."}

Current manifest segments:
${JSON.stringify((manifest.segments || []).map((segment) => ({
    id: segment.id,
    title: segment.title,
    objective: segment.objective,
    valueStatement: segment.valueStatement,
    narration: segment.narration,
    actions: (segment.actions || []).map((action) => ({
      type: action.type,
      query: action.query,
      text: action.text,
      url: action.url
    }))
  })), null, 2)}

Local structural draft:
${localDraft}

Output exactly as Markdown with these sections:
# SC Demo Guide: ${company.companyName || manifest.context?.company?.companyName || "The prospect"}

## Demo Thesis
## Audience Angle
## Additional Admin Sources And Logic Considered
## Codex Prep Operator Analysis
## Personalized Demo Story And Runbook
## Tips And Tricks For The SC
## Company Context
## Pre-Demo Notes
## Demo Asset Generation Prompt
## NetSuite Prep Summary
## Discovery Hooks During The Demo
## SC Instructions Used By The Generator

The "Personalized Demo Story And Runbook" section must contain:
- Story arc
- Exact runbook
- Demo prep rules
- Closing move

Sequence matters:
1. First complete the "Personalized Demo Story And Runbook" section.
2. Then derive the "Demo Asset Generation Prompt" from that completed story/runbook.
3. Then derive the "NetSuite Prep Summary" from that completed story/runbook.
${dryRunSequenceRule}

The "Demo Asset Generation Prompt" section must create an asset/PPT prompt aligned with the completed personalized SC story, bringing personas to life without becoming a detailed requirements document.

The "NetSuite Prep Summary" section must be derived from the completed story/runbook and Codex-account-setup ready. Include:
- target account and role if known
- checks the SC should perform before rehearsal
- setup items that may need to exist
- explicit read-only/no-create guidance when no setup is needed
- confirmation requirements before Codex creates or edits anything
- a clear split between safe checks and write actions.`;
}

function codexScGuideRevisionPrompt(manifest, currentGuide, intelligence, options, sessionTitle) {
  const company = manifest.context?.company || {};
  const localDraft = options.localDraft || currentGuide;
  const dryRunRevisionRule = liveDemoFunctionalityEnabled
    ? `- Do not add a "Dry-Run Creation Prompt" section. The helper generates that afterward from the completed story/runbook and admin dry-run logic.`
    : `- Do not add or reference a "Dry-Run Creation Prompt" section. Live demo functionality is disabled, so keep the guide focused on prep, story, assets, setup guidance, and intelligence-ready content.`;
  return `Task title: ${sessionTitle}

You are the Codex backbone for NetSuite Demo Helper. Revise the SC guide using the selected AI action and the current Demo Intelligence. Act like a senior NetSuite Solution Consultant with 10+ years of experience.

This must be a real SC guide rewrite, not a generic appendix. Use the local draft only as a structure and formatting guardrail. The final output should be the complete updated SC guide.

Selected action:
${JSON.stringify({
    mode: options.mode || "custom",
    label: options.label || "Custom Additional SC Guide Instruction",
    instruction: options.instruction || ""
  }, null, 2)}

Company and demo context:
${JSON.stringify({
    company,
    demoRequest: manifest.context?.demoRequest,
    demoScope: manifest.context?.demoScope,
    audience: manifest.context?.audience,
    marketSegment: manifest.context?.marketSegment || manifest.context?.targetAudience,
    demoStrategy: manifest.context?.demoStrategy,
    industry: manifest.context?.industry,
    outputLanguage: manifest.context?.outputLanguage || manifest.defaults?.outputLanguage
  }, null, 2)}

Current Demo Intelligence:
${JSON.stringify({
    demo_metadata: intelligence.demo_metadata,
    codex_intelligence_operator: intelligence.codex_intelligence_operator,
    demo_risk_analyzer: intelligence.demo_risk_analyzer,
    discovery_gap_analyzer: intelligence.discovery_gap_analyzer,
    pre_demo_notes_analyzer: intelligence.pre_demo_notes_analyzer,
    stakeholder_coverage_analyzer: intelligence.stakeholder_coverage_analyzer,
    winning_moment_detection: intelligence.winning_moment_detection,
    what_not_to_demo_engine: intelligence.what_not_to_demo_engine,
    demo_timing_pacing_analyzer: intelligence.demo_timing_pacing_analyzer,
    ai_rehearsal_coach: intelligence.ai_rehearsal_coach,
    demo_heatmap_analyzer: intelligence.demo_heatmap_analyzer
  }, null, 2).slice(0, 16000)}

Current SC guide:
${String(currentGuide || "").slice(0, 18000)}

Local structural draft for the selected action:
${String(localDraft || "").slice(0, 18000)}

Output exactly as Markdown with these sections:
# SC Demo Guide: ${company.companyName || manifest.context?.company?.companyName || "The prospect"}

## Demo Thesis
## Audience Angle
## Additional Admin Sources And Logic Considered
## Codex Prep Operator Analysis
## Personalized Demo Story And Runbook
## Tips And Tricks For The SC
## Company Context
## Pre-Demo Notes
## Demo Asset Generation Prompt
## NetSuite Prep Summary
## Discovery Hooks During The Demo
## SC Instructions Used By The Generator

Rules:
- Preserve the required sections exactly.
- Apply the selected action directly inside the SC guide where it improves the story, runbook, coaching, or prep.
- First revise the "Personalized Demo Story And Runbook", then derive "Demo Asset Generation Prompt" and "NetSuite Prep Summary" from that revised story.
- Keep the "NetSuite Prep Summary" Codex-account-setup ready with target account/role, rehearsal checks, possible setup items, read-only guidance, and confirmation requirements before any write action.
${dryRunRevisionRule}
- If the action is follow-up questions, keep them as discovery hooks and do not pretend they are proven customer facts.
- If the action is shorten demo, compress the live flow while preserving the strongest proof moments.
- If the action is executive demo, reduce click/detail density and increase outcome, risk, KPI, and decision language.
- If the action is technical-audience demo, add IT validation points without losing the business anchor.
- If the action is custom, apply the custom instruction to the relevant guide sections.
- Start with a general/executive NetSuite overview, then order proof moments from highest business impact to supporting detail.
- Stay inside the demo scope.
- Use standard NetSuite reports and standard navigation unless the notes explicitly require otherwise.
- Do not invent NetSuite capabilities, competitor claims, or customer facts.
- Do not use the phrase "value statement" in narrator-facing text.`;
}

function followUpQuestionsFromIntelligence(intelligence) {
  const metadata = intelligence.demo_metadata || {};
  const discovery = intelligence.discovery_gap_analyzer || {};
  const notes = intelligence.pre_demo_notes_analyzer || {};
  const demoHeatmap = intelligence.demo_heatmap_analyzer || {};
  const risk = intelligence.demo_risk_analyzer || {};
  const context = demoQuestionContext(metadata);
  const questions = dedupeFollowUpQuestions(uniqueItems([
    ...(discovery.missing_discovery_items || []).slice(0, 6).map((item) => followUpQuestionForDiscoveryItem(item, context)),
    ...(discovery.recommended_follow_up_questions || []).slice(0, 4).map((question) => contextualizeFollowUpQuestion(question, context)),
    ...(notes.risk_areas || []).slice(0, 4).map((area) => contextualizeFollowUpQuestion(followUpQuestionForRiskArea(area), context)),
    ...(demoHeatmap.needs_work_areas || []).slice(0, 4).map((area) => `For ${context.customer}, what proof point, metric, or stakeholder quote would strengthen ${String(area || "this area").toLowerCase()} in the ${context.strategy} story?`),
    ...(risk.warnings || []).slice(0, 3).map((warning) => {
      const cleanWarning = String(warning || "").replace(/[?.!]+$/, "");
      return `For ${context.customer}, what should we confirm before the demo so this risk is controlled: ${cleanWarning}?`;
    })
  ])).filter(Boolean);

  return questions.length
    ? questions.slice(0, 12).map((question, index) => `${index + 1}. ${question}`).join("\n")
    : `1. For ${context.customer}, what is the single outcome the ${context.audienceLabel} audience must believe after the demo?\n2. Which stakeholder has the most influence over the next step, and what does that person need to see first?\n3. What current-system pain should the opening story make visible in the ${context.strategy} flow?`;
}

function demoQuestionContext(metadata = {}) {
  return {
    customer: metadata.customer_name || "this customer",
    audienceLabel: [metadata.audience_type, metadata.target_segment].filter(Boolean).join(" / ") || "selected",
    strategy: metadata.strategy || "selected demo",
    industry: metadata.industry || "selected industry",
    demoGoal: metadata.demo_goal || metadata.demo_scope || "the demo goal"
  };
}

function contextualizeFollowUpQuestion(question, context) {
  const clean = String(question || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.toLowerCase().includes(context.customer.toLowerCase())) return clean;
  const lower = clean.toLowerCase();
  if (/compar|alternative|shortlist|vendor/.test(lower)) {
    return `What alternatives is ${context.customer} comparing against, and which proof moment should make NetSuite feel like the lower-risk choice for the ${context.audienceLabel} audience?`;
  }
  if (/stakeholder|attend|role|person/.test(lower)) {
    return `For ${context.customer}, which stakeholders will attend, what does each need to believe, and who needs the first proof moment?`;
  }
  if (/success|measure|metric|kpi|outcome/.test(lower)) {
    return `For ${context.customer}, which success metric should the ${context.strategy} prove most clearly?`;
  }
  return `${clean.replace(/\?$/, "")}? Answer this specifically for ${context.customer}, the ${context.strategy}, and the ${context.audienceLabel} audience.`;
}

function dedupeFollowUpQuestions(questions = []) {
  const seen = new Set();
  return (questions || []).filter((question) => {
    const clean = String(question || "").trim();
    if (!clean) return false;
    const lower = clean.toLowerCase();
    const key =
      /compar|alternative|shortlist|vendor/.test(lower) ? "competitive-context" :
      /stakeholder|attend|role|decision influencer|sponsor/.test(lower) ? "stakeholder-context" :
      /success|metric|kpi|outcome|roi/.test(lower) ? "success-context" :
      /current system|systems|spreadsheet|workaround/.test(lower) ? "current-systems" :
      /business pain|urgent|challenge|driver/.test(lower) ? "business-pain" :
      /timeline|go-live|audit date|board expectation/.test(lower) ? "timeline" :
      /integration|data flow|security|reporting dependencies/.test(lower) ? "technical-context" :
      lower.replace(/[^a-z0-9]+/g, " ").trim().slice(0, 90);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function followUpQuestionForDiscoveryItem(item, context) {
  const clean = String(item || "").trim();
  const lower = clean.toLowerCase();

  if (/current|erp|system|solution|tool/.test(lower)) {
    return `For ${context.customer}, which current systems, spreadsheets, or workarounds are used today, and where does the process break first?`;
  }
  if (/pain|challenge|driver|problem/.test(lower)) {
    return `For ${context.customer}, which business pain should the opening story make visible, and what would make it urgent for the ${context.audienceLabel} audience?`;
  }
  if (/executive|sponsor|stakeholder|role/.test(lower)) {
    return `Who is the executive sponsor or strongest decision influencer at ${context.customer}, and what should they hear in the first 10 minutes?`;
  }
  if (/success|metric|kpi|outcome|roi/.test(lower)) {
    return `Which success metric should the ${context.strategy} prove for ${context.customer}: time saved, risk reduced, faster close, margin control, or another KPI?`;
  }
  if (/timeline|urgency|date|go-live|implementation/.test(lower)) {
    return `What timeline, go-live pressure, audit date, expansion plan, or board expectation makes this project urgent for ${context.customer}?`;
  }
  if (/technical|integration|api|architecture|security|data/.test(lower)) {
    return `Which integrations, data flows, security constraints, or reporting dependencies must the demo acknowledge for ${context.customer}?`;
  }
  if (/competitive|decision|vendor|shortlist/.test(lower)) {
    return `What alternatives is ${context.customer} comparing against, and which proof moment should make NetSuite feel like the lower-risk choice?`;
  }
  if (/scope|phase|module/.test(lower)) {
    return `What is definitely in scope for ${context.customer}'s first demo, what belongs in phase 2, and what should stay in Q&A?`;
  }
  return `For ${context.customer}, what specific detail is missing for "${clean}", and how should that change the ${context.strategy} story?`;
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

function dryRunPromptHash(prompt) {
  return createHash("sha256").update(String(prompt || "")).digest("hex").slice(0, 16);
}

function dryRunPromptInfo(manifest, guide = "") {
  const context = guideContextFromManifest(manifest);
  const storyRunbook = markdownSection(guide, "Personalized Demo Story And Runbook");
  const prompt = dryRunCreationPromptText(manifest, guide, context);
  const promptHash = dryRunPromptHash(prompt);
  const metadata = manifest.context?.dryRunCreationPrompt || {};
  const promptIsCurrent = Boolean(metadata.createdAt && metadata.promptHash === promptHash);
  return {
    prompt,
    promptHash,
    source: storyRunbook ? "system-generated-from-sc-story-runbook" : "local-dry-run-manifest-instruction",
    createdAt: promptIsCurrent ? metadata.createdAt : "",
    previousCreatedAt: metadata.createdAt || "",
    promptIsCurrent
  };
}

function refreshDryRunPromptMetadata(manifest, guide = "", options = {}) {
  const next = structuredClone(manifest);
  const info = dryRunPromptInfo(next, guide);
  const now = options.createdAt || new Date().toISOString();
  next.context = next.context || {};
  next.context.dryRunCreationPrompt = {
    createdAt: now,
    updatedAt: now,
    source: info.source,
    promptHash: info.promptHash,
    status: "ready",
    instruction: "This timestamp confirms when the SC Guide tab's dry-run creation prompt was last prepared for manifest generation."
  };
  return next;
}

function markManifestGuideOnly(manifest, guide = "") {
  const next = guide && liveDemoFunctionalityEnabled ? refreshDryRunPromptMetadata(manifest, guide) : structuredClone(manifest);
  next.context = next.context || {};
  next.context.manifestBuild = {
    status: "guide-ready-manifest-not-built",
    source: liveDemoFunctionalityEnabled ? "dry-run-creation-prompt" : "sc-guide-only",
    createdFromGuide: false,
    updatedAt: new Date().toISOString(),
    instruction: liveDemoFunctionalityEnabled
      ? "The SC guide and dry-run creation prompt have been generated. Create the runnable manifest from that prompt before relying on the Dry-Run tab or browser rehearsal."
      : "Live demo functionality is switched off. The SC guide and intelligence outputs are ready; no dry-run creation prompt or runnable manifest is generated."
  };
  return next;
}

function applyDryRunCreationPromptToRunnableManifest(manifest, guide, options = {}) {
  const base = dryRunPromptInfo(manifest, guide).promptIsCurrent
    ? structuredClone(manifest)
    : refreshDryRunPromptMetadata(manifest, guide);
  const next = structuredClone(base);
  const audience = normalizeAudience(next.context?.audience?.value || next.context?.demoRequest?.audience || next.audience);
  const marketSegment = normalizeMarketSegment(next.context?.targetAudience?.value || next.context?.marketSegment?.value || next.context?.demoRequest?.targetAudience || next.context?.demoRequest?.marketSegment);
  const demoStrategy = normalizeDemoStrategy(next.context?.demoStrategy?.id || next.context?.demoRequest?.demoStrategy || next.defaults?.demoStrategy);
  const industry = normalizeIndustry(next.context?.industry?.id || next.context?.demoRequest?.industry || next.defaults?.industry);
  const demoScope = String(next.context?.demoScope || next.context?.demoRequest?.demoScope || "").trim();
  const manifestDemoMode = normalizeManifestDemoMode(next.context?.manifestDemoMode?.id || next.context?.demoRequest?.manifestDemoMode || next.defaults?.manifestDemoMode);
  const flowPrinciples = next.context?.demoPrep || demoFlowPrinciples({ demoScope, audience, marketSegment, demoStrategy, industry });
  const company = next.context?.company || {};
  const dryRunPrompt = dryRunPromptInfo(next, guide);
  next.segments = (next.segments || []).map((segment) => applyRunbookToSegment(segment, dryRunPrompt.prompt));
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
    source: "dry-run-creation-prompt",
    createdFromGuide: true,
    createdFromDryRunPrompt: true,
    dryRunPromptCreatedAt: next.context.dryRunCreationPrompt?.createdAt || "",
    runSource: options.runSource || "manual",
    updatedAt: new Date().toISOString(),
    instruction: "This manifest was refreshed from the SC Guide tab's dry-run creation prompt and is ready for browser dry-run or rehearsal."
  };
  return next;
}

function applyGuideToRunnableManifest(manifest, guide) {
  return applyDryRunCreationPromptToRunnableManifest(manifest, guide, { runSource: "legacy-wrapper" });
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
  const includeCash360 = hasCash360Segments(segments) || cash360RequestedFromText(manifest.context?.demoRequest?.topic, notes, demoScope);
  const codexPrepAnalysis = manifest.context?.codexPrepAnalysis?.analysis || company.codexPrepAnalysis?.analysis || "";
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
    flowPrinciples,
    includeCash360
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
    flowPrinciples,
    includeCash360
  });

  return `# SC Demo Guide: ${companyName}

## Demo Thesis

Show how NetSuite helps ${companyName} move from trusted standard reporting into ${includeCash360 ? "cash visibility, " : ""}drilldown, controlled sharing, and action. Lead with the outcomes most likely to matter: ${joinHuman(priorities.slice(0, 4)) || "visibility, control, and speed"}.

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

## Codex Prep Operator Analysis

${codexPrepAnalysis || "Codex prep analysis has not been run for this demo yet."}

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
- Likely priorities: ${priorities.join(", ") || "trusted reporting, drilldown, controlled sharing"}
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
${includeCash360 ? '- "How often does cash forecasting live outside the ERP?"\n- "Which view would your CFO want first: consolidated performance, entity-level detail, or working capital?"' : '- "Which view would your CFO want first: consolidated performance, entity-level detail, or process control?"\n- "Where does the team lose the most time moving from report insight to action?"'}

## SC Instructions Used By The Generator

${instructions
  .split("\n")
  .map((line) => `- ${line.trim()}`)
  .join("\n")}
`;
}

function guideOutputsPayload(manifest, guide = "") {
  const context = guideContextFromManifest(manifest);
  const setupPayload = setupPromptPayload(manifest, guide);
  const setupPrompt = setupPayload.prompt;
  const codexRunbook = markdownSection(guide, "Personalized Demo Story And Runbook");
  const codexAssetPrompt = markdownSection(guide, "Demo Asset Generation Prompt");
  const scRunbook = codexRunbook || scStoryRunbookText(context);
  const assetPrompt = codexAssetPrompt || demoAssetPromptText(context);
  const dryRunPrompt = liveDemoFunctionalityEnabled ? dryRunPromptInfo(manifest, guide) : null;
  return {
    liveDemoFunctionality: liveDemoFunctionalityEnabled,
    scRunbook,
    scRunbookSource: codexRunbook ? "codex-sc-guide-section" : "local-fallback",
    assetGenerationPrompt: assetPrompt,
    assetGenerationPromptSource: codexAssetPrompt ? "codex-sc-guide-section" : "local-fallback",
    dryRunCreationPrompt: dryRunPrompt?.prompt || "",
    dryRunCreationPromptSource: dryRunPrompt?.source || "live-demo-functionality-disabled",
    dryRunCreationPromptCreatedAt: dryRunPrompt?.createdAt || "",
    dryRunCreationPromptPreviousCreatedAt: dryRunPrompt?.previousCreatedAt || "",
    dryRunCreationPromptIsCurrent: Boolean(dryRunPrompt?.promptIsCurrent),
    dryRunCreationPromptHash: dryRunPrompt?.promptHash || "",
    personalizedExperienceFlow: scRunbook,
    normalDemoFlow: scRunbook,
    customizationPrompts: markdownSection(guide, "Customization Prompts For NetSuite") || setupPrompt,
    customizationPromptsSource: markdownSection(guide, "Customization Prompts For NetSuite")
      ? "codex-sc-guide-section"
      : setupPayload.promptSource
  };
}

function dryRunCreationPromptText(manifest, guide = "", context = guideContextFromManifest(manifest)) {
  const runbook = markdownSection(guide, "Personalized Demo Story And Runbook") || context.demoRequest || "Use the current SC guide as the source story.";
  const setupSummary = markdownSection(guide, "NetSuite Prep Summary") || markdownSection(guide, "Prompt For Codex Account Setup") || "No explicit setup summary was generated.";
  const companyName = context.companyName || manifest.name || "the target customer";
  const segmentTitles = (manifest.segments || []).map((segment, index) => `${index + 1}. ${segment.title || segment.id}`).slice(0, 12).join("\n");
  return `Create the browser dry-run manifest for NetSuite Demo Helper.

Source:
- This prompt is generated after the Personalized Demo Story And Runbook has been completed.
- Use the completed story/runbook as the source of truth for browser navigation, narration, proof moments, and verification.
- The setup summary is supporting context only and should not override the story without SC confirmation.

Purpose:
- Convert the SC guide into a repeatable browser dry-run click-through.
- The output should be a runnable manifest, not a new SC guide.
- Use the dry-run for rehearsal, buffering, and live-demo preparation.

Customer and scope:
- Customer: ${companyName}
- Audience: ${context.audience.label}
- Target segment: ${context.marketSegment.label}
- Demo strategy: ${context.demoStrategy.label}
- Industry: ${context.industry.label}
- Demo scope: ${context.demoScope || "Use only the scope in the SC guide and pre-demo notes."}
- Manifest mode: ${context.manifestDemoMode.label}
- Language: ${context.outputLanguage.label}

Navigation rules:
- Prefer the NetSuite navigation bar and global search for moving between areas.
- Prefer standard NetSuite reports, dashboards, centers, lists, and pages.
- Avoid custom reports unless the SC guide explicitly says they are required.
- Keep paths short and natural; remove wandering clicks and low-value transitions.
- Do not create or edit records during the dry-run unless an approved setup prompt has already prepared the account.

Admin dry-run guidance:
${dryRunCreationGuidance()}

Manifest requirements:
- Start with a general or executive NetSuite overview when the guide supports it.
- Order steps from highest business proof to lowest supporting detail.
- Include segment title, objective, narration, value moment, and expected verification text.
- Add safe waits and verification checks after navigation.
- Include export, drilldown, filter, or report interaction steps only when they support the SC story.
- Keep narration aligned to the selected voice and language, but do not prefix business statements with the word "value".
- Mark any uncertain selectors or pages as rehearsal risks for the SC to validate.

SC guide source:
${runbook}

Setup awareness:
${setupSummary}

Existing manifest segments to preserve or improve:
${segmentTitles || "No existing segment titles detected. Build from the SC guide."}

Return only the updated dry-run manifest JSON that the helper can save and run.`;
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

function scStoryRunbookText({ companyName, audience, marketSegment, playbook, priorities, segments, outputLanguage, manifestDemoMode, demoStrategy, industry, demoScope, flowPrinciples, includeCash360 }) {
  const mode = normalizeManifestDemoMode(manifestDemoMode?.id || manifestDemoMode);
  const strategy = normalizeDemoStrategy(demoStrategy?.id || demoStrategy);
  const industryPlaybook = normalizeIndustry(industry?.id || industry);
  const prepPrinciples = flowPrinciples || demoFlowPrinciples({ demoScope, audience, marketSegment, demoStrategy: strategy, industry: industryPlaybook });
  const useCash360 = includeCash360 ?? hasCash360Segments(segments);
  const story = mode.id === "plain_demo"
    ? plainDemoFlowText({ companyName, audience, marketSegment, playbook, priorities, includeCash360: useCash360 })
    : personalizedStoryFlowText({ companyName, audience, marketSegment, playbook, priorities, segments, includeCash360: useCash360 });
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
  ? `Bring the audience back to the standard demo flow: trusted performance reporting, explainable detail, controlled sharing${useCash360 ? ", and forward-looking cash visibility" : ", and the next in-scope decision"}.`
  : `Bring the audience back to the main business question. For ${companyName || "the prospect"}, the thread is not just that NetSuite has reports${useCash360 ? " and Cash 360" : ""}. The thread is that finance can start with a trusted performance view, prove the details, and then move into the next decision without leaving the operating system.`}

Language note:

${outputLanguageInstruction(outputLanguage)}

Manifest mode:

${mode.label}: ${mode.instruction}

Demo strategy:

${strategy.label}: ${demoStrategyInstruction(strategy, industryPlaybook)}

Industry lens:

${industryPlaybook.label}: ${industryInstruction(industryPlaybook)}`;
}

function plainDemoFlowText({ audience, marketSegment, playbook, priorities, includeCash360 }) {
  const finalProof = includeCash360
    ? "then move into Cash 360 for current cash position and forecast visibility"
    : "then connect the reporting proof to the next in-scope finance decision";
  return `This is a plain NetSuite finance demo, so keep the storyline product-led and easy to follow. Start with the standard income statement, show how finance changes the reporting lens with filters, prove trust through drilldown, show controlled export options, ${finalProof}.

The audience is still ${audience.label.toLowerCase()} in a ${marketSegment.label.toLowerCase()} context, so emphasize ${joinHuman(playbook.interests.slice(0, 4)) || joinHuman((priorities || []).slice(0, 4)) || "trusted reporting, usable workflows, and clear decision-making"}. Keep persona references light. The aim is a clean, reusable demo path an SC can run for many customers without rewriting the manifest.`;
}

function demoAssetPromptText({ companyName, audience, marketSegment, playbook, priorities, signals, segments, outputLanguage, notes, manifestDemoMode, demoStrategy, industry, demoRequest, demoScope, flowPrinciples, includeCash360 }) {
  const mode = normalizeManifestDemoMode(manifestDemoMode?.id || manifestDemoMode);
  const strategy = normalizeDemoStrategy(demoStrategy?.id || demoStrategy);
  const industryPlaybook = normalizeIndustry(industry?.id || industry);
  const prepPrinciples = flowPrinciples || demoFlowPrinciples({ demoScope, audience, marketSegment, demoStrategy: strategy, industry: industryPlaybook });
  const persona = demoPersonaFor(audience, marketSegment);
  const useCash360 = includeCash360 ?? hasCash360Segments(segments);
  const storySegments = segments
    .filter((segment) => ["executive-overview", "open-pl", "pl-filters", "pl-drilldown", "pl-export-options", "open-cash360-dashboard", "cash360-forecast", "close"].includes(segment.id))
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
- Demo request: ${demoRequest || "Finance demo using standard reporting, drilldown, controlled sharing, and in-scope proof moments"}
- Demo scope: ${demoScope || "Use only the generated manifest and discovery-backed priorities as scope."}
- Persona: ${mode.id === "plain_demo" ? "Use a light finance-team persona, not a named customer character." : `${persona.name}, ${persona.role}`}
- Persona pressure: ${mode.id === "plain_demo" ? "They are trying to understand performance, explain the detail, and avoid spreadsheet-heavy follow-up." : persona.question}
- Likely priorities: ${joinHuman((priorities || []).slice(0, 5)) || "trusted reporting, faster finance decisions, and explainable detail"}
- Industry cues: ${joinHuman((signals || []).slice(0, 3)) || joinHuman(industryPlaybook.terminology.slice(0, 3)) || "financial visibility and operational control"}
- Prep order: ${prepPrinciples.ordering}
- Scope rule: ${prepPrinciples.scopeInstruction}
- Output language: ${normalizeOutputLanguage(outputLanguage?.value || outputLanguage).label}

Create 5 slides:
1. Persona under pressure: show the person trying to close the books, answer leadership, or defend the numbers while data is split across tools and spreadsheets.
2. Why it hurts: make the business tension visible in one scene, using ${joinHuman(playbook.interests.slice(0, 3)) || "the audience priorities"}.
3. Turning point: NetSuite gives the persona a general executive view first, then a trusted finance path.
4. Live demo journey: use simple placeholders for the product proof moments, in this order:
${storySegments || `- Executive overview\n- Standard income statement\n- Filters\n- Drilldown\n- Export${useCash360 ? "\n- Cash 360\n- Forecast controls" : "\n- Next in-scope proof point"}`}
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

function personalizedStoryFlowText({ companyName, audience, marketSegment, playbook, priorities, segments, includeCash360 }) {
  const persona = demoPersonaFor(audience, marketSegment);
  const opening = `${persona.name}, ${persona.role}, is trying to answer one practical question: ${persona.question}`;
  const useCash360 = includeCash360 ?? hasCash360Segments(segments);
  const context = `${persona.name} cares most about ${joinHuman(playbook.interests.slice(0, 3)) || joinHuman(priorities.slice(0, 3)) || "trusted reporting and explainable detail"}.`;
  const beats = [
    `1. Start with the standard income statement as ${persona.name}'s executive checkpoint. Show that revenue, expenses, and net income are available without leaving the finance system.`,
    `2. Use filters as the control moment. Position period, subsidiary, and accounting book as the way ${persona.name} changes the lens without changing the source of truth.`,
    `3. Drill down once to prove trust. The point is not the click itself; it is that ${persona.name} can defend a number when leadership challenges it.`,
    `4. Show export options as the collaboration moment. Keep it light: exporting is available, but the story is that fewer decisions should depend on disconnected spreadsheets.`,
    useCash360
      ? `5. Move into Cash 360 as the forward-looking moment. ${persona.name} moves from what happened to what is likely to happen next.`
      : `5. Move into the next in-scope proof point. ${persona.name} moves from seeing the number to deciding what action comes next.`,
    `6. Close by connecting performance to the next business decision${useCash360 ? " and liquidity planning" : ""}. For a ${marketSegment.label.toLowerCase()} ${audience.label.toLowerCase()} audience, land the story on ${marketSegment.demoBias}`
  ];

  const segmentTips = segments
    .filter((segment) => ["executive-overview", "open-pl", "pl-drilldown", "open-cash360-dashboard", "cash360-forecast", "close"].includes(segment.id))
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
      question: "can we trust consolidated numbers, trace the detail, and manage decisions without adding more manual governance?"
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
    question: "can we close faster, trust the numbers, and act without stitching spreadsheets together?"
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

async function demoIntelligencePayloadWithCodex(manifest, scGuide = "") {
  const localIntelligence = demoIntelligencePayload(manifest, scGuide);
  const codex = await codexIntelligenceOperatorAnalysis(manifest, scGuide, localIntelligence);
  const intelligence = normalizeCodexIntelligencePayload(codex.structured, localIntelligence, codex);
  await saveLatestJson(latestIntelligencePath, intelligence);
  await saveLatestJson(latestPreDemoIntelligencePath, preDemoIntelligenceFromDemoIntelligencePayload(intelligence));
  return intelligence;
}

async function readLatestIntelligence(manifest, scGuide = "") {
  const saved = await readLatestJson(latestIntelligencePath);
  if (saved && typeof saved === "object") {
    return {
      ...saved,
      restored_from_local_state: true,
      restore_source: "artifacts/runtime/latest-intelligence.json"
    };
  }
  return {
    ...demoIntelligencePayload(manifest, scGuide),
    restored_from_local_state: false,
    restore_source: "local-fallback-no-codex"
  };
}

async function readLatestPreDemoIntelligence(manifest, intelligence) {
  const saved = await readLatestJson(latestPreDemoIntelligencePath);
  if (saved && typeof saved === "object") {
    return {
      ...saved,
      restored_from_local_state: true,
      restore_source: "artifacts/runtime/latest-pre-demo-intelligence.json"
    };
  }
  if (intelligence) return preDemoIntelligenceFromDemoIntelligencePayload(intelligence);
  return {
    ...preDemoIntelligencePayload(manifest),
    restored_from_local_state: false,
    restore_source: "local-fallback-no-codex"
  };
}

async function readLatestJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function saveLatestJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function codexCacheKey(parts = {}, version = "v1") {
  return createHash("sha256")
    .update(JSON.stringify(stableCodexInput({ ...parts, version })))
    .digest("hex")
    .slice(0, 16);
}

function stableCodexInput(value) {
  if (Array.isArray(value)) return value.map(stableCodexInput);
  if (value && typeof value === "object") {
    const volatileKeys = new Set([
      "generated_at",
      "generatedAt",
      "cachedAt",
      "scanned_at",
      "scannedAt",
      "draftPrepScoredAt",
      "websiteContextScannedAt",
      "learnedAt",
      "createdAt",
      "updatedAt",
      "restored_from_local_state",
      "restore_source",
      "promptFile",
      "outputFile",
      "codexLog",
      "codexError",
      "codex_task",
      "sessionTitle"
    ]);
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => !volatileKeys.has(key))
        .sort()
        .map((key) => [key, stableCodexInput(value[key])])
    );
  }
  return value;
}

function stableGuideForCodexCache(guide = "") {
  return String(guide || "")
    .replace(/\n## Codex Backbone[\s\S]*$/m, "")
    .replace(/Prompt file:\s+.+/gi, "")
    .replace(/Output file:\s+.+/gi, "")
    .trim();
}

async function runCachedCodexOperator({ cachePrefix, cacheParts, cacheVersion, prompt, sessionTitle, fileStem, timeoutMs = 240000 }) {
  const cacheKey = codexCacheKey(cacheParts, cacheVersion);
  const cacheDir = path.join(projectRoot, "artifacts/codex-operators/cache");
  const cacheFile = path.join(cacheDir, `${cachePrefix}-${cacheKey}.json`);
  try {
    return {
      ...(JSON.parse(await readFile(cacheFile, "utf8"))),
      fromCache: true
    };
  } catch {}

  const result = await runCodexOperator({ prompt, sessionTitle, fileStem, timeoutMs });
  if (result.ok) {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cacheFile, `${JSON.stringify({
      ...result,
      cacheKey,
      cachedAt: new Date().toISOString()
    }, null, 2)}\n`, "utf8");
  }
  return result;
}

async function codexIntelligenceOperatorAnalysis(manifest, scGuide, localIntelligence) {
  const company = manifest.context?.company || {};
  const sessionTitle = `created by demo helper - ${company.companyName || websiteNameSlug(company.url) || "customer"} - intelligence`;
  const cacheKey = codexCacheKey({
    manifestContext: manifest.context || {},
    segments: manifest.segments || [],
    guide: stableGuideForCodexCache(scGuide),
    localIntelligence
  }, "codex-intelligence-structured-v4");
  const cacheDir = path.join(projectRoot, "artifacts/codex-operators/cache");
  const cacheFile = path.join(cacheDir, `intelligence-${cacheKey}.json`);
  try {
    return JSON.parse(await readFile(cacheFile, "utf8"));
  } catch {}

  const prompt = codexIntelligencePrompt(manifest, scGuide, localIntelligence, sessionTitle);
  const result = await runCodexOperator({
    prompt,
    sessionTitle,
    fileStem: `${companyFileSlug(manifest)}-intelligence`,
    timeoutMs: 300000
  });
  if (!result.ok) {
    throw new Error(`Codex intelligence operator failed: ${result.error || "No output returned"}`);
  }
  if (!result.output?.trim()) {
    throw new Error("Codex intelligence operator did not return analysis.");
  }
  const structured = parseCodexStructuredJson(result.output);
  const payload = {
    ok: true,
    analysis: codexIntelligenceMarkdownSummary(structured, result.output.trim()),
    structured,
    rawOutput: result.output.trim(),
    promptFile: result.promptFile,
    outputFile: result.outputFile,
    sessionTitle,
    error: "",
    cachedAt: new Date().toISOString()
  };
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cacheFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

function parseCodexStructuredJson(output) {
  const raw = String(output || "").trim();
  const candidates = [
    raw,
    raw.match(/```json\s*([\s\S]*?)```/i)?.[1],
    raw.match(/```\s*([\s\S]*?)```/i)?.[1],
    raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)
  ].filter(Boolean).map((candidate) => candidate.trim());

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  throw new Error("Codex intelligence operator did not return valid structured JSON.");
}

function codexIntelligenceMarkdownSummary(structured, rawOutput) {
  const verdict = structured?.readiness_verdict || structured?.sc_briefing?.demo_goal || "";
  const risk = structured?.demo_risk_analyzer || {};
  const discovery = structured?.discovery_gap_analyzer || {};
  const winning = structured?.winning_moment_detection || {};
  return [
    "# Codex Structured Demo Intelligence",
    "",
    verdict ? `## Readiness Verdict\n${verdict}` : "",
    "## Scores",
    `- Demo readiness: ${boundedScore(structured?.demo_readiness_score)}/100`,
    `- Demo quality: ${boundedScore(risk.demo_quality_score)}/100`,
    `- Demo risk: ${boundedScore(risk.demo_risk_score)}/100`,
    "",
    "## Biggest Risks",
    ...(stringArray(risk.warnings).slice(0, 5).map((item) => `- ${item}`)),
    "",
    "## Missing Discovery",
    ...(stringArray(discovery.missing_discovery_items).slice(0, 5).map((item) => `- ${item}`)),
    "",
    "## Winning Moments",
    ...(stringArray(winning.winning_moments).slice(0, 5).map((item) => `- ${item}`)),
    "",
    "## Raw Codex Output",
    rawOutput
  ].filter(Boolean).join("\n");
}

function normalizeCodexIntelligencePayload(structured, local, codex) {
  if (!structured || typeof structured !== "object") {
    throw new Error("Codex intelligence output is missing the structured dashboard payload.");
  }
  const required = [
    "demo_readiness_score",
    "sc_briefing",
    "demo_risk_analyzer",
    "discovery_gap_analyzer",
    "stakeholder_coverage_analyzer",
    "winning_moment_detection",
    "what_not_to_demo_engine",
    "demo_timing_pacing_analyzer",
    "pre_demo_notes_analyzer"
  ];
  const missing = required.filter((key) => structured[key] === undefined || structured[key] === null);
  if (missing.length) {
    throw new Error(`Codex intelligence output is missing required fields: ${missing.join(", ")}.`);
  }

  const risk = normalizeCodexRisk(structured.demo_risk_analyzer, local.demo_risk_analyzer);
  const discovery = normalizeCodexDiscovery(structured.discovery_gap_analyzer, local.discovery_gap_analyzer);
  const stakeholder = normalizeCodexStakeholder(structured.stakeholder_coverage_analyzer, local.stakeholder_coverage_analyzer);
  const winning = normalizeCodexWinning(structured.winning_moment_detection, local.winning_moment_detection);
  const avoid = normalizeCodexAvoid(structured.what_not_to_demo_engine, local.what_not_to_demo_engine);
  const timing = normalizeCodexTiming(structured.demo_timing_pacing_analyzer, local.demo_timing_pacing_analyzer);
  const coach = normalizeCodexCoach(structured.ai_rehearsal_coach, local.ai_rehearsal_coach);
  const heatmap = normalizeCodexHeatmap(structured.demo_heatmap_analyzer, local.demo_heatmap_analyzer);
  const notes = normalizeCodexNotes(structured.pre_demo_notes_analyzer, local.pre_demo_notes_analyzer);
  const winStrategy = normalizeCodexWinStrategy(structured.win_strategy_analyzer, local.win_strategy_analyzer);
  const competitive = normalizeCodexCompetitive(structured.competitive_positioning_mode, local.competitive_positioning_mode);
  const websiteContext = normalizedWebsiteContext(structured.website_context || local.website_context);

  return {
    ...local,
    generated_at: new Date().toISOString(),
    intelligence_generated_by: "codex-structured-json",
    demo_readiness_score: boundedScore(structured.demo_readiness_score),
    readiness_verdict: String(structured.readiness_verdict || ""),
    sc_briefing: normalizeCodexBriefing(structured.sc_briefing),
    demo_metadata: {
      ...(local.demo_metadata || {}),
      ...(objectOrEmpty(structured.demo_metadata)),
      intelligence_source: "codex-structured-json",
      website_summary: websiteContext.summary,
      website_interesting_points: websiteContext.interesting_points,
      website_contradictions_or_checks: websiteContext.contradictions_or_checks,
      codex_task: codex.sessionTitle || "",
      source_explanation: "The visible Intelligence dashboard is rendered from structured JSON generated by Codex. Local scoring is only supplied to Codex as a pre-scan and schema guardrail."
    },
    website_context: websiteContext,
    demo_strategy: objectWithFallback(structured.demo_strategy, local.demo_strategy),
    industry_playbook: objectWithFallback(structured.industry_playbook, local.industry_playbook),
    demo_risk_analyzer: risk,
    discovery_gap_analyzer: discovery,
    stakeholder_coverage_analyzer: stakeholder,
    winning_moment_detection: winning,
    what_not_to_demo_engine: avoid,
    demo_timing_pacing_analyzer: timing,
    ai_rehearsal_coach: coach,
    demo_heatmap_analyzer: heatmap,
    pre_demo_notes_analyzer: notes,
    win_strategy_analyzer: winStrategy,
    competitive_positioning_mode: competitive,
    internal_best_practices_library: objectWithFallback(structured.internal_best_practices_library, local.internal_best_practices_library),
    codex_intelligence_operator: {
      ok: true,
      analysis: codex.analysis,
      promptFile: codex.promptFile,
      outputFile: codex.outputFile,
      sessionTitle: codex.sessionTitle,
      cachedAt: codex.cachedAt,
      error: ""
    }
  };
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function objectWithFallback(value, fallback = {}) {
  const object = objectOrEmpty(value);
  return Object.keys(object).length ? object : fallback || {};
}

function stringArray(value) {
  if (Array.isArray(value)) return uniqueItems(value.map((item) => String(item || "").trim()).filter(Boolean));
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function normalizedWebsiteContext(value = {}) {
  const source = objectOrEmpty(value);
  return {
    source: String(source.source || ""),
    url: String(source.url || ""),
    title: String(source.title || ""),
    description: String(source.description || ""),
    summary: String(source.summary || source.description || source.title || ""),
    interesting_points: stringArray(source.interesting_points || source.interestingPoints),
    evidence: stringArray(source.evidence || source.evidence_snippets || source.evidenceSnippets),
    contradictions_or_checks: stringArray(source.contradictions_or_checks || source.contradictions || source.alignment_checks),
    scanned_at: String(source.scanned_at || source.scannedAt || "")
  };
}

function normalizeCodexBriefing(value) {
  const briefing = objectOrEmpty(value);
  return {
    customer_situation: String(briefing.customer_situation || ""),
    demo_goal: String(briefing.demo_goal || ""),
    key_business_drivers: stringArray(briefing.key_business_drivers),
    recommended_tone: String(briefing.recommended_tone || ""),
    critical_demo_moments: stringArray(briefing.critical_demo_moments)
  };
}

function normalizeCodexRisk(value, fallback = {}) {
  const source = objectOrEmpty(value);
  const scoreDetails = { ...(fallback.score_details || {}), ...(objectOrEmpty(source.score_details)) };
  return {
    ...fallback,
    ...source,
    demo_quality_score: boundedScore(source.demo_quality_score ?? fallback.demo_quality_score),
    demo_risk_score: boundedScore(source.demo_risk_score ?? fallback.demo_risk_score),
    summary: String(source.summary || fallback.summary || ""),
    warnings: stringArray(source.warnings?.length ? source.warnings : fallback.warnings),
    recommendations: stringArray(source.recommendations?.length ? source.recommendations : fallback.recommendations),
    score_explanation: String(source.score_explanation || fallback.score_explanation || ""),
    score_details: {
      ...scoreDetails,
      what_is_strong: stringArray(scoreDetails.what_is_strong),
      what_needs_work: stringArray(scoreDetails.what_needs_work)
    }
  };
}

function normalizeCodexDiscovery(value, fallback = {}) {
  const source = objectOrEmpty(value);
  return {
    ...fallback,
    ...source,
    summary: String(source.summary || fallback.summary || ""),
    missing_discovery_items: stringArray(source.missing_discovery_items?.length ? source.missing_discovery_items : fallback.missing_discovery_items),
    found_discovery_items: stringArray(source.found_discovery_items?.length ? source.found_discovery_items : fallback.found_discovery_items),
    recommended_follow_up_questions: stringArray(source.recommended_follow_up_questions?.length ? source.recommended_follow_up_questions : fallback.recommended_follow_up_questions)
  };
}

function normalizeCodexStakeholder(value, fallback = {}) {
  const source = objectOrEmpty(value);
  const coverage = Array.isArray(source.stakeholder_coverage) && source.stakeholder_coverage.length
    ? source.stakeholder_coverage
    : fallback.stakeholder_coverage || [];
  return {
    ...fallback,
    ...source,
    summary: String(source.summary || fallback.summary || ""),
    stakeholder_coverage: coverage.map((item) => ({
      role: String(item.role || "Stakeholder"),
      coverage: boundedScore(item.coverage),
      rationale: String(item.rationale || "")
    })),
    low_coverage_roles: stringArray(source.low_coverage_roles?.length ? source.low_coverage_roles : fallback.low_coverage_roles),
    uncovered_roles: stringArray(source.uncovered_roles?.length ? source.uncovered_roles : fallback.uncovered_roles),
    recommendation: String(source.recommendation || fallback.recommendation || "")
  };
}

function normalizeCodexWinning(value, fallback = {}) {
  const source = objectOrEmpty(value);
  const details = Array.isArray(source.details) && source.details.length ? source.details : fallback.details || [];
  return {
    ...fallback,
    ...source,
    summary: String(source.summary || fallback.summary || ""),
    winning_moments: stringArray(source.winning_moments?.length ? source.winning_moments : fallback.winning_moments),
    details: details.map((item) => ({
      segment: String(item.segment || ""),
      moment: String(item.moment || ""),
      source: String(item.source || "Codex structured intelligence"),
      why_it_lands: String(item.why_it_lands || ""),
      coaching_tip: String(item.coaching_tip || "")
    }))
  };
}

function normalizeCodexAvoid(value, fallback = {}) {
  const source = objectOrEmpty(value);
  return {
    ...fallback,
    ...source,
    summary: String(source.summary || fallback.summary || ""),
    avoid_showing: stringArray(source.avoid_showing?.length ? source.avoid_showing : fallback.avoid_showing),
    rationale: String(source.rationale || fallback.rationale || "")
  };
}

function normalizeCodexTiming(value, fallback = {}) {
  const source = objectOrEmpty(value);
  return {
    ...fallback,
    ...source,
    summary: String(source.summary || fallback.summary || ""),
    estimated_runtime: String(source.estimated_runtime || fallback.estimated_runtime || "unknown runtime"),
    estimated_minutes: roundOne(source.estimated_minutes ?? fallback.estimated_minutes),
    overrun_risk: ["low", "medium", "high"].includes(source.overrun_risk) ? source.overrun_risk : fallback.overrun_risk || "medium",
    basis: String(source.basis || fallback.basis || ""),
    high_risk_sections: stringArray(source.high_risk_sections?.length ? source.high_risk_sections : fallback.high_risk_sections),
    recommended_cuts: stringArray(source.recommended_cuts?.length ? source.recommended_cuts : fallback.recommended_cuts),
    section_timing: Array.isArray(source.section_timing) && source.section_timing.length ? source.section_timing : fallback.section_timing || []
  };
}

function normalizeCodexCoach(value, fallback = {}) {
  const source = objectOrEmpty(value);
  return {
    ...fallback,
    ...source,
    summary: String(source.summary || fallback.summary || ""),
    status: String(source.status || fallback.status || "ready-for-rehearsal-feedback"),
    basis: String(source.basis || fallback.basis || ""),
    business_value_score: boundedScore(source.business_value_score ?? fallback.business_value_score),
    clarity_score: boundedScore(source.clarity_score ?? fallback.clarity_score),
    executive_alignment_score: boundedScore(source.executive_alignment_score ?? fallback.executive_alignment_score),
    recommendations: stringArray(source.recommendations?.length ? source.recommendations : fallback.recommendations),
    suggested_metrics_for_future_rehearsal_transcripts: stringArray(source.suggested_metrics_for_future_rehearsal_transcripts?.length ? source.suggested_metrics_for_future_rehearsal_transcripts : fallback.suggested_metrics_for_future_rehearsal_transcripts)
  };
}

function normalizeCodexHeatmap(value, fallback = {}) {
  const source = objectOrEmpty(value);
  const heatmap = Array.isArray(source.heatmap) && source.heatmap.length ? source.heatmap : fallback.heatmap || [];
  return {
    ...fallback,
    ...source,
    summary: String(source.summary || fallback.summary || ""),
    strongest_areas: stringArray(source.strongest_areas?.length ? source.strongest_areas : fallback.strongest_areas),
    needs_work_areas: stringArray(source.needs_work_areas?.length ? source.needs_work_areas : fallback.needs_work_areas),
    heatmap: heatmap.map((item) => {
      const score = boundedScore(item.score);
      const status = ["strong", "healthy", "watch", "risk"].includes(item.status) ? item.status : heatmapStatus(score).id;
      return {
        label: String(item.label || ""),
        score,
        status,
        status_label: String(item.status_label || heatmapStatus(score).label),
        evidence: String(item.evidence || ""),
        recommendation: String(item.recommendation || "")
      };
    }).filter((item) => item.label)
  };
}

function normalizeCodexNotes(value, fallback = {}) {
  const source = objectOrEmpty(value);
  const heatmap = Array.isArray(source.heatmap) && source.heatmap.length ? source.heatmap : fallback.heatmap || [];
  return {
    ...fallback,
    ...source,
    overall_score: boundedScore(source.overall_score ?? fallback.overall_score),
    discovery_coverage_score: boundedScore(source.discovery_coverage_score ?? fallback.discovery_coverage_score),
    word_count: Number(source.word_count ?? fallback.word_count ?? 0),
    summary: String(source.summary || fallback.summary || ""),
    coverage_summary: String(source.coverage_summary || fallback.coverage_summary || ""),
    strong_areas: stringArray(source.strong_areas?.length ? source.strong_areas : fallback.strong_areas),
    risk_areas: stringArray(source.risk_areas?.length ? source.risk_areas : fallback.risk_areas),
    recommendations: stringArray(source.recommendations?.length ? source.recommendations : fallback.recommendations),
    heatmap: normalizeCodexHeatmap({ heatmap }, { heatmap: fallback.heatmap || [] }).heatmap
  };
}

function normalizeCodexCompetitive(value, fallback = {}) {
  const source = objectOrEmpty(value);
  const focus = Array.isArray(source.competitive_focus) && source.competitive_focus.length ? source.competitive_focus : fallback.competitive_focus || [];
  return {
    ...fallback,
    ...source,
    summary: String(source.summary || fallback.summary || ""),
    warning: String(source.warning || fallback.warning || "Competitive insights are advisory only and may be incomplete or outdated. Validate important claims before customer use."),
    guidance_only: true,
    competitive_focus: focus.map((item) => ({
      topic: String(item.topic || ""),
      why_it_matters: String(item.why_it_matters || ""),
      recommended_demo_moment: String(item.recommended_demo_moment || "")
    })).filter((item) => item.topic)
  };
}

function normalizeCodexWinStrategy(value, fallback = {}) {
  const source = objectOrEmpty(value);
  const strategies = Array.isArray(source.strategies) && source.strategies.length ? source.strategies : fallback.strategies || [];
  return {
    ...fallback,
    ...source,
    summary: String(source.summary || fallback.summary || ""),
    competition_context: String(source.competition_context || fallback.competition_context || ""),
    guidance_only: true,
    strategies: strategies.map((item) => ({
      title: String(item.title || ""),
      why_we_can_win: String(item.why_we_can_win || item.why || ""),
      competitor_likely_move: String(item.competitor_likely_move || item.competitor_move || ""),
      demo_move: String(item.demo_move || item.recommended_demo_move || "")
    })).filter((item) => item.title)
  };
}

function codexPreDemoIntelligencePrompt(manifest, localPreDemo, sessionTitle) {
  const company = manifest.context?.company || {};
  const request = manifest.context?.demoRequest || {};
  return `Task title: ${sessionTitle}

You are the Codex backbone for the NetSuite Demo Helper Pre-Demo Intelligence page.

Your job is to score only the current pre-demo information and discovery quality before a full SC guide is generated. Do not score the generated demo flow, browser dry-run, manifest pacing, or rehearsal quality. Focus on whether the SC has enough customer/deal context to create a strong demo.

Use the supplied website_context as the website scan result. Do not re-scan or research the website when website_context already contains a summary, evidence, or interesting points. Only use web/search if website_context is unavailable or explicitly says a Pre-demo scan is still required. Do not invent facts. If website context is unavailable, state that in the evidence and rely on the supplied notes.

Admin-owned scoring guidance:
${preDemoIntelligenceGuidance()}

Company and prep context:
${JSON.stringify({
    company,
    audience: manifest.context?.audience,
    targetAudience: manifest.context?.targetAudience || manifest.context?.marketSegment,
    demoStrategy: manifest.context?.demoStrategy,
    industry: manifest.context?.industry,
    demoScope: manifest.context?.demoScope,
    competition: manifest.context?.competition || request.competition,
    demoRequest: request,
    preDemoNotes: manifest.context?.preDemoNotes,
    additionalDemoSources: manifest.context?.additionalDemoSources || []
  }, null, 2)}

Local pre-scan signals:
${JSON.stringify(localPreDemo, null, 2).slice(0, 12000)}

Return VALID JSON ONLY. Do not wrap it in Markdown. Do not include comments. Use this exact top-level shape:

{
  "metadata": {
    "customer_name": "",
    "customer_url": "",
    "audience_type": "",
    "target_segment": "",
    "industry": "",
    "demo_strategy": "",
    "demo_scope": "",
    "input_mode": ""
  },
  "website_context": {
    "source": "",
    "url": "",
    "title": "",
    "description": "",
    "summary": "",
    "interesting_points": [],
    "evidence": [],
    "contradictions_or_checks": [],
    "scanned_at": ""
  },
  "overall_score": 0,
  "discovery_coverage_score": 0,
  "readiness_label": "",
  "summary": "",
  "coverage_summary": "",
  "strongest_area": "",
  "biggest_risk": "",
  "next_best_question": "",
  "strong_areas": [],
  "risk_areas": [],
  "recommendations": [],
  "heatmap": [
    {
      "label": "",
      "score": 0,
      "status": "strong",
      "status_label": "",
      "evidence": "",
      "recommendation": ""
    }
  ],
  "found_discovery_items": [],
  "missing_discovery_items": [],
  "recommended_follow_up_questions": []
}

Rules:
- Scores must be specific to the notes, website context, audience, target segment, strategy, industry, and scope.
- "status" in heatmap must be one of: strong, healthy, watch, risk.
- recommended_follow_up_questions should be questions that would materially change the demo story, setup, stakeholder emphasis, risk, or proof moments.
- Do not ask questions that are already answered in the notes.
- website_context must summarize what was found from the website and flag contradictions or alignment checks between website context and pre-demo notes.
- Make clear in evidence when something is inferred from the website or selected options rather than stated in discovery notes.`;
}

function codexIntelligencePrompt(manifest, scGuide, localIntelligence, sessionTitle) {
  const company = manifest.context?.company || {};
  return `Task title: ${sessionTitle}

You are the Codex backbone for the NetSuite Demo Helper Intelligence dashboard. Review all available prep inputs, the company/website context, pre-demo notes, demo scope, audience, target segment, strategy, generated SC guide, manifest, and local structured pre-scan signals.

Your job is to produce the structured JSON that the Intelligence dashboard renders directly. The local JSON signals are only a pre-scan and schema guardrail. Challenge them whenever the guide, notes, or customer context suggests something more specific. Do not copy generic local summaries if they are not specific enough.

Important website rule: do not browse, search, or re-scan the customer website during Demo Intelligence. The website should be scanned once by Pre-Demo Intelligence or Learn/Create Demo, then passed into this task as company.websiteContext/localIntelligence.website_context. Use that supplied context and compare it against the notes. If the supplied context says a Pre-demo scan is still required, flag that as an action instead of researching the website again.

Company:
${JSON.stringify(company, null, 2)}

Demo context:
${JSON.stringify({
    audience: manifest.context?.audience,
    targetAudience: manifest.context?.targetAudience || manifest.context?.marketSegment,
    demoStrategy: manifest.context?.demoStrategy,
    industry: manifest.context?.industry,
    demoScope: manifest.context?.demoScope,
    competition: manifest.context?.competition || manifest.context?.demoRequest?.competition,
    demoRequest: manifest.context?.demoRequest,
    codexPrepAnalysis: manifest.context?.codexPrepAnalysis
  }, null, 2)}

Manifest segments:
${JSON.stringify((manifest.segments || []).map((segment) => ({
    id: segment.id,
    title: segment.title,
    objective: segment.objective,
    valueStatement: segment.valueStatement,
    narration: segment.narration,
    actions: (segment.actions || []).map((action) => ({
      type: action.type,
      query: action.query,
      text: action.text,
      url: action.url
    }))
  })), null, 2)}

SC guide:
${String(scGuide || "").slice(0, 14000)}

Local structured intelligence signals:
${JSON.stringify(localIntelligence, null, 2).slice(0, 14000)}

Return VALID JSON ONLY. Do not wrap it in Markdown. Do not include comments. Use this exact top-level shape:

{
  "demo_readiness_score": 0,
  "readiness_verdict": "",
  "sc_briefing": {
    "customer_situation": "",
    "demo_goal": "",
    "key_business_drivers": [],
    "recommended_tone": "",
    "critical_demo_moments": []
  },
  "demo_metadata": {
    "customer_name": "",
    "customer_url": "",
    "demo_name": "",
    "demo_goal": "",
    "demo_scope": "",
    "competition_context": "",
    "customer_description": "",
    "likely_priorities": [],
    "audience_type": "",
    "target_segment": "",
    "industry": "",
    "strategy": "",
    "language": "",
    "narration_voice": "",
    "manifest_ready": false
  },
  "website_context": {
    "source": "",
    "url": "",
    "title": "",
    "description": "",
    "summary": "",
    "interesting_points": [],
    "evidence": [],
    "contradictions_or_checks": [],
    "scanned_at": ""
  },
  "demo_strategy": {
    "id": "",
    "label": "",
    "description": "",
    "tone": "",
    "pacing": "",
    "technical_depth": "",
    "storytelling_style": ""
  },
  "industry_playbook": {
    "id": "",
    "label": "",
    "description": "",
    "terminology": [],
    "kpis": [],
    "workflows": [],
    "pain_points": [],
    "emotional_drivers": []
  },
  "demo_risk_analyzer": {
    "demo_quality_score": 0,
    "demo_risk_score": 0,
    "summary": "",
    "warnings": [],
    "recommendations": [],
    "score_explanation": "",
    "score_details": {
      "demo_quality_summary": "",
      "demo_risk_summary": "",
      "what_is_strong": [],
      "what_needs_work": [],
      "quality_explanation": "",
      "risk_explanation": "",
      "notes_dependency": ""
    }
  },
  "discovery_gap_analyzer": {
    "summary": "",
    "missing_discovery_items": [],
    "found_discovery_items": [],
    "recommended_follow_up_questions": []
  },
  "stakeholder_coverage_analyzer": {
    "summary": "",
    "stakeholder_coverage": [
      { "role": "", "coverage": 0, "rationale": "" }
    ],
    "low_coverage_roles": [],
    "uncovered_roles": [],
    "recommendation": ""
  },
  "winning_moment_detection": {
    "summary": "",
    "winning_moments": [],
    "details": [
      { "segment": "", "moment": "", "source": "", "why_it_lands": "", "coaching_tip": "" }
    ]
  },
  "what_not_to_demo_engine": {
    "summary": "",
    "avoid_showing": [],
    "rationale": ""
  },
  "demo_timing_pacing_analyzer": {
    "summary": "",
    "estimated_runtime": "",
    "estimated_minutes": 0,
    "overrun_risk": "low",
    "basis": "",
    "section_timing": [
      { "segment": "", "estimated_minutes": 0, "pacing_risk": "low", "reason": "" }
    ],
    "high_risk_sections": [],
    "recommended_cuts": []
  },
  "ai_rehearsal_coach": {
    "summary": "",
    "status": "",
    "basis": "",
    "business_value_score": 0,
    "clarity_score": 0,
    "executive_alignment_score": 0,
    "suggested_metrics_for_future_rehearsal_transcripts": [],
    "recommendations": []
  },
  "demo_heatmap_analyzer": {
    "summary": "",
    "strongest_areas": [],
    "needs_work_areas": [],
    "heatmap": [
      { "label": "", "score": 0, "status": "healthy", "status_label": "", "evidence": "", "recommendation": "" }
    ]
  },
  "pre_demo_notes_analyzer": {
    "overall_score": 0,
    "discovery_coverage_score": 0,
    "word_count": 0,
    "summary": "",
    "coverage_summary": "",
    "strong_areas": [],
    "risk_areas": [],
    "recommendations": [],
    "heatmap": [
      { "label": "", "score": 0, "status": "healthy", "status_label": "", "evidence": "", "recommendation": "" }
    ]
  },
  "win_strategy_analyzer": {
    "summary": "",
    "competition_context": "",
    "guidance_only": true,
    "strategies": [
      { "title": "", "why_we_can_win": "", "competitor_likely_move": "", "demo_move": "" }
    ]
  },
  "competitive_positioning_mode": {
    "summary": "",
    "warning": "Competitive insights are advisory only and may be incomplete or outdated. Validate important claims before customer use.",
    "guidance_only": true,
    "competitive_focus": [
      { "topic": "", "why_it_matters": "", "recommended_demo_moment": "" }
    ]
  },
  "internal_best_practices_library": {
    "reusable_patterns_to_capture": [],
    "recommended_structures": []
  }
}

Rules:
- Scores must be your Codex judgment, not a copied local formula.
- Every summary must be specific to this customer, the notes, the scope, and the selected audience/strategy.
- Demo quality score: how strong and usable the current demo story is for the SC.
- Demo risk score: how likely the demo is to miss, drift, overrun, or fail stakeholder expectations.
- Demo readiness score: overall readiness for rehearsal.
- Heatmap scores must explain evidence and next action.
- Keep this SC-practical and blunt enough to be useful.
- Do not invent customer facts or unsupported NetSuite/competitor claims.
- Make clear when something is inferred.
- Use website_context to show the customer/business signals that should shape the demo. Flag contradictions or alignment checks between the website and notes instead of silently ignoring them.
- win_strategy_analyzer must provide exactly 3 practical win strategy points. Use the supplied competition/status quo context and notes. Frame competitor_likely_move as a likely sales or demo tactic, not as a factual claim about a named competitor unless the notes explicitly support it.
- Prioritize what changes the demo story, scope, setup, proof moments, or stakeholder alignment.
- Avoid generic labels like "business impact language is light" unless you explain exactly where and why for this demo.`;
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
  const winStrategy = winStrategyAnalysis(context);
  const preDemoNotes = preDemoNotesAnalysis(context, discovery);
  const demoHeatmap = demoHeatmapAnalysis(context, risk, discovery, stakeholderCoverage, timing, winning, rehearsalCoach);
  const websiteContext = normalizedWebsiteContext(context.company?.websiteContext || websiteContextFromContent({
    url: context.company?.url || "",
    title: context.company?.title || "",
    description: context.company?.description || "",
    notes: context.notes || "",
    source: context.company?.source || "saved-company-context"
  }));
  if (websiteContext.contradictions_or_checks.length) {
    preDemoNotes.risk_areas = uniqueItems([...(websiteContext.contradictions_or_checks || []), ...(preDemoNotes.risk_areas || [])]);
    preDemoNotes.recommendations = uniqueItems([
      "Resolve website-versus-notes alignment checks before relying on the demo story.",
      ...(preDemoNotes.recommendations || [])
    ]);
  }
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
      competition_context: context.competition || "",
      customer_description: context.company.description || context.company.title || "",
      likely_priorities: context.company.likelyPriorities || [],
      audience_type: context.audience.label,
      target_segment: context.marketSegment.label,
      industry: context.industry.label,
      strategy: context.strategy.label,
      language: normalizeOutputLanguage(manifest.context?.outputLanguage?.value || manifest.context?.demoRequest?.outputLanguage || manifest.defaults?.outputLanguage).label,
      narration_voice: manifest.defaults?.audio?.voice || "Moira",
      website_summary: websiteContext.summary,
      website_interesting_points: websiteContext.interesting_points,
      website_contradictions_or_checks: websiteContext.contradictions_or_checks,
      manifest_ready: context.manifestFlowReady
    },
    website_context: websiteContext,
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
    win_strategy_analyzer: winStrategy,
    competitive_positioning_mode: competitive,
    internal_best_practices_library: bestPracticeRecommendations(context, winning)
  };
}

function preDemoIntelligencePayload(manifest) {
  const context = demoIntelligenceContext(manifest, "");
  const discovery = discoveryGapAnalysis(context);
  const notes = preDemoNotesAnalysis(context, discovery);
  const websiteContext = normalizedWebsiteContext(context.company?.websiteContext || websiteContextFromContent({
    url: context.company?.url || "",
    title: context.company?.title || "",
    description: context.company?.description || "",
    notes: context.notes || "",
    source: context.company?.source || "saved-company-context"
  }));
  if (websiteContext.contradictions_or_checks.length) {
    notes.risk_areas = uniqueItems([...(websiteContext.contradictions_or_checks || []), ...(notes.risk_areas || [])]);
    notes.recommendations = uniqueItems([
      "Resolve website-versus-notes alignment checks before generating or rehearsing the demo.",
      ...(notes.recommendations || [])
    ]);
  }
  const strongest = notes.strong_areas || [];
  const risks = notes.risk_areas || [];
  const missing = discovery.missing_discovery_items || [];
  return {
    generated_at: new Date().toISOString(),
    source: "lightweight-pre-demo-scorer",
    purpose: "Scores only the pre-demo input quality before full demo generation.",
    admin_guidance: preDemoIntelligenceGuidance(),
    metadata: {
      customer_name: context.company.companyName || context.company.title || manifest.name || "Current demo",
      customer_url: context.company.url || "",
      audience_type: context.audience.label,
      target_segment: context.marketSegment.label,
      industry: context.industry.label,
      demo_strategy: context.strategy.label,
      demo_scope: context.demoScope || "",
      input_mode: manifest.context?.demoRequest?.inputMode || "request-and-notes"
    },
    website_context: websiteContext,
    overall_score: notes.overall_score,
    discovery_coverage_score: notes.discovery_coverage_score,
    word_count: notes.word_count,
    readiness_label: preDemoReadinessLabel(notes.overall_score),
    summary: notes.summary,
    coverage_summary: notes.coverage_summary,
    strongest_area: strongest[0] || "No dominant strength detected yet",
    biggest_risk: risks[0] || missing[0] || "No major pre-demo risk detected",
    next_best_question: discovery.recommended_follow_up_questions?.[0] || "Confirm the main business outcome the demo must prove.",
    strong_areas: strongest,
    risk_areas: risks,
    recommendations: notes.recommendations || [],
    heatmap: notes.heatmap || [],
    found_discovery_items: discovery.found_discovery_items || [],
    missing_discovery_items: missing,
    recommended_follow_up_questions: discovery.recommended_follow_up_questions || []
  };
}

async function preDemoIntelligencePayloadWithCodex(manifest) {
  const localPreDemo = preDemoIntelligencePayload(manifest);
  const codex = await codexPreDemoIntelligenceOperatorAnalysis(manifest, localPreDemo);
  const preDemoIntelligence = normalizeCodexPreDemoIntelligencePayload(codex.structured, localPreDemo, codex);
  await saveLatestJson(latestPreDemoIntelligencePath, preDemoIntelligence);
  return preDemoIntelligence;
}

async function codexPreDemoIntelligenceOperatorAnalysis(manifest, localPreDemo) {
  const company = manifest.context?.company || {};
  const sessionTitle = `created by demo helper - ${company.companyName || websiteNameSlug(company.url) || "customer"} - pre-demo intelligence`;
  const cacheKey = codexCacheKey({
    manifestContext: manifest.context || {},
    localPreDemo,
    adminGuidance: preDemoIntelligenceGuidance()
  }, "codex-pre-demo-intelligence-v2");
  const cacheDir = path.join(projectRoot, "artifacts/codex-operators/cache");
  const cacheFile = path.join(cacheDir, `pre-demo-intelligence-${cacheKey}.json`);
  try {
    return JSON.parse(await readFile(cacheFile, "utf8"));
  } catch {}

  const prompt = codexPreDemoIntelligencePrompt(manifest, localPreDemo, sessionTitle);
  const result = await runCodexOperator({
    prompt,
    sessionTitle,
    fileStem: `${companyFileSlug(manifest)}-pre-demo-intelligence`,
    timeoutMs: 240000
  });
  if (!result.ok) {
    throw new Error(`Codex pre-demo intelligence operator failed: ${result.error || "No output returned"}`);
  }
  if (!result.output?.trim()) {
    throw new Error("Codex pre-demo intelligence operator did not return analysis.");
  }
  const structured = parseCodexStructuredJson(result.output);
  const payload = {
    ok: true,
    structured,
    rawOutput: result.output.trim(),
    promptFile: result.promptFile,
    outputFile: result.outputFile,
    sessionTitle,
    error: "",
    cachedAt: new Date().toISOString()
  };
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cacheFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

function normalizeCodexPreDemoIntelligencePayload(structured, local, codex) {
  const source = objectOrEmpty(structured);
  const notesSource = objectOrEmpty(source.pre_demo_notes_analyzer || source.notes_analyzer || source);
  const discoverySource = objectOrEmpty(source.discovery_gap_analyzer || source.discovery || source);
  const metadataSource = objectOrEmpty(source.metadata || source.demo_metadata);
  const websiteContext = normalizedWebsiteContext(source.website_context || local.website_context);
  const fallbackNotes = {
    overall_score: local.overall_score,
    discovery_coverage_score: local.discovery_coverage_score,
    word_count: local.word_count,
    summary: local.summary,
    coverage_summary: local.coverage_summary,
    strong_areas: local.strong_areas,
    risk_areas: local.risk_areas,
    recommendations: local.recommendations,
    heatmap: local.heatmap
  };
  const fallbackDiscovery = {
    summary: local.coverage_summary,
    missing_discovery_items: local.missing_discovery_items,
    found_discovery_items: local.found_discovery_items,
    recommended_follow_up_questions: local.recommended_follow_up_questions
  };
  const notes = normalizeCodexNotes(notesSource, fallbackNotes);
  const discovery = normalizeCodexDiscovery(discoverySource, fallbackDiscovery);
  const strongest = notes.strong_areas || [];
  const risks = notes.risk_areas || [];
  const missing = discovery.missing_discovery_items || [];
  const questions = discovery.recommended_follow_up_questions || [];
  return {
    ...local,
    generated_at: new Date().toISOString(),
    source: "codex-pre-demo-structured-json",
    purpose: "Codex-backed scoring of only the pre-demo inputs before full demo generation.",
    admin_guidance: preDemoIntelligenceGuidance(),
    metadata: {
      ...(local.metadata || {}),
      ...metadataSource
    },
    website_context: websiteContext,
    overall_score: notes.overall_score,
    discovery_coverage_score: notes.discovery_coverage_score,
    word_count: notes.word_count,
    readiness_label: String(source.readiness_label || preDemoReadinessLabel(notes.overall_score)),
    summary: notes.summary,
    coverage_summary: notes.coverage_summary,
    strongest_area: String(source.strongest_area || strongest[0] || local.strongest_area || "No dominant strength detected yet"),
    biggest_risk: String(source.biggest_risk || risks[0] || missing[0] || local.biggest_risk || "No major pre-demo risk detected"),
    next_best_question: String(source.next_best_question || questions[0] || local.next_best_question || "Confirm the main business outcome the demo must prove."),
    strong_areas: strongest,
    risk_areas: risks,
    recommendations: notes.recommendations || [],
    heatmap: notes.heatmap || [],
    found_discovery_items: discovery.found_discovery_items || [],
    missing_discovery_items: missing,
    recommended_follow_up_questions: questions,
    codex_pre_demo_operator: {
      ok: true,
      promptFile: codex.promptFile,
      outputFile: codex.outputFile,
      sessionTitle: codex.sessionTitle,
      cachedAt: codex.cachedAt,
      error: ""
    }
  };
}

function preDemoIntelligenceFromDemoIntelligencePayload(intelligence) {
  if (!intelligence) return null;
  const notes = intelligence.pre_demo_notes_analyzer || {};
  const discovery = intelligence.discovery_gap_analyzer || {};
  const metadata = intelligence.demo_metadata || {};
  const strongest = notes.strong_areas || [];
  const risks = notes.risk_areas || [];
  const missing = discovery.missing_discovery_items || [];
  return {
    generated_at: intelligence.generated_at || new Date().toISOString(),
    source: metadata.intelligence_source || intelligence.intelligence_generated_by || "demo-intelligence",
    purpose: "Derived from the full Demo Intelligence result without running Codex again.",
    admin_guidance: preDemoIntelligenceGuidance(),
    metadata: {
      customer_name: metadata.customer_name || "Current demo",
      customer_url: metadata.customer_url || "",
      audience_type: metadata.audience_type || "",
      target_segment: metadata.target_segment || "",
      industry: metadata.industry || "",
      demo_strategy: metadata.strategy || "",
      demo_scope: metadata.demo_scope || "",
      input_mode: metadata.input_mode || ""
    },
    website_context: normalizedWebsiteContext(intelligence.website_context || {
      url: metadata.customer_url,
      summary: metadata.website_summary || metadata.customer_description,
      interesting_points: metadata.website_interesting_points,
      contradictions_or_checks: metadata.website_contradictions_or_checks
    }),
    overall_score: notes.overall_score,
    discovery_coverage_score: notes.discovery_coverage_score,
    word_count: notes.word_count,
    readiness_label: preDemoReadinessLabel(notes.overall_score),
    summary: notes.summary,
    coverage_summary: notes.coverage_summary,
    strongest_area: strongest[0] || "No dominant strength detected yet",
    biggest_risk: risks[0] || missing[0] || "No major pre-demo risk detected",
    next_best_question: discovery.recommended_follow_up_questions?.[0] || "Confirm the main business outcome the demo must prove.",
    strong_areas: strongest,
    risk_areas: risks,
    recommendations: notes.recommendations || [],
    heatmap: notes.heatmap || [],
    found_discovery_items: discovery.found_discovery_items || [],
    missing_discovery_items: missing,
    recommended_follow_up_questions: discovery.recommended_follow_up_questions || []
  };
}

function preDemoReadinessLabel(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "Needs notes";
  if (value >= 80) return "Ready for demo generation";
  if (value >= 65) return "Usable with follow-up";
  if (value >= 45) return "Needs discovery detail";
  return "High discovery risk";
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
    manifest.context?.competition,
    manifest.context?.demoRequest?.competition,
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
    competition: String(manifest.context?.competition || manifest.context?.demoRequest?.competition || ""),
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
    addRisk("Business impact language is light.", "Mention measurable outcomes earlier, such as close speed, margin control, risk reduction, decision confidence, or fewer spreadsheet handoffs.");
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
  const competition = context.competition || "the current process, incumbent systems, or another ERP option";
  const guidance = [
    {
      topic: "Unified Suite",
      why_it_matters: `Use only if the customer is struggling with disconnected systems or manual handoffs. Known competition/status quo context: ${competition}.`,
      recommended_demo_moment: "Move from standard reporting into the next in-scope proof point to show connected finance visibility."
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

function winStrategyAnalysis(context) {
  const competition = context.competition || "Status quo or shortlist not confirmed";
  const source = `${context.text || ""}\n${competition}`.toLowerCase();
  const strategies = [];
  const add = (title, whyWeCanWin, competitorLikelyMove, demoMove) => {
    strategies.push({ title, why_we_can_win: whyWeCanWin, competitor_likely_move: competitorLikelyMove, demo_move: demoMove });
  };

  if (/consolidat|oneworld|multi-country|multi country|local gaap|tax|e-invoic|jedox|entity|legal/.test(source)) {
    add(
      "Lead with consolidation confidence",
      "The notes show multi-country reporting, local GAAP, tax, e-invoicing, and Jedox dependency as central pain. Win by proving group visibility without losing local-entity detail.",
      "A competitor or incumbent process may position external consolidation or point reporting as good enough, especially if Jedox already works for part of the process.",
      "Start with executive/group visibility, then drill into entity, book, period, and transaction support so the audience sees both board-level control and finance-detail trust."
    );
  }

  if (/flight|charter|broker|route|aircraft|suiteprojects|project profitability|booking|veluxis/.test(source)) {
    add(
      "Turn flight complexity into a finance story",
      "Each flight behaves like a project with revenue, cost, route, aircraft, broker, customer, and transaction context. Win by making the operational model understandable inside finance.",
      "A competitor may keep this as a custom project layer, spreadsheet model, or operational-system discussion rather than connecting it cleanly to financial proof.",
      "Use a flight or booking profitability story after the executive overview, positioning SuiteProjects as the controlled proof point rather than a deep implementation workshop."
    );
  }

  if (/approval|ap|ar|dunning|invoice|document|email|manual|payment|template/.test(source)) {
    add(
      "Show context-aware finance work",
      "The notes point to manual AP, unclear approvals, dunning/documentation gaps, and customer-facing template needs. Win by showing finance users acting with context, not just processing transactions.",
      "A competitor may focus on isolated P2P or expense workflow automation, or the customer may assume the current email-heavy process can be patched.",
      "Show approval context, supporting documentation, standard reporting, and customer-facing output flexibility without over-demoing setup."
    );
  }

  if (/integration|odbc|crm|ibos|architecture|data flow|it director|it operations/.test(source)) {
    add(
      "Keep integration strategic, not technical-first",
      "IT cares about architecture, ODBC/reporting, CRM or booking references, and production stability. Win by showing the business process first, then explaining where governed integration fits.",
      "A competitor may try to pull the conversation into technical architecture or claim flexibility before the business case is anchored.",
      "Use standard reporting and source drilldown first, then discuss IBOS/booking references, ODBC, and integration as validation topics for IT."
    );
  }

  if (!strategies.length) {
    add(
      "Anchor on the most expensive business risk",
      "The notes do not yet show a single dominant competitor theme, so win by tying the demo to the biggest confirmed operational or finance risk.",
      "A competitor may run a broader feature tour if the customer has not forced a clear decision criterion.",
      "Open with the executive problem, prove the strongest standard workflow, and use follow-up questions to clarify the buying criteria."
    );
  }

  return {
    summary: `Win strategy is based on the pre-demo notes, scope, selected audience, and competition/status quo context: ${competition}.`,
    competition_context: competition,
    guidance_only: true,
    strategies: strategies.slice(0, 3)
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
  const line = String(body.line || "Let's show how NetSuite gives finance teams a clearer view of performance and the decisions behind it.").trim();
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
  const guide = await readOrGenerateScGuide(manifest);
  const payload = setupPromptPayload(manifest, guide);
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
  const command = codexCommand();

  return new Promise((resolve, reject) => {
    const child = spawn(command, ["app", projectRoot], { cwd: projectRoot, detached: true, stdio: "ignore" });
    child.on("error", reject);
    child.unref();
    resolve({ ok: true });
  });
}

function codexCommand() {
  return process.env.CODEX_BIN
    || (os.platform() === "darwin" ? "/Applications/Codex.app/Contents/Resources/codex" : "codex");
}

async function codexRuntimeStatus() {
  const command = codexCommand();
  try {
    const version = await collectProcessWithTimeout(command, ["--version"], 6000);
    return {
      ok: true,
      available: true,
      command,
      version: version.trim() || "Codex detected",
      mode: "background-operator",
      message: "Codex is detected and available for prep, SC guide, Intelligence, and AI actions."
    };
  } catch (error) {
    return {
      ok: true,
      available: false,
      command,
      version: "",
      mode: "not-available",
      message: error.message || "Codex was not detected on this machine."
    };
  }
}

function stopCurrentCodexOperator() {
  if (!currentCodexOperator?.child) {
    return { ok: true, stopped: false, message: "No Codex action is currently running." };
  }
  currentCodexOperator.stopRequested = true;
  currentCodexOperator.child.kill("SIGTERM");
  return {
    ok: true,
    stopped: true,
    message: `Stop requested for ${currentCodexOperator.sessionTitle || "the current Codex action"}.`
  };
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

function collectProcessWithTimeout(command, args, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, env: process.env });
    let output = "";
    let errorOutput = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} did not respond within ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { errorOutput += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(output || errorOutput);
      else reject(new Error(errorOutput || output || `${command} exited with code ${code}`));
    });
  });
}

async function runCodexOperator({ prompt, sessionTitle, fileStem, timeoutMs = 240000 }) {
  const operatorDir = path.join(projectRoot, "artifacts/codex-operators");
  await mkdir(operatorDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const safeStem = slugify(fileStem || sessionTitle || "codex-operator") || "codex-operator";
  const promptFile = path.join(operatorDir, `${stamp}-${safeStem}-prompt.md`);
  const outputFile = path.join(operatorDir, `${stamp}-${safeStem}-output.md`);
  await writeFile(promptFile, prompt, "utf8");

  const command = codexCommand();
  const execArgs = [
    "-C", projectRoot,
    "--sandbox", "read-only",
    "--skip-git-repo-check",
    "--output-last-message", outputFile,
    "-"
  ];
  const attempts = [
    ["--search", "--ask-for-approval", "never", "exec", ...execArgs],
    ["--ask-for-approval", "never", "exec", ...execArgs]
  ];

  let lastError = "";
  let lastLog = "";
  for (const args of attempts) {
    try {
      const log = await collectProcessWithInput(command, args, prompt, timeoutMs, sessionTitle);
      const output = await readFile(outputFile, "utf8").catch(() => "");
      return {
        ok: true,
        promptFile,
        outputFile,
        output: output || log,
        log
      };
    } catch (error) {
      lastError = error.message;
      lastLog = error.output || "";
      if (!String(error.message || "").includes("--search")) break;
    }
  }

  return {
    ok: false,
    promptFile,
    outputFile,
    output: "",
    log: lastLog,
    error: lastError || "Codex background operator failed."
  };
}

function collectProcessWithInput(command, args, input, timeoutMs, sessionTitle = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, env: process.env });
    let output = "";
    let errorOutput = "";
    const operatorState = {
      child,
      sessionTitle,
      startedAt: new Date().toISOString(),
      stopRequested: false
    };
    currentCodexOperator = operatorState;
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      const error = new Error(`Codex operator timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
      error.output = `${output}\n${errorOutput}`.trim();
      reject(error);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { errorOutput += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timeout);
      if (currentCodexOperator === operatorState) currentCodexOperator = null;
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (currentCodexOperator === operatorState) currentCodexOperator = null;
      if (operatorState.stopRequested) {
        const error = new Error("Codex background action stopped by user.");
        error.output = `${output}\n${errorOutput}`.trim();
        reject(error);
      } else if (code === 0) {
        resolve(output);
      } else {
        const error = new Error(errorOutput || output || `${command} exited with code ${code}`);
        error.output = `${output}\n${errorOutput}`.trim();
        reject(error);
      }
    });
    child.stdin.end(input);
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
  if (mode === "dry-run-prep") {
    const { namedManifestPath, promptCreatedAt } = await refreshRunnableManifestForRun("dry-run-prep");
    const prep = await prepareAccountBuffer();
    const open = await runProcess("node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", "--open-browser"]);
    return {
      ok: open.ok,
      log: [
        "Dry-run prep complete.",
        `Dry-run manifest created from the Dry-run creation prompt: ${namedManifestPath}`,
        promptCreatedAt ? `Dry-run creation prompt timestamp: ${promptCreatedAt}` : "",
        "",
        prep.log,
        "",
        "Browser launch:",
        open.log || ""
      ].join("\n")
    };
  }
  if (mode === "buffer-dry-run") {
    const { namedManifestPath, promptCreatedAt } = await refreshRunnableManifestForRun("buffer-dry-run");
    const prep = await prepareAccountBuffer();
    const run = await runProcess("node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", "--rehearse", "--audio=none", `--value-intensity=${valueIntensity}`]);
    return {
      ...run,
      log: [
        `Dry-run manifest refreshed from the Dry-run creation prompt: ${namedManifestPath}`,
        promptCreatedAt ? `Dry-run creation prompt timestamp: ${promptCreatedAt}` : "",
        "",
        prep.log,
        "",
        "Buffer dry-run:",
        run.log || ""
      ].filter(Boolean).join("\n")
    };
  }

  const commands = {
    open: ["node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", "--open-browser"]],
    dry: ["node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", "--dry-run", "--audio=none", `--value-intensity=${valueIntensity}`]],
    live: ["node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", `--audio=${voiceProvider}`, `--value-intensity=${valueIntensity}`, `--voice=${voice}`]]
  };
  const command = commands[mode];
  if (!command) throw new Error(`Unknown run mode: ${mode}`);
  if (mode === "live") {
    const { namedManifestPath, promptCreatedAt } = await refreshRunnableManifestForRun("live-demo");
    const run = await runProcess(command[0], command[1], { env: voiceEnv });
    return {
      ...run,
      log: [
        `Dry-run manifest refreshed from the Dry-run creation prompt before live demo: ${namedManifestPath}`,
        promptCreatedAt ? `Dry-run creation prompt timestamp: ${promptCreatedAt}` : "",
        "",
        run.log || ""
      ].filter(Boolean).join("\n")
    };
  }
  return runProcess(command[0], command[1], { env: voiceEnv });
}

async function runDatasetAnalysis(body = {}) {
  const valueIntensity = body.valueIntensity || "balanced";
  const { namedManifestPath, promptCreatedAt } = await refreshRunnableManifestForRun("dataset-analysis");
  const prep = await prepareAccountBuffer();
  const run = await runProcess("node", ["src/demo-runner.mjs", "--manifest", "manifests/finance-pl-cash360.demo.json", "--rehearse", "--audio=none", `--value-intensity=${valueIntensity}`]);
  const manifest = await readManifest();
  const guide = await readOrGenerateScGuide(manifest);
  const setupPayload = setupPromptPayload(manifest, guide);
  const cache = await readRunCache(manifest).catch(() => null);
  const analysis = buildDatasetAnalysisPayload({
    manifest,
    guide,
    setupPayload,
    prep,
    run,
    cache,
    namedManifestPath,
    promptCreatedAt
  });
  await saveDatasetAnalysis(analysis);
  return analysis;
}

async function executeDatasetSetupPrompt(body = {}) {
  if (!body.confirmed) throw new Error("Confirm the NetSuite account and dataset/customization items before executing.");
  const latest = await readLatestDatasetAnalysis();
  const account = latest.account || {};
  if (body.account && account.account && body.account !== account.account) {
    throw new Error(`Account mismatch. Expected ${account.account}, got ${body.account}.`);
  }
  const promptDir = path.join(projectRoot, "artifacts/codex-prompts");
  await mkdir(promptDir, { recursive: true });
  const promptFile = path.join(promptDir, `${latest.companySlug || "netsuite-demo"}-dataset-setup-prompt.md`);
  await writeFile(promptFile, latest.codexPrompt || "", "utf8");
  await copyToClipboard(latest.codexPrompt || "").catch(() => {});
  const browserOpened = await openNetSuiteBrowserDetached().catch((error) => ({ ok: false, error: error.message }));
  const codexOpened = await openCodexWorkspace().catch((error) => ({ ok: false, error: error.message }));
  return {
    ok: true,
    promptFile,
    account,
    items: latest.actionItems || [],
    browserOpened,
    codexOpened,
    message: "Dataset setup prompt created and copied to clipboard. NetSuite and Codex were opened where possible; paste the prompt into a new Codex session before executing."
  };
}

function buildDatasetAnalysisPayload({ manifest, guide, setupPayload, prep, run, cache, namedManifestPath, promptCreatedAt }) {
  const setupItems = setupPayload.setupPlan.items || [];
  const failedActions = datasetRunActions(cache, "failed");
  const skippedActions = datasetRunActions(cache, "skipped");
  const passedActions = datasetRunActions(cache, "ok");
  const missingData = datasetMissingDataItems(setupItems, failedActions);
  const missingCustomizations = datasetCustomizationItems(setupItems, failedActions, skippedActions);
  const score = Math.max(0, Math.min(100, 100 - (missingData.length * 9) - (missingCustomizations.length * 11) - (failedActions.length * 12) - (skippedActions.length * 4)));
  const actionItems = uniqueDatasetItems([...missingData, ...missingCustomizations]);
  const status = score >= 80 && run.ok ? "dataset-ready" : score >= 60 ? "needs-light-prep" : "prep-required";
  const summary = run.ok
    ? "The dry-run completed, so this score focuses on setup items, optional skips, and remaining data/customization gaps."
    : "The dry-run did not fully complete, so failed navigation or missing UI evidence is treated as dataset-prep risk.";
  const prompt = datasetSetupCodexPrompt({
    manifest,
    guide,
    setupPayload,
    score,
    status,
    summary,
    actionItems,
    missingData,
    missingCustomizations,
    failedActions,
    skippedActions,
    runLog: run.log || ""
  });
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: "browser-dry-run-dataset-analysis",
    companySlug: companyFileSlug(manifest),
    manifest: {
      name: manifest.name,
      id: manifest.id,
      company: manifest.context?.company?.companyName || manifest.name || "Current demo",
      demoScope: manifest.context?.demoScope || manifest.context?.demoRequest?.demoScope || "",
      dryRunManifestPath: namedManifestPath,
      dryRunPromptCreatedAt: promptCreatedAt
    },
    account: setupPayload.account,
    score,
    status,
    readinessLabel: datasetReadinessLabel(score, run.ok),
    summary,
    runCompleted: Boolean(run.ok && cache?.status === "completed"),
    runStatus: cache?.status || (run.ok ? "completed" : "failed-or-not-cached"),
    cachePath: runCachePathForManifest(manifest),
    prepBufferFile: prep.file,
    setupPromptSource: setupPayload.promptSource,
    missingData,
    missingCustomizations,
    passedEvidence: passedActions.slice(0, 12),
    failedActions,
    skippedActions,
    actionItems,
    recommendations: datasetRecommendations(score, run.ok, actionItems, failedActions, skippedActions),
    codexPrompt: prompt,
    runLog: [prep.log, "", "Dataset dry-run:", run.log || ""].join("\n"),
    promptFile: path.join(projectRoot, "artifacts/codex-prompts", `${companyFileSlug(manifest)}-dataset-setup-prompt.md`)
  };
}

function datasetRunActions(cache, status) {
  const segments = Array.isArray(cache?.segments) ? cache.segments : [];
  return segments.flatMap((segment) => (segment.actions || [])
    .filter((action) => status === "ok" ? !["failed", "skipped"].includes(action.status) : action.status === status)
    .map((action) => ({
      segment: segment.title || segment.id,
      type: action.type,
      target: action.target || "",
      url: action.url || "",
      error: action.error || "",
      elapsedMs: action.elapsedMs || 0
    })));
}

function datasetMissingDataItems(setupItems, failedActions) {
  const setupData = (setupItems || [])
    .filter((item) => ["entity", "item", "transaction"].includes(item.type))
    .map((item) => ({
      type: "data",
      label: item.label,
      reason: item.reason,
      source: "SC guide setup inference",
      risk: item.risk || "medium"
    }));
  const runData = failedActions
    .filter((action) => /(waitForText|waitForAnyText|highlightText|clickText|globalSearchOpen)/i.test(action.type))
    .map((action) => ({
      type: "data",
      label: action.target ? `Missing or unreachable evidence: ${action.target}` : `Failed dry-run step: ${action.segment}`,
      reason: action.error || "The dry-run could not find expected page evidence.",
      source: action.segment,
      risk: "high"
    }));
  return uniqueDatasetItems([...setupData, ...runData]);
}

function datasetCustomizationItems(setupItems, failedActions, skippedActions) {
  const configItems = (setupItems || [])
    .filter((item) => item.type === "configuration" || /(approval|role|permission|dashboard|search|report|fixed asset|planning|cash 360|subsidiary|entity)/i.test(item.label))
    .map((item) => ({
      type: "customization",
      label: item.label,
      reason: item.reason,
      source: "SC guide setup inference",
      risk: item.risk || "medium"
    }));
  const runItems = [...failedActions, ...skippedActions]
    .filter((action) => /(role|permission|approval|dashboard|report|accounting book|subsidiary|cash|fixed asset|planning|export|view detail)/i.test(`${action.segment} ${action.target} ${action.error}`))
    .map((action) => ({
      type: "customization",
      label: action.target ? `Check configuration for: ${action.target}` : `Check configuration for ${action.segment}`,
      reason: action.error || "The dry-run skipped or failed an expected proof point.",
      source: action.segment,
      risk: action.error ? "high" : "medium"
    }));
  return uniqueDatasetItems([...configItems, ...runItems]);
}

function uniqueDatasetItems(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = `${item.type}:${item.label}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function datasetRecommendations(score, runOk, actionItems, failedActions, skippedActions) {
  const recommendations = [];
  if (!runOk) recommendations.push("Fix the failed dry-run route first; dataset scoring is less reliable until the browser path completes.");
  if (actionItems.length) recommendations.push("Use the Codex setup prompt to inspect the NetSuite account and prepare only the missing data or configuration that supports the SC story.");
  if (failedActions.length) recommendations.push("Review failed segments and add stable report data, permissions, or standard-page access before rehearsal.");
  if (skippedActions.length) recommendations.push("Decide whether skipped optional proof points should be prepared or removed from the dry-run.");
  if (score >= 80 && !actionItems.length) recommendations.push("Dataset looks ready for rehearsal; keep the account read-only unless the SC adds new scope.");
  return recommendations;
}

function datasetReadinessLabel(score, runOk) {
  if (!runOk) return "Dry-run needs attention";
  if (score >= 85) return "Dataset ready";
  if (score >= 70) return "Light prep recommended";
  if (score >= 50) return "Prep required";
  return "High dataset risk";
}

function datasetSetupCodexPrompt({ manifest, guide, setupPayload, score, status, summary, actionItems, missingData, missingCustomizations, failedActions, skippedActions, runLog }) {
  const account = setupPayload.account || {};
  return `You are helping prepare a NetSuite account for a NetSuite Demo Helper dry-run.

CRITICAL ACCESS AND SAFETY RULES
- You must have both front-end browser access and back-end NetSuite access before executing changes.
- Front-end access means the browser is logged into the target NetSuite account and role and can navigate the UI.
- Back-end access means you can inspect or create required records/configuration through an approved NetSuite backend path such as SuiteScript, REST, saved imports, or another administrative mechanism.
- First confirm the visible account, role, and environment. Stop if the account does not match the target below.
- Do not create, edit, save, approve, post, import, delete, or submit anything until the user confirms the exact items to prepare.
- Prefer read-only inspection first. Produce a gap list before doing writes.

TARGET NETSUITE ACCOUNT
- Account: ${account.account || "unknown"}
- Host: ${account.host || "unknown"}
- Base URL: ${account.baseUrl || "unknown"}
- Role: ${account.role || "unknown"}

DEMO CONTEXT
- Demo: ${manifest.name || "NetSuite demo"}
- Company: ${manifest.context?.company?.companyName || "the prospect"}
- Demo scope: ${manifest.context?.demoScope || manifest.context?.demoRequest?.demoScope || "Not specified"}
- Audience: ${manifest.context?.audience?.label || manifest.audience || "Not selected"}
- Target segment: ${manifest.context?.marketSegment?.label || manifest.context?.targetAudience?.label || "Not selected"}
- Demo strategy: ${manifest.context?.demoStrategy?.label || "Not selected"}

DATASET ANALYSIS RESULT
- Score: ${score}/100
- Status: ${status}
- Summary: ${summary}

MISSING DATA ITEMS
${datasetPromptList(missingData)}

MISSING CUSTOMIZATIONS OR CONFIGURATION
${datasetPromptList(missingCustomizations)}

FAILED OR RISKY DRY-RUN EVIDENCE
${datasetPromptList(failedActions.map((action) => ({
    label: `${action.segment}: ${action.type} ${action.target}`.trim(),
    reason: action.error || "Failed during dry-run",
    risk: "high"
  })))}

OPTIONAL SKIPS TO REVIEW
${datasetPromptList(skippedActions.map((action) => ({
    label: `${action.segment}: ${action.type} ${action.target}`.trim(),
    reason: action.error || "Optional step skipped during dry-run",
    risk: "medium"
  })))}

CURRENT NETSUITE PREP SUMMARY FROM THE SC GUIDE
${markdownSection(guide, "NetSuite Prep Summary") || "No NetSuite Prep Summary section found."}

TASK
1. Open or use the existing NetSuite browser session for the target account.
2. Confirm front-end and back-end NetSuite access.
3. Inspect whether the missing data and customizations already exist.
4. Produce a gap list: existing, missing, risky, not required.
5. Ask the user to confirm exactly what should be created or changed.
6. After confirmation, create only the approved items.
7. Keep everything aligned to the dry-run story and demo scope.
8. Prefer standard NetSuite objects, standard reports, standard dashboards, and minimal demo data.
9. Avoid custom reports or custom configuration unless the dataset analysis clearly requires it.
10. Summarize what was checked or created and which dry-run segment it supports.

DRY-RUN LOG EXCERPT
${String(runLog || "").slice(0, 7000)}
`;
}

function datasetPromptList(items) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return "- None detected.";
  return list.map((item, index) => `${index + 1}. ${item.label || item.target || "Dataset item"}${item.risk ? ` (${item.risk} risk)` : ""}
   - Reason: ${item.reason || item.error || "Needs inspection."}
   - Source: ${item.source || item.segment || "dataset analysis"}`).join("\n");
}

function runCachePathForManifest(manifest) {
  return path.resolve(projectRoot, manifest.defaults?.cache?.file || "artifacts/cache/demo-cache.json");
}

async function readRunCache(manifest) {
  return JSON.parse(await readFile(runCachePathForManifest(manifest), "utf8"));
}

async function saveDatasetAnalysis(analysis) {
  const dir = path.join(projectRoot, "artifacts/dataset-analysis");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${analysis.companySlug || "netsuite-demo"}-latest.json`);
  await writeFile(file, `${JSON.stringify({ ...analysis, latestFile: file }, null, 2)}\n`, "utf8");
  await mkdir(path.dirname(analysis.promptFile), { recursive: true });
  await writeFile(analysis.promptFile, analysis.codexPrompt, "utf8");
}

async function readLatestDatasetAnalysis() {
  const manifest = await readManifest();
  const file = path.join(projectRoot, "artifacts/dataset-analysis", `${companyFileSlug(manifest)}-latest.json`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    const guide = await readOrGenerateScGuide(manifest);
    const setupPayload = setupPromptPayload(manifest, guide);
    const analysis = buildDatasetAnalysisPayload({
      manifest,
      guide,
      setupPayload,
      prep: { file: "" },
      run: { ok: false, log: "Dataset analysis has not been run yet." },
      cache: null,
      namedManifestPath: "",
      promptCreatedAt: ""
    });
    await saveDatasetAnalysis(analysis);
    return analysis;
  }
}

async function refreshRunnableManifestForRun(runSource) {
  const manifest = await readManifest();
  const guide = await readOrGenerateScGuide(manifest);
  const nextManifest = applyDryRunCreationPromptToRunnableManifest(manifest, guide, { runSource });
  await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
  const namedManifestPath = await writeNamedManifestCopy(nextManifest);
  return {
    manifest: nextManifest,
    namedManifestPath,
    promptCreatedAt: nextManifest.context?.dryRunCreationPrompt?.createdAt || ""
  };
}

async function prepareAccountBuffer() {
  const manifest = await readManifest();
  const guide = await readOrGenerateScGuide(manifest);
  const payload = setupPromptPayload(manifest, guide);
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
  const defaultPrepData = defaultTestPrepData();
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
      .codex-runtime-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 34px;
        padding: 7px 10px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: #fff;
        color: var(--muted);
        font-size: 12px;
        font-weight: 750;
        white-space: nowrap;
      }
      .codex-runtime-badge .dot {
        width: 9px;
        height: 9px;
        border-radius: 999px;
        background: #c48200;
        box-shadow: 0 0 0 4px rgba(196, 130, 0, .12);
      }
      .codex-runtime-badge.ready {
        color: #155d37;
        border-color: #b9dfc9;
        background: #f1fbf5;
      }
      .codex-runtime-badge.ready .dot {
        background: #16854f;
        box-shadow: 0 0 0 4px rgba(22, 133, 79, .14);
      }
      .codex-runtime-badge.missing {
        color: #8c2518;
        border-color: #f2b9af;
        background: #fff5f3;
      }
      .codex-runtime-badge.missing .dot {
        background: #c94b35;
        box-shadow: 0 0 0 4px rgba(201, 75, 53, .14);
      }
      .codex-info-button {
        min-height: 34px;
        padding: 7px 10px;
        border-radius: 999px;
        border-color: var(--line);
        background: #fff;
        color: var(--accent-dark);
        font-size: 12px;
        font-weight: 800;
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
      body.night .codex-runtime-badge,
      body.night .codex-info-button,
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
      body.night .codex-runtime-badge.ready {
        background: #10231b;
        border-color: #246245;
        color: #93e2b3;
      }
      body.night .codex-runtime-badge.missing {
        background: #2a1411;
        border-color: #7b3026;
        color: #ffb4a6;
      }
      body.night .codex-info-button {
        background: #121c25;
        color: #8ae0de;
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
    a.button-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--accent);
      border-radius: 6px;
      padding: 8px 10px;
      text-decoration: none;
      font-weight: 750;
      font-size: 12px;
      background: white;
      color: var(--accent-dark);
      white-space: nowrap;
    }
    button.ai-action-active,
    button.secondary.ai-action-active {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
      box-shadow: 0 6px 16px rgba(30, 139, 139, .18);
    }
    body.night button.ai-action-active,
    body.night button.secondary.ai-action-active {
      background: var(--accent);
      color: white;
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
    .codex-progress {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 900;
      width: min(420px, calc(100vw - 32px));
      border: 1px solid #b9dadd;
      border-radius: 12px;
      background: rgba(255, 255, 255, .96);
      box-shadow: 0 18px 48px rgba(24, 33, 47, .18);
      padding: 14px;
      backdrop-filter: blur(12px);
    }
    body.night .codex-progress {
      background: rgba(15, 24, 33, .96);
      border-color: #294a50;
      box-shadow: 0 18px 48px rgba(0, 0, 0, .38);
    }
    .codex-progress[hidden] { display: none; }
    .codex-progress-head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
    }
    .codex-progress-title {
      margin: 0;
      font-size: 14px;
      font-weight: 850;
    }
    .codex-progress-message {
      margin: 3px 0 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .codex-progress-pill {
      border-radius: 999px;
      padding: 4px 8px;
      background: #eaf7f7;
      color: var(--accent-dark);
      font-size: 11px;
      font-weight: 850;
      white-space: nowrap;
    }
    body.night .codex-progress-pill {
      background: #123137;
      color: #8ae0de;
    }
    .codex-progress-track {
      position: relative;
      height: 9px;
      border-radius: 999px;
      background: #e3edf0;
      overflow: hidden;
    }
    body.night .codex-progress-track { background: #20313b; }
    .codex-progress-fill {
      position: absolute;
      inset: 0 auto 0 0;
      width: 42%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--accent), #56b8a4);
      animation: codex-progress 1.35s ease-in-out infinite;
    }
    @keyframes codex-progress {
      0% { transform: translateX(-105%); }
      50% { transform: translateX(65%); }
      100% { transform: translateX(245%); }
    }
    .codex-progress-steps {
      display: grid;
      gap: 6px;
      margin-top: 11px;
    }
    .codex-progress-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }
    .codex-progress-actions button {
      padding: 7px 10px;
      font-size: 12px;
    }
    .codex-progress-step {
      display: flex;
      gap: 7px;
      align-items: center;
      color: var(--muted);
      font-size: 12px;
    }
    .codex-progress-step::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: #b7c3cd;
    }
    .codex-progress-step.active {
      color: var(--ink);
      font-weight: 750;
    }
    .codex-progress-step.active::before {
      background: var(--accent);
      box-shadow: 0 0 0 4px rgba(0, 122, 122, .12);
    }
    .codex-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 960;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(12, 18, 26, .42);
    }
    .codex-modal-backdrop[hidden] { display: none; }
    .codex-modal {
      width: min(720px, 100%);
      max-height: min(760px, calc(100vh - 48px));
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fff;
      box-shadow: 0 24px 70px rgba(24, 33, 47, .26);
      padding: 18px;
    }
    body.night .codex-modal {
      background: #0f1821;
      box-shadow: 0 24px 70px rgba(0, 0, 0, .45);
    }
    .codex-modal-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--line);
    }
    .codex-modal-head h2 {
      margin: 0;
      font-size: 18px;
    }
    .codex-modal-head p {
      margin: 5px 0 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .codex-modal-body {
      display: grid;
      gap: 12px;
      margin-top: 14px;
    }
    .codex-info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
      gap: 10px;
    }
    .codex-info-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px;
      background: #fbfcfd;
    }
    body.night .codex-info-card { background: #0b1218; }
    .codex-info-card strong {
      display: block;
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 5px;
    }
    .codex-info-card span,
    .codex-info-card code {
      overflow-wrap: anywhere;
      font-size: 13px;
    }
    .codex-flow-list {
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.45;
      font-size: 13px;
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
    .ai-action-explainer {
      margin: 12px 0 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .action-preview-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-top: 12px;
    }
    .action-preview-head strong {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: var(--accent-dark);
    }
    .action-preview-head button {
      flex: 0 0 auto;
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
    .website-context-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fbfcfd;
      padding: 12px;
    }
    body.night .website-context-card { background: #0b1218; }
    .website-context-card h3 {
      margin: 0 0 6px;
      font-size: 14px;
      color: var(--accent-dark);
    }
    .website-context-card p {
      margin: 0 0 8px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .website-context-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
      gap: 10px;
      margin-top: 8px;
    }
    .website-context-list {
      margin: 6px 0 0;
      padding-left: 18px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.4;
    }
    .website-context-alert {
      border-color: #f2c36b;
      background: #fff8e8;
    }
    body.night .website-context-alert {
      background: #241b0b;
    }
    .intelligence-card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
      gap: 12px;
      transition: gap .18s ease;
    }
    .intelligence-card {
      text-align: left;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 13px;
      background: #fff;
      color: var(--ink);
      min-height: 205px;
      display: grid;
      grid-template-rows: auto auto auto minmax(36px, auto) 1fr;
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
    .intelligence-card-grid.compact {
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr));
      gap: 8px;
    }
    .intelligence-card-grid.compact .intelligence-card {
      min-height: 84px;
      padding: 10px;
      grid-template-rows: auto auto;
      gap: 6px;
      border-radius: 10px;
    }
    .intelligence-card-grid.compact .intelligence-card.active {
      background: #f1fbfb;
    }
    body.night .intelligence-card-grid.compact .intelligence-card.active {
      background: #10252c;
    }
    .intelligence-card-grid.compact .card-title-row {
      min-height: 0;
      align-items: center;
    }
    .intelligence-card-grid.compact .card-title {
      font-size: 13px;
    }
    .intelligence-card-grid.compact .card-metric {
      font-size: 13px;
      color: var(--muted);
    }
    .intelligence-card-grid.compact .card-summary,
    .intelligence-card-grid.compact .preview-list,
    .intelligence-card-grid.compact .hint {
      display: none;
    }
    .card-title-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: flex-start;
      min-height: 38px;
    }
    .card-title {
      font-size: 15px;
      font-weight: 850;
      margin: 0;
      line-height: 1.25;
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
      white-space: nowrap;
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
      grid-template-columns: 1fr;
      gap: 12px;
      margin-top: 12px;
    }
    .operator-output {
      white-space: pre-wrap;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #fff;
      color: var(--ink);
      max-height: 420px;
      overflow: auto;
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    body.night .operator-output { background: #0f1821; }
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
    .api-instruction-list {
      display: grid;
      gap: 8px;
      margin-top: 12px;
      max-height: 360px;
      overflow: auto;
    }
    .api-instruction-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: #fbfcfd;
    }
    body.night .api-instruction-item { background: #0b1218; }
    .api-instruction-item strong {
      display: block;
      font-size: 13px;
    }
    .api-instruction-item span {
      color: var(--muted);
      font-size: 12px;
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
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
      gap: 18px;
      width: 100%;
    }
    .prep-grid {
      grid-template-columns: minmax(0, 1.45fr) minmax(320px, .75fr);
      grid-template-areas:
        "scope scope"
        "audience audience"
        "actions actions"
        "instructions instructions"
        "voice voice"
        "narrator narrator"
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
    .scope-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(190px, .48fr);
      gap: 12px;
      align-items: start;
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
    .persona-preview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .persona-preview-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fbfcfd;
      padding: 12px;
      min-height: 210px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
      overflow: hidden;
    }
    body.night .persona-preview-card { background: #0b1218; }
    .persona-preview-card::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 4px;
      background: var(--accent);
      opacity: .8;
    }
    .persona-preview-card h3 {
      margin: 0;
      font-size: 15px;
      line-height: 1.25;
      padding-left: 2px;
    }
    .persona-role {
      margin: -4px 0 0;
      color: var(--muted);
      font-size: 12px;
      font-weight: 750;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .persona-preview-card p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.42;
    }
    .persona-preview-card strong {
      color: var(--ink);
    }
    .persona-preview-card ul {
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.35;
    }
    .persona-preview-card li + li { margin-top: 4px; }
    .win-strategy-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .win-strategy-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fbfcfd;
      padding: 13px;
      display: grid;
      gap: 9px;
      min-height: 210px;
    }
    body.night .win-strategy-card { background: #0b1218; }
    .win-strategy-card h3 {
      margin: 0;
      font-size: 15px;
      line-height: 1.28;
    }
    .win-strategy-card p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.42;
    }
    .win-strategy-card strong { color: var(--ink); }
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
    #dryRunCreationPrompt {
      min-height: 300px;
      font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .guide-prompt-details {
      margin-top: 16px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      background: #fbfcfd;
    }
    body.night .guide-prompt-details { background: #0b1218; }
    .guide-prompt-details summary {
      cursor: pointer;
      font-weight: 850;
      color: var(--accent-dark);
    }
    .pre-demo-dashboard {
      display: grid;
      gap: 18px;
    }
    .pre-demo-intel-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
      gap: 12px;
    }
    .pre-demo-score-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px;
      background: #fbfcfd;
    }
    body.night .pre-demo-score-card { background: #0b1218; }
    .pre-demo-score-card strong {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
    }
    .follow-up-toolbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
    }
    .follow-up-comments {
      display: grid;
      gap: 8px;
      margin: 8px 0 14px;
    }
    .follow-up-comments textarea {
      min-height: 88px;
      resize: vertical;
    }
    .follow-up-card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }
    .follow-up-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px;
      background: #fbfcfd;
      min-height: 150px;
      display: grid;
      gap: 8px;
    }
    body.night .follow-up-card { background: #0b1218; }
    .follow-up-card-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
    }
    .follow-up-number {
      width: 28px;
      height: 28px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #e9f7f4;
      color: var(--accent-dark);
      font-weight: 850;
      font-size: 12px;
    }
    body.night .follow-up-number { background: #12322f; }
    .follow-up-question {
      font-weight: 800;
      color: var(--text);
      line-height: 1.35;
    }
    .follow-up-note {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
      margin: 0;
    }
    .follow-up-support-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
      gap: 12px;
      margin-top: 10px;
    }
    .follow-up-markdown {
      margin-top: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #f7fafb;
    }
    body.night .follow-up-markdown { background: #091017; }
    .follow-up-markdown pre {
      margin: 8px 0 0;
      white-space: pre-wrap;
      font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: var(--muted);
      max-height: 320px;
      overflow: auto;
    }
    .dataset-hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 160px;
      gap: 18px;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 18px;
      background: linear-gradient(135deg, #f8fcfb 0%, #eef7f4 100%);
    }
    body.night .dataset-hero { background: linear-gradient(135deg, #0b1218 0%, #10222a 100%); }
    .dataset-score {
      text-align: center;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px;
      background: rgba(255,255,255,.76);
    }
    body.night .dataset-score { background: rgba(8, 14, 20, .68); }
    .dataset-score strong {
      display: block;
      font-size: 36px;
      line-height: 1;
      color: var(--accent-dark);
    }
    .dataset-score span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      margin-top: 6px;
    }
    .dataset-card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
      gap: 12px;
    }
    .dataset-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      background: #fbfcfd;
      min-height: 132px;
    }
    body.night .dataset-card { background: #0b1218; }
    .dataset-card strong {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
    }
    .dataset-card ul {
      margin: 8px 0 0;
      padding-left: 18px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    #datasetPrompt {
      min-height: 320px;
      font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .page-load-bar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin: -4px 0 14px;
      min-height: 26px;
    }
    .page-load-info {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 5px 9px;
      background: #fbfcfd;
      color: var(--muted);
      font-size: 12px;
      font-weight: 750;
      white-space: nowrap;
    }
    body.night .page-load-info { background: #0b1218; }
    .page-load-info.stale {
      border-color: #f2a7a7;
      background: #fff5f5;
      color: #b42318;
    }
    body.night .page-load-info.stale {
      border-color: #6f1d1d;
      background: #2a1010;
      color: #ffb4a8;
    }
    .page-load-info::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent);
      opacity: .75;
    }
    .page-load-info.stale::before {
      background: #d92d20;
      opacity: 1;
    }
    .live-demo-disabled [data-live-demo-only] {
      display: none !important;
    }
    .feature-toggle-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px;
      background: #fbfcfd;
      margin-top: 12px;
    }
    body.night .feature-toggle-card { background: #0b1218; }
    .feature-toggle-card label {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0;
      font-weight: 850;
      color: var(--text);
    }
    .feature-toggle-card input {
      width: auto;
      transform: scale(1.12);
    }
    @media (max-width: 880px) {
      .grid { grid-template-columns: 1fr; }
      .prep-grid {
        grid-template-columns: 1fr;
        grid-template-areas:
          "scope"
          "audience"
          "actions"
          "instructions"
          "voice"
          "narrator"
          "how";
      }
      .field-grid { grid-template-columns: 1fr; }
      .scope-grid { grid-template-columns: 1fr; }
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
  <body class="${liveDemoFunctionalityEnabled ? "" : "live-demo-disabled"}">
    <header>
      <h1>NetSuite Demo Helper</h1>
      <div class="header-actions">
        <div id="codexRuntimeBadge" class="codex-runtime-badge checking" title="Checking whether the local Codex app can be used as the reasoning backbone.">
          <span class="dot" aria-hidden="true"></span>
          <span id="codexRuntimeText">Checking Codex</span>
        </div>
        <button class="codex-info-button" id="codexInfoButton" data-help="Shows which parts of the helper are using Codex and where the latest Codex output was saved.">Backbone</button>
        <label class="theme-toggle" for="nightMode">
          <input type="checkbox" id="nightMode">
          Night mode
        </label>
      </div>
    </header>
  <nav class="tabs" aria-label="Workspace screens">
    <button class="tab active" data-tab="prep" data-help="Enter the customer website, audience, scope, demo request, pre-demo notes, narration voice, and generator instructions before creating anything.">Prep</button>
    <button class="tab" data-tab="guide" data-help="Review the Codex-created SC story, setup prompt, asset prompt, and Dry-run creation prompt. Export the SC guide to Word from here.">SC Guide</button>
    <button class="tab" data-tab="pre-demo-intelligence" data-help="Check whether the pre-demo notes are strong enough. This page scores discovery quality, shows missing context, generates follow-up questions, and exports them to Word.">Pre-Demo Intelligence</button>
    <button class="tab" data-tab="intelligence" data-help="Review the generated demo and SC guide for risks, pacing, stakeholder coverage, winning moments, and suggested improvements.">Demo Intelligence</button>
    <button class="tab" data-tab="manifest" data-live-demo-only data-help="Review or edit the runnable dry-run manifest created from the SC Guide tab's Dry-run creation prompt.">Dry-Run</button>
    <button class="tab" data-tab="dataset" data-live-demo-only data-help="Run the dry-run through the browser and score whether the NetSuite dataset, permissions, and demo setup are ready.">Dataset Analysis</button>
    <button class="tab" data-tab="run" data-live-demo-only data-help="Prepare NetSuite, buffer the dry-run, run the narrated live demo, or stop an active browser automation.">Run</button>
    <button class="tab" data-tab="admin" data-help="Edit shared helper guidance, demo logic sources, labels, playbooks, and versioned CMS content.">Admin</button>
    </nav>
  <main>
    <section class="screen active" id="screen-prep">
      <div class="grid prep-grid">
        <div class="panel prep-scope">
          <h2>Demo Scope</h2>
          <div class="scope-grid">
            <div>
              <label for="demoScope">What should this demo cover?</label>
              <textarea id="demoScope" style="min-height:95px" placeholder="Example: financials first services SKU, P2P phase 2, fixed assets, FP&A, advanced inventory.">${escapeHtml(defaultPrepData.demoScope)}</textarea>
            </div>
            <div>
              <label for="competition">Competition</label>
              <textarea id="competition" style="min-height:95px" placeholder="Example: SAP, Microsoft Dynamics, Sage, current ERP, spreadsheet/status quo.">${escapeHtml(defaultPrepData.competition)}</textarea>
            </div>
          </div>
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
              <input id="companyUrl" value="${escapeHtml(defaultPrepData.companyUrl)}" placeholder="https://www.example.com">
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
              <textarea id="topic" style="min-height:135px">${escapeHtml(defaultPrepData.topic)}</textarea>
            </div>

            <div class="field field-full">
              <label for="preDemoNotes">Pre-demo notes</label>
              <textarea id="preDemoNotes" style="min-height:170px" placeholder="Paste discovery notes, pain points, role notes, current systems, concerns, and success criteria.">${escapeHtml(defaultPrepData.preDemoNotes)}</textarea>
            </div>
          </div>
        </div>

        <div class="panel prep-instructions">
          <h2>SC Demo Instructions</h2>
          <label for="instructions">What the demo generator should always do and avoid</label>
          <textarea id="instructions" style="min-height:86px" readonly>${escapeHtml(defaultScInstructions())}</textarea>
          <p class="hint">Shared generation guidance is managed in Admin and sent into Codex when the demo is created.</p>
        </div>

        <div class="panel prep-voice" data-live-demo-only>
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
            <button class="secondary" id="sampleVoice" data-help="Plays a short sample line with the selected narration engine and voice.">Play Sample</button>
          </div>

          <label for="intensity">Demo value emphasis</label>
          <select id="intensity">
            <option value="light">Light: add value points at major transitions only</option>
            <option value="balanced" selected>Balanced: add value points on main pages and sections</option>
            <option value="heavy">Heavy: add value points throughout the demo</option>
          </select>
          <p class="hint">Controls how often the generated demo connects what is shown to business value for the audience.</p>
        </div>

        <div class="panel narrator-card prep-narrator" data-live-demo-only>
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
            <button class="secondary" id="preDemoScoring" data-help="Scores only the current pre-demo inputs so the SC can see discovery gaps before creating the SC guide or demo.">Pre-demo scoring</button>
            <button id="learn" data-help="Uses Codex to analyze the Prep inputs, create the SC guide, and populate both intelligence pages. It does not start a browser dry-run.">Learn / Create Demo</button>
            <button id="learnDryRun" data-live-demo-only data-help="Uses Codex to create the SC guide, creates the Dry-run creation prompt, builds the runnable dry-run manifest from that prompt, and starts the browser dry-run.">Learn / Create Demo & Dry-Run</button>
            <button class="secondary" id="reload" data-help="Reloads the latest saved manifest, SC guide, setup prompt, and intelligence outputs without generating anything new.">Reload</button>
          </div>
          <p class="hint">Pre-demo scoring checks the notes first. Learn / Create Demo uses Codex to create the SC guide and both intelligence views. <span data-live-demo-only>Learn / Create Demo & Dry-Run also builds the runnable manifest from the Dry-run creation prompt and opens the browser dry-run, so it is more time consuming.</span></p>
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
      <div class="page-load-bar"><span class="page-load-info" data-page-loaded="manifest">Last loaded: not yet</span></div>
      <div class="row">
        <button id="save" data-help="Saves the JSON currently shown in the dry-run manifest editor.">Save Manifest</button>
        <button class="secondary" id="createManifestFromGuide" data-help="Creates or refreshes the runnable dry-run manifest from the Dry-run creation prompt on the SC Guide page.">Create Dry-Run From Prompt</button>
        <button class="secondary" id="reloadManifest" data-help="Reloads the saved dry-run manifest from disk and discards unsaved editor changes.">Reload Manifest</button>
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
      <div class="page-load-bar"><span class="page-load-info" data-page-loaded="guide">Last loaded: not yet</span></div>
      <div class="row">
        <button id="exportGuide" data-help="Creates a Word document version of the SC guide and downloads it.">Export To Word</button>
      </div>
      <div class="guide-outputs">
        <div>
          <label for="scRunbook">Personalized SC story and runbook</label>
          <p class="hint" id="scRunbookSource">Source will appear after the guide loads.</p>
          <textarea id="scRunbook" spellcheck="false" readonly></textarea>
        </div>
        <div>
          <label for="assetGenerationPrompt">Demo asset / PowerPoint generation prompt</label>
          <p class="hint" id="assetGenerationPromptSource">Source will appear after the guide loads.</p>
          <textarea id="assetGenerationPrompt" spellcheck="false" readonly></textarea>
        </div>
      </div>
      <textarea id="scGuide" spellcheck="false" readonly hidden></textarea>
      <div class="band">
        <h2>NetSuite Customization / Setup Prompt</h2>
        <p class="hint">Generated after the Personalized SC story and runbook is available, so account setup follows the finished demo story instead of driving it.</p>
        <p class="hint" id="setupAccountSummary">Target account will appear after a demo is generated.</p>
        <p class="hint" id="setupItemSummary">Setup items will appear here when the helper detects data or configuration that may need to be created.</p>
        <p class="hint" id="setupPromptSource">Source will appear after the setup prompt loads.</p>
        <label for="setupPrompt">Prompt for Codex account setup</label>
        <textarea id="setupPrompt" spellcheck="false" readonly></textarea>
        <div class="row" style="margin-top:10px">
          <button id="executeSetupPrompt" data-help="After confirmation, opens the NetSuite browser, copies the setup prompt, and opens Codex for the account setup handoff.">Execute Now</button>
        </div>
      </div>
      <details class="guide-prompt-details" data-live-demo-only>
        <summary>Dry-run creation prompt</summary>
        <p class="hint">Generated after the Personalized SC story and runbook is available. The helper uses it to create the browser dry-run manifest, and Run page actions confirm its timestamp before using it.</p>
        <p class="hint" id="dryRunCreationPromptSource">Source will appear after the guide loads.</p>
        <label for="dryRunCreationPrompt">Prompt for creating the dry-run</label>
        <textarea id="dryRunCreationPrompt" spellcheck="false" readonly></textarea>
      </details>
    </section>

    <section class="screen" id="screen-intelligence">
      <div class="page-load-bar"><span class="page-load-info" data-page-loaded="intelligence">Last loaded: not yet</span></div>
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

        <section class="dashboard-section">
          <div class="section-head">
            <div>
              <h2>Demo Intelligence</h2>
              <p id="heatmapRecommendation">Start with discovery quality, then review the demo strengths and improvement areas.</p>
            </div>
          </div>
          <div class="heatmap-tabs" id="heatmapTabs">
            <button class="secondary heatmap-tab-button active" data-heatmap-tab="discovery">Discovery Quality</button>
            <button class="secondary heatmap-tab-button" data-heatmap-tab="demo">Demo Strength</button>
            <button class="secondary heatmap-tab-button" data-heatmap-tab="business">Business Alignment</button>
            <button class="secondary heatmap-tab-button" data-heatmap-tab="stakeholder">Stakeholder Focus</button>
          </div>
          <div id="intelligenceHeatmap"></div>
        </section>

        <section class="dashboard-section">
          <div class="section-head">
            <div>
              <h2>SC Briefing</h2>
              <p>Concise preparation guidance before opening the detailed cards.</p>
            </div>
          </div>
          <div class="briefing-grid" id="scBriefing"></div>
          <div id="demoWebsiteContext" style="margin-top:12px"></div>
        </section>

        <section class="dashboard-section">
          <div class="section-head">
            <div>
              <h2>Intelligence Areas</h2>
              <p>Click a card to shrink the grid and focus on the detailed coaching panel below.</p>
            </div>
            <button class="secondary" id="toggleIntelligenceCards" data-help="Collapses or expands the Intelligence Areas cards so the detail panel is easier to read.">Compact Cards</button>
          </div>
          <div class="intelligence-card-grid" id="intelligenceCardGrid"></div>
        </section>

        <section class="detail-panel" id="intelligenceDetailPanel">
          <p class="hint">Choose an intelligence card to see the detailed analysis.</p>
        </section>

        <section class="dashboard-section" id="demoIntelligenceAiActions" data-live-demo-only>
          <div class="ai-actions-bar">
            <div>
              <h2 style="margin:0">AI Actions</h2>
              <p class="hint">Use these after reviewing the Intelligence Areas. Guide actions can be edited before they are applied.</p>
            </div>
            <div class="ai-actions-buttons">
              <button class="secondary" id="createFollowUps" data-ai-action-button data-help="Uses Codex to create discovery follow-up questions from the website context, Prep notes, scope, SC guide, and current Intelligence. The questions also appear on Pre-Demo Intelligence.">Generate Discovery Follow-Up Questions</button>
              <button class="secondary" id="compressDemo" data-ai-action-button data-help="Creates an editable shorter version of the demo based on timing risk, weak sections, and the strongest proof moments.">Shorten Demo</button>
              <button class="secondary" id="generateExecutiveVersion" data-ai-action-button data-help="Creates an editable executive-facing demo version with fewer clicks, clearer business outcomes, and stronger leadership framing.">Generate Executive Demo</button>
              <button class="secondary" id="rebuildTechnicalAudience" data-ai-action-button data-help="Creates an editable technical-audience demo version focused on security, integrations, permissions, data flow, and admin validation points.">Generate Tech-Audience Demo</button>
              <button class="secondary" id="improveGuideFromIntel" data-ai-action-button data-help="Uses Codex to apply all visible Intelligence recommendations to the SC guide in one pass.">Apply All Recommendations To SC Guide</button>
              <button class="secondary" id="refreshIntelligence" data-ai-action-button data-help="Re-runs Demo Intelligence against the latest saved SC guide and dry-run manifest after you apply edits.">Re-analyze Updated Guide</button>
            </div>
          </div>
          <p class="ai-action-explainer">Follow-up questions run a Codex background operator and are for discovery only. Shorten, executive, technical, and custom actions create editable text below; the SC guide changes only when you apply that edited output. Re-analyze Updated Guide refreshes the insights after the guide has changed.</p>
          <details class="custom-ai">
            <summary>Custom additional SC Guide Instruction</summary>
            <p class="hint">Use this when the built-in actions are not specific enough. Write what should change, preview it, edit the output if needed, then apply it to the guide.</p>
            <textarea id="customAiInstruction" spellcheck="false" placeholder="Example: make this sharper for a CFO, keep the finance story focused, and reduce implementation detail." style="min-height:95px;margin-top:10px"></textarea>
            <div class="row" style="margin-top:10px">
              <button class="secondary" id="copyCustomAiInstruction" data-ai-action-button>Preview Custom Instruction</button>
            </div>
          </details>
          <div class="action-preview-head">
            <strong>Editable Output</strong>
          </div>
          <textarea id="intelligenceActionOutput" spellcheck="false" placeholder="AI output will appear here. Guide-action previews can be edited before applying them." style="min-height:120px;margin-top:12px"></textarea>
          <div class="row" style="margin-top:10px">
            <button class="secondary" id="applyAiActionToGuide" disabled data-help="Applies the editable output above to the SC guide, then refreshes Demo Intelligence and Pre-Demo Intelligence.">Apply Edited Output To SC Guide</button>
          </div>
        </section>

        <section class="dashboard-section" id="demoIntelligencePersonas">
          <div class="section-head">
            <div>
              <h2>Stakeholder Personas</h2>
              <p>Who the demo needs to land with, why their day-to-day improves, and what NetSuite proof point should stand out for each person.</p>
            </div>
          </div>
          <div class="persona-preview-grid" id="intelligencePersonaCards"></div>
        </section>

        <section class="dashboard-section" id="winStrategySection">
          <div class="section-head">
            <div>
              <h2>Win Strategy</h2>
              <p>Three practical positioning angles based on the notes, scope, website context, and competition or status quo.</p>
            </div>
          </div>
          <div id="winStrategySummary" class="hint"></div>
          <div class="win-strategy-grid" id="winStrategyCards"></div>
        </section>

        <details class="dashboard-section" id="competitiveAdvisory">
          <summary class="competitive-summary">Competitive Guidance — Advisory Only</summary>
          <div class="advisory" style="margin-top:12px">Competitive insights are advisory only and may be incomplete or outdated. Validate important claims before customer use.</div>
          <div id="competitiveAnalyzer" style="margin-top:12px"></div>
        </details>
      </div>
    </section>

    <section class="screen" id="screen-pre-demo-intelligence">
      <div class="page-load-bar"><span class="page-load-info" data-page-loaded="pre-demo-intelligence">Last loaded: not yet</span></div>
      <div class="pre-demo-dashboard">
        <section class="readiness-hero">
          <div>
            <p class="hero-eyebrow">Pre-Demo Intelligence</p>
            <h2 id="preDemoReadinessTitle">Pre-demo notes readiness</h2>
            <p class="hero-subline" id="preDemoReadinessSubtitle">Use Codex to score the current pre-demo notes before generating a full SC guide.</p>
            <div class="insight-badges" id="preDemoReadinessBadges"></div>
          </div>
          <div class="readiness-score">
            <div class="score-number" id="preDemoReadinessScore">-</div>
            <div class="score-caption">Notes score</div>
          </div>
        </section>

        <section class="dashboard-section">
          <div class="section-head">
            <div>
              <h2>Website Summary</h2>
              <p>Signals scanned from the company website and any alignment checks against the pre-demo notes.</p>
            </div>
          </div>
          <div id="preDemoWebsiteContext"></div>
        </section>

        <section class="dashboard-section">
          <div class="section-head">
            <div>
              <h2>Pre-Demo Scoring</h2>
              <p>This Codex-backed view ignores the generated demo and focuses only on discovery quality, gaps, and readiness.</p>
            </div>
            <button class="secondary" id="refreshPreDemoScoring" data-help="Uses Codex to re-score the current Prep inputs only, without regenerating the SC guide or full Demo Intelligence.">Refresh Pre-Demo Scoring</button>
          </div>
          <div class="pre-demo-intel-grid" id="preDemoIntelGrid"></div>
        </section>

        <section class="dashboard-section">
          <div class="section-head">
            <div>
              <h2>Discovery Quality</h2>
              <p id="preDemoHeatmapRecommendation">Review the weakest note areas before creating the demo.</p>
            </div>
          </div>
          <div id="preDemoHeatmap" class="simple-heatmap-grid"></div>
        </section>

        <section class="dashboard-section">
          <div class="section-head">
            <div>
              <h2>Recommended Follow-Up Questions</h2>
              <p>Use these to strengthen discovery before asking Codex to create the SC guide. Add SC context when you want Codex to tailor the question set more tightly.</p>
            </div>
            <div class="follow-up-toolbar">
              <button class="secondary" id="generatePreDemoFollowUps" data-help="Uses Codex to turn the current Prep inputs and additional comments into targeted discovery follow-up questions.">Generate With Codex</button>
              <button class="secondary" id="exportPreDemoFollowUps" data-help="Exports the visible follow-up questions, missing discovery items, covered topics, and additional comments to a Word document.">Export To Word</button>
            </div>
          </div>
          <div class="follow-up-comments">
            <label for="followUpQuestionComments">Additional comments for follow-up questions</label>
            <textarea id="followUpQuestionComments" placeholder="Add anything Codex should consider when shaping discovery questions, such as open deal risks, known stakeholder concerns, competitor context, or topics you do not want to ask again."></textarea>
          </div>
          <div id="preDemoFollowUps"></div>
        </section>
      </div>
    </section>

    <section class="screen" id="screen-dataset">
      <div class="page-load-bar"><span class="page-load-info" data-page-loaded="dataset">Last loaded: not yet</span></div>
      <div class="grid">
        <div class="panel full">
          <section class="dataset-hero">
            <div>
              <p class="hero-eyebrow">Dataset Analysis</p>
              <h2 id="datasetTitle">Dataset readiness has not been checked yet</h2>
              <p class="hero-subline" id="datasetSummary">Run this after the SC guide and dry-run prompt exist. The helper opens NetSuite, waits for login if needed, runs the dry-run path, then scores missing data, permissions, and customization needs.</p>
              <div class="row" style="margin-top:12px">
                <button id="runDatasetAnalysis" data-help="Opens or reuses the NetSuite browser, lets the SC login if needed, runs the dry-run path without narration, and scores dataset preparation.">Run Dataset Analysis</button>
                <button class="secondary" id="executeDatasetPrompt" disabled data-help="Copies the dataset setup prompt, opens NetSuite and Codex, and prepares a Codex handoff for approved account setup work.">Execute Dataset Prompt In Codex</button>
                <button class="danger" id="stopDatasetRun" data-help="Stops the currently running browser dry-run used by Dataset Analysis.">Stop Browser Run</button>
              </div>
            </div>
            <div class="dataset-score">
              <strong id="datasetScore">-</strong>
              <span id="datasetReadinessLabel">Not checked</span>
            </div>
          </section>
        </div>

        <div class="panel full">
          <h2>Readiness Findings</h2>
          <div class="dataset-card-grid" id="datasetFindings"></div>
        </div>

        <div class="panel full">
          <h2>Codex Setup Prompt</h2>
          <p class="hint">Use this only after the SC confirms the target NetSuite account and the exact data/customizations to prepare. The prompt explicitly tells Codex it must verify front-end and back-end NetSuite access before doing write actions.</p>
          <textarea id="datasetPrompt" readonly spellcheck="false" placeholder="Run Dataset Analysis to generate the Codex setup prompt."></textarea>
        </div>

        <div class="panel full">
          <h2>Dry-Run Evidence</h2>
          <div id="datasetEvidence" class="status">No dataset run has been captured yet.</div>
        </div>
      </div>
    </section>

    <section class="screen" id="screen-run">
      <div class="grid">
        <div class="panel">
          <h2>Run Controls</h2>
          <div class="row">
            <button class="secondary" id="openBrowser" data-help="Confirms the Dry-run creation prompt timestamp, rebuilds the manifest from that prompt, prepares the buffer, and opens NetSuite so the SC can log in.">Dry-Run Prep</button>
            <button class="secondary" data-run="buffer-dry-run" data-help="Confirms the Dry-run creation prompt timestamp, refreshes the prompt-built manifest, and clicks through it without narration.">Buffer Dry-Run</button>
            <button data-run="live" data-help="Confirms the Dry-run creation prompt timestamp, refreshes the prompt-built manifest, and runs the full browser automation with narrator audio.">Live Demo</button>
            <button class="danger" id="stopRun" disabled data-help="Stops the currently running demo automation.">Stop</button>
          </div>
          <p class="hint">Use Dry-Run Prep first to create the dry-run manifest from the Dry-run creation prompt and open NetSuite for login. Buffer Dry-Run clicks through the prompt-built manifest without narration. Live Demo uses the same prompt-built manifest with narration.</p>
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
          <p class="hint">Protected local admin area for changing the helper's built-in guidance, playbooks, labels, explanatory text, additional demo logic sources, and the Codex rules behind the SC story, asset prompt, account setup prompt, and dry-run creation prompt. Active sources are matched to the demo context and included when the helper creates the manifest and SC guide. Passwords are stored as salted scrypt hashes and every CMS save creates a rollback version.</p>
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
              <div class="feature-toggle-card">
                <label for="liveDemoFunctionalityToggle">
                  <input id="liveDemoFunctionalityToggle" type="checkbox">
                  Live demo functionality
                </label>
                <p class="hint">Switch this off to hide narration, dry-run, dataset analysis, and Run controls. The helper will focus on Prep, SC Guide, and Intelligence only.</p>
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

        <div class="panel full">
          <h2>Button/API JSON Instructions</h2>
          <p class="hint">Generate downloadable JSON files that show which API endpoint each button calls and what example JSON body is sent. Runtime values still come from the current fields in the app.</p>
          <div class="row">
            <button class="secondary" id="generateButtonInstructionFiles" data-help="Creates one JSON file per API-driving button plus an index file, so you can download and inspect them.">Generate Button/API JSON Files</button>
            <button class="secondary" id="reloadButtonInstructionFiles" data-help="Reloads the generated JSON instruction file list without changing app content.">Reload Instruction List</button>
          </div>
          <p class="hint" id="buttonInstructionStatus">Generate the files to see download links.</p>
          <div class="api-instruction-list" id="buttonInstructionFiles"></div>
        </div>
      </div>
    </section>
  </main>
  <div id="buttonHelpTooltip" class="help-tooltip" role="tooltip"></div>
  <div id="codexInfoModal" class="codex-modal-backdrop" hidden>
    <div class="codex-modal" role="dialog" aria-modal="true" aria-labelledby="codexInfoTitle">
      <div class="codex-modal-head">
        <div>
          <h2 id="codexInfoTitle">Codex Backbone</h2>
          <p>The helper uses Codex as the reasoning layer, then renders the structured results in the app.</p>
        </div>
        <button class="secondary" id="codexInfoClose" data-help="Closes the Codex Backbone details window.">Close</button>
      </div>
      <div class="codex-modal-body" id="codexInfoBody"></div>
    </div>
  </div>
  <div id="codexProgress" class="codex-progress" role="status" aria-live="polite" hidden>
    <div class="codex-progress-head">
      <div>
        <p class="codex-progress-title" id="codexProgressTitle">Codex is working</p>
        <p class="codex-progress-message" id="codexProgressMessage">Preparing the next demo output.</p>
      </div>
      <span class="codex-progress-pill">Codex</span>
    </div>
    <div class="codex-progress-track" aria-hidden="true"><span class="codex-progress-fill"></span></div>
    <div class="codex-progress-steps" id="codexProgressSteps"></div>
    <div class="codex-progress-actions">
      <button class="danger" id="stopCodexAction" data-help="Stops the currently running Codex background action if you clicked the wrong button.">Stop Codex Action</button>
    </div>
  </div>
  <script>
    const editor = document.getElementById("manifestEditor");
    const statusBox = document.getElementById("status");
    const codexRuntimeBadge = document.getElementById("codexRuntimeBadge");
    const codexRuntimeText = document.getElementById("codexRuntimeText");
    const codexInfoButton = document.getElementById("codexInfoButton");
    const codexInfoModal = document.getElementById("codexInfoModal");
    const codexInfoClose = document.getElementById("codexInfoClose");
    const codexInfoBody = document.getElementById("codexInfoBody");
    const codexProgress = document.getElementById("codexProgress");
    const codexProgressTitle = document.getElementById("codexProgressTitle");
    const codexProgressMessage = document.getElementById("codexProgressMessage");
    const codexProgressSteps = document.getElementById("codexProgressSteps");
    const stopCodexActionButton = document.getElementById("stopCodexAction");
    const versions = document.getElementById("versions");
    const scGuide = document.getElementById("scGuide");
    const scRunbook = document.getElementById("scRunbook");
    const scRunbookSource = document.getElementById("scRunbookSource");
    const assetGenerationPrompt = document.getElementById("assetGenerationPrompt");
    const assetGenerationPromptSource = document.getElementById("assetGenerationPromptSource");
    const setupPrompt = document.getElementById("setupPrompt");
    const setupAccountSummary = document.getElementById("setupAccountSummary");
    const setupItemSummary = document.getElementById("setupItemSummary");
    const setupPromptSource = document.getElementById("setupPromptSource");
    const dryRunCreationPrompt = document.getElementById("dryRunCreationPrompt");
    const dryRunCreationPromptSource = document.getElementById("dryRunCreationPromptSource");
    const preDemoIntelGrid = document.getElementById("preDemoIntelGrid");
    const preDemoHeatmap = document.getElementById("preDemoHeatmap");
    const preDemoFollowUps = document.getElementById("preDemoFollowUps");
    const preDemoWebsiteContext = document.getElementById("preDemoWebsiteContext");
    const demoWebsiteContext = document.getElementById("demoWebsiteContext");
    const followUpQuestionComments = document.getElementById("followUpQuestionComments");
    const datasetTitle = document.getElementById("datasetTitle");
    const datasetSummary = document.getElementById("datasetSummary");
    const datasetScore = document.getElementById("datasetScore");
    const datasetReadinessLabel = document.getElementById("datasetReadinessLabel");
    const datasetFindings = document.getElementById("datasetFindings");
    const datasetPrompt = document.getElementById("datasetPrompt");
    const datasetEvidence = document.getElementById("datasetEvidence");
    const executeDatasetPromptButton = document.getElementById("executeDatasetPrompt");
    const intelligenceActionOutput = document.getElementById("intelligenceActionOutput");
    const customAiInstruction = document.getElementById("customAiInstruction");
    const applyAiActionToGuideButton = document.getElementById("applyAiActionToGuide");
    const intelligenceCardGrid = document.getElementById("intelligenceCardGrid");
    const winStrategySummary = document.getElementById("winStrategySummary");
    const winStrategyCards = document.getElementById("winStrategyCards");
    const toggleIntelligenceCardsButton = document.getElementById("toggleIntelligenceCards");
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
    const competitionField = document.getElementById("competition");
    const topicField = document.getElementById("topic");
    const preDemoNotesField = document.getElementById("preDemoNotes");
    const intelligencePersonaCards = document.getElementById("intelligencePersonaCards");
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
    const liveDemoFunctionalityToggle = document.getElementById("liveDemoFunctionalityToggle");
    const buttonInstructionStatus = document.getElementById("buttonInstructionStatus");
    const buttonInstructionFiles = document.getElementById("buttonInstructionFiles");
    const audienceTypeConfig = ${JSON.stringify(demoAudienceConfiguration.audienceTypes)};
    const targetAudienceConfig = ${JSON.stringify(demoAudienceConfiguration.targetAudiences)};
    const demoStrategyConfig = ${JSON.stringify(demoStrategies)};
    const industryConfig = ${JSON.stringify(industryPlaybooks)};
    const manifestDemoModeConfig = ${JSON.stringify(manifestDemoModes)};
    const outputLanguageConfig = ${JSON.stringify(Object.values(outputLanguages))};
    const defaultPrepData = ${JSON.stringify(defaultPrepData)};
    const defaultAudienceType = ${JSON.stringify(defaultAudienceType)};
    const defaultTargetAudience = ${JSON.stringify(defaultTargetAudience)};
    const defaultOutputLanguage = ${JSON.stringify(defaultOutputLanguage)};
    const defaultDemoStrategy = ${JSON.stringify(defaultDemoStrategy)};
    const defaultIndustry = ${JSON.stringify(defaultIndustry)};
    let runInProgress = false;
    let latestSetupPrompt = null;
    let latestIntelligence = null;
    let latestPreDemoIntelligence = null;
    let pendingAiAction = null;
    let selectedIntelligenceCard = "risks";
    let intelligenceCardsCompact = false;
    let activeHeatmapTab = "discovery";
    let cmsBlocks = [];
    const heatmapPages = { demo: 0, notes: 0 };
    let helpTimer = null;
    let helpTarget = null;
    let codexProgressHideTimer = null;
    let latestCodexStatus = null;
    let latestCodexOperator = null;
    let latestIntelligenceSource = "";
    let latestDryRunPromptCreatedAt = "";
    let latestDryRunPromptPreviousCreatedAt = "";
    let latestDryRunPromptIsCurrent = false;
    let latestFollowUpQuestionsMarkdown = "";
    let latestFollowUpQuestionCards = [];
    let latestDatasetAnalysis = null;
    let prepDirtyForIntelligence = false;
    let prepDirtyForPreDemoIntelligence = false;
    let liveDemoFunctionalityEnabled = ${JSON.stringify(liveDemoFunctionalityEnabled)};

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
        else await loadButtonInstructionCatalog();
        markPageLoaded("admin", payload.authenticated ? "Admin CMS loaded" : "Admin status");
      } catch (error) {
        cmsStatus.textContent = error.message;
      }
    }

    function renderCmsAuth(payload) {
      applyFeatureFlags(payload.featureFlags);
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
      await loadButtonInstructionCatalog();
    }

    function renderCms(payload) {
      applyFeatureFlags(payload.featureFlags);
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

    function applyFeatureFlags(flags = {}) {
      if (flags && Object.prototype.hasOwnProperty.call(flags, "liveDemoFunctionality")) {
        liveDemoFunctionalityEnabled = flags.liveDemoFunctionality !== false;
      }
      document.body.classList.toggle("live-demo-disabled", !liveDemoFunctionalityEnabled);
      if (liveDemoFunctionalityToggle) liveDemoFunctionalityToggle.checked = liveDemoFunctionalityEnabled;
      const activeLiveOnlyTab = document.querySelector(".tab.active[data-live-demo-only]");
      if (!liveDemoFunctionalityEnabled && activeLiveOnlyTab) {
        activateTab("prep", { skipAutoLoad: true });
      }
      if (!liveDemoFunctionalityEnabled && document.activeElement?.matches?.("[data-live-demo-only], [data-live-demo-only] *")) {
        document.activeElement.blur();
      }
    }

    async function loadButtonInstructionCatalog() {
      const payload = await api("/api/button-instructions");
      const files = (payload.files || []).length
        ? payload.files
        : (payload.buttons || []).map((button) => ({
            id: button.id,
            label: button.label,
            file: button.id + ".json",
            downloadUrl: ""
          }));
      renderButtonInstructionFiles(files, (payload.files || []).length
        ? "Generated JSON files are ready to download."
        : "Catalogue loaded. Generate files to create download links.");
    }

    function renderButtonInstructionFiles(files = [], message = "") {
      buttonInstructionStatus.textContent = message || (files.length ? files.length + " instruction files are ready." : "No instruction files generated yet.");
      buttonInstructionFiles.innerHTML = files.length
        ? files.map((file) => {
            const download = file.downloadUrl
              ? "<a class='secondary button-link' href='" + escapeClientHtml(file.downloadUrl) + "' download>Download JSON</a>"
              : "<span>No file yet</span>";
            return "<div class='api-instruction-item'><div><strong>" + escapeClientHtml(file.label || file.id) + "</strong><span>" + escapeClientHtml(file.file || "") + "</span></div>" + download + "</div>";
          }).join("")
        : "<p class='hint'>Generate the files to see download links.</p>";
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

    function pageLoadActionLabel(source = "") {
      const labels = {
        "Workspace load": "App load / Reload",
        "App load": "App load",
        "Reload": "Reload",
        "Reload Manifest": "Reload Manifest",
        "SC Guide refresh": "SC Guide refresh",
        "Demo Intelligence refresh": "Demo Intelligence refresh",
        "Re-analyze Updated Guide": "Re-analyze Updated Guide",
        "Pre-demo scoring": "Pre-demo scoring",
        "Refresh Pre-Demo Scoring": "Refresh Pre-Demo Scoring",
        "Generate With Codex": "Generate With Codex",
        "Generate Discovery Follow-Up Questions": "Generate Discovery Follow-Up Questions",
        "Apply All Recommendations To SC Guide": "Apply All Recommendations To SC Guide",
        "Apply Edited Output To SC Guide": "Apply Edited Output To SC Guide",
        "Save Manifest": "Save Manifest",
        "Create Dry-Run From Prompt": "Create Dry-Run From Prompt",
        "Restore Selected": "Restore Selected",
        "Learn / Create Demo": "Learn / Create Demo",
        "Learn / Create Demo & Dry-Run": "Learn / Create Demo & Dry-Run",
        "Recreate Dry-Run Creation Prompt": "Recreate Dry-Run Creation Prompt",
        "Dataset Analysis": "Dataset Analysis"
      };
      return labels[source] || source || "Unknown action";
    }

    function markPageLoaded(page, source = "") {
      const target = document.querySelector("[data-page-loaded='" + page + "']");
      if (!target) return;
      const now = new Date();
      const action = pageLoadActionLabel(source);
      const time = now.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
      target.dataset.loadedAt = now.toISOString();
      target.dataset.loadedAction = action;
      target.textContent = "Last loaded: " + time + " | Action: " + action;
      target.title = "This page was last populated from app data at " + now.toLocaleString() + ". Action: " + action + ".";
      updatePageLoadedAges();
    }

    function markPagesLoaded(pages, source = "") {
      for (const page of pages) markPageLoaded(page, source);
    }

    function updatePageLoadedAges() {
      const staleAfterMs = 30 * 60 * 1000;
      const now = Date.now();
      document.querySelectorAll("[data-page-loaded]").forEach((target) => {
        const loadedAt = Date.parse(target.dataset.loadedAt || "");
        target.classList.toggle("stale", Boolean(loadedAt && now - loadedAt > staleAfterMs));
      });
    }

    async function refreshCodexStatus() {
      try {
        const payload = await api("/api/codex/status");
        renderCodexStatus(payload);
        return payload;
      } catch (error) {
        renderCodexStatus({ available: false, message: error.message });
        return { available: false, message: error.message };
      }
    }

    function renderCodexStatus(payload = {}) {
      latestCodexStatus = payload;
      codexRuntimeBadge.classList.remove("ready", "missing", "checking");
      if (payload.available) {
        codexRuntimeBadge.classList.add("ready");
        codexRuntimeText.textContent = "Codex active";
        codexRuntimeBadge.title = [payload.message, payload.version, payload.command].filter(Boolean).join("\\n");
      } else {
        codexRuntimeBadge.classList.add("missing");
        codexRuntimeText.textContent = "Codex not detected";
        codexRuntimeBadge.title = payload.message || "The app could not detect Codex on this machine.";
      }
      renderCodexInfoBody();
    }

    function renderCodexInfoBody() {
      const status = latestCodexStatus || {};
      const operator = latestCodexOperator || {};
      const active = status.available ? "Detected and active" : "Not detected";
      const intelligenceSource = latestIntelligenceSource || "Waiting for Intelligence refresh";
      codexInfoBody.innerHTML =
        "<div class='codex-info-grid'>" +
          codexInfoCard("Runtime", active, status.message || "") +
          codexInfoCard("Version", status.version || "-", status.command || "") +
          codexInfoCard("Visible Intelligence Source", intelligenceSource === "codex-structured-json" ? "Codex structured JSON" : intelligenceSource, "This is what drives the visible Intelligence dashboard.") +
          codexInfoCard("Latest Intelligence Task", operator.sessionTitle || "Not run yet", operator.cachedAt ? "Cached: " + operator.cachedAt : "") +
          codexInfoCard("Prompt File", operator.promptFile || "-", "Saved background operator prompt.") +
          codexInfoCard("Output File", operator.outputFile || "-", "Saved Codex output used by the app.") +
        "</div>" +
        "<div class='codex-info-card'><strong>Where Codex Is Used</strong>" +
        "<ul class='codex-flow-list'>" +
          "<li>Learn / Create Demo: Codex reviews the company, notes, audience, scope, strategy, and instructions.</li>" +
          "<li>SC Guide: Codex authors the personalized story, runbook, asset prompt, and NetSuite prep summary.</li>" +
          "<li>Manifest: the app converts the Codex-authored SC guide into runnable browser steps.</li>" +
          "<li>Intelligence: Codex returns structured JSON for readiness, quality, risk, SC briefing, timing, discovery, stakeholders, and recommendations.</li>" +
          "<li>AI Actions: Codex rewrites or improves the SC guide when actions are applied.</li>" +
        "</ul></div>" +
        (operator.analysis ? "<div class='codex-info-card'><strong>Latest Codex Intelligence Output</strong><pre class='operator-output'>" + escapeClientHtml(operator.analysis) + "</pre></div>" : "");
    }

    function codexInfoCard(label, value, detail = "") {
      return "<div class='codex-info-card'><strong>" + escapeClientHtml(label) + "</strong><span>" + escapeClientHtml(value || "-") + "</span>" +
        (detail ? "<p class='hint'>" + escapeClientHtml(detail) + "</p>" : "") + "</div>";
    }

    function openCodexInfo() {
      renderCodexInfoBody();
      codexInfoModal.hidden = false;
      codexInfoClose.focus();
    }

    function closeCodexInfo() {
      codexInfoModal.hidden = true;
      codexInfoButton.focus();
    }

    function startCodexProgress(title, message, steps = []) {
      clearTimeout(codexProgressHideTimer);
      codexProgress.hidden = false;
      stopCodexActionButton.disabled = false;
      codexProgressTitle.textContent = title || "Codex is working";
      codexProgressMessage.textContent = message || "Preparing the next demo output.";
      codexProgressSteps.innerHTML = (steps.length ? steps : ["Send the prompt to Codex", "Generate the answer", "Update the app"])
        .map((step, index) => "<div class='codex-progress-step" + (index === 0 ? " active" : "") + "' data-progress-step='" + index + "'>" + escapeClientHtml(step) + "</div>")
        .join("");
    }

    function updateCodexProgress(message, stepIndex = null) {
      if (message) codexProgressMessage.textContent = message;
      if (stepIndex !== null) {
        codexProgressSteps.querySelectorAll(".codex-progress-step").forEach((step, index) => {
          step.classList.toggle("active", index === stepIndex);
        });
      }
    }

    function finishCodexProgress(message = "Codex finished. Updating the screen.") {
      codexProgressMessage.textContent = message;
      stopCodexActionButton.disabled = true;
      codexProgressSteps.querySelectorAll(".codex-progress-step").forEach((step) => step.classList.remove("active"));
      codexProgressHideTimer = setTimeout(() => {
        codexProgress.hidden = true;
      }, 900);
    }

    function failCodexProgress(message) {
      codexProgressMessage.textContent = message || "Codex could not complete this step.";
      stopCodexActionButton.disabled = true;
      codexProgressHideTimer = setTimeout(() => {
        codexProgress.hidden = true;
      }, 2500);
    }

      function setBusy(isBusy) {
        document.querySelectorAll("button").forEach((button) => {
          if (button.id === "codexInfoButton" || button.id === "codexInfoClose" || button.id === "stopCodexAction" || button.id === "stopDatasetRun") {
            button.disabled = false;
          } else if (button.id === "stopRun") {
            button.disabled = !runInProgress;
          } else if (button.id === "applyAiActionToGuide") {
            button.disabled = isBusy || !pendingAiAction || !intelligenceActionOutput.value.trim();
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
    codexInfoButton.onclick = openCodexInfo;
    codexInfoClose.onclick = closeCodexInfo;
    stopCodexActionButton.onclick = async () => {
      try {
        stopCodexActionButton.disabled = true;
        updateCodexProgress("Stop requested. Waiting for the current Codex action to end.");
        const payload = await api("/api/codex/stop", { method: "POST", body: "{}" });
        setStatus(payload.message || "Stop requested for the current Codex action.");
      } catch (error) {
        setStatus(error.message);
      }
    };
    codexInfoModal.onclick = (event) => {
      if (event.target === codexInfoModal) closeCodexInfo();
    };
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !codexInfoModal.hidden) closeCodexInfo();
    });

    function render(payload, source = "Workspace data", options = {}) {
      applyFeatureFlags(payload.featureFlags);
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
        demoScopeField.value = payload.manifest.context?.demoScope || payload.manifest.context?.demoRequest?.demoScope || defaultPrepData.demoScope;
        competitionField.value = payload.manifest.context?.competition || payload.manifest.context?.demoRequest?.competition || defaultPrepData.competition;
        topicField.value = inputModeSelect.value === "notes-only" ? "" : (payload.manifest.context?.demoRequest?.topic || defaultPrepData.topic);
        document.getElementById("companyUrl").value = payload.manifest.context?.company?.url || defaultPrepData.companyUrl;
        preDemoNotesField.value = payload.manifest.context?.preDemoNotes || defaultPrepData.preDemoNotes;
        syncInputMode();
        renderStakeholderPersonas();
      }
      versions.innerHTML = "";
      for (const file of payload.versions || []) {
        const option = document.createElement("option");
        option.value = file;
        option.textContent = file;
        versions.appendChild(option);
      }
      latestFollowUpQuestionsMarkdown = "";
      latestFollowUpQuestionCards = [];
      renderIntelligence(payload.intelligence);
      if (!payload.intelligence) {
        renderStakeholderPersonas();
        renderWinStrategy(winStrategyFromCurrentInputs());
      }
      renderPreDemoIntelligence(payload.preDemoIntelligence || preDemoIntelligenceFromDemoIntelligence(payload.intelligence));
      prepDirtyForIntelligence = false;
      prepDirtyForPreDemoIntelligence = false;
      markPagesLoaded(["prep"], source);
      if (options.markManifest !== false) markPageLoaded("manifest", source);
      if (payload.guide || payload.guideOutputs || payload.setupPrompt) markPageLoaded("guide", source);
      if (payload.intelligence) markPageLoaded("intelligence", source);
      if (payload.preDemoIntelligence || payload.intelligence) {
        markPageLoaded("pre-demo-intelligence", source);
      }
    }

    function renderGuideOutputs(guide, outputs = {}) {
      if (Object.prototype.hasOwnProperty.call(outputs, "liveDemoFunctionality")) {
        applyFeatureFlags({ liveDemoFunctionality: outputs.liveDemoFunctionality });
      }
      scRunbook.value = outputs.scRunbook || sectionFromGuide(guide, "Personalized Demo Story And Runbook") || outputs.personalizedExperienceFlow || "";
      assetGenerationPrompt.value = outputs.assetGenerationPrompt || sectionFromGuide(guide, "Demo Asset Generation Prompt") || "";
      dryRunCreationPrompt.value = liveDemoFunctionalityEnabled ? (outputs.dryRunCreationPrompt || sectionFromGuide(guide, "Dry-Run Creation Prompt") || "") : "";
      latestDryRunPromptCreatedAt = outputs.dryRunCreationPromptCreatedAt || "";
      latestDryRunPromptPreviousCreatedAt = outputs.dryRunCreationPromptPreviousCreatedAt || "";
      latestDryRunPromptIsCurrent = Boolean(outputs.dryRunCreationPromptIsCurrent && latestDryRunPromptCreatedAt);
      scRunbookSource.textContent = sourceLabel(outputs.scRunbookSource || (sectionFromGuide(guide, "Personalized Demo Story And Runbook") ? "codex-sc-guide-section" : "local-fallback"));
      assetGenerationPromptSource.textContent = sourceLabel(outputs.assetGenerationPromptSource || (sectionFromGuide(guide, "Demo Asset Generation Prompt") ? "codex-sc-guide-section" : "local-fallback"));
      dryRunCreationPromptSource.textContent = liveDemoFunctionalityEnabled
        ? dryRunPromptSourceLabel(outputs.dryRunCreationPromptSource || (sectionFromGuide(guide, "Dry-Run Creation Prompt") ? "codex-sc-guide-section" : "local-dry-run-manifest-instruction"), outputs)
        : sourceLabel("live-demo-functionality-disabled");
    }

    function dryRunPromptSourceLabel(source, outputs = {}) {
      const label = sourceLabel(source);
      if (outputs.dryRunCreationPromptIsCurrent && outputs.dryRunCreationPromptCreatedAt) {
        return label + " Created: " + formatDisplayDateTime(outputs.dryRunCreationPromptCreatedAt) + ".";
      }
      if (outputs.dryRunCreationPromptPreviousCreatedAt) {
        return label + " The prompt has changed since it was last created at " + formatDisplayDateTime(outputs.dryRunCreationPromptPreviousCreatedAt) + ". Recreate it before using Run page actions.";
      }
      return label + " Not created yet. Recreate it before using Run page actions.";
    }

    function formatDisplayDateTime(value) {
      if (!value) return "not recorded";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    }

    function sourceLabel(source) {
      if (source === "codex-sc-guide-section") return "Source: Codex-authored SC guide section.";
      if (source === "system-generated-from-sc-story-runbook") return "Source: generated after the Personalized SC story and runbook, with system guardrails.";
      if (source === "codex-sc-guide-personalized-story-runbook") return "Source: completed Personalized SC story and runbook.";
      if (source === "legacy-codex-sc-guide-netSuite-prep-summary") return "Source: legacy Codex-authored NetSuite Prep Summary, wrapped with account safety rules.";
      if (source === "codex-sc-guide-netSuite-prep-summary") return "Source: Codex-authored NetSuite Prep Summary, wrapped with account safety rules.";
      if (source === "local-setup-guardrail-fallback") return "Source: local setup safety fallback because no Codex prep section was found.";
      if (source === "local-dry-run-manifest-instruction") return "Source: local dry-run instruction built from the current SC guide and manifest.";
      if (source === "live-demo-functionality-disabled") return "Source: live demo functionality is disabled in Admin.";
      if (source === "local-fallback") return "Source: local fallback because the Codex guide section was missing.";
      return source ? "Source: " + source : "Source unavailable.";
    }

    function refreshVersionOptions(files = []) {
      versions.innerHTML = "";
      for (const file of files) {
        const option = document.createElement("option");
        option.value = file;
        option.textContent = file;
        versions.appendChild(option);
      }
    }

    async function recreateDryRunCreationPrompt() {
      const payload = await api("/api/dry-run-prompt/refresh", { method: "POST", body: "{}" });
      if (payload.manifest) editor.value = JSON.stringify(payload.manifest, null, 2);
      if (payload.guide) scGuide.value = payload.guide || "";
      renderGuideOutputs(payload.guide || scGuide.value || "", payload.guideOutputs || {});
      renderSetupPrompt(payload.setupPrompt);
      refreshVersionOptions(payload.versions || []);
      markPagesLoaded(["guide", "manifest"], "Recreate Dry-Run Creation Prompt");
      return payload;
    }

    async function confirmDryRunPromptForRun(actionLabel) {
      const currentText = latestDryRunPromptCreatedAt
        ? "The Dry-run creation prompt was created at " + formatDisplayDateTime(latestDryRunPromptCreatedAt) + "."
        : latestDryRunPromptPreviousCreatedAt
          ? "The Dry-run creation prompt has changed since it was last created at " + formatDisplayDateTime(latestDryRunPromptPreviousCreatedAt) + "."
          : "The Dry-run creation prompt does not have a recorded creation time yet.";
      const continueMessage = [
        currentText,
        "",
        "Do you want to continue with " + actionLabel + " using this dry-run creation prompt?"
      ].join("\\n");
      if (latestDryRunPromptIsCurrent && window.confirm(continueMessage)) return true;
      if (!latestDryRunPromptIsCurrent) {
        const refreshMessage = currentText + "\\n\\nRecreate the Dry-run creation prompt now before running?";
        if (!window.confirm(refreshMessage)) return false;
      } else if (!window.confirm("Recreate the Dry-run creation prompt now instead?")) {
        return false;
      }
      setStatus("Recreating the Dry-run creation prompt...");
      const payload = await recreateDryRunCreationPrompt();
      const createdAt = payload.guideOutputs?.dryRunCreationPromptCreatedAt || latestDryRunPromptCreatedAt;
      setStatus("Dry-run creation prompt recreated at " + formatDisplayDateTime(createdAt) + ".");
      return window.confirm("The Dry-run creation prompt was recreated at " + formatDisplayDateTime(createdAt) + ". Continue with " + actionLabel + "?");
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

    function prepPersonasFromCurrentInputs() {
      const source = [
        topicField.value,
        preDemoNotesField.value,
        demoScopeField.value,
        document.getElementById("companyUrl").value,
        selectedConfig(audienceTypeConfig, audienceSelect.value, defaultAudienceType).label,
        selectedConfig(targetAudienceConfig, targetAudienceSelect.value, defaultTargetAudience).label,
        selectedConfig(demoStrategyConfig, demoStrategySelect.value, defaultDemoStrategy).label
      ].join("\\n").toLowerCase();
      const candidates = [
        {
          key: "group-cfo",
          name: /\\bcary\\b/.test(source) ? "Cary" : "Group CFO",
          role: "Executive sponsor",
          terms: ["cfo", "executive", "group", "consolidation", "consolidated", "roi", "success metric", "jedox"],
          whyNetSuiteHelps: "Moves the day from waiting on consolidated packs to seeing group performance, exceptions, and the path back to detail in one finance system.",
          valuePoints: ["Faster confidence in consolidated reporting", "Cleaner board-level story across countries and entities", "Less dependency on spreadsheet stitching"],
          standsOut: "NetSuite combines entity, department, office, book, and transaction context so the CFO story starts broad and can still be defended."
        },
        {
          key: "financial-controller",
          name: /\\bjonathan\\b/.test(source) ? "Jonathan" : "Financial Controller",
          role: "Financial controller",
          terms: ["controller", "close", "local gaap", "tax", "e-invoicing", "e invoicing", "chart of accounts", "drilldown", "fixed asset"],
          whyNetSuiteHelps: "Improves the daily close rhythm by making local views, tax context, source transactions, and audit-friendly drilldown easier to access.",
          valuePoints: ["Trust numbers before exporting them", "Explain variances without chasing people", "Keep statutory and management views closer together"],
          standsOut: "Standard reporting and drilldown let the controller prove the number first, then go deeper only when the audience asks."
        },
        {
          key: "finance-transformation",
          name: /\\btom\\b/.test(source) ? "Tom" : "Finance Transformation Lead",
          role: "Finance transformation manager",
          terms: ["transformation", "erp project", "expansion", "scale", "scalable", "uk focused", "new database", "phase 2", "financials first"],
          whyNetSuiteHelps: "Turns a fragmented finance landscape into a phased operating model that can start with the highest-value finance proof points and grow from there.",
          valuePoints: ["Clearer phase-one scope", "Reusable process model for new entities", "Better bridge from finance pain to platform roadmap"],
          standsOut: "The suite story lets transformation leaders show progress without over-promising deep implementation detail in the first demo."
        },
        {
          key: "it-leadership",
          name: /\\brob\\b|\\bjo\\b/.test(source) ? "Rob and Jo" : "IT leadership",
          role: "IT director and IT operations",
          terms: ["it director", "it operations", "integration", "architecture", "odbc", "crm", "ibos", "api", "production", "data flow"],
          whyNetSuiteHelps: "Gives IT a controlled way to discuss integration and reporting architecture while keeping the first demo business-facing.",
          valuePoints: ["Reduced data movement risk", "Clearer CRM or booking-reference handoff", "More maintainable reporting architecture"],
          standsOut: "NetSuite can show standard reporting first, then explain integration options from a governed platform instead of making integration the whole demo."
        },
        {
          key: "project-team",
          name: /\\bpaul\\b|\\bhenry\\b/.test(source) ? "Paul and Henry" : "Project team",
          role: "Project manager and business analyst",
          terms: ["project manager", "business analyst", "requirements", "scope", "stakeholder", "delivery", "workshop", "demo timebox"],
          whyNetSuiteHelps: "Helps them turn rough discovery into an ordered demo path, clear follow-up questions, and a runbook the SC can actually execute.",
          valuePoints: ["Less ambiguity in demo scope", "Clearer mapping from pain to proof", "Better notes for next discovery"],
          standsOut: "The helper links audience, scope, notes, guide, and intelligence so project stakeholders can see what is ready and what still needs validation."
        },
        {
          key: "finance-ops",
          name: "Budget holders and AP/AR teams",
          role: "Operational finance users",
          terms: ["approval", "approvals", "threshold", "ap", "ar", "invoice", "dunning", "payhawk", "expense", "payment", "paperwork", "credit note"],
          whyNetSuiteHelps: "Improves daily work by putting approval context, invoice detail, customer payment status, and exception handling closer to the transaction.",
          valuePoints: ["Approvers understand what they approve", "Fewer email-heavy payment follow-ups", "Better context for collections and credit control"],
          standsOut: "Role-based workflows can show the same process through finance control and user productivity lenses without turning into admin setup."
        },
        {
          key: "broker-operations",
          name: "Broker and operations teams",
          role: "Flight and booking operations",
          terms: ["flight", "charter", "broker", "route", "aircraft", "booking", "suiteprojects", "project profitability", "veluxis", "private jet"],
          whyNetSuiteHelps: "Connects the commercial flight story to finance by making route, aircraft, broker, customer, vendor cost, revenue, and margin easier to explain.",
          valuePoints: ["Better flight or booking profitability story", "Cleaner link between operations and finance", "More useful project-style reporting"],
          standsOut: "SuiteProjects and dimensions can support the services-style proof point while keeping the first demo focused on financial outcomes."
        }
      ];
      const ranked = candidates
        .map((persona, index) => ({
          ...persona,
          index,
          score: persona.terms.reduce((score, term) => score + (source.includes(term) ? 1 : 0), 0)
        }))
        .filter((persona) => persona.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index);
      const selected = [];
      for (const persona of ranked) {
        if (!selected.some((item) => item.key === persona.key)) selected.push(persona);
      }
      for (const fallback of candidates.slice(0, 5)) {
        if (selected.length >= 5) break;
        if (!selected.some((item) => item.key === fallback.key)) selected.push({ ...fallback, score: 0 });
      }
      return selected.slice(0, 5);
    }

    function renderStakeholderPersonas() {
      const personas = prepPersonasFromCurrentInputs();
      const personaCardsHtml = personas.map((persona) => {
        const points = (persona.valuePoints || [])
          .slice(0, 3)
          .map((point) => "<li>" + escapeClientHtml(point) + "</li>")
          .join("");
        return [
          '<article class="persona-preview-card">',
          "<h3>" + escapeClientHtml(persona.name) + "</h3>",
          '<p class="persona-role">' + escapeClientHtml(persona.role) + "</p>",
          "<p><strong>Day-to-day lift:</strong> " + escapeClientHtml(persona.whyNetSuiteHelps) + "</p>",
          "<div><p><strong>Value points:</strong></p><ul>" + points + "</ul></div>",
          "<p><strong>How NetSuite stands out:</strong> " + escapeClientHtml(persona.standsOut) + "</p>",
          "</article>"
        ].join("");
      }).join("");
      if (intelligencePersonaCards) intelligencePersonaCards.innerHTML = personaCardsHtml;
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
      const winStrategy = intelligence.win_strategy_analyzer || winStrategyFromCurrentInputs();
      const competitive = intelligence.competitive_positioning_mode || {};
      const strategy = intelligence.demo_strategy || {};
      const industry = intelligence.industry_playbook || {};
      const metadata = intelligence.demo_metadata || {};
      const codex = intelligence.codex_intelligence_operator || {};
      latestCodexOperator = codex;
      latestIntelligenceSource = metadata.intelligence_source || "";
      renderCodexInfoBody();
      const readiness = Number.isFinite(Number(intelligence.demo_readiness_score))
        ? Math.max(0, Math.min(100, Math.round(Number(intelligence.demo_readiness_score))))
        : readinessScore(risk, notes, coach);
      const strength = firstClean([...(risk.score_details?.what_is_strong || []), ...(demoHeatmap.strongest_areas || []), ...(winning.winning_moments || [])]) || "Clear proof moments are available";
      const biggestRisk = firstClean([...(risk.warnings || []), ...(demoHeatmap.needs_work_areas || [])]) || "No major risk detected";
      const missing = firstClean([...(discovery.missing_discovery_items || []), ...(notes.risk_areas || [])]) || "No major discovery gap";
      const title = metadata.customer_name ? metadata.customer_name + " demo readiness" : "Demo readiness";

      document.getElementById("readinessTitle").textContent = title;
      document.getElementById("readinessSubtitle").textContent =
        [
          metadata.strategy,
          metadata.industry,
          metadata.audience_type,
          metadata.target_segment,
          metadata.language,
          metadata.narration_voice
        ].filter(Boolean).join(" | ") ||
        "Use this dashboard to decide whether the demo is ready and where to focus next.";
      document.getElementById("readinessScore").textContent = readiness;
      document.getElementById("readinessBadges").innerHTML = [
        insightBadge("Visible Source", metadata.intelligence_source === "codex-structured-json" ? "Codex JSON" : metadata.intelligence_source || "Unknown"),
        insightBadge("Biggest Strength", strength),
        insightBadge("Biggest Risk", biggestRisk),
        insightBadge("Missing Discovery", missing)
      ].join("");
      document.getElementById("scBriefing").innerHTML = scBriefingHtml(metadata, strategy, industry, winning, risk, discovery, intelligence.sc_briefing);
      demoWebsiteContext.innerHTML = websiteContextHtml(intelligence.website_context || {
        url: metadata.customer_url,
        summary: metadata.website_summary || metadata.customer_description,
        interesting_points: metadata.website_interesting_points,
        contradictions_or_checks: metadata.website_contradictions_or_checks
      }, { compact: true });

      const cards = intelligenceCards({ risk, discovery, stakeholder, winning, avoid, timing, coach, competitive, notes });
      if (!cards.some((card) => card.id === selectedIntelligenceCard)) selectedIntelligenceCard = cards[0]?.id || "risks";
      intelligenceCardGrid.innerHTML = cards.map(intelligenceCardHtml).join("");
      syncIntelligenceCardDensity();
      renderIntelligenceDetail(cards);
      renderIntelligenceHeatmap(intelligence);
      renderStakeholderPersonas();
      renderWinStrategy(winStrategy);
      renderCompetitiveAdvisory(competitive);
    }

    function preDemoIntelligenceFromDemoIntelligence(intelligence) {
      if (!intelligence) return null;
      const notes = intelligence.pre_demo_notes_analyzer || {};
      const discovery = intelligence.discovery_gap_analyzer || {};
      const metadata = intelligence.demo_metadata || {};
      const strongest = notes.strong_areas || [];
      const risks = notes.risk_areas || [];
      const missing = discovery.missing_discovery_items || [];
      return {
        source: metadata.intelligence_source || "demo-intelligence",
        metadata: {
          customer_name: metadata.customer_name,
          customer_url: metadata.customer_url,
          audience_type: metadata.audience_type,
          target_segment: metadata.target_segment,
          industry: metadata.industry,
          demo_strategy: metadata.strategy,
          demo_scope: metadata.demo_scope
        },
        website_context: intelligence.website_context || {
          url: metadata.customer_url,
          summary: metadata.website_summary || metadata.customer_description,
          interesting_points: metadata.website_interesting_points,
          contradictions_or_checks: metadata.website_contradictions_or_checks
        },
        overall_score: notes.overall_score,
        discovery_coverage_score: notes.discovery_coverage_score,
        word_count: notes.word_count,
        readiness_label: preDemoReadinessLabelClient(notes.overall_score),
        summary: notes.summary,
        coverage_summary: notes.coverage_summary,
        strongest_area: strongest[0] || "No dominant strength detected yet",
        biggest_risk: risks[0] || missing[0] || "No major pre-demo risk detected",
        next_best_question: discovery.recommended_follow_up_questions?.[0] || "Confirm the main business outcome the demo must prove.",
        strong_areas: strongest,
        risk_areas: risks,
        recommendations: notes.recommendations || [],
        heatmap: notes.heatmap || [],
        found_discovery_items: discovery.found_discovery_items || [],
        missing_discovery_items: missing,
        recommended_follow_up_questions: discovery.recommended_follow_up_questions || []
      };
    }

    function renderPreDemoIntelligence(preDemo) {
      if (!preDemo) {
        latestFollowUpQuestionsMarkdown = "";
        latestFollowUpQuestionCards = [];
        preDemoIntelGrid.innerHTML = "<p class='hint'>Run Pre-demo scoring from the Prep page to review note quality.</p>";
        preDemoHeatmap.innerHTML = "";
        preDemoFollowUps.innerHTML = "";
        preDemoWebsiteContext.innerHTML = "<p class='hint'>Run Pre-demo scoring to scan the website and compare it with the notes.</p>";
        return;
      }
      latestPreDemoIntelligence = preDemo;
      const metadata = preDemo.metadata || {};
      const score = Math.max(0, Math.min(100, Number(preDemo.overall_score) || 0));
      const customerName = metadata.customer_name || "Current prospect";
      document.getElementById("preDemoReadinessTitle").textContent = customerName + " pre-demo readiness";
      document.getElementById("preDemoReadinessSubtitle").textContent = [
        metadata.audience_type,
        metadata.target_segment,
        metadata.industry,
        metadata.demo_strategy
      ].filter(Boolean).join(" | ") || "Use this page before generating the full demo.";
      document.getElementById("preDemoReadinessScore").textContent = score || "-";
      document.getElementById("preDemoReadinessBadges").innerHTML = [
        insightBadge("Status", preDemo.readiness_label || preDemoReadinessLabelClient(score)),
        insightBadge("Strongest Area", preDemo.strongest_area),
        insightBadge("Biggest Risk", preDemo.biggest_risk),
        insightBadge("Next Question", preDemo.next_best_question)
      ].join("");
      preDemoWebsiteContext.innerHTML = websiteContextHtml(preDemo.website_context, { compact: false });

      preDemoIntelGrid.innerHTML = [
        preDemoScoreCardHtml("Notes quality", score + "/100", preDemo.summary, statusForScore(score)),
        preDemoScoreCardHtml("Discovery coverage", (preDemo.discovery_coverage_score || 0) + "/100", preDemo.coverage_summary, statusForScore(preDemo.discovery_coverage_score)),
        preDemoScoreCardHtml("Notes volume", (preDemo.word_count || 0) + " words", notesVolumeSummary(preDemo.word_count), statusForWordCount(preDemo.word_count)),
        preDemoScoreCardHtml("Missing items", (preDemo.missing_discovery_items || []).length + " gaps", firstClean(preDemo.missing_discovery_items) || "No major missing item detected.", (preDemo.missing_discovery_items || []).length > 5 ? "critical" : (preDemo.missing_discovery_items || []).length ? "warning" : "strong")
      ].join("");

      const heatmapItems = (preDemo.heatmap || []).slice().sort((left, right) => Number(left.score || 0) - Number(right.score || 0));
      preDemoHeatmap.innerHTML = heatmapItems.length
        ? heatmapItems.slice(0, 8).map(heatmapCardHtml).join("")
        : "<p class='hint'>No pre-demo heatmap items available yet.</p>";
      document.getElementById("preDemoHeatmapRecommendation").textContent =
        firstClean(preDemo.recommendations || []) || "Add discovery detail in the weakest areas before creating the demo.";
      preDemoFollowUps.innerHTML =
        preDemoFollowUpHtml(preDemo);
    }

    function renderDatasetAnalysis(payload) {
      latestDatasetAnalysis = payload;
      if (!payload) {
        datasetTitle.textContent = "Dataset readiness has not been checked yet";
        datasetSummary.textContent = "Run Dataset Analysis after the SC guide and dry-run prompt exist.";
        datasetScore.textContent = "-";
        datasetReadinessLabel.textContent = "Not checked";
        datasetFindings.innerHTML = "";
        datasetPrompt.value = "";
        datasetEvidence.textContent = "No dataset run has been captured yet.";
        executeDatasetPromptButton.disabled = true;
        return;
      }
      const score = Number(payload.score || 0);
      datasetTitle.textContent = (payload.manifest?.company || "Current demo") + " dataset readiness";
      datasetSummary.textContent = payload.summary || "Dataset analysis completed.";
      datasetScore.textContent = Number.isFinite(score) ? String(score) : "-";
      datasetReadinessLabel.textContent = payload.readinessLabel || payload.status || "Checked";
      datasetPrompt.value = payload.codexPrompt || "";
      executeDatasetPromptButton.disabled = !datasetPrompt.value.trim();
      datasetFindings.innerHTML = [
        datasetCardHtml("Missing data", payload.missingData, "Records or transactions the dry-run may need."),
        datasetCardHtml("Missing customizations", payload.missingCustomizations, "Configuration, permissions, views, reports, or setup to inspect."),
        datasetCardHtml("Recommended actions", payload.recommendations, "What the SC should do next."),
        datasetCardHtml("Successful evidence", (payload.passedEvidence || []).slice(0, 6).map(datasetActionLabel), "Dry-run steps that found expected evidence.")
      ].join("");
      datasetEvidence.textContent = [
        "Run status: " + (payload.runStatus || "unknown"),
        "Run completed: " + (payload.runCompleted ? "yes" : "no"),
        payload.cachePath ? "Cache: " + payload.cachePath : "",
        payload.prepBufferFile ? "Prep buffer: " + payload.prepBufferFile : "",
        payload.promptFile ? "Prompt file: " + payload.promptFile : "",
        "",
        "Failed actions:",
        ...((payload.failedActions || []).slice(0, 8).map(datasetActionLabel)),
        "",
        "Skipped optional actions:",
        ...((payload.skippedActions || []).slice(0, 8).map(datasetActionLabel))
      ].filter((line) => line !== null && line !== undefined).join("\\n");
    }

    function datasetCardHtml(title, items = [], emptyText = "") {
      const clean = (items || []).filter(Boolean);
      const lines = clean.map((item) => typeof item === "string" ? item : item.label || item.reason || datasetActionLabel(item)).filter(Boolean);
      return "<div class='dataset-card'><strong>" + escapeClientHtml(title) + "</strong>" +
        (emptyText ? "<p class='hint'>" + escapeClientHtml(emptyText) + "</p>" : "") +
        (lines.length ? "<ul>" + lines.slice(0, 7).map((item) => "<li>" + escapeClientHtml(item) + "</li>").join("") + "</ul>" : "<p class='hint'>None detected.</p>") +
        "</div>";
    }

    function datasetActionLabel(action = {}) {
      return [action.segment, action.type, action.target].filter(Boolean).join(" - ") || action.label || "Dry-run evidence";
    }

    function preDemoFollowUpHtml(preDemo) {
      const codexCards = latestFollowUpQuestionCards || [];
      const localCards = questionCardsFromList(preDemo.recommended_follow_up_questions || []);
      const cards = codexCards.length ? codexCards : localCards;
      const sourceLabel = codexCards.length ? "Codex-generated discovery questions" : "Recommended questions from pre-demo scoring";
      const questionCards = cards.length
        ? "<div class='follow-up-card-grid'>" + cards.map(followUpQuestionCardHtml).join("") + "</div>"
        : "<p class='hint'>No recommended follow-up questions detected yet. Run Pre-demo scoring or Generate With Codex.</p>";
      const markdownPanel = latestFollowUpQuestionsMarkdown
        ? "<details class='follow-up-markdown'><summary>View full Codex output</summary><pre>" + escapeClientHtml(latestFollowUpQuestionsMarkdown) + "</pre></details>"
        : "";
      return "<div class='card-title-row' style='margin-bottom:10px'><strong>" + escapeClientHtml(sourceLabel) + "</strong><span class='status-badge advisory'>" + escapeClientHtml(String(cards.length || 0) + " questions") + "</span></div>" +
        questionCards +
        markdownPanel +
        "<div class='follow-up-support-grid'>" +
          "<div>" + listBlock("Missing discovery items", preDemo.missing_discovery_items) + "</div>" +
          "<div>" + listBlock("What is already covered", preDemo.found_discovery_items) + "</div>" +
          "<div>" + listBlock("Recommended note improvements", preDemo.recommendations) + "</div>" +
        "</div>";
    }

    function questionCardsFromList(questions = []) {
      return (questions || []).map((question, index) => ({
        number: index + 1,
        priority: index < 3 ? "High" : "Medium",
        question: String(question || "").trim(),
        why: "",
        impact: ""
      })).filter((item) => item.question);
    }

    function questionCardsFromMarkdown(markdown) {
      const cards = [];
      let current = null;
      for (const rawLine of String(markdown || "").split(/\\r?\\n/)) {
        const line = rawLine.trim();
        const questionMatch = line.match(/^(\\d+)\\.\\s*(?:\\[Priority:\\s*([^\\]]+)\\]\\s*)?(.+)/i);
        if (questionMatch) {
          current = {
            number: Number(questionMatch[1]),
            priority: questionMatch[2] || (cards.length < 3 ? "High" : "Medium"),
            question: questionMatch[3].trim(),
            why: "",
            impact: ""
          };
          cards.push(current);
          continue;
        }
        if (!current) continue;
        const whyMatch = line.match(/^-\\s*Why it matters:\\s*(.*)$/i);
        if (whyMatch) current.why = whyMatch[1].trim();
        const impactMatch = line.match(/^-\\s*Demo impact:\\s*(.*)$/i);
        if (impactMatch) current.impact = impactMatch[1].trim();
      }
      return cards.filter((item) => item.question).slice(0, 16);
    }

    function followUpQuestionCardHtml(card) {
      return "<article class='follow-up-card'>" +
        "<div class='follow-up-card-head'><span class='follow-up-number'>" + escapeClientHtml(String(card.number || "")) + "</span><span class='status-badge " + (String(card.priority || "").toLowerCase().includes("high") ? "critical" : "warning") + "'>" + escapeClientHtml(card.priority || "Medium") + "</span></div>" +
        "<div class='follow-up-question'>" + escapeClientHtml(card.question || "") + "</div>" +
        (card.why ? "<p class='follow-up-note'><strong>Why it matters:</strong> " + escapeClientHtml(card.why) + "</p>" : "") +
        (card.impact ? "<p class='follow-up-note'><strong>Demo impact:</strong> " + escapeClientHtml(card.impact) + "</p>" : "") +
      "</article>";
    }

    function preDemoScoreCardHtml(title, metric, summary, status) {
      return "<div class='pre-demo-score-card'>" +
        "<div class='card-title-row'><strong>" + escapeClientHtml(title) + "</strong><span class='status-badge " + escapeClientHtml(status || "advisory") + "'>" + escapeClientHtml(statusDisplayLabel(status || "advisory")) + "</span></div>" +
        "<div class='card-metric'>" + escapeClientHtml(metric || "-") + "</div>" +
        "<p class='card-summary'>" + escapeClientHtml(summary || "") + "</p>" +
      "</div>";
    }

    function preDemoReadinessLabelClient(score) {
      const value = Number(score);
      if (!Number.isFinite(value)) return "Needs notes";
      if (value >= 80) return "Ready for demo generation";
      if (value >= 65) return "Usable with follow-up";
      if (value >= 45) return "Needs discovery detail";
      return "High discovery risk";
    }

    function notesVolumeSummary(wordCount) {
      const words = Number(wordCount) || 0;
      if (words > 900) return "Enough raw material for a highly tailored story.";
      if (words > 350) return "Useful discovery depth is present, but confirm the highest-risk gaps.";
      if (words > 120) return "Usable starter notes; add stakeholder and success criteria detail.";
      if (words > 0) return "Very light notes. Personalization will be limited.";
      return "No pre-demo notes detected.";
    }

    function statusForWordCount(wordCount) {
      const words = Number(wordCount) || 0;
      if (words > 350) return "strong";
      if (words > 120) return "warning";
      return "critical";
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

    function scBriefingHtml(metadata, strategy, industry, winning, risk, discovery, codexBriefing = null) {
      if (codexBriefing && typeof codexBriefing === "object") {
        return [
          briefingItem("Customer Situation", codexBriefing.customer_situation || metadata.customer_description || metadata.customer_name),
          briefingItem("Demo Goal", codexBriefing.demo_goal || metadata.demo_goal || metadata.demo_scope),
          briefingItem("Key Business Drivers", (codexBriefing.key_business_drivers || []).join(", ") || "Visibility, control, speed, and trusted decisions."),
          briefingItem("Recommended Tone", codexBriefing.recommended_tone || [strategy.tone, strategy.pacing].filter(Boolean).join(". ")),
          briefingItem("Critical Demo Moments", (codexBriefing.critical_demo_moments || []).join(" | ") || "Open with the executive story, slow down on proof moments, and close with business impact.")
        ].join("");
      }
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

    function websiteContextHtml(context = {}, options = {}) {
      const source = context || {};
      const points = arrayFromClient(source.interesting_points || source.interestingPoints);
      const checks = arrayFromClient(source.contradictions_or_checks || source.contradictions || source.alignment_checks);
      const evidence = arrayFromClient(source.evidence || source.evidence_snippets || source.evidenceSnippets);
      const summary = source.summary || source.description || source.title || "";
      const url = source.url || "";
      const sourceLabelText = source.source ? "Source: " + source.source : "Source: website scan";
      if (!summary && !points.length && !checks.length && !url) {
        return "<p class='hint'>No website context has been captured yet. Run Pre-demo scoring or Learn / Create Demo with a company website.</p>";
      }
      return "<div class='" + (checks.length ? "website-context-card website-context-alert" : "website-context-card") + "'>" +
        "<h3>" + escapeClientHtml(url ? "Website context: " + stripUrlForDisplay(url) : "Website context") + "</h3>" +
        "<p>" + escapeClientHtml(summary || "Website was scanned, but no clear summary was extracted.") + "</p>" +
        "<div class='website-context-grid'>" +
          websiteListBlock("Interesting points", points, "No specific website signals detected yet.") +
          websiteListBlock("Alignment checks", checks, "No contradictions or alignment checks detected.") +
          (options.compact ? "" : websiteListBlock("Evidence picked up", evidence, "No evidence snippets captured.")) +
        "</div>" +
        "<p class='hint' style='margin-top:8px'>" + escapeClientHtml(sourceLabelText + (source.scanned_at ? " | Scanned: " + formatDisplayDateTime(source.scanned_at) : "")) + "</p>" +
      "</div>";
    }

    function websiteListBlock(title, items, emptyText) {
      const clean = arrayFromClient(items).slice(0, 6);
      return "<div><strong>" + escapeClientHtml(title) + "</strong>" +
        (clean.length
          ? "<ul class='website-context-list'>" + clean.map((item) => "<li>" + escapeClientHtml(item) + "</li>").join("") + "</ul>"
          : "<p class='hint'>" + escapeClientHtml(emptyText) + "</p>") +
        "</div>";
    }

    function arrayFromClient(value) {
      if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
      if (typeof value === "string" && value.trim()) return [value.trim()];
      return [];
    }

    function stripUrlForDisplay(value) {
      try {
        return new URL(value).hostname.replace(/^www\\./, "");
      } catch {
        return String(value || "").replace(/^https?:\\/\\//, "").replace(/^www\\./, "").replace(/\\/$/, "");
      }
    }

    function intelligenceCards(data) {
      const { risk, discovery, stakeholder, winning, avoid, timing, coach, competitive, notes } = data;
      const stakeholderItems = stakeholder.stakeholder_coverage || [];
      const competitiveFocus = competitive.competitive_focus || [];
      return [
        {
          id: "risks",
          title: "Demo Risks",
          summary: risk.summary || demoRiskSummary(risk),
          metric: demoRiskLabel(risk.demo_risk_score),
          status: statusForRisk(risk.demo_risk_score),
          statusLabel: demoRiskLabel(risk.demo_risk_score),
          previews: (risk.warnings || risk.recommendations || []).slice(0, 3),
          detail: listBlock("Warnings", risk.warnings) + listBlock("Recommendations", risk.recommendations) + hintBlock(risk.score_explanation)
        },
        {
          id: "discovery",
          title: "Discovery Gaps",
          summary: discovery.summary || discoverySummary(discovery, notes),
          metric: notesQualityLabel(notes.overall_score),
          status: statusForScore(notes.overall_score),
          statusLabel: statusDisplayLabel(statusForScore(notes.overall_score)),
          previews: [...(discovery.missing_discovery_items || []), ...(notes.risk_areas || [])].slice(0, 3),
          detail: analysisItem("Pre-demo notes score", notes.overall_score ? notes.overall_score + "/100" : "-", notes.summary) +
            listBlock("Missing discovery items", discovery.missing_discovery_items) +
            listBlock("Follow-up questions", discovery.recommended_follow_up_questions) +
            listBlock("Notes recommendations", notes.recommendations) +
            pillList(discovery.found_discovery_items || [])
        },
        {
          id: "stakeholders",
          title: "Stakeholder Coverage",
          summary: stakeholder.summary || stakeholderSummary(stakeholderItems, stakeholder),
          metric: stakeholderItems.length + " roles mapped",
          status: stakeholderItems.some((item) => Number(item.coverage) < 25) ? "warning" : "strong",
          statusLabel: stakeholderItems.some((item) => Number(item.coverage) < 25) ? "Needs balance" : "Healthy",
          previews: stakeholderItems.slice(0, 3).map((item) => item.role + ": " + item.coverage + "%"),
          detail: coverageRows(stakeholderItems) + hintBlock(stakeholder.recommendation)
        },
        {
          id: "timing",
          title: "Timing & Pacing",
          summary: timing.summary || timingSummary(timing),
          metric: pacingRiskLabel(timing.overrun_risk),
          status: timing.overrun_risk === "high" ? "critical" : timing.overrun_risk === "medium" ? "warning" : "strong",
          statusLabel: pacingRiskLabel(timing.overrun_risk),
          previews: [...(timing.high_risk_sections || []), ...(timing.recommended_cuts || [])].slice(0, 3),
          detail: analysisItem("Estimated runtime", timing.estimated_runtime, "Overrun risk: " + (timing.overrun_risk || "unknown")) +
            hintBlock(timing.basis) + timingRows(timing.section_timing || []) +
            listBlock("Recommended cuts", timing.recommended_cuts)
        },
        {
          id: "winning",
          title: "Winning Moments",
          summary: winning.summary || winningSummary(winning),
          metric: (winning.winning_moments || []).length + " moments",
          status: (winning.winning_moments || []).length >= 3 ? "strong" : "warning",
          statusLabel: (winning.winning_moments || []).length >= 3 ? "Healthy" : "Needs sharper proof",
          previews: (winning.winning_moments || []).slice(0, 3),
          detail: listBlock("Moments to slow down for", winning.winning_moments) +
            (winning.details || []).map((item) => analysisItem(item.moment, item.segment, item.coaching_tip)).join("")
        },
        {
          id: "avoid",
          title: "What NOT To Demo",
          summary: avoid.summary || "Guardrails that keep the live path focused and stop the demo from drifting into low-value areas.",
          metric: (avoid.avoid_showing || []).length + " guardrails",
          status: "warning",
          statusLabel: "Guardrails",
          previews: (avoid.avoid_showing || []).slice(0, 3),
          detail: listBlock("Avoid showing", avoid.avoid_showing) + hintBlock(avoid.rationale)
        },
        {
          id: "coach",
          title: "Rehearsal Coach",
          summary: coach.summary || rehearsalCoachSummary(coach),
          metric: rehearsalCoachMetric(coach),
          status: statusForScore(coach.clarity_score),
          statusLabel: rehearsalCoachStatusLabel(coach),
          previews: (coach.recommendations || []).slice(0, 3),
          detail: analysisItem("Status", humanStatusText(coach.status) || "Not rehearsed yet", "Use rehearsal output later for transcript and pacing feedback.") +
            hintBlock(coach.basis) +
            listBlock("Coaching recommendations", coach.recommendations) +
            listBlock("Future transcript metrics", coach.suggested_metrics_for_future_rehearsal_transcripts)
        },
        {
          id: "competitive",
          title: "Competitive Positioning",
          summary: competitive.summary || "Optional positioning prompts. Treat these as talking-point guidance, not verified competitor facts.",
          metric: competitiveFocus.length + " advisory topics",
          status: "advisory",
          statusLabel: "Advisory",
          previews: competitiveFocus.slice(0, 3).map((item) => item.topic),
          detail: "<div class='advisory'>Competitive insights are advisory only and may be incomplete or outdated. Validate important claims before customer use.</div>" +
            competitiveFocus.map((item) => analysisItem(item.topic, item.why_it_matters, item.recommended_demo_moment)).join("")
        }
      ];
    }

    function demoRiskLabel(score) {
      const value = Number(score);
      if (!Number.isFinite(value)) return "Needs review";
      if (value >= 75) return "High risk";
      if (value >= 45) return "Medium risk";
      return "Healthy";
    }

    function demoRiskSummary(risk) {
      const label = demoRiskLabel(risk.demo_risk_score);
      const warning = firstClean(risk.warnings || []);
      if (label === "High risk") return warning ? "High risk: fix this before presenting. " + warning : "High risk: tighten the story before presenting.";
      if (label === "Medium risk") return warning ? "Medium risk: worth tightening before rehearsal. " + warning : "Medium risk: review pacing, audience fit, and story clarity.";
      if (label === "Healthy") return warning ? "Mostly healthy, with one item to watch. " + warning : "Healthy: no major risk is currently blocking rehearsal.";
      return "Needs review: refresh Intelligence after the SC guide and manifest are ready.";
    }

    function notesQualityLabel(score) {
      const value = Number(score);
      if (!Number.isFinite(value)) return "Needs notes";
      if (value >= 80) return "Notes healthy";
      if (value >= 55) return "Needs detail";
      return "Discovery risk";
    }

    function discoverySummary(discovery, notes) {
      const missingCount = (discovery.missing_discovery_items || []).length;
      const riskCount = (notes.risk_areas || []).length;
      if (!missingCount && !riskCount) return "Discovery notes cover the main inputs needed to shape the demo story.";
      if (missingCount) return missingCount + " missing item" + (missingCount === 1 ? "" : "s") + " could weaken personalization or audience fit.";
      return riskCount + " note area" + (riskCount === 1 ? "" : "s") + " need more detail before the demo is fully safe.";
    }

    function stakeholderSummary(items, stakeholder) {
      const weak = (items || []).filter((item) => Number(item.coverage) < 25).map((item) => item.role);
      if (weak.length) return "Coverage is light for " + weak.slice(0, 3).join(", ") + ". Add a proof moment or question for them.";
      return stakeholder.recommendation || "Stakeholder coverage looks balanced enough for the current story.";
    }

    function pacingRiskLabel(value) {
      if (value === "high") return "High pacing risk";
      if (value === "medium") return "Medium pacing risk";
      if (value === "low") return "Healthy pacing";
      return "Timing unknown";
    }

    function timingSummary(timing) {
      const runtime = timing.estimated_runtime || "unknown runtime";
      const risk = pacingRiskLabel(timing.overrun_risk);
      const riskSection = firstClean([...(timing.high_risk_sections || []), ...(timing.recommended_cuts || [])]);
      return riskSection
        ? runtime + " estimated. " + risk + " around: " + riskSection + "."
        : runtime + " estimated. " + risk + ".";
    }

    function winningSummary(winning) {
      const moment = (winning.winning_moments || [])[0];
      return moment
        ? "Strongest moment to slow down for: " + moment + "."
        : "No clear memorable proof moment detected yet. Add one moment the audience should remember.";
    }

    function rehearsalCoachMetric(coach) {
      if (coach.status) return humanStatusText(coach.status);
      if ((coach.recommendations || []).length) return "Coaching ready";
      return "Run rehearsal";
    }

    function rehearsalCoachSummary(coach) {
      if ((coach.recommendations || []).length) return "Coaching tips are available for pacing, clarity, and audience alignment.";
      return coach.status || "Run a rehearsal to unlock feedback on pacing, clarity, filler words, and business-story quality.";
    }

    function rehearsalCoachStatusLabel(coach) {
      if (!Number.isFinite(Number(coach.clarity_score))) return "Not rehearsed";
      return statusDisplayLabel(statusForScore(coach.clarity_score));
    }

    function humanStatusText(value) {
      const clean = String(value || "").replace(/[-_]+/g, " ").replace(/\\s+/g, " ").trim();
      if (!clean) return "";
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    function statusDisplayLabel(status) {
      if (status === "strong") return "Healthy";
      if (status === "warning") return "Needs work";
      if (status === "critical") return "At risk";
      return "Advisory";
    }

    function intelligenceCardHtml(card) {
      const active = card.id === selectedIntelligenceCard ? " active" : "";
      const previews = (card.previews || []).filter(Boolean).slice(0, 3);
      const statusLabel = card.statusLabel || statusDisplayLabel(card.status);
      return "<button class='intelligence-card" + active + "' data-intel-card='" + escapeClientHtml(card.id) + "'>" +
        "<div class='card-title-row'><h3 class='card-title'>" + escapeClientHtml(card.title) + "</h3><span class='status-badge " + escapeClientHtml(card.status) + "'>" + escapeClientHtml(statusLabel) + "</span></div>" +
        "<div class='card-metric'>" + escapeClientHtml(card.metric || "-") + "</div>" +
        "<p class='card-summary'>" + escapeClientHtml(card.summary || "") + "</p>" +
        (previews.length ? "<ul class='preview-list'>" + previews.map((item) => "<li>" + escapeClientHtml(item) + "</li>").join("") + "</ul>" : "<p class='hint'>No preview items detected.</p>") +
      "</button>";
    }

    function renderIntelligenceDetail(cards) {
      const card = cards.find((item) => item.id === selectedIntelligenceCard) || cards[0];
      if (!card) return;
      const statusLabel = card.statusLabel || statusDisplayLabel(card.status);
      document.getElementById("intelligenceDetailPanel").innerHTML =
        "<div class='section-head'><div><h2>" + escapeClientHtml(card.title) + "</h2><p>" + escapeClientHtml(card.summary || "") + "</p></div>" +
        "<span class='status-badge " + escapeClientHtml(card.status) + "'>" + escapeClientHtml(statusLabel) + "</span></div>" +
        "<div class='detail-grid'>" + (card.detail || "<p class='hint'>No detail available yet.</p>") + "</div>";
    }

    function syncIntelligenceCardDensity() {
      intelligenceCardGrid.classList.toggle("compact", intelligenceCardsCompact);
      toggleIntelligenceCardsButton.textContent = intelligenceCardsCompact ? "Expand Cards" : "Compact Cards";
      toggleIntelligenceCardsButton.setAttribute(
        "data-help",
        intelligenceCardsCompact
          ? "Expands Intelligence Areas back into full cards with summaries."
          : "Shrinks Intelligence Areas into a compact selector view."
      );
    }

    function focusIntelligenceDetail() {
      window.requestAnimationFrame(() => {
        document.getElementById("intelligenceDetailPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
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

    function renderWinStrategy(winStrategy = {}) {
      const strategies = Array.isArray(winStrategy.strategies) ? winStrategy.strategies.slice(0, 3) : [];
      if (winStrategySummary) {
        winStrategySummary.textContent = winStrategy.summary || "Win strategy appears after Demo Intelligence is generated from the current prep inputs.";
      }
      if (!winStrategyCards) return;
      if (!strategies.length) {
        winStrategyCards.innerHTML = "<p class='hint'>No win strategy generated yet. Re-run Demo Intelligence after adding competition/status quo context.</p>";
        return;
      }
      winStrategyCards.innerHTML = strategies.map((strategy) => [
        '<article class="win-strategy-card">',
        "<h3>" + escapeClientHtml(strategy.title || "Win strategy") + "</h3>",
        "<p><strong>Why we can win:</strong> " + escapeClientHtml(strategy.why_we_can_win || "") + "</p>",
        "<p><strong>Potential competitor move:</strong> " + escapeClientHtml(strategy.competitor_likely_move || "") + "</p>",
        "<p><strong>Demo move:</strong> " + escapeClientHtml(strategy.demo_move || "") + "</p>",
        "</article>"
      ].join("")).join("");
    }

    function winStrategyFromCurrentInputs() {
      const competition = (competitionField?.value || "").trim() || "Status quo or external shortlist not confirmed";
      const source = [
        topicField.value,
        demoScopeField.value,
        competition,
        preDemoNotesField.value
      ].join("\\n").toLowerCase();
      const strategies = [];
      const add = (title, why_we_can_win, competitor_likely_move, demo_move) => {
        strategies.push({ title, why_we_can_win, competitor_likely_move, demo_move });
      };
      if (/consolidat|oneworld|multi-country|multi country|local gaap|tax|e-invoic|jedox|entity/.test(source)) {
        add("Lead with consolidation confidence", "The notes point to group reporting, local requirements, and external consolidation as buying pressure.", "The status quo or another vendor may position external consolidation/reporting as sufficient.", "Show executive/group visibility first, then drill into local entity and transaction support.");
      }
      if (/flight|charter|broker|route|aircraft|suiteprojects|project profitability|booking|veluxis/.test(source)) {
        add("Turn flight complexity into a finance story", "The flight/project model is distinctive and can make the demo feel tailored without heavy customization.", "A competitor may keep this as a separate project or operational-system discussion.", "Use a flight or booking profitability proof point after the executive overview.");
      }
      if (/approval|ap|ar|dunning|invoice|document|email|manual|payment|template/.test(source)) {
        add("Show context-aware finance work", "Manual AP, approval context, and customer documentation gaps create day-to-day friction for finance teams.", "A competitor may focus on isolated workflow automation or point-solution speed.", "Show approval context, supporting documents, standard reports, and customer-facing outputs without going deep into setup.");
      }
      if (/integration|odbc|crm|ibos|architecture|data flow|it director|it operations/.test(source) && strategies.length < 3) {
        add("Keep integration strategic", "IT needs architecture confidence, but the business case should stay anchored in finance outcomes.", "A competitor may pull the meeting into technical flexibility before business proof is established.", "Show standard reporting and drilldown first, then frame CRM/booking references and ODBC as validation topics.");
      }
      while (strategies.length < 3) {
        add("Anchor on the confirmed business risk", "The win depends on making the most expensive current-state risk visible early.", "A competitor may run a broader feature tour if buying criteria are unclear.", "Open with the executive problem, prove the strongest standard workflow, then ask the next discovery question.");
      }
      return {
        summary: "Generated from current prep inputs. Re-run Demo Intelligence for Codex-authored win strategy.",
        competition_context: competition,
        guidance_only: true,
        strategies: strategies.slice(0, 3)
      };
    }

    function actionTextFor(mode) {
      if (!latestIntelligence) return "";
      const risk = latestIntelligence.demo_risk_analyzer || {};
      const discovery = latestIntelligence.discovery_gap_analyzer || {};
      const timing = latestIntelligence.demo_timing_pacing_analyzer || {};
      const winning = latestIntelligence.winning_moment_detection || {};
      const avoid = latestIntelligence.what_not_to_demo_engine || {};
      const metadata = latestIntelligence.demo_metadata || {};
      const stakeholder = latestIntelligence.stakeholder_coverage_analyzer || {};
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
        compress: shortenedDemoOutput(metadata, risk, timing, winning, avoid),
        executive: executiveDemoOutput(metadata, risk, winning, avoid, stakeholder),
        technical: technicalDemoOutput(metadata, discovery, winning, avoid, stakeholder),
        custom: customAiInstruction.value.trim()
          ? "Apply this custom instruction to the SC guide: " + customAiInstruction.value.trim()
          : "Write a custom SC guide instruction first, then preview it here."
      };
      if (mode === "custom") return [modes.custom, "", "Context to preserve:", ...common.map((line) => "- " + line)].join("\\n");
      return modes[mode] || modes.custom;
    }

    function shortenedDemoOutput(metadata, risk, timing, winning, avoid) {
      const moments = (winning.winning_moments || []).slice(0, 3);
      const cuts = uniqueClientItems([...(timing.recommended_cuts || []), ...(avoid.avoid_showing || [])]).slice(0, 6);
      const risks = (risk.warnings || []).slice(0, 3);
      return [
        "# Shortened Demo",
        "",
        "Use this version when the meeting is shorter, attention is limited, or the SC needs a sharper first pass before going deeper.",
        "",
        "Target runtime: 20-30 minutes.",
        "Current estimate: " + (timing.estimated_runtime || "unknown") + ".",
        "Audience: " + ([metadata.audience_type, metadata.target_segment].filter(Boolean).join(" / ") || "selected audience") + ".",
        "",
        "## Shortened Flow",
        "",
        "1. Executive opening: start with the business situation and the decision the audience needs confidence in.",
        "2. Platform overview: show the general NetSuite view only long enough to create orientation.",
        "3. Strongest proof moment: " + (moments[0] || "show the highest-impact workflow first") + ".",
        "4. Trust proof: drill once from summary to detail so the audience sees where the number comes from.",
        "5. Forward-looking proof: show the next decision point, forecast, or operational visibility if it supports the story.",
        "6. Close: recap the business outcome, the risk reduced, and the recommended next validation step.",
        "",
        "## Keep",
        bulletLines(moments.length ? moments : ["Executive overview", "Highest-impact report or dashboard", "One drilldown proof moment"]),
        "",
        "## Move To Q&A Or Cut",
        bulletLines(cuts.length ? cuts : ["Long setup paths", "Low-value configuration detail", "Repeated navigation that does not add proof"]),
        "",
        "## Pacing Guardrails",
        bulletLines([
          "Do not explain every menu. Navigate directly to the proof point.",
          "Use one strong drilldown instead of several similar examples.",
          risks[0] ? "Watch this risk: " + risks[0] : "Keep the demo from becoming a feature tour."
        ])
      ].join("\\n");
    }

    function executiveDemoOutput(metadata, risk, winning, avoid, stakeholder) {
      const moments = (winning.winning_moments || []).slice(0, 4);
      const avoidItems = (avoid.avoid_showing || []).slice(0, 5);
      const stakeholderFocus = (stakeholder.stakeholder_coverage || [])
        .filter((item) => ["CFO", "Executive Leadership", "COO", "Finance"].includes(item.role))
        .map((item) => item.role)
        .slice(0, 4);
      return [
        "# Executive Demo",
        "",
        "Use this version when senior leaders need confidence quickly and do not want a product tour.",
        "",
        "Customer/demo: " + (metadata.customer_name || "current demo"),
        "Executive angle: visibility, risk reduction, trusted numbers, speed to decision, and financial control.",
        "",
        "## Executive Opening",
        "",
        "Open with the business decision, not the screen. Position NetSuite as the way leadership gets one reliable view of performance, risk, and operational control.",
        "",
        "## Executive Flow",
        "",
        "1. Leadership overview: show the high-level view first and explain what decision it supports.",
        "2. KPI confidence: show the number that matters most and why the executive can trust it.",
        "3. Risk reduction: drill once to prove auditability, ownership, or source detail.",
        "4. Business control: show forecast, consolidation, reporting confidence, or cash visibility depending on the account story.",
        "5. Decision close: ask which outcome they want validated next.",
        "",
        "## Moments To Land",
        bulletLines(moments.length ? moments : ["Executive dashboard or overview", "Trusted reporting proof", "Forecast, consolidation, or operational visibility"]),
        "",
        "## Keep Out Of The Main Path",
        bulletLines(avoidItems.length ? avoidItems : ["Admin setup", "Configuration walkthroughs", "Deep implementation detail", "Feature-by-feature explanation"]),
        "",
        "## Stakeholders To Speak To",
        bulletLines(stakeholderFocus.length ? stakeholderFocus : ["CFO", "Executive Leadership", "Finance leader"]),
        "",
        "## Executive Close",
        "",
        "Close by asking: Based on what we proved, which business outcome would matter most to validate in the next session?"
      ].join("\\n");
    }

    function technicalDemoOutput(metadata, discovery, winning, avoid, stakeholder) {
      const moments = (winning.winning_moments || []).slice(0, 3);
      const missing = (discovery.missing_discovery_items || []).slice(0, 5);
      const technicalStakeholders = (stakeholder.stakeholder_coverage || [])
        .filter((item) => ["IT", "Operations", "Finance"].includes(item.role))
        .map((item) => item.role)
        .slice(0, 4);
      return [
        "# Technical-Audience Demo",
        "",
        "Use this version when IT, admins, architects, or technical approvers need to understand fit, control, data flow, and risk.",
        "",
        "Customer/demo: " + (metadata.customer_name || "current demo"),
        "Technical angle: prove the platform can support the business process without creating integration, security, reporting, or administration risk.",
        "",
        "## Technical Flow",
        "",
        "1. Business anchor: start with the same business problem so the session does not become abstract architecture.",
        "2. Role and permission view: show how the experience changes by responsibility and control point.",
        "3. Data trust: show where a number comes from, how it is traceable, and how reporting stays consistent.",
        "4. Integration conversation: explain where connected systems fit, what data needs to move, and what should be validated later.",
        "5. Admin and governance: keep it short, but show enough to build confidence in maintainability.",
        "6. Technical close: confirm blockers, dependencies, and validation steps.",
        "",
        "## Proof Moments To Keep",
        bulletLines(moments.length ? moments : ["Role-based experience", "Drilldown to source detail", "Reporting or integration control point"]),
        "",
        "## Validation Questions",
        bulletLines(missing.length ? missing.map((item) => "Clarify " + String(item).toLowerCase() + ".") : [
          "Which systems must integrate with NetSuite in phase 1?",
          "Which reporting outputs must be governed centrally?",
          "Which permission, audit, or approval controls are mandatory?"
        ]),
        "",
        "## Keep Out Of Scope Unless Asked",
        bulletLines((avoid.avoid_showing || []).slice(0, 5).length ? (avoid.avoid_showing || []).slice(0, 5) : ["Unsupported implementation claims", "Deep customization detail", "Competitor claims that have not been validated"]),
        "",
        "## Stakeholders To Speak To",
        bulletLines(technicalStakeholders.length ? technicalStakeholders : ["IT", "Finance operations", "System administrator"])
      ].join("\\n");
    }

    function bulletLines(items = []) {
      return (items || []).filter(Boolean).map((item) => "- " + item).join("\\n") || "- None detected.";
    }

    function setPendingAiAction(mode, instruction, statusText) {
      pendingAiAction = { mode, instruction };
      intelligenceActionOutput.value = instruction || "";
      applyAiActionToGuideButton.disabled = !String(instruction || "").trim();
      intelligenceActionOutput.focus();
      setStatus(statusText || "Guide action preview ready. Edit the output if needed, then apply it to the SC guide.");
    }

    function showStandaloneAiOutput(output, statusText) {
      pendingAiAction = null;
      intelligenceActionOutput.value = output || "";
      applyAiActionToGuideButton.disabled = true;
      intelligenceActionOutput.focus();
      setStatus(statusText || "AI output created.");
    }

    function clearPendingAiAction(message = "") {
      pendingAiAction = null;
      applyAiActionToGuideButton.disabled = true;
      if (message) intelligenceActionOutput.value = message;
    }

    function previewAiAction(mode, statusText) {
      const instruction = actionTextFor(mode);
      if (!instruction) {
        clearPendingAiAction("Refresh Intelligence first so the helper has current analysis.");
        setStatus("Refresh Intelligence first.");
        return;
      }
      setPendingAiAction(mode, instruction, statusText);
    }

    function setActiveAiActionButton(buttonId) {
      document.querySelectorAll("[data-ai-action-button]").forEach((button) => button.classList.remove("ai-action-active"));
      const button = document.getElementById(buttonId);
      if (button) button.classList.add("ai-action-active");
    }

    intelligenceActionOutput.oninput = () => {
      if (!pendingAiAction) return;
      applyAiActionToGuideButton.disabled = !intelligenceActionOutput.value.trim();
    };

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
        setupPromptSource.textContent = "Source will appear after the setup prompt loads.";
        return;
      }

      const account = payload.account || {};
      const items = payload.setupPlan?.items || [];
      setupPrompt.value = payload.prompt || "";
      setupAccountSummary.textContent = "Target account: " + (account.account || "unknown") + " | Host: " + (account.host || "unknown") + " | Role: " + (account.role || "unknown");
      setupItemSummary.textContent = items.length
        ? "Potential create/setup items: " + items.map((item) => item.label).join(", ")
        : "No create-in-account prep items were inferred. Keep this demo read-only unless setup requirements are added.";
      setupPromptSource.textContent = sourceLabel(payload.promptSource);
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
      renderStakeholderPersonas();
    }

      const markPrepDirtyForIntelligence = () => {
        prepDirtyForIntelligence = true;
        prepDirtyForPreDemoIntelligence = true;
        renderStakeholderPersonas();
      };
      document.getElementById("instructions").addEventListener("input", markPrepDirtyForIntelligence);
      document.getElementById("companyUrl").addEventListener("input", markPrepDirtyForIntelligence);
      document.getElementById("intensity").addEventListener("change", markPrepDirtyForIntelligence);
      demoScopeField.addEventListener("input", markPrepDirtyForIntelligence);
      competitionField.addEventListener("input", markPrepDirtyForIntelligence);
      topicField.addEventListener("input", markPrepDirtyForIntelligence);
      preDemoNotesField.addEventListener("input", markPrepDirtyForIntelligence);
      outputLanguageSelect.addEventListener("change", markPrepDirtyForIntelligence);
      audienceSelect.onchange = () => { updateAudienceHints(); markPrepDirtyForIntelligence(); };
      targetAudienceSelect.onchange = () => { updateAudienceHints(); markPrepDirtyForIntelligence(); };
      demoStrategySelect.onchange = () => { updateStrategyIndustryHints(); markPrepDirtyForIntelligence(); };
      industrySelect.onchange = () => { updateStrategyIndustryHints(); markPrepDirtyForIntelligence(); };
      manifestDemoModeSelect.onchange = () => { updateManifestDemoModeHint(); markPrepDirtyForIntelligence(); };
      inputModeSelect.onchange = () => { syncInputMode(); markPrepDirtyForIntelligence(); };
      voiceProviderSelect.onchange = () => {
        syncVoiceProviderSettings();
        loadVoices();
        markPrepDirtyForIntelligence();
      };
      voiceSelect.onchange = () => { updateAvatarPersona(); markPrepDirtyForIntelligence(); };
      voiceApiKeyField.oninput = () => {
        if (voiceApiKeyField.value.trim()) sessionStorage.setItem(voiceApiKeyStorageKey(), voiceApiKeyField.value.trim());
        else sessionStorage.removeItem(voiceApiKeyStorageKey());
      };
      voiceApiKeyField.onchange = () => loadVoices(voiceSelect.value);

    async function load(action = "Reload") {
      startCodexProgress("Loading NetSuite Demo Helper", "Loading the last saved workspace from this machine.", [
        "Detect Codex on this machine",
        "Read the saved SC guide and manifest",
        "Restore last generated Intelligence"
      ]);
      try {
        await refreshCodexStatus();
        updateCodexProgress("Reading the last saved manifest, SC guide, and Intelligence from this machine.", 1);
        render(await api("/api/manifest"), action);
        finishCodexProgress("Workspace loaded from the last saved local state.");
      } catch (error) {
        setStatus(error.message);
        failCodexProgress(error.message);
      }
    }

      async function loadVoices(preferredVoice = "") {
        if (!liveDemoFunctionalityEnabled) {
          voiceSelect.innerHTML = "<option value='Moira'>Narration disabled</option>";
          voiceProviderHint.textContent = "Live demo functionality is disabled in Admin, so narrator voice selection is hidden.";
          return;
        }
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

    async function loadGuide(action = "SC Guide refresh") {
      startCodexProgress("Refreshing SC Guide", "Codex is checking whether the guide needs to be generated or refreshed.", [
        "Read current guide",
        "Ask Codex if generation is needed",
        "Update the guide screen"
      ]);
      try {
        const payload = await api("/api/sc-guide");
        scGuide.value = payload.guide || "";
        renderGuideOutputs(payload.guide || "", payload.guideOutputs);
        const setupPayload = await api("/api/setup-prompt");
        renderSetupPrompt(setupPayload.setupPrompt);
        markPageLoaded("guide", action);
        finishCodexProgress("SC guide refreshed.");
      } catch (error) {
        failCodexProgress(error.message);
        throw error;
      }
    }

    async function loadIntelligence(action = "Demo Intelligence refresh") {
      startCodexProgress("Refreshing Intelligence", "Codex is reviewing the current Prep fields, SC guide, dry-run manifest, and saved Pre-Demo website context.", [
        "Send current Prep fields to Codex",
        "Review risk, gaps, pacing, and stakeholders",
        "Update the dashboard"
      ]);
      try {
        const payload = await api("/api/intelligence", {
          method: "POST",
          body: JSON.stringify(currentPrepPayload())
        });
        renderIntelligence(payload.intelligence);
        latestFollowUpQuestionsMarkdown = "";
        latestFollowUpQuestionCards = [];
        renderPreDemoIntelligence(payload.preDemoIntelligence || preDemoIntelligenceFromDemoIntelligence(payload.intelligence));
        prepDirtyForIntelligence = false;
        prepDirtyForPreDemoIntelligence = false;
        markPageLoaded("intelligence", action);
        markPageLoaded("pre-demo-intelligence", action);
        finishCodexProgress("Intelligence refreshed from current Prep inputs.");
        return payload;
      } catch (error) {
        failCodexProgress(error.message);
        throw error;
      }
    }

    async function loadPreDemoIntelligence(action = "Pre-demo scoring") {
      setStatus("Running Codex pre-demo scoring against the current notes and discovery context...");
      startCodexProgress("Scoring Pre-Demo Notes", "Codex is reviewing the company context, Prep inputs, notes, and Admin scoring guidance. The website scan is reused when the URL already matches.", [
        "Package pre-demo context and website signal",
        "Run Codex pre-demo scorer",
        "Update Pre-Demo Intelligence"
      ]);
      try {
        const payload = await api("/api/pre-demo-intelligence", {
          method: "POST",
          body: JSON.stringify(currentPrepPayload())
        });
        latestFollowUpQuestionsMarkdown = "";
        latestFollowUpQuestionCards = [];
        renderPreDemoIntelligence(payload.preDemoIntelligence);
        prepDirtyForPreDemoIntelligence = false;
        markPageLoaded("pre-demo-intelligence", action);
        setStatus("Pre-demo scoring refreshed with Codex.");
        finishCodexProgress("Pre-demo scoring refreshed.");
        return payload;
      } catch (error) {
        failCodexProgress(error.message);
        throw error;
      }
    }

    function currentPrepPayload(extra = {}) {
      return {
        topic: topicField.value,
        inputMode: inputModeSelect.value,
        manifestDemoMode: manifestDemoModeSelect.value,
        demoStrategy: demoStrategySelect.value,
        industry: industrySelect.value,
        audience: audienceSelect.value,
        marketSegment: selectedMarketSegment(),
        outputLanguage: outputLanguageSelect.value,
        instructions: document.getElementById("instructions").value,
        demoScope: demoScopeField.value,
        competition: competitionField.value,
        companyUrl: document.getElementById("companyUrl").value,
        preDemoNotes: preDemoNotesField.value,
        valueIntensity: document.getElementById("intensity").value,
        voiceProvider: voiceProviderSelect.value,
        voice: voiceSelect.value,
        ...extra
      };
    }

    async function activateTab(tabName, options = {}) {
      const button = document.querySelector("[data-tab='" + tabName + "']");
      if (!button) return;
      if (!liveDemoFunctionalityEnabled && button.matches("[data-live-demo-only]")) {
        return activateTab("prep", { skipAutoLoad: true });
      }
        document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
        document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
        button.classList.add("active");
        document.getElementById("screen-" + button.dataset.tab).classList.add("active");
        sessionStorage.setItem("nsdhActiveTab", button.dataset.tab);
      if (options.skipAutoLoad) return;
      if (button.dataset.tab === "admin") await loadCmsStatus();
      if (button.dataset.tab === "intelligence" && prepDirtyForIntelligence) await loadIntelligence();
      if (button.dataset.tab === "pre-demo-intelligence" && (prepDirtyForPreDemoIntelligence || !latestPreDemoIntelligence)) await loadPreDemoIntelligence();
    }

    document.querySelectorAll(".tab").forEach((button) => {
      button.onclick = async () => activateTab(button.dataset.tab);
    });

    document.addEventListener("click", (event) => {
      const intelligenceCard = event.target.closest("[data-intel-card]");
      if (intelligenceCard) {
        selectedIntelligenceCard = intelligenceCard.dataset.intelCard;
        intelligenceCardsCompact = true;
        if (latestIntelligence) renderIntelligence(latestIntelligence);
        focusIntelligenceDetail();
        return;
      }
      const heatmapTab = event.target.closest("[data-heatmap-tab]");
      if (heatmapTab) {
        activeHeatmapTab = heatmapTab.dataset.heatmapTab || "discovery";
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

    document.getElementById("reload").onclick = async () => { await load("Reload"); await loadGuide("Reload"); };
    document.getElementById("preDemoScoring").onclick = async () => {
      setBusy(true);
      try {
        await loadPreDemoIntelligence("Pre-demo scoring");
        await activateTab("pre-demo-intelligence", { skipAutoLoad: true });
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(false);
      }
    };
    document.getElementById("reloadManifest").onclick = () => load("Reload Manifest");
    toggleIntelligenceCardsButton.onclick = () => {
      intelligenceCardsCompact = !intelligenceCardsCompact;
      syncIntelligenceCardDensity();
      if (intelligenceCardsCompact) focusIntelligenceDetail();
    };
    document.getElementById("refreshIntelligence").onclick = async () => {
      setActiveAiActionButton("refreshIntelligence");
      setBusy(true);
      try {
        await loadIntelligence("Re-analyze Updated Guide");
        clearPendingAiAction("Insights rebuilt from the current saved SC guide and manifest. Use this after applying a shortened, executive, or technical demo version.");
        setStatus("Re-analyzed updated SC guide and manifest.");
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(false);
      }
    };
    document.getElementById("refreshPreDemoScoring").onclick = async () => {
      setBusy(true);
      try {
        await loadPreDemoIntelligence("Refresh Pre-Demo Scoring");
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(false);
      }
    };
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
    liveDemoFunctionalityToggle.onchange = async () => {
      try {
        const payload = await api("/api/cms/feature-flags", {
          method: "POST",
          body: JSON.stringify({ liveDemoFunctionality: liveDemoFunctionalityToggle.checked })
        });
        applyFeatureFlags(payload.featureFlags);
        renderCms(payload);
        cmsStatus.textContent = liveDemoFunctionalityEnabled
          ? "Live demo functionality is enabled. Narration, dry-run, dataset analysis, and Run controls are visible."
          : "Live demo functionality is disabled. The app now focuses on Prep, SC Guide, and Intelligence only.";
      } catch (error) {
        liveDemoFunctionalityToggle.checked = liveDemoFunctionalityEnabled;
        cmsStatus.textContent = error.message;
      }
    };
    document.getElementById("reloadButtonInstructionFiles").onclick = loadButtonInstructionCatalog;
    document.getElementById("generateButtonInstructionFiles").onclick = async () => {
      try {
        const payload = await api("/api/button-instructions/export", { method: "POST", body: "{}" });
        renderButtonInstructionFiles(payload.files || [], "Generated " + ((payload.files || []).length) + " JSON instruction files.");
        markPageLoaded("admin", "Button/API JSON generated");
      } catch (error) {
        buttonInstructionStatus.textContent = error.message;
      }
    };
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
    async function generateDiscoveryFollowUpsForCurrentPrep(actionLabel = "Generate With Codex") {
      const payload = await api("/api/intelligence/follow-up-questions", {
        method: "POST",
        body: JSON.stringify(currentPrepPayload({
          additionalComments: followUpQuestionComments.value
        }))
      });
      latestFollowUpQuestionsMarkdown = payload.questions || "";
      latestFollowUpQuestionCards = questionCardsFromMarkdown(latestFollowUpQuestionsMarkdown);
      if (payload.preDemoIntelligence || payload.intelligence) {
        renderPreDemoIntelligence(payload.preDemoIntelligence || preDemoIntelligenceFromDemoIntelligence(payload.intelligence));
        markPageLoaded("pre-demo-intelligence", actionLabel);
      }
      if (payload.intelligence) {
        renderIntelligence(payload.intelligence);
        markPageLoaded("intelligence", actionLabel);
      }
      return payload;
    }

    async function runDiscoveryFollowUps({ showInAiOutput = false, actionLabel = "Generate With Codex" } = {}) {
      setBusy(true);
      try {
        startCodexProgress("Generating Discovery Questions", "Codex is checking the website context, pre-demo notes, SC guide, and Intelligence signals.", [
          "Package customer and demo context",
          "Ask Codex for missing discovery",
          "Show the questions in Pre-Demo Intelligence"
        ]);
        setStatus("Running Codex discovery operator against the website context, prep notes, demo request, scope, SC guide, and current Intelligence...");
        const payload = await generateDiscoveryFollowUpsForCurrentPrep(actionLabel);
        const operatorFooter = [
          "",
          "---",
          "Operator: " + (payload.operator || "unknown"),
          payload.sessionTitle ? "Task: " + payload.sessionTitle : "",
          payload.promptFile ? "Prompt file: " + payload.promptFile : "",
          payload.outputFile ? "Output file: " + payload.outputFile : "",
          payload.codexError ? "Codex note: " + payload.codexError : ""
        ].filter(Boolean).join("\\n");
        if (showInAiOutput) {
          showStandaloneAiOutput((payload.questions || "") + operatorFooter, payload.operator === "codex-background-operator"
            ? "Codex discovery operator completed. These questions are also shown in Pre-Demo Intelligence and are not applied to the SC guide."
            : "Codex operator was unavailable, so the helper returned a fallback question set and saved the Codex prompt for manual use.");
        } else {
          setStatus("Codex discovery questions generated. Review them in Recommended Follow-Up Questions.");
        }
        finishCodexProgress("Discovery questions created.");
      } catch (error) {
        setStatus(error.message);
        failCodexProgress(error.message);
      } finally {
        setBusy(false);
      }
    }

    document.getElementById("createFollowUps").onclick = async () => {
      setActiveAiActionButton("createFollowUps");
      await runDiscoveryFollowUps({ showInAiOutput: true, actionLabel: "Generate Discovery Follow-Up Questions" });
    };

    document.getElementById("generatePreDemoFollowUps").onclick = async () => {
      await runDiscoveryFollowUps({ showInAiOutput: false, actionLabel: "Generate With Codex" });
    };

    document.getElementById("exportPreDemoFollowUps").onclick = async () => {
      setBusy(true);
      try {
        const payload = await api("/api/export-follow-up-questions-docx", {
          method: "POST",
          body: JSON.stringify(currentPrepPayload({
            additionalComments: followUpQuestionComments.value,
            preDemoIntelligence: latestPreDemoIntelligence,
            questions: latestFollowUpQuestionCards.length
              ? latestFollowUpQuestionCards.map((card) => card.question)
              : (latestPreDemoIntelligence?.recommended_follow_up_questions || []),
            questionsMarkdown: latestFollowUpQuestionsMarkdown
          }))
        });
        setStatus("Discovery follow-up questions exported: " + payload.path);
        window.location.href = payload.downloadUrl;
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(false);
      }
    };
    document.getElementById("improveGuideFromIntel").onclick = async () => {
      setActiveAiActionButton("improveGuideFromIntel");
      setBusy(true);
      try {
        startCodexProgress("Applying All Recommendations", "Codex is rewriting the SC guide using the Intelligence recommendations.", [
          "Read Intelligence recommendations",
          "Rewrite the SC guide with Codex",
          "Refresh the Intelligence dashboard"
        ]);
        const payload = await api("/api/intelligence/improve-guide", { method: "POST", body: "{}" });
        scGuide.value = payload.guide || "";
        renderGuideOutputs(payload.guide || "", payload.guideOutputs);
        renderIntelligence(payload.intelligence);
        renderPreDemoIntelligence(payload.preDemoIntelligence || preDemoIntelligenceFromDemoIntelligence(payload.intelligence));
        prepDirtyForIntelligence = false;
        prepDirtyForPreDemoIntelligence = false;
        markPageLoaded("guide", "Apply All Recommendations To SC Guide");
        markPageLoaded("intelligence", "Apply All Recommendations To SC Guide");
        markPageLoaded("pre-demo-intelligence", "Apply All Recommendations To SC Guide");
        clearPendingAiAction("All Intelligence recommendations were applied to the SC guide. Review the SC Guide tab for the updated runbook and improvement section.");
        setStatus("Applied all Intelligence recommendations to the SC guide.");
        finishCodexProgress("SC guide improved and Intelligence refreshed.");
      } catch (error) {
        setStatus(error.message);
        failCodexProgress(error.message);
      } finally {
        setBusy(false);
      }
    };
    document.getElementById("compressDemo").onclick = () => {
      setActiveAiActionButton("compressDemo");
      previewAiAction("compress", "Shortened demo draft ready. Edit it if needed, then apply it to the SC guide.");
    };
    document.getElementById("generateExecutiveVersion").onclick = () => {
      setActiveAiActionButton("generateExecutiveVersion");
      previewAiAction("executive", "Executive demo draft ready. Edit it if needed, then apply it to the SC guide.");
    };
    document.getElementById("rebuildTechnicalAudience").onclick = () => {
      setActiveAiActionButton("rebuildTechnicalAudience");
      previewAiAction("technical", "Tech-audience demo draft ready. Edit it if needed, then apply it to the SC guide.");
    };
    document.getElementById("copyCustomAiInstruction").onclick = () => {
      setActiveAiActionButton("copyCustomAiInstruction");
      const instruction = customAiInstruction.value.trim();
      if (!instruction) {
        clearPendingAiAction("Write a custom instruction first. Example: make this sharper for a CFO, keep the finance story focused, and reduce implementation detail.");
        setStatus("Add a custom instruction before previewing it.");
        return;
      }
      previewAiAction("custom", "Custom instruction preview ready. Edit it if needed, then apply it to the SC guide.");
    };
    applyAiActionToGuideButton.onclick = async () => {
      if (!pendingAiAction) {
        setStatus("Preview a guide action first. Discovery follow-up questions are not applied to the SC guide.");
        return;
      }
      const editedInstruction = intelligenceActionOutput.value.trim();
      if (!editedInstruction) {
        applyAiActionToGuideButton.disabled = true;
        setStatus("Add text to the editable output before applying it to the SC guide.");
        return;
      }
      setBusy(true);
      try {
        startCodexProgress("Updating SC Guide", "Codex is applying the selected guide action to the editable output.", [
          "Read edited output",
          "Rewrite the SC guide with Codex",
          "Refresh the Intelligence dashboard"
        ]);
        const payload = await api("/api/intelligence/apply-action", {
          method: "POST",
          body: JSON.stringify({ ...pendingAiAction, instruction: editedInstruction })
        });
        scGuide.value = payload.guide || "";
        renderGuideOutputs(payload.guide || "", payload.guideOutputs);
        renderIntelligence(payload.intelligence);
        renderPreDemoIntelligence(payload.preDemoIntelligence || preDemoIntelligenceFromDemoIntelligence(payload.intelligence));
        prepDirtyForIntelligence = false;
        prepDirtyForPreDemoIntelligence = false;
        markPageLoaded("guide", "Apply Edited Output To SC Guide");
        markPageLoaded("intelligence", "Apply Edited Output To SC Guide");
        markPageLoaded("pre-demo-intelligence", "Apply Edited Output To SC Guide");
        clearPendingAiAction((payload.message || "Applied edited output to SC guide.") + " Review the SC Guide tab for the updated runbook.");
        setStatus("Applied edited output to SC guide.");
        finishCodexProgress("SC guide updated.");
      } catch (error) {
        setStatus(error.message);
        failCodexProgress(error.message);
      } finally {
        setBusy(false);
      }
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
        render(payload, "Save Manifest");
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
        startCodexProgress("Creating Runnable Manifest", "The helper is turning the Dry-run creation prompt into browser steps and refreshing Intelligence.", [
          "Read the Dry-run creation prompt",
          "Build the runnable manifest from the prompt",
          "Refresh Codex-backed Intelligence"
        ]);
        const payload = await api("/api/manifest/from-guide", { method: "POST", body: "{}" });
        render(payload, "Create Dry-Run From Prompt");
        setStatus("Runnable manifest refreshed from the Dry-run creation prompt. Use Buffer Dry-Run before Live Demo.");
        finishCodexProgress("Runnable manifest created.");
      } catch (error) {
        setStatus(error.message);
        failCodexProgress(error.message);
      } finally {
        setBusy(false);
      }
    };

    document.getElementById("runDatasetAnalysis").onclick = async () => {
      setBusy(true);
      try {
        startCodexProgress("Running Dataset Analysis", "NetSuite will open if needed. Log in there, then the helper will run the dry-run path and score the dataset.", [
          "Refresh dry-run manifest",
          "Open NetSuite and run dry-run",
          "Score dataset readiness"
        ]);
        setStatus("Running Dataset Analysis. If NetSuite asks for login, complete login in the browser window.");
        const payload = await api("/api/dataset-analysis", {
          method: "POST",
          body: JSON.stringify({
            valueIntensity: document.getElementById("intensity").value
          })
        });
        renderDatasetAnalysis(payload);
        markPageLoaded("dataset", "Dataset Analysis");
        setStatus("Dataset Analysis complete. Review missing data/customizations and the Codex setup prompt.");
        finishCodexProgress("Dataset Analysis complete.");
      } catch (error) {
        setStatus(error.message);
        failCodexProgress(error.message);
      } finally {
        setBusy(false);
      }
    };

    executeDatasetPromptButton.onclick = async () => {
      if (!latestDatasetAnalysis?.codexPrompt) {
        setStatus("Run Dataset Analysis first so the Codex setup prompt can be generated.");
        return;
      }
      const account = latestDatasetAnalysis.account || {};
      const items = latestDatasetAnalysis.actionItems || [];
      const confirmed = window.confirm(
        "Prepare Codex to inspect and optionally create the missing dataset/customizations?\\n\\n" +
        "Account: " + (account.account || "unknown") + "\\n" +
        "Host: " + (account.host || "unknown") + "\\n" +
        "Role: " + (account.role || "unknown") + "\\n\\n" +
        "Items to inspect: " + (items.length ? items.map((item) => item.label).join(", ") : "none detected") + "\\n\\n" +
        "Codex must confirm front-end and back-end NetSuite access and ask before doing write actions."
      );
      if (!confirmed) return;
      setBusy(true);
      try {
        const payload = await api("/api/dataset-analysis/execute-prompt", {
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

    document.getElementById("stopDatasetRun").onclick = async () => {
      try {
        const payload = await api("/api/stop", { method: "POST", body: "{}" });
        setStatus(payload.message || "Stop requested.");
      } catch (error) {
        setStatus(error.message);
      }
    };

    async function createDemoWorkflow(createRunnableManifest) {
      if (createRunnableManifest && !liveDemoFunctionalityEnabled) {
        setStatus("Live demo functionality is switched off in Admin. Use Learn / Create Demo to generate the SC guide and intelligence only.");
        return;
      }
      setBusy(true);
      try {
        setStatus(createRunnableManifest
          ? "Checking company context with the Codex prep operator, creating the SC guide, and building the runnable manifest..."
          : "Checking company context with the Codex prep operator and creating the SC guide...");
        startCodexProgress("Creating Demo With Codex", createRunnableManifest
          ? "Codex is reading the website context, notes, scope, and instructions before generating the guide and runnable manifest."
          : "Codex is reading the website context, notes, scope, and instructions before generating the guide.", [
          "Analyze company and pre-demo notes",
          "Run Codex prep operator",
          "Generate Codex-authored SC guide",
          createRunnableManifest ? "Create dry-run prompt, runnable manifest, and dry-run" : "Refresh Intelligence dashboard"
        ]);
        const payload = await api("/api/learn", {
          method: "POST",
          body: JSON.stringify(currentPrepPayload({ createRunnableManifest }))
        });
        render(payload, createRunnableManifest ? "Learn / Create Demo & Dry-Run" : "Learn / Create Demo", {
          markManifest: createRunnableManifest
        });
        scGuide.value = payload.guide || "";
        renderGuideOutputs(payload.guide || "", payload.guideOutputs);
        if (createRunnableManifest) {
          setStatus("SC guide and runnable manifest created. Starting browser dry-run...");
          updateCodexProgress("Guide created. Starting the browser dry-run.", 3);
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
          finishCodexProgress("Demo generated and browser dry-run completed.");
        } else {
          setStatus("SC guide and Intelligence created. Runnable manifest was not built yet.");
          finishCodexProgress("SC guide and Intelligence created.");
        }
      } catch (error) {
        setStatus(error.message);
        failCodexProgress(error.message);
      } finally {
        setBusy(false);
      }
    }

    document.getElementById("learn").onclick = () => createDemoWorkflow(false);
    document.getElementById("learnDryRun").onclick = () => createDemoWorkflow(true);

    document.getElementById("sampleVoice").onclick = async () => {
      setBusy(true);
      try {
        await api("/api/voice-sample", {
          method: "POST",
          body: JSON.stringify({
              voice: voiceSelect.value,
              voiceProvider: voiceProviderSelect.value,
              voiceApiKey: selectedVoiceApiKey(),
              line: "Let's show how NetSuite gives finance teams a clearer view of performance and the decisions behind it."
            })
        });
        setStatus("Played sample voice: " + voiceSelect.value);
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(false);
      }
    };

    document.getElementById("openBrowser").onclick = () => run("dry-run-prep");
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
      const runLabels = {
        "dry-run-prep": "Dry-Run Prep",
        "buffer-dry-run": "Buffer Dry-Run",
        live: "Live Demo",
        open: "Dry-Run Prep",
        dry: "Dry Run",
        rehearse: "Rehearsal"
      };
      if (["dry-run-prep", "buffer-dry-run", "live"].includes(mode)) {
        let confirmed = false;
        try {
          confirmed = await confirmDryRunPromptForRun(runLabels[mode] || mode);
        } catch (error) {
          setStatus(error.message);
          return;
        }
        if (!confirmed) {
          setStatus((runLabels[mode] || mode) + " cancelled. The dry-run creation prompt was not used.");
          return;
        }
      }
      runInProgress = true;
      setBusy(true);
      setStatus("Running " + (runLabels[mode] || mode) + "...");
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
        markPageLoaded("run", runLabels[mode] || mode);
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
        render(payload, "Restore Selected");
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
        renderStakeholderPersonas();
        await load("App load");
      await loadGuide("App load");
      const activeTab = sessionStorage.getItem("nsdhActiveTab");
      if (activeTab && document.querySelector('.tab[data-tab="' + activeTab + '"]')) {
        await activateTab(activeTab);
      }
      await pollNarrator();
      setInterval(pollNarrator, 1500);
      setInterval(updatePageLoadedAges, 60000);
    })().catch((error) => setStatus(error.message));
  </script>
</body>
</html>`);
}

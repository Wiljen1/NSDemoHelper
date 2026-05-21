export const subscriptionTierBlueprints = [
  {
    id: "pilot",
    label: "Pilot",
    intendedFor: "Design partners and early customer pilots",
    limits: { monthlyAiRuns: 250, monthlyWorkspaces: 50, activeKnowledgeSources: 5 },
    commercialGoal: "Validate willingness to pay, activation, and repeat usage."
  },
  {
    id: "team",
    label: "Team",
    intendedFor: "Small SC teams standardizing demo preparation",
    limits: { monthlyAiRuns: 1500, monthlyWorkspaces: 250, activeKnowledgeSources: 15 },
    commercialGoal: "Land with one team and expand by workflow adoption."
  },
  {
    id: "business",
    label: "Business",
    intendedFor: "Revenue organizations with multiple demo teams",
    limits: { monthlyAiRuns: 6000, monthlyWorkspaces: 1200, activeKnowledgeSources: 50 },
    commercialGoal: "Support department-wide demo intelligence and governance."
  },
  {
    id: "enterprise",
    label: "Enterprise",
    intendedFor: "Large organizations needing SSO, audit, governance, and custom packs",
    limits: { monthlyAiRuns: 25000, monthlyWorkspaces: 5000, activeKnowledgeSources: 200 },
    commercialGoal: "Sell platform standardization, risk reduction, and enablement IP."
  }
];

export const userRoleBlueprints = [
  { id: "owner", label: "Owner", purpose: "Controls tenant, billing, security, providers, and users." },
  { id: "admin", label: "Admin", purpose: "Manages providers, sources, branding, feature flags, and playbooks." },
  { id: "solution_consultant", label: "Solution Consultant", purpose: "Creates workspaces, runs intelligence, rehearses, and exports outputs." },
  { id: "viewer", label: "Viewer", purpose: "Reviews outputs and demo readiness without changing configuration." }
];

export const productCapabilityRegistry = [
  { id: "workspace_management", label: "Customer / Deal Workspaces", status: "foundation", category: "Core Workflow", defensibility: "Medium", commercialValue: "Keeps prep work reusable and tenant-scoped." },
  { id: "discovery_scoring", label: "Discovery Scoring", status: "mvp-active", category: "Demo Intelligence", defensibility: "High", commercialValue: "Highlights weak discovery before demo generation." },
  { id: "demo_readiness", label: "Demo Readiness Scoring", status: "mvp-active", category: "Demo Intelligence", defensibility: "High", commercialValue: "Turns senior SC judgment into repeatable coaching signals." },
  { id: "persona_story_orchestration", label: "Persona Story Orchestration", status: "mvp-active", category: "Storytelling", defensibility: "High", commercialValue: "Creates stakeholder-specific demo narratives." },
  { id: "rehearsal_coaching", label: "Rehearsal Coaching", status: "foundation", category: "Coaching", defensibility: "High", commercialValue: "Improves delivery quality before customer-facing demos." },
  { id: "knowledge_enrichment", label: "Knowledge Source Enrichment", status: "foundation", category: "Context", defensibility: "High", commercialValue: "Connects internal playbooks and approved content to demo preparation." },
  { id: "ai_provider_abstraction", label: "AI Provider Abstraction", status: "foundation", category: "Platform", defensibility: "Medium", commercialValue: "Reduces vendor lock-in and supports enterprise AI preferences." },
  { id: "content_pack_model", label: "Product / Industry Content Packs", status: "foundation", category: "White Label", defensibility: "High", commercialValue: "Allows one platform to support many demo products." },
  { id: "automation_manifests", label: "Automation Manifests", status: "mvp-active", category: "Automation", defensibility: "Medium", commercialValue: "Turns strategy into runnable dry-runs and guided execution." },
  { id: "audit_usage_tracking", label: "Audit & Usage Tracking", status: "planned", category: "SaaS Ops", defensibility: "Medium", commercialValue: "Enables enterprise trust, pricing, and adoption analytics." }
];

export const defensibleCoreBlueprint = [
  "Demo readiness and risk scoring logic",
  "Discovery gap detection and follow-up question generation",
  "Persona and stakeholder story orchestration",
  "Reusable playbooks and product/industry content packs",
  "Source-aware knowledge enrichment with advisory trust policy",
  "Rehearsal coaching and demo behavior feedback",
  "Automation manifest generation and dry-run verification",
  "AI provider abstraction with tenant-level policy controls"
];

export function buildFounderReadinessSnapshot({
  buildMetadata = {},
  tenantConfig = {},
  health = {},
  aiRegistry = {},
  knowledgeRegistry = {}
} = {}) {
  const checks = readinessChecks({ buildMetadata, tenantConfig, health, aiRegistry, knowledgeRegistry });
  const readinessScore = Math.round(checks.reduce((sum, check) => sum + check.score, 0) / checks.length);
  const gaps = checks.filter((check) => check.score < 70);
  const criticalGaps = checks.filter((check) => check.status === "critical");
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    readinessScore,
    readinessLabel: readinessLabel(readinessScore),
    founderPhase: founderPhase(readinessScore),
    pilotReadiness: readinessScore >= 65 && criticalGaps.length === 0 ? "pilot-ready-with-controls" : "needs-foundation-work",
    checks,
    topPriorities: gaps.slice(0, 5).map((gap) => ({
      area: gap.area,
      recommendation: gap.recommendation,
      whyItMatters: gap.whyItMatters
    })),
    quickWins: quickWins(checks),
    commercialModel: {
      currentTier: tenantConfig.commercial?.subscriptionTier || "pilot",
      planStatus: tenantConfig.commercial?.planStatus || "pilot-ready-foundation",
      tiers: subscriptionTierBlueprints,
      roles: userRoleBlueprints,
      usageLimits: tenantConfig.commercial?.usageLimits || {}
    },
    capabilities: productCapabilityRegistry,
    defensibleCore: defensibleCoreBlueprint,
    suggestedImplementationOrder: [
      "Lock customer/deal workspace model and usage event schema.",
      "Move scoring, persona, playbook, and source logic out of UI into platform services.",
      "Add tenant-scoped persistence and audit/event logging.",
      "Add real provider adapter for one cloud AI provider while keeping Codex as local fallback.",
      "Add knowledge-source connector proof of concept with source citations and confidence.",
      "Add pilot onboarding flow and plan/usage limits.",
      "Prepare cloud auth, secret store, and deployment runbooks."
    ],
    risks: [
      "Current storage is still local-file based, so it is not yet externally multi-tenant safe.",
      "Admin authentication is local-session based, not enterprise SSO.",
      "Future external knowledge sources need source attribution and claim validation.",
      "Billing and usage enforcement are modeled but not active.",
      "NetSuite content pack separation is not complete yet."
    ]
  };
}

function readinessChecks({ buildMetadata, tenantConfig, health, aiRegistry, knowledgeRegistry }) {
  const whiteLabel = buildMetadata.profile === "whitelabel";
  const activeProvider = (aiRegistry.providers || []).find((provider) => provider.id === aiRegistry.activeProviderId) || (aiRegistry.providers || [])[0] || {};
  const activeSources = (knowledgeRegistry.sources || []).filter((source) => source.active);
  return [
    readinessCheck({
      area: "Product Foundation",
      score: whiteLabel ? 72 : 48,
      status: whiteLabel ? "warning" : "critical",
      evidence: whiteLabel ? "White-label mode is isolated from MVP and has platform-only controls." : "MVP profile is active; white-label controls are hidden.",
      recommendation: "Keep feature work on white-label profile and preserve MVP as the stable demo baseline.",
      whyItMatters: "A commercial platform needs a protected baseline and a separate evolution path."
    }),
    readinessCheck({
      area: "Tenant Configuration",
      score: tenantConfig.tenantId && tenantConfig.branding?.appName ? 68 : 35,
      status: tenantConfig.tenantId && tenantConfig.branding?.appName ? "warning" : "critical",
      evidence: `${tenantConfig.tenantName || "No tenant"} / ${tenantConfig.branding?.appName || "No brand"}`,
      recommendation: "Add tenant-scoped persistence, custom domain/brand assets, and tenant-specific content packs.",
      whyItMatters: "White-label deployments need clean customer identity, branding, and configuration boundaries."
    }),
    readinessCheck({
      area: "AI Provider Layer",
      score: activeProvider.providerType === "codex" && health.ai?.connectionStatus === "Connected" ? 76 : 52,
      status: activeProvider.providerType === "codex" && health.ai?.connectionStatus === "Connected" ? "strong" : "warning",
      evidence: `${activeProvider.name || "No provider"} / ${health.ai?.connectionStatus || "Unknown"}`,
      recommendation: "Implement one cloud provider adapter next, with Codex remaining the local/default fallback.",
      whyItMatters: "Enterprise customers will want provider choice, policy control, and predictable uptime."
    }),
    readinessCheck({
      area: "Knowledge Source Layer",
      score: activeSources.length ? 70 : 46,
      status: activeSources.length ? "warning" : "critical",
      evidence: `${activeSources.length} active source(s), ${(knowledgeRegistry.sources || []).length} registered.`,
      recommendation: "Pilot one real connector with source origin, confidence, and claim-validation warnings.",
      whyItMatters: "The platform becomes defensible when it enriches demos with approved internal context."
    }),
    readinessCheck({
      area: "Security Boundary",
      score: health.security?.clientReceivesRawSecrets === false ? 66 : 25,
      status: health.security?.clientReceivesRawSecrets === false ? "warning" : "critical",
      evidence: health.security?.credentialStorage || "No credential policy",
      recommendation: "Move from local secret references to a tenant-aware secret store before external pilots.",
      whyItMatters: "Provider keys and customer context must stay server-side for SaaS readiness."
    }),
    readinessCheck({
      area: "SaaS Commercial Model",
      score: tenantConfig.commercial?.subscriptionTier ? 58 : 30,
      status: "warning",
      evidence: `${tenantConfig.commercial?.subscriptionTier || "No tier"} / ${tenantConfig.commercial?.planStatus || "No plan"}`,
      recommendation: "Turn tier definitions into enforced feature gates and usage limits after pilot validation.",
      whyItMatters: "Pricing and packaging need measurable usage units and clear upgrade paths."
    }),
    readinessCheck({
      area: "Usage & Audit",
      score: tenantConfig.audit?.mode ? 42 : 20,
      status: "critical",
      evidence: tenantConfig.audit?.mode || "No audit model",
      recommendation: "Add append-only audit events for AI runs, exports, provider changes, and workspace creation.",
      whyItMatters: "Audit and usage history support enterprise trust, analytics, and billing readiness."
    }),
    readinessCheck({
      area: "Cloud Deployment",
      score: buildMetadata.cloudMode ? 74 : 38,
      status: buildMetadata.cloudMode ? "warning" : "critical",
      evidence: buildMetadata.cloudMode ? "Cloud mode enabled" : "Local single-process mode",
      recommendation: "Separate frontend/backend hosting, database, queue workers, object storage, and observability.",
      whyItMatters: "A market-ready SaaS needs reliable deployment, scaling, monitoring, and rollback."
    })
  ];
}

function readinessCheck({ area, score, status, evidence, recommendation, whyItMatters }) {
  return { area, score: clamp(score), status, evidence, recommendation, whyItMatters };
}

function quickWins(checks) {
  return checks
    .filter((check) => check.score < 75)
    .slice(0, 4)
    .map((check) => `Improve ${check.area}: ${check.recommendation}`);
}

function readinessLabel(score) {
  if (score >= 85) return "Commercially strong";
  if (score >= 70) return "Pilot ready";
  if (score >= 55) return "Foundation ready";
  return "Early foundation";
}

function founderPhase(score) {
  if (score >= 85) return "Scale preparation";
  if (score >= 70) return "Customer pilot";
  if (score >= 55) return "Founder MVP hardening";
  return "Architecture foundation";
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

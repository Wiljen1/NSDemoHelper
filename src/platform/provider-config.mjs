export const aiProviderTypes = [
  { value: "codex", label: "Codex", adapterStatus: "active" },
  { value: "openai", label: "OpenAI GPT", adapterStatus: "planned" },
  { value: "azure_openai", label: "Azure OpenAI", adapterStatus: "planned" },
  { value: "claude", label: "Claude", adapterStatus: "planned" },
  { value: "gemini", label: "Gemini", adapterStatus: "planned" },
  { value: "local_llm", label: "Local / self-hosted LLM", adapterStatus: "planned" },
  { value: "enterprise_gateway", label: "Enterprise AI gateway", adapterStatus: "planned" },
  { value: "custom", label: "Custom provider", adapterStatus: "planned" }
];

export const knowledgeSourceTypes = [
  { value: "rest_api", label: "REST API" },
  { value: "wiki", label: "Wiki / internal page" },
  { value: "documentation_portal", label: "Documentation portal" },
  { value: "knowledge_base", label: "Knowledge base" },
  { value: "ai_chatbot", label: "AI chatbot endpoint" },
  { value: "retrieval_api", label: "Retrieval / search API" },
  { value: "crm", label: "CRM system" },
  { value: "competitive_intelligence", label: "Competitive intelligence source" },
  { value: "public_web", label: "Public web intelligence" },
  { value: "enablement_repo", label: "Internal enablement repository" },
  { value: "custom", label: "Custom source" }
];

export const knowledgeSourceCategories = [
  "Competitive Intelligence",
  "Industry Intelligence",
  "Product Knowledge",
  "Demo Assets",
  "Discovery Enrichment",
  "Customer Context"
];

export const authMethods = [
  { value: "none", label: "None" },
  { value: "api_key_env", label: "API key from environment / secret reference" },
  { value: "oauth", label: "OAuth" },
  { value: "basic", label: "Basic auth" },
  { value: "enterprise_sso", label: "Enterprise SSO" },
  { value: "custom", label: "Custom" }
];

export function defaultAiProviderRegistry(now = new Date().toISOString()) {
  return {
    schemaVersion: 1,
    activeProviderId: "codex-local",
    updatedAt: now,
    notes: [
      "Codex remains the default active provider for the current MVP.",
      "Future providers are registered here first, then wired through provider adapters later.",
      "Raw API keys should not be stored in this local JSON file. Use environment variables or a future secret vault reference."
    ],
    providers: [
      {
        id: "codex-local",
        name: "Local Codex",
        providerType: "codex",
        active: true,
        apiEndpoint: "local-codex-runtime",
        apiKeyReference: "",
        defaultModel: "Codex local runtime",
        timeoutMs: 120000,
        maxTokens: null,
        temperature: null,
        retryPolicy: "Use current Codex background operator behavior",
        failoverProviderId: "",
        adapterStatus: "active",
        validationStatus: "Not tested in this session",
        lastValidatedAt: "",
        description: "Default MVP reasoning backbone used for demo prep, SC guide generation, intelligence, and guide revisions."
      }
    ]
  };
}

export function defaultKnowledgeSourceRegistry(now = new Date().toISOString()) {
  return {
    schemaVersion: 1,
    updatedAt: now,
    trustPolicy: "External sources are contextual intelligence providers, not guaranteed factual truth. Source origin, category, and confidence must remain visible when source content is used.",
    sources: [
      {
        id: "approved-competitive-battlecards",
        name: "Approved competitive battlecards",
        sourceType: "competitive_intelligence",
        endpointUrl: "",
        authMethod: "api_key_env",
        apiKeyReference: "COMPETITIVE_INTEL_API_KEY",
        active: false,
        scope: "Approved competitive positioning, objection handling, and differentiation guidance.",
        categories: ["Competitive Intelligence"],
        priorityWeight: 80,
        confidenceLevel: "approved-internal",
        validationStatus: "Not configured",
        lastValidatedAt: "",
        notes: "Placeholder for future curated competitive guidance. Competitive output must remain advisory and validated before customer use."
      },
      {
        id: "internal-enablement-repository",
        name: "Internal enablement repository",
        sourceType: "enablement_repo",
        endpointUrl: "",
        authMethod: "enterprise_sso",
        apiKeyReference: "",
        active: false,
        scope: "Reusable demo playbooks, SC best practices, product positioning, and demo asset examples.",
        categories: ["Product Knowledge", "Demo Assets", "Discovery Enrichment"],
        priorityWeight: 60,
        confidenceLevel: "internal-context",
        validationStatus: "Not configured",
        lastValidatedAt: "",
        notes: "Placeholder for future enablement content retrieval."
      }
    ]
  };
}

export function normalizeAiProviderRegistry(input, now = new Date().toISOString()) {
  const fallback = defaultAiProviderRegistry(now);
  const source = input && typeof input === "object" ? input : {};
  const providers = Array.isArray(source.providers)
    ? source.providers.map((provider, index) => normalizeAiProvider(provider, index)).filter(Boolean)
    : fallback.providers;
  const activeProviderId = providers.some((provider) => provider.id === source.activeProviderId)
    ? source.activeProviderId
    : providers.find((provider) => provider.active)?.id || fallback.activeProviderId;

  return {
    schemaVersion: Number(source.schemaVersion) || fallback.schemaVersion,
    activeProviderId,
    updatedAt: String(source.updatedAt || now),
    notes: Array.isArray(source.notes) ? source.notes.map(String) : fallback.notes,
    providers: providers.map((provider) => ({
      ...provider,
      active: provider.id === activeProviderId
    }))
  };
}

export function normalizeKnowledgeSourceRegistry(input, now = new Date().toISOString()) {
  const fallback = defaultKnowledgeSourceRegistry(now);
  const source = input && typeof input === "object" ? input : {};
  const sources = Array.isArray(source.sources)
    ? source.sources.map((item, index) => normalizeKnowledgeSource(item, index)).filter(Boolean)
    : fallback.sources;

  return {
    schemaVersion: Number(source.schemaVersion) || fallback.schemaVersion,
    updatedAt: String(source.updatedAt || now),
    trustPolicy: String(source.trustPolicy || fallback.trustPolicy),
    sources
  };
}

export function sanitizeProviderRegistryForClient(registry) {
  return {
    ...registry,
    providers: (registry.providers || []).map((provider) => ({
      ...provider,
      apiKeyConfigured: Boolean(provider.apiKeyReference),
      apiKeyReference: provider.apiKeyReference || ""
    }))
  };
}

export function sanitizeKnowledgeRegistryForClient(registry) {
  return {
    ...registry,
    sources: (registry.sources || []).map((source) => ({
      ...source,
      apiKeyConfigured: Boolean(source.apiKeyReference),
      apiKeyReference: source.apiKeyReference || ""
    }))
  };
}

function normalizeAiProvider(provider, index) {
  if (!provider || typeof provider !== "object") return null;
  const id = cleanId(provider.id || provider.name || `ai-provider-${index + 1}`);
  if (!id) return null;
  const providerType = knownValue(provider.providerType || provider.type, aiProviderTypes, "custom");
  return {
    id,
    name: String(provider.name || provider.label || id),
    providerType,
    active: provider.active === true,
    apiEndpoint: String(provider.apiEndpoint || provider.endpoint || ""),
    apiKeyReference: cleanSecretReference(provider.apiKeyReference || provider.apiKeyEnv || provider.secretRef || ""),
    defaultModel: String(provider.defaultModel || provider.model || ""),
    timeoutMs: numberOrDefault(provider.timeoutMs, 120000),
    maxTokens: numberOrNull(provider.maxTokens),
    temperature: numberOrNull(provider.temperature),
    retryPolicy: String(provider.retryPolicy || ""),
    failoverProviderId: String(provider.failoverProviderId || ""),
    adapterStatus: String(provider.adapterStatus || adapterStatusForProvider(providerType)),
    validationStatus: String(provider.validationStatus || "Not tested"),
    lastValidatedAt: String(provider.lastValidatedAt || ""),
    description: String(provider.description || "")
  };
}

function normalizeKnowledgeSource(source, index) {
  if (!source || typeof source !== "object") return null;
  const id = cleanId(source.id || source.name || `knowledge-source-${index + 1}`);
  if (!id) return null;
  const sourceType = knownValue(source.sourceType || source.type, knowledgeSourceTypes, "custom");
  const categories = Array.isArray(source.categories)
    ? source.categories.map(String).filter(Boolean)
    : source.category
      ? [String(source.category)]
      : [];

  return {
    id,
    name: String(source.name || source.label || id),
    sourceType,
    endpointUrl: String(source.endpointUrl || source.url || ""),
    authMethod: knownValue(source.authMethod, authMethods, "none"),
    apiKeyReference: cleanSecretReference(source.apiKeyReference || source.apiKeyEnv || source.secretRef || ""),
    active: source.active === true,
    scope: String(source.scope || source.purpose || ""),
    categories,
    priorityWeight: Math.max(0, Math.min(100, numberOrDefault(source.priorityWeight, 50))),
    confidenceLevel: String(source.confidenceLevel || "contextual"),
    validationStatus: String(source.validationStatus || "Not tested"),
    lastValidatedAt: String(source.lastValidatedAt || ""),
    notes: String(source.notes || "")
  };
}

function adapterStatusForProvider(providerType) {
  return providerType === "codex" ? "active" : "planned";
}

function knownValue(value, options, fallback) {
  const clean = String(value || "").trim();
  return options.some((item) => item.value === clean) ? clean : fallback;
}

function cleanSecretReference(value) {
  return String(value || "")
    .trim()
    .replace(/[^A-Z0-9_./:-]+/gi, "")
    .slice(0, 120);
}

function cleanId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

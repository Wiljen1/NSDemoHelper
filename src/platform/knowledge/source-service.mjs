export const knowledgeSourceConnectorManifest = {
  rest_api: { connectorStatus: "planned", trustLevel: "contextual", credentialPolicy: "secret-reference-required" },
  wiki: { connectorStatus: "planned", trustLevel: "contextual", credentialPolicy: "oauth-or-sso" },
  documentation_portal: { connectorStatus: "planned", trustLevel: "contextual", credentialPolicy: "source-defined" },
  knowledge_base: { connectorStatus: "planned", trustLevel: "contextual", credentialPolicy: "source-defined" },
  ai_chatbot: { connectorStatus: "planned", trustLevel: "ai-generated-context", credentialPolicy: "secret-reference-required" },
  retrieval_api: { connectorStatus: "planned", trustLevel: "retrieved-context", credentialPolicy: "secret-reference-required" },
  crm: { connectorStatus: "planned", trustLevel: "customer-system-context", credentialPolicy: "oauth-or-sso" },
  competitive_intelligence: { connectorStatus: "planned", trustLevel: "advisory-only", credentialPolicy: "approved-source-required" },
  public_web: { connectorStatus: "planned", trustLevel: "public-context", credentialPolicy: "none-or-api-key" },
  enablement_repo: { connectorStatus: "planned", trustLevel: "internal-context", credentialPolicy: "sso-or-repository-access" },
  custom: { connectorStatus: "planned", trustLevel: "contextual", credentialPolicy: "connector-defined" }
};

export function summarizeKnowledgeSourceLayer(registry = {}) {
  const sources = registry.sources || [];
  const activeSources = sources.filter((source) => source.active);
  const invalidActiveSources = activeSources.filter((source) =>
    !source.endpointUrl || (source.authMethod !== "none" && !source.apiKeyReference)
  );
  return {
    registeredSourceCount: sources.length,
    activeSourceCount: activeSources.length,
    invalidActiveSourceCount: invalidActiveSources.length,
    activeSourceNames: activeSources.map((source) => source.name),
    categories: [...new Set(sources.flatMap((source) => source.categories || []))],
    trustPolicy: registry.trustPolicy || "External sources are contextual intelligence providers, not guaranteed factual truth.",
    connectorStatus: "registration-only",
    warnings: invalidActiveSources.map((source) => `${source.name} is enabled but missing endpoint or credential configuration.`)
  };
}

export function createKnowledgeContextEnvelope({ tenantConfig = {}, sources = [], purpose = "demo-prep" } = {}) {
  return {
    schemaVersion: 1,
    purpose,
    tenantId: tenantConfig.tenantId || "local-default",
    sourcePolicy: "contextual-support-only",
    activeSources: sources.filter((source) => source.active).map((source) => ({
      id: source.id,
      name: source.name,
      sourceType: source.sourceType,
      categories: source.categories || [],
      confidenceLevel: source.confidenceLevel || "contextual",
      priorityWeight: source.priorityWeight || 0
    })),
    safeguards: [
      "Identify source origin before using external context.",
      "Do not present external or AI-generated competitive information as verified truth.",
      "Validate important claims before customer use."
    ]
  };
}

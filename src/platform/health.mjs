import { summarizeAiProviderLayer } from "./ai/orchestrator.mjs";
import { summarizeKnowledgeSourceLayer } from "./knowledge/source-service.mjs";
import { platformModeCapabilities } from "./runtime-config.mjs";

export function buildPlatformHealthSnapshot({
  buildMetadata = {},
  tenantConfig = {},
  aiRegistry = {},
  knowledgeRegistry = {},
  runtimeStatus = {},
  featureFlags = {}
} = {}) {
  const ai = summarizeAiProviderLayer(aiRegistry, runtimeStatus);
  const knowledge = summarizeKnowledgeSourceLayer(knowledgeRegistry);
  const capabilities = platformModeCapabilities(buildMetadata);
  const warnings = [
    ...ai.warnings,
    ...knowledge.warnings,
    ...cloudWarnings(buildMetadata, tenantConfig)
  ].filter(Boolean);
  const backendStatus = runtimeStatus.runtime?.available === false ? "warning" : "running";
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    status: warnings.length ? "warning" : "healthy",
    environment: {
      appVersion: buildMetadata.version || "v0.1.0-alpha",
      appEnvironment: buildMetadata.environment || "development",
      appProfile: buildMetadata.profile || "mvp",
      cloudMode: Boolean(buildMetadata.cloudMode),
      commit: buildMetadata.commit || "",
      buildDate: buildMetadata.buildDate || ""
    },
    tenant: {
      tenantId: tenantConfig.tenantId || "local-default",
      tenantName: tenantConfig.tenantName || "Local tenant",
      status: tenantConfig.status || "active",
      branding: tenantConfig.branding || {},
      productPack: tenantConfig.productPack || {},
      demoPlatform: tenantConfig.demoPlatform || {}
    },
    backend: {
      status: backendStatus,
      healthCheck: "local-node-http",
      apiRoutes: "single-process-local",
      authReadiness: "local-admin-session-now-cloud-auth-planned",
      logging: "local-console-now-structured-logs-planned",
      errorHandling: "api-json-errors-and-ui-status"
    },
    ai,
    knowledge,
    featureFlags,
    capabilities,
    security: {
      clientReceivesRawSecrets: false,
      credentialStorage: tenantConfig.security?.secretStorage || "environment-variable-or-secret-reference-only",
      adminConfigRequiresLogin: true,
      cloudSecretStore: "planned"
    },
    cloudReadiness: tenantConfig.cloudReadiness || {},
    warnings
  };
}

function cloudWarnings(buildMetadata = {}, tenantConfig = {}) {
  const warnings = [];
  if (buildMetadata.profile !== "whitelabel") return warnings;
  if (buildMetadata.environment === "production" && !buildMetadata.cloudMode) {
    warnings.push("Production environment is not running in cloud mode yet.");
  }
  if (tenantConfig.tenancy?.isolationModel === "local-file-development") {
    warnings.push("Tenant data is still using local file storage; move to tenant-scoped database storage before external deployment.");
  }
  if (tenantConfig.security?.adminAccess === "local-admin-session") {
    warnings.push("Admin login is local-session based; replace with cloud auth before external multi-tenant deployment.");
  }
  return warnings;
}

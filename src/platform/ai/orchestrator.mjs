export const aiProviderAdapterManifest = {
  codex: {
    adapterStatus: "active",
    executionMode: "local-background-operator",
    supportsStreaming: false,
    supportsStructuredJson: true,
    credentialPolicy: "uses-local-codex-runtime"
  },
  openai: {
    adapterStatus: "planned",
    executionMode: "remote-api",
    supportsStreaming: true,
    supportsStructuredJson: true,
    credentialPolicy: "secret-reference-required"
  },
  azure_openai: {
    adapterStatus: "planned",
    executionMode: "remote-api",
    supportsStreaming: true,
    supportsStructuredJson: true,
    credentialPolicy: "secret-reference-required"
  },
  claude: {
    adapterStatus: "planned",
    executionMode: "remote-api",
    supportsStreaming: true,
    supportsStructuredJson: true,
    credentialPolicy: "secret-reference-required"
  },
  gemini: {
    adapterStatus: "planned",
    executionMode: "remote-api",
    supportsStreaming: true,
    supportsStructuredJson: true,
    credentialPolicy: "secret-reference-required"
  },
  local_llm: {
    adapterStatus: "planned",
    executionMode: "local-or-private-gateway",
    supportsStreaming: false,
    supportsStructuredJson: true,
    credentialPolicy: "endpoint-or-network-policy"
  },
  enterprise_gateway: {
    adapterStatus: "planned",
    executionMode: "enterprise-gateway",
    supportsStreaming: true,
    supportsStructuredJson: true,
    credentialPolicy: "tenant-secret-reference-required"
  },
  custom: {
    adapterStatus: "planned",
    executionMode: "custom-adapter",
    supportsStreaming: false,
    supportsStructuredJson: false,
    credentialPolicy: "adapter-defined"
  }
};

export function providerCanActivate(provider = {}) {
  const manifest = aiProviderAdapterManifest[provider.providerType] || aiProviderAdapterManifest.custom;
  return provider.adapterStatus === "active" && manifest.adapterStatus === "active";
}

export function summarizeAiProviderLayer(registry = {}, runtimeStatus = {}) {
  const providers = registry.providers || [];
  const activeProvider = providers.find((provider) => provider.id === registry.activeProviderId) || providers[0] || null;
  return {
    activeProviderId: registry.activeProviderId || activeProvider?.id || "",
    activeProviderName: activeProvider?.name || "Not configured",
    activeProviderType: activeProvider?.providerType || "unknown",
    runtimeStatus: runtimeStatus.runtime?.runtimeStatus || activeProvider?.runtimeStatus || "Unknown",
    connectionStatus: runtimeStatus.runtime?.connectionStatus || activeProvider?.connectionStatus || "Unknown",
    adapterStatus: activeProvider?.adapterStatus || "unknown",
    registeredProviderCount: providers.length,
    plannedProviderCount: providers.filter((provider) => provider.adapterStatus !== "active").length,
    availableAdapterTypes: Object.entries(aiProviderAdapterManifest)
      .filter(([, adapter]) => adapter.adapterStatus === "active")
      .map(([type]) => type),
    warnings: providerWarnings(activeProvider, runtimeStatus)
  };
}

export function createAiTaskEnvelope({ tenantConfig = {}, provider = {}, taskType = "demo-intelligence", inputSummary = "", outputContract = "markdown" } = {}) {
  return {
    schemaVersion: 1,
    taskType,
    tenantId: tenantConfig.tenantId || "local-default",
    productPackId: tenantConfig.productPack?.id || "netsuite_erp_pack",
    demoPlatformId: tenantConfig.demoPlatform?.id || "netsuite",
    providerId: provider.id || "codex-local",
    providerType: provider.providerType || "codex",
    outputContract,
    inputSummary,
    safety: {
      noRawSecrets: true,
      externalSourcesAreContextual: true,
      requireHumanValidationForCompetitiveClaims: true
    }
  };
}

function providerWarnings(provider, runtimeStatus = {}) {
  const warnings = [];
  if (!provider) warnings.push("No active AI provider is configured.");
  if (provider && provider.providerType !== "codex" && provider.adapterStatus !== "active") {
    warnings.push("Selected provider is registered but does not have an active runtime adapter yet.");
  }
  if (runtimeStatus.runtime && runtimeStatus.runtime.available === false) {
    warnings.push(runtimeStatus.runtime.message || "Active AI runtime is not available.");
  }
  return warnings;
}

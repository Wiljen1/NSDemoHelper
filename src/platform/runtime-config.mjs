export const supportedAppEnvironments = ["development", "staging", "production"];
export const supportedAppProfiles = ["mvp", "whitelabel"];

export function normalizeAppEnvironment(value) {
  const env = String(value || "development").trim().toLowerCase();
  return supportedAppEnvironments.includes(env) ? env : "development";
}

export function normalizeAppProfile(value) {
  const profile = String(value || "mvp").trim().toLowerCase();
  return supportedAppProfiles.includes(profile) ? profile : "mvp";
}

export function buildRuntimeMetadata(env = process.env, options = {}) {
  const profile = normalizeAppProfile(env.APP_PROFILE || env.NSDH_APP_PROFILE || options.profile);
  const environment = normalizeAppEnvironment(env.APP_ENV || options.environment);
  return {
    version: options.version || env.APP_VERSION || "v0.1.0-alpha",
    environment,
    profile,
    isWhiteLabel: profile === "whitelabel",
    commit: env.APP_COMMIT || env.GIT_COMMIT || "",
    buildDate: env.APP_BUILD_DATE || env.BUILD_DATE || "",
    cloudReady: profile === "whitelabel",
    cloudMode: env.CLOUD_MODE === "true" || env.NSDH_CLOUD_MODE === "true"
  };
}

export function platformModeCapabilities(metadata = {}) {
  const isWhiteLabel = metadata.profile === "whitelabel";
  return {
    profile: metadata.profile || "mvp",
    environment: metadata.environment || "development",
    mvpProtected: true,
    whiteLabelControlsVisible: isWhiteLabel,
    tenantConfigEditable: isWhiteLabel,
    cloudReadinessVisible: isWhiteLabel,
    providerRegistryEnabled: true,
    knowledgeSourceRegistryEnabled: true,
    localCodexDefault: true
  };
}

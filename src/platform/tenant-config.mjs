export function defaultTenantConfig(now = new Date().toISOString(), options = {}) {
  const profile = options.profile === "whitelabel" ? "whitelabel" : "mvp";
  const whiteLabel = profile === "whitelabel";
  return {
    schemaVersion: 1,
    tenantId: options.tenantId || "local-default",
    tenantName: whiteLabel ? "White-label local tenant" : "Internal NetSuite MVP",
    status: "active",
    updatedAt: now,
    branding: {
      appName: whiteLabel ? "Demo Intelligence Platform" : "NetSuite Demo Helper",
      shortName: whiteLabel ? "Demo Helper" : "NS Demo Helper",
      logoUrl: "",
      primaryColor: "#2563eb",
      accentColor: "#14b8a6",
      supportEmail: ""
    },
    productPack: {
      id: "netsuite_erp_pack",
      label: "NetSuite ERP Pack",
      vendor: "NetSuite",
      enabled: true,
      notes: "The current MVP remains NetSuite-focused. Future packs should move product-specific terminology, scoring, navigation, and setup guidance out of core platform logic."
    },
    demoPlatform: {
      id: "netsuite",
      label: "NetSuite ERP",
      objectModel: "erp-demo-workspace",
      automationManifestLabel: "dry-run manifest"
    },
    tenancy: {
      isolationModel: "local-file-development",
      workspaceScope: "single-machine",
      futureModel: "tenant-scoped database records, users, secrets, feature flags, and content packs"
    },
    featureFlags: {
      liveDemoFunctionality: true,
      whiteLabelBranding: whiteLabel,
      externalKnowledgeSources: true,
      providerSwitching: true,
      tenantWorkspaces: false,
      cloudDeploymentMode: false
    },
    commercial: {
      subscriptionTier: whiteLabel ? "pilot" : "internal_mvp",
      planStatus: whiteLabel ? "pilot-ready-foundation" : "internal-demo",
      billingReadiness: "planned",
      usageLimits: {
        monthlyAiRuns: 250,
        monthlyWorkspaces: 50,
        monthlyExports: 100,
        activeKnowledgeSources: 5
      }
    },
    roles: {
      owner: ["manage_tenant", "manage_billing", "manage_providers", "manage_sources", "manage_users", "view_usage"],
      admin: ["manage_providers", "manage_sources", "manage_branding", "manage_playbooks", "view_usage"],
      solution_consultant: ["create_workspace", "run_intelligence", "export_outputs", "run_rehearsal"],
      viewer: ["view_workspace", "view_outputs"]
    },
    audit: {
      mode: "local-event-log-planned",
      trackedEvents: ["ai_run", "provider_change", "source_change", "tenant_config_change", "export_created", "workspace_created"],
      retentionPolicy: "planned"
    },
    security: {
      secretStorage: "environment-variable-or-secret-reference-only",
      exposeSecretsToClient: false,
      adminAccess: "local-admin-session",
      auditLog: "planned"
    },
    cloudReadiness: {
      frontendHosting: "planned",
      backendHosting: "planned",
      database: "planned",
      objectStorage: "planned",
      queueWorkers: "planned",
      observability: "basic-health-snapshot",
      authProvider: "planned"
    }
  };
}

export function normalizeTenantConfig(input, now = new Date().toISOString(), options = {}) {
  const fallback = defaultTenantConfig(now, options);
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const branding = source.branding && typeof source.branding === "object" && !Array.isArray(source.branding) ? source.branding : {};
  const productPack = source.productPack && typeof source.productPack === "object" && !Array.isArray(source.productPack) ? source.productPack : {};
  const demoPlatform = source.demoPlatform && typeof source.demoPlatform === "object" && !Array.isArray(source.demoPlatform) ? source.demoPlatform : {};
  const tenancy = source.tenancy && typeof source.tenancy === "object" && !Array.isArray(source.tenancy) ? source.tenancy : {};
  const featureFlags = source.featureFlags && typeof source.featureFlags === "object" && !Array.isArray(source.featureFlags) ? source.featureFlags : {};
  const commercial = source.commercial && typeof source.commercial === "object" && !Array.isArray(source.commercial) ? source.commercial : {};
  const roles = source.roles && typeof source.roles === "object" && !Array.isArray(source.roles) ? source.roles : {};
  const audit = source.audit && typeof source.audit === "object" && !Array.isArray(source.audit) ? source.audit : {};
  const security = source.security && typeof source.security === "object" && !Array.isArray(source.security) ? source.security : {};
  const cloudReadiness = source.cloudReadiness && typeof source.cloudReadiness === "object" && !Array.isArray(source.cloudReadiness) ? source.cloudReadiness : {};

  return {
    schemaVersion: Number(source.schemaVersion) || fallback.schemaVersion,
    tenantId: cleanId(source.tenantId || fallback.tenantId),
    tenantName: String(source.tenantName || fallback.tenantName).slice(0, 120),
    status: ["active", "inactive", "sandbox"].includes(String(source.status || "").toLowerCase()) ? String(source.status).toLowerCase() : fallback.status,
    updatedAt: String(source.updatedAt || now),
    branding: {
      appName: String(branding.appName || fallback.branding.appName).slice(0, 120),
      shortName: String(branding.shortName || fallback.branding.shortName).slice(0, 60),
      logoUrl: cleanUrl(branding.logoUrl || ""),
      primaryColor: cleanColor(branding.primaryColor || fallback.branding.primaryColor),
      accentColor: cleanColor(branding.accentColor || fallback.branding.accentColor),
      supportEmail: cleanEmail(branding.supportEmail || "")
    },
    productPack: {
      id: cleanId(productPack.id || fallback.productPack.id),
      label: String(productPack.label || fallback.productPack.label).slice(0, 120),
      vendor: String(productPack.vendor || fallback.productPack.vendor).slice(0, 80),
      enabled: productPack.enabled !== false,
      notes: String(productPack.notes || fallback.productPack.notes).slice(0, 1200)
    },
    demoPlatform: {
      id: cleanId(demoPlatform.id || fallback.demoPlatform.id),
      label: String(demoPlatform.label || fallback.demoPlatform.label).slice(0, 120),
      objectModel: String(demoPlatform.objectModel || fallback.demoPlatform.objectModel).slice(0, 120),
      automationManifestLabel: String(demoPlatform.automationManifestLabel || fallback.demoPlatform.automationManifestLabel).slice(0, 120)
    },
    tenancy: {
      ...fallback.tenancy,
      ...stringMap(tenancy)
    },
    featureFlags: {
      ...fallback.featureFlags,
      ...booleanMap(featureFlags)
    },
    commercial: {
      subscriptionTier: cleanId(commercial.subscriptionTier || fallback.commercial.subscriptionTier),
      planStatus: String(commercial.planStatus || fallback.commercial.planStatus).slice(0, 120),
      billingReadiness: String(commercial.billingReadiness || fallback.commercial.billingReadiness).slice(0, 120),
      usageLimits: {
        ...fallback.commercial.usageLimits,
        ...numberMap(commercial.usageLimits)
      }
    },
    roles: normalizeRoles(roles, fallback.roles),
    audit: {
      mode: String(audit.mode || fallback.audit.mode).slice(0, 120),
      trackedEvents: Array.isArray(audit.trackedEvents)
        ? audit.trackedEvents.map((item) => cleanId(item)).filter(Boolean).slice(0, 40)
        : fallback.audit.trackedEvents,
      retentionPolicy: String(audit.retentionPolicy || fallback.audit.retentionPolicy).slice(0, 160)
    },
    security: {
      ...fallback.security,
      ...stringMap(security)
    },
    cloudReadiness: {
      ...fallback.cloudReadiness,
      ...stringMap(cloudReadiness)
    }
  };
}

export function sanitizeTenantConfigForClient(config) {
  const normalized = normalizeTenantConfig(config);
  return {
    ...normalized,
    security: {
      ...normalized.security,
      exposeSecretsToClient: false
    }
  };
}

function cleanId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "local-default";
}

function cleanUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const parsed = new URL(text);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href.slice(0, 300) : "";
  } catch {
    return "";
  }
}

function cleanColor(value) {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : "#2563eb";
}

function cleanEmail(value) {
  const text = String(value || "").trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text) ? text.slice(0, 160) : "";
}

function stringMap(value = {}) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean")
      .map(([key, entry]) => [key, String(entry).slice(0, 500)])
  );
}

function booleanMap(value = {}) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => typeof entry === "boolean")
  );
}

function numberMap(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => Number.isFinite(Number(entry)))
      .map(([key, entry]) => [key, Math.max(0, Math.round(Number(entry)))])
  );
}

function normalizeRoles(input = {}, fallback = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const roles = { ...fallback };
  for (const [role, permissions] of Object.entries(source)) {
    const cleanRole = cleanId(role);
    if (!cleanRole || !Array.isArray(permissions)) continue;
    roles[cleanRole] = permissions.map((permission) => cleanId(permission)).filter(Boolean).slice(0, 40);
  }
  return roles;
}

# Founder Readiness Roadmap

This document captures the practical path from the current white-label foundation toward a commercially viable AI Demo Intelligence Platform.

The current NetSuite MVP must remain stable, runnable, and demo-ready. Founder-readiness work should stay isolated in white-label mode until explicitly promoted.

## Phase 1: Product Foundation Review

Current strengths:

- MVP and white-label modes are separated through local run profiles.
- Codex remains the default working AI brain.
- Admin now separates AI Brain Management from Knowledge Source Management.
- Tenant and branding configuration exists as a local white-label foundation.
- Platform health and active AI brain status are visible.
- Workspace, intelligence, guide, dry-run, and export concepts are already proven in the MVP.

Current gaps:

- Tenant storage is still local-file based rather than tenant-scoped database storage.
- Admin access is local-session based and not yet enterprise authentication.
- Provider switching is modeled, but only Codex is wired as the active runtime adapter.
- Knowledge sources are registration-ready but not connected to retrieval or enrichment pipelines.
- Usage tracking, audit history, and subscription limits are modeled but not enforced.
- NetSuite content pack separation is incomplete.
- Secrets are handled as references, but there is no cloud secret store yet.
- Cloud deployment boundaries are documented but not split into hosted frontend, backend, database, workers, and storage.

## Phase 2: Founder-Ready Product Structure

The white-label product should support:

- Customer or tenant configuration.
- Configurable branding.
- Configurable AI providers.
- Configurable knowledge sources.
- Demo intelligence workflows.
- Reusable playbooks and content packs.
- Customer-specific settings.
- Future subscription tiers.

Near-term structure:

- Keep `src/platform/` as the platform service boundary.
- Move provider, source, tenant, scoring, playbook, and readiness logic into platform services rather than UI components.
- Treat NetSuite as the first product/content pack, not as the permanent platform identity.
- Keep local config for development, then introduce tenant-scoped persistence when cloud work begins.

## Phase 3: Admin Control Center

Admin should become the operational command center.

It should clearly show:

- Active AI brain/provider.
- Provider connection and runtime status.
- Active knowledge sources.
- Tenant and branding configuration.
- Feature flags.
- System health.
- Founder/SaaS readiness.
- Security and configuration warnings.

The white-label Admin now has a Founder Readiness section. This provides a practical commercial snapshot for pilots, tenant model, AI/provider readiness, knowledge-source readiness, usage/audit posture, and defensible product IP.

## Phase 4: Market-Ready Product Capabilities

Priority product capabilities:

- Onboarding flow for a new demo workspace.
- Customer/deal workspace creation and reopening.
- Reusable templates and playbooks.
- Industry and persona libraries.
- Discovery quality scoring.
- Demo readiness scoring.
- Rehearsal coaching.
- Exportable outputs.
- Audit and history tracking.
- Usage tracking.

The defensible experience should remain focused on helping SCs prepare, validate, improve, and rehearse better demos.

## Phase 5: SaaS And Commercial Readiness

Prepare lightweight foundations for:

- User roles.
- Tenant isolation.
- Subscription tiers.
- Feature gating.
- Usage limits.
- Billing readiness.
- Secure secrets management.
- Deployment environment separation.
- Logging and observability.

Do not overbuild billing or enterprise authentication yet. Model the boundaries first, then enforce them after pilot validation.

## Phase 6: Defensibility And Product IP

The defensible core should live outside UI components and gradually become reusable platform logic:

- Demo intelligence scoring.
- Discovery gap analysis.
- Persona and stakeholder story orchestration.
- AI provider abstraction.
- Source-aware knowledge enrichment.
- Reusable product, industry, and persona playbooks.
- Rehearsal coaching.
- Automation manifest generation.

Configuration should be split by responsibility:

- Core platform rules: `src/platform/`
- Product/vendor packs: future `src/packs/`
- Admin-managed content: existing CMS/config layer
- Tenant-specific configuration: future tenant storage
- Runtime provider/source settings: platform registries

## Phase 7: Prioritized Implementation Plan

Quick wins:

1. Add Founder Readiness dashboard in white-label Admin.
2. Add commercial tier, role, usage-limit, and audit metadata to tenant config.
3. Document the founder roadmap and defensible product core.
4. Add one real cloud AI provider adapter.
5. Add one knowledge-source connector proof of concept with source attribution.
6. Add append-only audit/usage events for AI runs, exports, provider changes, and workspace creation.
7. Move scoring, persona, and playbook rules out of UI code into platform services.
8. Add tenant-scoped persistence.
9. Add cloud authentication and a secret store.
10. Add pilot onboarding and activation checklist.

Risks:

- Provider abstraction can become too theoretical if no real non-Codex adapter is implemented.
- Knowledge sources can create trust risk unless source origin, confidence, and advisory warnings are preserved.
- Tenant concepts can become confusing if local MVP behavior is changed too early.
- Competitive guidance must remain advisory and validated before customer use.
- White-label work should not dilute the NetSuite MVP until the product direction is proven.

Recommended order:

1. Stabilize the current white-label Admin foundation.
2. Introduce audit and usage event contracts.
3. Move high-value intelligence logic into service modules.
4. Build one external AI adapter and one external knowledge connector.
5. Add tenant-scoped persistence and onboarding.
6. Prepare hosted deployment with secure secrets and observability.
7. Package NetSuite as the first product/content pack.

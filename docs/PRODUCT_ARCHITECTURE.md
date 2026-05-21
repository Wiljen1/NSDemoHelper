# Product Architecture

NetSuite Demo Helper is currently an internal MVP focused on helping Solution Consultants prepare stronger NetSuite demos. The future architecture should separate the reusable platform from vendor-specific content and behavior.

## Core Platform

The Core Platform should eventually contain the vendor-neutral application capabilities:

- Workspace management
- AI/Codex orchestration
- Prompt execution
- Scoring engine
- Intelligence UI
- Export system
- Rehearsal and dry-run system
- Local storage
- Version and update system
- Admin and configuration management
- AI provider registry and orchestration boundary
- External knowledge source registry
- Founder readiness and commercial-readiness reporting
- Usage, role, and audit contracts for future SaaS packaging

The Core Platform should not assume NetSuite terminology, NetSuite navigation, ERP-specific modules, or a specific demo methodology beyond generic demo preparation, discovery analysis, storytelling, risk detection, and rehearsal support.

## AI Provider Architecture

The current MVP uses local Codex as the default reasoning backbone. That path should remain operational while the platform gradually moves toward a provider-adapter model.

The intended structure is:

- AI provider registry
- Active provider selection
- Provider-specific adapter layer
- Generic prompt orchestration service
- Shared result normalization
- Connectivity testing
- Future tenant-specific provider preferences

Initial supported provider types are documented in code as configuration options:

- Codex
- OpenAI GPT
- Azure OpenAI
- Claude
- Gemini
- Local or self-hosted LLMs
- Enterprise AI gateways
- Custom providers

For the current MVP, only the Codex provider is active. Other providers can be registered for future configuration work but do not change the runtime demo-prep behavior yet.

Raw API keys should not be stored in local JSON configuration. Use environment variable names, secret references, or a future secret store.

## External Knowledge Source Framework

External systems should be treated as contextual intelligence providers, not guaranteed factual truth.

Future knowledge sources may include:

- REST APIs
- Internal wiki pages
- Documentation portals
- Knowledge bases
- AI chatbot endpoints
- Retrieval/search APIs
- CRM systems
- Competitive intelligence sources
- Public web intelligence
- Internal enablement repositories

Each source should preserve:

- Source name
- Source type
- Endpoint or connector target
- Authentication method
- Active/inactive state
- Scope or purpose
- Category
- Priority weighting
- Validation status
- Confidence level

Important competitive, external, or AI-generated context must remain advisory and should not be presented as verified truth without human validation.

## NetSuite ERP Pack

The NetSuite ERP Pack should contain the current NetSuite-specific behavior and content:

- NetSuite-specific terminology
- ERP demo guidance
- OneWorld, Finance, and SuiteProjects logic
- NetSuite setup guidance
- NetSuite navigation and dry-run manifests
- NetSuite reporting and saved search guidance
- NetSuite industry and demo playbooks

This pack should remain the default internal package until the product is ready for white-label work.

## Future White-Label Pack

A future White-Label Pack should allow a different company or product team to provide:

- Brand name
- Colors and logo
- Terminology
- Product-specific prompts
- Scoring rules
- Audience and industry logic
- Demo system navigation rules

## Current MVP Boundary

Do not implement full white-label functionality yet. For v0.1.0-alpha, the goal is to preserve a stable NetSuite-focused MVP while documenting which areas should later move into content/vendor packs.

## Current Foundation Added

The current codebase now includes a lightweight Platform Foundation area in Admin that stores local provider/source registration under ignored `artifacts/platform/` files. This is intentionally additive:

- It does not replace Codex.
- It does not query external systems yet.
- It does not implement multi-tenant routing yet.
- It provides a safe place to evolve provider configuration and contextual source registration without disrupting the internal NetSuite MVP.
- It separates AI Brain Management from Knowledge Source Management so future AI providers and external context sources can evolve independently.
- It exposes the active AI brain and knowledge source count in the app header so the current runtime backbone is visible to users.
- It adds white-label-only tenant/branding configuration, platform health snapshots, and cloud-readiness warnings without changing the MVP profile.
- It introduces service-layer contracts under `src/platform/` for runtime metadata, tenant configuration, AI provider orchestration, knowledge-source context, and health reporting.
- It introduces a Founder Readiness snapshot for white-label mode so product, commercial, tenant, AI-provider, knowledge-source, usage/audit, and cloud-readiness gaps can be tracked without changing MVP behavior.

## Cloud-Ready Direction

The current white-label foundation is still local-first, but it now models the boundaries needed for cloud deployment:

- Hosted frontend/backend split: planned, with current local server acting as the backend/API boundary.
- Tenant configuration: local JSON today, tenant-scoped database records later.
- AI providers: Codex adapter is active; OpenAI, Azure OpenAI, Claude, Gemini, local LLM, and enterprise gateway adapters are planned.
- Knowledge sources: registration-only today; retrieval/connectors later.
- Secrets: only secret references are stored; raw keys should move to environment variables or a tenant-aware secret store.
- Observability: `/api/platform/health` exposes a safe health snapshot for Admin and future monitoring.
- Founder readiness: `/api/platform/founder-readiness` exposes a safe advisory snapshot for pilot readiness, subscription tier readiness, defensible core, and next implementation priorities.

## SaaS And Commercial Readiness

The white-label foundation now models early SaaS concepts without enforcing them yet:

- Subscription tier blueprint
- Usage-limit placeholders
- User role blueprint
- Audit/event tracking blueprint
- Tenant/product pack configuration
- Provider and knowledge-source registries

These are not production billing, authorization, or audit systems yet. They define the contracts needed before adding real tenant persistence, identity, billing, secret storage, and cloud deployment.

## Local Run Profiles

Local development now supports two command-line profiles:

- `npm run mvp`: stable internal NetSuite MVP profile on `http://localhost:4173`.
- `npm run whitelabel`: future white-label development profile on `http://localhost:4182`.

Both profiles run the same local helper today. The split is intentionally lightweight and gives future platform work a separate environment without duplicating the app or changing the existing MVP startup path.

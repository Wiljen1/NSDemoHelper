# Platform Foundation

This document describes the first additive step toward a white-label, multi-tenant Demo Intelligence Platform.

The current MVP remains NetSuite-specific and Codex-backed. The foundation added here does not replace existing demo prep, SC guide, intelligence, dry-run, dataset, or admin behavior.

## MVP And White-Label Separation

The same local app can run in two profiles:

- `mvp`: stable internal NetSuite Demo Helper experience.
- `whitelabel`: future platform-development profile for cloud readiness, tenant configuration, provider abstraction, and white-label controls.

White-label-only controls are hidden in MVP profile. This keeps the MVP runnable and demo-ready while allowing the platform foundation to evolve independently.

## Tenant And Branding Configuration

White-label mode now has a local tenant configuration model under `artifacts/platform/tenant-config.json`.

It prepares for future tenant-scoped configuration:

- Tenant id and tenant name
- Brand/app name
- Primary and accent colors
- Product/vendor pack
- Demo platform label
- Tenant isolation strategy
- Feature flags
- Security and secret-storage policy
- Cloud-readiness metadata

This is still local-only. It is not a production tenant database and does not implement external user management yet.

## Platform Health

The white-label Admin area includes an Environment & System Status section backed by `/api/platform/health`.

The health snapshot includes:

- Active AI brain
- Provider connection/runtime status
- Active knowledge source count
- Tenant and product pack
- Backend mode
- Environment/profile
- Secret exposure policy
- Cloud-readiness warnings

The endpoint is intentionally safe for UI use and does not expose raw provider keys or secrets.

## AI Brain Management

The app now has a local AI brain/provider registry for future provider abstraction.

Current active provider:

- Local Codex

Future provider types:

- OpenAI GPT
- Azure OpenAI
- Claude
- Gemini
- Local or self-hosted LLMs
- Enterprise AI gateways
- Custom providers

The registry is designed to support:

- Active provider selection
- Endpoint configuration
- Authentication method and secret-reference configuration
- Model configuration
- Temperature, timeout, retry, and token preferences
- Connection status
- Runtime status
- Last health check
- Future failover behavior
- Connectivity testing and activation controls

For now, only Codex is wired into runtime demo generation. Other providers are registration-only until a provider adapter is implemented.

The active AI brain is also visible globally in the app header so users can see which provider is running, whether the runtime is connected, and how many external knowledge sources are enabled.

## Knowledge Source Management

The app now has a local knowledge source registry for future contextual intelligence providers.

Future source types may include:

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

Each source can track:

- Name
- Type
- Endpoint URL
- Authentication method
- Authentication status
- Active/inactive state
- Scope or purpose
- Categories
- Priority weight
- Confidence level
- Validation status
- Last sync/test

Knowledge sources are contextual inputs only. They should not be presented as verified factual truth, especially for competitive intelligence or AI-generated responses.

## Admin Configuration

The Admin page includes a lightweight Platform Foundation area with:

- AI Brain Management
- Knowledge Source Management
- Provider/source cards
- Active and enabled badges
- Configure forms
- Test Connection actions
- Activate/disable controls where safe
- Last health check/status visibility
- Readable preview
- Raw JSON editor
- Save buttons

Configuration is stored locally under ignored `artifacts/platform/` files.

White-label mode also adds:

- Environment & System Status
- Tenant & Branding Settings
- Cloud-readiness warnings

These are profile-gated so they do not alter the MVP flow.

## Local Development Profile

White-label platform work can be started separately with:

```bash
npm run whitelabel
```

This sets `APP_PROFILE=whitelabel` and uses port `4182` by default.

The MVP remains available with:

```bash
npm run mvp
```

This sets `APP_PROFILE=mvp` and uses port `4173` by default.

## Security Boundary

Raw API keys should not be stored in local JSON. Use:

- Environment variable names
- Secret references
- A future tenant-aware secret store

## Future Work

This foundation enables later work on:

- Provider adapters
- Generic AI orchestration
- External retrieval/connectors
- Tenant-specific configuration
- White-label branding
- Cloud auth and tenant-scoped storage
- Hosted frontend/backend separation
- Structured logging and audit history
- Vendor/product content packs
- Source-aware intelligence scoring

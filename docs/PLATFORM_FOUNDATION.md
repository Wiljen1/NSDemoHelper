# Platform Foundation

This document describes the first additive step toward a white-label, multi-tenant Demo Intelligence Platform.

The current MVP remains NetSuite-specific and Codex-backed. The foundation added here does not replace existing demo prep, SC guide, intelligence, dry-run, dataset, or admin behavior.

## AI Provider Registry

The app now has a local AI provider registry for future provider abstraction.

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
- Model configuration
- Timeout and retry preferences
- Future failover behavior
- Connectivity testing

For now, only Codex is wired into runtime demo generation. Other providers are registration-only until a provider adapter is implemented.

## Knowledge Source Registry

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
- Active/inactive state
- Scope or purpose
- Categories
- Priority weight
- Confidence level
- Validation status

Knowledge sources are contextual inputs only. They should not be presented as verified factual truth, especially for competitive intelligence or AI-generated responses.

## Admin Configuration

The Admin page includes a lightweight Platform Foundation area with:

- AI Providers
- Knowledge Sources
- Readable preview
- Raw JSON editor
- Save buttons
- Test/validation buttons

Configuration is stored locally under ignored `artifacts/platform/` files.

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
- Vendor/product content packs
- Source-aware intelligence scoring

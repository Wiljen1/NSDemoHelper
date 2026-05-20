# White-Label Readiness

This document lists areas that are currently NetSuite-specific and should eventually move into a NetSuite content or vendor pack. Do not remove these areas yet; they are part of the current MVP.

## Prompts

- SC guide generation prompts refer to NetSuite Demo Helper and senior NetSuite Solution Consultant behavior.
- Prep operator prompts are written for NetSuite demo preparation.
- Intelligence prompts expect NetSuite demo stories, setup guidance, manifest context, and SC guide sections.
- Account setup prompts assume Codex has front-end and back-end access to NetSuite.
- Dry-run creation prompts assume a NetSuite browser session and NetSuite navigation model.
- Demo asset prompts assume an ERP/NetSuite sales-consulting story.

## UI Labels

- Product name is NetSuite Demo Helper.
- Tabs and labels include SC Guide, NetSuite setup, Dry-Run, Dataset Analysis, and Run.
- Setup prompt area references NetSuite customization/setup.
- Narration and dry-run controls assume a NetSuite demo flow.
- Demo scope examples reference financials, SuiteProjects, Fixed Asset Management, FP&A, P2P, and advanced inventory.

## Scoring Logic

- Demo Intelligence includes NetSuite/ERP concepts such as standard reports, drilldown, SuiteProjects, OneWorld, consolidation, saved searches, and finance workflows.
- Pre-Demo Intelligence checks for ERP/current-system discovery, finance process detail, integrations, local GAAP, e-invoicing, and NetSuite-relevant scope clarity.
- Stakeholder, timing, risk, winning moment, and what-not-to-demo logic are tuned toward ERP demo behavior.
- Competitive and win strategy guidance currently assumes ERP buying decisions and NetSuite positioning.

## Dry-Run / Automation Logic

- Manifest actions assume NetSuite navigation, global search, reports, saved report pages, Cash 360, and NetSuite URLs.
- Browser automation expects a logged-in NetSuite instance.
- Dry-run creation prompt and run controls assume a NetSuite account, role, and browser session.
- Dataset analysis runs the dry-run against NetSuite and scores account/demo setup readiness.

## Setup Guidance

- Setup prompts reference NetSuite account access, role validation, front-end and back-end access, account safety checks, setup items, and NetSuite configuration.
- Current setup guidance includes finance, OneWorld, SuiteProjects, approvals, reporting, templates, e-invoicing, and fixed asset considerations.

## Exports

- SC guide export is written as a NetSuite demo prep artifact.
- Follow-up question export assumes ERP discovery and NetSuite demo preparation.
- Button/API JSON export currently names NetSuite-specific flows and dry-run actions.

## Admin Configuration

- Admin content blocks include NetSuite-specific default SC instructions, account setup guidance, dry-run creation guidance, industry playbooks, demo strategies, and audience guidance.
- Additional sources/demo logic currently steer NetSuite demo behavior.
- Live demo functionality toggle hides NetSuite dry-run, run, dataset, and narration features.

## Static Content / Hardcoded JSON

- Default prep data uses Air Charter Service and NetSuite finance-first demo assumptions.
- Demo manifests are NetSuite-specific.
- Audience and industry playbooks include ERP and NetSuite finance language.
- Test fixtures include NetSuite, ERP, finance, consolidation, SuiteProjects, and dry-run concepts.

## Future Direction

These areas should eventually be split into:

- Core platform defaults
- NetSuite ERP Pack
- White-label product pack
- Customer-specific workspace data

## Current White-Label Foundation

The app now has a lightweight, additive Platform Foundation area in Admin for future-facing configuration:

- AI provider registry with Codex as the active MVP provider and planned provider types for OpenAI, Azure OpenAI, Claude, Gemini, local LLMs, enterprise gateways, and custom providers.
- Knowledge source registry for future contextual intelligence sources such as internal enablement repositories, competitive battlecards, CRM systems, retrieval APIs, knowledge bases, documentation portals, and public web intelligence.
- Validation endpoints that check the local Codex provider today and treat other providers/sources as registered future adapters.
- Local storage under ignored `artifacts/platform/` files, keeping experimental configuration out of committed source.

This foundation does not yet implement full multi-tenant routing, secret storage, external retrieval, or provider swapping. It creates the safe extension points needed to evolve toward those capabilities without disrupting the NetSuite MVP.

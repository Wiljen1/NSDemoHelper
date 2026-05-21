# Local Run Modes

This document standardizes how to run NetSuite Demo Helper locally as both the stable internal MVP and the future white-label development profile.

## Goals

- Keep the current MVP demo-ready and easy to launch.
- Give white-label development a separate local entry point.
- Make switching modes simple from the terminal.
- Avoid changing current MVP workflows while platform work continues.

## Quick Commands

Install dependencies once:

```bash
npm install
```

Run the stable MVP profile:

```bash
npm run mvp
```

Open:

```text
http://localhost:4173
```

Run the future white-label development profile:

```bash
npm run whitelabel
```

Open:

```text
http://localhost:4182
```

The existing direct control-panel command remains available:

```bash
npm run control
```

This preserves the current MVP startup flow and defaults to the existing port behavior.

## Mode Switching

Use one terminal window per mode if you want both running side by side:

```bash
npm run mvp
```

```bash
npm run whitelabel
```

Or stop one mode with `Ctrl+C`, then start the other:

```bash
npm run whitelabel
```

## Environment Profiles

The local launcher reads optional profile-specific files:

- `.env.mvp`
- `.env.whitelabel`

Example files are committed:

- `.env.mvp.example`
- `.env.whitelabel.example`

Copy the example you need:

```bash
cp .env.mvp.example .env.mvp
cp .env.whitelabel.example .env.whitelabel
```

Windows PowerShell equivalent:

```powershell
Copy-Item .env.mvp.example .env.mvp
Copy-Item .env.whitelabel.example .env.whitelabel
```

Existing environment variables override values from these files.

## Default Profile Values

MVP:

```text
APP_PROFILE=mvp
APP_ENV=development
PORT=4173
```

White-label:

```text
APP_PROFILE=whitelabel
APP_ENV=development
PORT=4182
APP_BRAND_NAME=Demo Intelligence Platform
APP_VENDOR_PACK=generic
```

`APP_PROFILE` is visible in the app header next to the version and environment so it is clear which profile is running.

## Current Behavior

The MVP profile is the current NetSuite Demo Helper experience.

It keeps:

- NetSuite-specific prep flow
- Codex-backed SC guide generation
- Pre-Demo Intelligence
- Demo Intelligence
- Admin configuration
- Dry-run/live demo controls
- Dataset Analysis
- Local saved state
- Exports

The white-label profile currently starts the same application with a separate profile and port. It is intended for future development of:

- generic platform branding
- modular AI providers
- external knowledge sources
- tenant-specific configuration
- vendor/product packs
- cloud deployment readiness

White-label mode should not be used to remove or destabilize the MVP behavior.

## Recommended Development Structure

Keep the lightweight split:

```text
src/
  control-panel.mjs              current local app and MVP UI
  platform/
    runtime-config.mjs           app profile/environment metadata
    provider-config.mjs          AI provider and knowledge source registries
    tenant-config.mjs            local tenant/branding/product pack model
    health.mjs                   cloud-readiness and system health snapshots
    founder-readiness.mjs        founder/SaaS readiness snapshot logic
    ai/
      orchestrator.mjs           provider adapter contracts and AI task envelope
    knowledge/
      source-service.mjs         source connector contracts and context envelope
docs/
  PRODUCT_ARCHITECTURE.md        platform and pack direction
  WHITELABEL_READINESS.md        NetSuite-specific items to separate later
  PLATFORM_FOUNDATION.md         provider/source foundation
  LOCAL_RUN_MODES.md             local run mode instructions
```

Near-term rule:

- Shared local app logic stays in `src/control-panel.mjs` until a refactor is explicitly needed.
- Provider/source configuration lives under `src/platform/`.
- Tenant, branding, health, AI-provider, and knowledge-source contracts live under `src/platform/`.
- Founder-readiness scoring and SaaS roadmap contracts live under `src/platform/` and docs, not inside product-specific UI flows.
- NetSuite-specific prompts and behavior remain in the MVP for now.
- Future white-label work should move domain-specific behavior gradually into content/vendor packs.

Avoid creating a second copied app. Use profile-driven behavior and shared core logic instead.

## Future Direction

The white-label profile can later evolve toward:

- profile-specific branding
- profile-specific default content
- configurable AI provider adapters
- external knowledge retrieval
- tenant-aware local/cloud storage
- product-specific scoring rules
- deployment-specific feature flags

The local launcher keeps this simple today while leaving room for those additions.

# MVP Current State

Last updated: 2026-05-26

## Product

NetSuite Demo Helper MVP is the internal NetSuite-focused demo preparation application for Solution Consultants.

The MVP remains focused on:

- Discovery & Prep inputs
- Playbook generation
- Pre-Demo Intelligence
- Demo Intelligence
- Dry-run/manifest support
- Dataset analysis support
- Admin/CMS configuration
- Session logging and session database review
- Oracle APEX cloud runtime packaging
- Codex-backed generation through configured runtime modes

## Active Production Path

The production MVP source remains:

```text
src/control-panel.mjs
```

Local MVP startup:

```bash
npm run mvp
```

Default local URL:

```text
http://localhost:4173
```

APEX package source:

```text
apex/apps/f56174
```

APEX package output:

```text
apex/build/f56174-apexlang.zip
```

APEX package command:

```bash
npm run apex:package
```

## Safe Defaults

The default APEX runtime mode remains:

```text
user-local
```

This means:

- no hardcoded ngrok URL
- no hardcoded personal laptop endpoint
- no Shared Local Pilot default
- no browser-visible pilot secret by default
- no cloud deployment is implied by building the package

Experimental runtime modes must be explicitly enabled through environment variables.

## Current Runtime Features

The MVP code currently includes:

- User-local APEX bridge detection
- Shared Local Pilot guardrails behind explicit env flags
- Local Helper download/prototype support
- Local Helper status/error UI
- APEX runtime config injection
- Admin protection and session analytics/dashboard work from prior MVP hardening

## Experimental Work Preserved

Experimental work is preserved under:

```text
docs/experiments/
helpers/local-helper/
```

These are intentionally not treated as production-default behavior.

## Generated/Local Artifacts

Local investigation screenshots and runtime artifacts remain under `artifacts/` and are ignored where appropriate.

They are useful for local reference, but should not be treated as production code or required deployment assets.

## What Not To Deploy Yet

Do not deploy these modes unless explicitly selected and validated:

- `shared-local-pilot`
- browser-direct pilot secret mode
- Local Helper packaged binaries that have not been validated on a clean Mac/Windows machine

## Validation Commands

Before committing or deploying MVP work:

```bash
npm test
node --check src/control-panel.mjs
node --check scripts/build-apex-cloud-runtime.mjs
git diff --check
npm run apex:package
```

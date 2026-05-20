# Changelog

Each release entry should include:

- Version
- Date
- Added
- Changed
- Fixed
- Known issues

Do not create future release notes before the release exists.

## Unreleased

### Added

- White-label platform foundation for registering future AI providers while keeping local Codex as the active MVP backbone.
- Admin-managed knowledge source registry for future contextual intelligence sources such as internal enablement content, CRMs, knowledge bases, competitive battlecards, retrieval APIs, and documentation portals.
- Lightweight validation endpoints for provider/source configuration so future integrations can be introduced without changing the current demo-prep workflow.
- Standardized local run profiles with `npm run mvp` and `npm run whitelabel`, plus example environment files for each profile.
- Global active AI brain status in the app header, including runtime health and enabled knowledge source count.
- White-label-only tenant/branding configuration and platform health snapshot for cloud-readiness visibility.
- Platform service-layer contracts for runtime metadata, tenant config, AI provider orchestration, knowledge-source context, and health reporting.

### Changed

- Admin Platform Foundation now separates AI Brain Management from Knowledge Source Management, with provider/source cards, configure forms, active badges, connection test actions, and advanced JSON views.
- Button/API instruction exports now include active platform status, AI brain configuration, provider health checks, and knowledge-source configuration endpoints.
- App build metadata now includes the active local profile so MVP and white-label sessions are easy to distinguish.
- MVP profile keeps white-label tenant/cloud controls hidden while white-label mode exposes the new platform control-center sections.

## v0.1.0-alpha

First internal MVP baseline for NetSuite Demo Helper.

This baseline stabilizes the current local SC demo preparation workflow and marks the first version intended to be preserved for controlled future development.

Core capabilities included:

- Prep page for customer website, demo request, demo scope, competition/status quo, audience, target segment, strategy, industry, language, and pre-demo notes.
- Codex-backed SC guide generation.
- Personalized demo story and SC runbook.
- Demo Intelligence dashboard for readiness, risks, stakeholder coverage, pacing, winning moments, what not to demo, win strategy, and competitive guidance.
- Pre-Demo Intelligence for discovery quality, missing context, website summary, follow-up questions, and note risk scoring.
- NetSuite customization and setup prompt generation.
- Demo asset / PowerPoint generation prompt.
- Optional dry-run and live demo flow with browser automation and narration controls.
- Dataset analysis workflow for checking demo account readiness.
- Admin logic/config area for editable guidance, playbooks, feature flags, and prompt rules.
- Local saved state so SC guide and intelligence outputs can load without rerunning Codex every time.
- Export support for SC guide, discovery follow-up questions, and button/API JSON instruction files.
- Tests and stress tests covering core API flows.

This release remains NetSuite-specific. White-label architecture is documented but not implemented.

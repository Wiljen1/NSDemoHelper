# Changelog

Each release entry should include:

- Version
- Date
- Added
- Changed
- Fixed
- Known issues

Do not create future release notes before the release exists.

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

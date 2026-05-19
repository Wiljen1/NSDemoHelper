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

The Core Platform should not assume NetSuite terminology, NetSuite navigation, ERP-specific modules, or a specific demo methodology beyond generic demo preparation, discovery analysis, storytelling, risk detection, and rehearsal support.

### Customer / Deal Workspaces

The first workspace model is local-only and intentionally simple. A workspace represents one customer or deal and stores the prep inputs plus generated outputs that belong to that demo effort. This lets SCs switch between customers without overwriting the current manifest, SC guide, intelligence outputs, or prompt artifacts.

Current workspace storage is local machine storage under ignored runtime artifacts. It is not cloud sync, not a CRM, and not intended to store secrets or API keys. Future versions can evolve this into a stronger workspace/snapshot service inside the Core Platform.

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

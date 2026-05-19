# NetSuite Demo Helper — Codex Project Context

## Product Purpose

NetSuite Demo Helper is an AI-powered demo intelligence and rehearsal platform for Solution Consultants.

The goal is to help SCs:
- prepare better demos
- reduce prep time
- identify discovery gaps
- improve storytelling
- improve demo consistency
- rehearse more effectively
- prepare NetSuite demo flows
- reduce risk before prospect/customer demos

The product should feel like:
- a senior SC advisor
- a demo strategist
- a rehearsal coach
- a storytelling assistant
- a NetSuite demo preparation workspace

## Product Boundaries

The product is:
- demo intelligence
- SC preparation
- storytelling support
- rehearsal support
- discovery gap detection
- demo risk reduction
- NetSuite demo flow guidance

The product is not:
- a CRM
- a full ERP implementation tool
- a BI platform
- a project management system
- a replacement for SC judgment
- a verified source of competitive claims

## Current Product State

Current version:
v0.1.0-alpha

Current focus:
- stabilize the MVP
- preserve working NetSuite ERP functionality
- improve structure and maintainability
- prepare for eventual white-label architecture
- avoid unnecessary feature bloat

## Architecture Direction

The product should evolve into a modular platform:

Core Platform:
- workspace management
- AI/Codex orchestration
- prompt execution
- scoring engine
- intelligence UI
- export system
- rehearsal/dry-run system
- local storage
- version/update system
- admin/config management

NetSuite ERP Pack:
- NetSuite-specific terminology
- ERP demo guidance
- OneWorld/Finance/SuiteProjects logic
- NetSuite setup guidance
- NetSuite navigation and dry-run manifests
- NetSuite reporting and saved search guidance
- NetSuite industry and demo playbooks

Future White-Label Pack:
- brand name
- colors/logo
- terminology
- product-specific prompts
- scoring rules
- audience/industry logic
- demo system navigation rules

Important:
Do not remove NetSuite-specific functionality yet.
Prepare for white-label readiness gradually through modularization and documentation.

## Release Workflow

Follow this release flow:

feature/* → develop → staging → production/main

Branch rules:
- feature branches are for individual changes
- develop is for active development
- staging is for tested release candidates
- production/main is for stable live releases only
- mvp/baseline-v0.1.0 is the preserved MVP fallback branch

Do not do experimental work directly on production/main.
Do not merge to production/main unless staging has been tested.

## Versioning Strategy

Use:

0.x.x = experimental/internal development
1.x.x = stable internal SC platform
2.x.x = white-label platform architecture

Suggested roadmap:
- v0.1.0-alpha: current MVP baseline
- v0.2.0: intelligence UI redesign
- v0.3.0: workspace/snapshot improvements
- v0.4.0: stronger content pack separation
- v1.0.0: stable internal NetSuite SC platform
- v2.0.0: white-label-ready platform

## Commit Naming

Use clear commit names with prefixes:

- feat: new feature
- fix: bug fix
- chore: maintenance or tooling
- docs: documentation only
- refactor: code change without behavior change
- test: tests added or changed
- style: visual/styling changes only
- release: release preparation
- revert: rollback/revert commit

Examples:
- feat: add demo workspace snapshots
- fix: preserve SC guide after page refresh
- docs: add white-label readiness notes
- refactor: separate NetSuite prompt constants
- release: prepare v0.2.0 staging build
- revert: rollback intelligence card redesign

## Development Rules

Codex should:
- preserve existing MVP behavior
- keep changes small and focused
- avoid large refactors unless explicitly requested
- avoid removing working functionality
- update documentation when architecture changes
- update changelog/version notes when relevant
- protect rollback safety
- explain major changes
- mention testing performed
- create meaningful commit messages
- avoid prompt sprawl and duplicated hardcoded logic

## UI Philosophy

The app should feel:
- calm
- structured
- strategic
- modern
- SC-focused
- easy to scan
- not overloaded

Prefer:
- progressive disclosure
- cards
- clear hierarchy
- expandable details
- action-oriented summaries
- practical SC guidance

Avoid:
- dashboard clutter
- long walls of text
- too many visible panels at once
- unnecessary complexity
- generic AI output

## Safety Rules

Codex must not automatically:
- delete important files
- overwrite major working flows
- remove NetSuite-specific logic
- perform destructive refactors
- create/edit/post/approve NetSuite records without explicit confirmation
- present competitive guidance as verified truth

Competitive guidance must be treated as advisory only and should include validation warnings.

## White-Label Readiness Rules

When adding or modifying logic, consider whether it belongs to:
- core platform
- NetSuite ERP pack
- industry pack
- audience/strategy pack
- future white-label configuration

Do not fully implement white-label support yet unless explicitly requested.
Prepare by keeping domain-specific logic easier to separate later.

## Expected Codex Behavior

Before starting future tasks, Codex should:
1. Read this file.
2. Confirm the current branch.
3. Identify whether the task should be done on a feature branch.
4. Preserve existing behavior unless explicitly asked otherwise.
5. Make the smallest safe change needed.
6. Summarize changed files.
7. Suggest or create a clear commit message.
8. Mention tests or validation performed.

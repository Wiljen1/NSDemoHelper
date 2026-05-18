---
name: "netsuite-demo-builder"
description: "Turn a NetSuite finance demo idea into a fast, narrated, read-only demo manifest for the local Playwright runner."
---

# NetSuite Demo Builder

Use this skill when converting a human NetSuite demo story into a runnable manifest for `src/demo-runner.mjs`.

## Demo Principles

- Start from direct NetSuite routes whenever they are known. Avoid slow menu wandering in the live demo.
- For prospect-facing demos, prefer NetSuite's global search and navigation bar over unexplained deep links.
- Use standard NetSuite reports for prospect demos unless the user explicitly asks for custom reports.
- Keep live execution deterministic. The runner should mostly navigate, wait for visible state, highlight, screenshot, and narrate.
- Use read-only actions by default. Do not save preferences, approve invoices, edit records, or post transactions.
- Each segment needs a clear finance value statement and a short narration that can be spoken out loud.
- Use `valueMoment` to control how often value statements appear: `major`, `page`, or `detail`.
- Pair every important action with a visible verification such as a report title, row label, button label, or dashboard card.
- Prefer optional actions for drilldowns or UI elements that may vary between roles, subsidiaries, or demo data.
- Capture screenshots after each segment for rehearsal review.

## Manifest Shape

Create or update JSON manifests under `manifests/`.

Each segment should include:

- `id`: short stable id, kebab-case.
- `title`: presenter-friendly title.
- `objective`: what the segment proves.
- `valueStatement`: why the audience cares.
- `valueMoment`: how often the value statement should be spoken. Use `major` for big transitions, `page` for main pages/sections, and `detail` for supporting points.
- `narration`: spoken line for live audio.
- `actions`: deterministic browser actions.
- `verifications`: visible checks that prove the page is in the expected state.

Supported runner action types:

- `goto`
- `globalSearchOpen`
- `waitForText`
- `waitForAnyText`
- `highlightText`
- `clickText`
- `clickRole`
- `press`
- `wait`
- `screenshot`
- `note`

## Finance Demo Flow

For a P&L to Cash 360 demo, use this story:

1. Open the standard income statement through NetSuite search/navigation.
2. Explain profitability: turnover, gross profit, operating profit, net profit, and margin.
3. Highlight filters: customer, department, location, project attributes, period, subsidiary, accounting book, and column layout.
4. Show a read-only drilldown into supporting detail.
5. Highlight export options: Excel, PDF, CSV, Word, and print.
6. Open Cash 360 directly.
7. Show cash position: bank balance, receivables, and payables.
8. Show operational cash actions.
9. Open the cash forecast table.
10. Show forecast preferences and assumptions without saving.

## Rehearsal Rules

After editing the manifest:

1. Run `npm run validate`.
2. Run `npm run demo:dry`.
3. Rehearse against NetSuite with `npm run login`, then `npm run demo:rehearse`.
4. Review screenshots under `artifacts/screenshots`.
5. Review the route and timing cache under `artifacts/cache`.
6. Make unstable actions optional or replace them with direct routes.
7. Run the final narrated demo with `npm run demo`, `npm run demo:light`, or `npm run demo:heavy`.

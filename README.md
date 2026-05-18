# NetSuite Demo Helper

This workspace contains a first finance-demo package for NetSuite:

- P&L report walkthrough
- filters, drilldown, and export options
- Cash 360 dashboard, actions, forecast, and preferences
- live narration using either the local Mac voice engine or ElevenLabs cloud voices
- screenshot capture for rehearsal review
- a demo value emphasis setting: light, balanced, or heavy
- a rehearsal/cache step before the live run

## Files

- `manifests/finance-pl-cash360.demo.json` is the structured demo manifest.
- `src/demo-runner.mjs` runs the manifest in a browser.
- `src/validate-manifest.mjs` checks the manifest shape.
- `skills/netsuite-demo-builder/SKILL.md` is the Codex skill guidance for creating future demo manifests.
- `docs/STANDALONE_APP_PLAN.md` captures the path toward the `NSDemoHelper` standalone Mac/Windows app.

## First Run

Install the browser dependency once:

```bash
npm install
```

Start the local control panel:

```bash
npm run control
```

Then open `http://localhost:4173`.

From the control panel you can:

- describe the demo you want
- set SC demo-generation instructions
- add the prospect company website
- add pre-demo notes from discovery
- choose whether to use demo request plus notes, demo request only, or pre-demo notes only
- choose and sample the narrator voice
- create a manifest draft
- edit the manifest directly
- read a lighter SC demo guide for manual delivery
- restore earlier manifest versions
- open the reusable NetSuite browser
- dry run, rehearse, or run the live narrated demo

## Command Line Flow

Open the reusable demo browser and log in:

```bash
npm run login
```

This browser stays open after the command finishes. Future demo runs reconnect to that same browser instead of opening a fresh session.

Then run the narrated demo:

```bash
npm run demo
```

For a real rehearsal without audio, which also saves timing and route information:

```bash
npm run demo:rehearse
```

For a manifest-only check:

```bash
npm run validate
npm run demo:dry
```

## Plain-English Flow

1. Open the demo browser and log in to NetSuite with `npm run login`.
2. Ask Codex to create or amend a demo around a topic.
3. Codex updates the manifest with pages, actions, narration, and value statements.
4. Choose value-statement intensity:
   - `npm run demo:light` for value statements only at major transitions.
   - `npm run demo` for balanced value statements.
   - `npm run demo:heavy` for value statements on every segment.
5. Rehearse with `npm run demo:rehearse`. This verifies pages, saves screenshots, and writes a cache file.
6. Amend the manifest if needed.
7. Run the final narrated demo with `npm run demo`.

The rehearsal cache is written to `artifacts/cache/finance-pl-cash360.demo-cache.json`.

## Notes

The current manifest is read-only by design. It highlights export buttons but does not click them, opens Cash 360 pages, and does not save Cash 360 preferences.

For prospect-facing demos, the manifest policy is to use NetSuite search/navigation first and standard NetSuite reports rather than custom saved reports.

To use a different Mac voice for one run:

```bash
npm run demo -- --voice=Moira
```

To use ElevenLabs cloud narration, create an ElevenLabs API key, then start the control panel with it:

```bash
ELEVENLABS_API_KEY=your_key_here npm run control
```

In the app, choose `ElevenLabs cloud voice` as the narration engine. The local Mac voice remains available without any API key.

To force a one-off browser instead of the reusable browser:

```bash
npm run demo -- --browser=new
```

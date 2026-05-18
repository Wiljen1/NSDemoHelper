# NetSuite Demo Helper

This workspace contains a first finance-demo package for NetSuite:

- P&L report walkthrough
- filters, drilldown, and export options
- Cash 360 dashboard, actions, forecast, and preferences
- live narration using local Mac voices or ElevenLabs cloud voices, including female and male voice options
- screenshot capture for rehearsal review
- a demo value emphasis setting: light, balanced, or heavy
- output language selection for generated demo guidance
- a rehearsal/account-prep/cache step before the live run

## Files

- `manifests/finance-pl-cash360.demo.json` is the structured demo manifest.
- `src/demo-runner.mjs` runs the manifest in a browser.
- `src/validate-manifest.mjs` checks the manifest shape.
- `skills/netsuite-demo-builder/SKILL.md` is the Codex skill guidance for creating future demo manifests.
- `docs/STANDALONE_APP_PLAN.md` captures the path toward the `NSDemoHelper` standalone Mac/Windows app.
- `docs/LOCAL_BROWSER_APP_ARCHITECTURE.md` explains the future browser UI plus local helper service model.

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
- choose audience type: prospect, executive, operational/end user, technical, customer, marketing, or partner
- choose target audience: startup, emerging/SMB, mid-market, enterprise, or public sector/government
- use the hardcoded audience playbook to steer what the demo should include, avoid, and emphasize
- add pre-demo notes from discovery
- choose whether to use demo request plus notes, demo request only, or pre-demo notes only
- choose the output language
- choose and sample the narrator voice, with cloud API key input shown only when the selected engine needs it
- switch between light mode and night mode
- create a manifest draft
- edit the manifest directly
- read three SC guide outputs: normal demo flow, personalized experience flow, and required NetSuite customization prompts
- generate a guarded NetSuite setup prompt when demo data/configuration may need to be created
- restore earlier manifest versions
- open the reusable NetSuite browser
- dry run, rehearse with account prep buffering, or run the live narrated demo

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

For a real rehearsal without audio, which also creates an account prep buffer and saves timing and route information:

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
5. Rehearse with `npm run demo:rehearse`. This prepares the account buffer, verifies pages, saves screenshots, and writes a cache file.
6. Amend the manifest if needed.
7. Run the final narrated demo with `npm run demo`.

The account prep buffer is written to `artifacts/prep-buffer/`, and the rehearsal cache is written to `artifacts/cache/finance-pl-cash360.demo-cache.json`.

## Notes

The current manifest is read-only by design. It highlights export buttons but does not click them, opens Cash 360 pages, and does not save Cash 360 preferences.

For prospect-facing demos, the manifest policy is to use NetSuite search/navigation first and standard NetSuite reports rather than custom saved reports.

To use a different Mac voice for one run:

```bash
npm run demo -- --voice=Moira
```

To use ElevenLabs cloud narration, choose `ElevenLabs cloud voice` in the app and paste the API key into the narration settings. The key is used for that browser session and is not written into the manifest. You can also start the control panel with the key already set:

```bash
ELEVENLABS_API_KEY=your_key_here npm run control
```

The local Mac voice remains available without any API key.

To force a one-off browser instead of the reusable browser:

```bash
npm run demo -- --browser=new
```

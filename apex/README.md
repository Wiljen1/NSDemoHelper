# MVP APEX Package

This folder contains the Oracle APEX shell package for the NetSuite Demo Helper MVP cloud application.

## Target

- Cloud APEX workspace: `EMEAWJ`
- Cloud APEX application ID: `56174`
- Cloud APEX application alias: `nsdemohelper`
- Local MVP runtime/bridge: user-local, normally `http://127.0.0.1:4173`

## Current Architecture

Application `56174` is now a cloud-hosted MVP runtime:

1. The user opens the cloud APEX app.
2. Page 1 is public.
3. Page 1 redirects to the APEX-hosted static application file `nsdemohelper-cloud.html`.
4. The UI renders from Oracle APEX cloud static files, including the full MVP HTML/CSS/JavaScript and the ribbon asset.
5. Browser API calls to relative `/api/...` endpoints are routed to the current browser user's local bridge, defaulting to `http://127.0.0.1:4173`.
6. The local bridge handles Codex-backed generation, session logging, exports, narrator state, and other MVP API behavior.

The cloud runtime no longer redirects to `localhost` for frontend rendering, routing, or static assets.

The full local Node MVP remains available for local Codex-backed generation and desktop demo automation. The APEX cloud UI provides the internal browser-hosted experience while using the local bridge only for API/Codex-backed operations.

## User-Local Codex Bridge

The APEX app must not point to one shared laptop, hostname, or tunnel. Each browser session discovers or stores its own local bridge endpoint:

- Default candidates: `http://127.0.0.1:4173`, `http://localhost:4173`, `http://127.0.0.1:4181`, `http://localhost:4181`, `http://127.0.0.1:4182`, `http://localhost:4182`, `http://127.0.0.1:4192`, `http://localhost:4192`.
- Manual override: open `Backbone` in the app, enter a local endpoint, and select `Save For This Browser`.
- Storage: the override is saved in that browser's `localStorage` only. It is not stored globally and does not affect other users.
- Allowed hosts: only browser-local endpoints are accepted (`localhost`, `127.0.0.1`, `::1`). Shared machine names and personal tunnel URLs are intentionally rejected by the UI validation.

If Codex is not detected, the cloud UI should still render and show a disconnected state. The user should start the local MVP/Codex bridge on their own Mac or Windows machine, then use `Backbone > Test Codex Connection`.

### Colleague Startup Flow

macOS:

1. Start the local MVP/Codex bridge with `npm run mvp`.
2. Open the APEX runtime URL.
3. Open `Backbone`.
4. Select `Test Codex Connection`.
5. If the bridge uses another port, enter `http://127.0.0.1:<port>` or `http://localhost:<port>` and save it for that browser.

Windows:

1. Start the local MVP/Codex bridge with `npm run mvp`.
2. Allow browser/private-network or firewall prompts for localhost if Windows asks.
3. Open the APEX runtime URL.
4. Open `Backbone`.
5. Select `Test Codex Connection`.
6. If the bridge uses another port, enter `http://127.0.0.1:<port>` or `http://localhost:<port>` and save it for that browser.

Browser security note: Oracle APEX is loaded over HTTPS while the local bridge normally runs on HTTP localhost. Modern browsers generally allow loopback requests, but private-network or CORS policy can still block the call. The local bridge must return the required CORS headers for `https://apex.oraclecorp.com`.

## Package

Source:

```text
apex/apps/f56174
```

Build package:

```text
apex/build/f56174-apexlang.zip
```

Regenerate the package:

```bash
npm run apex:package
```

This command first regenerates `nsdemohelper-cloud.html` from the currently running local MVP at `http://localhost:4173/`, injects the APEX cloud bridge, copies required static assets, and then rebuilds the APEX package zip.

## Deployment Notes

Use APEX App Builder Import:

1. Open the authenticated APEX workspace.
2. Go to App Builder > Import.
3. Upload `apex/build/f56174-apexlang.zip`.
4. Confirm the imported application ID is `56174`.
5. Select `Reuse Application ID 56174 From Imported Application`.
6. Continue and confirm `Replace Application`.
7. Validate that APEX reports `Application 56174 successfully imported`.

Do not leave the import wizard on the first upload page and assume deployment completed.

Do not use the older e-invoicing app package `f56594-apexlang.zip` for this MVP deployment.

## Validation

After import, open:

```text
https://apex.oraclecorp.com/pls/apex/r/emeawj/nsdemohelper
```

Expected behavior:

- the browser remains on `apex.oraclecorp.com`
- the final URL points to an APEX static application file
- the page title is `NetSuite Demo Helper`
- no frontend route, stylesheet, script, or image is loaded from `localhost`
- only API calls use the current user's browser-local bridge, such as `http://127.0.0.1:4173/api/...`
- Active Brain shows the local Codex provider when the bridge is running
- Pre-demo scoring can be triggered from the cloud page and should complete through the local Codex bridge

If the local bridge is not running, the cloud UI should still render, but Codex-backed generation and local-session features will show a disconnected or failed state.

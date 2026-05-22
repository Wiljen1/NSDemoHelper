# MVP APEX Deployment Plan

This plan covers only the MVP version of NetSuite Demo Helper.

White-label mode is explicitly out of scope for this deployment.

## Deployment Goal

Deploy and validate the MVP in this order:

1. Local APEX first, as a new local APEX application named `NS DemoHelper`.
2. Cloud APEX only after local validation passes, using existing cloud application/project ID `56174`.
3. Validate that the cloud APEX application can reach the local Codex-backed runtime before considering the deployment complete.

## Source Of Truth

Use the MVP profile from this repository:

```bash
npm run mvp
```

The MVP runtime is the Node control panel on:

```text
http://localhost:4173
```

Do not deploy the white-label profile:

```bash
npm run whitelabel
```

## Current Readiness Observation

Checked on 2026-05-22:

- Local APEX is reachable at `http://127.0.0.1:8181/ords`.
- Local APEX version endpoint returns `Oracle APEX Version: 26.1`.
- The MVP local backend is reachable at `http://localhost:4173`.
- Local Codex is detected by the MVP backend through `/api/codex/status`.
- The active provider endpoint reports `Local Codex` as connected/running.
- Chrome remote debugging on `127.0.0.1:9222` is not currently running.
- The referenced APEX connection manifest points to cloud app `56594`, not target app `56174`.
- No SQLcl executable is currently available in this shell PATH.

These observations mean local MVP validation can run now, but local APEX app creation/import and cloud APEX deployment still require the APEX Builder/Chrome or SQLcl deployment path to be active.

## Referenced APEX Connection Manifest

Connection details are documented at:

```text
/Users/wiljan.h/Documents/e-invoicing MVP/apex/codex-apex-project.json
```

Important findings from that file:

- Cloud workspace: `EMEAWJ`
- Cloud schema: `WKSP_EMEAWJ`
- Local workspace: `LOCAL_CODEX`
- Local schema: `LOCAL_CODEX`
- Existing referenced app: `56594` / `EMEAChatbot`
- Requested MVP cloud target: `56174`
- Hosted APEX base URL: `https://apex.oraclecorp.com/pls/apex`
- Local APEX base URL: `http://127.0.0.1:8181/ords`
- Chrome debug URL: `http://127.0.0.1:9222`

Do not use app `56594` as the NetSuite Demo Helper deployment target.

When using the Chrome/APEX Builder bridge for the MVP target, explicitly override the app ID:

```bash
APEX_APP_ID=56174
```

## Architecture Decision For MVP

The MVP currently depends on a local Node runtime for:

- Codex execution
- local browser automation
- local session logging
- admin password/session handling
- Word/export generation
- file-based saved state

Oracle APEX cannot directly run this Node process inside the APEX application. Therefore, the first APEX deployment should be a thin APEX application/shell that connects to the MVP backend, not a full rewrite into APEX-native pages.

This preserves the MVP while allowing APEX to provide the launch surface, access control, and later database-backed analytics.

## Cloud-To-Local Codex Requirement

Cloud APEX cannot call `http://127.0.0.1:4173` from the APEX server. That address would refer to the cloud database/server, not the SC laptop.

Before cloud validation can pass, one of these must exist:

1. A secure HTTPS tunnel from cloud APEX/browser to the local MVP backend.
2. A local browser-side connector that the cloud APEX page can call safely.
3. A hosted runner/API that replaces the local Codex dependency for cloud use.

The current `codex-apex-project.json` is an APEX Builder automation bridge, not a runtime bridge from cloud APEX to the local MVP/Codex client.

Do not mark cloud validation complete until this bridge is working and no secrets are exposed in browser code.

## Phase 1 - Local APEX Deployment

### Target

- Local APEX URL: `http://127.0.0.1:8181/ords`
- Workspace: `LOCAL_CODEX`
- Parsing schema: `LOCAL_CODEX`
- New local application name: `NS DemoHelper`

### Required Steps

1. Start the MVP backend:

   ```bash
   npm run mvp
   ```

2. Confirm MVP health:

   ```bash
   curl http://localhost:4173/api/codex/status
   curl http://localhost:4173/api/platform/status
   curl http://localhost:4173/api/feature-flags
   ```

3. Start or open local APEX:

   ```bash
   cd "/Users/wiljan.h/Documents/e-invoicing MVP"
   npm run local-apex:open
   ```

4. Create a new local APEX app named `NS DemoHelper`.

5. Do not overwrite existing local APEX apps.

6. Configure the APEX app to point to the MVP backend:

   ```text
   http://localhost:4173
   ```

   If APEX/ORDS calls the backend server-side from Docker, use:

   ```text
   http://host.docker.internal:4173
   ```

7. Keep these MVP behaviors intact:

   - Admin protection remains enabled.
   - Session logging remains enabled.
   - Admin session database remains available only after admin unlock.
   - Live demo functionality remains off by default.
   - Night mode remains off by default.
   - White-label controls remain excluded.

### Local Validation Checklist

Run these checks before any cloud push:

- App opens successfully from local APEX.
- Navigation shows MVP tabs only:
  - Discovery & Prep
  - Playbook
  - Pre-Demo Intelligence
  - Demo Intelligence
  - Admin
  - Dry-Run/Dataset/Run only when live demo functionality is enabled.
- Main demo prep flow works.
- Pre-demo scoring works.
- Learn/Create Demo works.
- Outputs are generated.
- Outputs are saved to the local session database.
- Admin unlock works.
- Non-admin users cannot edit admin settings.
- Admin can view saved sessions in Demo Prep Database.
- Import/export works where available.
- NetSuite-style assets render correctly.
- No broken routes.
- No console/runtime errors.
- No missing local database/session objects.
- Codex/local provider status shows connected.
- If Codex is unavailable, generation fails gracefully.

### Local Test Commands

From the MVP repository:

```bash
node --check src/control-panel.mjs
npm test
npm run test:stress
```

Expected:

- Syntax check passes.
- Integration tests pass.
- Stress test reports zero failed requests.

If any local APEX or MVP validation fails, stop before cloud push.

## Phase 2 - Review Codex/APEX Connection Config

Before cloud deployment:

1. Read:

   ```text
   /Users/wiljan.h/Documents/e-invoicing MVP/apex/codex-apex-project.json
   ```

2. Confirm the app ID override is set to `56174`.

3. Start Chrome remote debugging if the Chrome/APEX Builder bridge will be used:

   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --remote-debugging-address=127.0.0.1 \
     --remote-debugging-port=9222 \
     --user-data-dir="$HOME/.chrome-apex-debug"
   ```

4. Log into APEX manually in that Chrome window.

5. Verify the bridge from the e-invoicing APEX tool folder:

   ```bash
   cd "/Users/wiljan.h/Documents/e-invoicing MVP"
   APEX_APP_ID=56174 npm run apex:chrome:check
   ```

6. Do not store Oracle credentials, SSO tokens, API keys, or admin passwords in the repo.

## Phase 3 - Cloud APEX Deployment

Only continue after local validation passes.

Target:

```text
Cloud APEX application/project ID: 56174
```

Rules:

- Do not create a new cloud project.
- Do not overwrite unrelated apps.
- Do not deploy to app `56594`.
- Export/back up cloud app `56174` before import/update.
- Use the existing cloud APEX project/application ID `56174`.

Suggested Chrome/APEX Builder bridge commands:

```bash
cd "/Users/wiljan.h/Documents/e-invoicing MVP"
APEX_APP_ID=56174 npm run apex:chrome:check
APEX_APP_ID=56174 npm run apex:chrome:open-app
```

If packaging/import tooling is added for this repo later, package only MVP artifacts and explicitly exclude white-label mode.

## Phase 4 - Cloud Validation

After deploying to cloud APEX:

- Cloud app opens successfully.
- Navigation works.
- Main demo prep flow works.
- Pre-demo scoring works.
- Learn/Create Demo works.
- Outputs are generated.
- Outputs are saved to the expected session database/logging store.
- Admin unlock works.
- Non-admin users cannot edit admin settings.
- Admin session database/dashboard works.
- Import/export works where available.
- Styling/assets render correctly.
- No broken routes/assets.
- No console/runtime errors.
- No missing database objects.

Codex-specific cloud checks:

- The provider/backbone status is visible in the app.
- The app shows whether Codex is connected or disconnected.
- The cloud APEX app can reach the local Codex-backed MVP runtime through the approved bridge.
- Generation fails gracefully if Codex is unavailable.
- No secrets/API keys are exposed in browser code.

## Required Local Startup Steps For Cloud Validation

Before testing cloud APEX against local Codex:

1. Start the local MVP backend:

   ```bash
   npm run mvp
   ```

2. Confirm Codex status:

   ```bash
   curl http://localhost:4173/api/codex/status
   ```

3. Start the approved HTTPS tunnel or local connector, if required.

4. Configure the cloud APEX app to use the tunnel/connector URL, not raw `localhost`, unless the integration is browser-side and intentionally targets the SC laptop.

5. Validate that CORS, cookies, and admin auth behave correctly from the cloud APEX origin.

## Required Configuration

Known local values:

```text
MVP local URL: http://localhost:4173
Local APEX URL: http://127.0.0.1:8181/ords
Cloud APEX base URL: https://apex.oraclecorp.com/pls/apex
Cloud app ID: 56174
Local Codex command: /Applications/Codex.app/Contents/Resources/codex
```

Potential future environment variables:

```text
APP_ENV=development|staging|production
APP_PROFILE=mvp
APEX_APP_ID=56174
NSDH_MVP_BASE_URL=http://localhost:4173
NSDH_APEX_ALLOWED_ORIGINS=https://apex.oraclecorp.com
NSDH_CODEX_BRIDGE_URL=<approved HTTPS local connector or hosted runner URL>
```

Do not hardcode secrets into frontend code.

## Known Issues / Current Blockers

- This repository does not yet contain APEX app source artifacts for `NS DemoHelper`.
- The APEX deployment helper scripts currently live in another project folder.
- The referenced APEX manifest defaults to app `56594`; the MVP cloud target is `56174`.
- Chrome remote debugging on port `9222` is not currently running.
- SQLcl is not currently available in this shell PATH.
- A secure cloud-to-local Codex runtime bridge is not defined in the referenced manifest.
- Cloud APEX cannot use raw `http://localhost:4173` server-side.

## Rollback Notes

Before cloud deployment:

- Export/back up app `56174` from APEX Builder.
- Keep the Git commit SHA used for deployment.
- Keep the previous APEX export package.
- Do not force-push production branches.

Rollback options:

- Re-import the previous APEX app export.
- Revert the deployment commit in Git.
- Point the APEX shell back to the previous local MVP URL/bridge.
- Disable the cloud APEX app integration until the local connector is fixed.

## Deployment Report Template

Use this format after each deployment attempt:

```text
Local APEX deployment status:
Local validation results:
Fixes made during local testing:
Codex/APEX connection findings:
Cloud APEX deployment status for app 56174:
Cloud validation results:
Cloud-to-local Codex confirmation:
Required local startup steps:
Required environment variables/configuration:
Known issues/limitations:
Rollback notes:
```

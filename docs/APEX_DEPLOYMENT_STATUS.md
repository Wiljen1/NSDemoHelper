# APEX Deployment Status

Last updated: 2026-05-26

## Target Application

Cloud APEX application:

```text
56174
```

Runtime URL:

```text
https://apex.oraclecorp.com/pls/apex/r/emeawj/nsdemohelper
```

## Current Package Source

```text
apex/apps/f56174
```

Current package output:

```text
apex/build/f56174-apexlang.zip
```

## Safe Package Mode

The package should be built in the default safe mode unless explicitly testing another runtime:

```bash
npm run apex:package
```

Default injected runtime config:

```json
{
  "runtimeMode": "user-local"
}
```

## What Has Been Prepared

- APEX-hosted static MVP runtime.
- Runtime config injection.
- User-local bridge support.
- Optional Local Helper mode.
- Optional Shared Local Pilot mode with guardrails.
- Admin/session analytics work preserved in the MVP source.
- APEX database session logging for MVP usage and generated outputs.

## APEX Database Logging

The MVP now has a cloud database logging layer for usage review in Admin.

Schema/install script:

```text
apex/schema/nsdh_apex_logging.sql
```

ORDS base URL:

```text
https://apex.oraclecorp.com/pls/apex/emeawj/nsdh
```

Tables:

- `NSDH_SESSIONS`
- `NSDH_SESSION_INPUTS`
- `NSDH_SCORE_RESULTS`
- `NSDH_GENERATED_OUTPUTS`
- `NSDH_EVENT_LOG`
- `NSDH_ADMIN_SETTINGS`
- `NSDH_ADMIN_TOKENS`

Logged actions include Pre-demo scoring, Learn / Create Demo, Demo Intelligence analysis, follow-up question generation, playbook improvement actions, dry-run/manifest actions, Run actions, and dataset analysis. Payloads are sanitized in the browser and again in the database package so keys that look like passwords, API keys, secrets, tokens, credentials, authorization headers, or cookies are rejected.

Admin review endpoints require an Admin unlock token. Public write access is limited to sanitized session logging payloads.

Validation performed:

- `POST /sessions` creates a session record in APEX DB.
- `GET /sessions` without admin unlock returns `401 ADMIN_AUTH_REQUIRED`.
- Admin-authenticated list/detail endpoints were validated for saved session review.
- Public static runtime config includes `apexDatabaseLogging.enabled = true`.

## What Was Not Done In This Cleanup

- No cloud APEX deployment was performed.
- No Shared Local Pilot endpoint was configured.
- No ngrok/Cloudflare/tunnel URL was committed.
- No browser-visible pilot secret was committed.
- No white-label project was touched.

## Deployment Warning

Do not deploy `shared-local-pilot` unless:

- an approved HTTPS tunnel/proxy exists,
- auth/secret handling is validated,
- failure states are tested,
- the package is verified before upload.

Do not deploy `local-helper` as the default colleague path until:

- macOS helper has been tested on a clean non-developer machine,
- Windows helper has been tested on a clean non-developer machine,
- helper download and double-click launch are validated,
- Codex availability and generation are validated through APEX.

## Validation After Import

After uploading `apex/build/f56174-apexlang.zip` to APEX app `56174`, validate:

- APEX runtime opens directly.
- The UI remains on `apex.oraclecorp.com`.
- NetSuite-style UI and ribbon asset load.
- Backbone status displays runtime mode and provider state.
- Admin stays locked by default.
- Session database remains protected by admin unlock.
- Pre-demo scoring returns a clear success or safe provider error.
- Browser console has no critical errors.

# APEX Local Helper Prototype

This document describes the Local Helper pilot for the NS DemoHelper MVP.

## Purpose

The Local Helper gives the Oracle APEX-hosted MVP a lightweight way to use Codex on the current user's own machine without requiring a repo clone or `npm run mvp`.

It is intended for controlled pilot usage, not as the final production architecture.

## Runtime Architecture

```text
Oracle APEX MVP
-> browser request to http://127.0.0.1:4173
-> NS DemoHelper Local Helper
-> local Codex session
-> response back to APEX
```

The APEX page remains cloud-hosted. Only AI/provider requests go to localhost.

## User Flow

1. User opens the APEX MVP link.
2. User downloads the helper for macOS or Windows.
3. User saves it to Desktop and runs it.
4. User keeps Codex open and signed in.
5. User clicks **Test Connection** in the APEX app.
6. User runs pre-demo scoring or demo generation.

## APEX Runtime Mode

Build the APEX package in Local Helper mode:

```bash
NSDH_APEX_RUNTIME_MODE=local-helper \
NSDH_LOCAL_HELPER_HOST_LABEL="Current user's Local Helper" \
npm run apex:package
```

This injects:

```js
window.NSDH_RUNTIME_CONFIG = {
  runtimeMode: "local-helper",
  localHelperHostLabel: "Current user's Local Helper",
  allowLocalDevelopmentFallback: false
};
```

## Helper Files

Helper files live under:

```text
helpers/local-helper/
```

Current prototype downloads:

- `helper-mac.command`
- `helper-windows.bat`
- `README.md`

The APEX HTML embeds these as client-side downloads, so users can download directly from the app page.

## Local API

Required endpoints:

- `GET /api/helper/status`
- `GET /api/codex/status`
- `POST /api/generate`
- `POST /api/pre-demo-score`
- `POST /api/demo-runbook`
- `POST /api/ppt-prompt`
- `POST /api/dataset-enhancement`

MVP compatibility endpoints:

- `GET /api/platform/status`
- `GET /api/manifest`
- `GET /api/sc-guide`
- `GET /api/setup-prompt`
- `POST /api/pre-demo-intelligence`
- `POST /api/learn`
- `POST /api/dataset-analysis`

## Security Guardrails

- Helper binds to `127.0.0.1` only.
- Helper does not expose a public network port.
- CORS is restricted to `https://apex.oraclecorp.com` and local development origins.
- No admin password, API key, or request body is logged.
- Helper does not read arbitrary local files.
- Helper errors are returned as safe status codes/messages.

## Error Codes

- `HELPER_NOT_RUNNING`
- `HELPER_WRONG_PORT`
- `HELPER_CORS_BLOCKED`
- `CODEX_NOT_AVAILABLE`
- `GENERATION_TIMEOUT`
- `HELPER_INVALID_RESPONSE`

## Validation Checklist

Before switching cloud APEX to this mode:

- macOS helper starts from a downloaded `.command` file.
- Windows helper starts from a downloaded `.bat` file.
- `GET http://127.0.0.1:4173/api/helper/status` returns `ok: true`.
- `GET http://127.0.0.1:4173/api/codex/status` detects Codex when Codex is open.
- APEX page shows Runtime Mode: Local Helper.
- Test Connection changes status to Connected when helper and Codex are running.
- Stopping the helper shows a clear `HELPER_NOT_RUNNING` state.
- Stopping Codex shows a clear `CODEX_NOT_AVAILABLE` state.
- Pre-demo scoring works through the helper.
- Demo runbook generation works through the helper.

## Known Limitations

- The helper is a pilot bridge, not a managed backend.
- Users still need Codex installed/open locally.
- Windows behavior depends on Codex being available from `PATH` or `CODEX_BIN`.
- Browser private-network or firewall controls may require local approval.
- Long-running Codex calls can take several minutes.

## Future Direction

For production or broad colleague usage, move generation behind an approved hosted/internal backend:

```text
APEX Cloud App
-> hosted/internal backend
-> AI provider / Codex-compatible service
```

That future architecture removes the need for any local helper.

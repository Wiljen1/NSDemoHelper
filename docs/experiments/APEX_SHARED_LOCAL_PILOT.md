# APEX Shared Local Pilot

This document describes the short-term pilot architecture for the NS DemoHelper MVP.

The pilot lets colleagues open the Oracle APEX MVP link without installing Node, cloning the repository, or running a local bridge. Requests are routed through a secure pilot endpoint to Wiljan's local MVP/Codex bridge.

This is not the long-term production architecture.

## Runtime Flow

```text
Oracle APEX Cloud App
-> secure pilot API/tunnel/proxy URL
-> Wiljan's Desktop 2
-> local MVP bridge at http://127.0.0.1:4173
-> local Codex session
-> response back to APEX
```

## Local Host Requirements

Wiljan's Desktop 2 must remain online with:

- Codex open and signed in
- the MVP bridge running on `http://127.0.0.1:4173`
- the selected secure tunnel/proxy running

Verify local health:

```bash
curl http://127.0.0.1:4173/api/codex/status
```

Expected:

```json
{
  "ok": true,
  "available": true
}
```

## Bridge Guardrails

The local bridge supports pilot guardrails through environment variables:

```bash
NSDH_PILOT_MODE=true
NSDH_REQUIRE_PILOT_SECRET=true
NSDH_PILOT_SHARED_SECRET=<shared-secret>
NSDH_PILOT_RATE_LIMIT_MAX=120
NSDH_PILOT_RATE_LIMIT_WINDOW_MS=60000
npm run mvp
```

When pilot mode is enabled:

- API requests are logged to `artifacts/runtime/pilot-requests.jsonl`
- simple per-client rate limiting is applied
- if `NSDH_REQUIRE_PILOT_SECRET=true`, API requests must include `x-demo-helper-pilot-secret` or `Authorization: Bearer <secret>`

Do not commit real secrets.

## APEX Runtime Build

Build the APEX runtime in Shared Local Pilot mode:

```bash
NSDH_APEX_RUNTIME_MODE=shared-local-pilot \
NSDH_PILOT_API_BASE_URL=https://<secure-pilot-url> \
NSDH_PILOT_HOST_LABEL="Wiljan's Desktop 2 Codex bridge" \
npm run apex:package
```

If an APEX/ORDS proxy injects the shared secret server-side, do not put the secret in browser JavaScript.

Only use `NSDH_PILOT_BROWSER_SECRET` for a short internal browser-direct test where the risk is understood:

```bash
NSDH_PILOT_BROWSER_SECRET=<short-lived-secret>
```

## Preferred Security Model

Preferred:

```text
APEX browser
-> APEX/ORDS proxy
-> secure tunnel
-> Desktop 2 local bridge
```

This keeps the shared secret server-side in APEX/ORDS or tunnel access controls.

Fallback pilot:

```text
APEX browser
-> secure tunnel
-> Desktop 2 local bridge
```

This is faster but weaker. Any browser-side secret is visible to users with DevTools.

## Backbone UI

In Shared Local Pilot mode, the Backbone panel should show:

- Active Brain: Codex
- Runtime Mode: Shared Local Pilot
- Host: Wiljan's Desktop 2 Codex bridge
- Endpoint: configured pilot API URL
- Last Health Check
- a warning that the pilot depends on Desktop 2, tunnel/proxy, bridge, and Codex staying online

Expected error codes include:

- `PILOT_BRIDGE_UNAVAILABLE`
- `PILOT_TUNNEL_UNAVAILABLE`
- `PILOT_CODEX_UNAVAILABLE`
- `PILOT_AUTH_FAILED`
- `PILOT_TIMEOUT`
- `PILOT_INVALID_RESPONSE`
- `PILOT_UNKNOWN_ERROR`

## Colleague Flow

Colleagues should:

1. Open the APEX MVP link.
2. Install nothing.
3. Run no terminal commands.
4. Confirm Backbone shows `Runtime Mode: Shared Local Pilot`.
5. Run demo prep or generation.

Limitations:

- Wiljan's Desktop 2 must remain online.
- Codex must remain open and signed in.
- The tunnel/proxy must remain active.
- This is pilot-only and should later move to a hosted/internal backend provider service.

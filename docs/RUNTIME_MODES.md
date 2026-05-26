# MVP Runtime Modes

Last updated: 2026-05-26

The MVP supports multiple runtime modes so Oracle APEX can host the UI while AI/Codex work is routed through the correct backend for the use case.

## local-development

Used when running the MVP locally.

Command:

```bash
npm run mvp
```

Behavior:

- UI and API run from the same local server.
- Codex is called from the local MVP process.
- No APEX runtime config is required.

Status:

```text
production-supported local development path
```

## user-local

Default APEX package mode.

Build:

```bash
npm run apex:package
```

Behavior:

- UI is hosted by Oracle APEX.
- Browser API calls are routed to the current browser user's local endpoint.
- Default candidate endpoint is `http://127.0.0.1:4173`.
- Endpoint overrides are stored in the browser only.

Status:

```text
safe default APEX mode
```

Risk:

- Users need a local bridge/helper running for Codex-backed generation.

## local-helper

Lightweight helper prototype mode.

Build:

```bash
NSDH_APEX_RUNTIME_MODE=local-helper \
NSDH_LOCAL_HELPER_HOST_LABEL="Current user's Local Helper" \
npm run apex:package
```

Behavior:

- UI is hosted by Oracle APEX.
- User downloads a helper from the APEX page.
- Helper binds only to `127.0.0.1`.
- APEX calls the helper at `http://127.0.0.1:4173`.
- Helper calls the local Codex runtime.

Status:

```text
experimental MVP pilot
```

Risk:

- Helper needs clean Mac/Windows validation.
- Current script helpers are not yet packaged as signed standalone apps/executables.

## shared-local-pilot

Short-term tunnel/proxy pilot mode.

Build:

```bash
NSDH_APEX_RUNTIME_MODE=shared-local-pilot \
NSDH_PILOT_API_BASE_URL=https://<secure-pilot-url> \
NSDH_PILOT_HOST_LABEL="Wiljan's Desktop 2 Codex bridge" \
npm run apex:package
```

Behavior:

- UI is hosted by Oracle APEX.
- APEX calls a secure HTTPS pilot URL.
- The pilot URL routes to a host machine running the MVP/Codex bridge.

Status:

```text
experimental and blocked until an approved secure tunnel/proxy exists
```

Safety:

- `NSDH_PILOT_API_BASE_URL` is required.
- No default tunnel URL is stored.
- No secret is committed.
- `NSDH_PILOT_BROWSER_SECRET` should only be used for short browser-direct tests where the risk is understood.

Risk:

- Corporate network policy blocked the tested tunnel options.
- This mode depends on the host machine, tunnel/proxy, local MVP bridge, and Codex remaining online.

## hosted-backend

Future recommended architecture.

Behavior:

- APEX hosts the UI.
- A hosted/internal backend handles provider orchestration.
- Secrets stay server-side.
- Colleagues do not install anything locally.

Status:

```text
recommended future production architecture
```

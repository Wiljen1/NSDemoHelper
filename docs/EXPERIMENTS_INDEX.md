# Experiments Index

Last updated: 2026-05-26

This index preserves MVP pilot work without making it production-default behavior.

## Local Helper

Location:

```text
helpers/local-helper/
docs/experiments/APEX_LOCAL_HELPER.md
docs/experiments/LOCAL_HELPER_ZERO_SETUP_STRATEGY.md
docs/LOCAL_HELPER_PLAN.md
```

Purpose:

- Let an APEX-hosted MVP page call Codex on the current user's own machine.
- Avoid requiring users to clone the repo or run `npm`.

Status:

```text
experimental prototype
```

Current artifacts:

- macOS `.command` helper
- Windows `.bat`/PowerShell helper
- APEX download UI
- Local Helper runtime mode support

Next step:

- Package as standalone macOS `.app` and Windows `.exe`.

## Shared Local Pilot

Location:

```text
docs/experiments/APEX_SHARED_LOCAL_PILOT.md
```

Purpose:

- Route colleague APEX usage through a secure tunnel/proxy to a single host machine running Codex.

Status:

```text
blocked experiment
```

Blocker:

- No approved reachable HTTPS tunnel/proxy was successfully established from the current corporate network/VPN.
- Cloudflare quick tunnel, ngrok, localtunnel, and SSH reverse tunnel paths were investigated and did not yield a safe validated route.

Next step:

- Use an approved internal hosted backend instead, or obtain approval for a secure tunnel/proxy path.

## APEX Side-By-Side Validation Artifacts

Location:

```text
artifacts/apex-side-by-side-*
artifacts/apex-admin-login-*
```

Purpose:

- Local visual/debug evidence from comparing local MVP versus APEX cloud MVP.

Status:

```text
local reference only
```

Git behavior:

- Ignored by `.gitignore`.
- Not required for build or deployment.

## Chrome Extension / Browser Helper Concept

Status:

```text
idea only, not implemented in this MVP cleanup
```

Rationale:

- A browser extension could reduce local networking friction but would add install friction and review/security overhead.
- Not recommended as the immediate MVP path.

## Hosted Backend

Status:

```text
recommended future architecture, not implemented in this cleanup
```

Rationale:

- Best colleague experience.
- No local install.
- Secrets stay server-side.
- Easier to secure and monitor.

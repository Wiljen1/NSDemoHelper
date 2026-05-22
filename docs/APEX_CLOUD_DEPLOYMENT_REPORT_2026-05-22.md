# APEX Cloud Deployment Report - 2026-05-22

## Scope

MVP only. The white-label project was not deployed or modified.

## Target

- APEX host: `https://apex.oraclecorp.com/pls/apex`
- Workspace: `EMEAWJ`
- Application ID: `56174`
- Application alias: `nsdemohelper`
- Local MVP runtime: `http://localhost:4173`

## Findings Before Fix

Chrome remote debugging was reachable:

```text
http://127.0.0.1:9222/json/version
http://127.0.0.1:9222/json/list
```

An authenticated APEX browser tab was available.

The MVP repository did not contain:

```text
apex/apps/f56174
apex/build/f56174-apexlang.zip
```

The external APEX helper project contained only the older EMEAChatbot app package:

```text
apex/apps/f56594
apex/build/f56594-apexlang.zip
```

The referenced `codex-apex-project.json` also pointed to application `56594`, not `56174`.

Cloud app `56174` existed, but it was only a default APEX application:

- 3 pages: Global Page, Home, Login Page
- default Oracle APEX Accounts authentication
- no MVP UI
- no local Codex bridge
- no launcher to `http://localhost:4173`

Runtime validation opened:

```text
NSDemoHelper - Log In
```

This confirmed that the MVP was not actually deployed into cloud APEX.

## Root Cause

The previous workflow stopped before a real deployment to application `56174`.

Main causes:

- No `f56174` APEX source/package existed in the MVP repository.
- The available deployment helper was configured for the unrelated `56594` EMEAChatbot application.
- The import wizard was open, but import had not been completed.
- The APEX import wizard defaults to `Auto Assign New Application ID`; it must be changed to `Reuse Application ID 56174 From Imported Application`.
- There was no defined runtime bridge for the local Node/Codex MVP.

## Fix Applied

Created an MVP APEX launcher package:

```text
apex/apps/f56174
apex/build/f56174-apexlang.zip
```

Page 1 was updated to:

- be public
- redirect the browser to the local MVP runtime:

```text
http://localhost:4173
```

The package was uploaded through APEX App Builder Import.

Important import choice:

```text
Reuse Application ID 56174 From Imported Application
```

The replace confirmation was completed for app `56174` only.

APEX confirmed:

```text
Application 56174 successfully imported.
```

## Validation After Fix

Opening the cloud app:

```text
https://apex.oraclecorp.com/pls/apex/r/emeawj/nsdemohelper
```

redirects to:

```text
http://localhost:4173/
```

The MVP loaded successfully and showed:

- `NetSuite Demo Helper`
- `Codex active`
- `Active Brain: Local Codex | Running`
- `v0.1.0-alpha | development | mvp`
- live demo functionality off by default

Local Codex status endpoint returned connected/running.

Local tests passed:

```text
npm test
npm run test:stress
```

## Remaining Limitations

This is an APEX launcher shell, not a hosted Node deployment.

The cloud app depends on the local MVP being available on the SC laptop at:

```text
http://localhost:4173
```

If the local MVP is not running, the APEX launcher cannot load the tool.

For a true cloud-hosted MVP, one of these is still required:

- hosted backend/API for the MVP
- secure HTTPS tunnel to the local MVP backend
- approved browser-side local connector
- replacement of local Codex dependency with a hosted runner

## Rollback

Before replacement, the original cloud app was exported and stored as:

```text
apex/backups/f56174-before-launcher-20260522.zip
```

Rollback can be performed by re-importing that previous export if needed.

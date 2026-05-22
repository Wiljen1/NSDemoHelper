# MVP APEX Package

This folder contains the Oracle APEX shell package for the NetSuite Demo Helper MVP cloud application.

## Target

- Cloud APEX workspace: `EMEAWJ`
- Cloud APEX application ID: `56174`
- Cloud APEX application alias: `nsdemohelper`
- Local MVP runtime: `http://localhost:4173`

## Current Architecture

The MVP is a local Node/Codex application. Oracle APEX does not run the Node backend directly.

Application `56174` is therefore a thin APEX launcher:

1. The user opens the cloud APEX app.
2. Page 1 is public.
3. Page 1 redirects the browser to the local MVP runtime at `http://localhost:4173`.
4. The local MVP handles Codex, session logging, admin protection, exports, and generation workflows.

This is not a fully hosted cloud runtime. A true cloud-hosted version still needs either a hosted backend, an HTTPS tunnel, or an approved browser-side local connector.

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

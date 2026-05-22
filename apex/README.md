# MVP APEX Package

This folder contains the Oracle APEX shell package for the NetSuite Demo Helper MVP cloud application.

## Target

- Cloud APEX workspace: `EMEAWJ`
- Cloud APEX application ID: `56174`
- Cloud APEX application alias: `nsdemohelper`
- Local MVP runtime: `http://localhost:4173`

## Current Architecture

Application `56174` is now a cloud-hosted MVP runtime shell:

1. The user opens the cloud APEX app.
2. Page 1 is public.
3. Page 1 redirects to the APEX-hosted static application file `nsdemohelper-cloud.html`.
4. The UI renders from Oracle APEX cloud static files, including CSS, JavaScript, and the ribbon asset.
5. Local Codex/MVP backend calls are optional and must be enabled by the user in the cloud Admin tab.

The cloud runtime no longer redirects to `localhost` for frontend rendering, routing, or static assets.

The full local Node MVP remains available for local Codex-backed generation and desktop demo automation. The APEX cloud shell provides a self-contained internal app experience and can optionally call a configured local provider for AI-backed operations.

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

## Validation

After import, open:

```text
https://apex.oraclecorp.com/pls/apex/r/emeawj/nsdemohelper
```

Expected behavior:

- the browser remains on `apex.oraclecorp.com`
- the final URL points to an APEX static application file
- the page title is `NetSuite Demo Helper`
- no request is made to `localhost` unless the optional local provider is manually enabled
- Pre-demo scoring and Learn / Create Demo work in cloud fallback mode without a local frontend runtime

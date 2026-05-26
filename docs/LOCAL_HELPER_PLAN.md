# Local Helper Plan

Last updated: 2026-05-26

## Goal

Make the APEX-hosted MVP usable by colleagues with as little setup as possible:

1. Open the APEX MVP.
2. Download the helper.
3. Double-click it.
4. Keep Codex open.
5. See **Connected**.
6. Use the MVP.

## Current Prototype

Files:

```text
helpers/local-helper/helper-mac.command
helpers/local-helper/helper-windows.bat
helpers/local-helper/README.md
```

The APEX page can embed these files as browser downloads.

## Current Dependency Reality

macOS helper:

- Uses shell plus Python.
- Does not require Node.js, npm, Git, or repo clone.
- Needs Codex installed/open/signed in.

Windows helper:

- Uses batch plus built-in PowerShell/.NET.
- Does not require Node.js, npm, Git, or repo clone.
- Needs Codex available as `codex`/`codex.exe` or through future packaging logic.

## Best MVP Packaging Path

Use PyInstaller first:

- macOS: package helper as a standalone `.app` or executable.
- Windows: package helper as a standalone `.exe`.

This removes the manual Python dependency from the user experience.

Keep the current `.command` and `.bat` files as fallback/advanced downloads.

## Better Long-Term Packaging Path

Rewrite helper in Go or Rust:

- Smaller binaries.
- Fewer runtime concerns.
- Easier to package as signed `.app` and `.exe`.
- Cleaner tray/menu-bar status path.

## Required User-Facing States

APEX should show:

- Helper Running
- Helper Not Running
- Codex Available
- Codex Unavailable
- Connected
- Needs Restart

Error codes:

- `HELPER_NOT_RUNNING`
- `HELPER_WRONG_PORT`
- `HELPER_CORS_BLOCKED`
- `CODEX_NOT_AVAILABLE`
- `GENERATION_TIMEOUT`
- `HELPER_INVALID_RESPONSE`

## Security Rules

The helper must:

- bind only to `127.0.0.1`,
- restrict CORS to `https://apex.oraclecorp.com` and local development origins,
- avoid logging request bodies or secrets,
- avoid reading arbitrary local files,
- avoid admin privileges,
- stop safely.

## Next Recommended Steps

1. Extract helper runtime into a standalone source file.
2. Add a small local status page at `GET /`.
3. Package macOS helper with PyInstaller.
4. Package Windows helper with PyInstaller on a Windows machine/runner.
5. Test on clean Mac and Windows machines.
6. Update APEX downloads to prefer packaged app/exe artifacts.
7. Keep script helpers as fallback.
8. Only then consider deploying `local-helper` mode to cloud APEX.

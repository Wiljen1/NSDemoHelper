# Local Helper Zero-Setup Strategy

This note defines the target user experience and packaging direction for the NS DemoHelper MVP Local Helper.

## Target Experience

Ideal colleague flow:

1. Open the NS DemoHelper APEX link.
2. Select **Download Helper**.
3. Double-click the downloaded helper.
4. Keep Codex open and signed in.
5. See **Connected** in the APEX app.
6. Use the MVP.

The user should not need to install Python, Node.js, npm, Git, or clone the repo.

## Current Helper Requirements

Current prototype:

- macOS: `helper-mac.command`
  - Uses shell plus `/usr/bin/python3`.
  - Does not require Node.js or npm.
  - Calls Codex through `/Applications/Codex.app/Contents/Resources/codex` or `codex` on `PATH`.
- Windows: `helper-windows.bat`
  - Uses built-in PowerShell and .NET `HttpListener`.
  - Does not require Node.js, npm, or Python.
  - Calls `codex` or `codex.exe` on `PATH`, or `CODEX_BIN` if set.

Minimum true dependency:

- Codex must be installed/open/signed in.
- The helper must be able to execute the local Codex CLI/runtime.

Everything else should be bundled or avoided.

## Recommended Packaging Architecture

### MVP-Friendly Path

Use the existing helper logic and package it into standalone downloads:

- macOS: self-contained `.app` or signed `.command`-free app package.
- Windows: portable `.exe`.

Recommended immediate packaging tool:

- PyInstaller for the current Python helper code.

Why:

- The macOS helper already uses Python standard library only.
- PyInstaller bundles Python, so users do not install Python manually.
- Windows builds can be produced from the same Python helper source on a Windows build runner.
- It is fast enough for an internal MVP pilot.

Tradeoffs:

- Packaged binaries are larger than a native Go/Rust helper.
- macOS will still need signing/notarization for the smoothest double-click experience.
- Windows may show SmartScreen warnings until signed.

### Longer-Term Better Path

Rewrite the helper as a small Go or Rust service:

- One static binary per platform.
- No Python runtime.
- Smaller and cleaner distribution.
- Easier to run as background process with a local status page.
- Easier to add tray/menu bar later.

This is the better productized path, but it is more work than the MVP pilot needs.

## macOS Packaging Plan

Preferred order:

1. Self-contained `.app` bundle.
2. Signed and notarized launcher app.
3. Self-contained PyInstaller executable wrapped in `.app`.
4. `.command` launcher as fallback only.

Target behavior:

- User downloads `NS DemoHelper Local Helper.app.zip`.
- User unzips and double-clicks the app.
- The helper binds to `127.0.0.1:4173`.
- The helper opens a small status window or local status page.
- The APEX page auto-detects `http://127.0.0.1:4173`.

Recommended MVP implementation:

- Extract the embedded Python helper into a real Python source file.
- Build with PyInstaller on macOS:

```bash
python3 -m pip install pyinstaller
pyinstaller --onefile --name "NS DemoHelper Local Helper" helpers/local-helper/nsdh_local_helper.py
```

Then wrap the binary in a simple `.app` folder:

```text
NS DemoHelper Local Helper.app/
  Contents/
    Info.plist
    MacOS/
      NS DemoHelper Local Helper
    Resources/
      icon.icns
```

For smoother internal sharing:

- Sign the app with an Oracle-approved developer certificate if available.
- Notarize if distribution rules require it.
- Otherwise document the right-click **Open** flow for the first pilot.

## Windows Packaging Plan

Preferred order:

1. Portable `.exe`.
2. Lightweight signed installer.
3. `.bat`/PowerShell launcher as fallback only.

Target behavior:

- User downloads `NSDemoHelperLocalHelper.exe`.
- User double-clicks the executable.
- Helper binds to `127.0.0.1:4173`.
- A small status window or local status page shows:
  - Helper Running
  - Codex Available / Codex Unavailable
  - APEX Origin Allowed

Recommended MVP implementation:

- Build the same Python helper source on a Windows runner with PyInstaller:

```powershell
py -m pip install pyinstaller
pyinstaller --onefile --name NSDemoHelperLocalHelper helpers\local-helper\nsdh_local_helper.py
```

For smoother internal sharing:

- Code-sign the `.exe` if possible.
- Expect possible Windows Defender or SmartScreen warnings until signed/reputation builds.
- The helper should bind to localhost only and should not request admin privileges.

## Runtime/UI Behavior

The helper should expose:

- `GET /`
  - Simple local status page.
- `GET /api/helper/status`
- `GET /api/codex/status`
- `POST /api/generate`
- `POST /api/pre-demo-score`
- `POST /api/demo-runbook`
- `POST /api/ppt-prompt`
- `POST /api/dataset-enhancement`

The status page should show:

- Helper Running
- Codex Available / Codex Unavailable
- Listening URL
- APEX origin allowed
- Last request time
- Safe stop instructions

The APEX app should show:

- Runtime Mode: Local Helper
- Active Brain: Codex
- Helper: Running / Not Running
- Codex: Available / Unavailable
- Test Connection
- Download Mac Helper
- Download Windows Helper
- Troubleshooting guidance

## Security Rules

The helper must:

- Bind only to `127.0.0.1`.
- Avoid public network exposure.
- Restrict CORS to `https://apex.oraclecorp.com` and localhost development origins.
- Avoid logging request bodies, API keys, admin passwords, or local files.
- Avoid admin/elevated privileges.
- Return safe error messages.

The helper must not:

- Listen on `0.0.0.0`.
- Expose file browsing.
- Accept remote machine connections.
- Store secrets.
- Disable TLS or browser security.

## End-to-End Simulation

### Non-Technical Mac User

Expected friction today:

- `.command` may open Terminal.
- The current prototype expects Python to exist.
- macOS Gatekeeper may block first run.

Target after packaging:

- User downloads a zipped `.app`.
- User double-clicks it.
- Status page/window appears.
- APEX shows Connected.

Remaining likely manual step:

- First-run Gatekeeper approval unless the app is signed/notarized.

### Non-Technical Windows User

Expected friction today:

- `.bat` opens a command window.
- PowerShell execution policy can vary.
- Windows Defender/SmartScreen may warn.

Target after packaging:

- User downloads a signed portable `.exe`.
- User double-clicks it.
- Status page/window appears.
- APEX shows Connected.

Remaining likely manual step:

- SmartScreen approval until the executable is signed and trusted.

## Recommended Implementation Path

1. Split the helper runtime into a standalone source file:

```text
helpers/local-helper/src/nsdh_local_helper.py
```

2. Add `GET /` local status page.
3. Keep the existing `.command` and `.bat` launchers as fallback downloads.
4. Add PyInstaller build scripts:

```text
helpers/local-helper/build-mac.sh
helpers/local-helper/build-windows.ps1
```

5. Build packaged artifacts:

```text
dist/local-helper/mac/NS DemoHelper Local Helper.app.zip
dist/local-helper/windows/NSDemoHelperLocalHelper.exe
```

6. Update the APEX page downloads to prefer packaged artifacts when available.
7. Keep script downloads under **Advanced / fallback**.
8. Validate on a clean Mac user profile.
9. Validate on a clean Windows machine.
10. Only then promote packaged helper downloads into the cloud APEX MVP.

## Recommendation

For the MVP pilot:

- Use PyInstaller packaging first.
- Keep the current script helpers as fallback.
- Add a local status page so users see a friendly state instead of terminal output.
- Sign/notarize when sharing beyond a tiny internal pilot.

For a future productized helper:

- Rewrite the helper in Go or Rust.
- Package as signed `.app` and `.exe`.
- Add tray/menu bar status.
- Add auto-update only after the MVP usage pattern is proven.

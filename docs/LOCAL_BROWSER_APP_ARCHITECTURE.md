# Local Browser App Architecture

## Goal

Make NetSuite Demo Helper feel like a normal app while still running in the user's web browser.

The target experience:

1. User installs NSDemoHelper on Mac or Windows.
2. User launches NSDemoHelper from Applications, Start Menu, or a desktop shortcut.
3. The app starts a trusted local helper service.
4. The helper opens the UI in the user's browser at a local address such as `http://localhost:4173`.
5. The UI talks to the local helper for local-only actions:
   - generating and saving manifests
   - exporting Word files
   - running the demo automation
   - launching the test browser
   - using local Codex when available
   - using local or cloud narration
   - checking for updates

## Why A Normal Website Is Not Enough

A pure website cannot safely do the key local actions by itself. Browser security prevents an ordinary webpage from:

- launching local command-line tools
- reading and writing arbitrary local files
- controlling Chrome with a debugging port
- using a persistent local NetSuite browser profile
- calling a local Codex installation directly
- installing or updating the application

So the best shape is a browser UI plus a small local companion service.

## Recommended Shape

Use a two-part local app:

1. **Browser UI**
   - The current control panel becomes the user-facing browser app.
   - It can also be installable as a PWA later.
   - The UI stays familiar and easy to update.

2. **Local Helper Service**
   - Runs on the user's machine.
   - Starts the local web server.
   - Owns all local filesystem, browser automation, Codex, updater, and narration integrations.
   - Exposes only a localhost API to the browser UI.

## Browser Automation

Use Playwright with Chrome for Testing instead of relying on a manually configured user Chrome.

Why:

- works on Mac and Windows
- gives the app a consistent browser automation target
- avoids breaking when the user's personal Chrome profile changes
- allows a dedicated persistent NetSuite profile for login/session reuse
- keeps demo automation separate from the user's daily browser

The helper should install or bundle the browser dependency during setup, then store browser state in the user's app data folder.

Suggested storage:

- Mac: `~/Library/Application Support/NSDemoHelper`
- Windows: `%APPDATA%\\NSDemoHelper`

## Codex Integration

The app should support Codex in two layers:

1. **Local Codex Adapter**
   - Detects whether Codex is installed and authenticated on the user's machine.
   - If available, uses it to interpret SC instructions, notes, and company context.
   - If unavailable, shows a clear setup message instead of failing silently.

2. **API/Cloud Fallback**
   - Optional future path for users who do not have local Codex installed.
   - Uses a configured API key or managed backend.
   - Keeps the app usable across machines where local Codex is not installed.

The browser UI should not call Codex directly. It should ask the local helper to generate or amend demo assets.

## Mac User Flow

1. Download `NSDemoHelper.dmg`.
2. Install the app.
3. Open NSDemoHelper.
4. The app starts the helper service and opens the browser UI.
5. The first-run setup checks:
   - local Codex availability
   - Chrome for Testing availability
   - NetSuite browser profile
   - narration engine
   - update channel
6. User clicks `Open NetSuite Browser`, logs in, and runs demos.

## Windows User Flow

1. Download `NSDemoHelperSetup.exe`.
2. Install the app.
3. Open NSDemoHelper from Start Menu.
4. The app starts the helper service and opens the browser UI.
5. The first-run setup performs the same checks as Mac.
6. User logs in to NetSuite through the dedicated test browser and runs demos.

## Update Strategy

The helper should check GitHub Releases for newer versions.

- Public repo: update checks can read releases without authentication.
- Private repo: update checks need authentication or a separate release distribution channel.

For a private repo, the easiest business-friendly option is:

1. keep the code repository private
2. publish signed installers to an internal accessible location
3. let the app check that release endpoint for updates

## Implementation Milestones

1. Add a first-run setup page.
2. Move runtime state into an OS-specific app data folder.
3. Add a local dependency check for Node, Playwright/Chrome for Testing, Codex, and narration providers.
4. Add a Codex adapter interface so local Codex and API fallback can use the same generation flow.
5. Package the helper as a Mac and Windows desktop launcher.
6. Add GitHub Release update checks.
7. Add signed installers and automated release builds.

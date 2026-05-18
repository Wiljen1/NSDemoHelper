# NetSuite Demo Helper Standalone App Plan

## Target Repository

- GitHub repository: `NSDemoHelper`
- Current local project: NetSuite Demo Helper prototype
- Target product: standalone desktop application for Mac and Windows

## What The Standalone App Should Do

1. Start as a normal desktop app, not a terminal-driven local server.
2. Let SCs prepare a demo from instructions, company website, audience, demo request, and/or pre-demo notes.
3. Use Codex-style reasoning as the backbone for interpreting the inputs and creating the demo manifest.
4. Generate two outputs:
   - an editable automation manifest for the tool
   - a light SC guide for manual delivery
5. Run dry runs, rehearsals, and live demos with narration.
6. Support local voices by default and cloud voices when an API key is configured.
7. Package and run on both Mac and Windows.
8. Check GitHub for newer releases and guide the user through updating.

## Update Strategy

The application should use versioned GitHub Releases as the source of truth.

1. The app stores its current version from `package.json`.
2. On startup, or when the user clicks `Check for updates`, it checks the latest release in `NSDemoHelper`.
3. If the GitHub release version is newer, the app shows the release notes and an update button.
4. The updater downloads and installs the correct package for the operating system:
   - Mac: signed `.dmg` or `.zip`
   - Windows: signed `.exe` installer
5. If automatic updating is not configured yet, the app opens the latest GitHub Release page.

## Packaging Options

- Electron is the pragmatic first choice if we want the existing web UI to become a desktop app quickly.
- Tauri is attractive if we want a smaller app footprint, but it may need more setup work for browser automation and updates.
- A browser-first app with a small local helper service is the best fit if we want users to work in their normal browser while still using local Codex, local files, Chrome for Testing, and NetSuite automation. See `docs/LOCAL_BROWSER_APP_ARCHITECTURE.md`.

## Suggested Milestones

1. Rename the package and internal app metadata to `NSDemoHelper`.
2. Decide between a desktop shell and browser UI plus local helper service.
3. Add settings for API keys, NetSuite browser behavior, local Codex, and voice provider.
4. Move runtime state into OS-specific app data folders.
5. Add update checking against GitHub Releases.
6. Add signed Mac and Windows builds.
7. Add a GitHub Actions release workflow.
8. Publish the first release to `NSDemoHelper`.

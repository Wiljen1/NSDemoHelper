# NS DemoHelper Local Helper

The Local Helper is a lightweight pilot bridge for the MVP Oracle APEX app.

It lets a user open the APEX MVP, run a small helper locally, and let the cloud-hosted page call Codex on that user's own machine.

## User Flow

1. Open the NS DemoHelper APEX link.
2. Download the helper for your operating system.
3. Save it to your Desktop.
4. Run the helper and keep the helper window open.
5. Keep Codex open and signed in.
6. In the APEX app, click **Test Connection**.
7. Use the MVP.

## macOS

Download `helper-mac.command`, save it to Desktop, then double-click it.

If macOS blocks the first run, right-click the file and choose **Open**.

The helper uses the built-in `/usr/bin/python3` runtime and listens only on:

```text
http://127.0.0.1:4173
```

## Windows

Download `helper-windows.bat`, save it to Desktop, then double-click it.

The script launches a temporary PowerShell helper and listens only on:

```text
http://127.0.0.1:4173
```

If Windows Defender Firewall asks for access, only allow local/private access if your security policy permits it. The helper is intended to bind to localhost only.

## API

The helper exposes:

- `GET /api/helper/status`
- `GET /api/codex/status`
- `POST /api/generate`
- `POST /api/pre-demo-score`
- `POST /api/demo-runbook`
- `POST /api/ppt-prompt`
- `POST /api/dataset-enhancement`

For MVP compatibility it also exposes:

- `GET /api/platform/status`
- `GET /api/manifest`
- `GET /api/sc-guide`
- `GET /api/setup-prompt`
- `POST /api/pre-demo-intelligence`
- `POST /api/learn`
- `POST /api/dataset-analysis`

## Security Notes

- The helper binds to `127.0.0.1` only.
- It does not expose a public network port.
- It restricts browser access to `https://apex.oraclecorp.com` and localhost development origins.
- It does not log API keys, passwords, request bodies, or local files.
- It is a pilot helper, not a production hosted backend.

## Troubleshooting

`HELPER_NOT_RUNNING`: start the helper and keep the helper window open.

`HELPER_WRONG_PORT`: confirm the app is checking `http://127.0.0.1:4173`.

`HELPER_CORS_BLOCKED`: confirm the APEX app is running from `https://apex.oraclecorp.com` and the helper was not modified.

`CODEX_NOT_AVAILABLE`: open Codex, sign in, and make sure the `codex` command is available.

`GENERATION_TIMEOUT`: Codex did not return in time. Try again with a smaller request.

`HELPER_INVALID_RESPONSE`: the endpoint responded, but not as NS DemoHelper expects.

Last Edit: Codex - 2026-10-08 - Motive: Document the standalone Node and SQLite API.

# Host the wizard API

The frontend can use static hosting. The API runs one Node 24 LTS process with a private SQLite database; it does not need Docker or npm packages at runtime. Installation still happens on the user's device.

Run `node server/node-server.mjs` from the repository root. The listener binds to `127.0.0.1:8787`; publish it through an HTTPS reverse proxy or Cloudflare Tunnel. The deployment hostname is `https://start-api.smartgic.io`. Debian 13's standard Node package is version 20, so install a maintained Node 24 runtime separately.

Configure these values in a private service environment file, never in frontend assets:

| Variable | Value |
| --- | --- |
| `PUBLIC_ORIGIN` | `https://start-api.smartgic.io` |
| `ALLOWED_ORIGINS` | `https://start.openvoiceos.pt,https://openvoiceos.github.io` |
| `RELAY_ADMIN_KEY` | A new 32-byte random secret encoded as 64 lowercase hexadecimal characters |
| `DATABASE_PATH` | Absolute filename; defaults to `/var/lib/ovos-start/installs.sqlite` |
| `PORT` | Loopback port; defaults to `8787` |

Origins must be exact HTTPS origins with no trailing slash, paths or wildcards. Deploy the `server/` directory together with `dist/recipe-code.mjs`, `dist/scenario.mjs` and `dist/recommendations.mjs`; these source modules validate recipes independently of the browser.

Use a dedicated service account. Its database directory must be owned by that account with mode `0700`; the database is mode `0600`. Keep the secret stable across restarts: changing it invalidates ownership and installer capabilities. Do not log authorization headers, request bodies or temporary install URLs.

[`deploy/ovos-start-api.service`](../deploy/ovos-start-api.service) supplies the systemd service: the dedicated `ovos-start` user, private state directory, automatic restart and a 256 MiB memory limit. It reads `/etc/ovos-start/api.env`, runs `/opt/ovos-start/current/server/node-server.mjs` using `/opt/ovos-start/node/bin/node`, and keeps the application filesystem read-only. The runtime and `current` symlinks should be managed by root. Enable it only after the runtime, application files and private environment are in place.

[`openDatabase`](../server/node-database.mjs) applies the relay's four migrations in a transaction and records their checksums. Restarting does not replay them. It rejects changed migrations, symlinks and a public state directory. SQLite uses WAL, full synchronous writes and a one-second busy timeout. Back up the live database using SQLite's backup facilities; copying only the main file while WAL is active is insufficient.

## API contract

[`createApi`](../server/node-api.mjs) exposes:

| Endpoint | Access |
| --- | --- |
| `GET /healthz` | Returns `{"ok":true}` only when SQLite answers |
| `POST /api/install` | Allowed wizard origin and browser bearer credential; `{code}` creates/restores a setup, `{id}` reads its status |
| `OPTIONS /api/install` | Preflight for allowed origins, `POST`, `Authorization` and `Content-Type` |
| `GET /s/<capability>` | Temporary install command; existing one-hour start deadline |
| `POST /v1/events` | Write-only installer capability; existing 24-hour reporting deadline |

The service-only relay routes `/v1/sessions` and `/v1/session` are inaccessible from HTTP. The wrapper invokes them internally. No hosting-specific identity header is trusted.

Generate a 32-byte browser credential with `crypto.getRandomValues`, retain it in the wizard's first-party storage, and send its lowercase hex encoding in `Authorization: Bearer ...`. Send JSON and use `credentials: 'omit'`. The server derives an opaque owner using HMAC; a different browser credential cannot read another owner's install. Do not include this credential in share links, exported recipes or commands. Clearing browser storage loses access to that browser's earlier progress. The public frontend never receives `RELAY_ADMIN_KEY` or the installer write token.

Cross-site cookies are unnecessary. CORS allows only configured wizard origins. It is not a replacement for bearer authentication. Requests are capped at 1 KiB and have bounded HTTP timeouts. Rate limits allow 180 requests per client address and 1,200 globally per minute, plus 10 new sessions per address and 60 globally per minute. At most 2,000 session rows can be stored; the durable row limit survives process restarts, and expired rows are pruned as new sessions are created. Minute counters reset with the process. Restore/status operations do not consume the new-session quota.

Only a loopback proxy may provide `CF-Connecting-IP`, and that header affects throttling only. A direct local request falls back to its TCP address. Do not bind the Node listener publicly or use a proxy that passes user-supplied Cloudflare identity headers unchanged. Do not put an interactive Cloudflare Access challenge in front of installer callback/download routes.

## Migration and verification

The current relay pins a launcher revision that reports to `start-api.smartgic.io`. For future hostname changes, publish a matching launcher revision and update the pin in [`launch.mjs`](../server/relay/server/launch.mjs). Otherwise the command and progress will use different databases. Keep the previous relay available for outstanding installs through their 24-hour reporting window. Existing databases are not imported automatically.

Use `node --test test/node-api*.test.mjs` for ownership isolation, CORS, payload limits, callbacks, persistent state, transactional migrations and real HTTP requests, plus the preserved relay regressions. [`createHttpServer`](../server/node-server.mjs) supplies the listener limits; [`createApi`](../server/node-api.mjs) supplies authentication and throttling. Verify public HTTPS, `/healthz`, a simulated install callback and persistence across a service restart before switching the frontend.

[`server/relay/NOTICE`](../server/relay/NOTICE) records the source revision and license of the preserved relay code.

## Website and DNS

GitHub Pages publishes the frontend from the `dev` branch of `OpenVoiceOS/ovos-start` through [the deployment workflow](../.github/workflows/pages.yml). Its custom domain is `start.openvoiceos.pt`; HTTPS enforcement is enabled in the repository’s Pages settings. Only `dist/client` is uploaded.

| Record | Target | Settings |
| --- | --- | --- |
| CNAME `start.openvoiceos.pt` | `openvoiceos.github.io` | TTL 300, DNS only |
| CNAME `start-api.smartgic.io` | `961cc898-6447-4079-adff-0bc3e74386e1.cfargotunnel.com` | Cloudflare proxied, automatic TTL |

The `ovos-start-api` tunnel runs as `cloudflared-ovos-start.service` on `agh01.home.lan`. It forwards only the API hostname to `http://127.0.0.1:8787`, with a final 404 rule for every other hostname. The existing tunnel service has separate configuration and credentials.

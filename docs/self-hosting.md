Last Edit: Codex - 2026-10-09 - Motive: Preserve existing wizard sessions during the public domain transition.

# Host the wizard API

The frontend can use static hosting. The API runs one Node 24 LTS process with a private SQLite database; it does not need Docker or npm packages at runtime. Installation still happens on the user's device.

Run `node server/node-server.mjs` from the repository root. The listener binds to `127.0.0.1:8787`; publish it through an HTTPS reverse proxy or Cloudflare Tunnel. The progress API hostname is `https://start-api.smartgic.io`. Copied commands and downloaded setup scripts use `https://installer.openvoiceos.org`, an HTTPS alias to the same service and database. Debian 13's standard Node package is version 20, so install a maintained Node 24 runtime separately.

Configure these values in a private service environment file, never in frontend assets:

| Variable | Value |
| --- | --- |
| `PUBLIC_ORIGIN` | `https://start-api.smartgic.io` |
| `ALLOWED_ORIGINS` | `https://start.openvoiceos.org,https://start.openvoiceos.pt,https://openvoiceos.github.io` |
| `RELAY_ADMIN_KEY` | A new 32-byte random secret encoded as 64 lowercase hexadecimal characters |
| `DATABASE_PATH` | Absolute filename; defaults to `/var/lib/ovos-start/installs.sqlite` |
| `PORT` | Loopback port; defaults to `8787` |

Origins must be exact HTTPS origins with no trailing slash, paths or wildcards. Deploy the `server/` directory together with `dist/recipe-code.mjs`, `dist/scenario.mjs` and `dist/recommendations.mjs`; these source modules validate recipes independently of the browser.

Use a dedicated service account. Its database directory must be owned by that account with mode `0700`; the database is mode `0600`. Keep the secret stable across restarts: changing it invalidates ownership and installer capabilities. Do not log authorization headers, request bodies or temporary install URLs.

[`deploy/ovos-start-api.service`](../deploy/ovos-start-api.service) supplies the systemd service: the dedicated `ovos-start` user, private state directory, automatic restart and a 256 MiB memory limit. It reads `/etc/ovos-start/api.env`, runs `/opt/ovos-start/current/server/node-server.mjs` using `/opt/ovos-start/node/bin/node`, and keeps the application filesystem read-only. The runtime and `current` symlinks should be managed by root. Enable it only after the runtime, application files and private environment are in place.

[`openDatabase`](../server/node-database.mjs) applies the relay's six migrations in a transaction and records their checksums. Restarting does not replay them. It rejects changed migrations, symlinks and a public state directory. SQLite uses WAL, full synchronous writes and a one-second busy timeout. Back up the live database using SQLite's backup facilities; copying only the main file while WAL is active is insufficient.

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

### Confirmed installation milestones

`completedSteps` contains only received completion facts: `packages_installed`, `audio_configured`, `components_installed` and `services_started`. The first three are fixed installer callbacks after successful, allowlisted Ansible checkpoints. `services_started` comes exclusively from the existing `services_ready` callback after the launcher checks the expected processes. There is no direct `services_started` event, arbitrary task name or task output in the API.

Receipts are accepted once installation has started (`rank >= 3`) and never regress its existing status or the unchanged `phase` range 0–4. Late facts can be added after installation or voice readiness, including a late successful services check. Failed and cancelled runs retain their received facts but reject subsequent callbacks. Installation success alone does not imply every optional step ran; missing facts remain absent. Speaker and microphone results are separate from these setup milestones.

[`0005_completed_steps.sql`](../server/relay/drizzle/0005_completed_steps.sql) adds a constrained four-bit field with an empty default. Only old rows currently at `services_ready` receive the service bit during migration; historical `voice_ready` rows have no record proving a separate services callback and remain empty. [`transition`](../server/relay/server/worker.mjs) accumulates facts using the same capability authentication, update limits and compare-and-swap writes as other events. The API tests cover migration from both old schemas, concurrent receipts, rejected freeform metadata, retained facts after failure and persistence across restart.

### Speaker and microphone checks

Owner-scoped status responses include `audioStatus` and `microphoneStatus`: `pending`, `checking`, `passed` or `failed`. The installer sends only fixed events (`audio_checking`, `audio_passed`, `audio_failed`, `microphone_checking`, `microphone_passed`, `microphone_failed`). These callbacks contain no recording, device name or freeform diagnostic. [`transition`](../server/relay/server/worker.mjs) accepts them after installation, including later checks after `voice_ready`, without regressing the installation milestone. Failed or cancelled installations cannot be changed.

A new passed result must follow its `checking` event; duplicate passed results are harmless. Failure is always recorded after installation, even if the checking callback was missed, so an old success cannot hide a failing retry. Starting a new speaker check resets the microphone result to `pending`. Failures set the attention flag; a retry clears it when neither check remains failed. `needs_attention` changes unfinished checks back to `pending` while keeping completed results. A callback can be missed, so a pending result means no result was received, not a hardware failure. Two passed checks do not automatically mark voice readiness; the existing `voice_ready` callback still requires a confirmed assistant reply, confirms both checks for older launchers, and clears attention even when the installation reached that milestone before a retry.

[`0004_audio_checks.sql`](../server/relay/drizzle/0004_audio_checks.sql) adds enum-constrained columns with `pending` defaults and backfills both as `passed` only for existing `voice_ready` sessions. Results survive API restarts, use the existing owner authentication and expiry, and share the 120-update limit and compare-and-swap protection. [`node-api-relay.test.mjs`](../test/node-api-relay.test.mjs) covers outcomes, retries, ordering, concurrent updates and compatibility; [`node-api.test.mjs`](../test/node-api.test.mjs) verifies migration from existing databases, persistence and owner isolation.

Only a loopback proxy may provide `CF-Connecting-IP`, and that header affects throttling only. A direct local request falls back to its TCP address. Do not bind the Node listener publicly or use a proxy that passes user-supplied Cloudflare identity headers unchanged. Do not put an interactive Cloudflare Access challenge in front of installer callback/download routes.

## Migration and verification

The install-download origin and progress origin are independent. [`INSTALL_LINK_ORIGIN`](../dist/short-setup.mjs) uses `https://installer.openvoiceos.org` only for copied commands and downloaded setup scripts. [`INSTALL_API_URL`](../dist/install-progress.mjs), the launcher's callback URL and `PUBLIC_ORIGIN` remain on `https://start-api.smartgic.io`. Both hostnames must reach this same service and SQLite database. The download alias needs no browser CORS or CSP allowance because curl, not the browser, fetches it.

Provision routing and a valid HTTPS certificate for the alias before publishing it in the wizard. A DNS CNAME alone does not provide a certificate for the alias. Check `/healthz` and a freshly issued `/s/<capability>` through both hostnames: each download must return the same bootstrap without redirecting.

The example keeps both wizard origins allowed during the transition. Apply it before changing the GitHub Pages custom domain so already-open `https://start.openvoiceos.pt` tabs can still restore and poll their installations. Keep the previous origin allowed until its outstanding sessions have expired: each has a 24-hour reporting window from session creation, not from the domain change or deployment. Retire the old wizard before removing its origin from the runtime configuration and example. Browser ownership credentials stay in the original site's storage; saved setup links carry choices, not access to an earlier installation.

If the progress API itself moves, update `PUBLIC_ORIGIN`, the browser URL/CSP and the launcher's callback URL together, then publish a matching launcher revision and update the pin in [`launch.mjs`](../server/relay/server/launch.mjs). Keep the previous relay available for outstanding installs through their 24-hour reporting window. Existing databases are not imported automatically.

Use `node --test test/node-api*.test.mjs` for ownership isolation, CORS, payload limits, callbacks, persistent state, transactional migrations and real HTTP requests, plus the preserved relay regressions. [`createHttpServer`](../server/node-server.mjs) supplies the listener limits; [`createApi`](../server/node-api.mjs) supplies authentication and throttling. Verify public HTTPS, `/healthz`, a simulated install callback and persistence across a service restart before switching the frontend.

[`server/relay/NOTICE`](../server/relay/NOTICE) records the source revision and license of the preserved relay code.

## Website and DNS

GitHub Pages publishes the frontend from the `dev` branch of `OpenVoiceOS/ovos-start` through [the deployment workflow](../.github/workflows/pages.yml). Its custom domain is `start.openvoiceos.org`; HTTPS enforcement is enabled in the repository’s Pages settings. Only `dist/client` is uploaded.

| Record | Target | Settings |
| --- | --- | --- |
| CNAME `start.openvoiceos.org` | `openvoiceos.github.io` | TTL 300, DNS only |
| CNAME `start-api.smartgic.io` | `961cc898-6447-4079-adff-0bc3e74386e1.cfargotunnel.com` | Cloudflare proxied, automatic TTL |
| CNAME `installer.openvoiceos.org` | `start-api.smartgic.io` | TTL 3600; Cloudflare custom hostname with validated HTTPS |

The `ovos-start-api` tunnel runs as `cloudflared-ovos-start.service` on `agh01.home.lan`. It forwards approved hostnames to `http://127.0.0.1:8787`, with a final 404 rule for every other hostname. The branded download alias must route to this same origin after its HTTPS certificate is validated. The existing tunnel service has separate configuration and credentials.

Last Edit: Codex - 2026-10-09 - Motive: Document the branded installer download origin and unchanged tracking API.

# One-hour installation links

Launcher 2.4.2 is pinned by immutable commit. Its automatically uploaded failure-report URL is delivered with the failure event; [report recovery](install-progress.md) documents the UI and privacy boundary.

## Manual recovery after clipboard failure (0.54.1)

There is no command disclosure control. [`manualCopyReady`](../dist/app.mjs) requires a failed clipboard attempt bound to the current recipe, accepted prerequisites, an unexpired setup and its launch token. [`updateManualCopy`](../dist/app.mjs) otherwise hides and clears the plain readonly field. Pending and successful copying never reveal it. Clipboard denial or an unavailable clipboard API selects the current command for manual copying. Newer requests invalidate older clipboard outcomes. Sharing, downloading and reload do not enable the fallback. [Copy tests](../test/copy.test.mjs) and [callback tests](../test/progress-placement.test.mjs) verify these boundaries.

The wizard copies a short `curl … | sh` command for tracked installations. [`buildShortCommand`](../dist/short-setup.mjs) validates the recipe and fixed 22-character capability, then downloads from `https://installer.openvoiceos.pt/s/<capability>`. This branded HTTPS alias reaches the same relay and database as `start-api.smartgic.io`; browser progress requests and launcher callbacks keep the existing API hostname. No third-party shortener is used. The browser requires a current capability; failed session creation asks for a retry and never exposes the longer untracked command. [`buildSetupScript`](../dist/short-setup.mjs) uses the same branded alias and keeps its private-file full-download guard inside the downloadable file. [Hosting instructions](self-hosting.md) cover alias routing and certificate validation.

## Preview isolation

[`isPreviewContext`](../dist/preview.mjs) recognizes localhost/loopback/file pages and explicit simulation metadata. [`copy` and `download`](../dist/app.mjs) refuse executable exports, the command field stays empty and a visible notice links to production with only recipe choices. This prevents simulation capabilities from pointing at nonexistent live records.

## Ownership and expiry

[`issueSetup`](../dist/short-setup.mjs) freezes the choices and original issue/deadline. The recipe remains a sixteen-character Crockford Base32 v2 value: fifteen choice fields, timestamp and CRC8. The checksum detects mistakes; it is not authentication. The [relay](../server/relay/server/worker.mjs) derives a separate 128-bit launch capability and stores only its indexed hash in SQLite. Authenticated create/restore returns it; ordinary status reads do not. Existing rows are lazily backfilled without moving deadlines.

`GET /s/CAPABILITY` resolves only its own recipe and write-only tracking capability. It never reveals status, owner identity or user credentials, and cannot accept an arbitrary download URL. Responses are not cached. At `now >= issuedAt + 3600`, the server returns only a nonzero diagnostic script instead of an installer, including when installation has already started. The launcher independently rechecks the timestamp before installation. A running installation is not interrupted; progress remains available for its existing 24-hour window.

Copying, downloading, reloading, sharing, Back and cancelling an edit never renew the deadline. Expired links retain choices; **Copy new command** explicitly issues a new recipe. Shared setup links and local drafts contain only choices/route metadata. They do not contain launch or write capabilities. Each browser credential receives an independent installation session. Keep executable commands private: their URL capability can remain in shell history or access logs.

## Download and terminal behavior

[`bootstrap`](../server/relay/server/launch.mjs) emits exactly one parenthesized shell compound command ending at its final `)`. A truncated prefix cannot execute any command. Inside that block, curl fully downloads immutable launcher v2 at the immutable commit declared by `LAUNCHER_URL` in that module before executing it. Curl disables local curlrc, accepts only HTTPS, refuses redirects and uses 15-second connection /120-second total limits. Empty or failed launcher downloads stop. The launcher receives stdin from `/dev/tty` so sudo and setup prompts continue working.

The outer curl disables curlrc and redirects and has a120-second total limit. Native curl errors remain visible. As with other POSIX pipes, the last shell determines the pipeline status: an empty failed transfer is a no-op with exit0, and a fully delivered bootstrap may execute even if curl subsequently reports failure. This is not a guarantee that outer curl succeeded. Every incomplete prefix of the relay block does no installer work; the pinned inner download still requires successful completion and nonempty content. Neither pipeline status nor command copying is proof of installation; authenticated callbacks alone drive success in the wizard.

Downloaded setup scripts retain `mktemp`, curl success and nonempty-file gates. `mktemp` creates a unique0600 file rather than overwriting a local `v2.sh`; that file remains until system/user cleanup. This stricter outer transfer stays inside the file rather than appearing in the normal clipboard command.

Relay [`launchError`](../server/relay/server/launch-errors.mjs#L56) returns a grouped diagnostic shell script for expired/unknown well-formed links or service outages. HTTP200 means that the diagnostic itself downloaded successfully; it prints a next step and exits1. The response is private/no-store and includes no recipe, callback token, identity or status. Expired retained recipes select their locale; unknown records/outages use English. Malformed token shapes, wrong methods and query parameters remain404. Neither download nor shell exit is used as proof of installation; success requires an authenticated callback.

Executable downloads require the same valid launch session as copying. [`buildSetupScript`](../dist/short-setup.mjs) fully downloads the relay body over HTTPS into a private 0700 directory / 0600 file, rejects failed or empty transfers and invalid shell syntax, preserves the child exit code, and removes the directory on exit, INT or TERM. Failed session creation exposes neither a fallback command nor a runnable download.

The canonical [v2 launcher](https://github.com/OpenVoiceOS/ovos-start-launcher/blob/dev/docs/index.md) retains 64-bit/user/OS validation, private scenario backups, existing-checkout protection, target-only credential prompts and post-reboot checks. It clears inherited Git repository/index/ref context before fetching, preserving ordinary Git and network configuration. The browser codec remains for choices; unused local launcher mirrors and old inline generators are removed. The relay sends the callback write token only inside the target bootstrap, not the create-session JSON response.

## Verification

The Node and Python suites exercise sh, Bash and Dash. [`launch-download.test.mjs`](../test/launch-download.test.mjs) tests every byte prefix, all localized error responses, failed/empty pinned downloads, true PTY replies and launcher exits0/7/130 using controlled curl stubs. It explicitly tests the empty-transfer status and complete-body/failed-curl cases. [`copy.test.mjs`](../test/copy.test.mjs#L74) verifies session failure/retry, clipboard truth and no fallback disclosure; [`views.test.mjs`](../test/views.test.mjs#L135) checks initial handoff rendering.

Reviewed actual relay bodies are stored in [`relay-launch.json`](../test/fixtures/relay-launch.json), allowing standalone wizard tests without a sibling checkout. Set `OVOS_RELAY_ROOT` to compare those bytes against the real relay modules; this release ran with that comparison enabled. Set `DASH_BIN` when Dash is outside PATH. The [bootstrap regressions](../test/launch-download.test.mjs) exercise every truncated prefix and preserve interactive input through a real PTY. No real installation or production Python plugin classes are involved.

Python [`test_export_cleans_private_downloads`](../test/test_export_safety.py) covers success, failed/empty/truncated transfers, installer failure and signals under sh, Bash and Dash. Set `OVOS_LAUNCHER_ROOT` for canonical decoder parity and `OVOS_RELAY_ROOT` for bootstrap fixture parity.

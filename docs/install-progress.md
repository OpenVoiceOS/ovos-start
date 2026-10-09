Last Edit: Codex - 2026-10-08 - Motive: Remove the pre-install report notice from the interface.

# Installation follow-up

## Version 0.55.1: automatic wizard failure reports

Wizard-started installs automatically upload a filtered current-run failure report to the fixed paste service without a Terminal consent question. Standalone installer runs retain their consent prompt. After a successful upload, the failure screen displays the returned `https://paste.uoi.io/…` URL and **Copy link**. [`recoveryView`](../dist/post-install.mjs) retains Terminal guidance when upload is unavailable or invalid. [`errorReportUrl`](../dist/report-link.mjs) accepts only a direct HTTPS paste path; the wizard never fetches the report contents.

[`copyReportLink`](../dist/app.mjs) copies the exact validated URL, selects it if clipboard access fails, and ignores results from a previous attempt. [`InstallTracker`](../dist/install-progress.mjs) accepts optional metadata only on failure. The [launcher](../../ovos-start-launcher/docs/index.md) enables automatic reporting only for its tracked installer child, reads a private per-attempt descriptor receipt and sends failure plus URL in one callback; the [relay](../../ovos-install-status/docs/index.md) stores it under the existing owner scope and 24-hour deadline. A fresh install command is required; old sessions are not backfilled. [Rendering/tracker tests](../test/install-progress.test.mjs), [clipboard regressions](../test/copy.test.mjs), [proxy tests](../test/status-api.test.mjs).

## Version 0.44.0: reinstall or choose another device

[`progressView`](../dist/post-install.mjs) displays **Run the wizard again** beside the heading after `installed`, `services_ready` or `voice_ready`, even if voice verification is deferred or tracking becomes unavailable. It does not appear during active installation; stopped runs retain their existing retry flow.

[`restartWizard`](../dist/app.mjs) starts at language with confirmed choices retained. It allocates a distinct one-hour code, resets the prerequisite acknowledgement and navigation identity, pushes a separate history entry and leaves the old relay record untouched. The header home link uses the same operation but begins with the greeting. Neither operation copies or executes installation. An identical same-second code leaves the completed screen intact and asks the user to wait; invalid clocks cannot mint a new attempt.

[`InstallTracker.reset`](../dist/install-progress.mjs) stops timers, invalidates the request generation and clears connection/session state. Late old responses cannot replace the new attempt. The existing [relay contract](../../ovos-install-status/docs/index.md) and24-hour tracking lifetime are unchanged. [Navigation tests](../test/navigation.test.mjs) cover retained recipes, browser history/reload, guarded states and code identity; [tracker tests](../test/install-progress.test.mjs) cover asynchronous isolation. There are no Python runtime classes in this browser feature; the existing Python regression suite remains under [`test/`](../test/).

## Version 0.42.0 examples and next steps

The verification contract remains unchanged. `installed`/`services_ready` keep the terminal voice check primary; the user may open a clearly labeled future-example disclosure. `voice_ready` displays examples directly. Recipe-specific skills, integration and hub resources are available after successful installation, with no success guide after failure. See the [current post-install guide](post-install.md).

## Version 0.40.0 voice-verification contract

`installed` proves installer completion; `services_ready` proves expected service processes are running. Neither proves working audio. The browser shows a compact installation receipt and `pendingVoiceView` with the first Terminal menu action. A collapsed `checkCommandView` copies the existing checker for later use. `voice_ready`, sent after a user confirms a correct OVOS reply, expands the examples and reveals a check-again disclosure. Version0.42 also offers a closed future-example preview while the check remains pending.

`needs_attention` can mean deliberate deferral, no terminal, or a headless hub skipping local audio; it is not an installation failure and cannot prove whether the terminal is still open. Hubs get satellite/service guidance and no local voice-check prompt. Lost/expired tracking preserves the pending state and recovery command; only active tracking asks users to keep the page open. [State tests](../test/install-progress.test.mjs) and [checker `check_setup_inner`](../../ovos-start-launcher/lib/runtime.sh#L187) document these boundaries.

## Version 0.39.0 active progress

[`installationStages`](../dist/install-progress.mjs#L65) maps downloading/started to the first stage, installing to the second, and confirmed installed/service/voice receipts to completed stages. [`progressView`](../dist/post-install.mjs#L64) displays a compact rail and conditionally reports detailed current work for phase1–4. Phase0 has no unknown-row warning. The sidebar, completion fraction, generic time disclaimer and live badge are removed. Elapsed/qualified estimates update in place; polite live regions announce stage and task changes. Mobile uses a vertical rail for readable labels. The existing recovery and post-install behavior below remains unchanged.

## Version 0.38.0 recovery contract

[`recoveryView`](../dist/post-install.mjs#L33) handles confirmed `failed` and `cancelled` sessions before connection or attention rendering. It shows the device once, Terminal guidance, Matrix chat, a conditional retry explanation and collapsed checkpoint history. The normal command card, setup navigation and trivia hide through [`updateInstallProgress`](../dist/app.mjs#L582). A connection outage during installation retains the working state and reconnect action; it never exposes installer retry.

[`installationMilestones`](../dist/install-progress.mjs#L41) treats rank3 with missing/zero phase as coarse evidence: download is complete, but all later stages are unconfirmed. Granular phases retain earlier completion receipts, identify the last reported stage and leave later work unconfirmed after stopping. No stopped view displays a completion fraction, spinner, ETA or “Up next.”

[`retryInstallation`](../dist/app.mjs#L620) requires the current recipe’s failed/cancelled status, a valid clock and an explicit user action. It issues a different code with the same choices and a fresh one-hour deadline, then uses the normal connection/copy flow. It never executes installation, promises resumability or silently retries. Preview commands remain disabled; clipboard rejection exposes the selectable fallback. Tests: [checkpoint semantics](../test/install-progress.test.mjs), [retry/copy](../test/copy.test.mjs) and [visibility](../test/progress-placement.test.mjs).


## Version0.35.0 checkpoint and timing contract

Launcher2.3.0 adds fixed `stage_system`, `stage_packages`, `stage_services`, `stage_finalize` events through [`CallbackModule.v2_runner_on_ok`](../../ovos-start-launcher/lib/ansible_progress.py). Only successful role tasks emit phases; skipped tasks do not. Roles are mapped by identity rather than output. Ansible handlers cannot regress a phase. Service setup is not proof that services run, and only a zero setup exit emits `installed`.

The relay retains the stable `status=installing`, rank3 and a separate monotonic phase1–4, so older clients/launchers remain compatible. Failure preserves phase/rank; the browser shows the last confirmed phase rather than claiming an exact failing task. The stored detailed checkpoints cover downloading, preparation, packages, services and finalization; active display groups them into three stages. New hooks require a fresh launch; already-running older commands keep their coarse updates.

Migration0002 adds `phase` (constant0 default) and nullable `installed_at`; older successful rows are not backfilled with unreliable times. Completion time records the first accepted installed event and does not move with service/voice checks. `estimateFor` reads at most20 unexpired rows belonging to the same owner, matching device/model, RAM/CPU choices, method, speech, language, profile and skills. At least five durations are needed. Min/max observed totals minus elapsed produce a rounded minute range. Slow runs switch to a longer-than-recent-setups message; outages pause estimates. Prompts and callback delays are included, so this is guidance rather than a prediction guarantee. The existing24-hour lifetime and cleanup remain unchanged; no cross-user aggregates, new identifiers or indefinite history are stored.

`installationMilestones` and `installationTiming` are pure browser derivations with boundary tests. `timingView` updates separately to preserve focus, and the checklist’s polite live region announces changed checkpoints. Review and setup navigation hide for started, completed, failed and cancelled attempts and return only for a new waiting attempt.


Version0.34.2 uses explicit simulated status headings and [`generateDemoThumbnails`](../scripts/generate-demo-thumbnails.mjs) to bundle the original two JPEGs. This avoids a new image request after a connection loss. Live failed events still omit completion guidance. Launcher2.2.1 corrects installer dependency permissions without changing milestone semantics; see [launcher guide](../../ovos-start-launcher/docs/index.md).


The invite-only wizard uses a Worker for authenticated status creation and reads. The separate `ovos-install-status` Worker accepts narrowly scoped installer events. The wizard audience is unchanged. The callback endpoint requires public network reachability plus an unguessable write capability; the user explicitly approved its public access on 2026-10-07. The wizard remains restricted.

## Contract and ownership

[`server/worker.mjs:handle`](../server/worker.mjs#L26) requires the platform's authenticated user header, same-origin JSON and the configured secret `RELAY_ADMIN_KEY`. It derives a stable opaque owner HMAC; names and email addresses are not forwarded. Each owner/code has one durable relay session. Another viewer with the same recipe link gets their own session and cannot read its creator's installation.

The relay creates a random session ID, derives a 256-bit write capability and stores only its hash. Its admin credential stays in native hosting secrets. The browser receives its own short launch capability. The copied command uses `/s/CAPABILITY`; the resolver supplies the recipe and `--track TOKEN` to the pinned launcher. The callback write capability is excluded from browser session responses; no capability enters the recipe hash, draft, shared link, YAML or browser storage. It can remain in the target's shell history/argv, so do not share install commands publicly. The status-write capability cannot read status, execute commands on a device or change wizard choices. The launch capability retrieves only the fixed bootstrap for that recipe.

`POST /api/install` accepts exactly `{code}` to create/restore, or `{id}` to read. The server calls relay `POST /v1/sessions` or `/v1/session` with an opaque owner. `POST /v1/events` accepts exactly `{event}` and bearer capability. No free-form log, device identifier, password or endpoint URL is accepted. API responses are not cached. Rate limits bound each owner to20 live sessions and each token to120 accepted transitions; payloads are capped before decoding.

## Time and state

Recipe format stays v2 with its original one-hour start deadline. The relay also enforces that deadline for the first callback using server time. Once a session has started, progress can arrive until24 hours after session creation. Expired sessions are inaccessible; opportunistic, bounded deletion runs on session creation. This is an access deadline, not a promise that database bytes disappear at the exact expiry second.

Milestones are waiting → started → downloading → installing → installed → services_ready → voice_ready. Failures/cancellations before installation success are terminal for that attempt. Out-of-order/repeated events cannot regress progress. A private token-matching successful-install receipt lets the checker replay a lost installed event; mere service detection cannot manufacture installer success. An incomplete device check sets attention without turning installation into failure. Hub guidance expects a satellite rather than a microphone.

[`waitingView`](../dist/post-install.mjs) shows a highlighted status panel with a decorative activity ring and bold title before installation, with a reminder to keep this page open for progress. The reminder also appears during active installation and disappears for completion/errors. [`updateInstallProgress`](../dist/app.mjs) switches to the full status/guide only after a real milestone. [`installationStages`](../dist/install-progress.mjs) groups started/downloading as Preparing, installing as Installing, and confirmed installer success as Installed. [`progressView`](../dist/post-install.mjs) renders one visible heading, a decorative brand activity emblem and this three-stage list without percentages or inferred voice success. Installation help contains recovery and tracking explanations. [Placement regressions](../test/progress-placement.test.mjs) verify waiting, working, completed and failed states.

[`InstallTracker`](../dist/install-progress.mjs#L40) restores progress from the server on reload, polls without overlapping requests, ignores older snapshots and stops off-screen. Restoring the review page from browser Back resumes the same session without extending its deadline. Network failures preserve confirmed milestones and the phase headline, while a separate Reconnecting badge and retry button explain connection recovery. Expired tracking has no retry action. Expired tracking preserves access to the device checker. Failed/cancelled attempts offer an explicit new command and session rather than silently renewing or reusing the terminal attempt.

The installer sends a tiny JSON event to a fixed HTTPS origin with2-second connection and3-second total limits. Curl disables user config, does not follow redirects, sends the bearer on stdin and never executes a response. Tracking is best effort; network errors cannot change installer success/failure. A plain code-only command remains supported. Invalid/expired/32-bit preflight rejection cannot report a validated status; missing curl cannot report either. Terminal remains the source of detailed errors. See [launcher contract](../../ovos-start-launcher/docs/index.md) and [relay contract](../../ovos-install-status/docs/index.md).

## Post-install content

[`progressView`](../dist/post-install.mjs) keeps one useful first question, a copyable checker and two short video links. The view adapts to language, no-skills and hub choices.All12 UI catalogs contain911 matching keys. Exact time questions come from the [Date and Time skill at361d6bf](https://github.com/OpenVoiceOS/ovos-skill-date-time/tree/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale). Hindi has no verified native everyday-skill example in the checked upstream corpora; the Hindi UI offers device checks/community help rather than an invented working phrase. Kabyle uses upstream `D acu-t ssaɛa tura?`.

Official videos: [Coffee automation](https://www.youtube.com/watch?v=PRzGxmTCFb0) (Dutch,19seconds) and [GenAI assistant](https://www.youtube.com/watch?v=C_xS87EbsiM) (Dutch,45seconds). Original language is labeled; automatic YouTube captions may be available. These are inspiration with extra integrations, documented by the [official real-use article](https://blog.openvoiceos.org/posts/2025-07-25-A-real-use-case-with-OVOS-and-Hivemind). Its iframe titles were swapped; titles/language/duration were verified against the videos' metadata. Compact bundled thumbnails show the official full frames with play affordances. No automatic playback, third-party image request or external embed is loaded. See [asset provenance](assets.md).

## Validation and production

`npm test` includes [`install-progress.test.mjs`](../test/install-progress.test.mjs), [`status-api.test.mjs`](../test/status-api.test.mjs) and existing copy/navigation tests. Existing Python [`test_export_cleans_private_downloads`](../test/test_export_safety.py) checks current downloaded-script safety. Relay [`test_schema.py`](../../ovos-install-status/test/test_schema.py) uses `sqlite3.Connection` and the real Drizzle migration; service tests use actual SQLite prepared queries. No production Python class is introduced.

Build: `npm run build` retains browser sources in `dist/`, copies only public assets into `dist/client/`, and bundles the Worker into `dist/server/index.js`. `.openai/hosting.json` retains the existing project ID and removes static-only hosting. All runtime secrets are configured via Sites; `.env.example` has names only. Hosted callbacks and signed-in wizard polling were verified against the approved reachable relay. Server fetch uses manual redirects and rejects 3xx responses; browser requests never follow sign-in redirects. Browser previews simulate callbacks, are labeled and cannot export executable installation commands; no physical device was installed during QA.

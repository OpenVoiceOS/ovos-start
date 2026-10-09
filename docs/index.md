Last Edit: Codex - 2026-10-08 - Motive: Clarify standalone hosting requirements.

# OVOS Start developer guide

The wizard collects a validated recipe, requires acknowledgement of device prerequisites, then offers a short install command. The command field appears only when clipboard copying fails; there is no separate disclosure control. A small authenticated Worker proxies only session creation/status reads. Installation runs on the device through the separate [canonical v2 launcher](../../ovos-start-launcher/docs/index.md); the [relay](../../ovos-install-status/docs/index.md) owns durable progress. No Python package or OVOS plugin entry point exists in this repository.

## Source map

| Source | Responsibility |
| --- | --- |
| [`app.mjs`](../dist/app.mjs): `render`, `restore`, `restartWizard` | Four-stage navigation, saved choices, review and reinstall |
| [`journey.mjs`](../dist/journey.mjs): `nextQuestion`, `RECIPE_QUESTIONS` | Conditional questions and answered-recipe restoration |
| [`scenario.mjs`](../dist/scenario.mjs): `validateState`, `buildYaml` | Recipe schema and hardware compatibility |
| [`prerequisites.mjs`](../dist/prerequisites.mjs): `PrerequisiteGate` | Explicit device-specific readiness before copying/downloading |
| [`short-setup.mjs`](../dist/short-setup.mjs): `issueSetup`, `buildShortCommand`, `buildSetupScript` | Expiry and tracked executable exports |
| [`install-progress.mjs`](../dist/install-progress.mjs): `InstallTracker` | Bounded polling, monotonic snapshots and lifecycle isolation |
| [`report-link.mjs`](../dist/report-link.mjs): `errorReportUrl` | Validated failure report links, without loading log contents |
| [`i18n.mjs`](../dist/i18n.mjs): `loadLocale`, `applyTranslations` | On-demand catalogs, safe text and race handling |
| [`worker.mjs`](../server/worker.mjs): `handle`, `ownerKey` | Platform identity, same-origin checks and opaque owner scope |
| [`build-worker.mjs`](../scripts/build-worker.mjs): `buildSite` | One app bundle and explicit public output |

## Build and validation

Run `npm ci` when dependencies need installation, `npm test`, `python3 -m pytest test/ -q`, then `npm run build`. `npm start` serves readable source for local UI development; serve `dist/client` to inspect the production bundle. Local previews deliberately disable executable installation exports. The authenticated API is supplied by hosting.

This standalone export prepares the source and build only. [`handle`](../server/worker.mjs) currently trusts the identity header injected by Sites. On an independent host, a client could supply that header itself: do not deploy the Worker unchanged. Backend authentication and session handling must be adapted before public deployment.

The build publishes only the app bundle, early theme script, CSS, HTML, assets and locale catalogs. Source modules, unrelated top-level files and duplicate thumbnail JPEG inputs are excluded. Internal imports have no manual version suffixes; entry URLs and catalog fetches share the release version. [`build.test.mjs`](../test/build.test.mjs) builds an isolated copy with private sentinel files and verifies publication boundaries, dependency deduplication and fresh thumbnails.

[`page-lifecycle.test.mjs`](../test/page-lifecycle.test.mjs) executes real page handlers with `InstallTracker`, verifying resumed polling after Back without renewing the recipe. [`status-api.test.mjs`](../test/status-api.test.mjs) checks identity/origin, typed payloads, upstream failures and capability confinement. Python [`test_export_cleans_private_downloads`](../test/test_export_safety.py) executes generated downloads with fake curl under sh/Bash/Dash. Set `DASH_BIN`, `OVOS_LAUNCHER_ROOT` and `OVOS_RELAY_ROOT` for the optional cross-repository checks used in release validation.

## Guides

- [Preparation, hardware and acknowledgement](device-check.md)
- [Launch, expiry and transport limits](short-codes.md)
- [Speech and integrations](recommendations.md)
- [Progress and recovery](install-progress.md)
- [Post-install examples](post-install.md)
- [Localization](localization.md)
- [Asset provenance and licenses](assets.md)

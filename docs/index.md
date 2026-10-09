Last Edit: Codex - 2026-10-08 - Motive: Document the public wizard and self-hosted API.

# OVOS Start developer guide

The wizard collects a validated recipe, requires acknowledgement of device prerequisites, then offers a short install command. The command field appears only when clipboard copying fails; there is no separate disclosure control. GitHub Pages serves the public wizard. A small Node.js API stores installation progress in SQLite. Installation runs on the device through the separate [canonical v2 launcher](https://github.com/OpenVoiceOS/ovos-start-launcher). No Python package or OVOS plugin entry point exists in this repository.

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
| [`node-api.mjs`](../server/node-api.mjs): `createApi` | Browser credentials, CORS, owner isolation and request limits |
| [`node-database.mjs`](../server/node-database.mjs): `openDatabase` | Private SQLite storage and checked migrations |
| [`node-server.mjs`](../server/node-server.mjs): `start` | Bounded HTTP listener on loopback |
| [`build-site.mjs`](../scripts/build-site.mjs): `buildSite` | One app bundle and explicit public output |

## Build and validation

Use Node.js 24 LTS. Run `npm ci`, `npm test`, `python3 -m pytest test/ -q`, then `npm run build`. `npm start` serves readable source for local UI development; serve `dist/client` to inspect the production bundle. Local previews deliberately disable executable installation exports. The API runs separately; see [self-hosting](self-hosting.md).

The browser stores a random private credential in first-party storage and uses it to read only its own installation sessions. The API accepts the configured wizard origins, does not rely on third-party cookies, and ignores hosting identity headers. No server secret is included in the static build. Clearing browser storage loses access to previous progress; it does not affect installation on the device.

The build publishes only the app bundle, early theme script, CSS, HTML, assets and locale catalogs. Source modules, unrelated top-level files and duplicate thumbnail JPEG inputs are excluded. Internal imports have no manual version suffixes; entry URLs and catalog fetches share the release version. [`build.test.mjs`](../test/build.test.mjs) builds an isolated copy with private sentinel files and verifies publication boundaries, dependency deduplication and fresh thumbnails.

[`page-lifecycle.test.mjs`](../test/page-lifecycle.test.mjs) executes real page handlers with `InstallTracker`, verifying resumed polling after Back without renewing the recipe. [`node-api.test.mjs`](../test/node-api.test.mjs) checks browser ownership, CORS, callbacks, persistence, migrations and request limits. Python [`test_export_cleans_private_downloads`](../test/test_export_safety.py) executes generated downloads with fake curl under sh/Bash/Dash. Set `DASH_BIN`, `OVOS_LAUNCHER_ROOT` and `OVOS_RELAY_ROOT` for the optional cross-repository checks used in release validation.

## Guides

- [Deployment, configuration and backups](self-hosting.md)

- [Preparation, hardware and acknowledgement](device-check.md)
- [Launch, expiry and transport limits](short-codes.md)
- [Speech and integrations](recommendations.md)
- [Progress and recovery](install-progress.md)
- [Post-install examples](post-install.md)
- [Localization](localization.md)
- [Asset provenance and licenses](assets.md)

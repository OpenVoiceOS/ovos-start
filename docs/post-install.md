# Post-install starting points

Version **0.42.0** gives users examples and practical next actions after a successful installation. [`progressView` and `gettingStartedView`](../dist/post-install.mjs#L76) render the guide; [`starterExamples` and `nextSteps`](../dist/post-install-content.mjs#L17) choose content from the confirmed recipe.

## Verification and visibility

- `installed` and `services_ready` keep **Check your speaker and microphone** primary. Supported examples are available in a closed **Things to try after the voice check** disclosure.
- `voice_ready` displays the examples directly. This is the user's confirmed reply in the terminal checker, not browser measurement of audio.
- A hub receives satellite-pairing instructions and service checks, with no local microphone or wake-word prompt.
- Failed, cancelled and still-running installations receive no completion guide.

The unchanged shell [`check_setup_inner`](../../ovos-start-launcher/lib/runtime.sh#L187) emits `voice_ready` only after confirmation. The Python [`CallbackModule`](../../ovos-start-launcher/lib/ansible_progress.py#L62) reports installation phases, not microphone readiness. See the [launcher guide](../../ovos-start-launcher/docs/index.md) and [callback contract](install-progress.md).

## Examples and language coverage

[`STARTER_EXAMPLES`](../dist/starter-examples.mjs) stores **39 phrases** with immutable upstream intent-file URLs and line references. Time, date, timer and weather appear in English, French, German, Spanish, Italian, Dutch, Portuguese, Catalan and Galician. Basque includes time, date and weather. Hindi and Kabyle have no verified starter phrases in these reviewed skills and receive language-support guidance instead. A missing intent is not filled by translating an English command.

Reviewed source revisions:

| Skill | Source revision |
| --- | --- |
| Date/time | [361d6bfc](https://github.com/OpenVoiceOS/ovos-skill-date-time/tree/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale) |
| Alerts/timers | [7eb90b75](https://github.com/OpenVoiceOS/ovos-skill-alerts/tree/7eb90b758e32514ebf7f3deb659aa6709272a1a0/locale) |
| Weather | [796838f3](https://github.com/OpenVoiceOS/ovos-skill-weather/tree/796838f33ec7e0564a422c69925fa8ef8b1b78d3/locale) |

Examples use `lang` and `data-no-translate`, preserving source phrases while the surrounding labels follow the selected catalog. Weather explicitly needs internet and a configured location. A recipe without skills receives **Add your first skill** instead of unsupported default commands. AI and Home Assistant may still provide replies without the starter skills.

## Next actions and help

`nextSteps` offers skill discovery, selected Home Assistant/AI setup guides, and Matrix help. Descriptions ask the user to check integrations; they do not assert successful pairing or provider configuration. Hubs omit the local voice-integration cards and use the working [official satellite guide](https://openvoiceos.github.io/beta-technical-manual/satellites/). URLs are fixed reviewed constants rather than recipe-supplied destinations. Non-English pages warn that linked guides may be in English.

The existing **Copy check command** action exposes `sh "$HOME/.config/ovos-installer/check-setup.sh"` for the OVOS device. The browser never executes it. Optional disclosures and stable `data-progress-focus` keys preserve reading and keyboard context during tracking refreshes through [`preserveProgressInteraction`](../dist/progress-interaction.mjs).

The two demonstrations retain bundled YouTube thumbnails, explicit Dutch audio labels and the extra-integrations note. Their language is not inferred from the selected UI language.

## Verification

**229 Node + 24 pytest tests pass.** [Content tests](../test/post-install-content.test.mjs) cover provenance, all locales, recipe selection, verification boundaries and safe links; [interaction tests](../test/progress-interaction.test.mjs) cover retained focus across replacement. Local browser checks cover pending and verified states, dark/light themes, loaded thumbnails, hub/no-skills recipes and all 12 locales at 320px with no horizontal overflow. No real installation or device audio test was executed. Native-language and actual-device acceptance remain separate from these checks.

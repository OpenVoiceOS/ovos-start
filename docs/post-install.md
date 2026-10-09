Last Edit: Codex (GPT-6) - 2026-10-09 - Motive: Explain the first-question onboarding layout and verification boundaries.

# Post-install starting points

Version **0.64.0** makes **Try asking** one clear first conversation: say the wake word, wait for the listening sound, then ask the first reviewed question. The featured phrase is larger and centered; the remaining phrases sit below **More to try**. [`progressView`, `audioChecksView`, `gettingStartedView` and `spokenExampleView`](../dist/post-install.mjs) render the guide; [`starterExamples` and `nextSteps`](../dist/post-install-content.mjs) choose content from the confirmed recipe.

## Verification and visibility

- `installed` and `services_ready` keep **Check your speaker and microphone** primary. Supported examples are available in a closed **Try asking** panel with an **After your voice check** subtitle. The whole header is a native disclosure, with a voice icon, **Show examples** / **Hide examples** labels and a rotating chevron. Enter and Space toggle it. Keyboard focus stays visible; the action spans the panel on narrow screens.
- Any installed state with both current audio checks passed displays the examples directly beneath the congratulations. This is the user's confirmed reply in the terminal checker, not browser measurement of audio. A later unfinished or failed check keeps the examples in their optional disclosure while keeping the completed installation history hidden.
- A hub receives satellite-pairing instructions and service checks, with no local microphone or wake-word prompt.
- Failed, cancelled and still-running installations receive no completion guide.

The shell [`check_setup_inner`](https://github.com/OpenVoiceOS/ovos-start-launcher/blob/dev/lib/runtime.sh) emits separate speaker and microphone/voice results and sends `voice_ready` only after confirmation. An explicit failed check or probe error remains separate from installer success, and deferring does not fabricate an audio failure. The Python [`CallbackModule`](https://github.com/OpenVoiceOS/ovos-start-launcher/blob/dev/lib/ansible_progress.py) reports installation work, not microphone readiness. See the [launcher guide](https://github.com/OpenVoiceOS/ovos-start-launcher/blob/dev/docs/index.md) and [callback contract](install-progress.md).

## Examples and language coverage

[`STARTER_EXAMPLES`](../dist/starter-examples.mjs) stores **39 phrases** with immutable upstream intent-file URLs and line references. Time, date, timer and weather appear in English, French, German, Spanish, Italian, Dutch, Portuguese, Catalan and Galician. Basque includes time, date and weather. Hindi and Kabyle have no verified starter phrases in these reviewed skills and receive language-support guidance instead. A missing intent is not filled by translating an English command.

Reviewed source revisions:

| Skill | Source revision |
| --- | --- |
| Date/time | [361d6bfc](https://github.com/OpenVoiceOS/ovos-skill-date-time/tree/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale) |
| Alerts/timers | [7eb90b75](https://github.com/OpenVoiceOS/ovos-skill-alerts/tree/7eb90b758e32514ebf7f3deb659aa6709272a1a0/locale) |
| Weather | [796838f3](https://github.com/OpenVoiceOS/ovos-skill-weather/tree/796838f33ec7e0564a422c69925fa8ef8b1b78d3/locale) |

Examples use `lang` and `data-no-translate`, preserving source phrases while the surrounding labels follow the selected catalog. The first reviewed phrase is featured once; the remaining phrases form a semantic list with decorative icons. The supplementary grid fits the available examples, including two for Basque, and becomes a single column below 600 px. No numbered instructions, redundant category labels or button styling are used. Examples are spoken prompts, not buttons. The panel introduces the wake word once and retains the custom-wake-word hint. Weather explicitly needs internet and a configured location. A recipe without skills receives **Add your first skill** instead of unsupported default commands. AI and Home Assistant may still provide replies without the starter skills.

## Next actions and help

`nextSteps` offers skill discovery through [OVOS Klondike Mercantile](https://andlo.github.io/ovos-klondike-mercantile/), selected Home Assistant/AI setup guides, and Matrix help. `GUIDE_LINKS.skills` uses this same destination for **Find skills**, **Add your first skill** and language-specific skill guidance. Descriptions ask the user to check integrations; they do not assert successful pairing or provider configuration. Hubs omit the local voice-integration cards and use the working [official satellite guide](https://openvoiceos.github.io/beta-technical-manual/satellites/). URLs are fixed reviewed constants rather than recipe-supplied destinations. Non-English pages warn that linked guides may be in English.

The existing **Copy check command** action exposes `sh "$HOME/.config/ovos-installer/check-setup.sh"` for the OVOS device. The browser never executes it. Optional disclosures and stable `data-progress-focus` keys preserve reading and keyboard context during tracking refreshes through [`preserveProgressInteraction`](../dist/progress-interaction.mjs).

The two demonstrations retain bundled YouTube thumbnails, explicit Dutch audio labels and the extra-integrations note. Their language is not inferred from the selected UI language.

## Verification

Behavioral tests cover the wake-word → listening cue → featured question order, each phrase appearing exactly once, the absence of interactive phrase controls and redundant category labels, all supported language/count variants, and the native disclosure before audio passes. [Content tests](../test/post-install-content.test.mjs) cover provenance, all locales, recipe selection, verification boundaries and safe links; [interaction tests](../test/progress-interaction.test.mjs) cover retained focus across replacement. The 0.64.0 change passes 502 Node tests and 14 Python export tests. The production build and diff checks pass. Browser checks cover light/dark rendering, keyboard expansion, German mobile wrapping without horizontal overflow and preserved spoken-language text. No real installation or device audio test was executed. Native-language and actual-device acceptance remain separate from these checks.

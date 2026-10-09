Last Edit: Codex - 2026-10-08 - Motive: Fix links after moving repositories to OpenVoiceOS.

# Localization

[`selectLanguage`, `restore`, `localize`](../dist/app.mjs) use the same selected locale for the wizard interface and the assistant recipe. Browser language provides the initial suggestion; a saved setup link takes precedence. Changing the native language selector loads its bundled catalog and updates the current question, navigation, labels and feedback. Back, edit cancellation and reopened setup links retain the appropriate recipe language. There is no translation service or upload of setup data.

[`loadLocale`, `translateMessage`, `applyTranslations`](../dist/i18n.mjs) support the twelve presets in [`LANGUAGES`](../dist/scenario.mjs): English, French, German, Spanish, Italian, Dutch, Portuguese, Catalan, Basque, Galician, Hindi and Kabyle. Each catalog has 911 messages, including complete card descriptions and all 35 full trivia paragraphs. Version 0.31 retains the contextual review and adds preparation/recovery messages in every locale, including the review-only Skills editor and hardware questions before speech. Catalogs live in [`dist/locales`](../dist/locales/en-us.json). Only the selected non-English catalog is fetched, then cached for subsequent navigation. Failed loads can retry. A generation counter rejects stale language responses after another selection or navigation. Continue is disabled while its selection loads; restore stages a complete recipe and temporarily makes the old main content inert. [`i18n-races.test.mjs`](../test/i18n-races.test.mjs) executes these production functions against deferred requests.

Catalog keys are English source messages. Complete headings retain `<em>` emphasis so translations can reorder the sentence. Plain text is translated as a complete message where available, otherwise as separate sentences; short fragments next to links retain their DOM nodes. Named placeholders cover device names, stage numbers, expiry minutes and accessible edit labels. `validateCatalog` checks placeholder and emphasis-tag parity. Translated text never creates arbitrary HTML.

`applyTranslations` retains the original English source for persistent header/footer nodes. It recognizes fresh dynamic text after trivia refresh, expiry, appearance toggles or clipboard feedback and translates it again. The document language and title follow the UI. Endonym language options, commands, YAML, URLs, provider identifiers and the decorative OVOS/TRIVIA stamp are preserved. The Mark I greeting is the requested English Mimic 1 recording; its visible transcript has `lang="en"` and is exempt from translation.

## Write for the decision on screen

Read the source in [`languageView`, `guidanceView`, `experienceView`, `speechView`, `skillsView`, `homeAssistantView`, `aiView` and `resultView`](../dist/app.mjs), together with [`reviewChoices`](../dist/handoff.mjs) and [`localSpeechOption` / `localModelGuidance`](../dist/recommendations.mjs). Questions, cards and their follow-up behavior provide the context; the English key alone is insufficient.

| Context | Meaning to preserve |
| --- | --- |
| Guidance vs intended use | Guidance asks how much help the visitor wants; purpose asks what their assistant will do. The review label **Use** is a noun. |
| Skills | Installed assistant functions/plugins, not a person’s abilities. Prefer understandable native terminology; retain ecosystem names where useful. French choices use *fonctions*, while named historical plugins are *extensions*. |
| Local vs online speech | Speech processing is distinct from voice style. The online fallback is a service that may receive voice audio, not a storage backup. Do not imply guaranteed offline operation. |
| AI | Optional. A compatible existing service, model and access details are required only when adding AI. The wizard does not install an AI model. |
| Diagnostics | Consent to share installation diagnostics, not general voice/data privacy and not a thank-you response. Voice-usage telemetry stays off. |
| Review and handoff | A saved setup/configuration, not a cooking recipe. Commands expire after one hour; keep deadlines, device names and copy status clear. |
| Trivia | Preserve people, dates, contributions and source links. Adapt or drop awkward wordplay without creating a new factual claim. The printed satellite **shell** is an enclosure, not a command interpreter. |

Use a consistent register within each language, concise action labels, and natural questions. Complete paragraphs may combine or reorder sentences. French uses *vous*; the other catalogs follow their chosen local register rather than copying English pronouns mechanically. Keep technical requirements accurate even when simplifying the explanation.

Prefer a whole-message entry when a card needs grammatical restructuring. Such entries override fragments, so update both if the underlying meaning changes. `platformView` now renders the target-system instruction as one complete text node, without embedded emphasis that would constrain word order. It does not infer the installation device from the browsing computer. Names inserted through `{device}` use grammar-neutral constructions where declension would otherwise fail.

## Maintaining translations

Add messages to `en-us.json` and every other catalog. Preserve `{named}` placeholders, technical names and the meaning of privacy/compatibility notices. Run `npm test`: [`i18n.test.mjs`](../test/i18n.test.mjs) verifies complete key coverage, token/markup validation, whole-description precedence, all full trivia messages, unsplit target-system instructions, compatibility/expiry tokens, source retention, dynamic substitutions, retry behavior and recipe round trips for every language. [`test_export_cleans_private_downloads`](../test/test_export_safety.py) verifies generated installer scripts independently; translation must never alter executable data. The [public launcher documentation](https://github.com/OpenVoiceOS/ovos-start-launcher/blob/dev/docs/index.md) defines its separate code/expiry contract.

These translations received an AI contextual review, with all twelve locales exercised in the browser through language editing, speech choices and review at phone width. The French guided journey was also inspected from language to handoff. Automated checks and browser rendering are not native-speaker certification. Basque and especially Kabyle still need fluent community review of technical vocabulary and retained trivia; Catalan/Galician regional wording would also benefit from community review. Contribute corrections directly to the relevant catalog; factual trivia sources remain linked in [`PROJECT_FACTS`](../dist/facts.mjs).

## Stable selection and terminal recovery

The native chooser previews a loaded language in place while retaining its DOM node and keyboard focus; Continue advances the journey. Browser-source wording updates with the choice. Launcher2.1.0 carries the same recipe locale into all50 launcher-owned prompts, validation and reboot checks. Upstream installer output may remain English. New Chrome checks render all12 handoff/expanded-review/AI screens at measured320px without horizontal page overflow; this is layout evidence, not linguistic approval.

Version 0.31.1 adds ordinary Continue navigation and contextual processor lookup/example/fallback wording to all twelve catalogs. Preserve brand names and exact feature tokens inside technical help; never translate a tentative family choice into a guarantee of device support.

## Compact handoff

[`translateMessage`](../dist/i18n.mjs) prefers the longest literal template when multiple placeholder keys match. This prevents the generic device-terminal sentence from consuming the new full paste instruction. [Tests](../test/i18n.test.mjs) exercise the actual twelve catalogs; native-speaker review remains advisable.

The keep-open reminder is translated as a reason to retain the browser page for progress; it does not state that closing it cancels installation. [`waitingView`](../dist/post-install.mjs) and [`progressView`](../dist/post-install.mjs) use the same message.

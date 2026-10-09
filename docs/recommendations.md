Last Edit: Codex - 2026-10-08 - Motive: Fix links after moving repositories to OpenVoiceOS.

# Adaptive setup contract

## One question at a time

[`nextQuestion`](../dist/journey.mjs) sequences Language, Device, Speech and Install, asking hardware details only when relevant. Guidance, purpose, Home Assistant and AI are optional review edits. Starter skills are derived from the earlier profile and are edited only on demand from review. The four-stage indicator groups questions rather than promising a fixed question count. Card answers advance after a short reaction; reduced motion removes the delay. Language confirmation uses one button.

Device details precede speech choices through [`firstCapability` / `afterCapability`](../dist/journey.mjs): Pi generation and memory are separate questions. Known Pi/Jetson boards skip CPU identification; general computers and Macs retain their relevant processor questions. Unknown is an answer, never an unfinished field. Unknown or unsupported answers stop the branch at the speech choices, where [`localSpeechOption`](../dist/recommendations.mjs) disables local speech and explains why. Change my device details revisits the questions. An enabled speech choice advances directly; no separate result screen or automatic acceptance remains. Headless hubs skip speech and unsupported integrations. Navigation state is separate from the version-2 recipe.

[`go`, `back`, `cancelEdit`](../dist/app.mjs) retain the actual visited platform/capability screens, preserve answers on Back and restore the prior recipe when edits are cancelled. Editing one review row returns directly to review unless device compatibility needs another decision. [Journey tests](../test/journey.test.mjs) cover these transitions and normalization; [canonical Python terminal fixtures](https://github.com/OpenVoiceOS/ovos-start-launcher/blob/dev/test/test_launcher.py) verify the maintained target launcher.

[`browserLanguages`](../dist/recommendations.mjs) filters browser preferences and falls back to `navigator.language` when the list is empty. [`suggestLanguage`](../dist/recommendations.mjs) walks them in preference order, trying an exact locale and then a supported language-family match for each preference. [`languageSource`](../dist/recommendations.mjs) labels exact matches as detected, regional matches as suggested, unmatched English as a starting point, and saved/confirmed selections as chosen.

[`languageView`, `selectLanguage` and `restore`](../dist/app.mjs) show the suggested or saved language with Continue and an optional labelled 12-language native selector. Selecting an alternative closes the chooser and focuses Continue; only confirmation advances. Incompatible local speech changes to public, and cancelling a review edit restores the complete previous recipe. The interface uses a single question column without a companion scene. The selected locale also translates the wizard UI through the bundled [catalogs](localization.md). Hardware is selected explicitly; the browser can be running on a different computer.

[`recommend`, `speechEligibility`, `localModelGuidance`](../dist/recommendations.mjs) explain their recommendation. New users start with everyday skills; experts and the tinkering purpose start empty. [`applySkillDefaults`](../dist/flow.mjs) preserves explicitly chosen/restored bundles when profile preferences change and reapplies defaults only when they were inferred. Optional connections remain opt-in. [`chooseSpeech`](../dist/flow.mjs) enforces local-speech method/channel requirements and releases the channel override when leaving local speech.

## Speech evidence and limits

Working reference: open [ovos-installer PR #648](https://github.com/OpenVoiceOS/ovos-installer/pull/648), reviewed/pinned commit `6ffd465028bac299e5235d619819bfdc734af073`. Main `cb6b10bdc6feee191d6ed3e58aaa96c854f8c2b1` does not recognize `speech_engine`. Explicit public/local choices use the preview; current-installer defaults omit this field.

The preview couples STT and TTS under `speech_engine: local|public`. It supports local speech on alpha + virtualenv audio profiles, at least 7680 MiB usable RAM, and AVX2 x86-64 or NEON ARM64. Pi requires 5 / 500 / Compute Module 5; older Pi and Mycroft enclosures are excluded. Native Mac requires Apple Silicon for local speech. Hindi/Kabyle currently stay public in the available language list. Unknown CPU/RAM stays public until confirmed.

Sources: [`utils/speech.sh`](https://github.com/OpenVoiceOS/ovos-installer/blob/6ffd465028bac299e5235d619819bfdc734af073/utils/speech.sh#L42), [`utils/scenario.sh`](https://github.com/OpenVoiceOS/ovos-installer/blob/6ffd465028bac299e5235d619819bfdc734af073/utils/scenario.sh#L163), [speech configuration role](https://github.com/OpenVoiceOS/ovos-installer/blob/6ffd465028bac299e5235d619819bfdc734af073/ansible/roles/ovos_config/tasks/speech.yml#L9).

Local uses onnx-asr + phoonnx with models chosen by the installed configuration. **Public STT remains a fallback.** The UI keeps audio/text data sharing, internet needs and memory/model downloads visible in plain language. Technical/provider details and performance limits are in a disclosure. Target checks can override recommendations. Skill internet requests and online AI are independent of speech processing.

## Platform routes

| Target | Wizard handoff |
| --- | --- |
| Linux PC or supported board | Supported Linux terminal, microphone/speaker for voice |
| macOS | Native Intel/Apple Silicon, Homebrew PATH, Bash 4+, Xcode command-line tools, microphone permission; virtualenv + alpha |
| Windows | Ubuntu in WSL2, explicit `[boot]` / `systemd=true`, WSLg audio for voice; command runs in Ubuntu |
| Unlisted device | OS question; other Linux requires supported-system confirmation |
| Unknown system | Compatibility resources, no invented installation command |

See [ovos-installer: macOS](https://github.com/OpenVoiceOS/ovos-installer/blob/cb6b10bdc6feee191d6ed3e58aaa96c854f8c2b1/docs/macos.md), [supported systems](https://github.com/OpenVoiceOS/ovos-installer/blob/cb6b10bdc6feee191d6ed3e58aaa96c854f8c2b1/docs/supported-systems.md), [Microsoft WSL install](https://learn.microsoft.com/en-us/windows/wsl/install) and [systemd](https://learn.microsoft.com/en-us/windows/wsl/systemd). Virtualenv-only Windows is the wizard's scoped preset, not an upstream container prohibition.

## Skills, Home Assistant and AI

Everyday skills map to the upstream essential/internet/audio bundles; server excludes audio. Extras map to media and dad jokes. Empty disables both flags. These alternatives are available in the final review Skills editor, rather than a mandatory question. This is bundle selection, not an invented per-skill installation API. Container server extras are unavailable.

Home Assistant connects an existing server. AI fallback connects an existing OpenAI-compatible endpoint, local or online; it does not provision an LLM/Ollama. Smaller devices are directed to a model server on another capable computer. The headless `server` profile does not offer these integrations.

Scenario mode skips upstream's full TUI, so feature flags alone would never collect missing credentials. The [canonical v2 launcher](https://github.com/OpenVoiceOS/ovos-start-launcher/blob/dev/lib/launcher.sh.in) provides target-terminal code that prompts for URL/key/model, exports `HOMEASSISTANT_URL`, `HOMEASSISTANT_API_KEY`, `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL` and explicit voice-friendly LLM defaults. No top-level LLM YAML section overrides that environment. See [ovos-installer: automation](https://github.com/OpenVoiceOS/ovos-installer/blob/cb6b10bdc6feee191d6ed3e58aaa96c854f8c2b1/docs/automation.md).

Tokens are read as literal data with echo disabled before the prompt. They never enter browser state, URLs, generated YAML or command-line arguments. URLs/models also stay out of shared presets. Validation failures preserve the active scenario. The upstream installer necessarily receives/stores service configuration on the target device.

## Preview launch and verification

The wrapper fetches the exact preview commit into a private temporary checkout and invokes its `setup.sh` through Bash 4+, carrying `RUN_AS` and `RUN_AS_HOME`. It does not run the preview bootstrap that would clone main. Privileged cleanup removes only the known temporary source subtree after setup exits. Existing scenario backups and checkout guards remain.

The canonical Python [`Sandbox` and launcher tests](https://github.com/OpenVoiceOS/ovos-start-launcher/blob/dev/test/test_launcher.py) exercise target preflight, private prompts and failure propagation using fake installers. No production Python class exists in the wizard.

PR status was rechecked on 2026-10-07: #648 remains draft. Its head now contains changes beyond the wizard’s reviewed pin. This UI-only revision keeps the pinned contract unchanged; it does not claim to implement the latest head’s expanded language/container behavior.

## Version 0.18: universal 64-bit prerequisite

The wizard requires a 64-bit operating system for every install, independent of speech mode. The [canonical launcher preflight](https://github.com/OpenVoiceOS/ovos-start-launcher/blob/dev/lib/launcher.sh.in#L27) checks `getconf LONG_BIT` before downloads, privilege escalation or configuration writes. Empty, 32-bit and failed probes stop. This is enforced by the wizard launcher: upstream [method handling](https://github.com/OpenVoiceOS/ovos-installer/blob/main/tui/methods.sh) still contains 32-bit virtualenv behavior, and the [pinned speech guard](https://github.com/OpenVoiceOS/ovos-installer/blob/6ffd465028bac299e5235d619819bfdc734af073/utils/speech.sh#L38-L52) applies its own 64-bit check to local speech.

[`chooseCapability`](../dist/flow.mjs) derives ARM64 hardware capability from selected Pi/Jetson cards after memory is answered; it does not detect or assert the installed OS. Existing saved links remain conservative until their answers are revisited. [`afterCapability`](../dist/journey.mjs) skips the redundant board CPU question. Pi 3/4/400 are named explicitly instead of implying that every earlier Pi is supported. [`compatibility`](../dist/scenario.mjs) states 64-bit in every target handoff.

The canonical Python [`Sandbox` and launcher tests](https://github.com/OpenVoiceOS/ovos-start-launcher/blob/dev/test/test_launcher.py) exercise target preflight, private prompts and failure propagation using fake installers. No production Python class exists in the wizard.

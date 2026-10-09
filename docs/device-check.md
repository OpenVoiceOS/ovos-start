Last Edit: Codex - 2026-10-08 - Motive: Fix links after moving repositories to OpenVoiceOS.

## Shared behavior across all hardware

[DEVICES](../dist/scenario.mjs#L5) defines ten hardware targets, all rendered by [resultView](../dist/app.mjs#L358) with [deviceIcon](../dist/icons.mjs#L160) and [setupSummary](../dist/handoff.mjs#L52). Every target shares the identity/readiness header, editable feature grid and command-associated expiry. Only recipe-specific content changes: hubs omit voice-only features; Mac preparation uses its own tools; Windows installs through Ubuntu WSL2; fixed-system devices retain their required OS.

[Matrix regressions](../test/views.test.mjs#L66) enumerate every supported hardware/use combination with minimal, standard and extended features. [Hardware-transition tests](../test/views.test.mjs#L117) ensure changing the target cannot reuse acknowledgement, even when both devices use the same OS. Copy-request-only command visibility and explicit prerequisite acceptance apply everywhere.

## Structured setup summary (0.52.0)

After prerequisite acceptance, [resultView](../dist/app.mjs#L358) shows one editable device icon/name/language block and the translated **Tools confirmed** preparation-review button. This status reflects the user's acknowledgement; it does not claim automatic package detection. Reviewing preparation clears acknowledgement before installer access is restored.

[setupSummary](../dist/handoff.mjs#L52) supplies enabled features as editable icon/category/value cells. All meaning is visible; obsolete hover hints are removed. [Summary styles](../dist/style.css#L970) use four or fewer columns on desktop, two on phones and one below 350px, with wrapping labels and visible focus. [updateExpiry](../dist/app.mjs#L623) now updates the same status element beneath the copy button, associating expiry with the command.

[View tests](../test/views.test.mjs) verify category/value labels, edit destinations, a single preparation control, and expiry placement; [prerequisite tests](../test/prerequisites.test.mjs) retain command gating and translated labels. Language and every setting remain available in full setup review.

## Visible requirement emphasis (0.50.3)

[preparationView](../dist/app.mjs#L254) keeps the required system image visible before Continue. [Requirement styles](../dist/style.css#L830) distinguish it with theme-specific amber colors and a 3px inline-start edge. Existing text/icon provide meaning independently of color. [Theme tests](../test/theme.test.mjs) verify text and icon contrast in explicit light/dark and automatic dark; wording and readiness gates are unchanged.

## Direct fixed-system display (0.50.2)

[fixedSystemFor](../dist/distributions.mjs#L36) resolves Debian 13 for Mark I/II/DevKit and Ubuntu (WSL2) for Windows. [distributionPicker](../dist/prerequisites.mjs#L76) renders a static logo/name rather than a combobox for these presets. The preparation command and OS help are available immediately. This supersedes the explicit singleton selection described in historical entries below.

[PrerequisiteGate.selectDevice](../dist/prerequisites.mjs#L29) sets the fixed requirement without setting confirmed or accepted. Same-device renders preserve acknowledgement; changing hardware clears it even when both devices require Debian. Invalid selections clear acceptance, and rendering restores the fixed requirement without checking the box. General Linux still requires an explicit OS choice; macOS retains its own tools. [Preparation tests](../test/prerequisites.test.mjs) and [view tests](../test/views.test.mjs) cover the command boundary.

## Mark I and Mark II menu contract (0.50.1)

[distributionPicker](../dist/prerequisites.mjs#L76) renders exactly **Debian 13** for these two devices, without Other. Selecting it remains explicit; the tools checkbox remains a separate required action. [PrerequisiteGate.selectFamily](../dist/prerequisites.mjs#L34) clears readiness for unsupported selections. Other hardware retains its existing menu. [Preparation tests](../test/prerequisites.test.mjs) and [keyboard tests](../test/distro-picker.test.mjs) cover these boundaries. The Other guidance below applies only to devices whose menu includes that option.

## Pending confirmation and Mark presets (0.50.0)

The enabled unchecked control breathes red; checking it stops the halo and shows a green check. Reduced motion retains a static halo, and disabled controls remain neutral. [distributionsFor](../dist/distributions.mjs#L26) now offers Debian 13 for Mark I, Mark II and DevKit. Mark I text uses no Pi 4 assumption. This is a wizard restriction and leaves upstream runtime policy unchanged. [Preparation tests](../test/prerequisites.test.mjs) verify older Mark I selections cannot unlock installation.

## Concise acknowledgement (0.49.2)

[prerequisitesView](../dist/prerequisites.mjs#L84) shows one short installed-tools checkbox label. Its decorative halo breathes only while the native checkbox is enabled and unchecked. Keyboard focus remains visible; reduced motion uses a steady halo and forced colors exposes the native control. Confirmation and **Show install command** are still separate deliberate actions. Generic help links directly to support; Fedora-family curl-minimal recovery stays collapsed until requested. Repeated instructional text and generic system-administration paragraphs are removed. [Preparation regressions](../test/prerequisites.test.mjs) cover the contract; the installed-tools acknowledgement is not automatic verification.

## Version 0.49.0: consistent command copying

[commandBlock](../dist/prerequisites.mjs#L20) renders each preparation command inside selectable pre/code markup with its own **Copy** button. Package installation, cat /etc/os-release, the Fedora conflict workaround and both Mac commands share the component. The redundant Linux package list and large resizable field are removed; one target-specific instruction remains.

[copyPrerequisites](../dist/app.mjs) copies only the selected code.textContent. A successful browser write changes the button to **Copied** and updates a polite status. Missing/denied clipboard access invokes [revealCopyFallback](../dist/handoff.mjs#L66), selecting only the command through the owner document’s Range/Selection API. Copying, manual selection and copy feedback never acknowledge installed tools or unlock the installer.

Preview copying permits only the exact read-only system-identification command. Package, recovery and Mac preparation copying remain disabled. The supported-system checkbox and separate handoff action are unchanged. [Renderer](../test/prerequisites.test.mjs), [copy](../test/copy.test.mjs) and [manual-selection](../test/handoff.test.mjs) tests pass. Overall verification: **327 Node +24 pytest**; local browser review covers desktop and320px light appearance.


## Version 0.48.0: named systems and supported versions

[`DISTRIBUTIONS` and `distributionsFor`](../dist/distributions.mjs) expose 18 named Linux choices with the version floors or rolling-release status documented by the installer. Linux Mint remains supported. KDE neon, Pop!_OS and Zorin OS now appear explicitly, and openSUSE Leap, Slowroll and Tumbleweed have separate choices. The CentOS label follows upstream's matrix. A generic openSUSE selection no longer grants access to installation.

All choices require a **64-bit operating system**. The browser shows the documented release floor; it does not ask a separate version question, inspect the target, or verify a user's installed release. The Linux acknowledgement now confirms both a supported system and installed tools.

| Distribution | Supported version shown | Package family |
| --- | --- | --- |
| Debian | 10+ | APT |
| Ubuntu | 20.04+ | APT |
| Linux Mint | 21+ | APT |
| Raspberry Pi OS | 11+ | APT |
| Fedora | 37+ | DNF |
| Rocky Linux | 8+ | DNF |
| AlmaLinux | 8+ | DNF |
| CentOS | 8+ | DNF |
| Arch Linux | Rolling release | Pacman |
| Manjaro | Rolling release | Pacman |
| EndeavourOS | Rolling release | Pacman |
| CachyOS | Rolling release | Pacman |
| KDE neon | 20.04+ | APT |
| Pop!_OS | 22.04+ | APT |
| Zorin OS | 16+ | APT |
| openSUSE Leap | 15+ | Zypper |
| openSUSE Slowroll | Rolling release | Zypper |
| openSUSE Tumbleweed | Rolling release | Zypper |

These entries match the Linux matrix in both [current main as checked on 2026-10-08, commit `07729ad81b0dc0c7c9308322bb763235bb8a2dd3`](https://github.com/OpenVoiceOS/ovos-installer/blob/07729ad81b0dc0c7c9308322bb763235bb8a2dd3/docs/supported-systems.md) and the [speech/Mac preview, commit `6ffd465028bac299e5235d619819bfdc734af073`](https://github.com/OpenVoiceOS/ovos-installer/blob/6ffd465028bac299e5235d619819bfdc734af073/docs/supported-systems.md). [`test/fixtures/supported-systems.json`](../test/fixtures/supported-systems.json) preserves the source matrix for [`prerequisites.test.mjs`](../test/prerequisites.test.mjs).

Upstream also lists Raspbian 10 and WSL2 20.04. The wizard omits the legacy 32-bit Raspbian route to preserve its 64-bit contract. WSL2 has a dedicated Windows choice, labelled **Ubuntu (WSL2), 20.04+**, following the Ubuntu floor; upstream's WSL2 row specifically records 20.04. Raspberry Pi OS refers to its 64-bit edition and maps to Debian's package path. The matrix does not establish that every listed distribution supplies an image for every Pi or ARM device.

[`bindDistroPicker`](../dist/distro-picker.mjs) controls a select-only combobox: Left/Right move one item, Up/Down follow the responsive row, Home/End and typeahead locate choices, Enter/Space select, and Escape/Tab cancel tentative navigation. Desktop uses two columns; phones use one. Version labels accompany the names in both the selected value and option list. Brand names and numeric versions stay literal; “Rolling release” and guidance are translated in all 12 catalogs. Changing a distribution always clears acknowledgement, even when the command stays the same.

The required checkbox glows only while enabled and unchecked. Reduced-motion preferences remove animation while retaining the highlight. Confirmation and the separate continue action remain mandatory. Mac users finish Homebrew’s Next steps before `brew install bash`; missing sudo requires administrator help. Immutable systems use **Other / I’m not sure** rather than these standard package commands. [Command failure tests](../test/prerequisite-commands.test.mjs) use stub package managers and never install software.

## Required preparation before installation

[`resultView`](../dist/app.mjs) first renders [`prerequisitePageView`](../dist/app.mjs), a separate **Before you install** screen. It contains the chosen device artwork, OS selector, matching prerequisite instructions, a prominent unchecked acknowledgement and **Show install command**. Installer copying, manual command text, paste guidance, script export and the setup-details disclosure are absent until acceptance.

Every Linux target starts with an empty OS selection. Select the system on the OVOS device, not the computer displaying the browser. Generic Linux and Pi paths map the selected distribution to one of these preparation commands:

| Actual system family | Preparation command |
| --- | --- |
| Debian / Ubuntu / Linux Mint / Raspberry Pi OS / KDE neon / Pop!_OS / Zorin OS | `sudo apt update && sudo apt install curl git sudo bash` |
| Fedora / Rocky / AlmaLinux / CentOS | `sudo dnf install curl git sudo bash` |
| Arch / Manjaro / EndeavourOS / CachyOS | `sudo pacman -Syu --needed curl git sudo bash` |
| openSUSE Leap / Slowroll / Tumbleweed | `sudo zypper refresh && sudo zypper install curl git sudo bash` |

**Other / I’m not sure** displays `cat /etc/os-release` and the pinned [supported-systems guide](https://github.com/OpenVoiceOS/ovos-installer/blob/6ffd465028bac299e5235d619819bfdc734af073/docs/supported-systems.md), and keeps acknowledgement/continuation disabled. Package-manager availability alone does not prove installer compatibility. The installer’s [`required_packages`](https://github.com/OpenVoiceOS/ovos-installer/blob/07729ad81b0dc0c7c9308322bb763235bb8a2dd3/utils/common.sh#L997) accepts named `/etc/os-release` IDs; `ID_LIKE` does not admit arbitrary derivatives. That function does not enforce the general version floors in the table. The user must confirm an appropriate release; a successful package command does not establish that the release meets the matrix.

[`distributionsFor`](../dist/distributions.mjs) narrows specific hardware presets:

- **Mark I:** 64-bit Debian 13, following the requested wizard restriction. [`compatibility`](../dist/scenario.mjs) and all visible guidance match. Generic Debian 10+, the old Debian 11+ selection and other distribution choices cannot unlock this preset.
- **Mark II and DevKit:** Debian 13 only, on Raspberry Pi 4, with virtualenv and alpha. [`enforce_mark2_devkit_trixie_requirement`](https://github.com/OpenVoiceOS/ovos-installer/blob/6ffd465028bac299e5235d619819bfdc734af073/utils/common.sh#L1895) rejects another OS when the installer detects this hardware. Its [GUI assertions](https://github.com/OpenVoiceOS/ovos-installer/blob/07729ad81b0dc0c7c9308322bb763235bb8a2dd3/ansible/roles/ovos_installer/tasks/assert.yml#L20) require Debian 13, Pi 4 and the `tas5806` codec.
- **Windows:** Ubuntu 20.04+ in WSL2, with the preparation command run in Ubuntu, not PowerShell. [`wsl2_requirements`](https://github.com/OpenVoiceOS/ovos-installer/blob/07729ad81b0dc0c7c9308322bb763235bb8a2dd3/utils/common.sh#L1585) checks for `systemd=true`; voice also needs working microphone and speaker forwarding through WSLg.

Hardware presets never assert that an OS was detected. macOS instead presents Xcode Command Line Tools, Homebrew and Bash 4+ instructions, plus the [pinned Mac guide](https://github.com/OpenVoiceOS/ovos-installer/blob/6ffd465028bac299e5235d619819bfdc734af073/docs/macos.md).

Arch's command updates the system as well as installing tools; the page says so, avoiding unsupported [partial upgrades](https://wiki.archlinux.org/title/System_maintenance#Partial_upgrades_are_unsupported). DNF now uses plain package names. If its error specifically says the already-installed curl-minimal conflicts with curl, the Fedora-family Installation help instructs the user to retain that variant and run **sudo dnf install git sudo bash**. This recovery is not appropriate for other dependency or permission failures. No removal flag or automatic retry is added. [DNF name matching](https://dnf5.readthedocs.io/en/latest/misc/specs.7.html#packages) explains why the installed provider may not satisfy the plain full-package request. openSUSE uses an explicit [repository refresh](https://manpages.opensuse.org/Tumbleweed/zypper/zypper.8.en.html) before installation; `&&` stops after a failed refresh. Missing sudo/access-denied help directs users to their administrator to install tools and enable sudo for their account. The OVOS command itself runs as the normal user.

### Required actions and export boundaries

[`PrerequisiteGate`](../dist/prerequisites.mjs) keeps OS choice, `confirmed` and `accepted` separate in memory:

1. Select a target-compatible system and complete preparation on the device.
2. On Linux, check **I’m using a supported system, and the required tools are installed.** Mac retains **I’ve installed the required tools on this device.** This enables the next action only.
3. Choose **Show install command**. [`continueToInstall`](../dist/app.mjs) accepts the gate and renders the installation handoff.

Copying preparation does not acknowledge readiness. [`reviewPrerequisites`](../dist/app.mjs) returns to preparation and clears acceptance. Device/system changes, reload, another setup code and a new completed-journey restart also clear confirmation. A failed retry can retain acknowledgement within its existing live target context; reopening a failed run first requires preparation. Neither links nor drafts persist acceptance.

[`copy`](../dist/app.mjs) and [`download`](../dist/app.mjs) check readiness before and after asynchronous tracker creation. [`updateExpiry`](../dist/app.mjs) updates the preparation Continue state even when no installer elements exist. Status viewing remains available for an already started/completed session; callbacks do not reveal commands or acknowledge packages.

The browser cannot inspect target packages. These are user confirmations; installation checks still run on the device. Preview mode permits reviewing this flow and copying only the exact read-only cat /etc/os-release command; installer and package-changing command copying remain disabled. No package or installer command runs in the browser.

**Version 0.48.0 verification:** **314 Node + 24 pytest tests pass**. [`test/prerequisites.test.mjs`](../test/prerequisites.test.mjs) checks the 18-entry table against the captured upstream matrix, exact version labels, all named package-family mappings, Mark I restrictions, Mark II/DevKit/WSL gates, and the five new messages in all 12 catalogs. [View tests](../test/views.test.mjs) cover absent exports and two-action transitions; [copy tests](../test/copy.test.mjs) cover synchronous/asynchronous guards and Continue; [i18n tests](../test/i18n.test.mjs) protect literal values while translating UI labels; [navigation tests](../test/navigation.test.mjs) cover reset boundaries. No physical installation was run.

Earlier preparation-page browser QA covered all 12 locales at 390px, German at 320px, Fedora/Arch/unknown/Mark II paths, separate acknowledgement/continuation and active/completed status resumption. These historical checks are distinct from the current automated matrix tests. Python fixtures under [`test/`](../test/) are unchanged; this UI has no Python runtime classes.

## Edit setup before preparation

On a shared or restored setup without earlier question history, **Edit setup** opens [setupEditorView](../dist/app.mjs#L353). It reuses [reviewOptionsView](../dist/app.mjs#L338) to expose device, language, speech, skills, use, integrations and advanced settings. No installer command or executable download is granted. Cancel edit restores the recipe; Continue uses [reviewPrerequisites](../dist/app.mjs#L329) to return to preparation with acknowledgement cleared. Existing browser history remains available.

Current local browser checks verified this original history-free trigger, integration edit/cancel, return to preparation, keyboard selection, reset after distribution changes, all logo loads, both themes and a 320px layout without horizontal overflow. [Navigation tests](../test/navigation.test.mjs) also verify shared-link identity and cancellation baselines.

## Concise device readiness earlier in the journey

[`preparationView`](../dist/app.mjs) reuses [`deviceIcon`](../dist/icons.mjs) with a visible OS requirement from [`preparationFor`](../dist/preparation.mjs), a short Terminal hint and adjacent optional help. Its **Continue** action advances configuration only; it does not acknowledge packages or unlock the install command.

Choose the actual target hardware and OS. [`acceptDevice`](../dist/app.mjs) validates the preset through [`chooseHardware`](../dist/flow.mjs); a Home server selects the headless hub. The short preparation screen shows the OS requirement openly, with **Continue** and an additional help disclosure; it explains that the install command comes at the end. [`preparationFor`](../dist/preparation.mjs) links official Pi Imager/WSL instructions and pinned installer system/Mac requirements. A blank SD card or missing WSL/Homebrew can be addressed before the final command. The wizard does not install an operating system or collect a device report.

[`firstCapability`, `afterCapability`](../dist/journey.mjs) then ask only relevant Pi model, RAM and CPU questions. Unknown or incompatible answers stop early; known hardware/language exclusions skip unnecessary questions. [`localSpeechOption`](../dist/recommendations.mjs) disables local speech with the specific reason. Details can be revised. Accepted unknown answers remain visibly selected, unlike an unanswered default. Device changes invalidate old capabilities; cancelling a review edit restores its original preparation and selection provenance.

## Checks happen on the target

All routes require a supported 64-bit target OS. The launcher checks userland, identity and the Linux/macOS platform before installer execution. The installer then checks accepted distribution IDs, package requirements and applicable hardware restrictions; it does not universally validate the documented distro version floors. Manual browser choices are never described as measured capabilities. No diagnostic-copy/paste or JSON workflow is required. Windows uses Ubuntu/WSL2 with systemd and working microphone/speaker forwarding; Mac requires the pinned contract’s Homebrew/Bash 4/Xcode tools.

[`LAUNCHER_URL`](../dist/short-setup.mjs) pins the [public launcher at `c2e81097a0dcd33f9dc6747c969466e1cc2c9cbb`](https://github.com/OpenVoiceOS/ovos-start-launcher/blob/c2e81097a0dcd33f9dc6747c969466e1cc2c9cbb/v2.sh#L882). Launcher 2.4.2 pins installer `fb1b377513720ef074deb36a33714aa1c4454e3e` for every Linux speech choice and compatibility commit `ff29aa7b9d1ec0d267ad31bc10a6948c490b1b08` for every Mac. Both contain the report URL handoff and filtered automatic wizard failure reporting and are verified after checkout. Both revisions include the checked `uv` path and Homebrew dependency fixes. The compatibility commit preserves the older `6ffd4650` Mac eligibility checks. The historical verification constant was removed with the unused inline builders; the canonical launcher defines runtime pins.

The pinned preview’s [supported systems](https://github.com/OpenVoiceOS/ovos-installer/blob/6ffd465028bac299e5235d619819bfdc734af073/docs/supported-systems.md) document Intel and Apple Silicon Macs. [Current main at the checked commit](https://github.com/OpenVoiceOS/ovos-installer/blob/07729ad81b0dc0c7c9308322bb763235bb8a2dd3/docs/macos.md) instead requires native Apple Silicon and macOS 15 or later. The wizard’s Mac route remains on the older preview, and the matching guide is intentional; this documentation does not change that route or establish present-day Homebrew package availability for every older Mac.

Installation and optional audio verification run in the device terminal. The private read-only recovery helper remains after reboot; it neither reinstalls nor downloads. A browser copy is not success. See [launcher guide](https://github.com/OpenVoiceOS/ovos-start-launcher/blob/dev/docs/index.md) and [speech contract](recommendations.md).

## Verification

The historical optional [`TestRichDependency`](../test/optional-dnf/solver_cases.py) harness checks five synthetic installed/available curl cases in each of DNF4 and DNF5 without running transactions. [Reproduction and ABI prerequisites](../test/optional-dnf/README.md). All ten solver cases passed on the documented engine versions. These checks document the former rich-dependency command; they do not validate the new plain-name command or replace real distribution installation tests.

[Flow](../test/flow.test.mjs), [journey](../test/journey.test.mjs), [navigation](../test/navigation.test.mjs) and [view](../test/views.test.mjs) regressions cover hardware routing, preparation, hub skips, capability states, edits and restored history. Python [`test_export_cleans_private_downloads`](../test/test_export_safety.py) exercises generated exports; production target behavior has its own [`Sandbox`](https://github.com/OpenVoiceOS/ovos-start-launcher/blob/dev/test/test_launcher.py) and PTY tests. Chrome Pi checks covered under 8 GB disabling, Back/refresh retaining selection, and 8 GB enabling. Physical installation/audio remains unverified.

## Recognizing a processor

[`capabilityView`](../dist/app.mjs) points to Settings → About/System information and uses Intel Core, AMD Ryzen and Snapdragon examples. Instruction flags stay in optional help, and unsure remains a supported exit. Mac keeps About This Mac and its Apple Silicon/Intel choices. [`speechEligibility`](../dist/recommendations.mjs) treats family answers as provisional because the installer checks the exact processor and can select online speech. [View tests](../test/views.test.mjs) verify this split between plain guidance and technical requirements.

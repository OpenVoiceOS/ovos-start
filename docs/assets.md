Last Edit: Codex (GPT-6) - 2026-10-09 - Motive: Document local speaker and microphone status icons.

# Identity and artwork

## Audio check icons

[`icons.mjs`](../dist/icons.mjs) adds original speaker and microphone SVGs for `audioChecksView` in [`post-install.mjs`](../dist/post-install.mjs). Their 24×24 bounds, rounded strokes and `currentColor` match the existing local interface symbols. They are decorative beside explicit result labels and status text, require no font or network request, and share the repository's Apache-2.0 license. The check, information and clock status markers reuse bundled Material icons. No recording or microphone access is involved in rendering these symbols; see the [audio-result contract](install-progress.md).

## Starter question icons

[`icons.mjs`](../dist/icons.mjs) adds locally drawn calendar and timer SVGs for [`gettingStartedView`](../dist/post-install.mjs). Both use 24×24 bounds, rounded strokes and `currentColor`, with no font or network dependency. They are decorative beside translated text and share the repository’s Apache-2.0 license. Clock, cloud and voice symbols reuse the bundled Material icons. [Icon tests](../test/icons.test.mjs) cover decorative semantics and local markup.

## README sponsorship logo

[`ngi.png`](../ngi.png) is the unmodified NLnet Foundation / NGI Zero Commons logo used by [OpenVoiceOS/ovos-spec-tools](https://github.com/OpenVoiceOS/ovos-spec-tools/blob/dev/ngi.png), `ovos-persona` and `ovos-m2v-pipeline`. It links to the [OpenVoiceOS funding page](https://nlnet.nl/project/OpenVoiceOS/). SHA-256: `2c1360e8d4579c62d72efff7353a9425cff33bb591858654be1c98eab8c1fb9c`. The logo is used for acknowledgement; trademark rights remain with the respective owners.

The historical concept sheet and unused play/assembly modules were removed in0.53.0. Thumbnail JPEG originals remain build inputs; only their bundled previews are published. Current device drawings, distribution logos, greeting and demo thumbnails remain.

## Version 0.48.0: complete matrix artwork

[DISTRIBUTIONS](../dist/distributions.mjs) now uses16 distinct local distribution marks across18 Linux entries; the openSUSE variants share their project mark. Added original [KDE neon](https://neon.kde.org/content/neon-logo.svg), [Pop!_OS](https://raw.githubusercontent.com/system76/brand/bed1fd3fd39d3f3371c57f15878195888c617777/Pop_OS%20branding/Pop_icon.svg), and [Zorin OS](https://assets.zorincdn.com/zorin.com/downloads/press/logos/zorin-logomark-blue.zip) artwork. Shapes/colors are unchanged; metadata is removed, Pop’s canvas is cropped and Zorin receives its missing viewBox. Exact source/deployed hashes and transformations are in [provenance.json](../dist/assets/distributions/provenance.json). **Zorin marks are registered trademarks of Zorin Technology Group Ltd.**

[distributionPicker](../dist/prerequisites.mjs#L64) keeps names/versions accessible and images decorative. [Asset tests](../test/prerequisites.test.mjs) verify all mapped files; browser inspection confirms the full option set loads locally. Inspected live0.47.0 Debian images already loaded correctly, so the older broken-image screenshot does not establish a current routing defect. Application/style cache versions advance with this release.


## Version 0.47.0: distribution marks

[`DISTRIBUTIONS`](../dist/distributions.mjs) maps 13 recognizable names to local SVG/PNG marks. [`distributionPicker`](../dist/prerequisites.mjs) renders them decoratively beside full names, without white icon tiles. Original paths/colors remain intact; source/deployed SHA-256 hashes and transformations are recorded in [provenance.json](../dist/assets/distributions/provenance.json). Twelve marks come from official project sources; Arch’s small mark comes from pinned Simple Icons artwork. Fedora’s standalone mark reuses the two unmodified paths from its official white-and-blue logo. Raspberry Pi’s original PNG is unchanged and sized in CSS to account for transparent padding.

Marks identify distributions and do not imply endorsement. Trademark rights remain separate from repository code licensing; missing asset licenses are recorded as unknown. [Prerequisite asset tests](../test/prerequisites.test.mjs) verify local files, SVG namespaces/geometry and no remote/script content. Browser QA confirmed all 13 images load in both themes. No generated distribution artwork is used.


## Version 0.35.1: installation device icons

[`deviceIcon`](../dist/icons.mjs) reuses the existing product PNGs for Raspberry Pi, Mark I, Mark II, DevKit and Jetson; computer variants and server reuse square cells from `devices.png`. Other devices use the existing Material chip icon. No new image generation or copied paths are introduced. Icons are decorative, have fixed square bounds and retain the adjacent text label. [Mapping/asset tests](../test/icons.test.mjs).


## Version 0.32.1: official demo thumbnails

[`progressView`](../dist/post-install.mjs) renders locally served 480×360 JPEG previews: [coffee-demo.jpg](../dist/assets/coffee-demo.jpg) from [YouTube Coffee automation](https://i.ytimg.com/vi/PRzGxmTCFb0/hqdefault.jpg), and [ai-demo.jpg](../dist/assets/ai-demo.jpg) from [YouTube GenAI assistant](https://i.ytimg.com/vi/C_xS87EbsiM/hqdefault.jpg). YouTube oEmbed identifies OpenVoiceOS as the author. Images are unchanged official video previews, not newly licensed artwork; the linked videos remain attributed to OpenVoiceOS. Decorative images inherit the adjacent localized link name. No YouTube request occurs until a video link is opened.

## Version0.32.0

Added the Material Symbols Rounded `play_arrow` path from the same pinned737e332revision for explicit demo links. [`icon-sources.json`](icon-sources.json) records the original URL/hash; licensing is unchanged. No video is embedded or auto-played. See [verified demo metadata](install-progress.md).


## Version 0.26: appearance icons

The header adds Google Material Symbols Rounded `light_mode` and `dark_mode` from the existing pinned revision. They are embedded as decorative SVGs; CSS shows the next theme action. [Icon source URLs and hashes](icon-sources.json) retain Apache-2.0 provenance, and [`icons.test.mjs`](../test/icons.test.mjs) verifies their view boxes and decorative semantics.


## Version 0.25.5: community discussion icon

The header reuses Google Material Symbols Rounded `forum` from the existing pinned revision `737e3324305806514d7909874fa1818ae1808232` under Apache-2.0. [`icons.mjs`](../dist/icons.mjs) bundles the trusted path; [`index.html`](../dist/index.html) embeds it decoratively beside Matrix help so it appears before JavaScript loads. [Source URL and hash](icon-sources.json) are recorded with the other icons.


## Version 0.25.4: sorcerer hat

[`wizard-hat.webp`](../dist/assets/wizard-hat.webp) is a generated illustration inspired by the Fantasia hat requested by the user. The built-in imagegen tool generated it once; it is not an official Disney asset. The original transparent RGBA PNG is 1254×1254; the web derivative is 128×128 lossless WebP, 9,424 bytes. [`index.html`](../dist/index.html) renders it decoratively beside the localized label, with responsive [styles](../dist/style.css).

Exact generation prompt (built-in tool, not CLI fallback):

```text
Use case: logo-brand
Asset type: tiny website header illustration displayed beside the word Wizard at 28–32 CSS pixels.
Primary request: One isolated blue sorcerer's hat from Fantasia, with a recognizable tall, slightly bent conical shape, a soft wide blue brim, and large silver-white crescent moon and stars.
Style/medium: crisp, simple flat illustration, bold recognizable silhouette, minimal details, strong shapes legible at tiny icon size; royal blue and deep blue with silver-white decorations.
Composition/framing: single complete hat, front/three-quarter view, centered, fills most of a square canvas, comfortable narrow transparent margin around the entire silhouette.
Scene/backdrop: genuinely transparent background with alpha, no background tile or checkerboard.
Constraints: only the hat; no Mickey Mouse, no character, face, ears, hands, text, border, watermarks, shadows outside silhouette, sparkle effects, scenery, or extra objects. Preserve clean antialiased edges and actual transparent alpha.
```


## Version 0.25: complete Mark I face and Mimic 1 greeting

[`markOneFace`](../dist/welcome.mjs) is original code-native SVG artwork informed by the official [Mark I front-plate drawing at b7cf3e0](https://github.com/MycroftAI/hardware-mycroft-mark-1/tree/b7cf3e0f52d69d1f1e12ea5336f70a2fcb963a1d/Plastics/Laser%20cut). The reference plate is 164.382 × 57.374 mm. Both eyes contain twelve LEDs, and the mouth is a 32×8 matrix, corroborated by the [enclosure firmware at 8f4dd29](https://github.com/MycroftAI/enclosure-mark1/blob/8f4dd29f4cb82f3979ba678ca9dcb48de3c45ab0/src/enclosure.ino) and [mouth driver](https://github.com/MycroftAI/enclosure-mark1/blob/8f4dd29f4cb82f3979ba678ca9dcb48de3c45ab0/lib/MycroftMouth/MycroftMouth.cpp). The stylized grille, curves, smile and speech frames were written for this page; no firmware code or CAD paths were copied into the Site.

[`mark1-welcome.mp3`](../dist/assets/mark1-welcome.mp3) is synthetic speech generated from **“Welcome to the Open Voice OS Installer Wizard.”** with official Mimic 1 revision `adf655da0399530ac1b586590257847eb61be232`, stock voice `ap` / `vid_gb_ap`. [Mycroft configuration documentation](https://mycroft-ai.gitbook.io/docs/using-mycroft-ai/customizations/config-manager) identifies Alan Pope; [Alan’s account](https://blog.popey.com/2022/10/blog-to-speech-in-my-voice/) describes the source recordings. A runtime lexicon entry `os : ow1 eh1 s` pronounces the letters O S. This is not a recording of Alan saying the requested sentence.

The 38,683-byte MP3 decodes to 3.402 seconds, mono 44.1 kHz, with no clipped samples. Its SHA-256 is `f4004f9cd245d0b9c613d5881b4031c9e25ea31b655787e0018a13d3fff84078`. [`mark1-welcome-envelope.json`](../dist/assets/mark1-welcome-envelope.json) stores normalized 40 ms RMS windows from the decoded final audio; `WelcomePlayback` samples it using `audio.currentTime`. The browser does not request microphone access. No engine binary or voice model is distributed.

Upstream [COPYING](https://github.com/MycroftAI/mimic1/blob/adf655da0399530ac1b586590257847eb61be232/COPYING#L9-L33) lists the `ap` voice data as **No License Information**. The generated audio is not assigned an unsupported Apache/BSD label. Existing third-party asset notices remain applicable. Playback and decoded output were checked; no human listening review was performed during generation.


## Version 0.24 platform presentation

[`platformView`](../dist/app.mjs) reuses the pinned Windows/Apple/Tux assets below; no assets or licenses changed. [style.css](../dist/style.css) removes per-platform tints and pastel badge fills, sizes marks individually, and inverts only the black Apple SVG for dark appearance. The unsure option uses bundled Material `help`. The tiny pink trivia stamp remains transparent. There are no production Python classes involved; behavior tests use the fixtures listed in the [guide](index.md).


## Version 0.23.1 — outline only

[style.css](../dist/style.css) now gives the stamp a transparent background, no shadow, pink text/border (#b51b6f light, #ff78c2 dark), and a 55%-tinted dashed inset outline. [`projectTriviaView`](../dist/app.mjs) and its italic story are unchanged. No new assets or image edits.


## Version 0.23 — vivid tiny stamp

The existing stamp in [`projectTriviaView`](../dist/app.mjs) now uses pink `#ff6cb8` in light appearance and `#ff78c2` in dark appearance, with dark plum text `#3e0824`. [style.css](../dist/style.css) retains its tiny size, tilted outline and italic unboxed story. Compact review tiles reuse the existing bundled Material/brand icons through [`icon`](../dist/icons.mjs); there are no new assets or image edits.


## Version 0.22 — consistent Material and identifying brand icons

[`icon`](../dist/icons.mjs) bundles Google Material Symbols Rounded (regular 400, fill 0, grade 0, optical size 24), pinned at [`737e3324305806514d7909874fa1818ae1808232`](https://github.com/google/material-design-icons/tree/737e3324305806514d7909874fa1818ae1808232). The Home Assistant, Python and Docker marks come from Simple Icons revision [`98820a4dc8c363ca72fa2c0d294ea4a0a9bba75d`](https://github.com/simple-icons/simple-icons/tree/98820a4dc8c363ca72fa2c0d294ea4a0a9bba75d). They identify actual integrations/methods; no provider brand implies a particular AI service.

[icon-sources.json](icon-sources.json) records per-icon source URLs, original hashes, coordinate systems and licenses. Google’s Apache-2.0 license, Simple Icons’ CC0 license and its brand disclaimer are kept in [icon-licenses](../dist/assets/icon-licenses). Upstream paths are unchanged; SVG wrappers add decorative accessibility attributes and inherit the interface color. Existing platform marks, OVOS identity and regional flags remain unchanged. No raster assets were generated or edited.

[`card`, `answerCard`, `resultView`](../dist/app.mjs) use this renderer. [Icon tests](../test/icons.test.mjs) verify Material/brand coordinate systems and reject unrecognized keys. Browser review checks centered plus/checks and Home Assistant rendering.


The design uses the identity observed on the [official OpenVoiceOS website](https://www.openvoiceos.org/): original compact emblem, Inter, white/black surfaces, primary text near `#191919`, and secondary text near `#666666`. These are observed implementation choices, not a separately published brand specification.

| Local asset | Source / purpose |
| --- | --- |
| `dist/assets/ovos-logo.svg` | Unmodified [official SVG](https://www.openvoiceos.org/images/logo.svg); black backing preserves its original white lobes and black lettering |
| `dist/assets/inter-latin.woff2` | [Official site's deployed Inter font](https://www.openvoiceos.org/_next/static/media/83afe278b6a6bb3c-s.p.2bn3s6zvc0dyp.woff2); served locally |
| `dist/assets/Inter-LICENSE.txt` | [Inter OFL license](https://raw.githubusercontent.com/rsms/inter/master/LICENSE.txt) |
| Retired `experiences.png` | Historical generated concepts; unused image removed in 0.53.0 |
| `dist/assets/devices.png` | Original concept sprite sheet; only the generic computer and server quadrants are used |

The deployed logo had no asset-specific licensing statement visible. It is reused unchanged at the user's explicit request for OpenVoiceOS identity; no separate license or new ownership is asserted.

## Generation record

**Mode:** built-in `image_gen`, initial two parallel concept-generation requests; no CLI fallback or retries. Both images are 1254×1254 RGBA. The generator returned transparency despite a white-background request; the app composites them on the theme's card surface. CSS shows quadrants without altering source files.

**Final paths:** retired `experiences.png`, [devices.png](../dist/assets/devices.png).

**Exact prompt set:** [artwork-prompts.json](artwork-prompts.json). Briefs specify separate clay/ceramic 3D vignettes, consistent perspective, generous margins, and no text/logos. Colourful illustrations support the monochrome OVOS identity; they do not replace the logo and are not official mascots or product photographs.

Historical initial implementation: [`card`, `experienceView`, `deviceView`, `resultView`](../dist/app.mjs) select the quadrant; [style.css](../dist/style.css) supplies automatic system appearance and reduced motion. Compatibility is tested in [flow.test.mjs](../test/flow.test.mjs); Python [canonical launcher tests](https://github.com/OpenVoiceOS/ovos-start-launcher/blob/dev/test/test_launcher.py) verifies mocked shell behavior.

## Referenced hardware drawings

Five additional built-in imagegen edits convert inspected product references into matching outlined illustrations. They are 1254×1254 RGBA cutouts; no raster post-processing was applied. These are identifying illustrations, not assembly diagrams or product photographs.

| Final asset | Primary visual reference |
| --- | --- |
| [hardware-mark1.png](../dist/assets/hardware-mark1.png) | [Original Mark I designer](https://derickschweppe.com/mycroft-ai-mark-i), shape corroborated by [OSHWA](https://certification.oshwa.org/exemplar/us000049.html) |
| [hardware-mark2.png](../dist/assets/hardware-mark2.png) | [Original Mark II designer](https://derickschweppe.com/mycroft-ai-mark-ii) |
| [hardware-devkit.png](../dist/assets/hardware-devkit.png) | Same designer plus [Mycroft DevKit assembly guide](https://www.instructables.com/Mycroft-Mark-II-Developer-Kit-Assembly/) |
| [hardware-jetson.png](../dist/assets/hardware-jetson.png) | [NVIDIA Orin Nano developer kit](https://developer.nvidia.com/blog/develop-ai-powered-robots-smart-vision-systems-and-more-with-nvidia-jetson-orin-nano-developer-kit/) |
| [hardware-pi.png](../dist/assets/hardware-pi.png) | [Raspberry Pi 5 announcement](https://www.raspberrypi.com/news/introducing-raspberry-pi-5/) |

Exact edit prompts, local reference paths and output records: [hardware-prompts.json](hardware-prompts.json). Full page and original image URLs: [hardware-references.json](hardware-references.json). The Pi 5 drawing represents the supported Pi family; the Jetson card explicitly names Orin Nano. Original photographs are kept outside the deployed Site.

`card` in [app.mjs](../dist/app.mjs) now renders these as image elements with preserved aspect ratios. The visible device label provides the accessible name. Desktop and phone checks confirmed all five files load at natural width 1254.

## Version 0.9 — official identity and regional flags

[voiceVisual](../dist/app.mjs) uses the unchanged OVOS SVG with code-native signal geometry and waveform bars. The app removes the cartoon and its hardware badge; purpose choices use interface symbols. Hardware drawings remain. No raster imagery was generated or edited.

Nine square SVG flags are bundled under dist/assets/flags: us, fr, de, es, it, nl, pt, in and dz. Source: [flag-icons v7.3.2](https://github.com/lipis/flag-icons/tree/v7.3.2/flags/1x1), with the original [MIT license](../dist/assets/flags/LICENSE). [localeFlag](../dist/recommendations.mjs) maps the supported preset region; it does not infer nationality or replace the native language label. CSS clips the SVG to a circle. No remote flag-image requests occur.

Blue remains an interface accent and green distinguishes Continue; neither is asserted as an official brand palette. Both automatic themes are defined in [style.css](../dist/style.css).

## Version 0.10 — focused question surface

The sidebar and its signal graphic are no longer rendered. The unchanged official emblem remains in the header, regional flags remain in the language row, and [card](../dist/app.mjs) retains the hardware drawings and purpose icons. Continue uses a code-native 20px SVG arrow from the existing icon function. No raster assets were generated or edited; earlier artwork entries document provenance and historical versions.

## Version 0.12 platform marks and ticket

The OS picker uses unmodified Windows 11, Apple and Linux/Tux SVGs from [Devicon at pinned commit 7330acc](https://github.com/devicons/devicon/tree/7330accdbc47e2dc0c19789a48533c4a3c50fe58/icons). Assets are [windows.svg](../dist/assets/platform/windows.svg), [apple.svg](../dist/assets/platform/apple.svg) and [linux.svg](../dist/assets/platform/linux.svg). The MIT notice is bundled as [LICENSE](../dist/assets/platform/LICENSE). These identify platforms; no endorsement is asserted. The unknown-platform icon uses the existing interface globe.

[platformView and card](../dist/app.mjs) retain accessible text labels. The existing laptop/server sprite cells are now square to preserve their original aspect ratio. CSS supplies restrained platform tints, theme-aware orange Back, and an asymmetrical notched trivia ticket with a rotated stamp. No new generated bitmap, mascot or replacement OVOS logo was introduced.

## Version 0.15: restrained cues

The trivia ticket, stamp, notch pseudo-elements and footer are removed. A small existing spark icon, inline story/source and a refresh control replace them. Guidance uses code-native compass, sliders and terminal interface icons from [`PATHS`](../dist/app.mjs). [style.css](../dist/style.css) defines teal, amber and violet tokens for both system themes. No new bitmap artwork or OVOS identity change is introduced.

## Version 0.16: tiny stamp and true italic

[`projectTriviaView`](../dist/app.mjs) uses a small code-native, slightly tilted stamp with decorative text hidden from assistive technology. The enclosing note retains its accessible OVOS trivia label. Story text uses real Inter italic; the source remains upright.

The italic source is [Inter from Google Fonts](https://fonts.googleapis.com/css2?family=Inter:ital,wght@1,400&display=swap), downloaded from the [returned font URL](https://fonts.gstatic.com/s/inter/v20/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc2dthjQ.ttf). FontTools converts a Latin/punctuation subset to [inter-italic-latin.woff2](../dist/assets/inter-italic-latin.woff2), 32,152 bytes. The existing [Inter SIL Open Font License](../dist/assets/Inter-LICENSE.txt) applies. All current trivia characters and the font’s italic metadata were verified. Production pages serve the font locally; no visitor font request goes to Google.

## Version 0.19: neutral guidance and expanded community stories

[`guidanceView`](../dist/app.mjs) reuses the code-native compass, sliders and terminal icons. The `.guidance-deck` rules in [style.css](../dist/style.css) give all three neutral card surfaces and shared blue icons. The selected card has a blue edge and green check. This replaces the separate teal, amber and violet guidance accents from version 0.15 in both automatic themes; it does not change the official OVOS emblem.

[`projectTriviaView`](../dist/app.mjs) preserves the tiny tilted OVOS/TRIVIA stamp, locally served italic story, inline Backstory link and quiet refresh control. The note remains unboxed. The stories and their source links are maintained in [`PROJECT_FACTS`](../dist/facts.mjs). No new image or font asset is introduced in this release. Earlier version sections retain their historical presentation records.

## Version 0.20: a single installation action

[`resultView`](../dist/app.mjs) reuses the existing terminal/server/copy/check interface icons and system-theme green Continue tokens. The device/language and paste instruction sit in one compact surface; secondary disclosures use simple divider rows. No bitmap or font asset is created or modified. The unboxed italic trivia note remains below the handoff.

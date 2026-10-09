<!-- Last Edit: Codex - 2026-10-09 - Motive: Move public wizard and installer links to openvoiceos.org. -->

# OVOS Start

**[Open the wizard](https://start.openvoiceos.org/)**

A guided setup for [OpenVoiceOS](https://www.openvoiceos.org/). Choose your device and voice options, follow installation progress, then check your speaker and microphone.

1. Choose your language, device and preferences.
2. Follow the preparation steps and confirm your device is ready.
3. Copy the install command into your device's terminal. Keep the wizard open for progress and next steps.

You can use the wizard again to change your setup or reinstall.

## What is in this repository?

The wizard website and its progress API. GitHub Pages hosts the website; the API and SQLite database run on `agh01`.

The separate [ovos-start-launcher](https://github.com/OpenVoiceOS/ovos-start-launcher) runs on your device and starts [ovos-installer](https://github.com/OpenVoiceOS/ovos-installer) with your choices.

## Development

See the [developer guide](docs/index.md) to run, build and test the wizard, or [self-hosting](docs/self-hosting.md) to run the API.

## Sponsorship

[![Sponsored by NLnet through the NGI0 Commons Fund](./ngi.png)](https://nlnet.nl/project/OpenVoiceOS/)

Supported by [NLnet](https://nlnet.nl/) through the [NGI0 Commons Fund](https://nlnet.nl/commonsfund/), with European Commission funding for the [Next Generation Internet](https://ngi.eu/) programme ([grant 101135429](https://cordis.europa.eu/project/id/101135429)).

## License

Code is licensed under Apache-2.0. See [asset credits and licenses](docs/assets.md) for artwork, fonts, and other assets.

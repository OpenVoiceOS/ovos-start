# OVOS Start

A web wizard that helps you install [OpenVoiceOS](https://www.openvoiceos.org/) on your device.

Choose your device, language, and voice options. The wizard shows you how to prepare your device, then gives you an install command to copy into its terminal. Installation runs on your device, with progress shown in the browser.

After installation, the wizard guides you through checking your speaker and microphone and suggests things to try. You can run it again to change your setup or reinstall.

## Run locally

With Node.js, npm, and Python 3 installed:

```sh
npm ci
npm start
```

Open <http://localhost:4187>. Local previews let you explore the wizard; installation commands are disabled.

See the [developer guide](docs/index.md) for tests, production builds, and how the wizard works.

## Sponsorship

[![Sponsored by NLnet through the NGI0 Commons Fund](./ngi.png)](https://nlnet.nl/project/OpenVoiceOS/)

Supported by [NLnet](https://nlnet.nl/) through the [NGI0 Commons Fund](https://nlnet.nl/commonsfund/), with European Commission funding for the [Next Generation Internet](https://ngi.eu/) programme ([grant 101135429](https://cordis.europa.eu/project/id/101135429)).

## License

Code is licensed under Apache-2.0. See [asset credits and licenses](docs/assets.md) for artwork, fonts, and other assets.

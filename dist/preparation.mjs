import { DEVICES } from './scenario.mjs';

/** Explain the target's preparation without inferring it from the browsing device.
 * @param {object} state Recipe choices. @returns {object} Preparation copy and official help.
 */
export function preparationFor(state) {
  if(!Object.hasOwn(DEVICES,state.device))throw new Error('Choose a device first.');
  const common={action:'Continue',description:'We’ll guide you through the commands in Terminal.',
    help:'Install a supported Linux system first, then connect your device to the internet.',
    url:'https://github.com/OpenVoiceOS/ovos-installer/blob/6ffd465028bac299e5235d619819bfdc734af073/docs/supported-systems.md',link:'Supported systems'};
  const targets={
    pi:{help:'If your Pi has a blank SD card, use Raspberry Pi Imager to install a supported 64-bit system. Enable SSH if you’ll connect from another computer.',url:'https://www.raspberrypi.com/documentation/computers/getting-started.html#install-using-imager',link:'Prepare a Raspberry Pi'},
    windows:{description:'Use Ubuntu in WSL2 on your Windows PC. The command goes in Ubuntu, not PowerShell.',help:'Set up Ubuntu in WSL2 with systemd first. Voice also needs microphone and speaker support through WSLg.',url:'https://learn.microsoft.com/windows/wsl/install',link:'Prepare Windows'},
    mac:{description:'Open Terminal on your Mac. The installer will check the required tools.',help:'Install Homebrew, Bash 4 or newer and Xcode Command Line Tools before continuing.',url:'https://github.com/OpenVoiceOS/ovos-installer/blob/6ffd465028bac299e5235d619819bfdc734af073/docs/macos.md',link:'Prepare a Mac'},
    mark1:{help:'Install the supported Debian 13 image first.'},
    mark2:{help:'Install the supported Debian 13 image first.'},
    devkit:{help:'Your DevKit needs a Raspberry Pi 4 running supported 64-bit Debian 13.'},
    jetson:{help:'Start with a supported 64-bit Ubuntu system on your Jetson. Check the installer’s current system requirements.'}
  };
  return {...common,...targets[state.device]};
}

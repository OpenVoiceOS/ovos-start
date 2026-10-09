/** Immutable, reviewed launcher; never accept a download URL from a request. */
export const LAUNCHER_URL='https://raw.githubusercontent.com/OpenVoiceOS/ovos-start-launcher/c846aaa40b1ce755c0fccbfde60af55b39d819c3/v2.sh';

/** Produce one atomic shell compound command. No truncated prefix can execute.
 * @param {string} code Timestamped recipe. @param {string} writeToken Callback capability.
 * @returns {string} POSIX bootstrap with no bytes after its final closing parenthesis.
 */
export function bootstrap(code,writeToken) {
  if(!/^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/.test(code)||code.length!==19)throw new TypeError('Invalid recipe.');
  if(!/^[a-f0-9]{64}$/.test(writeToken)||writeToken.length!==64)throw new TypeError('Invalid capability.');
  return `(\nset -eu\nset +x\n# Read the entire pinned launcher before executing it.\novos=$(curl -qfsS --proto '=https' --connect-timeout 15 -m 120 '${LAUNCHER_URL}') || { printf '%s\\n' 'Could not download the installer. Please try again.' >&2; exit 1; }\n[ -n "$ovos" ] || { printf '%s\\n' 'The installer download was empty. Please try again.' >&2; exit 1; }\n# Keep interactive installer prompts on the terminal, not the download pipe.\n[ -r /dev/tty ] && ( : < /dev/tty ) 2>/dev/null || { printf '%s\\n' 'Open Terminal on your OVOS device and paste the command there.' >&2; exit 1; }\nexec sh -c "$ovos" -- '${code}' --track '${writeToken}' < /dev/tty\n)`;
}

/** Distribution names and bundled official artwork; package families stay internal. */
export const DISTRIBUTIONS=Object.freeze({
  debian:{label:'Debian',version:'10+',osId:'debian',family:'debian',logo:'debian'},
  ubuntu:{label:'Ubuntu',version:'20.04+',osId:'ubuntu',family:'debian',logo:'ubuntu'},
  mint:{label:'Linux Mint',version:'21+',osId:'linuxmint',family:'debian',logo:'mint'},
  raspberrypi:{label:'Raspberry Pi OS',version:'11+',osId:'debian',family:'debian',logo:'raspberrypi',format:'png'},
  fedora:{label:'Fedora',version:'37+',osId:'fedora',family:'fedora',logo:'fedora'},
  rocky:{label:'Rocky Linux',version:'8+',osId:'rocky',family:'fedora',logo:'rocky'},
  almalinux:{label:'AlmaLinux',version:'8+',osId:'almalinux',family:'fedora',logo:'almalinux'},
  centos:{label:'CentOS',version:'8+',osId:'centos',family:'fedora',logo:'centos'},
  arch:{label:'Arch Linux',version:'Rolling release',osId:'arch',family:'arch',logo:'arch'},
  manjaro:{label:'Manjaro',version:'Rolling release',osId:'manjaro',family:'arch',logo:'manjaro'},
  endeavouros:{label:'EndeavourOS',version:'Rolling release',osId:'endeavouros',family:'arch',logo:'endeavouros'},
  cachyos:{label:'CachyOS',version:'Rolling release',osId:'cachyos',family:'arch',logo:'cachyos'},
  neon:{label:'KDE neon',version:'20.04+',osId:'neon',family:'debian',logo:'kde-neon'},
  pop:{label:'Pop!_OS',version:'22.04+',osId:'pop',family:'debian',logo:'pop-os'},
  zorin:{label:'Zorin OS',version:'16+',osId:'zorin',family:'debian',logo:'zorin-os'},
  'suse-leap':{label:'openSUSE Leap',version:'15+',osId:'opensuse-leap',family:'suse',logo:'opensuse'},
  'suse-slowroll':{label:'openSUSE Slowroll',version:'Rolling release',osId:'opensuse-slowroll',family:'suse',logo:'opensuse'},
  'suse-tumbleweed':{label:'openSUSE Tumbleweed',version:'Rolling release',osId:'opensuse-tumbleweed',family:'suse',logo:'opensuse'},
});

/** Only offer target-compatible systems.
 * @param {string} device Hardware ID. @returns {object} Allowlisted options.
 */
export function distributionsFor(device){
  if(['mark1','mark2','devkit'].includes(device))return {debian13:{...DISTRIBUTIONS.debian,label:'Debian 13',version:null}};
  if(device==='windows')return {'ubuntu-wsl':{...DISTRIBUTIONS.ubuntu,label:'Ubuntu (WSL2)'}};
  return DISTRIBUTIONS;
}

/** Resolve a fixed hardware requirement without claiming the target has been checked.
 * @param {string} device Hardware ID. @returns {string} Sole system ID, or empty for a choice.
 */
export function fixedSystemFor(device){
  const ids=Object.keys(distributionsFor(device));
  return ids.length===1?ids[0]:'';
}

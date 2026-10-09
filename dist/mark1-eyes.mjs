/**
 * Render decorative Mark I LED eyes without implying a measured percentage.
 * @param {object} options Display options for the surrounding installation status.
 * @param {boolean} [options.animated=true] Animate only while updates are available.
 * @param {boolean} [options.compact=false] Use the smaller waiting-state artwork.
 * @returns {string} Local, accessible-to-ignore SVG markup.
 */
export function mark1Eyes({animated=true,compact=false}={}) {
  const segments=Array.from({length:12},(_,index)=>{
    const start=(index*30-102)*Math.PI/180;
    const end=(index*30-78)*Math.PI/180;
    const point=angle=>`${(16*Math.cos(angle)).toFixed(3)} ${(16*Math.sin(angle)).toFixed(3)}`;
    return `<path class="mark1-led" d="M ${point(start)} A 16 16 0 0 1 ${point(end)}"/>`;
  }).join('');
  const eye=x=>`<g class="mark1-eye" transform="translate(${x} 22)"><circle class="mark1-eye-base" r="20"/><g class="mark1-leds">${segments}</g></g>`;
  return `<svg class="mark1-eyes${animated?' mark1-eyes--animated':''}${compact?' mark1-eyes--compact':''}" viewBox="0 0 104 44" width="104" height="44" aria-hidden="true" focusable="false">${eye(23)}${eye(81)}</svg>`;
}

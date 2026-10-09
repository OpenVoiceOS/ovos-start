/**
 * Render one decorative Mark I LED eye without implying a measured percentage.
 * @param {object} options Display options for the surrounding installation status.
 * @param {boolean} [options.animated=true] Animate only while updates are available.
 * @param {boolean} [options.compact=false] Use the smaller waiting-state artwork.
 * @returns {string} Local, accessible-to-ignore SVG markup.
 */
export function mark1Eye({animated=true,compact=false}={}) {
  const segments=Array.from({length:12},(_,index)=>{
    const angle=(index*30-90)*Math.PI/180;
    return `<circle class="mark1-led" cx="${(18*Math.cos(angle)).toFixed(3)}" cy="${(18*Math.sin(angle)).toFixed(3)}" r="2.6"/>`;
  }).join('');
  return `<svg class="mark1-eye${animated?' mark1-eye--animated':''}${compact?' mark1-eye--compact':''}" viewBox="0 0 56 56" width="56" height="56" aria-hidden="true" focusable="false"><g class="mark1-eye-ring" transform="translate(28 28)"><circle class="mark1-eye-face" r="25"/><g class="mark1-leds">${segments}</g></g></svg>`;
}

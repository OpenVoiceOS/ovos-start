/** Keep a click or held key from accepting a different question after navigation. */
export class ChoiceInputGuard {
  /** @param {Function} clock Monotonic milliseconds; injectable for boundary tests. */
  constructor(clock=()=>performance.now()) {
    this.clock=clock;this.generation=0;this.press=null;this.key=null;this.accepted=null;
  }
  /** Invalidate presses that started before the current screen. @returns {void} */
  nextScreen(){this.generation+=1;}
  /** Record a physical press and its originating control. @param {object} event @param {object} target @returns {void} */
  pointerDown(event,target){
    this.key=null;
    this.press={generation:this.generation,target,x:event.clientX,y:event.clientY,kind:event.pointerType||'mouse'};
  }
  /** Reject a held activation key; remember its original question. @param {object} event @param {object} target @returns {boolean} */
  keyDown(event,target){
    if(!['Enter',' '].includes(event.key)){this.key=null;return true;}
    if(event.repeat)return false;
    this.key={generation:this.generation,target};return true;
  }
  /** Clear a released key after its native click, without clearing a newer press.
   * @param {object} event Key event. @param {Function} schedule Deferred cleanup. @returns {void}
   */
  keyUp(event,schedule=callback=>setTimeout(callback,0)){
    if(!['Enter',' '].includes(event.key))return;
    const pending=this.key;schedule(()=>{if(this.key===pending)this.key=null;});
  }
  /** Allow intentional activation, including keyboard and assistive technology. @param {object} event @param {object} target @returns {boolean} */
  allowClick(event,target){
    if(event.detail===0){
      const key=this.key;this.key=null;this.press=null;
      return !key||(key.generation===this.generation&&key.target===target);
    }
    const press=this.press;this.press=null;
    if(!press||press.generation!==this.generation||press.target!==target)return false;
    if(press.kind==='mouse'&&event.detail>1)return false;
    const now=this.clock();const previous=this.accepted;
    if(previous&&previous.generation!==this.generation&&now-previous.time<450&&Math.hypot(press.x-previous.x,press.y-previous.y)<8)return false;
    this.accepted={...press,time:now};return true;
  }
}

/** Focus the saved/default choice without changing it or inventing a hardware answer.
 * @param {HTMLElement} root Current question. @returns {HTMLElement|null} Focused target.
 */
export function focusCurrentChoice(root){
  const target=root.querySelector('.answer-card[aria-pressed="true"]:not(:disabled), .pick-card[aria-pressed="true"]:not(:disabled), .platform-card[aria-pressed="true"]:not(:disabled)')||root.querySelector('[data-confirm-language], [data-welcome-start], .speech-continue, [data-install-action]:not(:disabled)')||root.querySelector('#step-title');
  if(!target)return null;
  if(target.id!=='step-title'){
    const descriptions=new Set((target.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));
    descriptions.add('step-title');target.setAttribute('aria-describedby',[...descriptions].join(' '));
    target.classList.add('choice-focus');target.addEventListener('blur',()=>target.classList.remove('choice-focus'),{once:true});
  }
  target.focus({preventScroll:true});return target;
}

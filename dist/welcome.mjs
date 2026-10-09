/** A code-drawn nod to the Mycroft Mark I, with its 12-dot eyes and 32×8 mouth. */
export const WELCOME_TEXT='Welcome to the Open Voice OS Installer Wizard.';

/** Rasterize an original smile or speech opening into the Mark I matrix.
 * @param {number} level Normalized audio amplitude. @param {boolean} speaking
 * @returns {boolean[]} Row-major 32×8 LED state.
 */
export function mouthFrame(level=0,speaking=false){
  const amplitude=Math.max(0,Math.min(1,Number.isFinite(level)?level:0));
  return Array.from({length:256},(_,index)=>{
    const x=index%32,y=Math.floor(index/32);
    if(!speaking||amplitude<.065){
      const edge=Math.abs(x-15.5);
      return edge<10&&y===(edge>8?3:edge>6?4:5);
    }
    const rx=6+amplitude*5,ry=.6+amplitude*2.5;
    const distance=((x-15.5)/rx)**2+((y-3.5)/ry)**2;
    return distance>.54&&distance<1.48;
  });
}

/** Draw original vector artwork using the documented faceplate proportions.
 * @returns {string} Decorative SVG; the adjacent text provides the greeting.
 */
export function markOneFace(){
  const eyes=[24.19,140.19].map((cx,eye)=>`<g class="mark1-eye"><circle cx="${cx}" cy="28.69" r="13.5" class="eye-track"/>${Array.from({length:12},(_,i)=>{const a=(i*30-90)*Math.PI/180;return `<circle data-eye-led="${i}" data-eye="${eye}" cx="${(cx+13.5*Math.cos(a)).toFixed(3)}" cy="${(28.69+13.5*Math.sin(a)).toFixed(3)}" r="1.6" class="eye-led"/>`;}).join('')}</g>`).join('');
  const smile=mouthFrame();
  const mouth=Array.from({length:256},(_,i)=>`<circle data-mouth-led="${i}" cx="${(43.34+(i%32)*2.5).toFixed(2)}" cy="${(19.84+Math.floor(i/32)*2.5).toFixed(2)}" r=".72" class="mouth-led ${smile[i]?'lit':''}"/>`).join('');
  const mic=Array.from({length:30},(_,i)=>{const angle=i*2.399963,r=4.4*Math.sqrt((i+.5)/30);return `<circle cx="${(82.19+Math.cos(angle)*r).toFixed(2)}" cy="${(10.8+Math.sin(angle)*r).toFixed(2)}" r=".46"/>`;}).join('');
  return `<svg class="mark1-face" viewBox="-4 -4 172.38 65.38" aria-hidden="true" focusable="false"><defs><linearGradient id="mark1-rim" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#a6b1bd"/></linearGradient><linearGradient id="mark1-glass" x2=".8" y2="1"><stop stop-color="#303940"/><stop offset=".5" stop-color="#12191e"/><stop offset="1" stop-color="#263039"/></linearGradient></defs><path class="face-rim" d="M82.19 0C124 0 164.38 3 164.38 28.69S124 57.37 82.19 57.37S0 54.37 0 28.69S40.4 0 82.19 0Z"/><path class="face-glass" d="M82.19 2C123 2 162.38 5 162.38 28.69S123 55.37 82.19 55.37S2 52.37 2 28.69S41.4 2 82.19 2Z"/><path class="face-reflection" d="M15 10C47 2 115 2 148 11"/><g class="mic-grille">${mic}</g>${eyes}<g class="mark1-mouth">${mouth}</g></svg>`;
}

/** Sample the generated greeting's RMS envelope without microphone access.
 * @param {object} envelope Step/duration/values from the generated speech.
 * @param {number} time Audio playback time in seconds. @returns {number} Amplitude.
 */
export function sampleEnvelope(envelope,time){
  if(!envelope||time<0||!Number.isFinite(time))return 0;
  const step=envelope.frameMs/1000||envelope.stepSeconds||.04;
  return Math.max(0,Math.min(1,envelope.values?.[Math.floor(time/step)]||0));
}

/** Illuminate both eyes together, with a gentle moving light during speech.
 * @param {number} seconds Time since the face appeared. @param {boolean} speaking
 * @param {number} openness Current blink brightness.
 * @returns {number[]} Twelve shared LED brightness levels, from zero to one.
 */
export function eyeLevels(seconds,speaking=false,openness=1){
  const time=Number.isFinite(seconds)?Math.max(0,seconds):0;
  const blink=Number.isFinite(openness)?Math.max(0,Math.min(1,openness)):1;
  return Array.from({length:12},(_,index)=>blink*(speaking?.66+.34*(.5+.5*Math.cos(index*Math.PI/6-time*3)):1));
}

/** Blink at varied intervals, occasionally twice, until the visitor leaves the face.
 * @param {Function} onFrame Brightness callback. @param {object} options Motion and scheduler.
 * @returns {Function} Idempotent cancellation function.
 */
export function animateEyes(onFrame,{reducedMotion=false,speaking=()=>false,random=Math.random,clock=()=>performance.now(),request=callback=>requestAnimationFrame(callback),cancel=id=>cancelAnimationFrame(id)}={}){
  let frame=null,stopped=false;const start=clock();
  const sample=()=>{const value=Number(random());return Number.isFinite(value)?Math.max(0,Math.min(1,value)):.5;};
  let nextBlink=start+800+sample()*2200,blinkStart=null,duration=200,doubleBlink=false;
  const tick=()=>{
    if(stopped)return;
    if(reducedMotion){onFrame(Array(12).fill(1));return;}
    const now=clock();
    if(blinkStart===null&&now>=nextBlink){blinkStart=now;duration=180+sample()*100;}
    let openness=1;
    if(blinkStart!==null){
      const progress=(now-blinkStart)/duration;
      if(progress>=1){
        blinkStart=null;
        if(!doubleBlink&&sample()<.25){nextBlink=now+160+sample()*180;doubleBlink=true;}
        else{nextBlink=now+2200+sample()*4500;doubleBlink=false;}
      }else openness=Math.max(0,Math.min(1,progress<.5?1-progress/.35:(progress-.65)/.35));
    }
    onFrame(eyeLevels((now-start)/1000,speaking(),openness));
    frame=request(tick);
  };
  tick();
  return ()=>{if(stopped)return;stopped=true;if(frame!==null)cancel(frame);onFrame(Array(12).fill(1));};
}

/** Own one user-triggered welcome playback, its animation and safe cancellation. */
export class WelcomePlayback {
  /** @param {object} options Audio plus UI callbacks and injectable animation scheduler. */
  constructor({audio,envelope,onFrame=()=>{},onState=()=>{},onDone=()=>{},reducedMotion=false,request=callback=>requestAnimationFrame(callback),cancel=id=>cancelAnimationFrame(id)}){
    Object.assign(this,{audio,envelope,onFrame,onState,onDone,reducedMotion,request,cancel});
    this.active=false;this.playing=false;this.disposed=false;this.completed=false;this.frame=null;this.run=0;
    this.ended=()=>this.finish('ended');this.error=()=>this.finish('error');
    audio.addEventListener('ended',this.ended);audio.addEventListener('error',this.error);
  }
  /** Start only when called by the visitor's click. @returns {Promise<void>} */
  async start(){
    if(this.active||this.disposed||this.completed)return;
    this.active=true;const run=++this.run;this.onState('loading');
    try{
      await this.audio.play();
      if(!this.active||this.disposed||run!==this.run)return;
      this.playing=true;this.onState('playing');this.tick();
    }catch{if(this.active&&!this.disposed&&run===this.run)this.finish('error');}
  }
  /** Update LEDs from playback time; reduced motion leaves a still smile. @returns {void} */
  tick(){
    if(!this.active||this.disposed)return;
    if(this.reducedMotion){this.onFrame(mouthFrame(),0,false);return;}
    const time=this.audio.currentTime;
    this.onFrame(mouthFrame(sampleEnvelope(this.envelope,time),true),time,true);
    this.frame=this.request(()=>this.tick());
  }
  /** Change animation preference without restarting or interrupting the greeting.
   * @param {boolean} value Reduce motion now. @returns {void}
   */
  setReducedMotion(value){
    if(this.disposed)return;
    this.reducedMotion=!!value;
    if(this.frame!==null)this.cancel(this.frame);this.frame=null;
    if(this.reducedMotion)this.onFrame(mouthFrame(),0,false);
    else if(this.playing)this.tick();
  }
  /** End or skip once without allowing a late play promise to restart animation. @param {string} reason @returns {void} */
  finish(reason='skip'){
    if(this.disposed||this.completed)return;
    this.completed=true;this.stop();this.onDone(reason);
  }
  /** Stop sound and scheduled LED updates. @returns {void} */
  stop(){
    this.active=false;this.playing=false;this.run+=1;this.audio.pause();
    if(this.frame!==null)this.cancel(this.frame);this.frame=null;
    this.onFrame(mouthFrame(),0,false);
  }
  /** Remove event listeners when navigating away. @returns {void} */
  dispose(){
    this.stop();this.disposed=true;
    this.audio.removeEventListener('ended',this.ended);this.audio.removeEventListener('error',this.error);
  }
}

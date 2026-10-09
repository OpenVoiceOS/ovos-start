/** Rotate quiet, secondary facts only while installation is actively progressing.
 * @param {object} model Current installer tracker snapshot.
 * @param {object} options Page visibility, reading preferences and interaction.
 * @returns {boolean} Whether another fact may appear automatically.
 */
export function canRotateTrivia(model,{visible=true,reducedMotion=false,interacting=false,paused=false}={}) {
  return ['started','downloading','installing'].includes(model.session?.status)&&
    !model.error&&!model.session?.attention&&visible&&!reducedMotion&&!interacting&&!paused;
}

/** One calm timer that survives frequent progress polls without delaying rotation. */
export class TriviaRotation {
  /** @param {object} options Injectable lifecycle, callback and timers. */
  constructor({canRotate,onRotate,setTimer=(callback,delay)=>setTimeout(callback,delay),clearTimer=id=>clearTimeout(id),interval=20000}) {
    this.canRotate=canRotate;this.onRotate=onRotate;
    this.setTimer=setTimer;this.clearTimer=clearTimer;this.interval=interval;this.timer=null;
  }

  /** Reconcile the timer without resetting an already running reading interval. @returns {void} */
  sync() {
    if(!this.canRotate()){this.stop();return;}
    if(this.timer!==null)return;
    this.timer=this.setTimer(()=>{
      this.timer=null;
      if(!this.canRotate())return;
      this.onRotate();this.sync();
    },this.interval);
  }

  /** Give a manually chosen fact a full reading interval. @returns {void} */
  restart() { this.stop();this.sync(); }

  /** Cancel pending updates when leaving the page or pausing. @returns {void} */
  stop() {
    if(this.timer!==null)this.clearTimer(this.timer);
    this.timer=null;
  }
}

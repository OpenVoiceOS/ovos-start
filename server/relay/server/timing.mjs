import { decodeRecipeEnvelope } from '../vendor/recipe-code.mjs';

export const MIN_TIMING_SAMPLES=5;

/** Compare recipe hardware and costly installation choices, never owner identities.
 * @param {string} code Saved recipe. @param {number} now Server time. @returns {string}
 */
export function timingCohort(code,now) {
  const {state}=decodeRecipeEnvelope(code,{now,allowExpired:true});
  return JSON.stringify(['device','piModel','memory','cpu','method','speech','experience','skills','extraSkills','locale'].map(key=>state[key]));
}

/** A bounded estimate from this owner's still-accessible completed runs only.
 * No additional telemetry or retention; old sessions without completion time do not qualify.
 * @param {object} db D1 binding. @param {object} row Authorized session.
 * @param {number} now Server time. @returns {Promise<object|null>} Observed total-time range.
 */
export async function estimateFor(db,row,now) {
  try {
    const cohort=timingCohort(row.code,now);
    const {results}=await db.prepare('SELECT code, started_at, installed_at FROM installs WHERE owner = ? AND expires_at > ? AND installed_at > started_at AND id != ? ORDER BY installed_at DESC LIMIT 20').bind(row.owner,now,row.id).all();
    const durations=results.filter(sample=>timingCohort(sample.code,now)===cohort).map(sample=>sample.installed_at-sample.started_at).filter(seconds=>seconds>=60&&seconds<86400).sort((a,b)=>a-b);
    if(durations.length<MIN_TIMING_SAMPLES)return null;
    return {lowSeconds:durations[0],highSeconds:durations.at(-1),samples:durations.length};
  }catch{return null;} // Timing must never block installation progress.
}

import { STARTER_EXAMPLES } from './starter-examples.mjs';

/** Curated resources; recipe values never become URLs. */
export const GUIDE_LINKS=Object.freeze({
  skills:'https://andlo.github.io/ovos-klondike-mercantile/',
  homeassistant:'https://openvoiceos.github.io/beta-technical-manual/home-assistant/',
  ai:'https://openvoiceos.github.io/beta-technical-manual/openai-plugin/',
  satellite:'https://openvoiceos.github.io/beta-technical-manual/satellites/',
  community:'https://matrix.to/#/#openvoiceos:matrix.org',
});

/** Return only reviewed starter phrases for a voice device with skills selected.
 * Locale text comes from skill resources, never a runtime machine translation.
 * @param {object} state Confirmed recipe. @returns {Array<object>} Safe examples.
 */
export function starterExamples(state) {
  if(state.experience==='hub'||!state.skills)return [];
  return STARTER_EXAMPLES[state.locale]||[];
}

/** Useful next actions based on choices, without claiming integrations connected.
 * @param {object} state Confirmed recipe. @returns {Array<object>} Guidance cards.
 */
export function nextSteps(state) {
  const hub=state.experience==='hub';
  const cards=[{id:'skills',icon:'widgets',title:state.skills?'Explore more skills':'Add your first skill',description:state.skills?'Find something useful, then follow the skill’s setup instructions.':'Add skills for timers, weather, music and more.',action:'Find skills',url:GUIDE_LINKS.skills}];
  if(!hub&&state.homeassistant)cards.push({id:'homeassistant',icon:'home_assistant',title:'Your Home Assistant connection',description:'Check the connection and use the names of your own devices and scenes.',action:'Home Assistant guide',url:GUIDE_LINKS.homeassistant});
  if(!hub&&state.llmMode&&state.llmMode!=='off')cards.push({id:'ai',icon:'spark',title:'Your AI connection',description:'Check your provider settings, then try an open-ended question.',action:'AI setup guide',url:GUIDE_LINKS.ai});
  cards.push({id:'help',icon:'forum',title:'Need help getting a reply?',description:'Get a hand with skills, sound or setup.',action:'Get help in Matrix',url:GUIDE_LINKS.community});
  return cards;
}

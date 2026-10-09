/** Questions restored as answered when reopening a complete recipe. */
export const RECIPE_QUESTIONS = ['language','guidance','purpose','device','speech','skills','homeassistant','llm'];

/** Return the next single decision, skipping voice-only features on headless hubs. @param {string} question @param {object} state @returns {string} */
export function nextQuestion(question, state) {
  if (['piModel','memory','cpu'].includes(question)) return afterCapability(question,state);
  const next = { welcome:'language', language: 'device', guidance: 'purpose', purpose: 'device', device: 'prepare', prepare: state.experience === 'hub' ? 'review' : firstCapability(state), speech: 'review', skills: 'review', homeassistant: 'review', llm: 'review' };
  if (!Object.hasOwn(next, question)) throw new Error('Unknown question.');
  return next[question];
}

/** Offer a capability branch only when hardware and language can support the preview. @param {object} state @returns {boolean} */
export function canExploreLocal(state) {
  return state.experience !== 'hub' && !['mark1', 'mark2', 'devkit'].includes(state.device) && !['hi-in', 'kab-dz', 'pl-pl'].includes(state.locale);
}

/** Ask device details before presenting the speech choices. @param {object} state @returns {string} */
export function firstCapability(state) {
  if (!canExploreLocal(state)) return 'speech';
  return state.device === 'pi' ? 'piModel' : state.device === 'mac' ? 'cpu' : 'memory';
}

/** Treat unknown as a completed answer and stop the branch when local speech cannot fit. @param {string} question @param {object} state @returns {string} */
export function afterCapability(question, state) {
  if (question === 'piModel') return state.piModel === 'pi5' ? 'memory' : 'speech';
  if (question === 'memory') return state.memory === '8plus' && !['mac','pi','jetson'].includes(state.device) ? 'cpu' : 'speech';
  if (question === 'cpu') return state.device === 'mac' && state.cpu === 'arm64' ? 'memory' : 'speech';
  throw new Error('Unknown capability question.');
}

/** Group the journey into chapters without claiming a fixed count of adaptive questions. @param {string} question @returns {number} */
export function questionChapter(question) {
  if (['language'].includes(question)) return 1;
  if (['device', 'prepare', 'memory', 'cpu', 'piModel'].includes(question)) return 2;
  if (question === 'speech') return 3;
  return 4;
}

/** Enable navigation for visited questions, review choices, platform panes, or edits. @param {string} question @param {number} trailLength @param {boolean} editing @param {string} pane @returns {boolean} */
export function canGoBack(question, trailLength, editing, pane = 'cards') {
  return question === 'review' || trailLength > 0 || editing || (question === 'device' && pane !== 'cards');
}

/** Describe four setup stages using accepted answers, including skipped hub speech. @param {string} question @param {object} state @param {Set<string>} answered @returns {object[]} */
export function progressStages(question,state,answered) {
  const hub=state.experience==='hub';
  const stages=[
    {label:'Language',detail:'Wizard & assistant',questions:['language']},
    {label:'Device',detail:'Hardware & system',questions:['device','prepare']},
    {label:'Speech',detail:'Voice processing',questions:['speech']},
    {label:'Install',detail:'Review & run',questions:[]},
  ];
  const current=questionChapter(question);
  return stages.map((stage,index)=>{
    const number=index+1;
    const skipped=hub&&number===3;
    const complete=number<4&&stage.questions.every(key=>answered.has(key))&&(number!==2||!!state.device);
    return {...stage,number,status:skipped?'skipped':number===current?'current':complete?'complete':'upcoming'};
  });
}

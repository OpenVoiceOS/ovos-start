/** Sourced project trivia; these are not recipe settings. */
export const PROJECT_FACTS = Object.freeze([
  {
    id: 'volunteers',
    text: 'OVOS core maintainers are volunteers. Spare time, now with a voice.',
    source: 'https://www.openvoiceos.org/contribution',
    sourceLabel: 'Meet the community',
  },
  {
    id: 'origins',
    text: 'OVOS began with Peter Steenbergen’s MycroftOS in 2018. Every voice has an origin story.',
    source: 'https://www.openvoiceos.org/about',
    sourceLabel: 'The OVOS story',
  },
  {
    id: 'wake-phrase',
    text: 'You can set “Hey computer” as a wake phrase. A little setup, a little sci-fi.',
    source: 'https://openvoiceos.github.io/beta-technical-manual/wake-word-plugins/#change-your-wake-word',
    sourceLabel: 'Explore wake phrases',
  },
  {
    id: 'space',
    text: 'An OVOS community skill tracks the Space Station. Now that’s looking up an answer.',
    source: 'https://github.com/OpenVoiceOS/ovos-skill-iss-location',
    sourceLabel: 'Meet the ISS skill',
  },
  {
    id: 'contribute',
    text: 'No coding required: translations, testing and clearer docs all help OVOS.',
    source: 'https://www.openvoiceos.org/contribution',
    sourceLabel: 'Find your way to help',
  },
  {
    id:'founding-trio',
    text:'Casimiro Ferreira, Aditya Mehra and Peter Steenbergen founded OVOS in 2020. Quite the opening trio.',
    source:'https://www.openvoiceos.org/about',sourceLabel:'Meet the beginnings',
  },
  {
    id:'daniel-neon',
    text:'NeonAI’s Daniel McKnight joined OVOS in 2021. Open-source neighbours, good teammates.',
    source:'https://www.openvoiceos.org/about',sourceLabel:'A shared history',
  },
  {
    id:'mike-easter-eggs',
    text:'Mike Gray helped revive the Easter Eggs skill. Movie references deserve a second act.',
    source:'https://github.com/OpenVoiceOS/ovos-skill-easter-eggs#credits',sourceLabel:'Roll the credits',
  },
  {
    id:'andlo-fairytales',
    text:'andlo’s 2018 fairytale skill reached ten languages. A story worth sharing.',
    source:'https://blog.openvoiceos.org/posts/2026-07-22-from-one-fairytale-skill-to-a-whole-reading-pipeline',sourceLabel:'Once upon a skill',
  },
  {
    id:'reading-pipeline',
    text:'Gaëtan Trellu and Jarbas helped spark a reading pipeline. It started with “what if?”.',
    source:'https://blog.openvoiceos.org/posts/2026-07-22-from-one-fairytale-skill-to-a-whole-reading-pipeline',sourceLabel:'How the idea grew',
  },
  {
    id:'menne-satellites',
    text:'Menne Bos built voice satellites in 3D-printed cases. DIY, right down to the shell.',
    source:'https://blog.openvoiceos.org/posts/2025-07-25-A-real-use-case-with-OVOS-and-Hivemind',sourceLabel:'Visit the workshop',
  },
  {
    id:'smartgic-tools',
    text:'Smart’Gic is behind ovos-installer and ovos-docker. Less setup wrestling for everyone.',
    source:'https://www.openvoiceos.org/friends',sourceLabel:'Meet the friends of OVOS',
  },
  {
    id:'localize',
    text:'OVOS Localize lets you help translate the project. No code, just words.',
    source:'https://www.openvoiceos.org/translation',sourceLabel:'Lend us your language',
  },
  {
    id:'portuguese-puns',
    text:'The joke skill adapts to your language. Portuguese gets puns. Of course it does.',
    source:'https://github.com/OpenVoiceOS/ovos-skill-icanhazdadjokes#about',sourceLabel:'Inspect the comedy department',
  },
  {
    id:'grandma-mode',
    text:'The Easter Eggs skill starts in “grandma mode”. Yes, manners are configurable.',
    source:'https://github.com/OpenVoiceOS/ovos-skill-easter-eggs#grandma-mode',sourceLabel:'Meet grandma mode',
  },
  {
    id:'foundation',
    text:'The Open Voice OS Foundation began in February 2025. A community with foundations.',
    source:'https://www.openvoiceos.org/about',sourceLabel:'The next chapter',
  },
  {
    id:'hivemind',
    text:'HiveMind connects more devices to one OVOS installation. More ears, one brain.',
    source:'https://www.openvoiceos.org/friends',sourceLabel:'Meet HiveMind',
  },
  {
    id:'timon-lego',
    text:'Timon van Hasselt and Peter Steenbergen explained OVOS with LEGO. Open source, meet building blocks.',
    source:'https://blog.openvoiceos.org/posts/2026-02-05-OpenVoiceOS-Speechday-2026',sourceLabel:'See the LEGO demo',
  },
  {
    id:'joergz-testing',
    text:'joergz spotted a HiveMind language glitch. Even a voice hub needs to mind its language.',
    source:'https://github.com/OpenVoiceOS/ovos-installer/pull/626',sourceLabel:'A tester’s report, a fix',
  },
  {
    id:'andlo-terminal',
    text:'andlo built a terminal client to test OVOS without a mic. Bug hunting, indoor voice optional.',
    source:'https://blog.openvoiceos.org/posts/2026-07-24-a-terminal-client-for-testing-ovos',sourceLabel:'Test without saying a word',
  },
  {
    id:'jeremy-randomness',
    text:'Jeremy Brodie helped OVOS roll dice and flip coins. Some decisions deserve a d20.',
    source:'https://github.com/OpenVoiceOS/ovos-skill-randomness#credits',sourceLabel:'Meet the randomness skill',
  },
  {
    id:'swen-nevermind',
    text:'Swen Gross helped teach OVOS “nevermind” in more languages. Changing your mind is international.',
    source:'https://github.com/OpenVoiceOS/ovos-utterance-plugin-cancel/pull/2',sourceLabel:'Nevermind, in translation',
  },
  {
    id:'suvan-back-buttons',
    text:'Suvan Banerjee added Back buttons to the installer’s first screens. Changing your mind is a feature.',
    source:'https://github.com/OpenVoiceOS/ovos-installer/pull/66',sourceLabel:'A small button, a helpful change',
  },
  {
    id:'parker-story',
    text:'Parker Seaman wrote OVOS’s 2023 history and joined as community manager. Every voice needs a storyteller.',
    source:'https://blog.openvoiceos.org/posts/2023-02-15-a-brief-history-of-open-voice-os',sourceLabel:'Read Parker’s history of OVOS',
  },
  {
    id:'flavio-intents',
    text:'Flávio De Melo developed an OVOS component that matches your words to a skill. Words into action.',
    source:'https://github.com/OpenVoiceOS/ovos-hierarchical-knn-pipeline/tree/dev#credits',sourceLabel:'How words find their skill',
  },
  {
      "id": "mycroft-mark1",
      "text": "Mycroft’s Mark I began on Kickstarter in 2015. Even little robots need a first hello.",
      "source": "https://blog.openvoiceos.org/posts/2023-02-15-a-brief-history-of-open-voice-os",
      "sourceLabel": "The first Mycroft"
  },
  {
      "id": "mycroft-mark2",
      "text": "The Mark II’s 2018 Kickstarter brought a touchscreen to the family. Now the voice had a face.",
      "source": "https://blog.openvoiceos.org/posts/2023-02-15-a-brief-history-of-open-voice-os",
      "sourceLabel": "Meet the Mark II"
  },
  {
      "id": "mycroft-kde",
      "text": "Mycroft’s first GUI grew with KDE developers in 2018. A little screen-time wisdom, passed on to OVOS.",
      "source": "https://blog.openvoiceos.org/posts/2023-02-15-a-brief-history-of-open-voice-os",
      "sourceLabel": "The story behind the screen"
  },
  {
      "id": "mycroft-skills",
      "text": "Most classic Mycroft skills also work on OVOS. Old friends, new home.",
      "source": "https://github.com/OpenVoiceOS/ovos-core#skills",
      "sourceLabel": "Mycroft skills live on"
  },
  {
      "id": "suvan-redesign",
      "text": "Suvan Banerjee helped redesign the website and blog. Even open-source voices enjoy a fresh look.",
      "source": "https://github.com/OpenVoiceOS/ovos-blogs/commit/58b5380b2e54bf7824fa79f8f1382fc65a67ec26",
      "sourceLabel": "Suvan’s blog redesign"
  },
  {
      "id": "daniel-wallpaper",
      "text": "Daniel McKnight fixed custom wallpaper loading. Your assistant has decorating plans.",
      "source": "https://github.com/OpenVoiceOS/ovos-PHAL-plugin-wallpaper-manager/pull/24",
      "sourceLabel": "A wallpaper fix from Daniel"
  },
  {
      "id": "gaetan-watchdog",
      "text": "Gaëtan Trellu added a Mark II screen watchdog. Even smart displays need a nudge sometimes.",
      "source": "https://github.com/OpenVoiceOS/ovos-installer/pull/654",
      "sourceLabel": "Keeping the Mark II screen awake"
  },
  {
      "id": "mike-stardates",
      "text": "Mike Gray fixed stardates in 15 languages. Space travel should be multilingual.",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-easter-eggs/pull/122",
      "sourceLabel": "Stardates across languages"
  },
  {
      "id": "jeremy-eyes",
      "text": "Jeremy Brodie helps maintain the Mark I’s eye-control skill. A little twinkle, open source.",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-mark1-ctrl/pull/3",
      "sourceLabel": "A twinkle for Mark I"
  },
  {
      "id": "timon-local",
      "text": "Timon van Hasselt demoed local speech at Speechday 2026. The cloud sat that conversation out.",
      "source": "https://blog.openvoiceos.org/posts/2026-02-05-OpenVoiceOS-Speechday-2026",
      "sourceLabel": "Timon’s Speechday report"
  },
].map(fact => Object.freeze(fact)));

/** Select an unseen fact, restarting only after the deck is exhausted.
 * @param {unknown} history Previously seen IDs. @param {Function} random Random source.
 * @returns {{fact:object,history:string[]}} Next card and browser-local history.
 */
export function nextTrivia(history = [], random = Math.random) {
  const ids=new Set(PROJECT_FACTS.map(fact=>fact.id));
  let seen=Array.isArray(history)?[...new Set(history.filter(id=>ids.has(id)))]:[];
  let available=PROJECT_FACTS.filter(fact=>!seen.includes(fact.id));
  if(!available.length){const last=seen.at(-1);seen=[];available=PROJECT_FACTS.filter(fact=>fact.id!==last);}
  const sample=Number(random());
  const index=Number.isFinite(sample)?Math.min(available.length-1,Math.max(0,Math.floor(sample*available.length))):0;
  const fact=available[index];
  return {fact,history:[...seen,fact.id]};
}

/** Recover only fact IDs, tolerating blocked storage or stale/corrupt preferences.
 * @param {Storage|null} storage Browser-local preferences. @returns {string[]}
 */
export function readTriviaHistory(storage) {
  try{const result=JSON.parse(storage?.getItem('ovos.trivia.v1')||'[]');return Array.isArray(result)?result:[];}catch{return [];}
}

/** Refresh the inline story and its source without replacing the focused control.
 * @param {HTMLElement} note Mounted trivia aside. @param {object} fact Sourced story.
 * @returns {void}
 */
export function updateTriviaNote(note, fact) {
  note.querySelector('[data-fact-text]').textContent=fact.text;
  const source=note.querySelector('a');
  source.href=fact.source;
  source.setAttribute('title',fact.sourceLabel);
}

/** Curated utterances from official starter-skill intents. Sources are pinned per phrase.
 * Missing language/intent coverage stays empty rather than promising translated commands.
 */
const examples={
  "en-us": [
    {
      "kind": "time",
      "label": "Time",
      "phrase": "What time is it?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/en-US/intents/what_time_is_it.intent#L317"
    },
    {
      "kind": "date",
      "label": "Date",
      "phrase": "What is the date?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/en-US/intents/current_date.intent#L88"
    },
    {
      "kind": "timer",
      "label": "Timer",
      "phrase": "Set a timer for 5 minutes",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-alerts/blob/7eb90b758e32514ebf7f3deb659aa6709272a1a0/locale/en-US/intent/create_timer.intent#L1"
    },
    {
      "kind": "weather",
      "label": "Weather",
      "phrase": "What is the weather like?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-weather/blob/796838f33ec7e0564a422c69925fa8ef8b1b78d3/locale/en-US/intents/weather.intent#L7"
    }
  ],
  "fr-fr": [
    {
      "kind": "time",
      "label": "Time",
      "phrase": "Quelle heure est-il ?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/fr-FR/intents/what_time_is_it.intent#L49"
    },
    {
      "kind": "date",
      "label": "Date",
      "phrase": "Quelle date sommes-nous ?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/fr-FR/intents/current_date.intent#L25"
    },
    {
      "kind": "timer",
      "label": "Timer",
      "phrase": "Lance un minuteur de 5 minutes",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-alerts/blob/7eb90b758e32514ebf7f3deb659aa6709272a1a0/locale/fr-FR/intent/create_timer.intent#L1"
    },
    {
      "kind": "weather",
      "label": "Weather",
      "phrase": "Quel temps fait-il ?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-weather/blob/796838f33ec7e0564a422c69925fa8ef8b1b78d3/locale/fr-FR/intents/weather.intent#L1"
    }
  ],
  "de-de": [
    {
      "kind": "time",
      "label": "Time",
      "phrase": "Wie spät ist es?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/de-DE/intents/what_time_is_it.intent#L1"
    },
    {
      "kind": "date",
      "label": "Date",
      "phrase": "Welches Datum ist heute?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/de-DE/intents/current_date.intent#L7"
    },
    {
      "kind": "timer",
      "label": "Timer",
      "phrase": "Starte einen Timer für 5 Minuten",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-alerts/blob/7eb90b758e32514ebf7f3deb659aa6709272a1a0/locale/de-DE/intent/create_timer.intent#L1"
    },
    {
      "kind": "weather",
      "label": "Weather",
      "phrase": "Wie ist das Wetter?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-weather/blob/796838f33ec7e0564a422c69925fa8ef8b1b78d3/locale/de-DE/intents/weather.intent#L15"
    }
  ],
  "es-es": [
    {
      "kind": "time",
      "label": "Time",
      "phrase": "¿Qué hora es?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/es-ES/intents/what_time_is_it.intent#L88"
    },
    {
      "kind": "date",
      "label": "Date",
      "phrase": "¿Cuál es la fecha de hoy?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/es-ES/intents/current_date.intent#L2"
    },
    {
      "kind": "timer",
      "label": "Timer",
      "phrase": "Pon un temporizador de 5 minutos",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-alerts/blob/7eb90b758e32514ebf7f3deb659aa6709272a1a0/locale/es-ES/intent/create_timer.intent#L1"
    },
    {
      "kind": "weather",
      "label": "Weather",
      "phrase": "¿Qué tiempo hace hoy?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-weather/blob/796838f33ec7e0564a422c69925fa8ef8b1b78d3/locale/es-ES/intents/weather.intent#L25"
    }
  ],
  "it-it": [
    {
      "kind": "time",
      "label": "Time",
      "phrase": "Che ore sono?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/it-IT/intents/what_time_is_it.intent#L2"
    },
    {
      "kind": "date",
      "label": "Date",
      "phrase": "Che giorno è?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/it-IT/intents/current_date.intent#L1"
    },
    {
      "kind": "timer",
      "label": "Timer",
      "phrase": "Imposta un timer di 5 minuti",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-alerts/blob/7eb90b758e32514ebf7f3deb659aa6709272a1a0/locale/it-IT/intent/create_timer.intent#L1"
    },
    {
      "kind": "weather",
      "label": "Weather",
      "phrase": "Che tempo fa adesso?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-weather/blob/796838f33ec7e0564a422c69925fa8ef8b1b78d3/locale/it-IT/intents/weather.intent#L4"
    }
  ],
  "nl-nl": [
    {
      "kind": "time",
      "label": "Time",
      "phrase": "Hoe laat is het?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/nl-NL/intents/what_time_is_it.intent#L8"
    },
    {
      "kind": "date",
      "label": "Date",
      "phrase": "Wat is de datum?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/nl-NL/intents/current_date.intent#L45"
    },
    {
      "kind": "timer",
      "label": "Timer",
      "phrase": "Zet een timer voor 5 minuten",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-alerts/blob/7eb90b758e32514ebf7f3deb659aa6709272a1a0/locale/nl-NL/intent/create_timer.intent#L1"
    },
    {
      "kind": "weather",
      "label": "Weather",
      "phrase": "Hoe is het weer nu?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-weather/blob/796838f33ec7e0564a422c69925fa8ef8b1b78d3/locale/nl-NL/intents/weather.intent#L10"
    }
  ],
  "pt-pt": [
    {
      "kind": "time",
      "label": "Time",
      "phrase": "Que horas são?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/pt-PT/intents/what_time_is_it.intent#L48"
    },
    {
      "kind": "date",
      "label": "Date",
      "phrase": "Qual é a data?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/pt-PT/intents/current_date.intent#L104"
    },
    {
      "kind": "timer",
      "label": "Timer",
      "phrase": "Inicia um temporizador de 5 minutos",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-alerts/blob/7eb90b758e32514ebf7f3deb659aa6709272a1a0/locale/pt-PT/intent/create_timer.intent#L1"
    },
    {
      "kind": "weather",
      "label": "Weather",
      "phrase": "Como está o tempo agora?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-weather/blob/796838f33ec7e0564a422c69925fa8ef8b1b78d3/locale/pt-PT/intents/weather.intent#L4"
    }
  ],
  "ca-es": [
    {
      "kind": "time",
      "label": "Time",
      "phrase": "Quina hora és?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/ca-ES/intents/what_time_is_it.intent#L100"
    },
    {
      "kind": "date",
      "label": "Date",
      "phrase": "Digues-me la data",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/ca-ES/intents/current_date.intent#L38"
    },
    {
      "kind": "timer",
      "label": "Timer",
      "phrase": "Posa un temporitzador de 5 minuts",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-alerts/blob/7eb90b758e32514ebf7f3deb659aa6709272a1a0/locale/ca-ES/intent/create_timer.intent#L1"
    },
    {
      "kind": "weather",
      "label": "Weather",
      "phrase": "Quin temps fa a fora?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-weather/blob/796838f33ec7e0564a422c69925fa8ef8b1b78d3/locale/ca-ES/intents/weather.intent#L35"
    }
  ],
  "eu-es": [
    {
      "kind": "time",
      "label": "Time",
      "phrase": "Zer ordu da?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/eu-ES/intents/what_time_is_it.intent#L65"
    },
    {
      "kind": "date",
      "label": "Date",
      "phrase": "Esadazu gaurko data",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/eu-ES/intents/current_date.intent#L2"
    },
    {
      "kind": "weather",
      "label": "Weather",
      "phrase": "Nolako eguraldia dago orain?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-weather/blob/796838f33ec7e0564a422c69925fa8ef8b1b78d3/locale/eu-ES/intents/weather.intent#L4"
    }
  ],
  "gl-es": [
    {
      "kind": "time",
      "label": "Time",
      "phrase": "Que hora é?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/gl-ES/intents/what_time_is_it.intent#L112"
    },
    {
      "kind": "date",
      "label": "Date",
      "phrase": "Cal é a data de hoxe?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-date-time/blob/361d6bfcb79ea2461612ee35605c8fc8e3f8334b/locale/gl-ES/intents/current_date.intent#L30"
    },
    {
      "kind": "timer",
      "label": "Timer",
      "phrase": "Pon un temporizador de 5 minutos",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-alerts/blob/7eb90b758e32514ebf7f3deb659aa6709272a1a0/locale/gl-ES/intent/create_timer.intent#L1"
    },
    {
      "kind": "weather",
      "label": "Weather",
      "phrase": "Como está o tempo agora?",
      "source": "https://github.com/OpenVoiceOS/ovos-skill-weather/blob/796838f33ec7e0564a422c69925fa8ef8b1b78d3/locale/gl-ES/intents/weather.intent#L155"
    }
  ],
  "hi-in": [],
  "kab-dz": []
};
export const STARTER_EXAMPLES=Object.freeze(Object.fromEntries(Object.entries(examples).map(([locale,items])=>[locale,Object.freeze(items.map(Object.freeze))])));

/** Localized terminal diagnostics; no recipe, identity or capability is included. */
export const LAUNCH_ERRORS={
  "ca-es": [
    "Aquesta ordre no està disponible o ha caducat. Torna a l’assistent i copia’n una de nova.",
    "El servei de descàrrega no està disponible ara mateix. Torna-ho a provar d’aquí a una estona."
  ],
  "de-de": [
    "Dieser Befehl ist nicht verfügbar oder abgelaufen. Kehre zum Assistenten zurück und kopiere einen neuen Befehl.",
    "Der Download-Dienst ist gerade nicht erreichbar. Versuche es in Kürze erneut."
  ],
  "en-us": [
    "This command is unavailable or expired. Return to the wizard and copy a new command.",
    "The download service is temporarily unavailable. Please try again shortly."
  ],
  "es-es": [
    "Este comando no está disponible o ha caducado. Vuelve al asistente y copia uno nuevo.",
    "El servicio de descarga no está disponible en este momento. Vuelve a intentarlo dentro de un rato."
  ],
  "eu-es": [
    "Komando hau ez dago erabilgarri edo iraungi egin da. Itzuli morroira eta kopiatu komando berri bat.",
    "Deskarga-zerbitzua ez dago erabilgarri une honetan. Saiatu berriro hemendik gutxira."
  ],
  "fr-fr": [
    "Cette commande est indisponible ou a expiré. Revenez à l’assistant pour en copier une nouvelle.",
    "Le téléchargement est temporairement indisponible. Réessayez dans un instant."
  ],
  "gl-es": [
    "Esta orde non está dispoñible ou caducou. Volve ao asistente e copia unha nova.",
    "O servizo de descarga non está dispoñible neste momento. Téntao de novo dentro dun pouco."
  ],
  "hi-in": [
    "यह कमांड उपलब्ध नहीं है या इसकी समय-सीमा समाप्त हो गई है। विज़ार्ड पर लौटकर नया कमांड कॉपी करें।",
    "डाउनलोड सेवा अभी उपलब्ध नहीं है। थोड़ी देर बाद फिर कोशिश करें।"
  ],
  "it-it": [
    "Questo comando non è disponibile o è scaduto. Torna alla procedura guidata e copiane uno nuovo.",
    "Il servizio di download è temporaneamente indisponibile. Riprova tra poco."
  ],
  "kab-dz": [
    "Taladna-a ur telli ara neɣ tfat. Uɣal ɣer umarag sakin nɣel taladna tamaynut.",
    "Ameẓlu n usader ur yelli ara akka tura. Ɛreḍ tikkelt nniḍen seld kra n wakud."
  ],
  "nl-nl": [
    "Deze opdracht is niet beschikbaar of verlopen. Ga terug naar de wizard en kopieer een nieuwe opdracht.",
    "De downloadservice is tijdelijk niet bereikbaar. Probeer het zo nog eens."
  ],
  "pt-pt": [
    "Este comando está indisponível ou expirou. Volta ao assistente e copia um novo.",
    "O serviço de descarga está temporariamente indisponível. Tenta novamente daqui a pouco."
  ]
};

/** Downloadable failure preserves a plain explanation and nonzero shell exit.
 * @param {string} locale Chosen language if known. @param {boolean} unavailable Service failure. @returns {string}
 */
export function launchError(locale="en-us",unavailable=false) {
  const message=(LAUNCH_ERRORS[locale]||LAUNCH_ERRORS["en-us"])[unavailable?1:0];
  const quoted="'"+message.replaceAll("'", "'\\''")+"'";
  return `(\nprintf '%s\\n' ${quoted} >&2\nexit 1\n)`;
}

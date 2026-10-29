/**
 * normenInRapport — welke Eurocodes de regel "Toegepaste normen" bovenin het
 * rekenrapport mag noemen.
 *
 * HET PROBLEEM
 * De uitgangspunten kenden drie normvinkjes waarvan er twee standaard aan
 * stonden. Een zuiver stalen raamwerk meldde daardoor in zijn kop "Eurocode 5
 * — Hout (EN 1995-1-1)": een norm die in dat werk nergens is toegepast, en dat
 * uitgerekend in het hoofdstuk dat de lezer vertelt waarop de berekening rust.
 * Een stand die niemand heeft gekozen mag niet als keuze van de constructeur
 * in het rapport verschijnen.
 *
 * WAAROM DE VINKJES DAN NIET GEWOON UIT KUNNEN
 * Het vinkje heeft een tweede, legitieme functie: vooruitlopen op wat er nog
 * getekend gaat worden. Wie EN 1995 bewust aanzet hoort hem te blijven zien,
 * ook in een model waar nog geen houten staaf in staat. "Aan omdat de
 * gebruiker hem aanzette" en "aan omdat het de standaardstand was" moeten dus
 * uit elkaar te houden zijn — en aan `en1995: true` alleen is dat niet te
 * zien. Daarom draagt de keuze een tweede veld: `normenHandmatig`, de lijst
 * normen waarover de gebruiker zelf een uitspraak heeft gedaan.
 *
 * DRIE STANDEN, GEEN TWEE — DE REDEN DAT DIT GEEN VINKJE MEER IS
 * Twee velden samen beschrijven DRIE standen (zie `NormStand`): "volgt het
 * model", "altijd vermelden" en "niet vermelden". Een aan/uit-vinkje kan er
 * maar twee tonen, en het perste "volgt het model" en "niet vermelden" in
 * hetzelfde lege hokje. Dat was geen schoonheidsfout maar een leugen op het
 * scherm: hetzelfde lege hokje leverde bij hout in het model de ene keer wél
 * en de andere keer géén EN 1995 in het rapport, zonder dat de gebruiker kon
 * zien welke van de twee hij voor zich had. Erger nog: wie één keer klikte
 * kwam nooit meer terug in "volgt het model", want een vinkje kan zijn eigen
 * spoor in `normenHandmatig` niet meer uitwissen. Daarom kent deze module de
 * stand expliciet (`normStanden`) en zet de dialoog hem met `zetNormStand`,
 * dat óók de weg terug kent.
 *
 * DE DRIE REGELS, in deze volgorde
 *  1. Er ligt een toetsresultaat voor die norm → noemen. Wat gedraaid is hoort
 *     verantwoord te worden; daar gaat geen keuze overheen.
 *  2. De gebruiker heeft zelf een stand gekozen → die geldt, aan én uit.
 *  3. Anders volgt de norm het MODEL: zit er materiaal van die soort in de
 *     staven, dan hoort de norm erbij, en anders niet.
 *
 * WAT DE GEBRUIKER DAARVAN TE ZIEN KRIJGT
 * Regel 1 overrulet zijn keuze. Een scherm dat "niet vermelden" toont terwijl
 * het rapport de norm tóch noemt, liegt opnieuw — daarom vertelt
 * `normOordelen` de dialoog per norm welke van de drie regels het wint, zodat
 * ze "toch vermeld: er is op getoetst" kan tonen in plaats van te zwijgen.
 *
 * BESTAANDE PROJECTBESTANDEN
 * Daarin staat `normenHandmatig` niet. Dat leest hier als "de gebruiker heeft
 * over geen enkele norm iets gezegd", waarna alle drie de normen het model
 * volgen — precies de eerlijke uitleg van een stand die niemand heeft gekozen.
 * Zulke bestanden hoeven niet gemigreerd te worden en verliezen niets: doet de
 * gebruiker één uitspraak, dan telt die meteen.
 *
 * DE VRAAG IS "WORDT DEZE NORM TOEGEPAST", NIET "KAN HIJ VAN PAS KOMEN"
 * Bij twijfel valt een norm hier weg, andersom dan bij `sectieRelevantie`.
 * Daar kost een overbodig hoofdstuk een halve bladzijde; hier kost een
 * overbodige norm de geloofwaardigheid van de uitgangspunten. Een staaf met
 * een onbekend materiaal en een vrij materiaal ("VRIJ: …", geen norm maar
 * eigen getallen) brengen daarom géén norm mee.
 */
import type { Beam } from "../components/fem/femTypes";
import { materiaalVanStaaf, type StaafMateriaal } from "./staafMateriaal";

export const NORM_SLEUTELS = ["en1993", "en1995", "en1992"] as const;

export type NormSleutel = (typeof NORM_SLEUTELS)[number];

/** Per norm: hoort hij in deze regel thuis? */
export type NormVlaggen = Record<NormSleutel, boolean>;


/**
 * Verse vlaggenset. Bewust geen gedeelde constante: het rapport rekent dit per
 * render uit en één per ongeluk gemuteerd gedeeld object zou daarna in élk
 * rapport blijven staan.
 */
function leeg(): NormVlaggen {
  return { en1993: false, en1995: false, en1992: false };
}

/**
 * De norm waaronder een staafmateriaal valt.
 *
 * Kruislaaghout gaat hier bij EN 1995, dezelfde afspraak als de toetsbasis in
 * de voetregel (`usedNorms` rekent elk niet-stalen, niet-betonnen resultaat
 * tot hout). Een vrij materiaal heeft geen norm: de gebruiker geeft daar zelf
 * E en de toelaatbare spanning, en de spanningstoets die erop draait is geen
 * normtoetsing.
 */
export function normVanMateriaal(soort: StaafMateriaal): NormSleutel | null {
  switch (soort) {
    case "staal":
      return "en1993";
    case "hout":
    case "clt":
      return "en1995";
    case "beton":
      return "en1992";
    default:
      return null;
  }
}

/** Welke normen het MODEL zelf aandraagt: de materialen van de staven. */
export function normenInModel(beams: Beam[]): NormVlaggen {
  const uit = leeg();
  for (const beam of beams) {
    const norm = normVanMateriaal(materiaalVanStaaf(beam));
    if (norm !== null) uit[norm] = true;
  }
  return uit;
}


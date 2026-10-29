/**
 * betonMateriaal — betonsterkteklassen en wapeningsstaal herkennen en een
 * betondoorsnede uit de profielnaam lezen (rechthoek, T, L). Mechanica
 * (materiaal- en doorsnedegegevens voor de solver), geen toetsing. Stond
 * eerder in `betonCheckBuilder.ts`, dat de namen nog steeds doorgeeft.
 */
import type { ConcreteSectionInput } from "./types/concrete/ConcreteSectionInput";
import type { ConcreteShape } from "./types/concrete/ConcreteShape";

/**
 * Betonsterkteklassen die de Rust EN 1992-kern kent (nen-en-1992-1-1/data.rs,
 * tabel 3.1). Browser-fallback voor `list_concrete_classes`.
 */
export const SUPPORTED_CONCRETE_CLASSES = [
  "C12/15", "C16/20", "C20/25", "C25/30", "C30/37", "C35/45", "C40/50",
  "C45/55", "C50/60", "C55/67", "C60/75", "C70/85", "C80/95", "C90/105",
] as const;

/** Wapeningsstaal dat de kern kent (bijlage C, klasse A/B/C). */
export const SUPPORTED_REINFORCEMENT_GRADES = ["B500A", "B500B", "B500C"] as const;

/** Standaard wapeningsstaal voor staven in Nederland. */
export const DEFAULT_REINFORCEMENT_GRADE = "B500B";

/** Standaardaantal stroken (nen-en-1992-1-1/mnkappa.rs: DEFAULT_N_STRIPS). */
export const DEFAULT_N_STRIPS = 50;

/** Generieke betonnamen zonder sterkteklasse — niet toetsbaar. */
export const GENERIC_CONCRETE_NAMES = ["concrete", "beton", "reinforced concrete", "gewapend beton"];

/**
 * Match een materiaalnaam op een ondersteunde betonsterkteklasse — alleen op
 * de VOLLEDIGE naam ("C30/37"); spaties en hoofdletters doen niet mee.
 *
 * Tot september 2026 telde de korte naam ook: "C30" gaf "C30/37". Maar "C16",
 * "C20", "C30" en "C35" zijn houtsterkteklassen (EN 338), en `resolveSection`
 * rekende zo'n staaf al als hout (E = 12 000 N/mm², eigen gewicht van hout)
 * terwijl deze bouwer hem als beton toetste — een spooktoets op de verkeerde
 * stijfheid, zonder melding (basisaudit nr 16). De Rust-kant
 * (`is_betonklasse` in fem_tools.rs) hanteerde al de volledige naam; nu doet
 * de bouwer dat ook. Wie beton bedoelt, schrijft "C30/37"; de kiezers in de
 * app doen dat al. De dubbelzinnige naam zelf wordt gemeld door
 * `lib/materiaalDubbelzinnig.ts` (modelcontrole en MCP-poort).
 */
export function matchSupportedConcreteClass(
  materialName: string | undefined,
  supportedClasses: readonly string[] = SUPPORTED_CONCRETE_CLASSES,
): string | null {
  if (!materialName) return null;
  const gezocht = materialName.replace(/\s/g, "").toLowerCase();
  if (!gezocht) return null;
  const hit = supportedClasses.find((c) => c.toLowerCase() === gezocht);
  return hit ?? null;
}

/**
 * Herken een rechthoekige betondoorsnede b × h (mm) uit de profielnaam:
 * "300x500", "300 x 500", "300×500" (conventie: b×h).
 *
 * Blijft bestaan náást `parseConcreteSection`: de rechthoek is de enige vorm
 * waarvan boven- en onderrand samenvallen met b en h, en verschillende
 * aanroepers (de doorsnedetekening in het rapport, de eigenschappenbalk)
 * hebben alleen die twee getallen nodig.
 */
export function parseConcreteRectMm(
  profileName: string | undefined,
): { bMm: number; hMm: number } | null {
  const name = profileName?.trim();
  if (!name) return null;
  const m = /^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)$/i.exec(name);
  if (!m) return null;
  const bMm = parseFloat(m[1].replace(",", "."));
  const hMm = parseFloat(m[2].replace(",", "."));
  if (bMm > 0 && hMm > 0) return { bMm, hMm };
  return null;
}

// ── De profielnaam van een betondoorsnede ──────────────────────────────────
//
// DE CONVENTIE, EN WAAROM DEZE
//
//   rechthoek   "300x500"                        b × h
//   T-ligger    "T 400x450 bw=200 hf=50"         b_f × h, lijf, flensdikte
//   L-ligger    "L 400x450 bw=200 hf=50"         idem
//   omgekeerd   "T 400x450 bw=200 hf=50 flens=onder"
//
// Dit model slaat geen numerieke doorsnede-eigenschappen per staaf op: de
// profielNAAM is de enige plaats waar de doorsnede staat, en die reist
// vanzelf mee in het projectbestand, de undo-historie, de staventabel en het
// rapport. Kruislaaghout doet hetzelfde ("CLT 40/20/40 b=1000"), een eigen
// doorsnede ook ("EIGEN:<naam>") en een vrij materiaal ook
// ("VRIJ:… E=… rho=…"). Vandaar dezelfde grammatica als daar: een kort
// voorvoegsel dat de vorm noemt, de hoofdmaten als "b x h", en de overige
// maten als benoemde sleutels.
//
// Vier getallen POSITIONEEL achter elkaar ("T 400/450/200/50") zou korter zijn
// maar niet na te lezen: welke van de twee laatste is de lijfbreedte? De
// sleutels bw en hf zijn de symbolen uit de norm (b_w, h_f), zodat de naam en
// de berekening dezelfde woorden gebruiken.
//
// EEN NAAM DIE NIET PARSEERT GEEFT EEN REDEN. Stil overslaan zou betekenen dat
// een staaf ongetoetst blijft omdat er "T 400x450" staat zonder lijfbreedte,
// en dat de gebruiker dat pas merkt als hij het rapport naleest.

/** De vormvoorvoegsels, met de `ConcreteShape` die erbij hoort. */
const VORM_VOORVOEGSEL: Record<string, ConcreteShape> = { T: "Tee", L: "Ell" };

/** Voorbeeldnamen voor in een foutmelding. */
export const BETON_PROFIEL_VOORBEELDEN =
  '"300x500" (rechthoek), "T 400x450 bw=200 hf=50" (T-ligger) of "L 400x450 bw=200 hf=50" (L-ligger)';

export type DoorsnedeUitkomst =
  | { ok: true; doorsnede: ConcreteSectionInput }
  | { ok: false; reden: string };

function getal(t: string): number {
  return parseFloat(t.replace(",", "."));
}

/**
 * Profielnaam → de doorsnede zoals de kern hem verwacht, of een reden waarom
 * die naam er geen oplevert.
 *
 * Er wordt hier niets aangevuld: een T zonder `bw=` krijgt geen aangenomen
 * lijfbreedte maar een melding. Een verzonnen lijfbreedte zou de weerstand,
 * de stijfheid, het scheurmoment én de tweede orde sturen zonder dat iemand
 * het ziet.
 */
export function parseConcreteSection(profileName: string | undefined): DoorsnedeUitkomst {
  const naam = profileName?.trim();
  if (!naam) {
    return { ok: false, reden: `er is geen doorsnede opgegeven — gebruik ${BETON_PROFIEL_VOORBEELDEN}` };
  }

  const rect = parseConcreteRectMm(naam);
  if (rect) {
    return {
      ok: true,
      doorsnede: {
        shape: "Rectangle",
        b_mm: rect.bMm,
        h_mm: rect.hMm,
        b_w_mm: null,
        h_f_mm: null,
        flange_at_bottom: false,
      },
    };
  }

  const kop = /^([TL])\s+(.*)$/i.exec(naam);
  if (!kop) {
    return {
      ok: false,
      reden: `doorsnede "${naam}" is geen herkenbare betondoorsnede — gebruik ${BETON_PROFIEL_VOORBEELDEN}`,
    };
  }
  const shape = VORM_VOORVOEGSEL[kop[1].toUpperCase()];
  const rest = kop[2].trim();

  const maten = /^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(.*)$/i.exec(rest);
  if (!maten) {
    return {
      ok: false,
      reden: `doorsnede "${naam}": na "${kop[1].toUpperCase()}" horen de flensbreedte en de totale hoogte te staan als "b×h", bijvoorbeeld "${kop[1].toUpperCase()} 400x450 bw=200 hf=50"`,
    };
  }
  const bMm = getal(maten[1]);
  const hMm = getal(maten[2]);

  let bW: number | null = null;
  let hF: number | null = null;
  let flensOnder = false;
  const tokens = maten[3].trim().split(/\s+/).filter((t) => t.length > 0);
  for (const token of tokens) {
    const kv = /^([A-Za-z_]+)\s*=\s*(.+)$/.exec(token);
    if (!kv) {
      return {
        ok: false,
        reden: `doorsnede "${naam}": "${token}" is geen sleutel=waarde — verwacht bw=…, hf=… of flens=onder`,
      };
    }
    const sleutel = kv[1].toLowerCase();
    const waarde = kv[2];
    if (sleutel === "bw") bW = getal(waarde);
    else if (sleutel === "hf") hF = getal(waarde);
    else if (sleutel === "flens") {
      const w = waarde.toLowerCase();
      if (w !== "onder" && w !== "boven") {
        return {
          ok: false,
          reden: `doorsnede "${naam}": flens="${waarde}" bestaat niet — gebruik flens=onder of flens=boven (standaard boven)`,
        };
      }
      flensOnder = w === "onder";
    } else {
      return {
        ok: false,
        reden: `doorsnede "${naam}": sleutel "${kv[1]}" is onbekend — verwacht bw=…, hf=… of flens=onder`,
      };
    }
  }

  const vorm = shape === "Tee" ? "T-vorm" : "L-vorm";
  if (bW === null) {
    return { ok: false, reden: `doorsnede "${naam}": de ${vorm} mist de lijfbreedte — voeg bw=… toe (in mm)` };
  }
  if (hF === null) {
    return { ok: false, reden: `doorsnede "${naam}": de ${vorm} mist de flensdikte — voeg hf=… toe (in mm)` };
  }
  // Dezelfde grenzen als `ConcreteSectionInput::build` in de kern, zodat de
  // melding hier komt en niet pas als de kern het verzoek terugstuurt.
  if (!(bMm > 0 && hMm > 0 && bW > 0 && hF > 0)) {
    return { ok: false, reden: `doorsnede "${naam}": alle maten moeten groter dan nul zijn` };
  }
  if (bW >= bMm) {
    return {
      ok: false,
      reden: `doorsnede "${naam}": de lijfbreedte bw=${bW} is niet kleiner dan de flensbreedte ${bMm} — dan is het een rechthoek, schrijf "${bMm}x${hMm}"`,
    };
  }
  if (hF >= hMm) {
    return {
      ok: false,
      reden: `doorsnede "${naam}": de flensdikte hf=${hF} laat geen lijf over binnen de hoogte ${hMm}`,
    };
  }

  return {
    ok: true,
    doorsnede: {
      shape,
      b_mm: bMm,
      h_mm: hMm,
      b_w_mm: bW,
      h_f_mm: hF,
      flange_at_bottom: flensOnder,
    },
  };
}

/**
 * De doorsnede terug naar een profielnaam. De editor schrijft hiermee naar
 * `beam.profile`; `parseConcreteSection` leest hem weer.
 */
export function formatConcreteSection(d: ConcreteSectionInput): string {
  const n = (v: number) => (Number.isInteger(v) ? String(v) : String(v).replace(".", ","));
  if (d.shape === "Rectangle") return `${n(d.b_mm)}x${n(d.h_mm)}`;
  const letter = d.shape === "Tee" ? "T" : "L";
  const staart = d.flange_at_bottom ? " flens=onder" : "";
  return `${letter} ${n(d.b_mm)}x${n(d.h_mm)} bw=${n(d.b_w_mm ?? 0)} hf=${n(d.h_f_mm ?? 0)}${staart}`;
}

/** Is dit een betondoorsnede met een flens (T of L)? */
export function isFlensProfiel(profileName: string | undefined): boolean {
  return /^\s*[TL]\s+\d/i.test(profileName ?? "");
}

/**
 * De doorsnedeNAAM uit een KERNRESULTAAT terug naar de doorsnede.
 *
 * Dit is een andere grammatica dan de profielnaam hierboven: hij komt uit
 * `ConcreteSection::name()` in de kern en luidt "300 x 500" of
 * "T 400 x 450 (flens 400 x 50, lijf 200)", met " onder" achter de flensdikte
 * bij een omgekeerde T. Het rapport heeft hem nodig omdat een resultaat de
 * maten niet los draagt — alleen deze naam, en die is dus ook de plaats waar
 * de gebruikte b_eff staat.
 *
 * `null` als de naam niet past; het rapport laat de tekening dan weg in
 * plaats van een verzonnen doorsnede te tekenen.
 */
export function parseSectionNaam(naam: string | undefined): ConcreteSectionInput | null {
  const t = naam?.trim();
  if (!t) return null;
  const rect = /^(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)$/i.exec(t);
  if (rect) {
    const b = getal(rect[1]);
    const h = getal(rect[2]);
    if (!(b > 0 && h > 0)) return null;
    return { shape: "Rectangle", b_mm: b, h_mm: h, b_w_mm: null, h_f_mm: null, flange_at_bottom: false };
  }
  const flens =
    /^([TL])\s+(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*\(flens\s+\d+(?:[.,]\d+)?\s*x\s*(\d+(?:[.,]\d+)?)(\s+onder)?,\s*lijf\s+(\d+(?:[.,]\d+)?)\)$/i.exec(
      t,
    );
  if (!flens) return null;
  const b = getal(flens[2]);
  const h = getal(flens[3]);
  const hF = getal(flens[4]);
  const bW = getal(flens[6]);
  if (!(b > 0 && h > 0 && hF > 0 && bW > 0)) return null;
  return {
    shape: flens[1].toUpperCase() === "T" ? "Tee" : "Ell",
    b_mm: b,
    h_mm: h,
    b_w_mm: bW,
    h_f_mm: hF,
    flange_at_bottom: flens[5] !== undefined,
  };
}

/**
 * staafMeetkunde — meetkunde van een staaf in het 2D-model: lengte, richting,
 * helling en de collineaire voortzettingen. Mechanica, geen toetsing: het
 * tekenvlak, de eigenschappen, de IFC-export en het rapport gebruiken dit net
 * zo goed als de toetsbouwers. Stond eerder in `steelCheckBuilder.ts`, dat de
 * namen nog steeds doorgeeft.
 */
import type { Beam, Node, Support } from "../components/fem/femTypes";

/** Eenheidsrichting van een staaf, of `null` als de knopen ontbreken/samenvallen. */
function beamDirection(beam: Beam, nodes: Node[]): { x: number; z: number } | null {
  const a = nodes.find((n) => n.id === beam.from);
  const b = nodes.find((n) => n.id === beam.to);
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l = Math.hypot(dx, dz);
  if (l <= 0) return null;
  return { x: dx / l, z: dz / l };
}

/**
 * Staaf-ids die in het verlengde van `beam` liggen: ze delen een knoop, lopen
 * in dezelfde richting (of exact tegengesteld), hebben hetzelfde profiel en
 * hetzelfde materiaal, en op die gedeelde knoop staat geen oplegging.
 *
 * De richtingstolerantie is 1e-6 op het uitwendig product van de
 * eenheidsrichtingen — dat is ~0,00006°, dus alleen echt collineaire staven.
 * Een portaal (ligger + kolom) valt daar ruim buiten en geeft dus geen melding.
 */
export function collinearContinuations(
  beam: Beam,
  nodes: Node[],
  beams: Beam[],
  supports: Support[] | undefined,
): number[] {
  const dir = beamDirection(beam, nodes);
  if (!dir) return [];
  const opgelegd = new Set((supports ?? []).map((s) => s.nodeId));
  const uit: number[] = [];
  for (const other of beams) {
    if (other.id === beam.id) continue;
    const gedeeld = [beam.from, beam.to].filter(
      (n) => n === other.from || n === other.to,
    );
    // Precies één gedeelde knoop: twee gedeelde knopen zou een dubbele staaf
    // zijn, en dat is een modelfout die de modelcontrole meldt, niet deze.
    if (gedeeld.length !== 1) continue;
    if (opgelegd.has(gedeeld[0])) continue;
    if ((other.profile ?? "") !== (beam.profile ?? "")) continue;
    if ((other.material ?? "") !== (beam.material ?? "")) continue;
    // Een VERLOPENDE staaf wordt nooit met een buur samengevoegd. De virtuele
    // staaf van een doorgaande lijn erft `profile` en `profileEnd` van het
    // eerste deel; het verloop zou dan over de hele lijn worden uitgesmeerd en
    // elk deel een andere doorsnede krijgen dan het model laat zien. Delen
    // blijven dus apart getoetst — hun staafeinden gelden dan als
    // `Doorlopend`, waarop de kern de kiptoets met reden weigert in plaats van
    // een verkeerd getal te geven.
    if ((other.profileEnd ?? "") !== "" || (beam.profileEnd ?? "") !== "") continue;
    const d2 = beamDirection(other, nodes);
    if (!d2) continue;
    if (Math.abs(dir.x * d2.z - dir.z * d2.x) > 1e-6) continue;
    uit.push(other.id);
  }
  return uit.sort((a, b) => a - b);
}

/** Staaflengte in mm uit de knoopcoördinaten. */
export function beamLengthMm(beam: Beam, nodes: Node[]): number {
  const a = nodes.find((n) => n.id === beam.from);
  const b = nodes.find((n) => n.id === beam.to);
  if (!a || !b) return 0;
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/** Hoek van een staaf met de horizontaal, 0°..90°. `null` = geen richting. */
export function hellingGradenVanStaaf(beam: Beam, nodes: Node[]): number | null {
  const d = beamDirection(beam, nodes);
  if (!d) return null;
  return (Math.atan2(Math.abs(d.z), Math.abs(d.x)) * 180) / Math.PI;
}

/**
 * Vanaf welke hellingshoek een staaf "overwegend verticaal" heet.
 *
 * 75° is dezelfde grens die `bepaalStandaardRol` (femTypes.ts) al hanteert om
 * een gevelstijl of kolom van een ligger te onderscheiden. Twee verschillende
 * drempels in één app zou betekenen dat dezelfde staaf in de staaftypentabel
 * een kolom is en in de doorbuigingstoets niet.
 */
export const VERTICAAL_VANAF_GRADEN = 75;

export function isOverwegendVerticaal(beam: Beam, nodes: Node[]): boolean {
  const helling = hellingGradenVanStaaf(beam, nodes);
  return helling !== null && helling >= VERTICAAL_VANAF_GRADEN;
}

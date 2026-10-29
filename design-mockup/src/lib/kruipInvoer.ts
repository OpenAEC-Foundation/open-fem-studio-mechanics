/**
 * kruipInvoer — de projectgegevens voor de kruipcoëfficiënt (bijlage B van
 * NEN-EN 1992-1-1): vochtigheid, ouderdom bij belasten en cementklasse. Alleen
 * de VORM van de projectdata (lezen, beginwaarden), zodat een projectbestand
 * ze in elke editie ongeschonden bewaart. Stond eerder in
 * `kruipcoefficient.ts`, dat de namen nog doorgeeft.
 */
import type { CementClass } from "./types/concrete/CementClass";

/**
 * De projectinvoer voor φ(∞,t₀) volgens bijlage B. De fictieve dikte h₀ staat
 * er NIET in: die hoort bij de doorsnede van elke staaf (B.6).
 */
export interface KruipInvoerProject {
  /** Relatieve vochtigheid van de omgeving, % (bijvoorbeeld 50 binnen, 80 buiten). */
  rhProcent: number;
  /** Ouderdom van het beton bij belasten, dagen. */
  t0Dagen: number;
  /** Cementklasse volgens art. 3.1.2(6). */
  cementklasse: CementClass;
}

export const CEMENTKLASSEN: readonly CementClass[] = ["S", "N", "R"];

/**
 * De beginwaarden als de gebruiker bijlage B aanzet: het binnenmilieu van
 * figuur 3.1a (RH 50 %), belasten na 28 dagen, cement N. Het zijn zichtbare,
 * direct aan te passen invulwaarden en geen stille aanname: zolang bijlage B
 * uit staat, wordt er niets berekend.
 */
export const STANDAARD_KRUIPINVOER: KruipInvoerProject = {
  rhProcent: 50,
  t0Dagen: 28,
  cementklasse: "N",
};

/**
 * Is deze invoer bruikbaar, of komt hij uit een beschadigd of ouder bestand?
 * Alleen de VORM wordt hier bekeken; de grenzen (RH ≤ 100, t₀ > 0) bewaakt de
 * kern, met reden.
 */
export function leesKruipInvoer(waarde: unknown): KruipInvoerProject | null {
  if (!waarde || typeof waarde !== "object") return null;
  const w = waarde as Record<string, unknown>;
  if (typeof w.rhProcent !== "number" || !Number.isFinite(w.rhProcent)) return null;
  if (typeof w.t0Dagen !== "number" || !Number.isFinite(w.t0Dagen)) return null;
  if (!CEMENTKLASSEN.includes(w.cementklasse as CementClass)) return null;
  return {
    rhProcent: w.rhProcent,
    t0Dagen: w.t0Dagen,
    cementklasse: w.cementklasse as CementClass,
  };
}

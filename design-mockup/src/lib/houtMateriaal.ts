/**
 * houtMateriaal — houtsterkteklassen herkennen en een rechthoekige
 * houtdoorsnede uit de profielnaam lezen. Mechanica (materiaal- en
 * doorsnedegegevens), geen toetsing. Stond eerder in `timberCheckBuilder.ts`,
 * dat de namen nog steeds doorgeeft.
 */

/**
 * Sterkteklassen die de Rust EN 1995-kern kent (nen-en-1995-1-1/data.rs):
 * EN 338 naaldhout C14–C35 en EN 14080 gelamineerd hout GL24h–GL36h.
 * Browser-fallback voor `list_timber_grades`.
 */
export const SUPPORTED_TIMBER_GRADES = [
  "C14", "C16", "C18", "C20", "C22", "C24", "C27", "C30", "C35",
  "GL24h", "GL28h", "GL32h", "GL36h",
] as const;

/** Wel herkenbaar als hout, maar (nog) zonder normdata: EN 338 loofhout. */
export const UNSUPPORTED_TIMBER_GRADES = ["D30", "D35", "D40", "D50", "D60", "D70"];

/** Generieke houtnamen zonder sterkteklasse — niet toetsbaar. */
export const GENERIC_TIMBER_NAMES = ["timber (softwood)", "timber (hardwood)", "wood", "hout"];

/** Match een materiaalnaam op een ondersteunde sterkteklasse. */
export function matchSupportedTimberGrade(
  materialName: string | undefined,
  supportedGrades: readonly string[] = SUPPORTED_TIMBER_GRADES,
): string | null {
  if (!materialName) return null;
  const trimmed = materialName.trim();
  const hit = supportedGrades.find((g) => g.toLowerCase() === trimmed.toLowerCase());
  return hit ?? null;
}

/**
 * Herken een rechthoekige houtdoorsnede b × h (mm) uit de profielnaam:
 * "38x89 SLS", "60x100 GL", of kaal "96x450" (conventie: b×h).
 */
export function parseTimberRectMm(
  profileName: string | undefined,
): { bMm: number; hMm: number } | null {
  const name = profileName?.trim();
  if (!name) return null;
  const m = /^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)(?:\s+(?:SLS|EU|CLS|GL))?$/i.exec(name);
  if (!m) return null;
  const bMm = parseFloat(m[1].replace(",", "."));
  const hMm = parseFloat(m[2].replace(",", "."));
  if (bMm > 0 && hMm > 0) return { bMm, hMm };
  return null;
}

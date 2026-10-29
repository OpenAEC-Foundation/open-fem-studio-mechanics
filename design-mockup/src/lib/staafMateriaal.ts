/**
 * staafMateriaal — de materiaalsoort van een staaf (staal, hout, beton, CLT,
 * vrij). Stond eerder in `variantInvoer.ts`, dat de namen nog doorgeeft.
 */
import type { Beam } from "../components/fem/femTypes";
import { isSteelProfile } from "./staalProfiel";
import { matchSupportedTimberGrade } from "./houtMateriaal";
import { matchSupportedConcreteClass } from "./betonMateriaal";
import { isCltProfiel } from "./cltDoorsnede";
import { isVrijMateriaal } from "./vrijMateriaal";

/** Materiaalsoort van een staaf. */
export type StaafMateriaal = "staal" | "hout" | "beton" | "clt" | "vrij" | "onbekend";

/**
 * Het materiaal van een staaf uit zijn materiaal- en profielnaam. Een vrij
 * materiaal en een CLT-opbouw worden er eerst uitgehaald, want hun profiel
 * respectievelijk hun materiaal zou anders bij de verkeerde soort belanden.
 */
export function materiaalVanStaaf(beam: Beam): StaafMateriaal {
  if (isVrijMateriaal(beam.material)) return "vrij";
  if (isCltProfiel(beam.profile)) return "clt";
  if (matchSupportedConcreteClass(beam.material) !== null) return "beton";
  if (matchSupportedTimberGrade(beam.material) !== null) return "hout";
  if (isSteelProfile(beam.profile)) return "staal";
  return "onbekend";
}

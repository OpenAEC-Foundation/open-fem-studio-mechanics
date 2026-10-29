/**
 * staalProfiel — is een profielnaam staal uit de profieldatabase, en onder
 * welke sleutel staat hij daarin. Mechanica (profielbibliotheek), geen
 * toetsing. Stond eerder in `steelCheckBuilder.ts`, dat de namen nog steeds
 * doorgeeft.
 */
import { isEigenProfiel } from "./profieleditor/eigenDoorsnedenStore";
import { STEEL_SECTIONS } from "./steelSections.generated";
import { profielSleutel } from "./strip";

/**
 * Is dit een staalprofiel dat de EN 1993-kern kan toetsen?
 *
 * HERKEND AAN DE PROFIELDATABASE, NIET AAN EEN VOORVOEGSEL. Hier stond een
 * lijst voorvoegsels (HEA, HEB, HEM, IPE, UPE, UNP, RHS, SHS, HFRHS, KKR, CHS).
 * De profieldatabase kent er meer: INP (21 profielen), DIE (30), DIL (22),
 * DIN (30) en L (57). Die 160 profielen bood de profielkiezer wél aan en
 * rekende de solver wél mee, maar de toetsing sloeg ze over — in de app met de
 * misleidende reden "niet herkend als staal", en in de MCP-weg zonder enig
 * spoor. Een lijst naast de database loopt vroeg of laat achter; de database
 * zelf niet.
 *
 * `STEEL_SECTIONS` is uit `steel-profiles/data/profiles.json` gegenereerd, met
 * dezelfde sleutelnormalisatie als `lookup_key` in de Rust-crate (hoofdletters,
 * zonder spaties, koppeltekens en punten) — dus precies de set die de kern bij
 * een toetsing terugvindt, ook zonder dat de database al is opgehaald.
 */
export function isSteelProfile(profileName: string | undefined): boolean {
  if (!profileName) return false;
  // Een eigen doorsnede uit de profieleditor is staal en gaat als
  // `custom_section` naar dezelfde kern.
  if (isEigenProfiel(profileName)) return true;
  return profileLookupKey(profileName) in STEEL_SECTIONS;
}

/**
 * Zoeksleutel voor profielnamen — spiegel van `lookup_key` in de Rust
 * steel-profiles crate: spaties/koppeltekens/punten eruit, hoofdletters.
 * Zo matcht "HEA160" uit dit model op "HEA 160" in de database. Massief rond
 * geschreven als "Ø24" of "ROND 24" krijgt de sleutel van "RD 24" (zie
 * `lib/rondStaal.ts`), en platstaal als "FL 80x10" of "Platstaal 80x10" die
 * van "Strip 80x10" (zie `lib/strip.ts`), net als in de kern.
 */
export function profileLookupKey(name: string): string {
  return profielSleutel(name);
}

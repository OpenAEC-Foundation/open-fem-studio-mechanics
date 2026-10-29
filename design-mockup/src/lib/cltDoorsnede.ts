/**
 * cltDoorsnede — kruislaaghout als doorsnede: de profielnaam lezen en
 * schrijven, de voorinstellingen, en de doorsnedemechanica (effectieve EA/EI,
 * spannings- en schuifspanningsverloop over de lagen) voor de solver en de
 * tekening. Mechanica, geen toetsing. Stond eerder in `cltCheckBuilder.ts`,
 * dat de namen nog steeds doorgeeft.
 */
import type { CltLayup } from "./types/timber/CltLayup";
import type { CltLayer } from "./types/timber/CltLayer";
import type { CltLayerOrientation } from "./types/timber/CltLayerOrientation";
import type { CltLayupResult } from "./types/timber/CltLayupResult";
import type { CltPreset } from "./types/timber/CltPreset";

/** Standaard strookbreedte van een CLT-plaat in het 2D-model (per meter). */
export const CLT_STROOKBREEDTE_MM = 1000;

/**
 * Standaardopbouwen — GEGENEREERD uit de Rust-kern (`clt_presets()` in
 * `nen-en-1995-1-1/src/clt.rs`), de bron die ook het command
 * `list_clt_presets`, de toetsbrug en de MCP-server bedienen.
 *
 * Waarom een gegenereerde lijst en niet een aanroep van de kern: de
 * profielkiezer moet ook werken zonder gebouwde kern (browser, dev-server),
 * dus een lijst in TypeScript blijft nodig. Die met de hand gelijk houden ging
 * eerder mis; nu schrijft de generator hem uit de kern.
 *
 * Bijwerken doe je dus in de kern, daarna:
 *   node scripts/genereer-clt-voorinstellingen.mjs
 * `test-clt-voorinstellingen.mjs` valt om zodra de twee uiteenlopen.
 */
export { CLT_VOORINSTELLINGEN } from "./cltVoorinstellingen.generated";

/** Nederlandse benaming van de laagrichting. */
export function richtingLabel(r: CltLayerOrientation): string {
  return r === "Longitudinal" ? "lengte" : "dwars";
}

/** Afwisselende richting, beginnend met een lengtelaag (index 0 = boven). */
export function standaardRichting(index: number): CltLayerOrientation {
  return index % 2 === 0 ? "Longitudinal" : "Transverse";
}

/** Herkent een CLT-profielnaam ("CLT …"). */
export function isCltProfiel(profileName: string | undefined): boolean {
  return /^\s*CLT\b/i.test(profileName ?? "");
}

/** Opbouw uit een voorinstelling: afwisselend, één klasse, standaardbreedte. */
export function cltVanVoorinstelling(
  preset: CltPreset,
  klasse: string,
  breedteMm: number = CLT_STROOKBREEDTE_MM,
): CltLayup {
  return {
    width_mm: breedteMm,
    layers: preset.thicknesses_mm.map((t, i) => ({
      thickness_mm: t,
      orientation: standaardRichting(i),
      strength_class: klasse,
    })),
  };
}

const LAAG_TOKEN = /^(\d+(?:[.,]\d+)?)([LD])?(?::([A-Za-z]+\d+[A-Za-z]*))?$/i;

/**
 * Profielnaam → opbouw. `standaardKlasse` (het staafmateriaal) geldt voor
 * lagen zonder eigen klasse. null wanneer de naam geen geldige CLT-naam is.
 */
export function parseCltProfiel(
  profileName: string | undefined,
  standaardKlasse: string,
): CltLayup | null {
  const naam = profileName?.trim();
  if (!naam) return null;
  const m = /^CLT\s+(\S+)(?:\s+b\s*=?\s*(\d+(?:[.,]\d+)?))?$/i.exec(naam);
  if (!m) return null;
  const breedte = m[2] ? parseFloat(m[2].replace(",", ".")) : CLT_STROOKBREEDTE_MM;
  if (!(breedte > 0)) return null;

  const tokens = m[1].split("/");
  if (tokens.length < 3) return null;
  const layers: CltLayer[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tm = LAAG_TOKEN.exec(tokens[i]);
    if (!tm) return null;
    const dikte = parseFloat(tm[1].replace(",", "."));
    if (!(dikte > 0)) return null;
    const richting: CltLayerOrientation = tm[2]
      ? tm[2].toUpperCase() === "L"
        ? "Longitudinal"
        : "Transverse"
      : standaardRichting(i);
    layers.push({
      thickness_mm: dikte,
      orientation: richting,
      strength_class: tm[3] ?? standaardKlasse,
    });
  }
  return { width_mm: breedte, layers };
}

/**
 * Opbouw → kortst mogelijke profielnaam. Richting en klasse worden alleen
 * geschreven waar ze van de standaard (afwisselend, `standaardKlasse`)
 * afwijken; de breedte alleen wanneer die niet 1000 mm is.
 */
export function formatCltProfiel(layup: CltLayup, standaardKlasse: string): string {
  const tokens = layup.layers.map((l, i) => {
    let tok = maatTekst(l.thickness_mm);
    if (l.orientation !== standaardRichting(i)) tok += l.orientation === "Longitudinal" ? "L" : "D";
    if (l.strength_class.toLowerCase() !== standaardKlasse.toLowerCase()) tok += `:${l.strength_class}`;
    return tok;
  });
  const b = layup.width_mm !== CLT_STROOKBREEDTE_MM ? ` b${maatTekst(layup.width_mm)}` : "";
  return `CLT ${tokens.join("/")}${b}`;
}

function maatTekst(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r);
}

/**
 * Canonieke sleutel van een opbouw: twee opbouwen zijn dezelfde opbouw
 * precies wanneer hun sleutel gelijk is.
 *
 * Waaróm dit niet met `formatCltProfiel(layup, klasse)` kan: die naam is
 * bewust de KORTSTE — richting en klasse verdwijnen eruit zodra ze met de
 * standaard samenvallen. Twee opbouwen die alleen in richting of klasse
 * verschillen kunnen daardoor dezelfde korte naam krijgen, en dan lijken ze
 * gelijk terwijl ze mechanisch niets met elkaar te maken hebben. De sleutel
 * gebruikt daarom een standaardklasse die nooit voorkomt (lege tekst), zodat
 * élke laag zijn klasse voluit schrijft, en zet de strookbreedte er altijd
 * bij in plaats van alleen bij afwijking.
 *
 * Gebruikt om te herkennen welke voorinstelling of bewaarde opbouw op het
 * scherm staat, en om bij het opslaan van een project te zien welke bewaarde
 * opbouwen daadwerkelijk op een staaf voorkomen.
 */
export function cltOpbouwSleutel(layup: CltLayup): string {
  return `b${maatTekst(layup.width_mm)}|${formatCltProfiel(layup, "")}`;
}

/** Totale dikte h = Σ t_i (mm). */
export function cltHoogteMm(layup: CltLayup): number {
  return layup.layers.reduce((s, l) => s + l.thickness_mm, 0);
}

/** Voorkomende sterkteklassen, in volgorde van eerste voorkomen ("C24/C16"). */
export function cltKlassenLabel(layup: CltLayup): string {
  const uniek: string[] = [];
  for (const l of layup.layers) {
    if (!uniek.some((u) => u.toLowerCase() === l.strength_class.toLowerCase())) uniek.push(l.strength_class);
  }
  return uniek.join("/");
}

// ── Mechanica-spiegel ───────────────────────────────────────────────────────

export interface CltLaagMechanica {
  /** Boven- en onderkant vanaf de bovenkant van de plaat (mm). */
  zBoven: number;
  zOnder: number;
  /** E in de spanrichting (N/mm²); 0 voor een dwarslaag. */
  e: number;
  richting: CltLayerOrientation;
}

export interface CltMechanica {
  breedte: number;
  hoogte: number;
  /** Zwaartelijn (E-gewogen) vanaf boven (mm). */
  z0: number;
  /** (EI)_ef in N·mm². */
  eiEf: number;
  /** (EA)_ef in N. */
  eaEf: number;
  lagen: CltLaagMechanica[];
}

/**
 * Zwaartelijn en effectieve stijfheden van een opbouw — bijlage B (B.1),
 * (B.6) met γ_i = 1. `eVanKlasse` levert E_0,mean per sterkteklasse (de
 * aanroeper geeft de tabel mee, zodat dit bestand niet aan een bepaalde
 * materiaaltabel vastzit). null bij een onbekende klasse of een opbouw
 * zonder lengtelaag.
 */
export function cltMechanica(
  layup: CltLayup,
  eVanKlasse: (klasse: string) => number | undefined,
): CltMechanica | null {
  if (!(layup.width_mm > 0) || layup.layers.length === 0) return null;
  const lagen: CltLaagMechanica[] = [];
  let z = 0;
  let ea = 0;
  let eaz = 0;
  for (const l of layup.layers) {
    if (!(l.thickness_mm > 0)) return null;
    const e0 = eVanKlasse(l.strength_class);
    if (e0 === undefined) return null;
    const e = l.orientation === "Longitudinal" ? e0 : 0;
    const zBoven = z;
    const zOnder = z + l.thickness_mm;
    z = zOnder;
    const a = layup.width_mm * l.thickness_mm;
    ea += e * a;
    eaz += e * a * (zBoven + zOnder) / 2;
    lagen.push({ zBoven, zOnder, e, richting: l.orientation });
  }
  if (!(ea > 0)) return null;
  const z0 = eaz / ea;
  return { breedte: layup.width_mm, hoogte: z, z0, eiEf: eiEfVan(layup.width_mm, z0, lagen), eaEf: ea, lagen };
}

function eiEfVan(b: number, z0: number, lagen: CltLaagMechanica[]): number {
  let ei = 0;
  for (const l of lagen) {
    if (l.e === 0) continue;
    const t = l.zOnder - l.zBoven;
    const arm = (l.zBoven + l.zOnder) / 2 - z0;
    ei += l.e * ((b * t * t * t) / 12 + b * t * arm * arm);
  }
  return ei;
}

/** Dezelfde mechanica, opgebouwd uit het resultaat van de kern. */
export function cltMechanicaUitResultaat(res: CltLayupResult): CltMechanica {
  const lagen: CltLaagMechanica[] = res.layers.map((l) => ({
    zBoven: l.z_top_mm,
    zOnder: l.z_bot_mm,
    e: l.e_mpa,
    richting: l.orientation,
  }));
  return {
    breedte: res.width_mm,
    hoogte: res.height_mm,
    z0: res.z0_mm,
    eiEf: res.ei_ef_knm2 * 1e9,
    eaEf: res.ea_ef_kn * 1e3,
    lagen,
  };
}

/** (ES)(z): E-gewogen statisch moment van het deel bóven z om z₀ (N·mm). */
export function cltEsBoven(mech: CltMechanica, z: number): number {
  let es = 0;
  for (const l of mech.lagen) {
    if (l.e === 0 || z <= l.zBoven) continue;
    const za = l.zBoven;
    const zb = Math.min(z, l.zOnder);
    es += l.e * mech.breedte * ((zb * zb - za * za) / 2 - mech.z0 * (zb - za));
  }
  return es;
}

/** Buigspanning in laag `laag` op hoogte z (N/mm², trek +); M in kNm. */
export function cltSigmaOpZ(mech: CltMechanica, laag: number, z: number, mKnm: number): number {
  if (!(mech.eiEf > 0)) return 0;
  return (mech.lagen[laag].e * mKnm * 1e6 * (z - mech.z0)) / mech.eiEf;
}

/** Schuifspanning op hoogte z (N/mm²); V in kN, b_ef = k_cr·b. */
export function cltTauOpZ(mech: CltMechanica, z: number, vKn: number, kCr = 1): number {
  const bEf = kCr * mech.breedte;
  if (!(mech.eiEf > 0) || !(bEf > 0)) return 0;
  return (Math.abs(vKn) * 1e3 * Math.abs(cltEsBoven(mech, z))) / (mech.eiEf * bEf);
}

// ── De opbouw van I_y ───────────────────────────────────────────────────────

/**
 * E van de bovenste lengtelaag: de referentiestijfheid waartegen I_ef,net
 * wordt afgemeten. Spiegel van `CltMechanics::reference_e_mpa`.
 */
export function cltReferentieEMpa(mech: CltMechanica): number | null {
  const l = mech.lagen.find((x) => x.e > 0);
  return l ? l.e : null;
}

/**
 * I_ef,net = (EI)_ef / E_ref (mm⁴). Spiegel van `CltMechanics::i_ef_net_mm4`.
 *
 * HULPGROOTHEID, geen rekenwaarde: de toetsing rekent met (EI)_ef zelf. Hij
 * hoort in de uitdraai omdat hij de opbouw vergelijkbaar maakt met een
 * massieve rechthoek — en omdat het verschil tussen Σ(I_i + A_i·a_i²) en
 * I_ef,net precies laat zien wat een AFWIJKENDE E-modulus per laag doet.
 * Zijn alle lengtelagen van dezelfde sterkteklasse, dan vallen die twee
 * samen; zijn ze dat niet, dan is I_ef,net een E-gewogen grootheid en de
 * meetkundige som niet. Zie [`cltLagenZelfdeE`].
 */
export function cltIEfNetMm4(mech: CltMechanica): number {
  const eRef = cltReferentieEMpa(mech);
  return eRef !== null && eRef > 0 ? mech.eiEf / eRef : 0;
}

/**
 * Hebben alle DRAGENDE (lengte)lagen dezelfde E? Alleen dan is de
 * meetkundige som Σ(I_i + A_i·a_i²) gelijk aan I_ef,net, en mag een tabel de
 * som als I_ef,net opschrijven.
 */
export function cltLagenZelfdeE(mech: CltMechanica): boolean {
  const e = cltReferentieEMpa(mech);
  if (e === null) return false;
  return mech.lagen.every((l) => l.e === 0 || l.e === e);
}

/** Eén regel in de tabel "opbouw van I_y" — bijlage B (B.1) t/m (B.3), (B.6). */
export interface CltLaagStijfheid {
  /** 1-gebaseerd, zoals in het kernresultaat en in alle tabellen. */
  index: number;
  richting: CltLayerOrientation;
  /** Laagdikte t_i (mm). */
  t: number;
  /** E_i in de spanrichting (N/mm²); 0 voor een dwarslaag. */
  e: number;
  /** A_i = b·t_i (mm²) — (B.2). */
  a: number;
  /** I_i = b·t_i³/12 (mm⁴) — (B.3). */
  iEigen: number;
  /** a_i: laagzwaartepunt → zwaartelijn (mm), positief naar beneden — (B.6). */
  arm: number;
  /** De Steiner-term A_i·a_i² (mm⁴). */
  steiner: number;
  /** I_i + A_i·a_i² (mm⁴); de bijdrage aan I_ef,net van een dragende laag. */
  iTotaal: number;
  /** E_i·(I_i + A_i·a_i²) (N·mm²) — de bijdrage aan (EI)_ef. */
  eiBijdrage: number;
  /** Draagt deze laag in de spanrichting? (E_i > 0, dus een lengtelaag.) */
  draagt: boolean;
}

/**
 * De opbouw van I_y per laag: A_i, het eigen traagheidsmoment I_i, de arm a_i
 * en de Steiner-term A_i·a_i², plus de E-gewogen bijdrage aan (EI)_ef.
 *
 * ALLE lagen komen terug, ook de dwarslagen. Hun A_i en I_i bestaan wel
 * degelijk; met E_i = 0 dragen ze alleen niets bij. Dat verschil is juist wat
 * de tabel moet tonen — wie de dwarslagen weglaat, laat de lezer zelf raden
 * waarom de som niet op b·h³/12 uitkomt.
 *
 * Spiegel van `LayerGeometry` in `nen-en-1995-1-1/src/clt.rs`
 * (`area_mm2`, `i_own_mm4`, `arm_mm`, `ei_contribution_nmm2`).
 */
export function cltLaagStijfheden(mech: CltMechanica): CltLaagStijfheid[] {
  return mech.lagen.map((l, i) => {
    const t = l.zOnder - l.zBoven;
    const a = mech.breedte * t;
    const iEigen = (mech.breedte * t * t * t) / 12;
    const arm = (l.zBoven + l.zOnder) / 2 - mech.z0;
    const steiner = a * arm * arm;
    return {
      index: i + 1,
      richting: l.richting,
      t,
      e: l.e,
      a,
      iEigen,
      arm,
      steiner,
      iTotaal: iEigen + steiner,
      eiBijdrage: l.e * (iEigen + steiner),
      draagt: l.e > 0,
    };
  });
}

// ── Het getekende spanningsverloop ──────────────────────────────────────────

/** Monsterpunten per lengtelaag; τ verloopt daar parabolisch. */
export const CLT_TAU_MONSTERS_LENGTELAAG = 9;
/** Monsterpunten per dwarslaag; τ is daar constant (E = 0 ⇒ (ES) constant). */
export const CLT_TAU_MONSTERS_DWARSLAAG = 2;
/**
 * Twee monsterhoogten die dichter dan dit bij elkaar liggen zijn hetzelfde
 * punt. Nodig voor de gedeelde laaggrens (de onderkant van laag i is de
 * bovenkant van laag i+1) en voor een zwaartelijn die toevallig op zo'n grens
 * valt. 10⁻⁹ mm is een picometer: ruim onder alles wat een tekening kan
 * betekenen.
 */
export const CLT_MONSTER_SAMENVAL_MM = 1e-9;

/**
 * De hoogten (mm vanaf boven) waarop het τ-verloop wordt bemonsterd.
 *
 * DE ZWAARTELIJN IS EEN VAST MONSTERPUNT wanneer hij BINNEN een lengtelaag
 * valt. Daar ligt de piek van τ, en de kern evalueert hem daar expliciet:
 * `CltMechanics::layer_max_shear` voegt z₀ als kandidaat toe onder precies
 * deze voorwaarde (`e_mpa > 0 && z0 > z_top && z0 < z_bot`). Zonder dat punt
 * viel de getekende piek bij een ASYMMETRISCHE opbouw LAGER uit dan de τ_d in
 * de tabel ernaast — dezelfde grootheid, twee antwoorden op één blad. Bij een
 * symmetrische opbouw viel dat niet op, omdat z₀ daar samenvalt met een
 * gelijkmatig monsterpunt.
 *
 * In een dwarslaag wordt z₀ NIET toegevoegd, om dezelfde reden als in de
 * kern: met E = 0 verandert (ES) daar niet, dus is τ over de hele laag gelijk
 * en is er geen piek om te raken.
 */
export function cltTauMonsterZ(mech: CltMechanica): number[] {
  const uit: number[] = [];
  const voegToe = (z: number) => {
    const laatste = uit[uit.length - 1];
    if (laatste !== undefined && Math.abs(z - laatste) <= CLT_MONSTER_SAMENVAL_MM) return;
    uit.push(z);
  };
  for (const l of mech.lagen) {
    const n = l.e > 0 ? CLT_TAU_MONSTERS_LENGTELAAG : CLT_TAU_MONSTERS_DWARSLAAG;
    const punten: number[] = [];
    for (let k = 0; k < n; k++) punten.push(l.zBoven + ((l.zOnder - l.zBoven) * k) / (n - 1));
    if (l.e > 0 && mech.z0 > l.zBoven && mech.z0 < l.zOnder) punten.push(mech.z0);
    punten.sort((a, b) => a - b);
    for (const z of punten) voegToe(z);
  }
  return uit;
}

/** Eén punt van een spanningsverloop: hoogte vanaf boven, en de waarde. */
export interface CltVerlooppunt {
  z: number;
  v: number;
}

/**
 * Het τ-verloop over de hoogte als één doorlopende reeks punten; V in kN,
 * b_ef = k_cr·b.
 */
export function cltTauVerloop(mech: CltMechanica, vKn: number, kCr = 1): CltVerlooppunt[] {
  return cltTauMonsterZ(mech).map((z) => ({ z, v: cltTauOpZ(mech, z, vKn, kCr) }));
}

/**
 * Het σ-verloop als één segment per laag: lineair van boven- naar onderkant,
 * nul in de dwarslagen. Spiegel van `CltMechanics::layer_edge_stresses`.
 */
export function cltSigmaVerloop(mech: CltMechanica, mKnm: number): CltVerlooppunt[][] {
  return mech.lagen.map((l, i) => [
    { z: l.zBoven, v: cltSigmaOpZ(mech, i, l.zBoven, mKnm) },
    { z: l.zOnder, v: cltSigmaOpZ(mech, i, l.zOnder, mKnm) },
  ]);
}

/**
 * Doorsnede-grootheden voor de solver: E, A en I zó dat E·A = (EA)_ef en
 * E·I = (EI)_ef, met E de E-modulus van de bovenste lengtelaag. `aBruto` is
 * de volle doorsnede (alle lagen) voor het eigen gewicht — het gewicht van
 * de dwarslagen telt wél mee, hun stijfheid niet.
 */
export function cltSolverDoorsnede(
  layup: CltLayup,
  eVanKlasse: (klasse: string) => number | undefined,
): { E: number; A: number; I: number; aBruto: number } | null {
  const mech = cltMechanica(layup, eVanKlasse);
  if (!mech) return null;
  const eRef = mech.lagen.find((l) => l.e > 0)?.e;
  if (!eRef) return null;
  return {
    E: eRef,
    A: mech.eaEf / eRef,
    I: mech.eiEf / eRef,
    aBruto: mech.breedte * mech.hoogte,
  };
}

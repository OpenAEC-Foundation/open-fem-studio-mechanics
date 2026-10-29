/**
 * BarPropertiesDialog — modal dialog opened by double-clicking a beam.
 *
 * Floating modal with tabs to edit beam properties:
 * (Algemeen / EN 1993 of EN 1995 op basis van het materiaal), footer met
 * Annuleer/OK. OK persists edits via onUpdate → updateBeam: materiaal,
 * profiel, releases én de per-staaf toetsconfiguratie (Beam.checkConfig).
 *
 * Toetsconfiguratie-conventies:
 *  - Kniklengte-velden leeg = systeemlengte (builder-default).
 *  - Kipsteunen: fracties 0..1 van de staaflengte (bovenflens), gescheiden
 *    door komma's en/of spaties — bijv. "0.5" of "0.25 0.5 0.75". Dit is
 *    dezelfde conventie als LateralBracing.top_flange_positions in de
 *    Rust-kern. Ongeldige waarden (buiten 0..1) worden bij OK verwijderd.
 *  - Hout toont géén zeeg-veld: de EN 1995-kern consumeert geen zeeg, dus
 *    dat veld zou schijninvoer zijn.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatLength } from "../../lib/lengthInput";
import type { Beam, BeamEindVeren, BeamReleases, Node } from "./femTypes";
import AansluitingKeuze from "./AansluitingKeuze";
import ProfielKiezer, { profielenInGebruik } from "./ProfielKiezer";
// Één bron voor de doorsnedenaam en de begin-/eindmaten van een verlopende
// staaf — dezelfde keuring als de solver en de rekenkern; zie lib/verloopKeuze.
import { doorsnedeNaamVertaald, verloopMaten } from "../../lib/verloopKeuze";
import "./BarPropertiesDialog.css";


/**
 * De staalsoorten die de kern kent. Stond hier als eigen lijst NAAST die in
 * `lib/steelCheckBuilder.ts`; sinds de plaatmateriaalkeuze dezelfde lijst
 * nodig heeft is er één bron, en dit is nog uitsluitend de doorgeefpost voor
 * de schermen die hem hier al importeerden.
 */
export { STEEL_GRADES } from "../../lib/steelGrades";

/** Suggesties voor de profiel-combobox: staalprofielen + houtdoorsneden. */
export const PROFILE_SUGGESTIONS = [
  "HEA100", "HEA140", "HEA160", "HEA200", "HEA240", "HEA300",
  "HEB160", "HEB200", "HEB240", "HEB300",
  "IPE160", "IPE200", "IPE240", "IPE300", "IPE360",
  "UNP160", "UNP200", "UNP240",
  // Houtdoorsneden — conventie b×h in mm; vrij typbaar (bijv. "96x450 GL").
  "38x89", "44x146", "60x100", "71x171", "96x281", "96x450 GL",
];


interface Props {
  beam: Beam;
  nodes: Node[];
  /**
   * Alle staven van het model. Alleen nodig om in de profielwizard te tonen
   * welke profielen er al in het project staan; ontbreekt hij, dan blijft dat
   * lijstje weg en werkt de rest gewoon.
   */
  beams?: Beam[];
  /** Element forces from the most-recent solver result, if any. */
  beamForces?: { N: number; V: number; M_start: number; M_end: number } | null;
  /** Persist material/profile/releases/checkConfig edits back to the store. */
  onUpdate?: (updates: Partial<Beam>) => void;
  onClose: () => void;
}

export default function BarPropertiesDialog({ beam, nodes, beams, beamForces, onUpdate, onClose }: Props) {
  const { t } = useTranslation("check");
  const [tab, setTab] = useState<"general" | "norm">("general");
  // Hydrate from the beam so re-opening shows previously-saved values.
  const [material, setMaterial] = useState(beam.material ?? "S235");
  const [profile, setProfile]   = useState(beam.profile  ?? "HEA160");
  // Het EINDprofiel van een verlopende staaf (ontwerp 15-09-2026). Leeg =
  // prismatisch; de wizard levert het samen met `profile`, zodat de twee niet
  // los van elkaar kunnen raken.
  const [profileEnd, setProfileEnd] = useState<string | undefined>(beam.profileEnd);
  // ProfielKiezer-wizard (profiel + materiaal als één combinatie) — de keuze
  // landt in de lokale dialoogstate en wordt pas bij OK gecommit.
  const [kiezerOpen, setKiezerOpen] = useState(false);
  // Aansluitingen: scharnieren (releases) én veren, samen bewerkt per DOF
  // via AansluitingKeuze; pas bij OK gecommit.
  const [releases, setReleases] = useState<BeamReleases | undefined>(beam.releases);
  const [veren, setVeren] = useState<BeamEindVeren | undefined>(beam.veren);
  /** Begin- en eindmaten zolang de dialoogkeuze een geldig verloop oplevert. */
  const verlopendeMaten = verloopMaten({ material, profile, profileEnd });

  // ── Staaf op bedding ─────────────────────────────────────────────────────
  // Aan/uit plus k en b als tekst, zodat een leeg veld leeg kan blijven tot
  // OK; pas bij OK wordt er een `bedding` gezet of weggehaald.
  const [beddingAan, setBeddingAan] = useState(!!beam.bedding);
  // Trek-alleen (issue #234): lokaal tot OK; alleen `true` gaat het bestand in.
  const [trekAlleen, setTrekAlleen] = useState(beam.tensionOnly === true);
  const [beddingKStr, setBeddingKStr] = useState(beam.bedding?.k?.toString() ?? "50000");
  const [beddingBStr, setBeddingBStr] = useState(beam.bedding?.b?.toString() ?? "");
  const buildBedding = (): Beam["bedding"] => {
    if (!beddingAan) return undefined;
    const k = Number(beddingKStr.replace(",", "."));
    const b = Number(beddingBStr.replace(",", "."));
    if (!(k > 0) || !(b > 0)) return undefined;
    return { k, b };
  };

  // De toetsconfiguratie (checkConfig) bewerkt deze editie niet; ze blijft
  // ongemoeid op de staaf staan.
  const lengtesGeldig = true;
  const handleConfirm = () => {
    if (!lengtesGeldig) return;
    onUpdate?.({
      material, profile, profileEnd,
      releases, veren, bedding: buildBedding(),
      tensionOnly: trekAlleen ? true : undefined,
    });
    onClose();
  };

  /**
   * Staat er iets in deze dialoog dat nog niet op de staaf is gezet?
   *
   * Alles wat je hier invult blijft lokaal totdat je op OK drukt — ook de
   * profielwizard, die alleen `setMaterial`/`setProfile` doet. Wie een
   * profiel koos, in de regel "Profiel" netjes "HEB 200 — S235" zag staan en
   * daarna naast het kader klikte, verloor die toewijzing zonder melding: de
   * overlay beslaat het hele scherm en sloot meteen. In het rapport bleef het
   * oude profiel staan, terwijl de gebruiker het wel degelijk had toegewezen.
   */
  const huidigeInvoer = JSON.stringify({
    material, profile, profileEnd: profileEnd ?? null,
    releases, veren, bedding: buildBedding() ?? null,
    trekAlleen,
  });
  const [beginInvoer] = useState(huidigeInvoer);
  const gewijzigd = huidigeInvoer !== beginInvoer;

  /**
   * Klik naast het kader. Is er niets veranderd, dan sluit de dialoog zoals
   * altijd; wacht er nog iets op OK, dan gebeurt er niets — een misklik hoort
   * geen werk weg te gooien. Weggooien kan nog steeds bewust, met × of
   * Annuleer. Er komt geen `window.confirm` aan te pas: die is in de
   * desktopschil niet betrouwbaar (App.tsx gebruikt hem alleen als
   * browser-terugval), en een dialoog die niet meer dicht kan is erger dan
   * de kwaal.
   */
  const overlayKlik = () => {
    if (!gewijzigd) onClose();
  };

  const nA = nodes.find(n => n.id === beam.from);
  const nB = nodes.find(n => n.id === beam.to);
  const length = nA && nB ? Math.hypot(nB.x - nA.x, nB.z - nA.z) : 0;
  const angle  = nA && nB ? (Math.atan2(nB.z - nA.z, nB.x - nA.x) * 180 / Math.PI) : 0;

  return (
    <div className="bar-props-overlay" onClick={overlayKlik}>
      <div className="bar-props-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="bar-props-header">
          <h2 className="bar-props-title">
            {t("barDialog.title", { id: beam.id })}
            {/* Zichtbaar dat er nog iets op OK wacht. */}
            {gewijzigd && <span className="bar-props-dirty" title={t("barDialog.unsaved")}> ●</span>}
          </h2>
          <button className="bar-props-close" onClick={onClose} aria-label={t("common:close")}>×</button>
        </div>

        <div className="bar-props-tabs">
          <button
            className={`bar-props-tab${tab === "general" ? " active" : ""}`}
            onClick={() => setTab("general")}
          >{t("barDialog.tabGeneral")}</button>
        </div>

        <div className="bar-props-body">
          {tab === "general" && (
            <>
              <div className="bar-props-section">
                <div className="bar-props-section-title">{t("barDialog.geometry")}</div>
                <div className="bar-props-row"><span>ID</span><code>{beam.id}</code></div>
                <div className="bar-props-row"><span>{t("barDialog.nodeA")}</span><code>{beam.from}</code></div>
                <div className="bar-props-row"><span>{t("barDialog.nodeB")}</span><code>{beam.to}</code></div>
                <div className="bar-props-row"><span>{t("barDialog.length")}</span><code>{formatLength(length)} mm</code></div>
                <div className="bar-props-row"><span>{t("barDialog.angle")}</span><code>{angle.toFixed(1)}°</code></div>
              </div>

              <div className="bar-props-section">
                <div className="bar-props-section-title">{t("barDialog.crossSection")}</div>
                {/* Profiel en materiaal zijn één combinatie — de wizard
                    (ProfielKiezer) vervangt de losse invoervelden. */}
                <div className="bar-props-row">
                  <span>{t("barDialog.profile")}</span>
                  <code>{doorsnedeNaamVertaald({ material, profile, profileEnd }, t)} — {material}</code>
                </div>
                {/* Begin en eind apart, met de maten erbij — alleen bij een
                    staaf die werkelijk verloopt. */}
                {verlopendeMaten && (
                  <>
                    <div className="bar-props-row">
                      <span>{t("barDialog.startNodeA")}</span>
                      <code>
                        h = {verlopendeMaten.begin.h} mm, b = {verlopendeMaten.begin.b} mm
                      </code>
                    </div>
                    <div className="bar-props-row">
                      <span>{t("barDialog.endNodeB")}</span>
                      <code>
                        h = {verlopendeMaten.eind.h} mm, b = {verlopendeMaten.eind.b} mm
                      </code>
                    </div>
                  </>
                )}
                <div className="bar-props-row">
                  <span></span>
                  <button
                    className="bar-props-btn-secondary"
                    onClick={() => setKiezerOpen(true)}
                    title={t("barDialog.chooseProfileTitle")}
                  >
                    {t("barDialog.chooseProfile")}
                  </button>
                </div>
                {kiezerOpen && (
                  <ProfielKiezer
                    open
                    onClose={() => setKiezerOpen(false)}
                    huidig={{ material, profile, profileEnd }}
                    inGebruik={beams ? profielenInGebruik(beams) : undefined}
                    onApply={(keuze) => {
                      setMaterial(keuze.material);
                      setProfile(keuze.profile);
                      // `profileEnd` komt ALTIJD mee uit de wizard, ook als
                      // `undefined`: wie een prismatisch profiel kiest op een
                      // staaf die verliep, hoort dat verloop kwijt te raken.
                      setProfileEnd(keuze.profileEnd);
                    }}
                  />
                )}
              </div>

              <div className="bar-props-section">
                <div className="bar-props-section-title">{t("barDialog.connections")}</div>
                <table className="bar-props-release-table">
                  <tbody>
                    <tr>
                      <td>{t("barDialog.startA")}</td>
                      <td>
                        <AansluitingKeuze zijde="start" releases={releases} veren={veren}
                          onChange={(w) => { setReleases(w.releases); setVeren(w.veren); }} />
                      </td>
                    </tr>
                    <tr>
                      <td>{t("barDialog.endB")}</td>
                      <td>
                        <AansluitingKeuze zijde="end" releases={releases} veren={veren}
                          onChange={(w) => { setReleases(w.releases); setVeren(w.veren); }} />
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="bar-props-hint">
                  {t("barDialog.connectionsHint")}
                </div>
                <label className="bar-props-hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={trekAlleen}
                    onChange={(e) => setTrekAlleen(e.target.checked)} />
                  {t("barDialog.tensionOnly")}
                </label>
                {trekAlleen && (
                  <div className="bar-props-hint">{t("barDialog.tensionOnlyHint")}</div>
                )}
              </div>

              <div className="bar-props-section">
                <div className="bar-props-section-title">{t("barDialog.foundation")}</div>
                <label className="bar-props-hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={beddingAan}
                    onChange={(e) => setBeddingAan(e.target.checked)} />
                  {t("barDialog.foundationToggle")}
                </label>
                {beddingAan && (
                  <table className="bar-props-release-table">
                    <tbody>
                      <tr>
                        <td>{t("barDialog.foundationModulus")}</td>
                        <td>
                          <input type="text" inputMode="decimal" value={beddingKStr} style={{ width: 90 }}
                            onChange={(e) => setBeddingKStr(e.target.value)} />
                        </td>
                        <td>kN/m³</td>
                      </tr>
                      <tr>
                        <td>{t("barDialog.contactWidth")}</td>
                        <td>
                          <input type="text" inputMode="decimal" value={beddingBStr} style={{ width: 90 }}
                            placeholder={t("barDialog.contactWidthPlaceholder")}
                            onChange={(e) => setBeddingBStr(e.target.value)} />
                        </td>
                        <td>mm</td>
                      </tr>
                    </tbody>
                  </table>
                )}
                <div className="bar-props-hint">
                  {beddingAan && !buildBedding()
                    ? t("barDialog.foundationIncomplete")
                    : t("barDialog.foundationHint")}
                </div>
              </div>

              {beamForces && (
                <div className="bar-props-section">
                  <div className="bar-props-section-title">{t("barDialog.forces")}</div>
                  <div className="bar-props-row"><span>N</span><code>{(beamForces.N / 1000).toFixed(2)} kN</code></div>
                  <div className="bar-props-row"><span>V</span><code>{(beamForces.V / 1000).toFixed(2)} kN</code></div>
                  <div className="bar-props-row"><span>M_start</span><code>{(beamForces.M_start / 1e6).toFixed(2)} kNm</code></div>
                  <div className="bar-props-row"><span>M_end</span><code>{(beamForces.M_end / 1e6).toFixed(2)} kNm</code></div>
                </div>
              )}
            </>
          )}

        </div>

        <div className="bar-props-footer">
          {gewijzigd && (
            <span className="bar-props-dirty-hint">
              {t("barDialog.unsaved")}
            </span>
          )}
          <button className="bar-props-btn-secondary" onClick={onClose}>{t("barDialog.cancel")}</button>
          <button className="bar-props-btn-primary" disabled={!lengtesGeldig} onClick={handleConfirm}>{t("common:ok")}</button>
        </div>
      </div>
    </div>
  );
}

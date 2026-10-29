/**
 * FemProperties — reactive Properties panel.
 *
 * Shows different content depending on selection:
 *   - null   : soft placeholder
 *   - node   : ID + editable X/Z coords + opleg-dropdown + reactions
 *   - beam   : ID, endpoints, length, angle, material, profile, BCs, loads
 *   - plate  : ID + corner list (read-only stub)
 *
 * Mutations dispatch through the store callbacks passed in by App.tsx.
 */
import { useState, useEffect, useRef, useId, isValidElement, cloneElement } from "react";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { parseLength, formatLength, mmToMeters } from "../../lib/lengthInput";
import { leesLastWaarde } from "../../lib/lastWaarde";
import LengthInput from "../LengthInput";
import InfoTip from "../InfoTip";
import { CONCRETE_E_CM, resolveSection } from "../../lib/sectionResolver";
import "./FemProperties.css";
import PlateNonlinearEditor from "./PlateNonlinearEditor";
import type {
  Node, Beam, Plate, Support, Load, Selection, SupportType,
  BeamLoadRole,
} from "./femTypes";
import {
  withPlateDefaults, bepaalStandaardRol, BEAM_LOAD_ROLES, BEAM_LOAD_ROLE_SLEUTEL,
  plaatRandTekst, bepaalPlaatlastRand, effectiefPlaatMeshType, plaatRekentAlsRaster,
  PLAAT_MESH_TYPEN, PLATE_DEFAULTS,
} from "./femTypes";
// Het materiaal van een plaat: één bepaling voor paneel, solver, MCP-poort en
// rapport, zodat het paneel geen eigen oordeel velt over wat een geldig
// materiaal is.
import { bepaalPlaatStijfheid, plaatMateriaalSoort } from "../../lib/plaatMateriaal";
import { CLT_VOORINSTELLINGEN } from "../../lib/cltVoorinstellingen.generated";
import type { SolverResult } from "./solver/types";
import { SUPPORTED_TIMBER_GRADES } from "../../lib/houtMateriaal";
import { matchSupportedConcreteClass, SUPPORTED_CONCRETE_CLASSES } from "../../lib/betonMateriaal";
import { STEEL_GRADES } from "../../lib/steelGrades";
import ProfielKiezer, { profielenInGebruik } from "./ProfielKiezer";
// De doorsnedenaam van een staaf komt uit één plaats — dezelfde keuring als de
// solver en de rekenkern gebruiken; zie lib/verloopKeuze.
import { doorsnedeNaamVertaald, verloopMaten } from "../../lib/verloopKeuze";
import AansluitingKeuze from "./AansluitingKeuze";

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="fem-prop-section">
      <button className="fem-prop-section-header" onClick={() => setOpen(!open)}>
        <span className={`fem-prop-chevron${open ? " open" : ""}`}>
          <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
            <path d="M3 2l4 3-4 3z" />
          </svg>
        </span>
        <span>{title}</span>
      </button>
      {open && <div className="fem-prop-section-body">{children}</div>}
    </div>
  );
}

/**
 * Eén regel label | waarde. Met `info` staat er een (i)-icoon naast het label
 * met die uitleg als tip (issue #43), en krijgt het veld de tekst als
 * beschrijving (`aria-describedby`) — ook als de tip dicht is.
 */
function Row({ label, info, children }: {
  label: string;
  info?: React.ReactNode;
  children: React.ReactNode;
}) {
  const id = useId();
  const veld = info && isValidElement<{ "aria-describedby"?: string }>(children)
    ? cloneElement(children, { "aria-describedby": id })
    : children;
  return (
    <div className="fem-prop-row">
      <span className="fem-prop-row-label">
        {label}
        {info ? <InfoTip id={id}>{info}</InfoTip> : null}
      </span>
      <span className="fem-prop-row-value">{veld}</span>
    </div>
  );
}

interface FemPropertiesProps {
  selection: Selection;
  nodes: Node[];
  beams: Beam[];
  plates: Plate[];
  supports: Support[];
  loads: Load[];
  updateNode: (id: number, x: number, z: number) => void;
  /** Patch fields on a beam (material, profile, releases, …). */
  updateBeam?: (id: number, updates: Partial<Beam>) => void;
  /** Dezelfde wijziging op meerdere staven in één keer (meervoudige selectie). */
  updateBeams?: (ids: number[], updates: Partial<Beam>) => void;
  /** Patch rekenvelden op een plaat (dikte, E, ν, ρ, meshSize) — P3.1. */
  updatePlate?: (id: number, updates: Partial<Plate>) => void;
  addSupport: (nodeId: number, type: SupportType, k?: number) => void;
  removeSupport: (nodeId: number) => void;
  /** Patch fields on a load (q / fx / fz / my / ΔT). */
  updateLoad?: (id: number, updates: Partial<Load>) => void;
  /** Cross-panel focus hint set by the canvas q-label clicks. */
  pendingLoadFocus?: { loadId: number; field: keyof Load } | null;
  clearPendingLoadFocus?: () => void;
  results: SolverResult | null;
}

export default function FemProperties(props: FemPropertiesProps) {
  const { selection, nodes, beams, plates, supports, loads,
    updateNode, updateBeam, updateBeams, updatePlate, addSupport, removeSupport, updateLoad,
    pendingLoadFocus, clearPendingLoadFocus, results } = props;
  const { t } = useTranslation("check");

  if (!selection) {
    return (
      <div className="fem-properties">
        <div className="fem-prop-empty">
          {t("props.empty.noSelection")}
        </div>
      </div>
    );
  }

  if (selection.type === "node") {
    const n = nodes.find(nn => nn.id === selection.id);
    if (!n) {
      return <div className="fem-properties"><div className="fem-prop-empty">{t("props.empty.nodeNotFound")}</div></div>;
    }
    return <NodeProperties
      node={n}
      supports={supports}
      updateNode={updateNode}
      addSupport={addSupport}
      removeSupport={removeSupport}
      results={results}
    />;
  }

  if (selection.type === "beam") {
    const b = beams.find(bb => bb.id === selection.id);
    if (!b) {
      return <div className="fem-properties"><div className="fem-prop-empty">{t("props.empty.beamNotFound")}</div></div>;
    }
    const nFrom = nodes.find(n => n.id === b.from);
    const nTo = nodes.find(n => n.id === b.to);
    return <BeamProperties beam={b} nFrom={nFrom} nTo={nTo} nodes={nodes} beams={beams} loads={loads}
      updateBeam={updateBeam} results={results} />;
  }

  if (selection.type === "plate") {
    const p = plates.find(pp => pp.id === selection.id);
    if (!p) {
      return <div className="fem-properties"><div className="fem-prop-empty">{t("props.empty.plateNotFound")}</div></div>;
    }
    return <PlateProperties plate={p} nodes={nodes} updatePlate={updatePlate} results={results} />;
  }
  if (selection.type === "load") {
    const ld = loads.find(l => l.id === selection.id);
    if (!ld) {
      return <div className="fem-properties"><div className="fem-prop-empty">{t("props.empty.loadNotFound")}</div></div>;
    }
    return <LoadProperties
      load={ld} beams={beams} nodes={nodes} plates={plates} updateLoad={updateLoad}
      pendingFocus={pendingLoadFocus} clearPendingFocus={clearPendingLoadFocus}
    />;
  }
  if (selection.type === "multi") {
    return <MultiProperties selection={selection} beams={beams} updateBeams={updateBeams} />;
  }
  return null;
}

// ── Meervoudige selectie ─────────────────────────────────────────────────
/**
 * Eigenschappen van een meervoudige selectie.
 *
 * Het profiel is hier voor álle geselecteerde staven tegelijk toe te wijzen.
 * Dat kon eerder niet: een profiel ging staaf voor staaf, en wie er één
 * oversloeg hield daar het profiel van het startmodel. In het rapport
 * verscheen dat vervolgens als een volwaardig hoofdstuk — een profiel dat de
 * gebruiker nooit gekozen had, met de staafnummers erbij.
 *
 * Daarom staat hier ook wát de selectie nu aan profielen bevat: één regel per
 * combinatie profiel + materiaal, met het aantal staven. Zo is in één oogopslag
 * te zien of er nog staven op het startprofiel staan.
 */
function MultiProperties({ selection, beams, updateBeams }: {
  selection: Extract<Selection, { type: "multi" }>;
  beams: Beam[];
  updateBeams?: (ids: number[], updates: Partial<Beam>) => void;
}) {
  const [kiezerOpen, setKiezerOpen] = useState(false);
  const { t } = useTranslation("check");
  // Lasten tellen mee in de selectie: "selecteer alle lijnlasten" levert een
  // selectie die uitsluitend uit belastingen bestaat.
  const aantalLasten = selection.loadIds?.length ?? 0;
  const total = selection.nodeIds.length + selection.beamIds.length
    + selection.plateIds.length + aantalLasten;

  const gekozen = beams.filter((b) => selection.beamIds.includes(b.id));
  // Combinaties profiel + materiaal met hun aantal, in modelvolgorde.
  // Het EINDprofiel hoort in de sleutel: twee staven met hetzelfde
  // beginprofiel maar een ander verloop zijn niet dezelfde doorsnede, en één
  // regel voor allebei zou dat verschil wegpoetsen.
  const combinaties = new Map<
    string,
    { profile: string; profileEnd?: string; material: string; ids: number[] }
  >();
  for (const b of gekozen) {
    const profile = b.profile ?? "HEA160";
    const profileEnd = b.profileEnd?.trim() || undefined;
    const material = b.material ?? "S235";
    const sleutel = `${profile}|${profileEnd ?? ""}|${material}`;
    const bestaand = combinaties.get(sleutel);
    if (bestaand) bestaand.ids.push(b.id);
    else combinaties.set(sleutel, { profile, profileEnd, material, ids: [b.id] });
  }
  const rijen = [...combinaties.values()];
  // Eén combinatie → die staat voorgeselecteerd in de wizard; meerdere →
  // de wizard begint bij de materiaalkeuze.
  const eenduidig = rijen.length === 1 ? rijen[0] : null;

  return (
    <div className="fem-properties">
      <div className="fem-prop-selection">
        <span className="fem-prop-selection-label">{t("props.common.selection")}</span>
        <span className="fem-prop-selection-value">{t("props.multi.elements", { aantal: total })}</span>
      </div>
      <div className="fem-prop-tabs">
        <button className="fem-prop-tab active">{t("props.common.general")}</button>
      </div>
      <div className="fem-prop-body">
        <Section title={t("props.common.selection")}>
          {selection.nodeIds.length > 0 && (
            <Row label={t("props.multi.nodes")}><code>{selection.nodeIds.length}</code></Row>
          )}
          {selection.beamIds.length > 0 && (
            <Row label={t("props.multi.beams")}><code>{selection.beamIds.length}</code></Row>
          )}
          {selection.plateIds.length > 0 && (
            <Row label={t("props.multi.plates")}><code>{selection.plateIds.length}</code></Row>
          )}
          {aantalLasten > 0 && (
            <Row label={t("props.multi.loads")}><code>{aantalLasten}</code></Row>
          )}
          <div className="fem-prop-hint">
            <kbd>G</kbd> {t("props.multi.keyMove")} · <kbd>R</kbd> {t("props.multi.keyRotate")} · <kbd>{t("props.multi.deleteKey")}</kbd> {t("props.multi.keyDelete")}
          </div>
          {aantalLasten > 0 && (
            <div className="fem-prop-hint">
              <kbd>{t("props.multi.ctrlKey")}</kbd>+<kbd>C</kbd> {t("props.multi.copyHintBefore")} <kbd>{t("props.multi.ctrlKey")}</kbd>+<kbd>V</kbd>{t("props.multi.copyHintAfter")}
            </div>
          )}
        </Section>

        {gekozen.length > 0 && (
          <Section title={t("props.beam.crossSection")}>
            {rijen.map((r) => (
              <Row key={`${r.profile}|${r.profileEnd ?? ""}|${r.material}`} label={t("props.multi.beamCount", { aantal: r.ids.length })}>
                <code>{doorsnedeNaamVertaald(r, t)} — {r.material}</code>
              </Row>
            ))}
            <button
              className="fem-prop-kiezer-btn"
              onClick={() => setKiezerOpen(true)}
              disabled={!updateBeams}
              title={t("props.multi.chooseProfileTitle")}
            >
              {t("props.multi.chooseProfile", { aantal: gekozen.length })}
            </button>
            {kiezerOpen && (
              <ProfielKiezer
                open
                onClose={() => setKiezerOpen(false)}
                huidig={eenduidig
                  ? {
                      material: eenduidig.material,
                      profile: eenduidig.profile,
                      profileEnd: eenduidig.profileEnd,
                    }
                  : undefined}
                onApply={(keuze) => updateBeams?.(selection.beamIds, keuze)}
                inGebruik={profielenInGebruik(beams)}
              />
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

// ── Node properties ──────────────────────────────────────────────────────
function NodeProperties({ node, supports, updateNode, addSupport, removeSupport, results }: {
  node: Node;
  supports: Support[];
  updateNode: (id: number, x: number, z: number) => void;
  addSupport: (nodeId: number, type: SupportType, k?: number) => void;
  removeSupport: (nodeId: number) => void;
  results: SolverResult | null;
}) {
  const { t } = useTranslation("check");
  const support = supports.find(s => s.nodeId === node.id);
  // Editable coord state (string for input control), reset on node change
  const [xStr, setXStr] = useState(String(node.x));
  const [zStr, setZStr] = useState(String(node.z));
  useEffect(() => { setXStr(String(node.x)); setZStr(String(node.z)); }, [node.id, node.x, node.z]);

  const commitX = () => {
    const v = Number(xStr);
    if (Number.isFinite(v) && v !== node.x) updateNode(node.id, v, node.z);
  };
  const commitZ = () => {
    const v = Number(zStr);
    if (Number.isFinite(v) && v !== node.z) updateNode(node.id, node.x, v);
  };

  const reaction = results?.reactions.get(node.id);

  // Een veer zonder positieve stijfheid wordt geweigerd (issue #222); tot
  // dan maakte dit keuzemenu een veer zonder `k`, die stil star rekende. Bij
  // het wisselen naar een veertype blijft een bestaande stijfheid van
  // hetzelfde type staan; anders de beginwaarde van het plaatsingsvenster
  // (10), zichtbaar en bewerkbaar in het veld eronder.
  const isVeer = (type: string | undefined) =>
    type === "zSpring" || type === "xSpring" || type === "rotSpring";
  const onChangeSupport = (val: string) => {
    if (val === "none") removeSupport(node.id);
    else if (isVeer(val)) {
      const k = support?.type === val && support.k !== undefined && support.k > 0 ? support.k : 10;
      addSupport(node.id, val as SupportType, k);
    } else addSupport(node.id, val as SupportType);
  };
  const [kStr, setKStr] = useState(support?.k !== undefined ? String(support.k) : "");
  useEffect(() => {
    setKStr(support?.k !== undefined ? String(support.k) : "");
  }, [node.id, support?.k]);
  const commitK = () => {
    const v = Number(kStr);
    // Alleen een positieve, eindige stijfheid; anders terug naar de oude waarde.
    if (support && isVeer(support.type) && Number.isFinite(v) && v > 0 && v !== support.k) {
      addSupport(node.id, support.type, v);
    } else {
      setKStr(support?.k !== undefined ? String(support.k) : "");
    }
  };

  return (
    <div className="fem-properties">
      <div className="fem-prop-selection">
        <span className="fem-prop-selection-label">{t("props.common.selection")}</span>
        <span className="fem-prop-selection-value">{t("props.node.title", { id: node.id })}</span>
      </div>
      <div className="fem-prop-tabs">
        <button className="fem-prop-tab active">{t("props.common.general")}</button>
      </div>
      <div className="fem-prop-body">
        <Section title={t("props.common.geometry")}>
          <Row label="ID"><code>{node.id}</code></Row>
          <Row label="X (mm)">
            <input
              type="number" step="50" className="fem-prop-input fem-prop-input-mono"
              value={xStr}
              onChange={e => setXStr(e.target.value)}
              onBlur={commitX}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          </Row>
          <Row label="Z (mm)">
            <input
              type="number" step="50" className="fem-prop-input fem-prop-input-mono"
              value={zStr}
              onChange={e => setZStr(e.target.value)}
              onBlur={commitZ}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          </Row>
        </Section>

        <Section title={t("props.node.support")}>
          <Row label={t("props.common.type")}>
            <select className="fem-prop-select" value={support?.type ?? "none"}
              onChange={e => onChangeSupport(e.target.value)}>
              <option value="none">{t("props.node.supportNone")}</option>
              <option value="pinned">{t("props.node.supportPinned")}</option>
              <option value="fixed">{t("props.node.supportFixed")}</option>
              <option value="xRoller">{t("props.node.supportXRoller")}</option>
              <option value="zRoller">{t("props.node.supportZRoller")}</option>
              <option value="zSpring">{t("props.node.supportZSpring")}</option>
              <option value="xSpring">{t("props.node.supportXSpring")}</option>
              <option value="rotSpring">{t("props.node.supportRotSpring")}</option>
            </select>
          </Row>
          {support && isVeer(support.type) ? (
            <Row label={support.type === "rotSpring" ? "kθ (kNm/rad)" : "k (kN/mm)"}>
              <input
                type="number" min="0" step="any" className="fem-prop-input fem-prop-input-mono"
                value={kStr}
                onChange={e => setKStr(e.target.value)}
                onBlur={commitK}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              />
            </Row>
          ) : support?.k !== undefined && (
            <Row label="k">
              <code>{support.k}</code>
            </Row>
          )}
        </Section>

        {reaction && (
          <Section title={t("props.node.reaction")}>
            <Row label="Fx"><code>{reaction.fx.toFixed(0)} N</code></Row>
            <Row label="Fz"><code>{reaction.fz.toFixed(0)} N</code></Row>
            <Row label="My"><code>{reaction.my.toFixed(0)} N·mm</code></Row>
          </Section>
        )}
      </div>
    </div>
  );
}

// ── Beam properties ──────────────────────────────────────────────────────
function BeamProperties({ beam, nFrom, nTo, nodes, beams, loads, updateBeam, results }: {
  beam: Beam; nFrom?: Node; nTo?: Node; nodes: Node[];
  /** Alle staven, om te kunnen tonen welke profielen al in het project staan. */
  beams: Beam[];
  loads: Load[];
  updateBeam?: (id: number, updates: Partial<Beam>) => void;
  results: SolverResult | null;
}) {
  const dx = nTo && nFrom ? nTo.x - nFrom.x : 0;
  const dz = nTo && nFrom ? nTo.z - nFrom.z : 0;
  const L = Math.hypot(dx, dz);
  const angDeg = (Math.atan2(dz, dx) * 180 / Math.PI);
  const beamLoads = loads.filter(l => l.beamId === beam.id);
  const axialHistory = results?.elements.get(beam.id)?.axialHistory;
  const sectionHistory = results?.elements.get(beam.id)?.sectionHistory;

  const material = beam.material ?? "S235";
  const profile = beam.profile ?? "HEA160";
  const isHout = (SUPPORTED_TIMBER_GRADES as readonly string[]).includes(material);
  const betonklasse = matchSupportedConcreteClass(material);
  const isBeton = betonklasse !== null;
  // Staalsterkte volgt uit de naam (S235 → 235); voor hout tonen we geen
  // verzonnen getallen — de rekenwaarden komen uit de toetsing zelf.
  const fyStaal = /^S(\d+)$/.exec(material)?.[1];
  // ProfielKiezer-wizard: profiel + materiaal zijn één combinatie. Conditioneel
  // gemount zodat elke keer openen met de actuele staafwaarden voorselecteert.
  const [kiezerOpen, setKiezerOpen] = useState(false);
  /** Begin- en eindmaten wanneer deze staaf verloopt; anders `null`. */
  const verloopBeamMaten = verloopMaten(beam);

  // Aansluitingen per einde (N/V/M: vast, scharnier of veer) landen in
  // `releases` én `veren`; AansluitingKeuze levert beide velden samen.
  const setAansluiting = (w: { releases: Beam["releases"]; veren: Beam["veren"] }) => {
    updateBeam?.(beam.id, { releases: w.releases, veren: w.veren });
  };

  // Norm-tabblad: de toetsconfiguratie per staaf (kniklengtes, kipsteunen,
  // doorbuiging, en voor hout klimaatklasse/belastingduur). De tabs waren
  // hardcoded knoppen zonder state — de EN-tab deed dus niets.
  const [propTab, setPropTab] = useState<"algemeen" | "norm">("algemeen");
  const { t } = useTranslation("check");


  // Uit de geometrie afgeleide rol — de "Automatisch"-optie toont hem, zodat
  // de gebruiker ziet wat er gebeurt als hij niets kiest.
  const afgeleideRol = bepaalStandaardRol(beam, nodes);

  return (
    <div className="fem-properties">
      <div className="fem-prop-selection">
        <span className="fem-prop-selection-label">{t("props.common.selection")}</span>
        <span className="fem-prop-selection-value">{t("props.beam.title", { id: beam.id })}</span>
      </div>
      <div className="fem-prop-tabs">
        <button
          className={`fem-prop-tab${propTab === "algemeen" ? " active" : ""}`}
          onClick={() => setPropTab("algemeen")}
        >
          {t("props.common.general")}
        </button>
      </div>
      {propTab === "algemeen" && (
      <div className="fem-prop-body">
        <Section title={t("props.common.geometry")}>
          <Row label="ID"><code>{beam.id}</code></Row>
          <Row label={t("props.common.type")}><code>{t("props.beam.typeBeam")}</code></Row>
          <Row label={t("props.beam.nodeStart")}>
            <code>{beam.from}{nFrom ? ` (${nFrom.x}, ${nFrom.z})` : ""}</code>
          </Row>
          <Row label={t("props.beam.nodeEnd")}>
            <code>{beam.to}{nTo ? ` (${nTo.x}, ${nTo.z})` : ""}</code>
          </Row>
          <Row label={t("props.beam.length")}><code>{L.toFixed(0)} mm</code></Row>
          <Row label={t("props.beam.angle")}><code>{angDeg.toFixed(1)}°</code></Row>
        </Section>

        {/* Staaftype: wát deze staaf constructief is, en dus welk
            belastingvlak hij draagt. De windgenerator leest dit veld (dat op
            schijf `loadRole` heet). De keuze "Automatisch" laat het staaftype
            uit de geometrie volgen; elke andere keuze legt het vast in het
            projectbestand. */}
        <Section title={t("props.beam.loadRole")}>
          <Row label={t("props.beam.loadRole")}>
            <select
              className="fem-prop-select"
              value={beam.loadRole ?? ""}
              onChange={(e) => updateBeam?.(beam.id, {
                loadRole: e.target.value === "" ? undefined : e.target.value as BeamLoadRole,
              })}
              title={t("props.beam.loadRoleTitle")}
            >
              <option value="">{t("props.beam.loadRoleAuto", { rol: t(BEAM_LOAD_ROLE_SLEUTEL[afgeleideRol]) })}</option>
              {BEAM_LOAD_ROLES.map((r) => (
                <option key={r.id} value={r.id}>{t(BEAM_LOAD_ROLE_SLEUTEL[r.id])}</option>
              ))}
            </select>
          </Row>
          <div className="fem-prop-hint">
            {beam.loadRole
              ? t("props.beam.loadRoleManual")
              : t("props.beam.loadRoleDerived", { hoek: angDeg.toFixed(0) })}
          </div>
        </Section>

        {/* Profiel en materiaal zijn één combinatie — geen losse velden.
            De knop opent de ProfielKiezer-wizard met de huidige waarden
            voorgeselecteerd; Toepassen schrijft beide velden in één keer. */}
        <Section title={t("props.beam.crossSection")}>
          <Row label={t("props.beam.profile")}>
            <code>{doorsnedeNaamVertaald(beam, t)} — {material}</code>
          </Row>
          {/* VERLOPEND PROFIEL: begin én eind, met de maten erbij. Staat er
              alleen bij een staaf die werkelijk verloopt; bij een prismatische
              staaf zou een lege regel "Verloop" alleen ruis zijn. */}
          {verloopBeamMaten && (
            <>
              <Row label={t("props.beam.taperStart")} info={t("props.beam.taperHint")}>
                <code>
                  {beam.profile} · h = {verloopBeamMaten.begin.h} mm, b = {verloopBeamMaten.begin.b} mm
                </code>
              </Row>
              <Row label={t("props.beam.taperEnd")}>
                <code>
                  {beam.profileEnd} · h = {verloopBeamMaten.eind.h} mm, b = {verloopBeamMaten.eind.b} mm
                </code>
              </Row>
            </>
          )}
          {isHout ? (
            <Row label={t("props.beam.standard")}><code>EN 338 / EN 1995-1-1</code></Row>
          ) : (
            <>
              <Row label="E"><code>{betonklasse ? CONCRETE_E_CM[betonklasse] : resolveSection(material, profile).E} N/mm²</code></Row>
              {fyStaal && <Row label="fy"><code>{fyStaal} N/mm²</code></Row>}
            </>
          )}
          <div className="fem-prop-kiezer-row">
            <button
              className="fem-prop-kiezer-btn"
              onClick={() => setKiezerOpen(true)}
              title={t("props.beam.chooseProfileTitle")}
            >
              {t("props.beam.chooseProfile")}
            </button>
          </div>
          {kiezerOpen && (
            <ProfielKiezer
              open
              onClose={() => setKiezerOpen(false)}
              huidig={{ material, profile, profileEnd: beam.profileEnd }}
              onApply={(keuze) =>
                updateBeam?.(beam.id, {
                  ...keuze,
                  axialMaterialLaw: beam.axialMaterialLaw
                    && ((matchSupportedConcreteClass(keuze.material) !== null
                        && beam.axialMaterialLaw.kind === "concreteCracking")
                      || (/^S\d+$/.test(keuze.material)
                        && beam.axialMaterialLaw.kind === "steelBilinear"))
                    ? beam.axialMaterialLaw : undefined,
                })
              }
              inGebruik={profielenInGebruik(beams)}
            />
          )}
        </Section>

        {(isBeton || !!fyStaal) && <Section title={t("props.beam.axialFnlTitle")} defaultOpen={!!beam.axialMaterialLaw}>
          <Row label={t("props.beam.axialFnlLaw")}>
            <select className="fem-prop-select" value={beam.axialMaterialLaw?.kind ?? "elastic"}
              onChange={(event) => {
                const kind = event.target.value;
                updateBeam?.(beam.id, { axialMaterialLaw: kind === "elastic" ? undefined
                  : kind === "steelBilinear"
                    ? { kind, yieldMpa: Number(fyStaal) || 235, hardeningRatio: 0.02 }
                    : { kind: "concreteCracking", tensileMpa: 3, residualRatio: 0.2 } });
              }}>
              <option value="elastic">{t("props.beam.axialFnlElastic")}</option>
              {!isBeton && <option value="steelBilinear">{t("props.beam.axialFnlSteel")}</option>}
              {isBeton && <option value="concreteCracking">{t("props.beam.axialFnlConcrete")}</option>}
            </select>
          </Row>
          {beam.axialMaterialLaw && <>
            <Row label={beam.axialMaterialLaw.kind === "steelBilinear" ? "fᵧ (MPa)" : "fₜ (MPa)"}>
              <input className="fem-prop-input" type="number" min="0.001" step="1"
                value={beam.axialMaterialLaw.kind === "steelBilinear"
                  ? beam.axialMaterialLaw.yieldMpa : beam.axialMaterialLaw.tensileMpa}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!(value > 0) || !Number.isFinite(value)) return;
                  updateBeam?.(beam.id, { axialMaterialLaw: beam.axialMaterialLaw!.kind === "steelBilinear"
                    ? { ...beam.axialMaterialLaw!, yieldMpa: value }
                    : { ...beam.axialMaterialLaw!, tensileMpa: value } });
                }} />
            </Row>
            <Row label={t("props.beam.axialFnlRatio")}>
              <input className="fem-prop-input" type="number" min="0" max="1" step="0.01"
                value={beam.axialMaterialLaw.kind === "steelBilinear"
                  ? beam.axialMaterialLaw.hardeningRatio : beam.axialMaterialLaw.residualRatio}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!Number.isFinite(value) || value < 0 || value > 1) return;
                  updateBeam?.(beam.id, { axialMaterialLaw: beam.axialMaterialLaw!.kind === "steelBilinear"
                    ? { ...beam.axialMaterialLaw!, hardeningRatio: value }
                    : { ...beam.axialMaterialLaw!, residualRatio: value } });
                }} />
            </Row>
          </>}
          <div className="fem-prop-hint">{t("props.beam.axialFnlHint")}</div>
          {axialHistory && <>
            <Row label={t("props.beam.axialFnlPlasticStrain")}><code>{axialHistory.plasticStrain.toExponential(4)}</code></Row>
            <Row label={t("props.beam.axialFnlDamage")}><code>{axialHistory.tensileDamage.toFixed(4)}</code></Row>
            <Row label={t("props.beam.axialFnlTangent")}><code>{axialHistory.tangentEMpa.toFixed(0)} MPa</code></Row>
          </>}
          {sectionHistory && <>
            <Row label={t("props.beam.sectionFnlPlasticStrain")}><code>{sectionHistory.maximumAbsPlasticStrain.toExponential(4)}</code></Row>
            <Row label={t("props.beam.sectionFnlEquivalentPlasticStrain")}><code>{sectionHistory.maximumEquivalentPlasticStrain.toExponential(4)}</code></Row>
            <Row label={t("props.beam.sectionFnlDamage")}><code>{sectionHistory.maximumTensileDamage.toFixed(4)}</code></Row>
          </>}
        </Section>}

        <Section title={t("props.beam.boundaryConditions")} defaultOpen={false}>
          <Row label={t("props.beam.connectionStart")}>
            <AansluitingKeuze zijde="start" releases={beam.releases} veren={beam.veren} onChange={setAansluiting} />
          </Row>
          <Row label={t("props.beam.connectionEnd")}>
            <AansluitingKeuze zijde="end" releases={beam.releases} veren={beam.veren} onChange={setAansluiting} />
          </Row>
          <Row label={t("props.beam.bedding")}>
            {beam.bedding
              ? <code>k = {beam.bedding.k} kN/m³ · b = {beam.bedding.b} mm</code>
              : <code>{t("props.beam.beddingNone")}</code>}
          </Row>
          {/* Trek-alleen (issue #234): alleen `true` gaat het bestand in. */}
          <Row label={t("props.beam.tensionOnly")}>
            <input
              type="checkbox" className="fem-prop-checkbox"
              checked={beam.tensionOnly === true}
              onChange={(e) => updateBeam?.(beam.id, { tensionOnly: e.target.checked ? true : undefined })}
            />
          </Row>
          {beam.tensionOnly === true && (
            <div className="fem-prop-hint" role="note">{t("props.beam.tensionOnlyHint")}</div>
          )}
        </Section>

        <Section title={t("props.multi.loads")} defaultOpen={false}>
          {beamLoads.length === 0 ? (
            <Row label="—"><code>{t("props.beam.noLoads")}</code></Row>
          ) : beamLoads.map(l => (
            <Row key={`bl${l.id}`} label={l.type}>
              <code>
                {l.q !== undefined && `q = ${l.q} kN/m`}
                {l.deltaT !== undefined && `ΔT = ${l.deltaT} K`}
                {l.deltaTGradient !== undefined && ` · ΔTg = ${l.deltaTGradient} K / ${l.thermalDepthMm ?? "?"} mm`}
              </code>
            </Row>
          ))}
        </Section>
      </div>
      )}
    </div>
  );
}

// ── Load properties ──────────────────────────────────────────────────────
/** Vertaalsleutels (naamruimte check) per lasttype; vertaald bij het tonen. */
const LOAD_TYPE_LABEL: Record<Load["type"], string> = {
  lineLoad:    "props.load.typeLineLoad",
  pointForce:  "props.load.typePointForce",
  pointMoment: "props.load.typePointMoment",
  thermal:     "props.load.typeThermal",
  edgeLoad:    "props.load.typeEdgeLoad",
};

/**
 * De rand van een plaatlast zoals ingevoerd: "rand i+1" bij een rand-index,
 * de naam bij een benoemde rand, en bij een openingsrand de opening erbij.
 * Hier stond `EDGE_LABEL[load.edge ?? "top"]`, waardoor een randlast op een
 * polygoonrand als "bovenrand" verscheen. Vertaald via `plaatRandTekst`.
 */
const randLabel = (load: Load): string => plaatRandTekst(load, i18next.t);

function LoadProperties({
  load, beams, nodes, plates, updateLoad,
  pendingFocus, clearPendingFocus,
}: {
  load: Load;
  beams: Beam[];
  nodes: Node[];
  /** Voor de randlengte van een plaatlast (deellast, randpuntlast). */
  plates?: Plate[];
  updateLoad?: (id: number, updates: Partial<Load>) => void;
  pendingFocus?: { loadId: number; field: keyof Load } | null;
  clearPendingFocus?: () => void;
}) {
  const { t } = useTranslation("check");
  // Refs for the value inputs so a canvas click can request focus.
  const qRef      = useRef<HTMLInputElement>(null);
  const qStartRef = useRef<HTMLInputElement>(null);
  const qEndRef   = useRef<HTMLInputElement>(null);
  const fxRef     = useRef<HTMLInputElement>(null);
  const fzRef     = useRef<HTMLInputElement>(null);
  const myRef     = useRef<HTMLInputElement>(null);
  const dtRef     = useRef<HTMLInputElement>(null);
  const refByField: Partial<Record<keyof Load, React.RefObject<HTMLInputElement | null>>> = {
    q: qRef, qStart: qStartRef, qEnd: qEndRef,
    fx: fxRef, fz: fzRef, my: myRef, deltaT: dtRef,
  };

  useEffect(() => {
    if (!pendingFocus || pendingFocus.loadId !== load.id) return;
    const ref = refByField[pendingFocus.field];
    const el = ref?.current;
    if (el) {
      // Defer slightly so the input mounts after the conditional render
      // (e.g. trapezium toggle creates qStart/qEnd inputs on the fly).
      requestAnimationFrame(() => {
        el.focus();
        el.select();
      });
    }
    clearPendingFocus?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFocus, load.id]);
  // Editable per-field string state — committed onBlur / Enter.
  const [qStr, setQStr] = useState(String(load.q ?? ""));
  const [qStartStr, setQStartStr] = useState(String(load.qStart ?? ""));
  const [qEndStr, setQEndStr] = useState(String(load.qEnd ?? ""));
  const [fxStr, setFxStr] = useState(String(load.fx ?? ""));
  const [fzStr, setFzStr] = useState(String(load.fz ?? ""));
  const [myStr, setMyStr] = useState(String(load.my ?? ""));
  const [dtStr, setDtStr] = useState(String(load.deltaT ?? ""));
  const [dtGradientStr, setDtGradientStr] = useState(String(load.deltaTGradient ?? ""));
  const [thermalDepthStr, setThermalDepthStr] = useState(String(load.thermalDepthMm ?? ""));
  // Omschrijving: vrije tekst, zelfde commit-op-blur/Enter-patroon als de
  // getalvelden. Apart gehouden van `commitNumber` omdat er niets te parsen
  // valt — leeg (of alleen spaties) wist het veld in plaats van er een lege
  // string in te zetten, zodat "geen omschrijving" één vorm houdt.
  const [omschrijvingStr, setOmschrijvingStr] = useState(load.omschrijving ?? "");
  useEffect(() => {
    setQStr(String(load.q ?? ""));
    setQStartStr(String(load.qStart ?? ""));
    setQEndStr(String(load.qEnd ?? ""));
    setFxStr(String(load.fx ?? ""));
    setFzStr(String(load.fz ?? ""));
    setMyStr(String(load.my ?? ""));
    setDtStr(String(load.deltaT ?? ""));
    setDtGradientStr(String(load.deltaTGradient ?? ""));
    setThermalDepthStr(String(load.thermalDepthMm ?? ""));
    setOmschrijvingStr(load.omschrijving ?? "");
  }, [load.id, load.q, load.qStart, load.qEnd, load.fx, load.fz, load.my, load.deltaT,
      load.deltaTGradient, load.thermalDepthMm,
      load.omschrijving]);

  // Trapezium detection: load is trapezium if qStart or qEnd set (regardless of q).
  const isTrap = load.qStart !== undefined || load.qEnd !== undefined;
  const toggleTrap = (on: boolean) => {
    if (!updateLoad) return;
    if (on) {
      // Convert uniform → trapezium: seed both ends with current q (default 0).
      const seed = load.q ?? 0;
      updateLoad(load.id, { qStart: seed, qEnd: seed });
    } else {
      // Collapse trapezium → uniform: average of the two ends becomes q.
      const avg = ((load.qStart ?? load.q ?? 0) + (load.qEnd ?? load.q ?? 0)) / 2;
      updateLoad(load.id, { q: avg, qStart: undefined, qEnd: undefined });
    }
  };

  const commitNumber = (raw: string, field: keyof Load) => {
    // Komma of punt (#52); wat Number() al las, blijft hetzelfde.
    const v = leesLastWaarde(raw) ?? Number(raw);
    if (Number.isFinite(v) && updateLoad) updateLoad(load.id, { [field]: v });
  };

  /** Omschrijving vastleggen; lege tekst wist het veld (→ `undefined`). */
  const commitOmschrijving = () => {
    if (!updateLoad) return;
    const tekst = omschrijvingStr.trim();
    const nieuw = tekst === "" ? undefined : tekst;
    if (nieuw === load.omschrijving) { setOmschrijvingStr(load.omschrijving ?? ""); return; }
    updateLoad(load.id, { omschrijving: nieuw });
  };

  const beam = load.beamId !== undefined ? beams.find(b => b.id === load.beamId) : undefined;
  const node = load.nodeId !== undefined ? nodes.find(n => n.id === load.nodeId) : undefined;
  // Beam length for context on lineLoad
  let beamLen = 0;
  if (beam) {
    const nA = nodes.find(n => n.id === beam.from);
    const nB = nodes.find(n => n.id === beam.to);
    if (nA && nB) beamLen = Math.hypot(nB.x - nA.x, nB.z - nA.z);
  }
  // Plaatlast (randlast of puntlast op een plaatrand): de rand zoals de
  // rekenkern hem leest (`bepaalPlaatlastRand`, van de beginhoek af — ook op
  // de rand van een opening), zodat de
  // begin-/eind-/positie-invoer in mm langs dezelfde as telt als de berekening.
  // Een ongeldig adres geeft randLen 0; de modelcontrole meldt dat apart.
  const plaat = load.plateId !== undefined ? (plates ?? []).find(p => p.id === load.plateId) : undefined;
  let randLen = 0;
  if (plaat) {
    const hoeken = plaat.nodeIds.map(id => nodes.find(n => n.id === id));
    if (hoeken.every(h => h !== undefined)) {
      const rand = bepaalPlaatlastRand(
        hoeken.map(h => ({ x: h!.x, z: h!.z })), plaat.openingen, load);
      if (rand.ok) randLen = rand.lengte;
    }
  }
  /** Lengte (mm) van de as waarlangs fracties tellen: de staaf, of de plaatrand. */
  const asLen = beam ? beamLen : randLen;

  // ── Deellast (begin/eind) — invoer in mm vanaf de startknoop (staaf) of de
  //    beginhoek (plaatrand), intern opgeslagen als fracties 0..1
  //    (Load.startFrac/endFrac). ──────────────────────────────────────────
  const lenMm = asLen;
  const fracA = Math.min(1, Math.max(0, load.startFrac ?? 0));
  const fracB = Math.min(1, Math.max(0, load.endFrac ?? 1));
  const [beginStr, setBeginStr] = useState(formatLength(fracA * lenMm));
  const [endStr, setEndStr]     = useState(formatLength(fracB * lenMm));
  useEffect(() => {
    setBeginStr(formatLength(Math.min(1, Math.max(0, load.startFrac ?? 0)) * lenMm));
    setEndStr(formatLength(Math.min(1, Math.max(0, load.endFrac ?? 1)) * lenMm));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.id, load.startFrac, load.endFrac, lenMm]);
  /** Commit begin/eind (mm) → fracties; ongeldig bereik wordt genegeerd
   *  (validatie: 0 ≤ begin < eind ≤ L) en de invoer springt terug. */
  const commitRange = (rawBegin: string, rawEnd: string) => {
    if (!updateLoad || lenMm <= 0) return;
    const b0 = parseLength(rawBegin), b1 = parseLength(rawEnd);
    const valid = Number.isFinite(b0) && Number.isFinite(b1)
      && b0 >= 0 && b0 < b1 && b1 <= lenMm + 1e-9;
    if (!valid) {
      // terugspringen naar de huidige (geldige) waarden
      setBeginStr(formatLength(fracA * lenMm));
      setEndStr(formatLength(fracB * lenMm));
      return;
    }
    const aF = b0 / lenMm;
    const bF = Math.min(1, b1 / lenMm);
    const isFull = aF <= 0 && bF >= 1;
    updateLoad(load.id, {
      startFrac: isFull ? undefined : aF,
      endFrac:   isFull ? undefined : bF,
    });
  };
  const isPartial = fracA > 0 || fracB < 1;

  return (
    <div className="fem-properties">
      <div className="fem-prop-selection">
        <span className="fem-prop-selection-label">{t("props.common.selection")}</span>
        <span className="fem-prop-selection-value">{t("props.load.title", { id: load.id })}</span>
      </div>
      <div className="fem-prop-tabs">
        <button className="fem-prop-tab active">{t("props.common.general")}</button>
      </div>
      <div className="fem-prop-body">
        <Section title={t("props.common.general")}>
          <Row label="ID"><code>{load.id}</code></Row>
          <Row label={t("props.common.type")}><code>{t(LOAD_TYPE_LABEL[load.type])}</code></Row>
          {/* Vrije omschrijving — waar komt deze last vandaan? Verandert niets
              aan de berekening; hij maakt de lastentabel in het rapport
              leesbaar. Leeg laten mag, en leegmaken wist het veld. */}
          <Row label={t("props.load.description")}>
            <input
              type="text" className="fem-prop-input"
              value={omschrijvingStr}
              placeholder={t("props.load.descriptionPlaceholder")}
              maxLength={80}
              spellCheck={false}
              onChange={e => setOmschrijvingStr(e.target.value)}
              onBlur={commitOmschrijving}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              title={t("props.load.descriptionTitle")}
            />
          </Row>
          <Row label={t("props.load.loadCase")}><code>{load.caseId}</code></Row>
          {beam && <Row label={t("props.load.onBeam")}><code>{beam.id} ({beam.from}–{beam.to})</code></Row>}
          {node && <Row label={t("props.load.onNode")}><code>{node.id}</code></Row>}
          {/* Puntlast op een vrije positie op de staaf: positie achteraf
              bij te stellen, in millimeters vanaf de startknoop. */}
          {beam && load.type === "pointForce" && load.posFrac !== undefined && beamLen > 0 && (
            <Row label={t("props.load.position")}>
              <LengthInput required className="fem-prop-input" max={beamLen}
                value={(load.posFrac ?? 0) * beamLen}
                onChange={mm => {
                  if (mm !== undefined) updateLoad?.(load.id, { posFrac: mm / beamLen });
                }}
              />
            </Row>
          )}
          {load.plateId !== undefined && (
            <Row label={t("props.load.onPlate")}><code>{load.plateId} ({randLabel(load)})</code></Row>
          )}
          {/* Puntlast op een plaatrand: positie langs de rand vanaf de
              beginhoek, bij te stellen in millimeters — dezelfde as als de kern. */}
          {plaat && load.type === "pointForce" && randLen > 0 && (
            <Row label={t("props.load.position")}>
              <LengthInput required className="fem-prop-input" max={randLen}
                value={(load.posFrac ?? 0) * randLen}
                title={t("props.load.edgePositionTitle")}
                onChange={mm => {
                  if (mm !== undefined) updateLoad?.(load.id, { posFrac: mm / randLen });
                }}
              />
            </Row>
          )}
          {plaat && randLen > 0 && (
            <Row label={t("props.load.edgeLength")}><code>{formatLength(randLen)} mm</code></Row>
          )}
          {beamLen > 0 && load.type === "lineLoad" && (
            <Row label={t("props.load.beamLength")}><code>{formatLength(beamLen)} mm</code></Row>
          )}
        </Section>

        {load.type === "lineLoad" && (
          <Section title={t("props.load.lineLoad")}>
            <Row label={t("props.load.coordSystem")}>
              <select
                className="fem-prop-select"
                value={load.qCoord ?? "global"}
                onChange={e => updateLoad?.(load.id, { qCoord: e.target.value as "global" | "local" })}
                title={t("props.load.coordSystemTitle")}
              >
                <option value="global">{t("props.load.coordGlobal")}</option>
                <option value="local">{t("props.load.coordLocal")}</option>
              </select>
            </Row>
            <Row label={t("props.load.direction")}>
              <select
                className="fem-prop-select"
                value={load.qDir ?? "z"}
                onChange={e => updateLoad?.(load.id, { qDir: e.target.value as "x" | "z" })}
                title={(load.qCoord ?? "global") === "local"
                  ? t("props.load.directionLocalTitle")
                  : t("props.load.directionGlobalTitle")}
              >
                {(load.qCoord ?? "global") === "local" ? (
                  <>
                    <option value="z">{t("props.load.dirLocalZ")}</option>
                    <option value="x">{t("props.load.dirLocalX")}</option>
                  </>
                ) : (
                  <>
                    <option value="z">{t("props.load.dirGlobalZ")}</option>
                    <option value="x">{t("props.load.dirGlobalX")}</option>
                  </>
                )}
              </select>
            </Row>
            <Row label={t("props.load.trapezium")}>
              <input
                type="checkbox" className="fem-prop-checkbox"
                checked={isTrap}
                onChange={e => toggleTrap(e.target.checked)}
              />
            </Row>
            {!isTrap ? (
              <Row label="q (kN/m)">
                <input
                  ref={qRef}
                  type="text" inputMode="decimal" className="fem-prop-input fem-prop-input-mono"
                  value={qStr}
                  onChange={e => setQStr(e.target.value)}
                  onBlur={() => commitNumber(qStr, "q")}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                />
              </Row>
            ) : (
              <>
                <Row label="q_start (kN/m)">
                  <input
                    ref={qStartRef}
                    type="text" inputMode="decimal" className="fem-prop-input fem-prop-input-mono"
                    value={qStartStr}
                    onChange={e => setQStartStr(e.target.value)}
                    onBlur={() => commitNumber(qStartStr, "qStart")}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                </Row>
                <Row label="q_end (kN/m)">
                  <input
                    ref={qEndRef}
                    type="text" inputMode="decimal" className="fem-prop-input fem-prop-input-mono"
                    value={qEndStr}
                    onChange={e => setQEndStr(e.target.value)}
                    onBlur={() => commitNumber(qEndStr, "qEnd")}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                </Row>
              </>
            )}
            {beamLen > 0 && (
              <>
                <Row label={t("props.load.start")}>
                  <input
                    type="text" inputMode="decimal"
                    className="fem-prop-input fem-prop-input-mono"
                    value={beginStr}
                    onChange={e => setBeginStr(e.target.value)}
                    onBlur={() => commitRange(beginStr, endStr)}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    title={t("props.load.startTitleBeam", { lengte: formatLength(lenMm) })}
                  />
                </Row>
                <Row label={t("props.load.end")}>
                  <input
                    type="text" inputMode="decimal"
                    className="fem-prop-input fem-prop-input-mono"
                    value={endStr}
                    onChange={e => setEndStr(e.target.value)}
                    onBlur={() => commitRange(beginStr, endStr)}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    title={t("props.load.endTitleBeam", { lengte: formatLength(lenMm) })}
                  />
                </Row>
                {isPartial && (
                  <Row label={t("props.load.loadedPart")}>
                    <code>{formatLength((fracB - fracA) * lenMm)} mm</code>
                  </Row>
                )}
                <Row label={t("props.load.total")}>
                  <code>
                    {(() => {
                      // Uniform: q·L_belast. Trapezium: (qa+qb)/2 · L_belast.
                      const qa = load.qStart ?? load.q ?? 0;
                      const qb = load.qEnd   ?? load.q ?? 0;
                      return ((qa + qb) / 2 * (fracB - fracA) * mmToMeters(lenMm)).toFixed(2);
                    })()} kN
                  </code>
                </Row>
              </>
            )}
            <Row label={t("props.load.actsIn")}>
              <code>
                {(load.qCoord ?? "global") === "local"
                  ? ((load.qDir ?? "z") === "z" ? t("props.load.actsPerpendicular") : t("props.load.actsAxial"))
                  : ((load.qDir ?? "z") === "z" ? t("props.load.actsWorldZ") : t("props.load.actsWorldX"))}
              </code>
            </Row>
          </Section>
        )}

        {load.type === "edgeLoad" && (
          <Section title={t("props.load.edgeLoad")}>
            <Row label={t("props.load.edge")}><code>{randLabel(load)}</code></Row>
            <Row label={t("props.load.direction")}>
              <select
                className="fem-prop-select"
                value={load.qDir ?? "z"}
                onChange={e => updateLoad?.(load.id, { qDir: e.target.value as "x" | "z" })}
                title={t("props.load.edgeDirectionTitle")}
              >
                <option value="z">{t("props.load.dirGlobalZ")}</option>
                <option value="x">{t("props.load.dirGlobalX")}</option>
              </select>
            </Row>
            {/* Trapezium en deellast langs de rand: dezelfde velden en
                dezelfde betekenis als bij een lijnlast op een staaf, met de
                fracties gemeten vanaf de beginhoek van de rand. De kern zet
                ze om in consistente knoopkrachten (PlateLoads). */}
            <Row label={t("props.load.trapezium")}>
              <input
                type="checkbox" className="fem-prop-checkbox"
                checked={isTrap}
                onChange={e => toggleTrap(e.target.checked)}
              />
            </Row>
            {!isTrap ? (
              <Row label="p (kN/m)">
                <input
                  ref={qRef}
                  type="text" inputMode="decimal" className="fem-prop-input fem-prop-input-mono"
                  value={qStr}
                  onChange={e => setQStr(e.target.value)}
                  onBlur={() => commitNumber(qStr, "q")}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                />
              </Row>
            ) : (
              <>
                <Row label="p_start (kN/m)">
                  <input
                    ref={qStartRef}
                    type="text" inputMode="decimal" className="fem-prop-input fem-prop-input-mono"
                    value={qStartStr}
                    onChange={e => setQStartStr(e.target.value)}
                    onBlur={() => commitNumber(qStartStr, "qStart")}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                </Row>
                <Row label="p_end (kN/m)">
                  <input
                    ref={qEndRef}
                    type="text" inputMode="decimal" className="fem-prop-input fem-prop-input-mono"
                    value={qEndStr}
                    onChange={e => setQEndStr(e.target.value)}
                    onBlur={() => commitNumber(qEndStr, "qEnd")}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                </Row>
              </>
            )}
            {randLen > 0 && (
              <>
                <Row label={t("props.load.start")}>
                  <input
                    type="text" inputMode="decimal"
                    className="fem-prop-input fem-prop-input-mono"
                    value={beginStr}
                    onChange={e => setBeginStr(e.target.value)}
                    onBlur={() => commitRange(beginStr, endStr)}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    title={t("props.load.startTitleEdge", { lengte: formatLength(lenMm) })}
                  />
                </Row>
                <Row label={t("props.load.end")}>
                  <input
                    type="text" inputMode="decimal"
                    className="fem-prop-input fem-prop-input-mono"
                    value={endStr}
                    onChange={e => setEndStr(e.target.value)}
                    onBlur={() => commitRange(beginStr, endStr)}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    title={t("props.load.endTitleEdge", { lengte: formatLength(lenMm) })}
                  />
                </Row>
                {isPartial && (
                  <Row label={t("props.load.loadedPart")}>
                    <code>{formatLength((fracB - fracA) * lenMm)} mm</code>
                  </Row>
                )}
                <Row label={t("props.load.total")}>
                  <code>
                    {(() => {
                      // Uniform: p·L_belast. Trapezium: (pa+pb)/2 · L_belast.
                      const pa = load.qStart ?? load.q ?? 0;
                      const pb = load.qEnd   ?? load.q ?? 0;
                      return ((pa + pb) / 2 * (fracB - fracA) * mmToMeters(lenMm)).toFixed(2);
                    })()} kN
                  </code>
                </Row>
              </>
            )}
            <Row label={t("props.load.actsIn")}>
              <code>
                {(load.qDir ?? "z") === "z"
                  ? t("props.load.actsWorldZ") : t("props.load.actsWorldX")}
              </code>
            </Row>
          </Section>
        )}

        {load.type === "pointForce" && (
          <Section title={t("props.load.pointForce")}>
            <Row label="Fx (kN)">
              <input
                ref={fxRef}
                type="number" step="0.5" className="fem-prop-input fem-prop-input-mono"
                value={fxStr}
                onChange={e => setFxStr(e.target.value)}
                onBlur={() => commitNumber(fxStr, "fx")}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              />
            </Row>
            <Row label="Fz (kN)">
              <input
                ref={fzRef}
                type="number" step="0.5" className="fem-prop-input fem-prop-input-mono"
                value={fzStr}
                onChange={e => setFzStr(e.target.value)}
                onBlur={() => commitNumber(fzStr, "fz")}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              />
            </Row>
          </Section>
        )}

        {load.type === "pointMoment" && (
          <Section title={t("props.load.pointMoment")}>
            <Row label="My (kNm)">
              <input
                ref={myRef}
                type="number" step="0.5" className="fem-prop-input fem-prop-input-mono"
                value={myStr}
                onChange={e => setMyStr(e.target.value)}
                onBlur={() => commitNumber(myStr, "my")}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              />
            </Row>
          </Section>
        )}

        {load.type === "thermal" && (
          <Section title={t("props.load.thermal")}>
            <Row label="ΔT (K)">
              <input
                ref={dtRef}
                type="number" step="1" className="fem-prop-input fem-prop-input-mono"
                value={dtStr}
                onChange={e => setDtStr(e.target.value)}
                onBlur={() => commitNumber(dtStr, "deltaT")}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              />
            </Row>
            <Row label="α"><code>{t("props.load.alphaSteel")}</code></Row>
            <Row label="ΔT₊−ΔT₋ (K)">
              <input type="number" step="1" className="fem-prop-input fem-prop-input-mono"
                value={dtGradientStr}
                onChange={e => setDtGradientStr(e.target.value)}
                onBlur={() => commitNumber(dtGradientStr, "deltaTGradient")}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
            </Row>
            <Row label="h (mm)">
              <input type="number" min="0.001" step="1" className="fem-prop-input fem-prop-input-mono"
                value={thermalDepthStr}
                onChange={e => setThermalDepthStr(e.target.value)}
                onBlur={() => {
                  const value = Number(thermalDepthStr);
                  if (Number.isFinite(value) && value > 0) updateLoad?.(load.id, { thermalDepthMm: value });
                  else setThermalDepthStr(String(load.thermalDepthMm ?? ""));
                }}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
            </Row>
            <div className="fem-prop-hint">{t("props.load.thermalGradientHint")}</div>
          </Section>
        )}

        <Section title={t("props.load.actions")} defaultOpen={false}>
          <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--theme-text-faint)" }}>
            {/* De spaties rond de toets staan in de vertaling zelf: het Duits
                zet er een komma achter ("Entf, um …"), zonder spatie ervoor. */}
            {t("props.load.pressBefore")}<kbd>{t("props.multi.deleteKey")}</kbd>{t("props.load.pressAfter")}
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── Plate properties ─────────────────────────────────────────────────────
/**
 * Bewerkbare plaateigenschappen (P3.1): dikte, E, ν, ρ en meshSize gaan via
 * `updatePlate` de store in (één history-snapshot per commit → undo/redo per
 * wijziging). De solver-invalidatie loopt via de bestaande trigger-route:
 * elke plaatmutatie wist de resultaten, waarna Berekenen opnieuw rekent —
 * identiek aan staafwijzigingen (materiaal/profiel).
 */

function PlateProperties({
  plate, nodes, updatePlate,
}: {
  plate: Plate; nodes: Node[];
  updatePlate?: (id: number, updates: Partial<Plate>) => void;
  results: SolverResult | null;
}) {
  // Weergavewaarden mét defaults — een oude plaat zonder rekenvelden toont
  // dus de PLATE_DEFAULTS in plaats van lege invoervelden.
  const d = withPlateDefaults(plate);
  // String-state per veld; commit onBlur/Enter (zelfde patroon als
  // NodeProperties). Ongeldige invoer springt terug naar de huidige waarde.
  // Met een materiaal mogen E, ν en ρ LEEG staan: dan volgen ze het
  // materiaal. Een leeg veld is dus geen ontbrekende invoer maar een keuze,
  // en `tekst` maakt daar "" van in plaats van "undefined".
  const { t } = useTranslation("check");
  const tekst = (v: number | undefined) => (v === undefined ? "" : String(v));
  const [dikteStr, setDikteStr] = useState(String(d.thickness));
  const [eStr, setEStr]         = useState(tekst(d.E));
  const [nuStr, setNuStr]       = useState(tekst(d.nu));
  const [rhoStr, setRhoStr]     = useState(tekst(d.rho));
  const [meshStr, setMeshStr]   = useState(String(d.meshSize));
  useEffect(() => {
    setDikteStr(String(d.thickness));
    setEStr(tekst(d.E));
    setNuStr(tekst(d.nu));
    setRhoStr(tekst(d.rho));
    setMeshStr(String(d.meshSize));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plate.id, plate.thickness, plate.E, plate.nu, plate.rho, plate.meshSize, plate.materiaal]);

  type PlaatRekenveld = "thickness" | "E" | "nu" | "rho" | "meshSize";
  const commitVeld = (
    raw: string, veld: PlaatRekenveld,
    geldig: (v: number) => boolean,
    terug: () => void,
    /** Mag het veld leeggemaakt worden (dan volgt het weer het materiaal)? */
    leegMag = false,
  ) => {
    if (!updatePlate) { terug(); return; }
    if (leegMag && raw.trim() === "") {
      // Leeg = "volg het materiaal": de overschrijving wordt gewist. Dat kan
      // alleen als er een materiaal is; zonder materiaal zou de plaat dan
      // zonder E komen te staan.
      if (d[veld] !== undefined) updatePlate(plate.id, { [veld]: undefined });
      else terug();
      return;
    }
    const v = Number(raw);
    if (!Number.isFinite(v) || !geldig(v)) { terug(); return; }
    if (v !== d[veld]) updatePlate(plate.id, { [veld]: v });
    else terug(); // ongewijzigd — invoer terug in het nette formaat
  };
  const inputProps = {
    type: "number" as const,
    className: "fem-prop-input fem-prop-input-mono",
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    },
  };

  // Elementkeuze (stap 2). "Standaard" = geen keuze opgeslagen: de plaat
  // rekent dan zoals vóór stap 2 (rechthoekraster → vierhoeken, CDT →
  // driehoeken), zodat een bestaand model geen ander getal krijgt.
  const hoeken = plate.nodeIds.map((id) => nodes.find((nn) => nn.id === id));
  const punten = hoeken.every((h) => !!h) ? hoeken.map((h) => ({ x: h!.x, z: h!.z })) : null;
  const openingen = plate.openingen ?? [];
  const raster = punten ? plaatRekentAlsRaster(punten, openingen.map((o) => o.punten)) : false;
  const effectief = punten ? effectiefPlaatMeshType(plate, punten) : "driehoeken";
  const meshTypeLabel: Record<string, string> = {
    driehoeken: t("props.plate.meshTriangles"), vierhoeken: t("props.plate.meshQuads"),
  };
  const meshSoortTekst = (() => {
    if (raster) return t("props.plate.meshStructured", { type: meshTypeLabel[effectief] });
    const c = plate.meshCache;
    if (c?.meshSoort === "gemengd") return t("props.plate.meshMixed");
    return t("props.plate.meshBoundaryCdt", { type: meshTypeLabel[effectief] });
  })();
  const verwijderOpening = (id: number) => {
    if (!updatePlate) return;
    const rest = openingen.filter((o) => o.id !== id);
    updatePlate(plate.id, { openingen: rest.length > 0 ? rest : undefined });
  };
  // ── Materiaal (stap 3) ──────────────────────────────────────────────
  // Eén bepaling voor paneel, solver en rapport: `bepaalPlaatStijfheid`.
  // Wordt het materiaal niet herkend, dan staat de reden hier — dezelfde
  // tekst die de solver en de MCP-poort geven, zodat de gebruiker hem hier
  // ziet en niet pas bij het rekenen.
  const [materiaalStr, setMateriaalStr] = useState(plate.materiaal ?? "");
  const [hoekStr, setHoekStr] = useState(plate.hoofdrichting !== undefined ? String(plate.hoofdrichting) : "");
  useEffect(() => {
    setMateriaalStr(plate.materiaal ?? "");
    setHoekStr(plate.hoofdrichting !== undefined ? String(plate.hoofdrichting) : "");
  }, [plate.id, plate.materiaal, plate.hoofdrichting]);
  const stijfheidUit = bepaalPlaatStijfheid(d);
  const stijfheid = stijfheidUit.ok ? stijfheidUit.stijfheid : null;
  const materiaalFout = stijfheidUit.ok ? null : stijfheidUit.reden;
  const heeftMateriaal = (plate.materiaal ?? "").trim() !== "";
  // G₁₂ van kruislaaghout (issue #14): de velden staan er zodra de naam een
  // kruislaaghoutopbouw is — óók als de plaat juist daarom geweigerd wordt,
  // want hier vult de gebruiker de ontbrekende keuze in.
  const isClt = plaatMateriaalSoort(plate.materiaal) === "clt";
  const [g12Str, setG12Str] = useState(plate.cltG12 !== undefined ? String(plate.cltG12) : "");
  const [g12BronStr, setG12BronStr] = useState(plate.cltG12Bron ?? "");
  useEffect(() => {
    setG12Str(plate.cltG12 !== undefined ? String(plate.cltG12) : "");
    setG12BronStr(plate.cltG12Bron ?? "");
  }, [plate.id, plate.cltG12, plate.cltG12Bron]);
  const commitG12 = () => {
    if (!updatePlate) return;
    const leeg = g12Str.trim() === "";
    const v = Number(g12Str);
    if (!leeg && !(Number.isFinite(v) && v > 0)) {
      setG12Str(plate.cltG12 !== undefined ? String(plate.cltG12) : "");
      return;
    }
    const nieuw = leeg ? undefined : v;
    if (nieuw !== plate.cltG12) updatePlate(plate.id, { cltG12: nieuw });
  };
  const commitG12Bron = () => {
    if (!updatePlate) return;
    const nieuw = g12BronStr.trim() === "" ? undefined : g12BronStr.trim();
    if (nieuw !== plate.cltG12Bron) updatePlate(plate.id, { cltG12Bron: nieuw });
  };
  // Keuzelijst: de klassen die de kern kent, plus de kruislaaghout-
  // voorinstellingen met C24 als lamelklasse. Vrije invoer blijft mogelijk —
  // "VRIJ:…" en een eigen opbouw typ je gewoon.
  const materiaalSuggesties = [
    ...STEEL_GRADES,
    ...SUPPORTED_CONCRETE_CLASSES,
    ...SUPPORTED_TIMBER_GRADES,
    ...CLT_VOORINSTELLINGEN.map((v) => `CLT C24 ${v.thicknesses_mm.join("/")}`),
  ];
  const commitMateriaal = () => {
    if (!updatePlate) return;
    const nieuw = materiaalStr.trim();
    if (nieuw === (plate.materiaal ?? "")) return;
    // Een materiaal kiezen WIST de losse E, ν en ρ, zodat ze uit het
    // materiaal komen; die velden zijn met de PLATE_DEFAULTS gevuld en zouden
    // anders als "handmatige overschrijving" gelezen worden en het materiaal
    // stil overrulen. Het materiaal weghalen zet ze weer op de defaults,
    // want zonder materiaal MOET de plaat eigen getallen hebben.
    if (nieuw === "") {
      updatePlate(plate.id, {
        materiaal: undefined,
        E: plate.E ?? PLATE_DEFAULTS.E,
        nu: plate.nu ?? PLATE_DEFAULTS.nu,
        rho: plate.rho ?? PLATE_DEFAULTS.rho,
      });
    } else {
      updatePlate(plate.id, {
        materiaal: nieuw,
        ...(heeftMateriaal ? {} : { E: undefined, nu: undefined, rho: undefined }),
      });
    }
  };
  const bronTekst: Record<string, string> = {
    materiaal: t("props.plate.sourceMaterial"), handmatig: t("props.plate.sourceManual"), standaard: t("props.plate.sourceDefault"),
    aanname: t("props.plate.sourceAssumption"),
  };

  const openingMaat = (p: { x: number; z: number }[]) => {
    const xs = p.map((q) => q.x), zs = p.map((q) => q.z);
    const b = Math.max(...xs) - Math.min(...xs), h = Math.max(...zs) - Math.min(...zs);
    return p.length === 4
      ? t("props.plate.openingSize", { b, h, x: Math.min(...xs), z: Math.min(...zs) })
      : t("props.plate.openingCorners", { aantal: p.length });
  };

  return (
    <div className="fem-properties">
      <div className="fem-prop-selection">
        <span className="fem-prop-selection-label">{t("props.common.selection")}</span>
        <span className="fem-prop-selection-value">{t("props.plate.title", { id: plate.id })}</span>
      </div>
      <div className="fem-prop-tabs">
        <button className="fem-prop-tab active">{t("props.common.general")}</button>
      </div>
      <div className="fem-prop-body">
        <Section title={t("props.common.geometry")}>
          <Row label="ID"><code>{plate.id}</code></Row>
          <Row label={t("props.common.type")}><code>{t("props.plate.typeWall")}</code></Row>
          {plate.nodeIds.map((id, i) => {
            const n = nodes.find(nn => nn.id === id);
            return <Row key={`pc${i}`} label={t("props.plate.corner", { nummer: i + 1 })}>
              <code>{id}{n ? ` (${n.x}, ${n.z})` : ""}</code>
            </Row>;
          })}
        </Section>
        <Section title={t("props.plate.materialTitle")}>
          <Row label={t("props.plate.material")}>
            <input
              type="text"
              list={`plaatmat${plate.id}`}
              className="fem-prop-input fem-prop-input-mono"
              value={materiaalStr}
              placeholder={t("props.plate.materialPlaceholder")}
              onChange={(e) => setMateriaalStr(e.target.value)}
              onBlur={commitMateriaal}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              title={t("props.plate.materialTitleAttr")}
            />
          </Row>
          <datalist id={`plaatmat${plate.id}`}>
            {materiaalSuggesties.map((m) => <option key={m} value={m} />)}
          </datalist>
          {materiaalFout && (
            <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--theme-danger, #dc2626)" }}>
              <strong>{t("props.plate.materialRejected")}</strong> {materiaalFout} {t("props.plate.materialRejectedHint")}
            </div>
          )}
          {stijfheid && stijfheid.soort !== null && (
            <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--theme-text-faint)" }}>
              {stijfheid.herkomst}
            </div>
          )}
          {stijfheid?.orthotroop && (
            <Row label={t("props.plate.mainDirection")}>
              <input
                {...inputProps} step="15" value={hoekStr}
                onChange={(e) => setHoekStr(e.target.value)}
                onBlur={() => {
                  if (!updatePlate) return;
                  const leeg = hoekStr.trim() === "";
                  const v = Number(hoekStr);
                  if (!leeg && !Number.isFinite(v)) { setHoekStr(plate.hoofdrichting !== undefined ? String(plate.hoofdrichting) : ""); return; }
                  updatePlate(plate.id, { hoofdrichting: leeg ? undefined : v });
                }}
                title={t("props.plate.mainDirectionTitle")}
              />
            </Row>
          )}
          {stijfheid?.orthotroop && (
            <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--theme-text-faint)" }}>
              {t("props.plate.orthotropic", {
                e1: Math.round(stijfheid.E1),
                e2: Math.round(stijfheid.E2),
                g12: Math.round(stijfheid.G12),
                nu12: stijfheid.nu12,
              })}
            </div>
          )}
          {isClt && (
            <>
              <Row label={t("props.plate.cltG12")}>
                <input
                  {...inputProps} step="10" min="1" value={g12Str}
                  disabled={plate.cltG12Bovengrens === true}
                  onChange={(e) => setG12Str(e.target.value)}
                  onBlur={commitG12}
                  title={t("props.plate.cltG12Title")}
                />
              </Row>
              <Row label={t("props.plate.cltG12Source")}>
                <input
                  type="text"
                  className="fem-prop-input"
                  value={g12BronStr}
                  disabled={plate.cltG12Bovengrens === true}
                  placeholder={t("props.plate.cltG12SourcePlaceholder")}
                  onChange={(e) => setG12BronStr(e.target.value)}
                  onBlur={commitG12Bron}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  title={t("props.plate.cltG12SourceTitle")}
                />
              </Row>
              <Row label={t("props.plate.cltG12UpperBound")}>
                <input
                  type="checkbox"
                  checked={plate.cltG12Bovengrens === true}
                  onChange={(e) => updatePlate?.(plate.id, { cltG12Bovengrens: e.target.checked ? true : undefined })}
                  title={t("props.plate.cltG12UpperBoundTitle")}
                />
              </Row>
            </>
          )}
          {stijfheid && stijfheid.waarschuwingen.length > 0 && (
            <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--theme-warning, #b45309)" }}>
              {stijfheid.waarschuwingen.map((w, i) => (
                <div key={i}><strong>{t("props.plate.warning")}</strong> {w}</div>
              ))}
            </div>
          )}
          <Row label={t("props.plate.thickness")}>
            <input
              {...inputProps} step="1" min="0.1" value={dikteStr}
              onChange={e => setDikteStr(e.target.value)}
              onBlur={() => commitVeld(dikteStr, "thickness",
                v => v > 0, () => setDikteStr(String(d.thickness)))}
              title={t("props.plate.thicknessTitle")}
            />
          </Row>
          <Row label="E (N/mm²)">
            <input
              {...inputProps} step="1000" min="1" value={eStr}
              placeholder={heeftMateriaal && stijfheid ? t("props.plate.fromMaterialPlaceholder", { waarde: Math.round(stijfheid.E1) }) : ""}
              onChange={e => setEStr(e.target.value)}
              onBlur={() => commitVeld(eStr, "E",
                v => v > 0, () => setEStr(tekst(d.E)), heeftMateriaal)}
              title={heeftMateriaal
                ? t("props.plate.eOverrideTitle")
                : t("props.plate.eTitle")}
            />
          </Row>
          <Row label="ν (—)">
            <input
              {...inputProps} step="0.05" min="0" max="0.49" value={nuStr}
              placeholder={heeftMateriaal && stijfheid ? t("props.plate.fromMaterialPlaceholder", { waarde: stijfheid.nu12 }) : ""}
              onChange={e => setNuStr(e.target.value)}
              onBlur={() => commitVeld(nuStr, "nu",
                v => v >= 0 && v < 0.5, () => setNuStr(tekst(d.nu)), heeftMateriaal)}
              title={heeftMateriaal
                ? t("props.plate.nuOverrideTitle")
                : t("props.plate.nuTitle")}
            />
          </Row>
          <Row label="ρ (kg/m³)">
            <input
              {...inputProps} step="50" min="0" value={rhoStr}
              placeholder={heeftMateriaal && stijfheid ? t("props.plate.fromMaterialPlaceholder", { waarde: Math.round(stijfheid.rho) }) : ""}
              onChange={e => setRhoStr(e.target.value)}
              onBlur={() => commitVeld(rhoStr, "rho",
                v => v >= 0, () => setRhoStr(tekst(d.rho)), heeftMateriaal)}
              title={heeftMateriaal
                ? t("props.plate.rhoOverrideTitle")
                : t("props.plate.rhoTitle")}
            />
          </Row>
          {stijfheid && (
            <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--theme-text-faint)" }}>
              {t("props.plate.source", {
                e: bronTekst[stijfheid.bronE],
                nu: bronTekst[stijfheid.bronNu],
                rho: bronTekst[stijfheid.bronRho],
              })}
            </div>
          )}
        </Section>
        {updatePlate && <Section title={t("props.plate.nonlinearTitle")}>
          <PlateNonlinearEditor plate={plate} baseEMpa={stijfheid?.E1}
            onApply={patch => updatePlate(plate.id, patch)} />
        </Section>}
        <Section title={t("props.plate.meshTitle")}>
          <Row label={t("props.plate.meshSize")}>
            <input
              {...inputProps} step="50" min="10" value={meshStr}
              onChange={e => setMeshStr(e.target.value)}
              onBlur={() => commitVeld(meshStr, "meshSize",
                v => v >= 10, () => setMeshStr(String(d.meshSize)))}
              title={t("props.plate.meshSizeTitle")}
            />
          </Row>
          <Row label={t("props.plate.elements")}>
            <select
              className="fem-prop-input"
              value={plate.meshType ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                updatePlate?.(plate.id, {
                  meshType: PLAAT_MESH_TYPEN.includes(v as never) ? (v as typeof PLAAT_MESH_TYPEN[number]) : undefined,
                });
              }}
              title={t("props.plate.elementsTitle")}
            >
              <option value="">{t("props.plate.elementsDefault", { type: meshTypeLabel[raster ? "vierhoeken" : "driehoeken"] })}</option>
              <option value="vierhoeken">{t("props.plate.meshQuads")}</option>
              <option value="driehoeken">{t("props.plate.meshTriangles")}</option>
            </select>
          </Row>
          <Row label={t("props.plate.computesAs")}><code style={{ whiteSpace: "normal" }}>{meshSoortTekst}</code></Row>
          <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--theme-text-faint)" }}>
            {t("props.plate.invalidateBefore")} <strong>{t("props.plate.invalidateCalculate")}</strong> {t("props.plate.invalidateAfter")}
          </div>
        </Section>
        <Section title={t("props.plate.openingsTitle", { aantal: openingen.length })}>
          {openingen.length === 0 && (
            <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--theme-text-faint)" }}>
              {t("props.plate.noOpeningsBefore")} <strong>{t("props.plate.noOpeningsTool")}</strong> {t("props.plate.noOpeningsAfter")}
            </div>
          )}
          {openingen.map((o) => (
            <Row key={`op${o.id}`} label={t("props.plate.opening", { id: o.id })}>
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <code style={{ whiteSpace: "normal" }}>{openingMaat(o.punten)}</code>
                <button
                  type="button"
                  className="fem-prop-btn"
                  onClick={() => verwijderOpening(o.id)}
                  title={t("props.plate.removeOpeningTitle")}
                >
                  {t("props.plate.removeOpening")}
                </button>
              </span>
            </Row>
          ))}
          {openingen.length > 0 && (
            <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--theme-text-faint)" }}>
              {t("props.plate.openingsHint")}
              {!raster && " " + t("props.plate.openingsHintCdt")}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

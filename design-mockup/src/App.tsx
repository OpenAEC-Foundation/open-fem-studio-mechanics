import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { beschrijfOnbekendeDoorsnede, onbekendeOpenFem3DDoorsneden } from "./components/openFem3d/openFem3dDoorsnedeKeuring";
import { zonderResultaten } from "./lib/weergaveModel";
import { undoRoute, moetEerstVastleggen } from "./lib/undoRoute";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import TitleBar from "./components/TitleBar";
import { PRODUCTNAAM } from "./lib/productNaam";
import Ribbon from "./components/ribbon/Ribbon";
import DocumentBar from "./components/DocumentBar";
import StatusBar, { type SolverStatus } from "./components/StatusBar";
import Backstage from "./components/backstage/Backstage";
import ToastHost, { pushToast } from "./components/feedback/Toast";
import ImportVerslagVenster, { type ImportVerslag } from "./extensies/ImportVerslagVenster";
import { MeerdereImporteursFout, useExtensieStore } from "./extensies/extensieStore";
import { useRecentFiles } from "./hooks/useRecentFiles";
import { useBestandskoppeling } from "./hooks/useBestandskoppeling";
import { maakWachtpoort, type Wachtpoort } from "./io/bestandskoppeling";
import SettingsDialog, { applyTheme, themeId, type SettingsTabId } from "./components/settings/SettingsDialog";
import SneltoetsenDialog from "./components/SneltoetsenDialog";
import OnopgeslagenDialog, { type OnopgeslagenKeuze } from "./components/OnopgeslagenDialog";
import CanvasMeldingen from "./components/fem/CanvasMeldingen";
import { materiaalVanStaaf } from "./lib/staafMateriaal";
import { erIsEenDialoogOpen } from "./components/Modal";
import { actieVoorToets, isTypVeld } from "./lib/sneltoetsen";
import FeedbackDialog from "./components/feedback/FeedbackDialog";
import WelcomeScreen from "./components/welcome/WelcomeScreen";
import ProjectSettingsDialog, { DEFAULT_UITGANGSPUNTEN } from "./components/project/ProjectSettingsDialog";
import IfcViewerPanel from "./components/panels/IfcViewerPanel";
import type { IfcRekenmodelInput } from "./io/ifcExport";
import { useProjectInfo } from "./components/report/useProjectInfo";
import ReportPreview, { DetachedReportPreview } from "./components/panels/ReportPreview";
import { ReportWindowSync } from "./components/report/reportSync";
import type { ReportData } from "./components/report/ReportDataContext";
import InsightsView from "./components/panels/InsightsView";
import PrestressedBeamView from "./components/panels/PrestressedBeamView";
import VolumeWorkbench from "./components/volume3d/VolumeWorkbench";
import FemProjectTree from "./components/fem/FemProjectTree";
import FemProperties from "./components/fem/FemProperties";
import FemCanvas from "./components/fem/FemCanvas";
import {
  addOpenFem3DSurfaceLoad, openFem3DPinToColumnsMessage, openFem3DPinToColumnsScope, pinOpenFem3DBeamsToColumns, withOpenFem3DSelfWeight,
  type OpenFem3DModel,
} from "./components/openFem3d/openFem3dModel";
import { setOpenFem3DTensionOnlySetting } from "./components/openFem3d/openFem3dTrekSchijf";
import {
  applyOpenFem3DNodeConditionToNodes, openFem3DNodeConditionOfTool, openFem3DNodeToolClick, readOpenFem3DSpringStiffness,
  type OpenFem3DNodeTarget,
} from "./components/openFem3d/openFem3dNodeTools";
import { placeOpenFem3DPointLoad, type OpenFem3DPointLoadTarget } from "./components/openFem3d/openFem3dPlaatsen";
import {
  findOpenFem3DNodesOnBeams, openFem3DConnectAfterImport, openFem3DConnectButton, openFem3DConnectMessage, openFem3DEditWithAutoConnect,
  type OpenFem3DAutoEditStep, type OpenFem3DConnectMessagePart, type OpenFem3DConnectResult, type OpenFem3DConnectStep,
} from "./components/openFem3d/openFem3dAansluiten";
import {
  openFem3DMergeButton, openFem3DMergeMessage, openFem3DSelectionAfterMerge, type OpenFem3DMergeMessagePart, type OpenFem3DMergeStep,
} from "./components/openFem3d/openFem3dSamenvoegen";
import { readOpenFem3DDeformationDisplay, saveOpenFem3DDeformationDisplay } from "./components/openFem3d/openFem3dDeformationDisplay";
import { readOpenFem3DDiagramLabels, saveOpenFem3DDiagramLabels } from "./components/openFem3d/openFem3dDiagramLabels";
import { openFem3dHistoryReducer, openFem3DHistoryExtern, openFem3DHistoryLevelPatch, type OpenFem3DAction, type OpenFem3DEditMeta, type OpenFem3DHistory } from "./components/openFem3d/openFem3dHistory";
import { changedLockedOpenFem3DLayer } from "./components/openFem3d/openFem3dLayers";
import { applyOpenFem3DLevels, openFem3DLevelRefusalText, openFem3DLevelTransition, withOpenFem3DLevelPatch, withoutUnknownOpenFem3DLevelLinks, type OpenFem3DLevel } from "./components/openFem3d/openFem3dLevels";
import { gebruikteEigenDoorsneden, type ApiDocument } from "./api/projectDocument";
import { voerApiUitInApp, type ApiAppActies } from "./bediening/apiAdapter";
import {
  convertOpenFem3DPlateToLoadPanels,
  openFem3DSpanFromNodes,
  updateOpenFem3DLoadPanel,
} from "./components/openFem3d/openFem3dLoadPanels";
import type { OpenFem3DSpringAxis, OpenFem3DTool, OpenFem3DView } from "./components/openFem3d/openFem3dCommands";
import type { OpenFem3DSelection } from "./components/openFem3d/openFem3dSelection";
import { openFem3DSelectieBelastinggevallen, openFem3DSelectieIds } from "./components/openFem3d/openFem3dSelectieFilter";
import { SelectieFilterVenster2D, SelectieFilterVenster3D } from "./components/selectieFilter/SelectieFilterVenster";
import { filterLastGeval } from "./components/selectieFilter/selectieFilter";
import { selectieBelastinggevallen2D, type SelectieIds2D } from "./components/fem/selectieFilter2d";
import type { OpenFem3DCameraState, OpenFem3DStandaardViewId, OpenFem3DViewSet } from "./components/openFem3d/openFem3dViewSets";
import { openFem3DStartCamera } from "./components/openFem3d/openFem3dViewCube";
import { openFem3DMaatgevendeCombinatie, openFem3DViewSetToepassing, type OpenFem3DViewToepassing } from "./components/openFem3d/openFem3dStandaardViews";
import {
  openFem3DVisibilityForTool, openFem3DVisibilityZonderSectionBox, readOpenFem3DVisibility, saveOpenFem3DVisibility,
} from "./components/openFem3d/openFem3dVisibility";
import { openFem3DSectionBoxSchakel } from "./components/openFem3d/openFem3dSectionBox";
import { toggleOpenFem3DExplode } from "./components/openFem3d/openFem3dExplode";
import { readOpenFem3DPlateQuantity, saveOpenFem3DPlateQuantity } from "./components/openFem3d/openFem3dPlateResults";
import { convert2DTo3D } from "./components/openFem3d/convert2DTo3D";
import { solveOpenFem3D, solveOpenFem3DCombination, type OpenFem3DSolveResult } from "./components/openFem3d/openFem3dSolver";
import {
  chooseOpenFem3DRoute, openFem3DNativeAnalysis, openFem3DNativeCalculationModel, solveOpenFem3DNative,
  solveOpenFem3DNativeCombination, type OpenFem3DRouteChoice,
} from "./components/openFem3d/openFem3dNativeRoute";
import OpenFem3DReport from "./components/openFem3d/OpenFem3DReport";
import OpenFem3DExplorer from "./components/openFem3d/OpenFem3DExplorer";
import OpenFem3DProperties from "./components/openFem3d/OpenFem3DProperties";
import {
  SOLVER_PREFERENCE_KEY,
  SOLVER_REGISTRY,
  normaliseSolverPreference,
  resolveSolver,
  type SolverAnalysisKind,
  type SolverDescriptor,
  type SolverEngineId,
} from "./core/solver/SolverRegistry";
import LibraryDialog, { type LibraryTab } from "./components/settings/LibraryDialog";
import TableView from "./components/table/TableView";
import type { TableDataset, TableViewApi } from "./components/table/tableTypes";
import LoadCaseTabBar from "./components/fem/LoadCaseTabBar";
import LoadCasesDialog from "./components/fem/LoadCasesDialog";
import WindGeneratorDialog from "./lib/wind/WindGeneratorDialog";
import OpenFem3DEnvelopeLoadsDialog, { type EnvelopeLoadInput } from "./components/openFem3d/OpenFem3DEnvelopeLoadsDialog";
import StaalhalWizard from "./components/openFem3d/wizards/StaalhalWizard";
import { metBelastinggevalIds, requireStaalhalWindRoute, STAALHAL_GEVAL,
  type StaalhalResultaat } from "./components/openFem3d/wizards/staalhal";
import WaterAccumulation2DDialog from "./components/fem/WaterAccumulation2DDialog";
import { resolveSection } from "./lib/sectionResolver";
import { windUitgangspunten } from "./lib/wind/windGenerator";
import { NEDERLANDSE_WINDROUTE, windCodeIdFromProjectInfo, type WindCodeId } from "./lib/wind/windCodeRoute";
import { useWindGenerator } from "./stores/windStore";
import { pasRapportSnapshotToe, rapportSnapshot } from "./stores/reportStore";
import Sheet from "./components/openaec/Sheet";
import { getDetachedParams, useWindowManager } from "./hooks/useWindowManager";
// Het bedieningskanaal (OPENAEC_GUI_CONTROL=1): dezelfde closures als de knoppen,
// aangesproken van buiten. Doet niets zolang Rust zegt dat het kanaal uit staat.
import { useBediening, type RekengangUitkomst } from "./bediening/bediening";
import { useFemStore, type VeldpatroonOutputs } from "./hooks/useFemStore";
import type { GridAxisLine, GridSettings, Selection, StructuralGrid, Tool } from "./components/fem/femTypes";
import { DEFAULT_GRID, DEFAULT_STRUCTURAL_GRID, nonlinearVoorBestand } from "./components/fem/femTypes";
import LengthInput from "./components/LengthInput";
import type { SolverResult } from "./components/fem/solver/types";
import { solveAllCases, solveAllCasesNonlinear } from "./components/fem/solver/solver";
import { solveAllCasesNativeMembrane2D, solveAllCombinationsNativeMembrane2D,
  voegNativeDrieLagencontroleToe } from "./components/fem/solver/nativeMembraneRoute";
import { solveAllCasesNativeFrame2D, solveAllCombinationsNativeFrame2D } from "./components/fem/solver/nativeFrame2DRoute";
import {
  heeftTrekAlleen,
  zetSolverLogOpvanger,
} from "./components/fem/solver/engine";
import { maakSolverLogOpvanger } from "./stores/solverLogStore";
import {
  combineResults,
  computeEnvelope,
} from "./components/fem/solver/combinations";
import {
  bepaalAlphaCr,
  alphaCrLabel,
  ALPHA_CR_GRENS_EERSTE_ORDE,
  noemerTekst,
  stabiliteitsMeldingen,
  type AlphaCrUitkomst,
} from "./components/fem/solver/alphaCr";
import { ANALYSETYPE_LABEL, ANALYSETYPE_OMSCHRIJVING } from "./components/fem/femTypes";
import type { MultiInput } from "./components/fem/solver/types";
import { kiesOpenFem3DResultaat } from "./lib/openFem3dResultaatKeuze";
import { losEindtoestandOp, losEindtoestandNativeOp } from "./lib/houtEindstijfheid";
import { splitsVeldgevallen, veldpatronenUitkomst } from "./components/fem/solver/veldpatronen";
import { DEFAULT_DISPLAY_FLAGS, type DisplayFlags } from "./components/fem/FemResultsOverlay";
import ZichtbaarheidVenster from "./components/fem/ZichtbaarheidVenster";
import { WEERGAVE_VOORKEUREN_SLEUTEL, metVoorkeuren, voorkeurenVan } from "./lib/zichtbaarheid";
import { bouwMultiInput } from "./lib/modelNaarSolverInput";
import {
  EIGEN_GEWICHT_STANDAARD_AAN, STANDAARD_ACTIEF_GEVAL_ID, eigenGewichtAanbodVanToepassing,
  standaardBelastinggevallen, eigenGewichtGeval,
} from "./lib/eigenGewicht";
import { eigenGewichtOverzicht } from "./lib/eigenGewichtOverzicht";
import { controleerVoorRekenen, leesbareRekenfout } from "./lib/rekenPoort";
import { leesSnapInstellingen, SNAP_SCHAKELAARS_3D, SNAP_SOORTEN } from "./hooks/useSnapInstellingen";
// Scheefstand: φ komt óf uit de vaste noemer (het oude gedrag, en de stand van
// elk bestaand projectbestand) óf uit de normformule van EN 1993-1-1 (5.5),
// EN 1992-1-1 (5.1) of EN 1995-1-1 (5.1) — zie lib/scheefstandNorm.ts.
import {
  bepaalScheefstand,
  leidScheefstandGeometrieAf,
  scheefstandToelichtingVertaald,
  scheefstandToelichting,
  toepasselijkeScheefstandNormen,
} from "./lib/scheefstandNorm";
import {
  bepaalScheefstand3D,
  leidScheefstandGeometrieAf3D,
  metScheefstandRichtingen3D,
  scheefstandToelichting3DVertaald,
  scheefstandToelichting3D,
  torsieRijen3D,
  scheefstandVanCombinatie,
  toepasselijkeScheefstandNormen3D,
} from "./components/openFem3d/openFem3dScheefstand";
import type { Vertaalfunctie } from "./lib/vertaalbareTekst";
import type { LoadCombination } from "./components/fem/solver/combinations";
import { combinationsToFile, combinationsFromFile, onbekendeTopVelden, deserializeProject, serializeProject } from "./io/projectFile";
import { ifcAnalyseProject, type IfcAnalyseImport } from "./io/ifcAnalyseImport";
import { useIfcImportStroom } from "./components/ifcImport/useIfcImportStroom";
import {
  importeer as importeerEigenDoorsneden,
} from "./lib/profieleditor/eigenDoorsnedenStore";
import {
  exporteer as exporteerCltOpbouwen,
  importeer as importeerCltOpbouwen,
} from "./lib/profieleditor/cltOpbouwenStore";
import { isTauriApp, revealInFolder } from "./lib/tauri";
import { getSetting, setSetting } from "./store";
import "./themes.css";
import "./App.css";

const ThreeViewer = lazy(() => import("./components/panels/ThreeViewer"));
const OpenFem3DEditor = lazy(() => import("./components/openFem3d/OpenFem3DEditor"));

/**
 * Rust tussen de laatste modelwijziging en de live-herberekening. Lang genoeg
 * om een sleepbeweging (tientallen updates per seconde) als één wijziging te
 * behandelen, kort genoeg om als directe reactie te voelen.
 */
const HERBEREKEN_VERTRAGING_MS = 300;

/**
 * De bibliotheken uit een geopend projectbestand samenvoegen met de lokale.
 *
 * Beide winkels voegen SAMEN in plaats van te vervangen, en het PROJECT wint
 * bij een gelijke naam — het bestand beschrijft immers waarmee dít model is
 * doorgerekend. Vroeger verving het openen de lokale lijst compleet: twee
 * projecten na elkaar openen wiste de doorsneden van het eerste.
 *
 * Wat het project overschrijft is geen bijzaak, dus geeft deze functie de
 * overschreven namen terug om te MELDEN. Stil overschrijven is precies het
 * probleem dat het samenvoegen oplost; het zou er anders alleen zachter
 * uitzien.
 *
 * Een ouder bestand zonder deze velden laat de lokale bibliotheken ongemoeid.
 */
function voegBibliothekenSamen(parsed: {
  eigenDoorsneden?: Parameters<typeof importeerEigenDoorsneden>[0];
  eigenCltOpbouwen?: Parameters<typeof importeerCltOpbouwen>[0];
}): string | null {
  const delen: string[] = [];
  if (parsed.eigenDoorsneden) {
    const namen = importeerEigenDoorsneden(parsed.eigenDoorsneden);
    if (namen.length > 0) delen.push(`doorsneden: ${namen.join(", ")}`);
  }
  if (parsed.eigenCltOpbouwen) {
    const namen = importeerCltOpbouwen(parsed.eigenCltOpbouwen);
    if (namen.length > 0) delen.push(`CLT-opbouwen: ${namen.join(", ")}`);
  }
  return delen.length > 0 ? delen.join(" · ") : null;
}

/**
 * Detached window — shows only one view, no ribbon/backstage/etc.
 * Has a "dock back" button to re-attach to the main window.
 */
function DetachedApp({ view, title }: { view: string; title: string }) {
  const { requestDockBack } = useWindowManager();
  const { t } = useTranslation();

  useEffect(() => {
    getSetting("theme", "light").then((saved) => applyTheme(saved));
    // Browservenster (window.open-fallback): venstertitel zelf zetten.
    document.title = `${title} — ${PRODUCTNAAM}`;
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      getCurrentWindow().show();
    }).catch(() => {});
  }, [title]);

  const handleDockBack = () => {
    // Browser-fallback: het venster is met window.open geopend en mag
    // zichzelf sluiten — het rapport leeft gewoon door in het hoofdvenster.
    if (!isTauriApp()) {
      window.close();
      return;
    }
    requestDockBack(title, view);
  };

  const renderView = () => {
    switch (view) {
      case "ifc":
        return <IfcViewerPanel />;
      case "report":
        // R5 — live gesynchroniseerd rapport (snapshot-push via reportSync).
        return <DetachedReportPreview />;
      case "viewer":
        return (
          <Suspense fallback={<div className="placeholder"><p>{t("app.view.loading3d")}</p></div>}>
            <ThreeViewer />
          </Suspense>
        );
      default:
        return <div className="placeholder"><p>{t("app.view.detached")}</p></div>;
    }
  };

  return (
    <>
      <TitleBar onSettingsClick={() => {}} onFeedbackClick={() => {}} />
      {/* Dock-back bar */}
      <div className="detached-dock-bar">
        <span className="detached-dock-title">{title}</span>
        <button className="detached-dock-btn" onClick={handleDockBack} title={t("app.view.dockBackTitle")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          <span>{t("app.view.dockBack")}</span>
        </button>
      </div>
      <main className="main-view" style={{ flex: 1 }}>
        {renderView()}
      </main>
      <StatusBar />
    </>
  );
}


/**
 * De melding na knopen op staven aansluiten in 3D (issue #63): hoeveel staven
 * in hoeveel delen, welke knopen niet aangesloten konden worden, en waar
 * (selectie, hele model, automatisch, na importeren). Buiten de component:
 * geen toestand, dus ook bruikbaar in de callbacks zonder afhankelijkheden
 * (setOpenFem3d, sluitAanNaImport).
 */
function meldOpenFem3DAansluiten(stap: OpenFem3DConnectStep<OpenFem3DConnectResult>): void {
  const message = openFem3DConnectMessage(stap.result, stap.context);
  const tekst = (part: OpenFem3DConnectMessagePart) =>
    i18next.t(part.key, { ...(part.values ?? {}), ...(part.count === undefined ? {} : { count: part.count }) });
  void import("./io/notify").then(({ notifyInfo, notifySuccess, notifyWarning }) => {
    const meld = message.level === "success" ? notifySuccess : message.level === "warning" ? notifyWarning : notifyInfo;
    meld(tekst(message.title), message.details.map(tekst).join(" "));
  }).catch(() => {});
}

/**
 * De melding na knopen samenvoegen in 3D (issue #75): welke knopen opgingen
 * in welke, welke staven verdwenen of samengingen, wat geweigerd is en
 * waarom, en waar (selectie, hele model, automatisch). Een lijst
 * vertaalsleutels in een regel (de eigenschappen waarin twee staven
 * verschillen) wordt vertaald en met komma's ingevuld. `levels` (de levels
 * van het stramien) noemt een level bij naam en hoogte in plaats van zijn id.
 * Buiten de component, net als `meldOpenFem3DAansluiten`.
 */
function meldOpenFem3DSamenvoegen(stap: OpenFem3DMergeStep, levels: readonly OpenFem3DLevel[]): void {
  const message = openFem3DMergeMessage(stap.result, stap.context, levels);
  const tekst = (part: OpenFem3DMergeMessagePart) => i18next.t(part.key, {
    ...(part.values ?? {}),
    ...(part.count === undefined ? {} : { count: part.count }),
    ...Object.fromEntries(Object.entries(part.lists ?? {}).map(([naam, sleutels]) => [naam, sleutels.map((s) => i18next.t(s)).join(", ")])),
  });
  void import("./io/notify").then(({ notifyInfo, notifySuccess, notifyWarning }) => {
    const meld = message.level === "success" ? notifySuccess : message.level === "warning" ? notifyWarning : notifyInfo;
    meld(tekst(message.title), message.details.map(tekst).join(" "));
  }).catch(() => {});
}

function meldVergrendeldeLaag(name: string): void {
  void import("./io/notify").then(({ notifyWarning }) => notifyWarning(
    i18next.t("common:tree.layerLockedTitle"),
    i18next.t("common:tree.layerLockedEdit", { name }),
  )).catch(() => {});
}

function App() {
  // Check if this is a detached window
  const detachedParams = getDetachedParams();
  if (detachedParams.detached && detachedParams.view) {
    return <DetachedApp view={detachedParams.view} title={detachedParams.title ?? "Untitled"} />;
  }
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Met welk tabblad Instellingen opent: het lint "AI-assistent (MCP)" opent
  // op dat tabblad (issue #109); de andere ingangen op het laatst gebruikte.
  const [settingsTab, setSettingsTab] = useState<SettingsTabId | undefined>(undefined);
  const openSettings = useCallback((tab?: SettingsTabId) => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);
  const [backstageOpen, setBackstageOpen] = useState(false);
  const [sneltoetsenOpen, setSneltoetsenOpen] = useState(false);
  // Currently-open project path (Tauri only; empty string = unsaved).
  // Save → write back to this path; Save As → always opens dialog and updates this.
  const [projectPath, setProjectPath] = useState<string>("");
  const [importVerslag, setImportVerslag] = useState<ImportVerslag | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [theme, setTheme] = useState("light");
  // Bibliotheek-dialoog (Instellingen-ribbon: Materialen / Profielen) —
  // alleen-lezen naslag, geen editor.
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("sections");
  // Themawissel vanaf de ribbon (Instellingen-tab): direct toepassen +
  // persist — zelfde route als Opslaan in SettingsDialog.
  const handleThemeSelect = useCallback((value: string) => {
    setTheme(value);
    applyTheme(value);
    void setSetting("theme", value);
  }, []);
  const [activeView, setActiveView] = useState("default");
  // Eén gezaghebbende modeldimensie. Omzetten naar 3D is bewust eenrichtingsverkeer.
  const [modelDimension, setModelDimension] = useState<"2d" | "3d">("2d");
  // De 3D-historie loopt via een ref, zodat undo/redo vóór het dispatchen de
  // levelstand van die stap kan lezen (een levelhoogte en de knopen die
  // meeschuiven zijn één stap, maar de levels staan in het stramien van de
  // raamwerkstore). useReducer rekent pas bij de volgende render.
  const [openFem3dHistory, setOpenFem3dHistoryState] = useState<OpenFem3DHistory>({
    model: { nodes: [], beams: [] }, past: [], future: [],
  });
  const openFem3dHistoryRef = useRef(openFem3dHistory);
  const explodeAmountRef = useRef(0);
  const dispatchOpenFem3D = useCallback((action: OpenFem3DAction) => {
    if (explodeAmountRef.current > 0 && action.type !== "replace") return;
    const next = openFem3dHistoryReducer(openFem3dHistoryRef.current, action);
    if (next === openFem3dHistoryRef.current) return;
    openFem3dHistoryRef.current = next;
    setOpenFem3dHistoryState(next);
  }, []);
  const openFem3d = openFem3dHistory.model;
  /**
   * Elke bewerking van het 3D-model uit de app (tekenvlak, eigenschappen,
   * transformaties, gereedschappen) komt hier langs. Staat "Knopen
   * automatisch samenvoegen en aansluiten" aan (tab Weergave), dan wordt eerst
   * een punt dat de bewerking binnen de verbindingstolerantie van een
   * bestaande knoop legde, die knoop (issue #75), en daarna worden de knopen
   * die de bewerking op een staaf legde, of de bestaande knopen waar een nieuwe
   * of verplaatste staaf doorheen loopt, aangesloten (issue #63): in dezelfde
   * stap ongedaan maken, met een korte melding per soort. Bij een plaat-,
   * opening- of belastingvlakcontour in aanbouw (tekengroep) pas als de
   * contour sluit, voor de knopen van die plaat of dat vlak. De commando's van
   * de API gaan niet hierlangs (`bewerk3D`): die doen precies wat ze zeggen;
   * samenvoegen en aansluiten zijn daar de commando's model3d.nodes.merge en
   * model3d.beam.connectNodes. Geeft de stap terug, zodat een transformatie
   * haar selectie op de knoop zet waarin een verplaatste knoop opging en op
   * alle delen van een gesplitste staaf.
   */
  const setOpenFem3d = useCallback((model: OpenFem3DModel, meta?: OpenFem3DEditMeta): OpenFem3DAutoEditStep => {
    const current = openFem3dHistoryRef.current.model;
    const snap = leesSnapInstellingen();
    const unchanged = (): OpenFem3DAutoEditStep => ({
      model: current, result: null, merge: null,
      context: { scope: "auto", toleranceMm: snap.verbindingsTolerantie },
    });
    if (explodeAmountRef.current > 0) {
      return unchanged();
    }
    const blockedBefore = changedLockedOpenFem3DLayer(current, model);
    const stap = blockedBefore ? null : openFem3DEditWithAutoConnect(current, model, snap, meta?.historyGroup);
    const blocked = blockedBefore ?? (stap ? changedLockedOpenFem3DLayer(current, stap.model) : null);
    if (blocked) {
      meldVergrendeldeLaag(blocked.name);
      return unchanged();
    }
    if (!stap) return unchanged();
    dispatchOpenFem3D({ type: "edit", model: stap.model, ...meta });
    if (stap.merge) {
      meldOpenFem3DSamenvoegen({ model: stap.model, result: stap.merge, context: { scope: "auto", toleranceMm: stap.context.toleranceMm } },
        femRef.current.structuralGrid.zAxes);
    }
    if (stap.result) meldOpenFem3DAansluiten({ ...stap, result: stap.result });
    return stap;
  }, []);
  const [openFem3dTool, setOpenFem3dTool] = useState<OpenFem3DTool>("select");
  const [openFem3dSelection, setOpenFem3dSelection] = useState<OpenFem3DSelection>(null);
  // Overspanning van een belastingvlak kiezen: twee knopen (van → naar) of één staaf.
  const [openFem3dSpanPick, setOpenFem3dSpanPick] = useState<{ panelId: number; firstNodeId: number | null } | null>(null);
  const meldLoadPanelFout = (cause: unknown) => {
    const message = cause instanceof Error ? cause.message : String(cause);
    void import("./io/notify").then(({ notifyWarning }) =>
      notifyWarning(i18next.t("ribbon:openFem3d.loadPanel.failed"), message)).catch(() => {});
  };
  const handleOpenFem3DToolChange = (next: OpenFem3DTool) => {
    if (explodeAmountRef.current > 0 && next !== "select") return;
    setOpenFem3dTool(next);
    if (next !== "loadPanelSpan") setOpenFem3dSpanPick(null);
    if (next === "addLoadPanel" || next === "addPointLoad") {
      // Wat je tekent, moet je ook zien: lasten (en belastingvlakken) in beeld.
      setOpenFem3dShowLoadCase(true);
      setResultsTabActive(false);
    }
    // Wat het gereedschap nodig heeft, komt in beeld: lasten en belastingvlakken
    // bij een belastingvlak, de staven bij Scharnier aan staafeind (#93).
    setOpenFem3dVisibility((value) => openFem3DVisibilityForTool(value, next));
  };
  const handleOpenFem3DSelectionChange = (next: OpenFem3DSelection) => {
    if (openFem3dTool === "loadPanelSpan" && openFem3dSpanPick) {
      // Het vlak blijft geselecteerd; de klikken leveren alleen de richting.
      const { panelId, firstNodeId } = openFem3dSpanPick;
      const finish = (from?: number, to?: number) => {
        if (from !== undefined && to !== undefined) {
          try {
            setOpenFem3d(updateOpenFem3DLoadPanel(openFem3d, panelId, {
              distribution: "oneWay", spanDirection: openFem3DSpanFromNodes(openFem3d, from, to),
            }));
          } catch (cause) {
            meldLoadPanelFout(cause);
          }
        }
        setOpenFem3dSpanPick(null);
        setOpenFem3dTool("select");
        setOpenFem3dSelection({ type: "loadPanel", id: panelId });
      };
      if (next === null) finish();
      else if (next.type === "beam") {
        const beam = openFem3d.beams.find((candidate) => candidate.id === next.id);
        if (beam) finish(beam.startNodeId, beam.endNodeId);
      } else if (next.type === "node") {
        if (firstNodeId === null || firstNodeId === next.id) setOpenFem3dSpanPick({ panelId, firstNodeId: next.id });
        else finish(firstNodeId, next.id);
      }
      return;
    }
    setOpenFem3dSelection(next);
    if (openFem3dTool === "addMemberLoad") {
      if (next?.type === "beam" && openFem3d.beams.some((beam) => beam.id === next.id)) {
        setRightPanelOpen(true);
        setOpenFem3dMemberLoadEditorRequest((serial) => serial + 1);
      }
      return;
    }
    // Een knoop gekozen in de verkenner terwijl een oplegging- of
    // veergereedschap actief is: die knoop krijgt de voorwaarde.
    if (next?.type === "node" && openFem3DNodeConditionOfTool(openFem3dTool)) applyOpenFem3DNodeTool({ nodeId: next.id });
  };
  /**
   * Oplegging- of veergereedschap (openFem3dNodeTools): de klik landde op een
   * knoop of op het werkvlak (leeg canvas, dan komt er een nieuwe knoop). Knoop
   * en voorwaarde zijn één modelwijziging, dus één stap ongedaan maken. Bij een
   * veer gaat de cursor naar het veerveld, met de laatst gebruikte stijfheid.
   */
  const applyOpenFem3DNodeTool = (target: OpenFem3DNodeTarget, tool: OpenFem3DTool = openFem3dTool) => {
    const placed = openFem3DNodeToolClick(openFem3dHistoryRef.current.model, target, tool);
    if (!placed) return;
    setOpenFem3d(placed.model);
    setOpenFem3dSelection({ type: "node", id: placed.nodeId });
    const { condition } = placed;
    if (condition.kind === "spring") {
      setRightPanelOpen(true);
      setOpenFem3dSpringEditorRequest((request) => ({ axis: condition.axis, serial: (request?.serial ?? 0) + 1 }));
    }
  };
  /**
   * Puntlastgereedschap (#77): de klik landde op een knoop (knooplast) of op
   * een staaf (staafpuntlast op die plek), met de standaardwaarde in het
   * actieve belastinggeval. Eén stap ongedaan maken; de nieuwe last staat
   * geselecteerd in het eigenschappenpaneel, om de waarde of plek te verfijnen.
   */
  const applyOpenFem3DPointLoadTool = (target: OpenFem3DPointLoadTarget) => {
    const current = openFem3dHistoryRef.current.model;
    const placed = placeOpenFem3DPointLoad(current, target, fem.activeLoadCaseId);
    setOpenFem3d(placed.model);
    setOpenFem3dShowLoadCase(true);
    setResultsTabActive(false);
    setOpenFem3dSelection(placed.selection);
    setRightPanelOpen(true);
  };
  /**
   * Na Toepassen met lasten (selectiefilter, issue #94), in 2D en 3D: liggen
   * de gekozen lasten in meerdere belastinggevallen, dan staan alleen die van
   * het actieve geval in beeld (`filterLastGeval`); zeg dat.
   */
  const meldGefilterdeLastenInMeerdereGevallen = (gevallen: readonly number[], geval: number) => {
    const naam = fem.loadCases.find((item) => item.id === geval)?.name
      || i18next.t("common:selectieFilter.geval", { id: geval });
    void import("./io/notify").then(({ notifyInfo }) => notifyInfo(
      i18next.t("common:selectieFilter.meerdereGevallen.titel"),
      i18next.t("common:selectieFilter.meerdereGevallen.tekst", { aantal: gevallen.length, geval: naam }),
    )).catch(() => {});
  };
  /**
   * De selectie uit het selectiefilter (issue #94), ook via
   * model3d.selection.filter met `select`. Staan er lasten in, dan komen de
   * lasten in beeld: lastweergave en de zichtbaarheid van lasten en
   * belastingvlakken aan, resultaten uit, en het geval van `filterLastGeval`
   * actief (anders stonden ze geselecteerd maar niet getekend). Liggen ze in
   * meerdere gevallen, dan volgt een melding. Er is geen selectiegeschiedenis:
   * het is één gewone selectiewissel.
   */
  const zetGefilterdeSelectie3D = (next: OpenFem3DSelection) => {
    setOpenFem3dSelection(next);
    const ids = openFem3DSelectieIds(next);
    if (!ids) return;
    const gevallen = openFem3DSelectieBelastinggevallen(openFem3dHistoryRef.current.model, ids);
    const keuze = filterLastGeval(gevallen, fem.activeLoadCaseId);
    if (!keuze) return;
    setOpenFem3dShowLoadCase(true);
    setResultsTabActive(false);
    setOpenFem3dVisibility((value) => value.loads && value.loadPanels ? value : { ...value, loads: true, loadPanels: true });
    if (keuze.geval !== fem.activeLoadCaseId) fem.setActiveLoadCaseId(keuze.geval);
    if (keuze.meerdere) meldGefilterdeLastenInMeerdereGevallen(gevallen, keuze.geval);
  };
  /**
   * Een lintknop voor een oplegging of veer met een selectie: één knoop krijgt
   * hem zoals altijd; meerdere geselecteerde knopen (bijv. via "Alle selecteren"
   * bij Opleggingen) krijgen hem allemaal, als één stap ongedaan maken.
   */
  const applyOpenFem3DNodeToolToSelection = (tool: OpenFem3DTool) => {
    const nodeIds = openFem3dSelection?.type === "node" ? [openFem3dSelection.id]
      : openFem3dSelection?.type === "multi" ? openFem3dSelection.nodeIds : [];
    if (nodeIds.length === 1) { applyOpenFem3DNodeTool({ nodeId: nodeIds[0] }, tool); return; }
    const condition = openFem3DNodeConditionOfTool(tool);
    if (nodeIds.length === 0 || !condition) return;
    const stiffness = condition.kind === "spring" ? readOpenFem3DSpringStiffness(condition.axis) : 0;
    const current = openFem3dHistoryRef.current.model;
    const next = applyOpenFem3DNodeConditionToNodes(current, nodeIds, condition, stiffness);
    if (next !== current) setOpenFem3d(next);
  };
  /**
   * Liggers scharnierend op kolommen (#93): de geselecteerde staven, of alle
   * staven als er geen staaf geselecteerd is (openFem3DPinToColumnsScope).
   * Eén stap ongedaan maken; een melding (openFem3DPinToColumnsMessage) zegt
   * hoeveel staafeinden scharnierend zijn gemaakt en hoeveel momentvast
   * bleven omdat er anders een mechanisme ontstaat.
   */
  const handleOpenFem3DPinBeamsToColumns = () => {
    const current = openFem3dHistoryRef.current.model;
    const scope = openFem3DPinToColumnsScope(current, openFem3dSelection);
    const result = pinOpenFem3DBeamsToColumns(current, scope);
    if (result.model !== current) setOpenFem3d(result.model);
    const message = openFem3DPinToColumnsMessage(result, scope);
    const tekst = (part: { key: string; count?: number }) =>
      i18next.t(part.key, part.count === undefined ? {} : { count: part.count });
    void import("./io/notify").then(({ notifyInfo, notifySuccess }) => {
      (message.level === "success" ? notifySuccess : notifyInfo)(tekst(message.title), message.details.map(tekst).join(" "));
    }).catch(() => {});
  };
  /**
   * Knopen op staven aansluiten (issue #63): de lintknop werkt op de
   * geselecteerde knopen en staven (met de eindknopen van die staven), of op
   * het hele model zonder knoop of staaf in de selectie ("selectie"); de knop
   * Aansluiten in de modelcontrole altijd op het hele model ("model"). Het
   * bereik en de tolerantie bepaalt `openFem3DConnectButton`, met dezelfde
   * zuivere functie als het API-commando model3d.beam.connectNodes; één stap
   * ongedaan maken, met de melding welke staven in hoeveel delen gesplitst zijn.
   */
  const handleOpenFem3DConnectNodes = (bereik: "selectie" | "model") => {
    const current = openFem3dHistoryRef.current.model;
    const stap = openFem3DConnectButton(current, openFem3dSelection, leesSnapInstellingen(), bereik);
    const blocked = changedLockedOpenFem3DLayer(current, stap.model);
    if (blocked) { meldVergrendeldeLaag(blocked.name); return; }
    if (stap.model !== current) dispatchOpenFem3D({ type: "edit", model: stap.model });
    meldOpenFem3DAansluiten(stap);
  };
  /**
   * Knopen samenvoegen (issue #75): de lintknop werkt op de geselecteerde
   * knopen (met de eindknopen van geselecteerde staven en de hoeken van
   * geselecteerde platen), of op het hele model zonder selectie ("selectie");
   * de knop Samenvoegen in de modelcontrole altijd op het hele model
   * ("model"). Het bereik en de tolerantie (de verbindingstolerantie) bepaalt
   * `openFem3DMergeButton`, met dezelfde zuivere functie als het API-commando
   * model3d.nodes.merge; één stap ongedaan maken, met de samenvatting. Een
   * geselecteerde knoop die opging in een andere, wordt die andere.
   */
  const handleOpenFem3DMergeNodes = (bereik: "selectie" | "model") => {
    const current = openFem3dHistoryRef.current.model;
    const stap = openFem3DMergeButton(current, openFem3dSelection, leesSnapInstellingen(), bereik);
    const blocked = changedLockedOpenFem3DLayer(current, stap.model);
    if (blocked) { meldVergrendeldeLaag(blocked.name); return; }
    if (stap.model !== current) {
      dispatchOpenFem3D({ type: "edit", model: stap.model });
      setOpenFem3dSelection((selectie) => openFem3DSelectionAfterMerge(selectie, stap.result));
    }
    meldOpenFem3DSamenvoegen(stap, fem.structuralGrid.zAxes);
  };
  // Elke nieuwe waarde klapt de modelcontrole van het 3D-tekenvlak open (Berekenen met losse knopen).
  const [openFem3dModelCheckToken, setOpenFem3dModelCheckToken] = useState(0);
  const [openFem3dDeleteToken, setOpenFem3dDeleteToken] = useState(0);
  const [openFem3dFitToken, setOpenFem3dFitToken] = useState(0);
  const [openFem3dViewRequest, setOpenFem3dViewRequest] = useState<{ kind: OpenFem3DView; token: number }>({ kind: "iso", token: 0 });
  const [openFem3dCameraSnapshot, setOpenFem3dCameraSnapshot] = useState<{
    state: OpenFem3DCameraState; viewToken: number; fitToken: number;
  } | null>(null);
  const [openFem3dLoadEditorRequest, setOpenFem3dLoadEditorRequest] = useState<{ kind: "force" | "moment"; serial: number } | null>(null);
  const [openFem3dSpringEditorRequest, setOpenFem3dSpringEditorRequest] = useState<{
    axis: OpenFem3DSpringAxis; serial: number;
  } | null>(null);
  const [openFem3dMemberLoadEditorRequest, setOpenFem3dMemberLoadEditorRequest] = useState(0);
  const [openFem3dMemberPointLoadEditorRequest, setOpenFem3dMemberPointLoadEditorRequest] = useState(0);
  const [openFem3dThermalLoadEditorRequest, setOpenFem3dThermalLoadEditorRequest] = useState(0);
  const [openFem3dResult, setOpenFem3dResult] = useState<OpenFem3DSolveResult | null>(null);
  const [openFem3dCaseResults, setOpenFem3dCaseResults] = useState<Map<number, OpenFem3DSolveResult>>(new Map());
  const [openFem3dCombinationResults, setOpenFem3dCombinationResults] = useState<Map<number, OpenFem3DSolveResult>>(new Map());
  // De resultaten horen bij het model waarmee ze gerekend zijn. Het effect
  // verderop (op `openFem3d`) wist ze pas NA de render met het nieuwe model:
  // in die ene render kreeg het tekenvlak het nieuwe model met het oude
  // resultaat, en bij een ander project met platen brak de contourlaag op de
  // onbekende knopen van het oude net de app af ("APP BOOTSTRAP ERROR").
  // Daarom hier, tijdens de render, al wissen zodra het model een ander is
  // (React rendert dan meteen opnieuw, zonder de oude combinatie te tonen).
  const [openFem3dResultaatModel, setOpenFem3dResultaatModel] = useState(openFem3d);
  if (openFem3dResultaatModel !== openFem3d) {
    setOpenFem3dResultaatModel(openFem3d);
    setOpenFem3dResult(null);
    setOpenFem3dCaseResults(new Map());
    setOpenFem3dCombinationResults(new Map());
  }
  const [openFem3dActiveCombinationId, setOpenFem3dActiveCombinationId] = useState<number | null>(null);
  // De combinaties zoals ze gerekend zijn: met scheefstand ontvouwt elke UGT-
  // combinatie in +X, −X, +Y en −Y. Leeg = nog niet gerekend.
  const [openFem3dSolvedCombinations, setOpenFem3dSolvedCombinations] = useState<LoadCombination[]>([]);
  const [openFem3dSolveError, setOpenFem3dSolveError] = useState<string | null>(null);
  const openFem3dSolveGenerationRef = useRef(0);
  const [visibility3DOpen, setVisibility3DOpen] = useState(false);
  const [openFem3dVisibility, setOpenFem3dVisibility] = useState(readOpenFem3DVisibility);
  explodeAmountRef.current = openFem3dVisibility.explode.amountM;
  useEffect(() => {
    if (openFem3dVisibility.explode.amountM > 0) setOpenFem3dTool("select");
  }, [openFem3dVisibility.explode.amountM]);
  // Vergroting van de vervormde vorm en "Origineel tonen": een weergavevoorkeur.
  const [openFem3dDeformationDisplay, setOpenFem3dDeformationDisplay] = useState(readOpenFem3DDeformationDisplay);
  useEffect(() => saveOpenFem3DDeformationDisplay(openFem3dDeformationDisplay), [openFem3dDeformationDisplay]);
  // Getallen bij de snedekrachtlijnen (Waarden, weinig … veel): een weergavevoorkeur, ook in eigen views.
  const [openFem3dDiagramLabels, setOpenFem3dDiagramLabels] = useState(readOpenFem3DDiagramLabels);
  useEffect(() => saveOpenFem3DDiagramLabels(openFem3dDiagramLabels), [openFem3dDiagramLabels]);
  // De Model-tab is een weergavestand; het tonen van lastsymbolen is een
  // afzonderlijke keuze in Weergave en mag deze tabselectie niet veranderen.
  const [openFem3dShowLoadCase, setOpenFem3dShowLoadCase] = useState(true);
  const [openFem3dViewSets, setOpenFem3dViewSets] = useState<OpenFem3DViewSet[]>([]);
  // Tab Views van de 3D-verkenner: de standaardviews buiten het rapport (in het
  // project bewaard), de laatst toegepaste view en de camera van een eigen view.
  const [openFem3dStandaardViewsUitRapport, setOpenFem3dStandaardViewsUitRapport] = useState<OpenFem3DStandaardViewId[]>([]);
  const [openFem3dActieveView, setOpenFem3dActieveView] = useState<string | null>(null);
  const [openFem3dCameraVerzoek, setOpenFem3dCameraVerzoek] = useState<{ state: OpenFem3DCameraState; token: number }>();
  useEffect(() => saveOpenFem3DVisibility(openFem3dVisibility), [openFem3dVisibility]);
  const [openFem3dPlateQuantity, setOpenFem3dPlateQuantity] = useState(readOpenFem3DPlateQuantity);
  useEffect(() => saveOpenFem3DPlateQuantity(openFem3dPlateQuantity), [openFem3dPlateQuantity]);
  useEffect(() => {
    openFem3dSolveGenerationRef.current += 1;
    setOpenFem3dResult(null);
    setOpenFem3dCaseResults(new Map());
    setOpenFem3dCombinationResults(new Map());
    setOpenFem3dSolvedCombinations([]);
    setOpenFem3dActiveCombinationId(null);
    setOpenFem3dSolveError(null);
    if (modelDimension === "3d") setSolverStatus({ kind: "ready" });
  }, [openFem3d, modelDimension]);
  // FEM tool state — shared between Ribbon (active highlight) + FemCanvas (action)
  const [femTool, setFemTool] = useState<Tool>("select");
  // Projectgegevens uit de projectinstellingen — voeden onder meer de
  // IFC-export (projectnaam, nummer, ingenieur, bedrijf, locatie) en reizen
  // mee in het projectbestand. Vóór de raamwerkstore, omdat de gevolgklasse
  // uit de uitgangspunten bij de rekeninstellingen hoort.
  const projectInfo = useProjectInfo();
  // FEM model state lifted to App.tsx via useFemStore.
  // De gevolgklasse uit de projectgegevens bepaalt de partiële factoren van de
  // standaardcombinaties (NB tabel NB.4/NB.5). De store past haar toe op de
  // combinaties (een onbekende of ontbrekende waarde laat hem ongemoeid) en
  // neemt de klasse waarmee hij werkelijk rekent op in de rekeninstellingen,
  // zodat een andere klasse de oude resultaten wist.
  const fem = useFemStore({
    gevolgklasse: projectInfo.uitgangspunten?.gevolgklasse ?? null,
    // De nationale bijlage bepaalt de nationaal bepaalde parameters van elke
    // toetsing (normnaad); een wijziging laat de resultaten vervallen.
    nationaleBijlage: projectInfo.uitgangspunten?.nationaleBijlage ?? null,
  });
  useEffect(() => {
    if (modelDimension !== "3d") return;
    // Issue #245: een LEEG actief geval (geen last, dus niet berekend) gaf hier
    // `null`, ook direct na een geslaagde rekengang — het resultatenpaneel bleef
    // op "Klik op Berekenen" en `gui_solve` meldde "geen resultaat". Dezelfde
    // keuze als `handleSolve` (`kiesOpenFem3DResultaat`): de eerste berekende
    // combinatie, zichtbaar als actieve combinatie, of anders een berekend geval
    // als actief geval.
    const keuze = kiesOpenFem3DResultaat(openFem3dCaseResults, openFem3dCombinationResults,
      fem.activeLoadCaseId, openFem3dSolvedCombinations);
    if (keuze.wisselNaarGeval !== null) {
      fem.setActiveLoadCaseId(keuze.wisselNaarGeval);
      return;
    }
    setOpenFem3dActiveCombinationId(keuze.combinationId);
    setOpenFem3dResult(keuze.result);
    // Een mislukte rekengang maakt de resultaatmap leeg en zet daarna de
    // concrete solverfout. Die lege map mag de fout niet in dezelfde commit
    // weer wissen. Alleen een werkelijk gevulde, geldige resultatenset mag de
    // oude foutstatus vervangen wanneer de gebruiker van belastinggeval wisselt.
    if (openFem3dCaseResults.size > 0 || openFem3dCombinationResults.size > 0) {
      setOpenFem3dSolveError(null);
      setSolverStatus(keuze.result ? { kind: "solved", at: Date.now() } : { kind: "ready" });
    }
  }, [fem.activeLoadCaseId, modelDimension, openFem3dCaseResults, openFem3dCombinationResults]);
  useEffect(() => {
    if (modelDimension !== "3d") return;
    openFem3dSolveGenerationRef.current += 1;
    setOpenFem3dResult(null);
    setOpenFem3dCaseResults(new Map());
    setOpenFem3dCombinationResults(new Map());
    setOpenFem3dSolvedCombinations([]);
    setOpenFem3dActiveCombinationId(null);
    setOpenFem3dSolveError(null);
    setSolverStatus({ kind: "ready" });
  }, [fem.rekenInstellingenVersie, modelDimension]);
  // Altijd de verse store, ook vanuit een meldingsknop die in een eerder event
  // is gemaakt (het aanbod "Eigen gewicht naar een eigen geval" bij het openen).
  const femRef = useRef(fem);
  femRef.current = fem;
  // HET AUTOMATISCHE EIGEN GEWICHT, één keer afgeleid en als GEGEVEN doorgegeven
  // aan tekenvlak, tabbalk en tabel — uit dezelfde functie als de rekengang
  // (`eigenGewichtLasten`, via lib/eigenGewichtOverzicht). Issue #42.
  const eigenGewicht = useMemo(() => eigenGewichtOverzicht({
    nodes: fem.nodes, beams: fem.beams, plates: fem.plates,
    loadCases: fem.loadCases, selfWeightEnabled: fem.selfWeightEnabled,
  }), [fem.nodes, fem.beams, fem.plates, fem.loadCases, fem.selfWeightEnabled]);
  const openFem3dCalculation = useMemo((): {
    model: OpenFem3DModel; selfWeightError: string | null; selfWeightCaseId?: number;
  } => {
    if (modelDimension !== "3d") return { model: openFem3d, selfWeightError: null };
    const eigenGewichtCase = eigenGewichtGeval(fem.loadCases, fem.selfWeightEnabled);
    if (!eigenGewichtCase) return { model: openFem3d, selfWeightError: null };
    try {
      return {
        model: withOpenFem3DSelfWeight(openFem3d, eigenGewichtCase.id), selfWeightError: null,
        selfWeightCaseId: eigenGewichtCase.id,
      };
    } catch (cause) {
      return {
        model: openFem3d,
        selfWeightError: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }, [openFem3d, modelDimension, fem.loadCases, fem.selfWeightEnabled]);
  const openFem3dCalculationModel = openFem3dCalculation.model;
  // De kleur van een lastvlak volgt de soort van zijn belastinggeval (tabbalk).
  const openFem3dLoadCaseTypes = useMemo(
    () => new Map(fem.loadCases.map((loadCase) => [loadCase.id, loadCase.type] as const)),
    [fem.loadCases],
  );
  const biedEigenGewichtGevalAan = eigenGewichtAanbodVanToepassing({
    loadCases: fem.loadCases, selfWeightEnabled: fem.selfWeightEnabled,
  });
  const handleVerplaatsEigenGewicht = useCallback(() => {
    const id = femRef.current.verplaatsEigenGewicht();
    if (id === null) return;
    void import("./io/notify").then(({ notifySuccess }) =>
      notifySuccess(
        i18next.t("common:eigenGewicht.verplaatstTitel"),
        i18next.t("common:eigenGewicht.verplaatst"),
      ));
  }, []);
  // Windbelastinggenerator — de hook draait de generator mee met wijzigingen
  // in de constructie (idempotent, zie windStore.ts). Staat hier boven de
  // snapshot-opbouw omdat zijn instellingen in het projectbestand gaan.
  const windGenerator = useWindGenerator(fem);
  const { addRecentFile, loaded: recenteBestandenGeladen } = useRecentFiles();
  // R5 — losgekoppeld rapportvenster ("Naast je scherm").
  const { createDetachedWindow } = useWindowManager();
  const { t: tRibbon } = useTranslation("ribbon");

  // ── Levels in 3D ────────────────────────────────────────────────────────
  // Een level is een horizontale stramienas (zAxes). In 3D hangen knopen en
  // platen eraan (`levelId`) en schuiven ze mee als de hoogte verandert. De
  // levels staan in het stramien van de raamwerkstore, het model in de
  // 3D-historie; hoogte en meeschuivende knopen zijn toch één stap: undo/redo
  // zetten de levelstand van die stap terug in het stramien.
  const setStructuralGridState = fem.setStructuralGrid;
  const undoRedoOpenFem3D = useCallback((kind: "undo" | "redo") => {
    if (explodeAmountRef.current > 0) return;
    const patch = openFem3DHistoryLevelPatch(openFem3dHistoryRef.current, kind);
    const extern = openFem3DHistoryExtern(openFem3dHistoryRef.current, kind);
    dispatchOpenFem3D({ type: kind });
    if (patch) setStructuralGridState((grid) => withOpenFem3DLevelPatch(grid, patch));
    extern?.();
  }, [dispatchOpenFem3D, setStructuralGridState]);
  /**
   * Nieuwe levels (zAxes) doorvoeren. In 3D gaan de gekoppelde knopen en
   * platen mee, als één stap ongedaan maken; weigert de geometrie dat (een
   * staaf zonder lengte, een plaat die scheef trekt), dan blijft alles staan
   * en komt de vertaalde reden terug. In 2D alleen het stramien, zoals altijd.
   */
  const commitLevels = useCallback((nextLevels: GridAxisLine[]): string | null => {
    if (modelDimension === "3d" && explodeAmountRef.current > 0) return i18next.t("ribbon:openFem3d.explodeEditBlocked");
    const structural = fem.structuralGrid;
    if (modelDimension !== "3d") {
      setStructuralGridState({ ...structural, zAxes: nextLevels });
      return null;
    }
    const model = openFem3dHistoryRef.current.model;
    const result = applyOpenFem3DLevels(model, nextLevels);
    if (!result.ok) {
      const { key, values } = openFem3DLevelRefusalText(result.refusal, structural.zAxes);
      return tRibbon(key, values);
    }
    const levels = openFem3DLevelTransition(structural.zAxes, nextLevels);
    // Knopen die met hun level op een andere knoop komen te liggen, voegen in
    // dezelfde stap samen (issue #75); knopen die op een staaf komen te liggen
    // (of staven die door een knoop gaan lopen), sluiten aan (issue #63).
    const stap = openFem3DEditWithAutoConnect(model, result.model, leesSnapInstellingen());
    const blocked = changedLockedOpenFem3DLayer(model, stap.model);
    if (blocked) return i18next.t("common:tree.layerLockedEdit", { name: blocked.name });
    if (levels || stap.model !== model) dispatchOpenFem3D({ type: "edit", model: stap.model, levels });
    if (stap.merge) {
      meldOpenFem3DSamenvoegen({ model: stap.model, result: stap.merge, context: { scope: "auto", toleranceMm: stap.context.toleranceMm } },
        nextLevels);
    }
    if (stap.result) meldOpenFem3DAansluiten({ ...stap, result: stap.result });
    setStructuralGridState((current) => ({ ...current, zAxes: nextLevels }));
    return null;
  }, [fem.structuralGrid, modelDimension, dispatchOpenFem3D, setStructuralGridState, tRibbon]);
  /** Het stramien van buitenaf (bedieningskanaal): levels via `commitLevels`. */
  const setStructuralGrid3D = useCallback((next: StructuralGrid) => {
    const error = commitLevels(next.zAxes);
    if (error) throw new Error(error);
    setStructuralGridState((current) => ({ ...next, zAxes: current.zAxes }));
  }, [commitLevels, setStructuralGridState]);
  const [gridLevelError, setGridLevelError] = useState<string | null>(null);
  // Na een geweigerde hoogte toont het veld weer de opgeslagen waarde.
  const [gridLevelRevision, setGridLevelRevision] = useState(0);
  const changeGridLevels = (nextLevels: GridAxisLine[]) => {
    const error = commitLevels(nextLevels);
    setGridLevelError(error === null ? null : t("app.grid.levelRefused", { reason: error }));
    if (error !== null) setGridLevelRevision((revision) => revision + 1);
  };

  // ── Tabel-editor (ribbon-tab "Tabel") ──────────────────────────────────
  // De ribbon-knoppen kiezen de dataset; de hoofdweergave "table" toont hem.
  const [tableDataset, setTableDataset] = useState<TableDataset>("nodes");
  // Imperatieve API van de gemonteerde TableView (Export CSV / Kopiëren /
  // Filter-focus vanaf de ribbon).
  const tableApiRef = useRef<TableViewApi | null>(null);
  const handleTableDataset = useCallback((d: TableDataset) => {
    setTableDataset(d);
    setActiveView("table");
  }, []);
  /** Roep een TableViewApi-actie aan; schakelt zo nodig eerst naar de
   *  tabelweergave (de view moet gemonteerd zijn vóór de api-ref bestaat). */
  const invokeTableApi = useCallback((fn: keyof TableViewApi) => {
    if (tableApiRef.current) {
      tableApiRef.current[fn]();
    } else {
      setActiveView("table");
      setTimeout(() => tableApiRef.current?.[fn](), 60);
    }
  }, []);

  const handleDetachReport = useCallback(() => {
    void createDetachedWindow({
      view: "report",
      title: tRibbon("report.report", "Rapport"),
      width: 860,
      height: 1100,
    });
  }, [createDetachedWindow, tRibbon]);

  /**
   * De scheefstand φ die deze berekening in gaat — DE ENIGE plek waar hij
   * wordt bepaald, zodat het canvas-pad (single-LC), het multi-LC-pad en het
   * scherm nooit een ander getal kunnen tonen dan er is gerekend.
   *
   * Bij `scheefstandBron = "vast"` (de beginstand en de stand van élk bestand
   * van vóór deze keuze) is de uitkomst exact 1/noemer: het oude gedrag,
   * ongewijzigd. Kiest de gebruiker een norm, dan volgt φ uit (5.5)/(5.1) met
   * h en m uit het model — of uit de handmatige waarden die hij ervoor in de
   * plaats heeft gezet.
   *
   * Deze drie memo's staan BOVEN `reportData` omdat dat object de toelichting
   * meedraagt naar het live rapport. Een `const` die verderop in dezelfde
   * functie staat, bestaat op dit punt nog niet (tijdelijke dode zone) — de
   * rapportsectie zou dan bij de eerste render omvallen in plaats van de
   * scheefstand te tonen.
   */
  const scheefstandGeometrie = useMemo(
    () => leidScheefstandGeometrieAf({
      nodes: fem.nodes, beams: fem.beams, supports: fem.supports,
    }),
    [fem.nodes, fem.beams, fem.supports]);

  const scheefstandUitkomst = useMemo(
    () => bepaalScheefstand(
      {
        bron: fem.scheefstandBron,
        noemer: fem.scheefstandNoemer,
        hoogteM: fem.scheefstandHoogteM,
        aantalElementen: fem.scheefstandAantalElementen,
      },
      scheefstandGeometrie,
      toepasselijkeScheefstandNormen(fem.beams),
    ),
    [fem.scheefstandBron, fem.scheefstandNoemer, fem.scheefstandHoogteM,
     fem.scheefstandAantalElementen, scheefstandGeometrie, fem.beams]);

  /**
   * Dezelfde keuze (bron, noemer, handmatige h en m) voor het 3D-model: h en m
   * komen uit de 3D-geometrie, φ uit dezelfde normfunctie. Alleen in 3D. Sinds
   * issue #194 per richting: m_X en m_Y per rij kolommen (EN 1993-1-1
   * 5.3.2(3)), en dus φ_X en φ_Y.
   */
  const openFem3dScheefstandGeometrie = useMemo(
    () => (modelDimension === "3d" ? leidScheefstandGeometrieAf3D(openFem3d) : null),
    [modelDimension, openFem3d]);
  const openFem3dScheefstandUitkomst = useMemo(
    () => (openFem3dScheefstandGeometrie
      ? bepaalScheefstand3D(
          {
            bron: fem.scheefstandBron,
            noemer: fem.scheefstandNoemer,
            hoogteM: fem.scheefstandHoogteM,
            aantalElementen: fem.scheefstandAantalElementen,
            // Issue #212: een handmatige m per richting.
            aantalPerAs: { x: fem.scheefstandAantalX, y: fem.scheefstandAantalY },
          },
          openFem3dScheefstandGeometrie,
          toepasselijkeScheefstandNormen3D(openFem3d),
        )
      : null),
    [fem.scheefstandBron, fem.scheefstandNoemer, fem.scheefstandHoogteM,
     fem.scheefstandAantalElementen, fem.scheefstandAantalX, fem.scheefstandAantalY,
     openFem3dScheefstandGeometrie, openFem3d]);
  // De afleiding van de scheefstand voor het rapport, alleen als zij in de
  // resultaten zit (de schakelaar aan).
  const openFem3dScheefstandTekst = useMemo(
    () => (fem.scheefstandEnabled && openFem3dScheefstandUitkomst && openFem3dScheefstandGeometrie
      ? scheefstandToelichting3D(
          openFem3dScheefstandUitkomst, openFem3dScheefstandGeometrie,
          { torsie: fem.scheefstandTorsie },
        )
      : ""),
    [fem.scheefstandEnabled, openFem3dScheefstandUitkomst, openFem3dScheefstandGeometrie, fem.scheefstandTorsie]);
  /**
   * De buitenste kolomrijen per richting voor de torsievarianten van EN 1993-1-1
   * 5.3.2(10) (issue #212); `null` met de instelling uit.
   */
  const openFem3dTorsieRijen = useMemo(
    () => (fem.scheefstandTorsie && openFem3dScheefstandGeometrie ? torsieRijen3D(openFem3dScheefstandGeometrie) : null),
    [fem.scheefstandTorsie, openFem3dScheefstandGeometrie]);
  /**
   * Wat de balk onder het canvas toont. In 3D φ_X en φ_Y, m_X en m_Y en de
   * 3D-afleiding (issue #194); anders die van 2D.
   */
  const scheefstandBalk = modelDimension === "3d" && openFem3dScheefstandUitkomst && openFem3dScheefstandGeometrie
    ? {
        noemer: openFem3dScheefstandUitkomst.x.noemer,
        noemerY: openFem3dScheefstandUitkomst.y.noemer,
        hoogteM: openFem3dScheefstandGeometrie.hoogteM,
        aantal: openFem3dScheefstandGeometrie.perAs.x.aantalElementen,
        aantalY: openFem3dScheefstandGeometrie.perAs.y.aantalElementen as number | undefined,
        toelichting: (vertaal: Vertaalfunctie) =>
          scheefstandToelichting3DVertaald(openFem3dScheefstandUitkomst, openFem3dScheefstandGeometrie, vertaal,
            { torsie: fem.scheefstandTorsie }),
        waarschuwingen: openFem3dScheefstandUitkomst.waarschuwingen,
      }
    : {
        noemer: scheefstandUitkomst.noemer,
        noemerY: undefined as number | undefined,
        hoogteM: scheefstandGeometrie.hoogteM,
        aantal: scheefstandGeometrie.aantalElementen,
        aantalY: undefined as number | undefined,
        toelichting: (vertaal: Vertaalfunctie) =>
          scheefstandToelichtingVertaald(scheefstandUitkomst, scheefstandGeometrie, vertaal),
        waarschuwingen: scheefstandUitkomst.waarschuwingen,
      };
  /** De combinaties voor de 3D-weergave: zoals gerekend, of anders die van het project. */
  const openFem3dCombinaties = openFem3dSolvedCombinations.length > 0 ? openFem3dSolvedCombinations : fem.combinations;
  // Er is gerekend, maar het actieve belastinggeval heeft geen eigen resultaat
  // (geen last): de verkenner zegt dat, en wat er in plaats daarvan staat (#245).
  const openFem3dActiefGevalLeeg = modelDimension === "3d"
    && (openFem3dCaseResults.size > 0 || openFem3dCombinationResults.size > 0)
    && !openFem3dCaseResults.has(fem.activeLoadCaseId);

  /**
   * De afleiding van de scheefstand als tekstblok voor het rapport, alleen als
   * zij in de resultaten zit (de schakelaar aan); anders leeg.
   */
  const scheefstandTekst = useMemo(
    () => (fem.scheefstandEnabled ? scheefstandToelichting(scheefstandUitkomst, scheefstandGeometrie) : ""),
    [fem.scheefstandEnabled, scheefstandUitkomst, scheefstandGeometrie]);
  /**
   * Het analysetype en α_cr per combinatie, als tekstblok voor het rapport
   * (basisaudit nr 27): welke berekening er is gedaan. Leeg zolang er niet
   * gerekend is; het rapport zwijgt dan.
   */
  const analyseTekst = useMemo(() => {
    if (!fem.combinationResults) return "";
    const uitkomsten = fem.stabiliteit ?? [];
    const regels: string[] = [
      `Resultaten: ${ANALYSETYPE_LABEL[fem.analysetype]}, ` +
        (fem.scheefstandEnabled ? `met scheefstand φ = 1/${noemerTekst(scheefstandUitkomst.noemer)}` : "zonder scheefstand") +
        `. ${ANALYSETYPE_OMSCHRIJVING[fem.analysetype]}`,
      "",
    ];
    if (uitkomsten.length === 0) {
      regels.push("Kritieke lastfactor α_cr: geen UGT-combinaties doorgerekend.");
    } else {
      regels.push("Kritieke lastfactor α_cr per UGT-combinatie (NEN-EN 1993-1-1 5.2.1(3)), knik in het vlak:");
      for (const u of uitkomsten) regels.push(`    ${alphaCrLabel(u)}   [${u.naam}]`);
      regels.push(`Eerste orde is toegestaan wanneer α_cr ≥ ${ALPHA_CR_GRENS_EERSTE_ORDE} (5.2.1(3)).`);
    }
    const meldingen = stabiliteitsMeldingen(uitkomsten, fem.analysetype, fem.scheefstandEnabled);
    // De eindstijfheid van hout (NEN-EN 1995-1-1 2.2.3(5), 2.3.2.2).
    const overig = fem.eindstijfheid.meldingen.map((m) => m.tekst).filter((t) => t.trim() !== "");
    if (meldingen.length > 0 || overig.length > 0) {
      regels.push("");
      for (const m of meldingen) regels.push(m.niveau === "info" ? m.tekst : `! ${m.tekst}`);
      for (const t of overig) regels.push(`! ${t}`);
    }
    return regels.join("\n");
  }, [fem.stabiliteit, fem.combinationResults, fem.analysetype, fem.scheefstandEnabled, fem.eindstijfheid,
      scheefstandUitkomst]);
  /**
   * De omschrijving van de gegenereerde windlasten voor de PDF (issue #16):
   * dezelfde functie waarmee het live rapport haar bij de uitgangspunten zet
   * (ProjectSection), op dezelfde gevallen en lasten uit het model — scherm en
   * papier zeggen zo hetzelfde. Vrijstaand dak (§7.3) en hellend dak met
   * automatische c_pe (§7.2.4/§7.2.5, issue #49). Leeg zonder zulke windlast.
   */
  const windTekst = useMemo(
    () => windUitgangspunten(fem.loadCases, fem.loads),
    [fem.loadCases, fem.loads]);

  // Result display toggles — lifted so both the FemCanvas HUD and the
  // FemProjectTree "Resultaten" tab can mutate the same flags. Hier, vóór
  // `reportData`: de constructieschets van het rapport volgt de laag
  // "Kipsteunen" (issue #40).
  const [displayFlags, setDisplayFlags] = useState<DisplayFlags>(DEFAULT_DISPLAY_FLAGS);
  // Venster Zichtbaarheid (issue #47): alle weergave-instellingen bij elkaar.
  const [zichtbaarheidOpen, setZichtbaarheidOpen] = useState(false);
  // Venster Selectiefilter (issue #94), in 2D en 3D, via de lintknop Filter.
  const [selectieFilterOpen, setSelectieFilterOpen] = useState(false);
  // De model-lagen (knoopnummers, staafnummers, aanzicht, …) per gebruiker
  // onthouden in de voorkeuren, niet in het projectbestand. Eerst lezen; pas
  // daarna schrijven, anders overschrijft de standaard de bewaarde keuze.
  const weergaveGeladen = useRef(false);
  useEffect(() => {
    let weg = false;
    getSetting<unknown>(WEERGAVE_VOORKEUREN_SLEUTEL, null).then((opgeslagen) => {
      if (weg) return;
      weergaveGeladen.current = true;
      setDisplayFlags((f) => metVoorkeuren(f, opgeslagen));
    });
    return () => { weg = true; };
  }, []);
  const weergaveVoorkeur = JSON.stringify(voorkeurenVan(displayFlags));
  useEffect(() => {
    if (!weergaveGeladen.current) return;
    void setSetting(WEERGAVE_VOORKEUREN_SLEUTEL, JSON.parse(weergaveVoorkeur));
  }, [weergaveVoorkeur]);

  // R5 — doorgeef-regels naar het live rapport (ReportDataContext): één
  // object voor het Rapport-tabblad én de snapshot-sync naar losgekoppelde
  // vensters. useMemo op veld-identiteiten: alleen echte mutaties leveren
  // een nieuw object (en dus een nieuw snapshot) op.
  const reportData: ReportData = useMemo(() => ({
    nodes: fem.nodes,
    beams: fem.beams,
    plates: fem.plates,
    supports: fem.supports,
    loads: fem.loads,
    loadCases: fem.loadCases,
    // De VOLLEDIGE lijst: het rapport somt ook op wat er NIET is doorgerekend,
    // met de reden erbij (`overgeslagenCombinaties`). Een lezer die zes
    // combinaties ziet waar hij er acht verwacht, moet dat in het rapport zelf
    // kunnen nazien. In dezelfde ontvouwing als de berekening: met een
    // scheefstand per combinatie een variant per richting.
    combinations: fem.combinatiesVoorRapport,
    overgeslagenCombinaties: fem.overgeslagenCombinaties,
    gevolgklasse: fem.gevolgklasse,
    // Het rapport vermeldt dat de combinaties bij het openen zijn vervangen.
    combinatieVervanging: fem.combinatieVervangingTekst,
    structuralGrid: fem.structuralGrid,
    selfWeightEnabled: fem.selfWeightEnabled,
    // R3 — resultaten voor de resultaatsecties. useFemStore zet deze op null
    // bij elke modelwijziging, dus het rapport valt dan automatisch terug op
    // "Nog niet berekend" (nooit verouderd).
    combinationResults: fem.combinationResults,
    // Per-belastinggeval-resultaten (zelfde run/invalidatie) — de
    // plaatspanningssectie superponeert hier zelf combinaties uit.
    caseResults: fem.multiLcResult,
    envelope: fem.envelope,
    // De scheefstand hoort bij de UITGANGSPUNTEN en niet bij de resultaten: zij
    // is een eigenschap van de constructie (één bouwwerk staat één keer scheef)
    // en zij zit als H = φ·V in élke kracht waarop hierna is getoetst. Daarom
    // reist zij mee met de modelgegevens en niet met `combinationResults`.
    scheefstandToelichting: scheefstandTekst,
    // Het analysetype en α_cr: welke berekening er is gedaan en of de norm
    // die toestaat (5.2.1(3)). Ook een uitgangspunt, om dezelfde reden.
    analyseToelichting: analyseTekst,
    // De laag "Kipsteunen" van het tekenvlak: aan = ook in de constructieschets.
    kipsteunenTonen: displayFlags.kipsteunen !== false,
    // De laag "Aanzicht" (issue #45): aan = de schets tekent de staven op ware grootte.
    aanzichtTonen: displayFlags.aanzicht === true,
  }), [
    fem.nodes, fem.beams, fem.plates, fem.supports, fem.loads, fem.loadCases,
    fem.combinatiesVoorRapport, fem.overgeslagenCombinaties, fem.combinatieVervangingTekst,
    fem.structuralGrid, fem.selfWeightEnabled,
    fem.combinationResults, fem.multiLcResult, fem.envelope,
    scheefstandTekst, analyseTekst, displayFlags.kipsteunen, displayFlags.aanzicht,
  ]);

  // ── File-menu handlers (after `fem` is declared) ────────────────────────
  const buildProjectSnapshot = useCallback(() => ({
    nodes: fem.nodes,
    beams: fem.beams,
    supports: fem.supports,
    plates: fem.plates,
    loads: fem.loads,
    loadCases: fem.loadCases,
    activeLoadCaseId: fem.activeLoadCaseId,
    selfWeightEnabled: fem.selfWeightEnabled,
    // Het analysetype gaat er als eigen veld in; de oude booleaan blijft
    // ernaast staan zodat een oudere versie van de app (en de sidecar) het
    // bestand nog kan lezen — beide tweede-orde-standen zijn daar "aan".
    nonlinearEnabled: nonlinearVoorBestand(fem.analysetype),
    analysetype: fem.analysetype,
    axialMaterialLoadPath: fem.axialMaterialLoadPath,
    betonSegmentLengteMm: fem.betonSegmentLengteMm,
    betonKruipcoefficient: fem.betonKruipcoefficient,
    betonKruipInvoer: fem.betonKruipInvoer,
    // v2: combinaties (Map-factoren → JSON-object) + stramien + scheefstand.
    combinations: combinationsToFile(fem.combinations),
    // De id-tellers reizen mee, zodat een verwijderd belastinggeval ook na
    // opslaan en openen zijn id nooit aan een nieuw geval doorgeeft.
    idTellers: fem.idTellers,
    // Zijn de combinaties bij het openen vervangen, dan reist die melding mee:
    // het rapport hoort het ook in een latere sessie te vermelden.
    combinatiesVervangenBijOpenen: fem.combinatieVervangingTekst ?? undefined,
    structuralGrid: fem.structuralGrid,
    scheefstandEnabled: fem.scheefstandEnabled,
    scheefstandNoemer: fem.scheefstandNoemer,
    scheefstandRichting: fem.scheefstandRichting,
    // De normkeuze voor φ reist mee. De vaste noemer hierboven blijft óók in
    // het bestand staan: hij is de stand waarop een lezer die deze velden niet
    // kent terugvalt, en dan verandert er niets aan zijn berekening.
    scheefstandBron: fem.scheefstandBron,
    scheefstandHoogteM: fem.scheefstandHoogteM,
    scheefstandAantalElementen: fem.scheefstandAantalElementen,
    // 3D (issue #212): m per richting en de torsievarianten van 5.3.2(10).
    scheefstandAantalX: fem.scheefstandAantalX,
    scheefstandAantalY: fem.scheefstandAantalY,
    scheefstandTorsie: fem.scheefstandTorsie,
    // Issue #199, fase 3: de eigen scheefstand per losse kolom.
    scheefstandEigenKolom: fem.scheefstandEigenKolom,
    // Issue #199, fase 4: hout in de toets volgens NEN-EN 1995-1-1.
    houtToetsEN1995: fem.houtToetsEN1995,
    // Eigen doorsneden reizen mee in het projectbestand: een staaf met
    // `EIGEN:<naam>` moet op een andere machine dezelfde doorsnede vinden.
    // Alleen de doorsneden die dit model daadwerkelijk gebruikt — anders
    // draagt elk projectbestand de complete persoonlijke bibliotheek mee.
    // Ook de 3D-staven: het splitsen van een verlopende stalen 3D-staaf (#73)
    // laat net als in 2D een eigen gelaste tussendoorsnede achter. Dezelfde
    // regel als de API-commando's (`gebruikteEigenDoorsneden`).
    eigenDoorsneden: gebruikteEigenDoorsneden({ beams: fem.beams, modelDimension, model3d: openFem3d }),
    // Idem voor de eigen CLT-vloeropbouwen; die reizen als BIJSCHRIFT mee
    // (de opbouw zelf staat al in de profielnaam van de staaf), en alleen
    // voor de opbouwen die in dit model voorkomen.
    eigenCltOpbouwen: exporteerCltOpbouwen(fem.beams),
    // Projectgegevens, windinstellingen en rapportinstellingen horen bij het
    // project en niet bij de machine; zie projectFile.ts voor de motivatie.
    projectInfo: projectInfo as unknown as Record<string, unknown>,
    windInstellingen: windGenerator.instellingen as unknown as Record<string, unknown>,
    rapport: rapportSnapshot() as unknown as Record<string, unknown>,
    modelDimension,
    ...(modelDimension === "3d" ? { model3d: openFem3d } : {}),
    ...(modelDimension === "3d" ? { openFem3dViewSets, openFem3dStandaardViewsUitRapport } : {}),
  }), [fem, openFem3d, openFem3dViewSets, openFem3dStandaardViewsUitRapport, modelDimension, projectInfo, windGenerator.instellingen]);

  /**
   * De JSON waarop de dirty-vlag rust: het MODEL, zonder projectgegevens,
   * wind- en rapportinstellingen. Die drie komen na het openen van een
   * bestand pas even later uit hun stores terug (instellingen zijn
   * asynchroon), en zouden een net geopend project meteen "gewijzigd"
   * maken. Ze gaan wél altijd mee bij het opslaan.
   */
  const modelJson = useCallback((snap: ReturnType<typeof buildProjectSnapshot>) => {
    const { projectInfo: _p, windInstellingen: _w, rapport: _r, ...model } = snap;
    return JSON.stringify(model);
  }, []);

  // ── C2: dirty-vlag ("niet-opgeslagen wijzigingen") ──────────────────────
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const setDirty = useCallback((v: boolean) => {
    isDirtyRef.current = v;
    setIsDirty(v);
  }, []);
  // JSON van de laatst opgeslagen/geladen snapshot; null = nog geen baseline.
  const lastSavedRef = useRef<string | null>(null);
  // Na Openen/Nieuw is de fem-state in de handler zelf nog oud (React-flush) —
  // deze vlag vraagt de dirty-check-effect om de eerstvolgende run als nieuwe
  // baseline te nemen.
  const baselineResetRef = useRef(false);
  // Een tweede actie tijdens een open dialoog mag geen tweede, identieke
  // bevestiging starten (bijvoorbeeld twee sluitverzoeken achter elkaar).
  const unsavedConfirmationPendingRef = useRef(false);
  // Waar zolang de sluitvraag van het kruisje loopt (onCloseRequested,
  // verderop), en daarna als de app sluit.
  const closeRequestPendingRef = useRef(false);
  // Bestandskoppeling (#90): een bestand dat binnenkomt terwijl er al een vraag
  // over niet-opgeslagen werk openstaat of het venster sluit, wacht hier tot
  // die vraag beantwoord is, in plaats van stil weg te vallen. Een ref, zodat
  // de callbacks hieronder er geen afhankelijkheid bij krijgen.
  const vraagpoortRef = useRef<Wachtpoort | null>(null);
  if (vraagpoortRef.current === null) {
    vraagpoortRef.current = maakWachtpoort(
      () => unsavedConfirmationPendingRef.current || closeRequestPendingRef.current,
    );
  }
  const [onopgeslagenOpen, setOnopgeslagenOpen] = useState(false);
  const onopgeslagenResolveRef = useRef<((k: OnopgeslagenKeuze) => void) | null>(null);

  /**
   * Melding na opslaan: bestandsnaam, map en tijd, met "Map openen" (Tauri,
   * via tauri-plugin-opener). In de browser is er geen map om te openen.
   */
  const meldOpgeslagen = useCallback((pad: string) => {
    const delen = pad.split(/[\\/]/);
    const naam = delen.pop() ?? pad;
    const map = delen.join("/");
    const tijd = new Date().toLocaleTimeString(i18next.language, { hour: "2-digit", minute: "2-digit" });
    pushToast({
      kind: "success",
      title: i18next.t("common:app.file.savedNamed", { naam }),
      body: map ? `${map} · ${tijd}` : tijd,
      duration: 6000,
      actie: isTauriApp() ? {
        label: i18next.t("common:app.file.openFolder"),
        onClick: () => { void revealInFolder(pad); },
      } : undefined,
    });
  }, []);

  /** Opslaan als — retourneert true als er daadwerkelijk is opgeslagen. */
  const handleSaveProjectAs = useCallback(async (): Promise<boolean> => {
    const { serializeProject, saveProjectAs, voorgesteldeProjectnaam } = await import("./io/projectFile");
    const { notifySuccess, notifyWarning } = await import("./io/notify");
    try {
      const snap = buildProjectSnapshot();
      const text = serializeProject(snap);
      const suggested = voorgesteldeProjectnaam(projectPath);
      const newPath = await saveProjectAs(text, suggested);
      if (newPath) {
        setProjectPath(newPath);
        addRecentFile(newPath);
      } else if (isTauriApp()) {
        // Native dialoog geannuleerd — er is niets weggeschreven.
        return false;
      }
      lastSavedRef.current = modelJson(snap);
      setDirty(false);
      if (newPath) meldOpgeslagen(newPath);
      else notifySuccess(i18next.t("common:app.file.saved"), i18next.t("common:app.file.downloadStarted"));
      return true;
    } catch (e) {
      notifyWarning(i18next.t("common:app.file.saveFailed"), e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [buildProjectSnapshot, projectPath, addRecentFile, setDirty, meldOpgeslagen]);

  /** Opslaan — naar het bekende pad, of via Opslaan-als zonder pad. */
  const handleSaveProject = useCallback(async (): Promise<boolean> => {
    if (!projectPath) {
      return handleSaveProjectAs();
    }
    const { serializeProject, saveProjectTo } = await import("./io/projectFile");
    const { notifyWarning } = await import("./io/notify");
    try {
      const snap = buildProjectSnapshot();
      const text = serializeProject(snap);
      await saveProjectTo(projectPath, text);
      lastSavedRef.current = modelJson(snap);
      setDirty(false);
      meldOpgeslagen(projectPath);
      return true;
    } catch (e) {
      notifyWarning(i18next.t("common:app.file.saveFailed"), e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [buildProjectSnapshot, projectPath, handleSaveProjectAs, setDirty, meldOpgeslagen]);

  /**
   * C2: sluitbeveiliging. Vraagt bij niet-opgeslagen wijzigingen in één
   * venster van de app (OnopgeslagenDialog) wat er moet gebeuren: Opslaan /
   * Niet opslaan / Annuleren. Esc en het kruisje betekenen Annuleren, dus er
   * gaat alleen werk verloren na een bewuste keuze voor "Niet opslaan".
   * Retourneert true wanneer de aanroeper mag doorgaan (schoon, opgeslagen of
   * bewust weggegooid), false bij Annuleren of mislukt opslaan.
   */
  const confirmUnsavedAction = useCallback(async (): Promise<boolean> => {
    if (!isDirtyRef.current) return true;
    if (unsavedConfirmationPendingRef.current) return false;
    unsavedConfirmationPendingRef.current = true;
    try {
      const keuze = await new Promise<OnopgeslagenKeuze>((resolve) => {
        onopgeslagenResolveRef.current = resolve;
        setOnopgeslagenOpen(true);
      });
      if (keuze === "opslaan") return handleSaveProject();
      return keuze === "niet";
    } finally {
      unsavedConfirmationPendingRef.current = false;
      vraagpoortRef.current?.misschienOpen();
    }
  }, [handleSaveProject, t]);

  /**
   * Eén gelezen projectbestand → de store. DE ENIGE plek waar die mapping
   * staat: "Openen…", een recent bestand én de GUI-bediening lopen er alle
   * drie doorheen. Twee openpaden die zich anders gedragen is een bug die zich
   * als een instelling vermomt — en drie is dat nog meer.
   *
   * Geeft terug wat `voegBibliothekenSamen` meldde (overschreven doorsneden),
   * zodat de aanroeper dat kan tonen; met `path` worden ook het projectpad en
   * de recente-lijst bijgewerkt.
   */
  const pasProjectToe = useCallback(
    (parsed: ReturnType<(typeof import("./io/projectFile"))["deserializeProject"]>, path?: string) => {
      baselineResetRef.current = true;
      // Vóór het model: de staven verwijzen naar deze doorsneden.
      const overschreven = voegBibliothekenSamen(parsed);
      // Een koppeling naar een level dat het stramien van het bestand niet
      // kent, valt weg; de opgeslagen geometrie blijft precies zoals ze is.
      dispatchOpenFem3D({ type: "replace", model: withoutUnknownOpenFem3DLevelLinks(
        parsed.model3d ?? { nodes: [], beams: [] },
        (parsed.structuralGrid ?? DEFAULT_STRUCTURAL_GRID).zAxes,
      ) });
      setOpenFem3dCameraSnapshot(null);
      // Een ander model: de section box (issue #86) uit, zonder de grenzen van het vorige.
      setOpenFem3dVisibility(openFem3DVisibilityZonderSectionBox);
      setOpenFem3dViewSets(parsed.openFem3dViewSets ?? []);
      setOpenFem3dStandaardViewsUitRapport(parsed.openFem3dStandaardViewsUitRapport ?? []);
      setOpenFem3dActieveView(null);
      setOpenFem3dSelection(null);
      const volgendeDimensie = parsed.modelDimension === "3d" ? "3d" : "2d";
      setModelDimension(volgendeDimensie);
      setActiveView(volgendeDimensie === "3d" ? "openFem3d" : "default");
      // De gevolgklasse van het BESTAND, vóór het laden: de standaardcombinaties
      // die bij het openen ontstaan horen bij de klasse van dit project, niet
      // bij die van het vorige.
      const uitgangspunten = (parsed.projectInfo as { uitgangspunten?: { gevolgklasse?: unknown } } | undefined)
        ?.uitgangspunten;
      const bestandsklasse = uitgangspunten?.gevolgklasse;
      const { afwijking, vervanging, gevolgklasse: geopendeKlasse, gevolgklasseBron } = fem.loadProjectState({
        nodes: parsed.nodes,
        beams: parsed.beams,
        supports: parsed.supports,
        plates: parsed.plates,
        loads: parsed.loads,
        loadCases: parsed.loadCases,
        activeLoadCaseId: parsed.activeLoadCaseId,
        selfWeightEnabled: parsed.selfWeightEnabled,
        // Beide velden gaan mee: ontbreekt `analysetype` (elk bestand van
        // vóór de drie standen), dan bepaalt de oude booleaan de stand.
        nonlinearEnabled: parsed.nonlinearEnabled,
        analysetype: parsed.analysetype,
        axialMaterialLoadPath: parsed.axialMaterialLoadPath,
        betonSegmentLengteMm: parsed.betonSegmentLengteMm,
        betonKruipcoefficient: parsed.betonKruipcoefficient,
        betonKruipInvoer: parsed.betonKruipInvoer,
        // v2-velden; undefined bij v1-bestanden → store-defaults.
        combinations: combinationsFromFile(parsed.combinations),
        structuralGrid: parsed.structuralGrid,
        scheefstandEnabled: parsed.scheefstandEnabled,
        scheefstandNoemer: parsed.scheefstandNoemer,
        scheefstandRichting: parsed.scheefstandRichting,
        // Ontbreekt `scheefstandBron` (elk bestand van vóór de normkeuze),
        // dan valt de store terug op "vast" en rekent het bestand precies
        // zoals het altijd deed.
        scheefstandBron: parsed.scheefstandBron,
        scheefstandHoogteM: parsed.scheefstandHoogteM,
        scheefstandAantalElementen: parsed.scheefstandAantalElementen,
        scheefstandAantalX: parsed.scheefstandAantalX,
        scheefstandAantalY: parsed.scheefstandAantalY,
        scheefstandTorsie: parsed.scheefstandTorsie,
        scheefstandEigenKolom: parsed.scheefstandEigenKolom,
        houtToetsEN1995: parsed.houtToetsEN1995,
        gevolgklasse:
          bestandsklasse === "CC1" || bestandsklasse === "CC2" || bestandsklasse === "CC3"
            ? bestandsklasse
            : undefined,
        // De bijlage van het BESTAND, om dezelfde reden als de klasse: de
        // standaardcombinaties die bij het openen ontstaan, horen bij γ en ψ
        // van dit project (normnaad).
        nationaleBijlage: (uitgangspunten as { nationaleBijlage?: unknown } | undefined)?.nationaleBijlage,
        idTellers: parsed.idTellers,
        combinatiesVervangenBijOpenen: parsed.combinatiesVervangenBijOpenen,
      });
      // Verouderde combinaties zijn bij het openen VERVANGEN. Tot september
      // 2026 gold "melden, niet overschrijven", en dat liet langs steeds nieuwe
      // routes stil te lage getallen door (zie lib/combinatieBeheer). Daarom nu:
      // vervangen, duidelijk melden, en "Ongedaan maken" direct in de melding.
      // Dezelfde melding en knop staan in Belastinggevallen & combinaties.
      // Eigen factoren die bewust gekozen kunnen zijn (issue #196): de knop
      // "Behoud eigen factoren" staat direct in de melding, net als in
      // Belastinggevallen & combinaties (io/combinatieMeldingen).
      if (vervanging || afwijking) {
        void import("./io/combinatieMeldingen").then(({ meldCombinatiesBijOpenen }) => {
          meldCombinatiesBijOpenen({
            vervanging, afwijking,
            maakOngedaan: fem.maakCombinatieVervangingOngedaan,
            houdEigenFactoren: fem.bevestigEigenFactoren,
          });
        });
      }
      // Issue #42: een project dat het eigen gewicht nog in het eerste
      // blijvende geval heeft, wordt NIET stil omgezet — het rekent precies als
      // voorheen. Wel een aanbod, met de knop in de melding; dezelfde knop
      // staat blijvend in de tabbalk naast "Eigen gewicht".
      if (eigenGewichtAanbodVanToepassing(parsed)) {
        void import("./io/notify").then(({ notifyWarning }) => {
          notifyWarning(
            i18next.t("common:eigenGewicht.aanbodTitel"),
            i18next.t("common:eigenGewicht.aanbod"),
            {
              actie: { label: i18next.t("common:eigenGewicht.aanbodKnop"), onClick: handleVerplaatsEigenGewicht },
              duur: 30000,
            },
          );
        });
      }
      // Projectgegevens, wind- en rapportinstellingen uit het bestand — elk
      // optioneel; een ouder bestand laat de huidige stand staan.
      // Stond de gevolgklasse niet in het bestand maar kwam hij uit het kenmerk
      // van de standaardcombinaties (`gevolgklasseBijOpenen`), dan gaat die
      // klasse ook in de projectgegevens. Anders tonen de projectgegevens de
      // klasse van het vorige project, schrijft Opslaan die weg, en werkt het
      // volgende openen de CC3-set stil bij naar die klasse.
      if (gevolgklasseBron === "kenmerk") {
        const basis = (parsed.projectInfo && typeof parsed.projectInfo === "object"
          ? parsed.projectInfo
          : projectInfo) as typeof projectInfo;
        void setSetting("projectInfo", {
          ...basis,
          uitgangspunten: { ...(basis.uitgangspunten ?? DEFAULT_UITGANGSPUNTEN), gevolgklasse: geopendeKlasse },
        });
      } else if (parsed.projectInfo && typeof parsed.projectInfo === "object") {
        void setSetting("projectInfo", parsed.projectInfo);
      }
      // De route hoort bij de projectuitgangspunten. Een oud bestand zonder
      // route kiest expliciet de historische NL-berekening; een onbekende
      // route blijft intact en wordt bij genereren geweigerd.
      const projectWindCodeId = (parsed.projectInfo as { uitgangspunten?: { windCodeId?: string } } | undefined)
        ?.uitgangspunten?.windCodeId ?? NEDERLANDSE_WINDROUTE;
      windGenerator.setInstellingen({
        ...(parsed.windInstellingen && typeof parsed.windInstellingen === "object"
          ? parsed.windInstellingen as Partial<typeof windGenerator.instellingen> : {}),
        windCodeId: projectWindCodeId as WindCodeId,
      });
      pasRapportSnapshotToe(parsed.rapport as Parameters<typeof pasRapportSnapshotToe>[0]);
      // Velden die deze versie NIET kent (basisaudit ruw 27). Ze laden niet en
      // ze overleven het volgende Opslaan niet — de opslaroute hierboven bouwt
      // een vaste veldlijst op. Gemeten voorbeeld: de `toelichting` waarmee de
      // referentiebestanden zichzelf documenteren, is na openen-en-opslaan weg.
      // Niet blokkerend (het bestand rekent gewoon), wel zichtbaar, want stil
      // verlies van gegevens van de gebruiker hoort niemand te overkomen.
      // #230: staven met een profiel of materiaal dat Berekenen weigert,
      // direct bij het openen melden in plaats van pas bij Berekenen.
      const onbekendeDoorsneden = onbekendeOpenFem3DDoorsneden(parsed.model3d ?? { beams: [] });
      if (onbekendeDoorsneden.length > 0) {
        void import("./io/notify").then(({ notifyWarning }) => {
          notifyWarning(
            i18next.t("common:app.file.unknownSections3dTitle"),
            i18next.t("common:app.file.unknownSections3dBody", {
              staven: onbekendeDoorsneden.map(beschrijfOnbekendeDoorsnede).join("; "),
            }),
            { duur: 30000 },
          );
        });
      }
      const onbekend = onbekendeTopVelden(parsed);
      if (onbekend.length > 0) {
        void import("./io/notify").then(({ notifyWarning }) => {
          notifyWarning(
            i18next.t("common:app.file.unknownFieldsTitle"),
            i18next.t("common:app.file.unknownFieldsBody", { velden: onbekend.join(", ") }),
            { duur: 30000 },
          );
        });
      }
      if (path) {
        setProjectPath(path);
        addRecentFile(path);
      }
      return overschreven;
    },
    [fem, addRecentFile, windGenerator, projectInfo, handleVerplaatsEigenGewicht],
  );

  const handleOpenProject = useCallback(async () => {
    if (!(await confirmUnsavedAction())) return;
    const { openProject, deserializeProject } = await import("./io/projectFile");
    try {
      await useExtensieStore.getState().laden();
      const filters = useExtensieStore.getState().kaarten.flatMap((kaart) => kaart.ingeschakeld && kaart.manifest
        ? kaart.manifest.importers.map((importeur) => ({
          name: `${kaart.manifest!.name}: ${importeur.label}`,
          extensions: importeur.fileExtensions,
        })) : []);
      const opened = await openProject(filters);
      if (!opened) return;
      if (opened.soort === "resultaten") {
        // Issue #87: het ingebedde project laden (zonder pad: Opslaan schrijft
        // nooit naar het .ifcfemresults), dan de opgeslagen resultaten tonen
        // zonder te rekenen — pas nadat de modelwijziging verwerkt is.
        const io = await import("./io/ifcResultatenApp");
        const gelezen = io.leesIfcResultatenVoorApp(opened.text);
        pasProjectToe(deserializeProject(gelezen.projectTekst));
        setProjectPath("");
        await io.wachtTotVerwerkt();
        if (herberekenTimerRef.current !== null) window.clearTimeout(herberekenTimerRef.current);
        herberekenTimerRef.current = null;
        // `femRef`: de store NA het laden (de `fem` van deze closure is van ervoor).
        const store = femRef.current;
        if (gelezen.tweeD.perCase.size > 0 || gelezen.tweeD.combinaties.size > 0) {
          store.setSolverOutputs(io.solverOutputsUitBestand(gelezen, store.rekenCombinaties));
        }
        if (gelezen.drieD.perCase.size > 0 || gelezen.drieD.combinaties.size > 0) {
          setOpenFem3dCaseResults(gelezen.drieD.perCase);
          setOpenFem3dCombinationResults(gelezen.drieD.combinaties);
          setOpenFem3dSolvedCombinations(store.combinations.filter((c) => gelezen.drieD.combinaties.has(c.id)));
        }
        setSolverStatus({ kind: "solved", at: Date.now() });
        const { notifySuccess } = await import("./io/notify");
        notifySuccess(i18next.t("common:app.ifcResults.opened"), opened.path.split(/[\\/]/).pop());
        return;
      }
      if (opened.soort === "import") {
        const winkel = useExtensieStore.getState();
        let gekozen: string | undefined;
        let uitkomst: Awaited<ReturnType<typeof winkel.importeer>>;
        try {
          uitkomst = await winkel.importeer(opened.path);
        } catch (fout) {
          if (!(fout instanceof MeerdereImporteursFout)) throw fout;
          const lijst = fout.keuzes.map((keuze, index) => `${index + 1}. ${keuze.extensie} — ${keuze.label}`).join("\n");
          const antwoord = window.prompt(`${i18next.t("backstage:extensionManager.chooseImporter")}\n${lijst}`);
          if (antwoord === null) return;
          const index = Number(antwoord) - 1;
          gekozen = fout.keuzes[index]?.id;
          if (!gekozen) throw new Error(i18next.t("backstage:extensionManager.invalidImporter"));
          uitkomst = await winkel.importeer(opened.path, gekozen);
        }
        const parsed = deserializeProject(uitkomst.uitkomst.projectTekst);
        const bestand = opened.path.split(/[\\/]/).pop() || opened.path;
        parsed.projectInfo = { ...parsed.projectInfo, name: bestand.replace(/\.[^.]+$/, "") };
        pasProjectToe(parsed);
        setProjectPath("");
        setImportVerslag({ bestand, extensie: uitkomst.extensie, meldingen: uitkomst.uitkomst.meldingen });
        return;
      }
      const overschreven = pasProjectToe(deserializeProject(opened.text), opened.path);
      const { notifySuccess, notifyWarning } = await import("./io/notify");
      notifySuccess(i18next.t("common:app.file.projectOpened"), opened.path.split(/[\\/]/).pop());
      if (overschreven) {
        notifyWarning(i18next.t("common:app.file.libraryUpdated"), overschreven);
      }
    } catch (e) {
      const { notifyWarning } = await import("./io/notify");
      notifyWarning(i18next.t("common:app.file.openFailed"), e instanceof Error ? e.message : String(e));
    }
  }, [pasProjectToe, confirmUnsavedAction]);

  /**
   * Voor de GUI-bediening: projecttekst → store, langs precies dezelfde weg.
   * De tekst komt van Rust (die mag elk pad lezen; de pagina niet).
   */
  const laadProjectTekst = useCallback(async (tekst: string, pad?: string) => {
    const { deserializeProject } = await import("./io/projectFile");
    pasProjectToe(deserializeProject(tekst), pad);
  }, [pasProjectToe]);

  /**
   * Open een project via een bekend pad (recente bestanden — backstage én
   * welkomstscherm). Zelfde route en sluitbeveiliging als Openen/Nieuw.
   */
  const handleOpenFilePath = useCallback(async (path: string) => {
    if (!(await confirmUnsavedAction())) return;
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const { deserializeProject } = await import("./io/projectFile");
    const { notifyWarning, notifySuccess } = await import("./io/notify");
    try {
      const text = await readTextFile(path);
      // Zelfde route als "Openen…" — via `pasProjectToe`, de enige mapping.
      const overschreven = pasProjectToe(deserializeProject(text), path);
      notifySuccess(i18next.t("common:app.file.projectOpened"), path.split(/[\\/]/).pop());
      if (overschreven) {
        notifyWarning(i18next.t("common:app.file.libraryUpdated"), overschreven);
      }
    } catch (e) {
      notifyWarning(i18next.t("common:app.file.openFailed"), e instanceof Error ? e.message : String(e));
    }
  }, [pasProjectToe, confirmUnsavedAction]);

  // Bestandskoppeling (#90): een dubbelklik op een .ifcfem/.ifcfem2d, ook als
  // de app al draait, opent langs dezelfde weg als een recent bestand. Eerst
  // wachten tot een openstaande vraag over niet-opgeslagen werk beantwoord is
  // (de vraagpoort), dan het welkomstscherm en de backstage dicht, in dezelfde
  // volgorde als de backstage bij een recent bestand; anders laadt het project
  // onzichtbaar achter die overlay.
  const openUitBestandskoppeling = useCallback(async (path: string) => {
    await vraagpoortRef.current?.wacht();
    setWelcomeOpen(false);
    setBackstageOpen(false);
    await handleOpenFilePath(path);
  }, [handleOpenFilePath]);
  // Pas als de recente bestanden geladen zijn: `addRecentFile` bouwt op die
  // lijst, en zou hem anders overschrijven met alleen dit ene bestand.
  useBestandskoppeling(openUitBestandskoppeling, recenteBestandenGeladen);

  // Bestand → Nieuw: direct een LEEG project (geen confirm, geen reload,
  // geen demo-model). Standaard belastinggevallen blijven beschikbaar zodat
  // de tab-bar en de solver-flow meteen bruikbaar zijn; undo-history wordt
  // door loadProjectState gereset. Ctrl+Z kan dus niet terug — maar het oude
  // model is via Recent/opslaan altijd nog te openen.
  const handleNewProject = useCallback(async () => {
    if (!(await confirmUnsavedAction())) return;
    baselineResetRef.current = true;
    dispatchOpenFem3D({ type: "replace", model: { nodes: [], beams: [] } });
    setOpenFem3dCameraSnapshot(null);
    // Een ander model: de section box (issue #86) uit, zonder de grenzen van het vorige.
    setOpenFem3dVisibility(openFem3DVisibilityZonderSectionBox);
    setOpenFem3dSelection(null);
    setModelDimension("2d");
    setOpenFem3dViewSets([]);
    setOpenFem3dStandaardViewsUitRapport([]);
    setOpenFem3dActieveView(null);
    fem.loadProjectState({
      nodes: [], beams: [], supports: [], plates: [], loads: [],
      // Zelfde bron als het startmodel (lib/eigenGewicht): het geval "Eigen
      // gewicht" voorop, eigen gewicht AAN, en de eerste handmatige tab actief
      // zodat een getekende last meteen in "Permanent (G)" landt (issue #42).
      loadCases: standaardBelastinggevallen(),
      activeLoadCaseId: STANDAARD_ACTIEF_GEVAL_ID,
      selfWeightEnabled: EIGEN_GEWICHT_STANDAARD_AAN,
      analysetype: "eersteOrde",
      axialMaterialLoadPath: [1],
    });
    setProjectPath("");
    setActiveView("default");
  }, [fem, setActiveView, confirmUnsavedAction]);

  // Solverstatus voor de StatusBar: Gereed / Berekend om HH:MM / Fout.
  const [solverStatus, setSolverStatus] = useState<SolverStatus>({ kind: "ready" });
  /**
   * De reden dat de laatste rekengang (multi-LC-pad) mislukte, of null. Een
   * ref en geen state: de rekengang en de bediening moeten de waarde van
   * DEZE rekengang lezen, niet die van de vorige render.
   */
  const rekenFoutRef = useRef<string | null>(null);
  /** De laatst getoonde foutmelding — dezelfde fout niet bij elke live herberekening opnieuw melden. */
  const gemeldeRekenfoutRef = useRef<string | null>(null);
  const solverResult = solverStatus.kind !== "solved" || fem.envelopeView ? null
    : fem.activeCombinationId != null
      ? fem.combinationResults?.get(fem.activeCombinationId) ?? null
      : fem.multiLcResult?.get(fem.activeLoadCaseId) ?? null;
  // Actuele canvas-zoom in % (gemeld door FemCanvas) — getoond in de StatusBar.
  const [zoomPct, setZoomPct] = useState(100);

  // HTML-rapport export — altijd werkend (browser + Tauri). Kiest het actieve
  // resultaat: combinatie indien geselecteerd, anders single-LC solverResult.
  const handleExportHtmlReport = useCallback(async () => {
    const { openReportWindow } = await import("./io/reportExport");
    let result = solverResult;
    let scopeName: string | undefined;
    if (fem.activeCombinationId != null && fem.combinationResults) {
      const r = fem.combinationResults.get(fem.activeCombinationId);
      if (r) {
        result = r;
        scopeName = fem.combinations.find(c => c.id === fem.activeCombinationId)?.name;
      }
    } else if (result) {
      scopeName = fem.loadCases.find(lc => lc.id === fem.activeLoadCaseId)?.name;
    }
    openReportWindow({
      projectName: projectPath ? projectPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") : undefined,
      nodes: fem.nodes,
      beams: fem.beams,
      supports: fem.supports,
      loads: fem.loads,
      loadCases: fem.loadCases,
      result,
      scopeName,
    });
  }, [fem, solverResult, projectPath]);
  // IFC4-export van het rekenmodel (Structural Analysis Domain). ÉÉN bron:
  // dit object voedt zowel het IFC-tabblad als de exportknoppen, zodat wat er
  // op het scherm staat letterlijk het bestand is dat wordt weggeschreven.
  // Projectnaam en -gegevens komen uit de projectinstellingen; zonder
  // ingevulde naam valt hij terug op de bestandsnaam van het project.
  const ifcModel: IfcRekenmodelInput = useMemo(() => ({
    projectNaam: (projectPath
      ? projectPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "")
      : undefined) || "Naamloos project",
    project: {
      naam: projectInfo.name,
      projectnummer: projectInfo.projectNumber,
      ingenieur: projectInfo.engineer,
      bedrijf: projectInfo.company,
      locatie: projectInfo.location,
      omschrijving: projectInfo.description,
    },
    // Een project heeft precies één actief modeltype. Na de eenmalige
    // omzetting mag de IFC-route de oude 2D-compatibiliteitsvelden niet als
    // tweede constructie exporteren.
    nodes: modelDimension === "2d" ? fem.nodes : [],
    beams: modelDimension === "2d" ? fem.beams : [],
    supports: modelDimension === "2d" ? fem.supports : [],
    loads: modelDimension === "2d" ? fem.loads : [],
    loadCases: fem.loadCases,
    model3d: modelDimension === "3d" ? openFem3dCalculationModel : undefined,
    plates: modelDimension === "2d" ? fem.plates : [],
    eigenGewicht: fem.selfWeightEnabled,
    aantalCombinaties: fem.combinations.length,
    combinations: fem.combinations,
    structuralGrid: fem.structuralGrid,
    analysetype: fem.analysetype,
    scheefstand: {
      enabled: fem.scheefstandEnabled,
      // De GEREKENDE noemer, niet de ingetikte: `scheefstandUitkomst` is de
      // enige plek waar φ voor deze berekening wordt bepaald (zie boven), en
      // bij een normbron wijkt hij af van wat er in het venster staat. Hier
      // stond `fem.scheefstandNoemer`, waardoor het IFC "noemer 200, bron
      // en1992" meldde terwijl er met 1/387,3 gerekend was — basisaudit ruw 26.
      noemer: scheefstandUitkomst.noemer,
      noemerInvoer: fem.scheefstandNoemer,
      richting: fem.scheefstandRichting,
      bron: fem.scheefstandBron,
    },
  }), [
    projectPath, projectInfo, modelDimension,
    fem.nodes, fem.beams, fem.supports, fem.loads, fem.loadCases, openFem3dCalculationModel,
    fem.plates, fem.selfWeightEnabled, fem.combinations,
    // De rekeninstellingen stonden hier niet, terwijl ze wel in de set
    // OpenFEM_Analyse belanden: een gewijzigde scheefstand of een ander
    // analysetype kwam pas in het IFC zodra er toevallig iets aan het model
    // veranderde. Met de GEREKENDE noemer erbij (basisaudit ruw 26) is dat
    // geen schoonheidsfout meer: φ verandert ook zonder dat de gebruiker de
    // noemer aanraakt, namelijk zodra de hoogte of het aantal kolommen wijzigt.
    fem.structuralGrid, fem.analysetype, fem.scheefstandEnabled,
    fem.scheefstandNoemer, fem.scheefstandRichting, fem.scheefstandBron,
    scheefstandUitkomst,
  ]);

  /**
   * Schrijft het IFC-bestand weg en valideert het meteen. `zonderLasten`
   * levert de knop "Export structureel": alleen het draagsysteem, zonder
   * belastinggevallen — het bestand dat je aan een BIM-model overhandigt.
   */
  const handleExportIfc = useCallback(async (zonderLasten = false) => {
    const { downloadIfc, valideerIfc, verzamelIfcBeperkingen } = await import("./io/ifcExport");
    const { notifySuccess, notifyWarning } = await import("./io/notify");
    const basis = ifcModel.project?.naam?.trim() || ifcModel.projectNaam || "rekenmodel";
    const inhoud = downloadIfc(
      ifcModel,
      `${basis}${zonderLasten ? " - structureel" : ""}.ifc`,
      { zonderLasten },
    );
    const uitslag = valideerIfc(inhoud);
    const beperkingen = verzamelIfcBeperkingen(ifcModel, { zonderLasten });
    if (uitslag.fouten.length > 0) {
      notifyWarning(i18next.t("common:app.ifc.exportErrors"), uitslag.fouten.slice(0, 3).join("\n"));
    } else if (beperkingen.length > 0) {
      notifySuccess(
        i18next.t("common:app.ifc.exportedWithNotes"),
        i18next.t("common:app.ifc.exportedWithNotesBody", { entiteiten: uitslag.entiteiten, punten: beperkingen.length }),
      );
    } else {
      notifySuccess(i18next.t("common:app.ifc.exported"), i18next.t("common:app.ifc.validBody", { entiteiten: uitslag.entiteiten }));
    }
  }, [ifcModel]);

  /**
   * Resultaten als .ifcfemresults (issue #87): het IFC-rekenmodel plus de
   * resultaten van de laatste rekengang en het projectbestand zelf, zodat
   * Openen het model met resultaten toont zonder te rekenen.
   */
  const handleExportIfcResultaten = useCallback(async () => {
    const { notifySuccess, notifyWarning } = await import("./io/notify");
    const is3d = modelDimension === "3d";
    const tweeD = !is3d && fem.multiLcResult ? { perCase: fem.multiLcResult, combinaties: fem.combinationResults ?? new Map() } : undefined;
    const drieD = is3d && (openFem3dCaseResults.size > 0 || openFem3dCombinationResults.size > 0)
      ? { perCase: openFem3dCaseResults, combinaties: openFem3dCombinationResults } : undefined;
    if (!tweeD && !drieD) {
      notifyWarning(i18next.t("common:app.ifcResults.noResults"), i18next.t("common:app.ifcResults.noResultsBody"));
      return;
    }
    try {
      const { bouwIfcResultaten } = await import("./io/ifcResultaten");
      const { bewaarIfcResultaten } = await import("./io/ifcResultatenApp");
      const naam = ifcModel.project?.naam?.trim() || ifcModel.projectNaam || "rekenmodel";
      const inhoud = bouwIfcResultaten(ifcModel, { tweeD, drieD, projectTekst: serializeProject(buildProjectSnapshot()) },
        { bestandsnaam: `${naam}.ifcfemresults`, tijdstempel: new Date().toISOString().slice(0, 19) });
      const pad = await bewaarIfcResultaten(inhoud, naam);
      if (pad !== null) notifySuccess(i18next.t("common:app.ifcResults.exported"), pad || `${naam}.ifcfemresults`);
    } catch (e) {
      notifyWarning(i18next.t("common:app.ifcResults.exportFailed"), e instanceof Error ? e.message : String(e));
    }
  }, [modelDimension, fem.multiLcResult, fem.combinationResults, openFem3dCaseResults, openFem3dCombinationResults, ifcModel, buildProjectSnapshot]);

  /** "Valideren" in het lint: controleert de export en meldt de uitslag. */
  const handleValidateIfc = useCallback(async () => {
    const { bouwIfcRekenmodel, valideerIfc, verzamelIfcBeperkingen } = await import("./io/ifcExport");
    const { notifySuccess, notifyWarning } = await import("./io/notify");
    const uitslag = valideerIfc(bouwIfcRekenmodel(ifcModel));
    const beperkingen = verzamelIfcBeperkingen(ifcModel);
    setActiveView("ifc");
    if (uitslag.fouten.length > 0) {
      notifyWarning(
        i18next.t("common:app.ifc.validationErrors", { aantal: uitslag.fouten.length }),
        uitslag.fouten.slice(0, 3).join("\n"),
      );
    } else {
      notifySuccess(
        i18next.t("common:app.ifc.validationPassed"),
        i18next.t("common:app.ifc.validBody", { entiteiten: uitslag.entiteiten }) +
        (beperkingen.length > 0
          ? " " + i18next.t("common:app.ifc.notExpressed", { punten: beperkingen.length })
          : ""),
      );
    }
  }, [ifcModel]);

  // Model of belastingen gewijzigd → de oude uitkomst telt niet meer. Zodra
  // er live gerekend wordt volgt meteen een verse berekening in plaats van
  // een leeg canvas: de gebruiker wil het effect van zijn wijziging zien,
  // niet zijn resultaten kwijtraken.
  //
  // De vertraging vangt een reeks wijzigingen op (een knoop verslepen levert
  // tientallen updates per seconde); elke nieuwe wijziging annuleert de
  // vorige geplande berekening, zodat er pas gerekend wordt als de gebruiker
  // even stilzit.
  useEffect(() => {
    // Also flip the envelope-view off; otherwise the user lingers on stale
    // envelope colors after editing the model.
    fem.setEnvelopeView(false);
    fem.setActiveCombinationId(null);
    // Elke modelwijziging hoogt de generatie op: een export naar PDF die vóór
    // deze wijziging "klaar" was, ziet zo na het printen dat hij een ander
    // model kan hebben gevangen (bediening/rapportExport).
    rekenGeneratieRef.current += 1;
    lopendeRekengangenRef.current = 0;
    rapportRekenPogingRef.current = false;
    volledigeRekengangRef.current = null;
    rekenFoutRef.current = null;
    setSolverErrorText(null);
    setStabiliteitsMelding(null);
    if (!liveRekenenRef.current) {
      // Nog niet gerekend: status terug naar Gereed en verder niets doen.
      setSolverStatus({ kind: "ready" });
      return;
    }
    setSolverStatus({ kind: "rekenen" });
    // Leesbaar voor het bedieningskanaal: zolang deze timer staat, is wat er in
    // het rapport staat gewist en nog niet opnieuw berekend.
    herberekeningGeplandRef.current = true;
    const id = window.setTimeout(() => {
      herberekenTimerRef.current = null;
      herberekeningGeplandRef.current = false;
      void rekenDoorRef.current();
    }, HERBEREKEN_VERTRAGING_MS);
    herberekenTimerRef.current = id;
    return () => {
      window.clearTimeout(id);
      herberekenTimerRef.current = null;
      herberekeningGeplandRef.current = false;
    };
    // `fem.plates` doet mee sinds platen meerekenen (P2): een dikte- of
    // meshSize-wijziging maakt ook de single-LC-resultaten ongeldig.
    // `fem.rekenInstellingenVersie` is alles BUITEN het model dat de uitkomst
    // bepaalt: combinatiefactoren, belastinggevaltype, eigen gewicht,
    // analysetype, segmentlengte, scheefstand en gevolgklasse. Zonder die
    // regel bleven UC-badges en "Berekend om" staan na zo'n wijziging — zie
    // lib/rekenInstellingen.ts. Dezelfde waarde stuurt het store-effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fem.nodes, fem.beams, fem.supports, fem.loads, fem.plates, fem.rekenInstellingenVersie]);

  // (De weergavevinkjes `displayFlags` staan hoger, vóór `reportData`.)
  // Results-tab active flag — toggled door de Resultaten-tab onderaan.
  // Wanneer true: alle krachten-overlays aan (M+V+N+vervorming+reacties).
  // Wordt uit-gezet zodra de gebruiker op Model of een LC-tab klikt.
  const [resultsTabActive, setResultsTabActive] = useState(false);
  // Tab in the project-tree (verkenner) — controlled door App zodat Berekenen
  // automatisch naar "results" springt.
  const [treeTab, setTreeTab] = useState<"project" | "view" | "results">("project");
  useEffect(() => {
    if (modelDimension === "3d") setTreeTab("project");
  }, [modelDimension]);
  /**
   * Na het importeren van een model (een IFC-analysemodel, of 2D omgezet naar
   * 3D) knopen op staven aansluiten (issue #63), als een eigen stap ongedaan
   * maken: Ctrl+Z geeft het model terug zoals het binnenkwam. Alleen met de
   * schakelaar aan (`openFem3DConnectAfterImport`). Openen van een eigen
   * project doet dit NIET: daar meldt de modelcontrole op het tekenvlak de
   * losse knopen, met een knop.
   */
  const sluitAanNaImport = useCallback(() => {
    const current = openFem3dHistoryRef.current.model;
    const stap = openFem3DConnectAfterImport(current, leesSnapInstellingen());
    if (!stap.result) return;
    const blocked = changedLockedOpenFem3DLayer(current, stap.model);
    if (blocked) { meldVergrendeldeLaag(blocked.name); return; }
    dispatchOpenFem3D({ type: "edit", model: stap.model });
    meldOpenFem3DAansluiten({ ...stap, result: stap.result });
  }, [dispatchOpenFem3D]);
  const handleConvertTo3D = useCallback(() => {
    if (modelDimension === "3d") return;
    const converted = convert2DTo3D({
      nodes: fem.nodes,
      beams: fem.beams,
      supports: fem.supports,
      loads: fem.loads,
    });
    dispatchOpenFem3D({ type: "replace", model: converted.model });
    sluitAanNaImport();
    setOpenFem3dCameraSnapshot(null);
    // Een ander model: de section box (issue #86) uit, zonder de grenzen van het vorige.
    setOpenFem3dVisibility(openFem3DVisibilityZonderSectionBox);
    setOpenFem3dSelection(null);
    setModelDimension("3d");
    setActiveView("openFem3d");
    setTreeTab("view");
  }, [modelDimension, fem.nodes, fem.beams, fem.supports, fem.loads, sluitAanNaImport]);
  // De wizard "Stalen hal" en de bedieningsopdracht `staalhal_maken`: de hal
  // vervangt het 3D-model als ÉÉN undo-stap (Ctrl+Z zet het oude model terug).
  // De gevallen van de hal worden aan die van het project gekoppeld: bestaande
  // gevallen blijven staan en worden op naam en type hergebruikt, zodat een
  // ongedaan gemaakt model nog naar zijn eigen gevallen verwijst.
  const [staalhalOpen, setStaalhalOpen] = useState(false);
  const pasStaalhalToe = useCallback((hal: StaalhalResultaat) => {
    requireStaalhalWindRoute(projectInfo);
    // De gelaste tussendoorsneden van een verlopende spantligger (#73): de
    // staven verwijzen er met EIGEN:<naam> naar, dus eerst in de bibliotheek.
    if (hal.eigenDoorsneden.length > 0) importeerEigenDoorsneden(hal.eigenDoorsneden);
    const store = femRef.current;
    const ids = store.zorgVoorBelastinggevallen(hal.loadCases);
    const caseIds: Record<number, number> = Object.fromEntries(hal.loadCases.map((c, i) => [c.id, ids[i]]));
    const model = metBelastinggevalIds(hal.model, (id) => caseIds[id] ?? id);
    if (store.selfWeightEnabled !== hal.selfWeightEnabled) store.setSelfWeightEnabled(hal.selfWeightEnabled);
    store.setStructuralGrid(hal.stramien);
    const actief = caseIds[STAALHAL_GEVAL.permanent];
    if (actief !== undefined) store.setActiveLoadCaseId(actief);
    dispatchOpenFem3D({ type: "edit", model, ignoreLayerLocks: true });
    setOpenFem3dCameraSnapshot(null);
    // Een ander model: de section box (issue #86) uit, zonder de grenzen van het vorige.
    setOpenFem3dVisibility(openFem3DVisibilityZonderSectionBox);
    setOpenFem3dSelection(null);
    setModelDimension("3d");
    setActiveView("openFem3d");
    setTreeTab("view");
    setOpenFem3dFitToken((token) => token + 1);
    return { caseIds };
  }, [projectInfo]);
  const handleStaalhalMaken = useCallback(async (hal: StaalhalResultaat) => {
    if (!(await confirmUnsavedAction())) return;
    pasStaalhalToe(hal);
    setStaalhalOpen(false);
  }, [confirmUnsavedAction, pasStaalhalToe]);

  // "Rekenmodel importeren" (IFC-tab en Bestand → Openen) en de
  // bedieningsopdracht `ifc_analysemodel_importeren`: een geïmporteerd
  // IFC4-analysemodel wordt een NIEUW 3D-project, langs dezelfde weg als een
  // geopend projectbestand (`pasProjectToe`). Anders dan bij Openen heeft het
  // project nog geen pad en is het gewijzigd: Opslaan vraagt om een bestand en
  // afsluiten vraagt of het bewaard moet worden.
  const pasIfcImportToe = useCallback((imp: IfcAnalyseImport) => {
    const project = ifcAnalyseProject(imp, projectInfo as unknown as Record<string, unknown>);
    pasProjectToe(deserializeProject(serializeProject(project)));
    sluitAanNaImport();
    setProjectPath("");
    baselineResetRef.current = false;
    lastSavedRef.current = "";
    setOpenFem3dFitToken((token) => token + 1);
  }, [pasProjectToe, projectInfo, sluitAanNaImport]);
  const meldIfcFout = useCallback((titel: string, tekst: string) => {
    void import("./io/notify").then(({ notifyWarning }) => notifyWarning(titel, tekst));
  }, []);
  const ifcImportStroom = useIfcImportStroom({
    bevestig: confirmUnsavedAction,
    pasToe: pasIfcImportToe,
    meldFout: meldIfcFout,
  });
  const handleImportIfcAnalyse = ifcImportStroom.start;
  // Grid settings (mutated by Grids dialog)
  const [grid, setGrid] = useState<GridSettings>(DEFAULT_GRID);
  const [gridsOpen, setGridsOpen] = useState(false);
  const [loadCasesOpen, setLoadCasesOpen] = useState(false);
  // Windbelastinggenerator — de hook draait de generator mee met wijzigingen
  // in de constructie (idempotent, zie windStore.ts).
  const [windGeneratorOpen, setWindGeneratorOpen] = useState(false);
  const [envelopeLoadsOpen, setEnvelopeLoadsOpen] = useState(false);
  const [waterAccumulationOpen, setWaterAccumulationOpen] = useState(false);
  const selectedWaterBeam = useMemo(() => {
    const selection = fem.selection;
    if (selection?.type !== "beam") return null;
    const beam = fem.beams.find((item) => item.id === selection.id);
    if (!beam) return null;
    const start = fem.nodes.find((node) => node.id === beam.from);
    const end = fem.nodes.find((node) => node.id === beam.to);
    if (!start || !end) return null;
    // De eerste module rekent een horizontale dakstrook. Een schuine of
    // verticale modelstaaf vraagt expliciete dakgeometrie en wordt niet
    // stilzwijgend als horizontaal dak overgenomen.
    if (Math.abs(end.z - start.z) > 1 || Math.abs(end.x - start.x) < 1) return null;
    const section = resolveSection(beam.material, beam.profile);
    if (section.bron === "default") return null;
    return { id: beam.id, spanM: Math.hypot(end.x - start.x, end.z - start.z) / 1000,
      eiKnm2: section.E * section.I / 1e9 };
  }, [fem.selection, fem.beams, fem.nodes]);
  // Normtoetsing draait ALTIJD mee met een berekening: de toetsing hoort bij
  // het resultaat en is geen losse handeling. Er is bewust geen schakelaar —
  // een model waarvan je de krachten ziet maar de unity checks niet, nodigt
  // uit tot verkeerde conclusies.
  //
  // Live rekenen gaat aan zodra er één keer met succes is gerekend. Daarna
  // levert elke modelwijziging een verse berekening in plaats van lege
  // resultaten. Vóór die eerste keer blijft het stil: een half getekend
  // model is meestal nog een mechanisme, en dan zou elke muisklik een
  // foutmelding opleveren.
  const liveRekenenRef = useRef(false);
  // ── De rekentoestand, leesbaar voor het bedieningskanaal ──
  // In refs en niet in state: ze veranderen midden in een rekengang, en een
  // export naar PDF moet ze lezen zonder op een render te wachten.
  //  - herberekeningGepland: de live-herberekening na een modelwijziging staat
  //    op zijn timer (dan is het rapport gewist en nog niet opnieuw gevuld);
  //  - lopendeRekengangen: `rekenDoor` loopt nog, tot en met de toetsing;
  //  - rekenGeneratie: hoogt op bij elke modelwijziging en elke rekengang;
  //  - volledigeRekengang: de combinatieresultaten van de laatste VOLTOOIDE
  //    `rekenDoor`. Bij tweedeOrdeFysisch zegt alleen dit dat de resultaten in
  //    de app de fysisch niet-lineaire ronde hebben gehad — de toets-knop
  //    rekent zo nodig ook door, maar zonder die ronde.
  const herberekeningGeplandRef = useRef(false);
  const herberekenTimerRef = useRef<number | null>(null);
  // Alleen de actuele generatie blokkeert export; oude kernpromises mogen uitlopen.
  const lopendeRekengangenRef = useRef(0);
  // Eén automatische rapportpoging per model; handmatig herhalen blijft mogelijk.
  const rapportRekenPogingRef = useRef(false);
  const rekenGeneratieRef = useRef(0);
  const volledigeRekengangRef = useRef<Map<number, SolverResult> | null>(null);
  useEffect(() => () => { rekenGeneratieRef.current += 1; }, []);
  // Insights view mode (element-K / system-K / dof / logs / errors), controlled from Ribbon.
  const [insightsMode, setInsightsMode] = useState<"element" | "system" | "dof" | "logs" | "errors">("element");
  // De laatste rekenfout — getoond in Inzichten → Fouten. Had geen setter:
  // dat tabblad meldde daardoor altijd "Geen actieve solver-fouten", ook bij
  // een kolom die in tweede orde knikte.
  const [solverErrorText, setSolverErrorText] = useState<string | null>(null);
  /**
   * De blokkerende stabiliteitsmelding van de laatste rekengang: de toets is
   * geweigerd, want haar tweede-ordeberekening (P-Δ met scheefstand) faalt
   * (issue #199, B7). Rood in Inzichten en in het rapport; de melding op het
   * scherm geeft `weigerToets`. null = niets aan de hand.
   *
   * Tot 2026.42 stond hier "eerste orde niet toegestaan" (α_cr < 10 bij eerste
   * orde, basisaudit nr 27). Die is informatief geworden (B14): de toets rekent
   * nooit eerste orde, dus de grens van 5.2.1(3) beslist niet meer of de unity
   * checks bruikbaar zijn. Zij staat nog in de analysetoelichting.
   */
  const [stabiliteitsMelding, setStabiliteitsMelding] = useState<string | null>(null);
  /** De solverinvoer van de laatste rekengang, voor α_cr na de fysisch niet-lineaire ronde. */
  const laatsteMultiInputRef = useRef<MultiInput | null>(null);
  /**
   * Wat de veldsgewijze plaatsing te melden heeft (issue #219): alleen als er
   * meer veldpatronen waren dan er zijn doorgerekend. Eén keer per tekst, net
   * als de rekenfout, zodat live herberekenen niet bij elke wijziging meldt.
   */
  const gemeldeVeldpatronenRef = useRef<string | null>(null);
  const meldVeldpatronen = useCallback((uitkomst: VeldpatroonOutputs | null, generatie: number) => {
    const tekst = uitkomst && uitkomst.meldingen.length > 0 ? uitkomst.meldingen.join("\n\n") : null;
    if (tekst === null || gemeldeVeldpatronenRef.current === tekst) {
      if (tekst === null) gemeldeVeldpatronenRef.current = null;
      return;
    }
    gemeldeVeldpatronenRef.current = tekst;
    void import("./io/notify").then(({ notifyWarning }) => {
      if (generatie === rekenGeneratieRef.current)
        notifyWarning(i18next.t("common:app.solve.fieldPatternsLimited"), tekst);
    }).catch(() => {});
  }, []);
  /**
   * α_cr per UGT-combinatie van de RESULTATEN bepalen. Aangeroepen na elke
   * rekengang. Geen melding meer (issue #199, B14): wat α_cr over de
   * resultaten zegt, is informatief en staat in de analysetoelichting; de
   * toets rekent altijd zelf tweede orde met scheefstand.
   */
  const bepaalStabiliteit = useCallback((
    multiInput: MultiInput,
    combinationResults: Map<number, SolverResult>,
  ): AlphaCrUitkomst[] => bepaalAlphaCr(multiInput, fem.actieveCombinaties, combinationResults),
  [fem.actieveCombinaties]);
  const [loadCasesTab, setLoadCasesTab] = useState<"cases" | "combos">("cases");
  /**
   * Draai de multi-LC pipeline (alle belastinggevallen + combinaties +
   * envelope) en schrijf de uitkomst in de fem-store. Retourneert de verse
   * outputs zodat aanroepers (normtoetsing) niet op een React re-render
   * hoeven te wachten. Fouten zijn non-fataal → null.
   */
  const computeAndStoreSolverOutputs = useCallback((opties?: {
    /**
     * α_cr van de resultaten NIET nu bepalen. `rekenDoor` toetst direct
     * hierna, en de toets bepaalt α_cr zelf (bij hergebruik op precies deze
     * invoer en krachten). Twee keer dezelfde bisectie kostte bij een portaal
     * van 170 staven seconden op de UI-thread. Lukt de toets niet tot α_cr,
     * dan vult `rekenDoor` die van de resultaten alsnog aan.
     */
    stabiliteitLater?: boolean;
  }) => {
    const generatie = rekenGeneratieRef.current;
    try {
      if (fem.analysetype === "axiaalFysischRust") {
        throw new Error("Kies Open FEM Rust in Instellingen → Berekening voor axiale FNL.");
      }
      if (fem.loads.some(load => load.type === "thermal" && load.deltaTGradient)) {
        throw new Error("Kies Open FEM Rust in Instellingen → Berekening voor temperatuurgradiënten.");
      }
      // DE MODELCONTROLE OOK OP DIT PAD. Alleen het canvas deed hem; een staaf
      // van lengte nul of een kolomvoet die op een ligger ligt gaf daar "Model
      // niet doorgerekend", terwijl dit pad doorrekende en de toetsing op die
      // krachten draaide, met "Berekend om" in de statusbalk. Met de
      // verbindingstolerantie van de tab Weergave (issue #55), dezelfde als
      // die van het canvas.
      controleerVoorRekenen({
        nodes: fem.nodes, beams: fem.beams, supports: fem.supports, plates: fem.plates,
        // De belastinggevallen erbij: zonder die lijst kan `zoekStilleLasten`
        // niet zien dat een last naar een geval verwijst dat niet bestaat.
        loads: fem.loads, loadCases: fem.loadCases,
      }, leesSnapInstellingen().verbindingsTolerantie);
      // Modelmapping (doorsneden, eenheden, eigen gewicht, scheefstand) staat
      // in een pure module, zodat de app en elke tweede consument van de
      // solver exact dezelfde vertaling gebruiken — zie modelNaarSolverInput.ts.
      const multiInput = bouwMultiInput({
        nodes: fem.nodes,
        beams: fem.beams,
        supports: fem.supports,
        plates: fem.plates,
        loadCases: fem.loadCases,
        loads: fem.loads,
        selfWeightEnabled: fem.selfWeightEnabled,
        scheefstandEnabled: fem.scheefstandEnabled,
        // De NORMNOEMER, niet de ingetikte: bij `scheefstandBron = "vast"` is
        // dat exact `fem.scheefstandNoemer` (dus ongewijzigd gedrag), en bij
        // een normkeuze de 1/φ uit (5.5)/(5.1). Zo rekent het multi-LC-pad met
        // hetzelfde getal als het canvas-pad hierboven.
        scheefstandNoemer: scheefstandUitkomst.noemer,
        scheefstandRichting: fem.scheefstandRichting,
      });
      // Vanaf hier meldt de solver wat hij doet: assembly, randvoorwaarden en
      // elke Newton-Raphson-iteratie met zijn twee normen. `maakSolverLogOpvanger`
      // leegt het log eerst, zodat het paneel één berekening toont en niet twee
      // achter elkaar. De opvanger blijft daarna staan — dat kost niets zolang
      // er niet gerekend wordt, en het tweede-orde-pad rekent verderop nog door
      // vanuit `combineResults`, dat zijn eigen aanroepketen heeft.
      zetSolverLogOpvanger(maakSolverLogOpvanger());
      // Beide tweede-orde-standen lopen via hetzelfde per-combinatie-pad. De
      // fysisch niet-lineaire stand doet daar ná deze (synchrone) rekengang
      // nog een ronde overheen — zie `rekenFysischNietlineair`.
      // Veranderlijke vloerbelasting veldsgewijs (issue #219, NEN-EN 1991-1-1
      // 6.2.1(1)): alleen bij eerste orde, waar superpositie geldt. De
      // deelgevallen per veld rekenen mee; de varianten komen achter hun
      // basiscombinatie. Zonder zo'n geval is `veld.combinaties` dezelfde
      // lijst en `veld.input` dezelfde invoer.
      // Trek-alleen staven (#234) maken de berekening niet-lineair: geen superpositie van veldpatronen.
      const lineair = fem.analysetype === "eersteOrde" && !fem.beams.some((b) => b.tensionOnly);
      const veldSplitsing = lineair ? splitsVeldgevallen(multiInput, fem.loadCases) : null;
      const rekenInput = veldSplitsing?.input ?? multiInput;
      const { perCase } = !lineair
        ? solveAllCasesNonlinear(multiInput)
        : solveAllCases(rekenInput);
      const veld = veldpatronenUitkomst(veldSplitsing, fem.loadCases, fem.actieveCombinaties, perCase);
      const rekenCombinaties = veld.combinaties;
      // De eindtoestand met E_mean,fin (NEN-EN 1995-1-1 2.3.2.2(2)) voor elke
      // eindtoestandvariant in de combinaties. Zonder varianten — het gewone
      // geval, waarin 2.2.3(5) geldt — lost dit niets op en verandert er niets.
      losEindtoestandOp(rekenInput, perCase, rekenCombinaties, fem.eindstijfheid);
      // `actieveCombinaties`, niet `combinations`: een combinatie die dit model
      // niet nodig heeft (zuiver staal zonder vloer-/dakeis → 6.15/6.16, zie
      // lib/combinatieSelectie)
      // wordt niet doorgerekend. Alles wat resultaten toont filtert op de
      // sleutels van deze Map, dus die volgen vanzelf.
      const combinationResults = new Map(
        rekenCombinaties.map(c => [c.id, combineResults(c, perCase)])
      );
      const envelope = computeEnvelope(rekenCombinaties, perCase);
      // De kritieke lastfactor per combinatie (basisaudit nr 27), met de
      // normaalkrachten van de combinatie. Informatief (issue #199, B14): de
      // toets rekent altijd zelf tweede orde. Met `stabiliteitLater` niet hier
      // (zie daar): de toets die volgt bepaalt hem.
      laatsteMultiInputRef.current = multiInput;
      const stabiliteit = opties?.stabiliteitLater ? undefined : bepaalStabiliteit(multiInput, combinationResults);
      // De invoer gaat mee naar de toetsing: daarop rekent zij haar eigen
      // tweede orde met scheefstand (issue #199).
      const outputs = { perCase, combinationResults, envelope, stabiliteit, multiInput, veldpatronen: veld.uitkomst };
      fem.setSolverOutputs(outputs);
      meldVeldpatronen(veld.uitkomst, generatie);
      rekenFoutRef.current = null;
      gemeldeRekenfoutRef.current = null;
      setSolverErrorText(null);
      return outputs;
    } catch (e) {
      // NIET STIL. Hier ging elke fout alleen naar de console — ook "2e-orde-
      // berekening niet convergent … belasting op of boven de kritieke
      // (knik)waarde". Het canvas (altijd eerste orde) toonde intussen eindige
      // krachten met een succesbanner. Nu: de reden in Inzichten → Fouten,
      // een melding op het scherm, en een foutstatus die de canvasberekening
      // niet meer terugzet (zie `handleSolveResult`).
      console.warn("[FEM multi-LC]", e);
      const tekst = leesbareRekenfout(e);
      rekenFoutRef.current = tekst;
      setSolverErrorText(tekst);
      fem.setSolverOutputs(null);
      setStabiliteitsMelding(null);
      // Live herberekenen na elke modelwijziging zou dezelfde fout telkens
      // opnieuw melden; een andere fout wél.
      if (gemeldeRekenfoutRef.current !== tekst) {
        gemeldeRekenfoutRef.current = tekst;
        void import("./io/notify").then(({ notifyWarning }) => {
          if (generatie === rekenGeneratieRef.current)
            notifyWarning(i18next.t("common:app.solve.failed"), tekst);
        }).catch(() => {});
      }
      return null;
    }
  }, [fem, scheefstandUitkomst.noemer, bepaalStabiliteit, meldVeldpatronen]);

  const computeAndStoreNativePlateOutputs = useCallback(async (generatie: number) => {
    controleerVoorRekenen({
      nodes: fem.nodes, beams: fem.beams, supports: fem.supports, plates: fem.plates,
      loads: fem.loads, loadCases: fem.loadCases,
    });
    const multiInput = bouwMultiInput({
      nodes: fem.nodes, beams: fem.beams, supports: fem.supports, plates: fem.plates,
      loadCases: fem.loadCases, loads: fem.loads,
      selfWeightEnabled: fem.selfWeightEnabled,
      scheefstandEnabled: fem.scheefstandEnabled,
      scheefstandNoemer: scheefstandUitkomst.noemer,
      scheefstandRichting: fem.scheefstandRichting,
      axialMaterialLoadPath: fem.axialMaterialLoadPath,
    });
    // The concrete §5.8.6 iteration below updates each member's secant EI
    // from the Rust M-N-κ service. Its seed solve is geometric P-Δ; applying
    // the separate axial material law here would describe another analysis.
    const analysis = fem.analysetype === "eersteOrde" ? "linear"
      : fem.analysetype === "axiaalFysischRust" ? "combined" : "geometric";
    const nativeFrame = fem.beams.length > 0;
    if (!nativeFrame && fem.analysetype === "axiaalFysischRust")
      throw new Error("Axiale Rust-FNL vereist een zuiver 2D-raamwerk zonder platen.");
    if (nativeFrame && fem.plates.length === 0 && fem.analysetype === "axiaalFysischRust"
        && !fem.beams.some(beam => beam.axialMaterialLaw))
      throw new Error("Kies bij ten minste één staaf een axiale staal- of betonwet voor Rust-FNL.");
    // Issue #219: veldsgewijze plaatsing alleen bij een lineaire berekening.
    const veldSplitsing = analysis === "linear" && !fem.beams.some((b) => b.tensionOnly) ? splitsVeldgevallen(multiInput, fem.loadCases) : null;
    const rekenInput = veldSplitsing?.input ?? multiInput;
    const perCase = nativeFrame
      ? await solveAllCasesNativeFrame2D(rekenInput, analysis)
      : await solveAllCasesNativeMembrane2D(rekenInput, analysis);
    if (generatie !== rekenGeneratieRef.current) return null;
    const veld = veldpatronenUitkomst(veldSplitsing, fem.loadCases, fem.actieveCombinaties, perCase);
    const rekenCombinaties = veld.combinaties;
    if (rekenCombinaties.some(combination => combination.eindtoestand !== undefined)) {
      if (analysis !== "linear") {
        throw new Error("Eindstijfheidvarianten horen bij een eerste-orde-berekening en zijn niet beschikbaar bij Rust GNL/FNL.");
      }
      await losEindtoestandNativeOp(rekenInput, perCase, rekenCombinaties, fem.eindstijfheid,
        adjustedInput => nativeFrame
          ? solveAllCasesNativeFrame2D(adjustedInput, "linear")
          : solveAllCasesNativeMembrane2D(adjustedInput, "linear"));
      if (generatie !== rekenGeneratieRef.current) return null;
    }
    // Trek-alleen staven (issue #234): ook eerste orde geldt de superpositie
    // niet meer; elke combinatie wordt dan als geheel door Rust opgelost (met
    // de statuslus van nativeFrame2DRoute), net als bij tweede orde.
    const perCombinatie = analysis === "linear" && nativeFrame && heeftTrekAlleen(rekenInput);
    const combinationResults = perCombinatie
      ? await solveAllCombinationsNativeFrame2D(rekenInput, rekenCombinaties, "linear")
      : analysis === "linear"
      ? new Map(await Promise.all(rekenCombinaties.map(async combination => [
        combination.id,
        await voegNativeDrieLagencontroleToe(multiInput, combineResults(combination, perCase)),
      ] as const)))
      : nativeFrame
        ? await solveAllCombinationsNativeFrame2D(multiInput, fem.actieveCombinaties,
          analysis === "combined" ? "combined" : "geometric")
        : await solveAllCombinationsNativeMembrane2D(multiInput, fem.actieveCombinaties, analysis);
    if (generatie !== rekenGeneratieRef.current) return null;
    const envelope = computeEnvelope(rekenCombinaties, perCase,
      analysis === "linear" && !perCombinatie ? undefined : combinationResults);
    laatsteMultiInputRef.current = multiInput;
    const stabiliteit = bepaalStabiliteit(multiInput, combinationResults);
    // De invoer gaat mee naar de toetsing (issue #199): die rekent op dezelfde
    // invoer haar eigen tweede orde met scheefstand.
    const outputs = { perCase, combinationResults, envelope, stabiliteit, veldpatronen: veld.uitkomst, multiInput };
    fem.setSolverOutputs(outputs);
    meldVeldpatronen(veld.uitkomst, generatie);
    rekenFoutRef.current = null;
    gemeldeRekenfoutRef.current = null;
    setSolverErrorText(null);
    return outputs;
  }, [fem, scheefstandUitkomst.noemer, bepaalStabiliteit, meldVeldpatronen]);

  /**
   * Eén rekengang: multi-LC doorrekenen en de
   * normtoetsing er direct achteraan. Gedeeld door de knop Berekenen en de
   * live-herberekening na een modelwijziging — de knop doet daarnaast de
   * weergave-omschakeling die bij een handmatige actie hoort, want tijdens
   * het bewerken mag de app niet onder de handen van de gebruiker van tab
   * wisselen of de selectie wissen.
   *
   * ALS BELOFTE. De fysisch niet-lineaire ronde en de toetsing zijn asynchroon
   * (de rekenkern is een apart proces). De knop wacht er niet op, maar het
   * bedieningskanaal wel: `rekenen` via de API hoort pas terug te komen als
   * ALLES klaar is, en een export naar PDF mag niet printen terwijl de
   * toetsing nog loopt. Vroeger startte deze functie beide met `void …then` en
   * gaf ze direct terug; nu lost de belofte pas in na de toetsing, en telt
   * `lopendeRekengangenRef` zolang hij loopt. Het begin (doorrekenen, status)
   * blijft synchroon: een async functie loopt tot haar eerste `await` meteen.
   */
  /**
   * α_cr van de RESULTATEN, alleen als de toets er geen heeft opgeleverd (geen
   * toetsbare staven, of een weigering vóór de α_cr-bepaling). Anders toont
   * de analysetoelichting die van de toets en zou deze bepaling dode rekentijd
   * zijn (zie `computeAndStoreSolverOutputs`).
   */
  const vulStabiliteitAan = useCallback((o: {
    perCase: Map<number, SolverResult>;
    combinationResults: Map<number, SolverResult>;
    envelope: ReturnType<typeof computeEnvelope>;
    multiInput?: MultiInput | null;
  }) => {
    const mi = o.multiInput ?? laatsteMultiInputRef.current;
    if (!mi) return;
    fem.setSolverOutputs({ ...o, stabiliteit: bepaalStabiliteit(mi, o.combinationResults) });
  }, [fem, bepaalStabiliteit]);

  const rekenDoor = useCallback((selectedEngine?: SolverEngineId): Promise<RekengangUitkomst> => {
    const generatie = ++rekenGeneratieRef.current;
    const actueel = () => generatie === rekenGeneratieRef.current;
    const verouderd = (): RekengangUitkomst => ({ gelukt: false, fysisch: "verouderd" });
    if (herberekenTimerRef.current !== null) window.clearTimeout(herberekenTimerRef.current);
    herberekenTimerRef.current = null;
    herberekeningGeplandRef.current = false;
    volledigeRekengangRef.current = null;
    lopendeRekengangenRef.current = 1;
    rapportRekenPogingRef.current = true;
    const gang = (async (): Promise<RekengangUitkomst> => {
      setSolverStatus({ kind: "rekenen" });
      const preference = selectedEngine ?? normaliseSolverPreference(
        await getSetting<unknown>(SOLVER_PREFERENCE_KEY, "automatic"),
      );
      if (!actueel()) return verouderd();
      const outputs = preference === "openaec-native-fem"
        ? await computeAndStoreNativePlateOutputs(generatie)
        : computeAndStoreSolverOutputs({ stabiliteitLater: true });
      if (!actueel()) return verouderd();
      if (!outputs) {
        setSolverStatus({ kind: "error" });
        return { gelukt: false, fysisch: "nvt" };
      }
      liveRekenenRef.current = true;
      if (fem.analysetype === "axiaalFysischRust") {
        // De axiale materiaalgeschiedenis is gevalideerd, de buigdoorsnede
        // blijft elastisch. Normtoetsen op deze gedeeltelijke FNL-uitkomst
        // zouden een vollediger materiaalmodel suggereren dan er is.
        volledigeRekengangRef.current = outputs.combinationResults;
        setSolverStatus({ kind: "solved", at: Date.now() });
        return { gelukt: true, fysisch: "gedraaid" };
      }
      // Er is NIET fysisch gerekend: een segmentspoor van een vorige
      // rekengang zou dan bij een andere krachtsverdeling horen dan die nu
      // op het scherm staat. Het invalidatie-effect kijkt alleen naar het
      // model, en het analysetype staat daar niet in.
      vulStabiliteitAan(outputs);
      volledigeRekengangRef.current = outputs.combinationResults;
      setSolverStatus({ kind: "solved", at: Date.now() });
      return { gelukt: true, fysisch: "nvt" };
    })();
    return gang
      .catch((e: unknown): RekengangUitkomst => {
        if (!actueel()) return verouderd();
        fem.setSolverOutputs(null);
        volledigeRekengangRef.current = null;
        setStabiliteitsMelding(null);
        // Een onverwachte fout (bijvoorbeeld een onbereikbare rekenkern bij het
        // bepalen van b_eff, vóór de eigen foutafhandeling van de fysische
        // ronde) werd vroeger een onafgehandelde belofte zonder melding. Nu
        // staat de reden waar elke andere rekenfout staat, en weigert een
        // export tot er weer met succes is gerekend.
        console.warn("[rekengang]", e);
        const tekst = leesbareRekenfout(e);
        rekenFoutRef.current = tekst;
        setSolverErrorText(tekst);
        setSolverStatus({ kind: "error" });
        return { gelukt: false, fysisch: "mislukt" };
      })
      .finally(() => {
        if (actueel()) lopendeRekengangenRef.current = 0;
      });
  }, [
    fem.analysetype, computeAndStoreSolverOutputs, computeAndStoreNativePlateOutputs, vulStabiliteitAan,
  ]);


  // Het invalidatie-effect leest deze functie uit een ref: zou het effect op
  // `rekenDoor` deppen, dan startte het opnieuw bij elke modelwijziging (die
  // verandert `fem` en dus de callback-identiteit) en herberekende het zich
  // in een kringetje.
  const rekenDoorRef = useRef(rekenDoor);
  useEffect(() => { rekenDoorRef.current = rekenDoor; }, [rekenDoor]);

  // Het rapport hoort cijfers te tonen, geen lege tabellen. Wie de
  // rapportweergave opent zonder verse resultaten, krijgt ze meteen: dan
  // rekent de app eerst door. Mislukt dat, dan blijft `combinationResults`
  // leeg en probeert dit effect het niet opnieuw — de melding daarover komt
  // uit de rekengang zelf.
  useEffect(() => {
    if (activeView !== "report") return;
    // Het 3D-rapport gebruikt de eigen 3D-rekenuitkomst. Zonder deze guard
    // startte het openen van een 3D-rapport op de achtergrond óók de 2D-kern,
    // waardoor de statusbalk bleef rekenen en een misleidende 2D-fout kon
    // verschijnen naast een geldig 3D-resultaat.
    if (modelDimension === "3d") return;
    if (fem.combinationResults || rapportRekenPogingRef.current) return;
    if (herberekeningGeplandRef.current || lopendeRekengangenRef.current > 0) return;
    void rekenDoorRef.current();
  }, [activeView, modelDimension, fem.combinationResults, fem.nodes, fem.beams, fem.supports,
    fem.loads, fem.plates, fem.rekenInstellingenVersie]);

  const handleSolve = useCallback(async () => {
    // 3D rekent via de Open FEM 3D-kern (lineair of P-Δ, zie hieronder); 2D
    // kiest per analysetype, met de axiale Rust-FNL als materiaal-niet-lineair.
    const analysis: SolverAnalysisKind = modelDimension === "3d"
      ? "p-delta"
      : fem.analysetype === "eersteOrde"
        ? "linear"
        : fem.analysetype === "tweedeOrdeFysisch" || fem.analysetype === "axiaalFysischRust"
          ? "material-nonlinear"
          : "p-delta";
    let selectedSolver: SolverDescriptor;
    // 3D: Open FEM 3D, of de native Rust-route (volumes, membranen, FNL;
    // zie openFem3dNativeRoute). Null in 2D.
    let openFem3dRoute: OpenFem3DRouteChoice | null = null;
    try {
      const preference = normaliseSolverPreference(
        await getSetting<unknown>(SOLVER_PREFERENCE_KEY, "automatic"),
      );
      if (fem.analysetype === "axiaalFysischRust" && modelDimension !== "3d") {
        if (preference !== "openaec-native-fem")
          throw new Error("Kies Open FEM Rust in Instellingen → Berekening voor axiale FNL.");
      }
      if (modelDimension === "3d") openFem3dRoute = chooseOpenFem3DRoute(openFem3d, preference);
      selectedSolver = openFem3dRoute?.engineId === "openaec-native-fem"
        ? SOLVER_REGISTRY.find((solver) => solver.id === "openaec-native-fem")!
        : resolveSolver(preference, {
        schemaVersion: 1,
        dimension: modelDimension,
        analysis,
        elementFamilies: modelDimension === "3d"
          ? (openFem3d.plates?.length ?? 0) > 0 ? ["frame", "plate"] : ["frame"]
          : fem.plates.length > 0 ? fem.beams.length > 0 ? ["frame", "plate"] : ["plate"] : ["frame"],
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setSolverStatus({ kind: "error" });
      setSolverErrorText(message);
      if (modelDimension === "3d") setOpenFem3dSolveError(message);
      void import("./io/notify").then(({ notifyWarning }) =>
        notifyWarning(i18next.t("common:app.solve.failed"), message)).catch(() => {});
      return;
    }
    if (modelDimension === "3d") {
      setActiveView("openFem3d");
      // Modelcontrole vóór het rekenen (issue #63): ligt er een knoop op een
      // staaf zonder verbinding, dan een waarschuwing en de modelcontrole op
      // het tekenvlak open (met de knop Aansluiten). De berekening gaat door:
      // het kan bedoeld zijn (twee kruisende windverbanden).
      const losseKnopen = findOpenFem3DNodesOnBeams(openFem3d, leesSnapInstellingen().verbindingsTolerantie, undefined, "all");
      if (losseKnopen.length > 0) {
        setOpenFem3dModelCheckToken((token) => token + 1);
        const aantal = new Set(losseKnopen.map((paar) => paar.nodeId)).size;
        void import("./io/notify").then(({ notifyWarning }) => notifyWarning(
          i18next.t("ribbon:openFem3d.modelCheck.title", { count: aantal }),
          i18next.t("ribbon:openFem3d.modelCheck.solveText"),
        )).catch(() => {});
      }
      setSolverStatus({ kind: "rekenen" });
      setOpenFem3dSolveError(null);
      const generation = ++openFem3dSolveGenerationRef.current;
      try {
        if (openFem3dCalculation.selfWeightError) throw new Error(openFem3dCalculation.selfWeightError);
        const loadedCaseIds = new Set<number>([
          ...(openFem3dCalculationModel.loads ?? []).map((load) => load.caseId ?? 1),
          ...(openFem3dCalculationModel.memberLoads ?? []).map((load) => load.caseId ?? 1),
          ...(openFem3dCalculationModel.memberPointLoads ?? []).map((load) => load.caseId ?? 1),
          ...(openFem3dCalculationModel.thermalLoads ?? []).map((load) => load.caseId ?? 1),
          ...(openFem3dCalculationModel.surfaceLoads ?? []).map((load) => load.caseId ?? 1),
          ...(openFem3dCalculationModel.loadPanels ?? []).map((panel) => panel.caseId ?? 1),
        ]);
        if ((openFem3dCalculationModel.supports ?? []).some((support) =>
          Object.keys(support.prescribed ?? {}).length > 0)) {
          // Opgelegde verplaatsingen zijn een modelrandvoorwaarde en werken in
          // ieder rekenspoor. Bewaar daarom altijd ook een resultaat onder het
          // actieve geval, zelfs wanneer eigen gewicht een ander geval vult.
          loadedCaseIds.add(fem.activeLoadCaseId);
        }
        const nativeRoute = openFem3dRoute?.engineId === "openaec-native-fem";
        // De native route kent ook volumelasten; die tellen als belast geval.
        if (nativeRoute) {
          for (const load of [...(openFem3d.volumeBodyLoads ?? []), ...(openFem3d.volumeFaceLoads ?? []),
            ...(openFem3d.plateEdgeLoads ?? [])]) loadedCaseIds.add(load.caseId ?? 1);
          if (openFem3dCalculation.selfWeightCaseId !== undefined && (openFem3d.volumes ?? []).some(
            (volume) => volume.densityKgPerM3 !== undefined)) loadedCaseIds.add(openFem3dCalculation.selfWeightCaseId);
        }
        if (loadedCaseIds.size === 0) throw new Error("Voeg minstens één 3D-belasting of opgelegde verplaatsing toe.");
        if (!nativeRoute && (fem.analysetype === "tweedeOrdeFysisch" || fem.analysetype === "axiaalFysischRust")) {
          throw new Error("Fysisch niet-lineaire 3D-analyse is nog niet beschikbaar in Open FEM 3D. Kies eerste orde of tweede orde (P-Δ), of Open FEM Rust in Instellingen → Berekening.");
        }
        if (openFem3dRoute?.automaticNative) {
          void import("./io/notify").then(({ notifyInfo }) => notifyInfo(
            i18next.t("common:app.solve.nativeRouteTitle"),
            i18next.t("common:app.solve.nativeRouteText", {
              features: openFem3dRoute!.features.map((feature) => i18next.t(`common:app.solve.nativeFeature.${feature}`)).join(", "),
            }),
          )).catch(() => {});
        }
        const openFem3dAnalysis = fem.analysetype === "eersteOrde" ? "linear" : "p-delta";
        // De blijvende gevallen (type "dead") zijn de montagelasten van
        // trek-alleen staven als het model ze na de permanente belasting
        // monteert; het eigen-gewichtgeval laat de uitkomst de kabelwerking melden.
        const openFem3dOptions = {
          permanentCaseIds: fem.loadCases.filter((loadCase) => loadCase.type === "dead").map((loadCase) => loadCase.id),
          ...(openFem3dCalculation.selfWeightCaseId !== undefined
            ? { selfWeightCaseId: openFem3dCalculation.selfWeightCaseId } : {}),
        };
        // Initiële scheefstand (EN 1993-1-1 §5.3.2) in de RESULTATEN: elke
        // combinatie, UGT én BGT zoals in 2D (issue #194), in +X en −X met φ_X
        // en +Y en −Y met φ_Y, met φ·V op elke verticale last. Uit = geen
        // varianten. De toets rekent hoe dan ook met scheefstand, alleen in de
        // UGT (zie de toetskrachten hieronder, issue #199).
        const scheefstandPhi = fem.scheefstandEnabled ? openFem3dScheefstandUitkomst?.phi ?? null : null;
        // De torsievarianten van 5.3.2(10) (issue #212) ook in de resultaten,
        // zodat de toets ze kan hergebruiken. Niet bij platen: een vlaklast kent
        // per plaat alleen een uniform verloop, en de toets weigert platen toch.
        const resultaatTorsie = scheefstandPhi && (openFem3dCalculationModel.plates?.length ?? 0) === 0
          ? openFem3dTorsieRijen : null;
        const combinations = metScheefstandRichtingen3D(fem.combinations.filter((combination) =>
          [...loadedCaseIds].some((caseId) => (combination.factors.get(caseId) ?? 0) !== 0)), scheefstandPhi,
        { bgt: true, torsie: resultaatTorsie });

        // Elk geval blijft afzonderlijk beschikbaar voor invoercontrole. Iedere
        // combinatie gaat als één volledige lastvector door de gekozen kern;
        // tweede-orde-uitkomsten worden dus nooit gesuperponeerd.
        let casePairs: Array<readonly [number, OpenFem3DSolveResult]>;
        let combinationPairs: Array<readonly [number, OpenFem3DSolveResult]>;
        if (nativeRoute) {
          // Native Rust-route: het model omgezet naar het frame3d-rekenmodel,
          // eigen gewicht inclusief volumes (dichtheid). Scheefstand-varianten
          // kent deze route niet; die gaan als gewone combinatie door.
          const nativeModel = openFem3DNativeCalculationModel(openFem3d, openFem3dCalculation.selfWeightCaseId);
          const nativeAnalysis = openFem3DNativeAnalysis(nativeModel, fem.analysetype);
          // Grote volumemodellen één voor één: elke native run houdt zijn eigen
          // net en spanningsresultaat in het geheugen.
          if ((nativeModel.volumes?.length ?? 0) >= 10_000) {
            casePairs = [];
            combinationPairs = [];
            for (const caseId of loadedCaseIds) {
              casePairs.push([caseId, await solveOpenFem3DNative(nativeModel, caseId, nativeAnalysis)]);
            }
            for (const combination of combinations) {
              combinationPairs.push([combination.id,
                await solveOpenFem3DNativeCombination(nativeModel, combination.factors, nativeAnalysis)]);
            }
          } else {
            [casePairs, combinationPairs] = await Promise.all([
              Promise.all([...loadedCaseIds].map(async (caseId) =>
                [caseId, await solveOpenFem3DNative(nativeModel, caseId, nativeAnalysis)] as const)),
              Promise.all(combinations.map(async (combination) =>
                [combination.id, await solveOpenFem3DNativeCombination(
                  nativeModel, combination.factors, nativeAnalysis)] as const)),
            ]);
          }
        } else {
          [casePairs, combinationPairs] = await Promise.all([
            Promise.all([...loadedCaseIds].map(async (caseId) =>
              [caseId, await solveOpenFem3D(openFem3dCalculationModel, caseId, openFem3dAnalysis, openFem3dOptions)] as const)),
            Promise.all(combinations.map(async (combination) =>
              [combination.id, await solveOpenFem3DCombination(
                openFem3dCalculationModel, combination.factors, openFem3dAnalysis,
                scheefstandVanCombinatie(combination, scheefstandPhi, resultaatTorsie), openFem3dOptions)] as const)),
          ]);
        }
        if (generation !== openFem3dSolveGenerationRef.current) {
          const message = `De 3D-berekening is vervallen doordat model of rekeninstellingen tijdens de berekening wijzigden (generatie ${generation} → ${openFem3dSolveGenerationRef.current}).`;
          setOpenFem3dSolveError(message);
          setSolverErrorText(message);
          setSolverStatus({ kind: "error" });
          return;
        }
        const caseResults = new Map(casePairs);
        const combinationResults = new Map(combinationPairs);
        // Leeg actief geval (issue #245): niet stil het resultaat van een ánder
        // geval onder deze naam, maar de eerste berekende combinatie als actieve
        // combinatie, of een berekend geval als actief geval. Dezelfde keuze
        // als het effect dat op een gewijzigde resultaatset reageert.
        const keuze = kiesOpenFem3DResultaat(caseResults, combinationResults, fem.activeLoadCaseId, combinations);
        const result = keuze.result;
        if (!result) throw new Error("De 3D-rekenkern leverde geen resultaat voor de aanwezige belastingen.");
        setOpenFem3dCaseResults(caseResults);
        setOpenFem3dCombinationResults(combinationResults);
        setOpenFem3dSolvedCombinations(combinations);
        if (keuze.wisselNaarGeval !== null) fem.setActiveLoadCaseId(keuze.wisselNaarGeval);
        setOpenFem3dActiveCombinationId(keuze.combinationId);
        setOpenFem3dResult(result);
        setSolverErrorText(null);
        setSolverStatus({ kind: "solved", at: Date.now() });
        setTreeTab("results");
        // Zoals in 2D: na Berekenen de modus Resultaten, met vervorming,
        // reacties, unity checks en (als er nog geen lijn aan staat) My.
        setOpenFem3dShowLoadCase(true);
        setResultsTabActive(true);
        setOpenFem3dVisibility((value) => ({
          ...value, deformation: true, reactions: true,
          momentY: value.axialForce || value.shearY || value.shearZ || value.torsion || value.momentY || value.momentZ
            || value.groundPressure ? value.momentY : true,
        }));
        const unbalanced = [...casePairs, ...combinationPairs]
          .map(([, value]) => value.forceBalance)
          .filter((balance): balance is NonNullable<OpenFem3DSolveResult["forceBalance"]> => balance?.ok === false);
        if (unbalanced.length > 0) {
          const maximumForce = Math.max(...unbalanced.map((balance) => balance.maxImbalanceKn));
          const maximumMoment = Math.max(...unbalanced.map((balance) => balance.maxMomentImbalanceKnm ?? 0));
          void import("./io/notify").then(({ notifyWarning }) => notifyWarning(
            i18next.t("common:app.solve.failed"),
            `Globaal evenwicht in ${unbalanced.length} resultaten wijkt af: ` +
            `kracht maximaal ${maximumForce.toFixed(3)} kN, moment maximaal ${maximumMoment.toFixed(3)} kNm.`,
          )).catch(() => {});
        }
      } catch (cause) {
        if (generation !== openFem3dSolveGenerationRef.current) return;
        const message = cause instanceof Error ? cause.message : String(cause);
        setOpenFem3dResult(null);
        setOpenFem3dCaseResults(new Map());
        setOpenFem3dCombinationResults(new Map());
        setOpenFem3dActiveCombinationId(null);
        setOpenFem3dSolveError(message);
        setSolverErrorText(message);
        setSolverStatus({ kind: "error" });
        void import("./io/notify").then(({ notifyWarning }) =>
          notifyWarning(i18next.t("common:app.solve.failed"), message)).catch(() => {});
      }
      return;
    }
    // Make sure the user is looking at the canvas (not the report/IFC view).
    setActiveView("default");
    // Spring direct naar de Resultaten-tab in BEIDE plekken:
    //   1. verkenner (FemProjectTree) — links
    //   2. belastinggevallen-strip (LoadCaseTabBar) — onder
    setTreeTab("results");
    setResultsTabActive(true);
    // De Model-tab verbergt ook resultaatlagen via deze algemene schakelaar.
    fem.setShowLoads(true);
    // Zet alle resultaten-overlays standaard aan zodat M/V/N + reacties +
    // vervorming meteen zichtbaar zijn op de canvas. De unity checks horen
    // daarbij: de toetsing loopt altijd mee met de berekening, dus de badges
    // horen er ook te staan — en zij zijn de ingang naar de afleiding per
    // staaf (klikken opent die naast het model).
    setDisplayFlags(prev => ({ ...prev, M: true, V: true, N: true, deflection: true, reactions: true }));
    // Clear selection so the results overlay isn't visually competing with
    // selection-halos. User wants a clean view after computing.
    fem.setSelection(null);
    // Rekenen + toetsen; vanaf nu blijft het model live.
    void rekenDoor(selectedSolver.id);
  }, [fem, openFem3d, openFem3dCalculation, openFem3dCalculationModel, modelDimension, rekenDoor,
    openFem3dScheefstandUitkomst, openFem3dTorsieRijen]);

  // Keyboard: Ctrl+Z / Ctrl+Y for undo/redo. In vrije-tekstvelden blijft het de
  // tekst-undo van de browser; in getalvelden, keuzelijsten e.d. gaat het naar
  // de modelhistorie (zie lib/undoRoute.ts) — anders lijkt een verplaatsing via
  // het eigenschappenpaneel niet terug te draaien zolang de cursor in het veld staat.
  const undoRedoRef = useRef({ undo: fem.undo, redo: fem.redo });
  undoRedoRef.current = { undo: fem.undo, redo: fem.redo };
  // Een klik op de titelbalk of ribbon laat eerst het actieve invoerveld los.
  // Wacht één event-lus zodat diens onBlur-commit in de historie staat en lees
  // daarna de nieuwste handlers uit de ref, net als bij Ctrl+Z vanuit een veld.
  const toolbarUndoRedo = (kind: "undo" | "redo") => {
    setTimeout(() => {
      if (modelDimension === "3d") undoRedoOpenFem3D(kind);
      else undoRedoRef.current[kind]();
    }, 0);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      const isUndo = k === "z" && !e.shiftKey;
      const isRedo = k === "y" || (e.shiftKey && k === "z");
      if (!isUndo && !isRedo) return;
      const t = e.target as HTMLElement | null;
      if (undoRoute(t as HTMLInputElement | null) === "veld") return;
      e.preventDefault();
      const voerUit = () => {
        if (modelDimension === "3d") undoRedoOpenFem3D(isUndo ? "undo" : "redo");
        else (isUndo ? undoRedoRef.current.undo() : undoRedoRef.current.redo());
      };
      if (moetEerstVastleggen(t)) {
        // Eerst vastleggen: een half ingetypte waarde wordt een historiestap en
        // gaat dan mee terug. Een tik wachten, zodat undo de stap van de blur kent.
        t?.blur();
        setTimeout(voerUit, 0);
      } else {
        voerUit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modelDimension, undoRedoOpenFem3D]);

  // C1: Ctrl+S / Cmd+S = Opslaan, Ctrl+Shift+S = Opslaan als. Altijd
  // preventDefault zodat de browser-save-dialoog nooit verschijnt; opslaan
  // mag óók vuren terwijl een input/dialog focus heeft.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (e.shiftKey) void handleSaveProjectAs();
        else void handleSaveProject();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSaveProject, handleSaveProjectAs]);

  // Berekenen op verzoek van de gebruiker (lintknop of F9) krijgt na afloop een
  // melding rechtsonder (ontwerp 0.4). Automatisch herrekenen niet: dat zou bij
  // elke wijziging een melding geven.
  const gebruikerRekentRef = useRef<number | null>(null);
  const handleSolveDoorGebruiker = useCallback(() => {
    gebruikerRekentRef.current = performance.now();
    void handleSolve();
  }, [handleSolve]);
  useEffect(() => {
    const start = gebruikerRekentRef.current;
    if (start === null || solverStatus.kind === "rekenen") return;
    gebruikerRekentRef.current = null;
    if (solverStatus.kind !== "solved") return;
    const seconden = ((performance.now() - start) / 1000).toLocaleString(i18next.language, { maximumFractionDigits: 1 });
    const regels = [i18next.t("common:app.solve.doneBody", {
      analyse: i18next.t(`common:loadCases.analysisType.${fem.analysetype}`),
      gevallen: fem.loadCases.length,
      combinaties: fem.combinations.length,
    })];
    if (modelDimension !== "3d" && fem.multiLcResult) {
      let grootste: { u: number; caseId: number } | null = null;
      for (const [caseId, r] of fem.multiLcResult) {
        if (Number.isFinite(r.maxDisplacement) && (!grootste || r.maxDisplacement > grootste.u)) grootste = { u: r.maxDisplacement, caseId };
      }
      if (grootste) regels.push(i18next.t("common:app.solve.doneMaxU", {
        u: grootste.u.toLocaleString(i18next.language, { maximumFractionDigits: 1 }),
        geval: fem.loadCases.find((c) => c.id === grootste!.caseId)?.name ?? "",
      }));
    }
    pushToast({
      kind: "success",
      title: i18next.t("common:app.solve.done", { tijd: seconden }),
      body: regels.join("\n"),
      duration: 7000,
      actie: {
        label: i18next.t("common:app.solve.showResults"),
        onClick: () => { setTreeTab("results"); setResultsTabActive(true); },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solverStatus]);

  // Sneltoetsen (lib/sneltoetsen.ts). Letters alleen in het 2D-model en niet
  // tijdens typen of met een dialoog open; Ctrl+S en Ctrl+Z hebben hierboven
  // hun eigen afhandeling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      const actie = actieVoorToets(e);
      if (!actie) return;
      const metCtrl = e.ctrlKey || e.metaKey;
      if (erIsEenDialoogOpen() || backstageOpen) return;
      if (!metCtrl && !e.key.startsWith("F") && isTypVeld(e.target)) return;
      if (actie === "overzicht" && e.key === "?" && isTypVeld(e.target)) return;
      const in2DModel = modelDimension !== "3d" && (activeView === "default" || activeView === "table" || activeView === "check");
      const tool = ({ staaf: "addBeam", knoop: "addNode", plaat: "addPlate", scharnier: "addPinned", puntlast: "addPointLoad", lijnlast: "addLineLoad" } as const)[actie as string];
      if (tool) {
        if (!in2DModel) return;
        e.preventDefault();
        setFemTool(tool);
        return;
      }
      e.preventDefault();
      switch (actie) {
        case "nieuw": void handleNewProject(); break;
        case "openen": void handleOpenProject(); break;
        case "afdrukken": setActiveView("report"); break;
        case "voorkeuren": setSettingsOpen(true); break;
        case "stramien": setGridsOpen(true); break;
        case "belastinggevallen": setLoadCasesTab("cases"); setLoadCasesOpen(true); break;
        case "berekenen": handleSolveDoorGebruiker(); break;
        case "overzicht": setSneltoetsenOpen(true); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeView, modelDimension, backstageOpen, handleNewProject, handleOpenProject, handleSolveDoorGebruiker]);

  // C2: dirty-detectie. Draait alléén wanneer persisteerbare modelstate
  // wijzigt (array-identiteiten veranderen per mutatie), nooit per render —
  // de JSON-vergelijking is dus event-gedreven en goedkoop.
  useEffect(() => {
    const json = modelJson(buildProjectSnapshot());
    if (baselineResetRef.current || lastSavedRef.current === null) {
      baselineResetRef.current = false;
      lastSavedRef.current = json;
      setDirty(false);
      return;
    }
    setDirty(json !== lastSavedRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fem.nodes, fem.beams, fem.supports, fem.plates, fem.loads,
      fem.loadCases, fem.activeLoadCaseId, fem.selfWeightEnabled,
      fem.analysetype, fem.betonSegmentLengteMm,
      // v2: combinaties + stramien + scheefstand reizen mee in de snapshot-JSON.
      fem.combinations, fem.structuralGrid,
      fem.scheefstandEnabled, fem.scheefstandNoemer, fem.scheefstandRichting,
      // De normkeuze staat óók in de snapshot; zonder deze drie zou een
      // gewijzigde scheefstandbron het bestand niet als "gewijzigd" markeren
      // en stil verloren gaan bij het afsluiten.
      fem.scheefstandBron, fem.scheefstandHoogteM, fem.scheefstandAantalElementen,
      fem.scheefstandAantalX, fem.scheefstandAantalY, fem.scheefstandTorsie, fem.scheefstandEigenKolom,
      fem.houtToetsEN1995, openFem3d]);

  // C2: sluitbeveiliging. Tauri: onCloseRequested + native dialoog (dekt de
  // titelbalk-sluitknop, Bestand → Afsluiten en Alt+F4). Browser: beforeunload.
  // `closeRequestPendingRef` staat bij de dirty-vlag: de vraagpoort van de
  // bestandskoppeling leest hem ook.
  const confirmUnsavedRef = useRef(confirmUnsavedAction);
  useEffect(() => { confirmUnsavedRef.current = confirmUnsavedAction; });
  useEffect(() => {
    if (isTauriApp()) {
      let unlisten: (() => void) | undefined;
      let disposed = false;
      import("@tauri-apps/api/window")
        .then(({ getCurrentWindow }) =>
          getCurrentWindow().onCloseRequested(async (event) => {
            if (closeRequestPendingRef.current) {
              event.preventDefault();
              return;
            }
            if (!isDirtyRef.current) return;
            closeRequestPendingRef.current = true;
            let proceed = false;
            try {
              proceed = await confirmUnsavedRef.current();
            } catch (error) {
              console.error("sluitbeveiliging faalde", error);
            }
            if (!proceed) {
              event.preventDefault();
              closeRequestPendingRef.current = false;
              // Geannuleerd: een bestand dat intussen binnenkwam, mag nu open.
              vraagpoortRef.current?.misschienOpen();
            }
          })
        )
        .then((u) => { if (disposed) u(); else unlisten = u; })
        .catch(() => {});
      return () => { disposed = true; unlisten?.(); };
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // C2: wijzigingsindicator in de venster-/tabtitel ("● bestandsnaam").
  // Zonder pad: "Naamloos project" — zelfde tekst als de DocumentBar-tab,
  // zodat venstertitel en documenttab nooit verschillende namen tonen.
  useEffect(() => {
    const name = projectPath ? projectPath.split(/[\\/]/).pop() : i18next.t("ribbon:report.unnamedProject");
    document.title = `${isDirty ? "● " : ""}${name} — ${PRODUCTNAAM}`;
  }, [isDirty, projectPath]);

  // Startvenster verwijderd op verzoek: de app opent direct in het model.

  // Left panel state (Explorer)
  const [leftPanelWidth, setLeftPanelWidth] = useState(240);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const isLeftResizing = useRef(false);

  // Right panel state (Properties)
  const [rightPanelWidth, setRightPanelWidth] = useState(288);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const isRightResizing = useRef(false);


  const [isResizing, setIsResizing] = useState(false);

  // ── Tabel als split-view: canvas links, tabel rechts (start 50/50) ──────
  // De scheidingsbalk is versleepbaar (zelfde patroon als leftPanelWidth);
  // percentage van de beschikbare breedte zodat venster-resize netjes schaalt.
  const [tableSplitPct, setTableSplitPct] = useState(50);
  const splitWrapRef = useRef<HTMLDivElement>(null);
  const isSplitResizing = useRef(false);

  useEffect(() => {
    // Oude themanamen (forge, openaec, contrast) worden de 0.4-thema's.
    getSetting("theme", "light").then((saved) => {
      setTheme(themeId(saved));
      applyTheme(saved);
    });
    // Welcome modal is no longer auto-shown — the persistent StartSidebar
    // replaces it. Users can still open it via the help menu.
    getSetting("showWelcome", false).then((show) => {
      if (show) setWelcomeOpen(true);
    });
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      getCurrentWindow().show();
    }).catch(() => {});
  }, []);

  // Left panel resize handler
  const handleLeftResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isLeftResizing.current = true;
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isLeftResizing.current) return;
      const newWidth = Math.max(160, Math.min(480, ev.clientX));
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isLeftResizing.current = false;
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  // Right panel resize handler
  const handleRightResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isRightResizing.current = true;
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isRightResizing.current) return;
      const newWidth = Math.max(160, Math.min(480, window.innerWidth - ev.clientX));
      setRightPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isRightResizing.current = false;
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);


  // Split-divider tussen canvas en tabel (Tabel-weergave) verslepen.
  const handleSplitResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isSplitResizing.current = true;
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isSplitResizing.current) return;
      const rect = splitWrapRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setTableSplitPct(Math.max(20, Math.min(80, pct)));
    };

    const handleMouseUp = () => {
      isSplitResizing.current = false;
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  // Volledige-breedteweergaven verbergen de zijpanelen. De toetsing hoort daar
  // NIET bij: klikken op een UC-badge moet de toetsing van díé staaf NAAST het
  // model tonen, niet in de plaats daarvan. Zo blijft het model in beeld
  // terwijl je de afleiding leest, en zie je welke staaf je voor je hebt.
  const isFullWidthView = activeView === "openFem3d" || activeView === "viewer" || activeView === "ifc" || activeView === "report" || activeView === "insights" || activeView === "prestressedBeam" || activeView === "volumeWorkbench";

  // Het 2D-model voor het selectiefilter (issue #94); één object per modelstand.
  const selectieFilterModel2D = useMemo(
    () => ({ nodes: fem.nodes, beams: fem.beams, plates: fem.plates, supports: fem.supports, loads: fem.loads }),
    [fem.nodes, fem.beams, fem.plates, fem.supports, fem.loads]);
  /**
   * De selectie uit het selectiefilter in 2D (issue #94), zoals in 3D
   * (`zetGefilterdeSelectie3D`): het tekenvlak toont alleen de lasten van het
   * actieve geval, buiten de combinatie-, omhullende- en resultatenweergave.
   * Staan er lasten in, dan wordt het geval van `filterLastGeval` actief en
   * gaat de weergave terug naar dat geval, zoals de gevalkiezer in de
   * verkenner; liggen ze in meerdere gevallen, dan volgt een melding.
   */
  const zetGefilterdeSelectie2D = (next: Selection, ids: SelectieIds2D) => {
    fem.setSelection(next);
    const gevallen = selectieBelastinggevallen2D(selectieFilterModel2D, ids);
    const keuze = filterLastGeval(gevallen, fem.activeLoadCaseId);
    if (!keuze) return;
    if (keuze.geval !== fem.activeLoadCaseId) fem.setActiveLoadCaseId(keuze.geval);
    fem.setActiveCombinationId(null);
    fem.setEnvelopeView(false);
    fem.setShowLoads(true);
    setResultsTabActive(false);
    if (keuze.meerdere) meldGefilterdeLastenInMeerdereGevallen(gevallen, keuze.geval);
  };

  /**
   * Een 3D-view toepassen: een eigen view uit het venster Views of uit de
   * verkenner (tab Views), of een standaardview. Zichtbaarheid, aanzicht,
   * belastinggeval of combinatie en tab; een eigen view uit de verkenner krijgt
   * daarna zijn exacte camera (het venster doet dat zelf). Vanuit de verkenner
   * blijft de verkennertab staan.
   */
  const pasOpenFem3dViewToe = (w: OpenFem3DViewToepassing, vanuitVerkenner = false) => {
    setOpenFem3dVisibility({ ...w.visibility });
    // Een eigen view zet de waarden bij de snedekrachtlijnen; een standaardview laat ze staan.
    if (w.diagramLabels) setOpenFem3dDiagramLabels({ ...w.diagramLabels });
    setOpenFem3dViewRequest((previous) => ({ kind: w.view, token: previous.token + 1 }));
    if (vanuitVerkenner && w.camera) {
      const camera = w.camera;
      setOpenFem3dCameraVerzoek((previous) => ({ state: camera, token: (previous?.token ?? 0) + 1 }));
    }
    if (w.loadCaseId && fem.loadCases.some((loadCase) => loadCase.id === w.loadCaseId)) {
      fem.setActiveLoadCaseId(w.loadCaseId);
    }
    if (w.mode) {
      setOpenFem3dShowLoadCase(w.mode !== "model");
      setResultsTabActive(w.mode === "results");
      if (!vanuitVerkenner) setTreeTab(w.mode === "results" ? "results" : "project");
    }
    if (w.combinationId === null) {
      setOpenFem3dActiveCombinationId(null);
      setOpenFem3dResult(openFem3dCaseResults.get(w.loadCaseId ?? fem.activeLoadCaseId) ?? null);
    } else {
      setOpenFem3dActiveCombinationId(w.combinationId);
      setOpenFem3dResult(openFem3dCombinationResults.get(w.combinationId) ?? null);
    }
    setOpenFem3dActieveView(w.sleutel);
  };

  const renderMainContent = () => {
    switch (activeView) {
      case "openFem3d":
        return (
          <Suspense fallback={<div className="placeholder"><p>{t("app.view.loading3d")}</p></div>}>
            <OpenFem3DEditor
              model={openFem3d}
              calculationModel={openFem3dCalculationModel}
              onChange={setOpenFem3d}
              onConnectNodes={() => handleOpenFem3DConnectNodes("model")}
              onMergeNodes={() => handleOpenFem3DMergeNodes("model")}
              modelCheckToken={openFem3dModelCheckToken}
              tool={openFem3dTool}
              onToolChange={handleOpenFem3DToolChange}
              onPlaceNodeCondition={(target) => applyOpenFem3DNodeTool(target)}
              onPlacePointLoad={(target) => applyOpenFem3DPointLoadTool(target)}
              deformationDisplay={openFem3dDeformationDisplay}
              diagramLabels={openFem3dDiagramLabels}
              deleteToken={openFem3dDeleteToken}
              fitRequest={openFem3dFitToken}
              viewRequest={openFem3dViewRequest}
              initialCamera={openFem3dCameraSnapshot?.viewToken === openFem3dViewRequest.token
                && openFem3dCameraSnapshot.fitToken === openFem3dFitToken ? openFem3dCameraSnapshot.state : null}
              onCameraStateChange={(state) => setOpenFem3dCameraSnapshot({
                state, viewToken: openFem3dViewRequest.token, fitToken: openFem3dFitToken,
              })}
              onCameraViewChange={(kind) => setOpenFem3dViewRequest((previous) =>
                previous.kind === kind ? previous : { ...previous, kind })}
              selection={openFem3dSelection}
              onSelectionChange={handleOpenFem3DSelectionChange}
              visibilityOpen={visibility3DOpen}
              onVisibilityOpen={() => setVisibility3DOpen(true)}
              onVisibilityClose={() => setVisibility3DOpen(false)}
              visibility={openFem3dVisibility}
              onVisibilityChange={setOpenFem3dVisibility}
              showLoadCase={openFem3dShowLoadCase}
              resultsActive={resultsTabActive}
              structuralGrid={fem.structuralGrid}
              gridSpacingM={grid.spacingMm / 1000}
              result={openFem3dShowLoadCase ? openFem3dResult : null}
              plateQuantity={openFem3dPlateQuantity}
              solving={solverStatus.kind === "rekenen"}
              solveError={openFem3dSolveError}
              activeLoadCaseId={fem.activeLoadCaseId}
              viewSets={openFem3dViewSets}
              currentView={openFem3dViewRequest.kind}
              currentCombinationId={openFem3dActiveCombinationId}
              combinationOptions={openFem3dCombinaties.map((combination) => ({ id: combination.id, name: combination.name }))}
              loadCaseOptions={fem.loadCases.map((loadCase) => ({ id: loadCase.id, name: loadCase.name }))}
              loadCaseTypes={openFem3dLoadCaseTypes}
              onViewSetsChange={setOpenFem3dViewSets}
              onApplyViewSet={(viewSet) => pasOpenFem3dViewToe(openFem3DViewSetToepassing(viewSet))}
              cameraVerzoek={openFem3dCameraVerzoek}
            />
          </Suspense>
        );
      case "ifc":
        return <IfcViewerPanel model={ifcModel} />;
      case "report":
        if (modelDimension === "3d") {
          return <OpenFem3DReport
            model={openFem3dCalculationModel}
            levels={fem.structuralGrid.zAxes}
            result={openFem3dResult}
            projectName={projectPath ? projectPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") : projectInfo.name}
            activeLoadCaseId={fem.activeLoadCaseId}
            activeLoadCaseName={fem.loadCases.find((loadCase) => loadCase.id === fem.activeLoadCaseId)?.name}
            activeCombinationName={openFem3dCombinaties.find((combination) => combination.id === openFem3dActiveCombinationId)?.name}
            activeCombinationFactors={openFem3dCombinaties.find((combination) => combination.id === openFem3dActiveCombinationId)?.factors}
            combinations={openFem3dCombinaties}
            combinationResults={openFem3dCombinationResults}
            scheefstandTekst={openFem3dScheefstandTekst}
            caseResults={openFem3dCaseResults}
            activeCombinationId={openFem3dActiveCombinationId}
            viewSets={openFem3dViewSets}
            standaardViewsUitRapport={openFem3dStandaardViewsUitRapport}
          />;
        }
        // Doorgeef-regels naar het live rapport (ReportDataContext) — de
        // secties lezen deze modelstate en volgen elke wijziging direct.
        return <ReportPreview data={reportData} onDetach={handleDetachReport} />;
      case "insights":
        return <InsightsView nodes={fem.nodes} beams={fem.beams} supports={fem.supports} initialMode={insightsMode} solverError={solverErrorText} stabiliteitsMelding={stabiliteitsMelding} />;
      case "prestressedBeam":
        return <PrestressedBeamView />;
      case "volumeWorkbench":
        return <VolumeWorkbench />;
      case "viewer":
        return (
          <Suspense fallback={<div className="placeholder"><p>{t("app.view.loading3d")}</p></div>}>
            <ThreeViewer />
          </Suspense>
        );
      default: {
        // FEM canvas (2D-tab). In de Tabel-weergave wordt dit een
        // split-view: canvas links, tabel rechts, met een versleepbare
        // scheidingsbalk — het model blijft zichtbaar terwijl je in de
        // tabel werkt en rij-selectie licht direct op in het canvas.
        // De canvas staat in beide gevallen op dezelfde plek in de boom,
        // dus zoom/selectie overleven het wisselen tussen Start en Tabel.
        const isTableSplit = activeView === "table";
        const isSplit = isTableSplit;
        return (
          <div className="canvas-split" ref={splitWrapRef}>
            <div
              className="canvas-split-canvas"
              style={isSplit ? { flex: `0 0 ${tableSplitPct}%` } : undefined}
            >
              <FemCanvas
                tool={femTool}
                onToolChange={setFemTool}
                perCase={solverStatus.kind === "solved" ? fem.multiLcResult : null}
                activeLoadCaseName={fem.loadCases.find(c => c.id === fem.activeLoadCaseId)?.name}
                solverBusy={solverStatus.kind === "rekenen"}
                solveError={solverErrorText}
                nodes={fem.nodes}
                beams={fem.beams}
                supports={fem.supports}
                plates={fem.plates}
                loads={fem.loads}
                eigenGewicht={eigenGewicht}
                selection={fem.selection}
                activeLoadCaseId={fem.activeLoadCaseId}
                showLoads={fem.showLoads}
                setPendingLoadFocus={fem.setPendingLoadFocus}
                setSelection={fem.setSelection}
                addNode={fem.addNode}
                updateNode={fem.updateNode}
                addBeam={fem.addBeam}
                updateBeam={fem.updateBeam}
                addPlate={fem.addPlate}
                updatePlate={fem.updatePlate}
                addSupport={fem.addSupport}
                addLoad={fem.addLoad}
                updateLoad={fem.updateLoad}
                deleteSelected={fem.deleteSelected}
                splitBeamAt={fem.splitBeamAt}
                addNodeMetSplitsing={fem.addNodeMetSplitsing}
                verbindKnoopMetStaaf={fem.verbindKnoopMetStaaf}
                voegKnopenSamen={fem.voegKnopenSamen}
                herstelModel={fem.herstelModel}
                translateSelection={fem.translateSelection}
                copySelection={fem.copySelection}
                rotateSelection={fem.rotateSelection}
                mirrorSelection={fem.mirrorSelection}
                plakLasten={fem.plakLasten}
                translateNodes={fem.translateNodes}
                structuralGrid={fem.structuralGrid}
                setStructuralGrid={fem.setStructuralGrid}
                verplaatsStramienAs={fem.verplaatsStramienAs}
                grid={grid}
                combinations={fem.rekenCombinaties}
                activeCombinationId={fem.activeCombinationId}
                envelopeView={fem.envelopeView}
                combinationResults={solverStatus.kind === "solved" ? fem.combinationResults : null}
                envelope={solverStatus.kind === "solved" ? fem.envelope : null}
                displayFlags={displayFlags}
                setDisplayFlags={setDisplayFlags}
                resultsMode={resultsTabActive}
                onZoomChange={setZoomPct}
              />
              <CanvasMeldingen
                meldingen={fem.belastingMeldingen}
                onToonHout={() => {
                  const ids = fem.beams.filter((b) => {
                    const m = materiaalVanStaaf(b);
                    return m === "hout" || m === "clt";
                  }).map((b) => b.id);
                  if (ids.length === 1) fem.setSelection({ type: "beam", id: ids[0] });
                  else if (ids.length > 1) fem.setSelection({ type: "multi", nodeIds: [], beamIds: ids, plateIds: [] });
                }}
                onOpenCombinaties={() => { setLoadCasesTab("combos"); setLoadCasesOpen(true); }}
              />
            </div>
            {isTableSplit && (
              <>
                <div
                  className="canvas-split-divider"
                  onMouseDown={handleSplitResizeMouseDown}
                  title={t("app.layout.dragTableSplit")}
                />
                <div className="canvas-split-table">
                  {/* Tabel-editor (ribbon-tab "Tabel") — model en lasten als
                      bewerkbare tabellen, resultaten alleen-lezen. Zelfde
                      store-mutators als het canvas, dus selectie/undo werken
                      gewoon door. */}
                  <TableView
                    dataset={tableDataset}
                    apiRef={tableApiRef}
                    nodes={fem.nodes}
                    beams={fem.beams}
                    plates={fem.plates}
                    supports={fem.supports}
                    loads={fem.loads}
                    eigenGewicht={eigenGewicht}
                    loadCases={fem.loadCases}
                    activeLoadCaseId={fem.activeLoadCaseId}
                    selection={fem.selection}
                    setSelection={fem.setSelection}
                    addNode={fem.addNode}
                    updateNode={fem.updateNode}
                    removeNode={fem.removeNode}
                    addBeam={fem.addBeam}
                    updateBeam={fem.updateBeam}
                    removeBeam={fem.removeBeam}
                    updatePlate={fem.updatePlate}
                    removePlate={fem.removePlate}
                    addSupport={fem.addSupport}
                    removeSupport={fem.removeSupport}
                    addLoad={fem.addLoad}
                    updateLoad={fem.updateLoad}
                    removeLoad={fem.removeLoad}
                    combinations={fem.rekenCombinaties}
                    combinationResults={fem.combinationResults}
                    caseResults={fem.multiLcResult}
                    envelope={fem.envelope}
                  />
                </div>
              </>
            )}
          </div>
        );
      }
    }
  };

  // De API-commando's (src/api/) in deze app; zie bediening/apiAdapter.ts. Het
  // bedieningskanaal en het gevallenvenster (een geval verwijderen in 3D, #91)
  // gebruiken dezelfde acties.
  const apiActies: ApiAppActies = {
    document: () => buildProjectSnapshot() as unknown as ApiDocument,
    bewerk3D: (model, stramien, extern) => {
      if (explodeAmountRef.current > 0) throw new Error("Schakel Exploderen uit voordat je het 3D-model wijzigt.");
      const blocked = changedLockedOpenFem3DLayer(openFem3dHistoryRef.current.model, model);
      if (blocked) throw new Error(i18next.t("common:tree.layerLockedEdit", { name: blocked.name }));
      // Zoals het stramienvenster (`commitLevels`): model en levels in één stap;
      // een wijziging aan de gevallen erbij ook (#91).
      const levels = stramien ? openFem3DLevelTransition(fem.structuralGrid.zAxes, stramien.zAxes) : null;
      dispatchOpenFem3D({ type: "edit", model, ...(levels ? { levels } : {}), ...(extern ? { extern } : {}) });
      if (stramien) setStructuralGridState(stramien);
    },
    zetModelDimensie: (dimensie) => {
      // Zoals Openen: de weergave volgt de dimensie; naar 3D ook de boom op
      // Weergave, zoals bij 2D omzetten en de stalen hal.
      setModelDimension(dimensie);
      setActiveView(dimensie === "3d" ? "openFem3d" : "default");
      if (dimensie === "3d") setTreeTab("view");
    },
    zetStramien: (stramien) => setStructuralGridState(stramien),
    zetGevallen: fem.zetGevallenUitDocument,
    nieuwProject: async (tekst) => {
      // Zoals Bestand → Nieuw: zonder bestand. Met het oude pad zou Opslaan
      // het vorige project overschrijven met dit nieuwe.
      await laadProjectTekst(tekst);
      setProjectPath("");
    },
    // `false` = er was geen stap (issue #244, punt 001); het API-antwoord
    // meldt dat dan in plaats van `done: true`.
    ongedaanMaken: () => {
      if (modelDimension === "3d" && explodeAmountRef.current > 0) throw new Error("Schakel Exploderen uit voor Ongedaan maken.");
      if (modelDimension === "3d") {
        if (openFem3dHistoryRef.current.past.length === 0) return false;
        undoRedoOpenFem3D("undo");
        return true;
      }
      if (!fem.canUndo) return false;
      fem.undo();
      return true;
    },
    opnieuw: () => {
      if (modelDimension === "3d" && explodeAmountRef.current > 0) throw new Error("Schakel Exploderen uit voor Opnieuw.");
      if (modelDimension === "3d") {
        if (openFem3dHistoryRef.current.future.length === 0) return false;
        undoRedoOpenFem3D("redo");
        return true;
      }
      if (!fem.canRedo) return false;
      fem.redo();
      return true;
    },
    opslaan: async (pad) => {
      const doel = pad ?? projectPath;
      if (!doel) throw new Error("Het project heeft nog geen bestand; geef `path` mee.");
      const { serializeProject, saveProjectTo } = await import("./io/projectFile");
      const snap = buildProjectSnapshot();
      await saveProjectTo(doel, serializeProject(snap));
      setProjectPath(doel);
      addRecentFile(doel);
      lastSavedRef.current = modelJson(snap);
      setDirty(false);
      const { notifySuccess } = await import("./io/notify");
      notifySuccess(i18next.t("common:app.file.saved"), doel.split(/[\\/]/).pop());
      return doel;
    },
    openen: async (pad) => {
      // Zoals een recent bestand openen (`handleOpenFilePath`), zonder de
      // vraag over niet-opgeslagen werk: daarover beslist de aanroeper.
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const { deserializeProject } = await import("./io/projectFile");
      const { notifySuccess, notifyWarning } = await import("./io/notify");
      const overschreven = pasProjectToe(deserializeProject(await readTextFile(pad)), pad);
      notifySuccess(i18next.t("common:app.file.projectOpened"), pad.split(/[\\/]/).pop());
      if (overschreven) notifyWarning(i18next.t("common:app.file.libraryUpdated"), overschreven);
      return pad;
    },
    importeren: async (pad, importerId) => {
      await useExtensieStore.getState().laden();
      const { uitkomst, extensie } = await useExtensieStore.getState().importeer(pad, importerId);
      const { deserializeProject } = await import("./io/projectFile");
      const parsed = deserializeProject(uitkomst.projectTekst);
      parsed.projectInfo = { ...parsed.projectInfo, name: (pad.split(/[\\/]/).pop() || pad).replace(/\.[^.]+$/, "") };
      pasProjectToe(parsed);
      setProjectPath("");
      return { meldingen: uitkomst.meldingen, extensie };
    },
    extensies: async () => {
      await useExtensieStore.getState().laden();
      return useExtensieStore.getState().kaarten;
    },
    heeftNietOpgeslagenWerk: () => isDirtyRef.current,
    // model3d.selection.filter met `select` (issue #94): zoals Toepassen in het venster.
    zetSelectie3D: (selectie) => zetGefilterdeSelectie3D(selectie),
    zetExplode3D: (explode) => setOpenFem3dVisibility((visibility) => ({ ...visibility, explode })),
  };

  /**
   * Een belastinggeval verwijderen in een 3D-project: de 3D-lasten en
   * belastingvlakken van dat geval gaan mee, langs hetzelfde commando als de
   * API, als één stap ongedaan maken (#91). Het laatste geval blijft, zoals in 2D.
   */
  const verwijderBelastinggeval3D = (id: number) => {
    void voerApiUitInApp(apiActies, "project.loadCase.delete", { id }).then(async (antwoord) => {
      if (antwoord.ok || antwoord.error.code === "GEWEIGERD") return;
      const { notifyWarning } = await import("./io/notify");
      notifyWarning(i18next.t("common:loadCases.deleteCaseFailed"), antwoord.error.melding);
    });
  };

  // Het bedieningskanaal. Ná alle closures hierboven, want het krijgt ze mee;
  // luistert alleen als Rust zegt dat OPENAEC_GUI_CONTROL=1 gezet was.
  const bedieningActief = useBediening({
    fem,
    modelDimension,
    openFem3d: {
      model: openFem3d,
      visibility: openFem3dVisibility,
      structuralGrid: fem.structuralGrid,
      replaceModel: (model, levels) => {
        // Een nieuw model met eigen levels: eerst de levels, want de knopen
        // en platen verwijzen ernaar. Vervangen is geen stap ongedaan maken.
        if (levels) setStructuralGridState((current) => ({ ...current, zAxes: levels }));
        dispatchOpenFem3D({ type: "replace", model });
        setOpenFem3dCameraSnapshot(null);
        // Een ander model: de section box (issue #86) uit, zonder de grenzen van het vorige.
        setOpenFem3dVisibility(openFem3DVisibilityZonderSectionBox);
        setOpenFem3dSelection(null);
        setModelDimension("3d");
        setActiveView("openFem3d");
        setTreeTab("view");
      },
      applySteelHall: pasStaalhalToe,
      setVisibility: setOpenFem3dVisibility,
      // Levels via dezelfde weg als het venster: gekoppelde knopen gaan mee.
      setStructuralGrid: setStructuralGrid3D,
      setView: (kind) => {
        setActiveView("openFem3d");
        setOpenFem3dViewRequest((previous) => ({ kind, token: previous.token + 1 }));
      },
      // De selectie: `section_box.fit = "selection"` (issue #86) zet de doos eromheen.
      selection: openFem3dSelection,
      setSelection: setOpenFem3dSelection,
      selectCombination: (id) => {
        const result = openFem3dCombinationResults.get(id);
        if (!result) return;
        setOpenFem3dActiveCombinationId(id);
        setOpenFem3dResult(result);
        setActiveView("openFem3d");
        setResultsTabActive(true);
        setTreeTab("results");
        setOpenFem3dVisibility((value) => ({ ...value, loads: false }));
      },
      updateBeam: (id, updates) => setOpenFem3d({
        ...openFem3d,
        beams: openFem3d.beams.map((beam) => beam.id === id ? { ...beam, ...updates } : beam),
      }),
      solve: handleSolve,
      result: openFem3dResult,
      caseResults: openFem3dCaseResults,
      combinationResults: openFem3dCombinationResults,
      activeCombinationId: openFem3dActiveCombinationId,
      solveError: openFem3dSolveError,
      generation: () => openFem3dSolveGenerationRef.current,
      solving: solverStatus.kind === "rekenen",
    },
    activeView,
    selection: fem.selection,
    setSelection: fem.setSelection,
    setActiveView,
    rekenDoor,
    rekenToestand: () => ({
      herberekeningGepland: herberekeningGeplandRef.current,
      lopendeRekengangen: lopendeRekengangenRef.current,
      generatie: rekenGeneratieRef.current,
      volledigeRekengang: volledigeRekengangRef.current,
    }),
    laatsteRekenfout: () => rekenFoutRef.current,
    createDetachedWindow,
    laadProjectTekst,
    importeerIfcProject: pasIfcImportToe,
    api: apiActies,
  });

  return (
    <>
      <TitleBar
        onSettingsClick={() => openSettings()}
        onFeedbackClick={() => setFeedbackOpen(true)}
        onSaveClick={() => { void handleSaveProject(); }}
        onUndoClick={() => toolbarUndoRedo("undo")}
        onRedoClick={() => toolbarUndoRedo("redo")}
        canUndo={modelDimension === "3d" ? openFem3dHistory.past.length > 0 : fem.canUndo}
        canRedo={modelDimension === "3d" ? openFem3dHistory.future.length > 0 : fem.canRedo}
        onPrintClick={() => setActiveView("report")}
      />
      <ToastHost />
      {importVerslag && <ImportVerslagVenster verslag={importVerslag} sluiten={() => setImportVerslag(null)} />}
      {/* R5 — houdt losgekoppelde rapportvensters synchroon met het model,
          de solver-uitkomsten, de toetsresultaten en de rapportinstellingen.
          Altijd gemonteerd (ook buiten het Rapport-tabblad), zodat het
          losgekoppelde venster live blijft terwijl hier gemodelleerd wordt. */}
      <ReportWindowSync data={reportData} />
      <Ribbon
        onFileTabClick={() => setBackstageOpen(true)}
        onSettingsClick={() => openSettings()}
        onProjectSettingsClick={() => setProjectSettingsOpen(true)}
        theme={theme}
        onThemeSelect={handleThemeSelect}
        onOpenLibrary={(tab) => { setLibraryTab(tab); setLibraryOpen(true); }}
        onOpenAiAssistant={() => openSettings("aiAssistant")}
        activeView={activeView}
        onViewChange={setActiveView}
        modelDimension={modelDimension}
        onConvertTo3D={handleConvertTo3D}
        onOpenSteelHall={() => setStaalhalOpen(true)}
        femTool={femTool}
        onFemToolChange={setFemTool}
        openFem3dTool={openFem3dTool}
        onOpenFem3DToolChange={handleOpenFem3DToolChange}
        canOpenFem3DDelete={openFem3dSelection !== null}
        onOpenFem3DFit={() => setOpenFem3dFitToken((token) => token + 1)}
        onOpenFem3DViewChange={(kind) => setOpenFem3dViewRequest((previous) => ({ kind, token: previous.token + 1 }))}
        openFem3dView={openFem3dViewRequest.kind}
        onToggle3DVisibility={() => setVisibility3DOpen((open) => !open)}
        visibility3DOpen={visibility3DOpen}
        openFem3dPlateDisplay={openFem3dVisibility.plateDisplay}
        onOpenFem3DPlateDisplayChange={(plateDisplay) => setOpenFem3dVisibility((visibility) =>
          // Dezelfde stand nog eens: hetzelfde object, dan bouwt het tekenvlak niets opnieuw op.
          visibility.plateDisplay === plateDisplay ? visibility : { ...visibility, plateDisplay })}
        // Section box (issue #86): dezelfde schakelaar als in het menu ▾ van de view cube.
        openFem3dSectionBox={openFem3dVisibility.sectionBox.enabled}
        openFem3dExploded={openFem3dVisibility.explode.amountM > 0}
        onOpenFem3DExplodeToggle={() => setOpenFem3dVisibility((visibility) => ({
          ...visibility, explode: toggleOpenFem3DExplode(visibility.explode),
        }))}
        onOpenFem3DSectionBoxToggle={() => setOpenFem3dVisibility((visibility) => ({
          ...visibility, sectionBox: openFem3DSectionBoxSchakel(visibility.sectionBox, openFem3d),
        }))}
        hasOpenFem3DNodeSelection={openFem3dSelection?.type === "node" && openFem3d.nodes.some((node) => node.id === openFem3dSelection.id)}
        hasOpenFem3DBeamSelection={openFem3dSelection?.type === "beam" && openFem3d.beams.some((beam) => beam.id === openFem3dSelection.id)}
        hasOpenFem3DPlateSelection={openFem3dSelection?.type === "plate" && (openFem3d.plates ?? []).some((plate) => plate.id === openFem3dSelection.id)}
        onOpenFem3DSupportPreset={(preset) => {
          setOpenFem3dTool(`support:${preset}`);
          applyOpenFem3DNodeToolToSelection(`support:${preset}`);
        }}
        onOpenFem3DPinBeamsToColumns={handleOpenFem3DPinBeamsToColumns}
        onOpenFem3DConnectNodes={() => handleOpenFem3DConnectNodes("selectie")}
        onOpenFem3DMergeNodes={() => handleOpenFem3DMergeNodes("selectie")}
        onOpenFem3DSpringTool={(axis) => {
          // Een gereedschap zoals de opleggingen; een geselecteerde knoop krijgt
          // de veer meteen.
          setOpenFem3dTool(`spring:${axis}`);
          applyOpenFem3DNodeToolToSelection(`spring:${axis}`);
        }}
        onOpenFem3DRequestNodalLoad={(kind) => {
          setRightPanelOpen(true);
          setOpenFem3dLoadEditorRequest((request) => ({ kind, serial: (request?.serial ?? 0) + 1 }));
        }}
        onOpenFem3DRequestMemberLoad={() => {
          setOpenFem3dTool("addMemberLoad");
          if (openFem3dSelection?.type === "beam") {
            setRightPanelOpen(true);
            setOpenFem3dMemberLoadEditorRequest((serial) => serial + 1);
          }
        }}
        onOpenFem3DRequestMemberPointLoad={() => {
          setRightPanelOpen(true);
          setOpenFem3dMemberPointLoadEditorRequest((serial) => serial + 1);
        }}
        onOpenFem3DRequestThermalLoad={() => {
          setRightPanelOpen(true);
          setOpenFem3dThermalLoadEditorRequest((serial) => serial + 1);
        }}
        onOpenFem3DConvertPlateToLoadPanel={() => {
          if (openFem3dSelection?.type !== "plate") return;
          try {
            const converted = convertOpenFem3DPlateToLoadPanels(openFem3d, openFem3dSelection.id, { caseId: fem.activeLoadCaseId });
            setOpenFem3d(converted.model);
            setOpenFem3dShowLoadCase(true);
            setOpenFem3dVisibility((value) => value.loads && value.loadPanels ? value : { ...value, loads: true, loadPanels: true });
            // Een oppervlaktelast in een ander geval wordt een vlak in dat geval:
            // toon dan dat geval, anders valt de selectie meteen weg.
            const panels = (converted.model.loadPanels ?? []).filter((panel) => converted.panelIds.includes(panel.id));
            const shown = panels.find((panel) => (panel.caseId ?? 1) === fem.activeLoadCaseId) ?? panels[0];
            if (shown && (shown.caseId ?? 1) !== fem.activeLoadCaseId) fem.setActiveLoadCaseId(shown.caseId ?? 1);
            setOpenFem3dSelection(shown ? { type: "loadPanel", id: shown.id } : null);
            setRightPanelOpen(true);
          } catch (cause) {
            meldLoadPanelFout(cause);
          }
        }}
        onOpenFem3DRequestSurfaceLoad={() => {
          if (openFem3dSelection?.type !== "plate") return;
          const next = addOpenFem3DSurfaceLoad(openFem3d, openFem3dSelection.id, { qx: 0, qy: 0, qz: -5 }, fem.activeLoadCaseId);
          setOpenFem3d(next);
          setOpenFem3dShowLoadCase(true);
          const load = next.surfaceLoads?.[Math.max(0, (next.surfaceLoads?.length ?? 1) - 1)];
          if (load) setOpenFem3dSelection({ type: "surfaceLoad", id: load.id });
          setRightPanelOpen(true);
        }}
        onSolve={handleSolveDoorGebruiker}
        hasResults={modelDimension === "3d" ? openFem3dResult !== null : solverResult !== null || fem.envelope !== null}
        onDelete={modelDimension === "3d" ? () => setOpenFem3dDeleteToken((token) => token + 1) : fem.deleteSelected}
        onUndo={() => toolbarUndoRedo("undo")}
        onRedo={() => toolbarUndoRedo("redo")}
        canUndo={modelDimension === "3d" ? openFem3dHistory.past.length > 0 : fem.canUndo}
        canRedo={modelDimension === "3d" ? openFem3dHistory.future.length > 0 : fem.canRedo}
        onOpenGrids={() => setGridsOpen(true)}
        onOpenLoadCases={() => { setLoadCasesTab("cases"); setLoadCasesOpen(true); }}
        onOpenLoadCombinations={() => { setLoadCasesTab("combos"); setLoadCasesOpen(true); }}
        onOpenWindGenerator={() => modelDimension === "3d" ? setEnvelopeLoadsOpen(true) : setWindGeneratorOpen(true)}
        onOpenWaterAccumulation={() => setWaterAccumulationOpen(true)}
        onExportHtml={handleExportHtmlReport}
        // De Rapport-tab zet met deze tekst het hoofdstuk Uitgangspunten in de
        // PDF-uitdraai. Dezelfde tekst gaat via `reportData` naar het live
        // rapport, zodat het scherm en het papier hetzelfde zeggen.
        scheefstandToelichting={scheefstandTekst}
        analyseToelichting={analyseTekst}
        windToelichting={windTekst}
        onExportIfc={() => { void handleExportIfc(false); }}
        onExportIfcStructural={() => { void handleExportIfc(true); }}
        onValidateIfc={() => { void handleValidateIfc(); }}
        onOpenIfcView={() => setActiveView("ifc")}
        onImportIfcAnalysisModel={() => { void handleImportIfcAnalyse(); }}
        onFilterSelection={() => setSelectieFilterOpen(true)}
        onShowInsightsMode={(m) => { setInsightsMode(m); setActiveView("insights"); }}
        onOpenZichtbaarheid={() => setZichtbaarheidOpen(true)}
        onOpenPrestressedBeam={() => setActiveView("prestressedBeam")}
        onOpenVolumeWorkbench={() => setActiveView("volumeWorkbench")}
        onExportMatrixCsv={async () => {
          try {
            const { exportMatricesAsCsv } = await import("./io/matrixExport");
            exportMatricesAsCsv(fem.nodes, fem.beams, fem.supports);
          } catch (e) { console.error("CSV export failed:", e); }
        }}
        onNewProject={() => { void handleNewProject(); }}
        onOpenProject={() => { void handleOpenProject(); }}
        onSaveProject={() => { void handleSaveProject(); }}
        onSaveProjectAs={() => { void handleSaveProjectAs(); }}
        tableDataset={tableDataset}
        onTableDataset={handleTableDataset}
        onTableExportCsv={() => invokeTableApi("exportCsv")}
        onTableCopy={() => invokeTableApi("copyTable")}
        onTableFocusFilter={() => invokeTableApi("focusFilter")}
      />
      <DocumentBar
        fileName={projectPath ? projectPath.split(/[\\/]/).pop() : undefined}
        modified={isDirty}
      />
      <div className="content">
        {/* Left panel — Explorer (hidden in full-width views) */}
        {(!isFullWidthView || activeView === "openFem3d") && (
          <aside className={`left-panel${leftPanelOpen ? "" : " collapsed"}${isResizing ? " no-transition" : ""}`} style={{ width: leftPanelOpen ? leftPanelWidth : 28 }}>
            {leftPanelOpen ? (
              <>
                <div className="left-panel-toolbar">
                  <span className="left-panel-title">{t("explorer")}</span>
                  <button className="left-panel-close-btn" onClick={() => setLeftPanelOpen(false)} title={t("close")}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2.5A1.5 1.5 0 013.5 1h9A1.5 1.5 0 0114 2.5v11a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 13.5v-11zM3.5 2a.5.5 0 00-.5.5v11a.5.5 0 00.5.5H6V2H3.5zM7 2v12h5.5a.5.5 0 00.5-.5v-11a.5.5 0 00-.5-.5H7z" /></svg>
                  </button>
                </div>
                <div className="left-panel-body">
                  {modelDimension === "3d" ? <OpenFem3DExplorer
                    model={openFem3d}
                    onChange={setOpenFem3d}
                    calculationModel={openFem3dCalculationModel}
                    selection={openFem3dSelection}
                    setSelection={handleOpenFem3DSelectionChange}
                    result={openFem3dShowLoadCase ? openFem3dResult : null}
                    activeTab={treeTab}
                    setActiveTab={setTreeTab}
                    visibility={openFem3dVisibility}
                    setVisibility={setOpenFem3dVisibility}
                    deformationDisplay={openFem3dDeformationDisplay}
                    setDeformationDisplay={setOpenFem3dDeformationDisplay}
                    diagramLabels={openFem3dDiagramLabels}
                    setDiagramLabels={setOpenFem3dDiagramLabels}
                    plateQuantity={openFem3dPlateQuantity}
                    setPlateQuantity={setOpenFem3dPlateQuantity}
                    displayFlags={displayFlags}
                    setDisplayFlags={setDisplayFlags}
                    gridShow={grid.show}
                    setGridShow={(show) => setGrid((current) => ({ ...current, show }))}
                    structuralGrid={fem.structuralGrid}
                    setStructuralGridEnabled={(enabled) => fem.setStructuralGrid((current) => ({ ...current, enabled }))}
                    activeLoadCaseId={fem.activeLoadCaseId}
                    activeCaseEmpty={openFem3dActiefGevalLeeg}
                    combinations={openFem3dCombinaties}
                    combinationResults={openFem3dCombinationResults}
                    activeCombinationId={openFem3dActiveCombinationId}
                    setActiveCombinationId={(id) => {
                      const result = openFem3dCombinationResults.get(id);
                      if (!result) return;
                      setOpenFem3dActiveCombinationId(id);
                      setOpenFem3dResult(result);
                      setResultsTabActive(true);
                      setTreeTab("results");
                      setOpenFem3dVisibility((value) => ({ ...value, loads: false }));
                    }}
                    views={{
                      viewSets: openFem3dViewSets,
                      onViewSetsChange: setOpenFem3dViewSets,
                      standaardUitRapport: openFem3dStandaardViewsUitRapport,
                      onStandaardUitRapportChange: setOpenFem3dStandaardViewsUitRapport,
                      status: {
                        heeftResultaat: openFem3dCaseResults.size > 0 || openFem3dCombinationResults.size > 0,
                        heeftCombinaties: openFem3dCombinationResults.size > 0,
                      },
                      visibility: openFem3dVisibility,
                      actieveSleutel: openFem3dActieveView,
                      activeCombinationId: openFem3dActiveCombinationId,
                      activeLoadCaseId: fem.activeLoadCaseId,
                      maatgevendeCombinatie: () => openFem3DMaatgevendeCombinatie(openFem3dCalculationModel, openFem3dCombinaties, openFem3dCombinationResults),
                      huidig: () => ({
                        view: openFem3dViewRequest.kind,
                        camera: openFem3dCameraSnapshot?.state ?? openFem3DStartCamera(),
                        visibility: openFem3dVisibility,
                        combinationId: openFem3dActiveCombinationId,
                        loadCaseId: fem.activeLoadCaseId,
                        mode: !openFem3dShowLoadCase ? "model" : resultsTabActive ? "results" : "loadCase",
                        diagramLabels: openFem3dDiagramLabels,
                      }),
                      onToepassen: (w) => pasOpenFem3dViewToe(w, true),
                    }}
                  /> : <FemProjectTree
                    nodes={fem.nodes}
                    beams={fem.beams}
                    supports={fem.supports}
                    plates={fem.plates}
                    loads={fem.loads}
                    loadCases={fem.loadCases}
                    activeLoadCaseId={fem.activeLoadCaseId}
                    selection={fem.selection}
                    setSelection={fem.setSelection}
                    setActiveLoadCaseId={(id) => {
                      // Selecting an LC = leave combination/envelope view, show LC's loads
                      fem.setActiveLoadCaseId(id);
                      fem.setActiveCombinationId(null);
                      fem.setEnvelopeView(false);
                      fem.setShowLoads(true);
                      setResultsTabActive(false);
                    }}
                    addLoadCase={fem.addLoadCase}
                    combinations={fem.combinations}
                    overgeslagenCombinaties={fem.overgeslagenCombinaties}
                    belastingMeldingen={fem.belastingMeldingen}
                    combinatieAfwijking={fem.combinatieAfwijking}
                    combinatieVervanging={fem.combinatieVervanging}
                    onOpenCombinaties={() => { setLoadCasesTab("combos"); setLoadCasesOpen(true); }}
                    activeCombinationId={fem.activeCombinationId}
                    setActiveCombinationId={(id) => {
                      // Picking a combination must enable the results overlay
                      // path: ensure showLoads is true and the bottom Resultaten-
                      // tab is highlighted so the user sees the change land.
                      fem.setActiveCombinationId(id);
                      if (id !== null) {
                        fem.setEnvelopeView(false);
                        fem.setShowLoads(true);
                        setResultsTabActive(true);
                        // Default all relevant overlays on so the change is visible.
                        setDisplayFlags(prev => ({ ...prev, M: true, V: true, N: true, deflection: true, reactions: true }));
                      }
                    }}
                    envelopeView={fem.envelopeView}
                    setEnvelopeView={(v) => {
                      fem.setEnvelopeView(v);
                      if (v) {
                        fem.setActiveCombinationId(null);
                        fem.setShowLoads(true);
                        setResultsTabActive(true);
                        setDisplayFlags(prev => ({ ...prev, M: true, V: true, N: true, deflection: true, reactions: true }));
                      }
                    }}
                    envelope={fem.envelope}
                    displayFlags={displayFlags}
                    setDisplayFlags={setDisplayFlags}
                    hasResults={solverResult !== null || fem.envelope !== null}
                    activeTab={treeTab}
                    setActiveTab={setTreeTab}
                    workspace={modelDimension}
                    gridShow={grid.show}
                    setGridShow={(show) => setGrid((current) => ({ ...current, show }))}
                    stramienAan={fem.structuralGrid.enabled}
                    setStramienAan={(enabled) => fem.setStructuralGrid((current) => ({ ...current, enabled }))}
                    openFem3dVisibility={openFem3dVisibility}
                    setOpenFem3DVisibility={setOpenFem3dVisibility}
                    onOpenZichtbaarheid={() => setZichtbaarheidOpen(true)}
                  />}
                </div>
                <div className="left-panel-resize" onMouseDown={handleLeftResizeMouseDown} />
              </>
            ) : (
              <button className="left-panel-collapsed-tab" onClick={() => setLeftPanelOpen(true)} title={t("explorer")}>
                <span>{t("explorer")}</span>
              </button>
            )}
          </aside>
        )}

        <main className="main-view">
          {renderMainContent()}
        </main>

        {/* Right panel — Properties (hidden in full-width views) */}
        {(!isFullWidthView || activeView === "openFem3d") && (
          <aside className={`right-panel${rightPanelOpen ? "" : " collapsed"}${isResizing ? " no-transition" : ""}`} style={{ width: rightPanelOpen ? rightPanelWidth : 28 }}>
            {rightPanelOpen ? (
              <>
                <div className="right-panel-resize" onMouseDown={handleRightResizeMouseDown} />
                <div className="right-panel-toolbar">
                  <span className="right-panel-title">{t("properties")}</span>
                  <button className="right-panel-close-btn" onClick={() => setRightPanelOpen(false)} title={t("close")}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2.5A1.5 1.5 0 013.5 1h9A1.5 1.5 0 0114 2.5v11a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 13.5v-11zM3.5 2a.5.5 0 00-.5.5v11a.5.5 0 00.5.5H9V2H3.5zM10 2v12h2.5a.5.5 0 00.5-.5v-11a.5.5 0 00-.5-.5H10z" /></svg>
                  </button>
                </div>
                <div className="right-panel-body">
                  {modelDimension === "3d" ? <OpenFem3DProperties
                    model={openFem3d}
                    selection={openFem3dSelection}
                    onChange={setOpenFem3d}
                    result={openFem3dShowLoadCase ? openFem3dResult : null}
                    loadEditorRequest={openFem3dLoadEditorRequest}
                    springEditorRequest={openFem3dSpringEditorRequest}
                    memberLoadEditorRequest={openFem3dMemberLoadEditorRequest}
                    memberPointLoadEditorRequest={openFem3dMemberPointLoadEditorRequest}
                    thermalLoadEditorRequest={openFem3dThermalLoadEditorRequest}
                    activeLoadCaseId={fem.activeLoadCaseId}
                    onPickLoadPanelSpan={(panelId) => {
                      setOpenFem3dSpanPick({ panelId, firstNodeId: null });
                      setOpenFem3dTool("loadPanelSpan");
                    }}
                    loadPanelSpanPickActive={openFem3dTool === "loadPanelSpan"}
                    loadCaseOptions={fem.loadCases.filter((loadCase) => loadCase.eigenGewicht !== true)
                      .map((loadCase) => ({ id: loadCase.id, name: loadCase.name }))}
                    levels={fem.structuralGrid.zAxes}
                  /> : <>
                  <FemProperties
                    selection={fem.selection}
                    nodes={fem.nodes}
                    beams={fem.beams}
                    plates={fem.plates}
                    supports={fem.supports}
                    loads={fem.loads}
                    updateNode={fem.updateNode}
                    updateBeam={fem.updateBeam}
                    updateBeams={fem.updateBeams}
                    updatePlate={fem.updatePlate}
                    addSupport={fem.addSupport}
                    removeSupport={fem.removeSupport}
                    updateLoad={fem.updateLoad}
                    pendingLoadFocus={fem.pendingLoadFocus}
                    clearPendingLoadFocus={() => fem.setPendingLoadFocus(null)}
                    results={solverResult}
                  /></>}
                </div>
              </>
            ) : (
              <button className="right-panel-collapsed-tab" onClick={() => setRightPanelOpen(true)} title={t("properties")}>
                <span>{t("properties")}</span>
              </button>
            )}
          </aside>
        )}
      </div>


      {/* In 3D blijft dezelfde belastinggevallenstrook zichtbaar, met het
          analysetype en de scheefstand. De 2D-specifieke opties voor eigen
          gewicht en de betonparameters worden daar niet getoond. */}
      {(!isFullWidthView || activeView === "openFem3d") && (modelDimension === "3d" ? (
        <LoadCaseTabBar
          loadCases={fem.loadCases}
          activeLoadCaseId={fem.activeLoadCaseId}
          setActiveLoadCaseId={(id) => {
            fem.setActiveLoadCaseId(id);
            setOpenFem3dShowLoadCase(true);
            setResultsTabActive(false);
            setTreeTab("project");
          }}
          addLoadCase={fem.addLoadCase}
          loads={[
            ...(openFem3dCalculationModel.loads ?? []).map((load) => ({ id: load.id, type: "pointForce" as const, caseId: load.caseId ?? 1 })),
            ...(openFem3dCalculationModel.memberLoads ?? []).map((load) => ({ id: load.id, type: "lineLoad" as const, caseId: load.caseId ?? 1 })),
            ...(openFem3dCalculationModel.memberPointLoads ?? []).map((load) => ({ id: load.id, type: "pointForce" as const, caseId: load.caseId ?? 1 })),
            ...(openFem3dCalculationModel.thermalLoads ?? []).map((load) => ({ id: load.id, type: "thermal" as const, caseId: load.caseId ?? 1 })),
            ...(openFem3dCalculationModel.surfaceLoads ?? []).map((load) => ({ caseId: load.caseId ?? 1 })),
            // Een belastingvlak is een last in zijn geval, ook al wordt hij pas
            // bij het rekenen omgezet: anders meldt de tab "0 belastingen".
            ...(openFem3dCalculationModel.loadPanels ?? []).map((panel) => ({ caseId: panel.caseId ?? 1 })),
          ]}
          showLoads={openFem3dShowLoadCase}
          setShowLoads={(showLoadCase) => {
            setOpenFem3dShowLoadCase(showLoadCase);
            if (!showLoadCase) {
              setResultsTabActive(false);
              setTreeTab("project");
            }
          }}
          hasResults={openFem3dResult !== null}
          resultsActive={resultsTabActive}
          onShowResults={() => {
            setResultsTabActive(true);
            setTreeTab("results");
            setOpenFem3dShowLoadCase(true);
          }}
          // 1e of 2e orde (P-Δ) en de initiële scheefstand werken ook in 3D. De
          // primaire richting van 2D ontbreekt bewust: 3D rekent ±X en ±Y.
          analysetype={fem.analysetype}
          setAnalysetype={fem.setAnalysetype}
          scheefstandEnabled={fem.scheefstandEnabled}
          setScheefstandEnabled={fem.setScheefstandEnabled}
          scheefstandNoemer={fem.scheefstandNoemer}
          setScheefstandNoemer={fem.setScheefstandNoemer}
          scheefstandBron={fem.scheefstandBron}
          setScheefstandBron={fem.setScheefstandBron}
          scheefstandHoogteM={fem.scheefstandHoogteM}
          setScheefstandHoogteM={fem.setScheefstandHoogteM}
          scheefstandAantalElementen={fem.scheefstandAantalElementen}
          setScheefstandAantalElementen={fem.setScheefstandAantalElementen}
          // Issue #212 (alleen 3D): m per richting en de torsievarianten van 5.3.2(10).
          scheefstandAantalX={fem.scheefstandAantalX}
          setScheefstandAantalX={fem.setScheefstandAantalX}
          scheefstandAantalY={fem.scheefstandAantalY}
          setScheefstandAantalY={fem.setScheefstandAantalY}
          scheefstandTorsie={fem.scheefstandTorsie}
          setScheefstandTorsie={fem.setScheefstandTorsie}
          scheefstandEigenKolom={fem.scheefstandEigenKolom}
          setScheefstandEigenKolom={fem.setScheefstandEigenKolom}
          // φ_X en φ_Y, m_X en m_Y (issue #194): de balk toont beide richtingen.
          scheefstandPhiNoemer={scheefstandBalk.noemer}
          scheefstandPhiNoemerY={scheefstandBalk.noemerY}
          scheefstandAfgeleideHoogteM={scheefstandBalk.hoogteM}
          scheefstandAfgeleidAantal={scheefstandBalk.aantal}
          scheefstandAfgeleidAantalY={scheefstandBalk.aantalY}
          scheefstandToelichting={scheefstandBalk.toelichting(t)}
          scheefstandWaarschuwingen={scheefstandBalk.waarschuwingen}
          scheefstandIn3D
          // Trek-alleen staven: montage na de permanente belasting en de
          // kruisregel zijn modelinstellingen van het 3D-model (ongedaan te maken).
          {...(openFem3d.beams.some((beam) => beam.tensionOnly) ? {
            trekAlleenMontage: openFem3d.tensionOnlyFitAfterPermanent === true,
            setTrekAlleenMontage: (on: boolean) =>
              setOpenFem3d(setOpenFem3DTensionOnlySetting(openFem3d, "tensionOnlyFitAfterPermanent", on)),
            kruisregel: openFem3d.tensionOnlyCrossRule === true,
            setKruisregel: (on: boolean) =>
              setOpenFem3d(setOpenFem3DTensionOnlySetting(openFem3d, "tensionOnlyCrossRule", on)),
          } : {})}
        />
      ) : (
        <LoadCaseTabBar
          loadCases={fem.loadCases}
          activeLoadCaseId={fem.activeLoadCaseId}
          setActiveLoadCaseId={(id) => { fem.setActiveLoadCaseId(id); setResultsTabActive(false); }}
          addLoadCase={fem.addLoadCase}
          loads={fem.loads}
          selfWeightEnabled={fem.selfWeightEnabled}
          setSelfWeightEnabled={fem.setSelfWeightEnabled}
          eigenGewicht={eigenGewicht}
          onVerplaatsEigenGewicht={biedEigenGewichtGevalAan ? handleVerplaatsEigenGewicht : undefined}
          analysetype={fem.analysetype}
          setAnalysetype={fem.setAnalysetype}
          axialMaterialLoadPath={fem.axialMaterialLoadPath}
          setAxialMaterialLoadPath={fem.setAxialMaterialLoadPath}
          scheefstandEnabled={fem.scheefstandEnabled}
          setScheefstandEnabled={fem.setScheefstandEnabled}
          scheefstandNoemer={fem.scheefstandNoemer}
          setScheefstandNoemer={fem.setScheefstandNoemer}
          scheefstandRichting={fem.scheefstandRichting}
          setScheefstandRichting={fem.setScheefstandRichting}
          scheefstandBron={fem.scheefstandBron}
          setScheefstandBron={fem.setScheefstandBron}
          scheefstandHoogteM={fem.scheefstandHoogteM}
          setScheefstandHoogteM={fem.setScheefstandHoogteM}
          scheefstandAantalElementen={fem.scheefstandAantalElementen}
          setScheefstandAantalElementen={fem.setScheefstandAantalElementen}
          // Issue #212 (alleen 3D): m per richting en de torsievarianten van 5.3.2(10).
          scheefstandAantalX={fem.scheefstandAantalX}
          setScheefstandAantalX={fem.setScheefstandAantalX}
          scheefstandAantalY={fem.scheefstandAantalY}
          setScheefstandAantalY={fem.setScheefstandAantalY}
          scheefstandTorsie={fem.scheefstandTorsie}
          setScheefstandTorsie={fem.setScheefstandTorsie}
          scheefstandEigenKolom={fem.scheefstandEigenKolom}
          setScheefstandEigenKolom={fem.setScheefstandEigenKolom}
          // De uitkomst en de afleiding gaan als GEGEVEN mee naar de balk: de
          // balk toont wat er is gerekend en rekent niets zelf, zodat er geen
          // tweede plek is waar φ kan ontstaan.
          scheefstandPhiNoemer={scheefstandBalk.noemer}
          scheefstandAfgeleideHoogteM={scheefstandBalk.hoogteM}
          scheefstandAfgeleidAantal={scheefstandBalk.aantal}
          // De balk toont de afleiding ook wanneer de schakelaar uit staat —
          // daar is zij een vooruitblik op wat aanzetten zou opleveren. Het
          // rapport krijgt `scheefstandTekst`, die dan juist leeg is.
          scheefstandToelichting={
            // In de taal van de interface; het rapport krijgt de Nederlandse
            // `scheefstandTekst` (issue #33).
            scheefstandBalk.toelichting(t)
          }
          scheefstandWaarschuwingen={scheefstandBalk.waarschuwingen}
          showLoads={fem.showLoads}
          setShowLoads={(v) => {
            fem.setShowLoads(v);
            setResultsTabActive(false);
            // Terug naar de tab Model: de resultaten sluiten (diagrammen,
            // reacties, UC). De tab Resultaten zet ze weer aan.
            if (!v) {
              setDisplayFlags(zonderResultaten);
              // De verkenner terug naar het project; de tab Resultaten zet hem
              // weer op de resultaten.
              setTreeTab("project");
            }
          }}
          hasResults={solverResult !== null || fem.envelope !== null}
          resultsActive={resultsTabActive}
          onShowResults={() => {
            setResultsTabActive(true);
            setTreeTab("results");
            fem.setShowLoads(true);
            // Zelfde lagen als Berekenen, zodat Model → Resultaten alles terugzet.
            setDisplayFlags(prev => ({
              ...prev,
              M: true, V: true, N: true,
              deflection: true,
              reactions: true,
            }));
          }}
        />
      ))}
      <StatusBar
        nodeCount={modelDimension === "3d" ? openFem3d.nodes.length : fem.nodes.length}
        beamCount={modelDimension === "3d" ? openFem3d.beams.length : fem.beams.length}
        loadCount={modelDimension === "3d"
          ? (openFem3d.loads ?? []).length + (openFem3d.memberLoads ?? []).length +
            (openFem3d.memberPointLoads ?? []).length + (openFem3d.thermalLoads ?? []).length +
            (openFem3d.loadPanels ?? []).length +
            (openFem3d.supports ?? []).filter((support) => Object.keys(support.prescribed ?? {}).length > 0).length
          : fem.loads.length}
        zoomPct={activeView === "default" ? zoomPct : undefined}
        solverStatus={solverStatus}
        // Snapknopjes horen bij de tekenweergave; in de rapport-/IFC-weergave
        // valt er niets te snappen. Het 3D-tekenvlak telt als volle breedte,
        // maar tekent wel: daar ook, met het objectspoor erbij (#84).
        toonSnap={(!isFullWidthView && modelDimension === "2d") || activeView === "openFem3d"}
        snapSchakelaars={activeView === "openFem3d" ? SNAP_SCHAKELAARS_3D : SNAP_SOORTEN}
        bedieningActief={bedieningActief}
      />
      <Backstage
        open={backstageOpen}
        onClose={() => setBackstageOpen(false)}
        onOpenSettings={() => openSettings()}
        onOpenFile={(path) => { void handleOpenFilePath(path); }}
        onNew={() => { void handleNewProject(); }}
        onOpen={() => { void handleOpenProject(); }}
        onSave={() => { void handleSaveProject(); }}
        onSaveAs={() => { void handleSaveProjectAs(); }}
        onImportIfcAnalysisModel={() => { void handleImportIfcAnalyse(); }}
        onOpenSteelHall={() => setStaalhalOpen(true)}
        onExportPdf={() => setActiveView("report")}
        onExportHtml={() => { void handleExportHtmlReport(); }}
        onExportIfc={() => { void handleExportIfc(false); }}
        onExportIfcStructural={() => { void handleExportIfc(true); }}
        onExportIfcResults={() => { void handleExportIfcResultaten(); }}
      />
      <LoadCasesDialog
        open={loadCasesOpen}
        onClose={() => setLoadCasesOpen(false)}
        initialTab={loadCasesTab}
        loadCases={fem.loadCases}
        combinations={fem.combinations}
        overgeslagenCombinaties={fem.overgeslagenCombinaties}
        belastingMeldingen={fem.belastingMeldingen}
        combinatieAfwijking={fem.combinatieAfwijking}
        combinatieVervanging={fem.combinatieVervanging}
        onMaakVervangingOngedaan={fem.maakCombinatieVervangingOngedaan}
        onVervangDoorStandaard={fem.vervangDoorStandaardCombinaties}
        onSluitAfwijking={fem.sluitCombinatieAfwijking}
        onBevestigEigenFactoren={fem.bevestigEigenFactoren}
        onTrekBevestigingIn={fem.trekBevestigingEigenFactorenIn}
        onWindOpnieuw={() => { setLoadCasesOpen(false); setWindGeneratorOpen(true); }}
        gevolgklasse={fem.gevolgklasse}
        bijlage={fem.combinatieBijlage}
        addLoadCase={fem.addLoadCase}
        updateLoadCase={fem.updateLoadCase}
        removeLoadCase={modelDimension === "3d" ? verwijderBelastinggeval3D : fem.removeLoadCase}
        addCombination={fem.addCombination}
        updateCombination={fem.updateCombination}
        removeCombination={fem.removeCombination}
      />
      <ZichtbaarheidVenster
        open={zichtbaarheidOpen}
        onClose={() => setZichtbaarheidOpen(false)}
        displayFlags={displayFlags}
        setDisplayFlags={setDisplayFlags}
        stramienAan={fem.structuralGrid.enabled}
        setStramienAan={(aan) => fem.setStructuralGrid(prev => ({ ...prev, enabled: aan }))}
        hasPlates={fem.plates.length > 0}
      />
      {/* Selectiefilter (issue #94): op de selectie, of zonder selectie op het hele model. */}
      {modelDimension === "3d" ? (
        <SelectieFilterVenster3D
          open={selectieFilterOpen}
          onClose={() => setSelectieFilterOpen(false)}
          model={openFem3d}
          levels={fem.structuralGrid.zAxes}
          loadCases={fem.loadCases}
          selection={openFem3dSelection}
          onSelect={(next) => zetGefilterdeSelectie3D(next)}
        />
      ) : (
        <SelectieFilterVenster2D
          open={selectieFilterOpen}
          onClose={() => setSelectieFilterOpen(false)}
          model={selectieFilterModel2D}
          loadCases={fem.loadCases}
          selection={fem.selection}
          onSelect={(next, ids) => zetGefilterdeSelectie2D(next, ids)}
        />
      )}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} onThemeChange={setTheme} initialTab={settingsTab} />
      <SneltoetsenDialog open={sneltoetsenOpen} onClose={() => setSneltoetsenOpen(false)} />
      <OnopgeslagenDialog
        open={onopgeslagenOpen}
        naam={projectPath ? projectPath.split(/[\\/]/).pop() : undefined}
        onKeuze={(k) => {
          setOnopgeslagenOpen(false);
          onopgeslagenResolveRef.current?.(k);
          onopgeslagenResolveRef.current = null;
        }}
      />
      <LibraryDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} initialTab={libraryTab} />
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <ProjectSettingsDialog open={projectSettingsOpen} onClose={() => setProjectSettingsOpen(false)} />
      {/* Windbelastinggenerator (EN 1991-1-4 + NL NB) — invoer, controleerbare
          samenvatting en het wegschrijven van gevallen/lasten/combinaties. */}
      <WindGeneratorDialog
        open={windGeneratorOpen}
        onClose={() => setWindGeneratorOpen(false)}
        wind={windGenerator}
      />
      <OpenFem3DEnvelopeLoadsDialog
        open={envelopeLoadsOpen}
        model={openFem3d}
        projectInfo={projectInfo}
        onClose={() => setEnvelopeLoadsOpen(false)}
        onGenerate={async (input: EnvelopeLoadInput) => {
          const answer = await voerApiUitInApp(apiActies, "model3d.envelope.generateLoads", input);
          if (!answer.ok) throw new Error(answer.error.melding);
        }}
      />
      <WaterAccumulation2DDialog open={waterAccumulationOpen}
        onClose={() => setWaterAccumulationOpen(false)} selectedBeam={selectedWaterBeam} />
      {welcomeOpen && (
        <WelcomeScreen
          onClose={() => setWelcomeOpen(false)}
          onNewProject={() => { void handleNewProject(); }}
          onOpenProject={() => { void handleOpenProject(); }}
          onOpenFile={(path) => { void handleOpenFilePath(path); }}
          onSteelHall={() => setStaalhalOpen(true)}
        />
      )}
      <StaalhalWizard open={staalhalOpen} onClose={() => setStaalhalOpen(false)}
        windCodeId={windCodeIdFromProjectInfo(projectInfo)} onMaken={handleStaalhalMaken} />
      {ifcImportStroom.dialogen}
      {/* Venster "Stramienen en levels" — rechts gedockt: achtergrondraster, stramienassen en levels */}
      {(!isFullWidthView || modelDimension === "3d") && (
        <Sheet open={gridsOpen} title={tRibbon("home.grids")} onClose={() => { setGridsOpen(false); setGridLevelError(null); }}>
          <div className="oa-grid-form">
            <div className="oa-grid-section-title">{t("app.grid.backgroundGrid")}</div>
            <label className="oa-grid-row">
              <span>{t("app.grid.showGrid")}</span>
              <input type="checkbox" checked={modelDimension === "3d" ? openFem3dVisibility.grid : grid.show}
                onChange={e => modelDimension === "3d"
                  ? setOpenFem3dVisibility(v => ({ ...v, grid: e.target.checked }))
                  : setGrid(g => ({ ...g, show: e.target.checked }))} />
            </label>
            {modelDimension === "2d" && (
              <label className="oa-grid-row">
                <span>{t("app.grid.showGridLines")}</span>
                <input type="checkbox" checked={grid.showLines}
                  onChange={e => setGrid(g => ({ ...g, showLines: e.target.checked }))} />
              </label>
            )}
            <label className="oa-grid-row">
              <span>{t("app.grid.spacing")}</span>
              <input type="number" step="50" min="50" value={grid.spacingMm}
                onChange={e => {
                  const v = Math.max(50, Number(e.target.value) || 500);
                  setGrid(g => ({ ...g, spacingMm: v }));
                }} />
            </label>

            <div className="oa-grid-section-title" style={{ marginTop: 14 }}>{t("app.grid.structural")}</div>
            <label className="oa-grid-row">
              <span>{t("app.grid.enabled")}</span>
              <input type="checkbox" checked={fem.structuralGrid.enabled}
                onChange={e => fem.setStructuralGrid(prev => ({ ...prev, enabled: e.target.checked }))} />
            </label>

            {/* Stramienassen: X, en in 3D ook Y. Posities in mm, bevestigen met
                Enter of door het veld te verlaten. */}
            <div className="oa-grid-subtitle oa-grid-group-title">{t("app.grid.axesTitle")}</div>
            <div className="oa-grid-subtitle">{t("app.grid.xAxis")}</div>
            <table className="oa-grid-table">
              <thead><tr><th>{t("app.grid.label")}</th><th>X (mm)</th><th></th></tr></thead>
              <tbody>
                {fem.structuralGrid.xAxes.map((ax, i) => (
                  <tr key={ax.id}>
                    <td><input type="text" value={ax.label}
                      onChange={e => fem.setStructuralGrid(p => ({ ...p, xAxes: p.xAxes.map((a, j) => j === i ? { ...a, label: e.target.value } : a) }))} /></td>
                    <td><LengthInput required min={-Infinity} value={ax.position}
                      onChange={mm => { if (mm !== undefined) fem.setStructuralGrid(p => ({ ...p, xAxes: p.xAxes.map((a, j) => j === i ? { ...a, position: mm } : a) })); }} /></td>
                    <td><button className="oa-grid-x-btn"
                      onClick={() => fem.setStructuralGrid(p => ({ ...p, xAxes: p.xAxes.filter((_, j) => j !== i) }))}
                      title={t("delete")}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="oa-grid-add-btn"
              onClick={() => fem.setStructuralGrid(p => {
                const used = new Set(p.xAxes.map(a => a.label));
                let lbl = "";
                for (let k = 0; k < 26; k++) {
                  const l = String.fromCharCode(65 + k);
                  if (!used.has(l)) { lbl = l; break; }
                }
                const maxPos = p.xAxes.length ? Math.max(...p.xAxes.map(a => a.position)) : 0;
                return { ...p, xAxes: [...p.xAxes, { id: `x-${Date.now()}`, label: lbl || `X${p.xAxes.length + 1}`, position: maxPos + 3000 }] };
              })}
            >{t("app.grid.add")}</button>

            {modelDimension === "3d" && <>
              <div className="oa-grid-subtitle">{t("app.grid.yAxis")}</div>
              <table className="oa-grid-table">
                <thead><tr><th>{t("app.grid.label")}</th><th>Y (mm)</th><th></th></tr></thead>
                <tbody>
                  {(fem.structuralGrid.yAxes ?? []).map((ax, i) => (
                    <tr key={ax.id}>
                      <td><input type="text" value={ax.label}
                        onChange={e => fem.setStructuralGrid(p => ({ ...p, yAxes: (p.yAxes ?? []).map((a, j) => j === i ? { ...a, label: e.target.value } : a) }))} /></td>
                      <td><LengthInput required min={-Infinity} value={ax.position}
                        onChange={mm => { if (mm !== undefined) fem.setStructuralGrid(p => ({ ...p, yAxes: (p.yAxes ?? []).map((a, j) => j === i ? { ...a, position: mm } : a) })); }} /></td>
                      <td><button className="oa-grid-x-btn"
                        onClick={() => fem.setStructuralGrid(p => ({ ...p, yAxes: (p.yAxes ?? []).filter((_, j) => j !== i) }))}
                        title={t("delete")}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="oa-grid-add-btn"
                onClick={() => fem.setStructuralGrid(p => {
                  const axes = p.yAxes ?? [];
                  const used = new Set(axes.map(a => a.label));
                  let lbl = "";
                  for (let k = 1; k <= 99; k++) if (!used.has(String(k))) { lbl = String(k); break; }
                  const maxPos = axes.length ? Math.max(...axes.map(a => a.position)) : 0;
                  return { ...p, yAxes: [...axes, { id: `y-${Date.now()}`, label: lbl || `Y${axes.length + 1}`, position: maxPos + 3000 }] };
                })}
              >{t("app.grid.add")}</button>
            </>}

            {/* Levels: de horizontale stramienassen, elk met een naam en een
                hoogte in mm (Peil 0 = 0, 1e verdieping = 3000). In 3D nemen
                hoogte, toevoegen en verwijderen de gekoppelde knopen en platen
                mee als één stap ongedaan maken (commitLevels); een naam wijzigen
                is net als bij de stramienassen geen stap. */}
            <div className="oa-grid-subtitle oa-grid-group-title">{t("app.grid.levels")}</div>
            <p className="oa-grid-hint">{t("app.grid.levelsHint")}</p>
            <table className="oa-grid-table" data-grid-levels="">
              <thead><tr><th>{t("app.grid.levelName")}</th><th>{t("app.grid.levelHeight")}</th><th></th></tr></thead>
              <tbody>
                {fem.structuralGrid.zAxes.map((ax, i) => (
                  <tr key={ax.id}>
                    <td><input type="text" value={ax.label}
                      onChange={e => fem.setStructuralGrid(p => ({ ...p, zAxes: p.zAxes.map((a, j) => j === i ? { ...a, label: e.target.value } : a) }))} /></td>
                    <td><LengthInput key={`${ax.id}:${gridLevelRevision}`} required min={-Infinity} value={ax.position}
                      onChange={mm => {
                        if (mm !== undefined) changeGridLevels(fem.structuralGrid.zAxes.map((a, j) => j === i ? { ...a, position: mm } : a));
                      }} /></td>
                    <td><button className="oa-grid-x-btn"
                      onClick={() => changeGridLevels(fem.structuralGrid.zAxes.filter((_, j) => j !== i))}
                      title={t("delete")}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="oa-grid-add-btn"
              onClick={() => {
                const levels = fem.structuralGrid.zAxes;
                const used = new Set(levels.map(a => a.label));
                let lbl = "";
                for (let k = 1; k <= 99; k++) {
                  const l = String(k);
                  if (!used.has(l)) { lbl = l; break; }
                }
                const maxPos = levels.length ? Math.max(...levels.map(a => a.position)) : 0;
                changeGridLevels([...levels, { id: `z-${Date.now()}`, label: lbl || `Z${levels.length + 1}`, position: maxPos + 3000 }]);
              }}
            >{t("app.grid.addLevel")}</button>
            {gridLevelError && <p className="oa-grid-error" role="alert">{gridLevelError}</p>}

            {/* Afronden — het paneel blijft anders openstaan zolang je het
                niet met het kruisje of Escape wegklikt, en dat leest als "de
                stramienmodus staat nog aan". Elke wijziging hierboven is al
                doorgevoerd; deze knop sluit alleen het paneel. */}
            <div className="oa-grid-afronden">
              <span className="oa-grid-afronden-hint">
                {t("app.grid.appliedHint")}
              </span>
              <button
                className="oa-grid-done-btn"
                onClick={() => { setGridsOpen(false); setGridLevelError(null); }}
                title={t("app.grid.finishTitle")}
              >{t("app.grid.finish")}</button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}

// @ts-expect-error — kept for future use (collapsible accordion primitive)
function PanelSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel-section">
      <button className="panel-section-header" onClick={() => setOpen(!open)}>
        <svg className={`panel-section-chevron${open ? " open" : ""}`} width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,3 5,6 8,3" /></svg>
        <span className="panel-section-title">{title}</span>
      </button>
      {open && <div className="panel-section-body">{children}</div>}
    </div>
  );
}

export default App;

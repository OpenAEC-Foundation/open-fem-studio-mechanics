// Prestatiegrens van het 2D-tekenvlak (klacht "tekenvlak traag/lagt").
//
// Oorzaak die deze test bewaakt: `verborgenLijnlastLabels` (lib/lijnlastLabels,
// sinds 65997477) vergeleek per render ALLE paren lasten met dezelfde waarde en
// kopieerde de groep bij elke toevoeging. FemCanvas riep hem ongememoïseerd aan,
// dus bij elke muisbeweging (hover, kader, slepen). Met 600 gelijke vloerlasten
// kostte dat ~25 ms per frame, met 2400 meer dan een seconde. Daarnaast bouwde
// LibraryDialog bij elke render van App (bijv. elke zoomstap) de volledige
// profieltabel op, ook als hij dicht was (~100 ms per stap). En de
// modelcontrole (`zoekKnopenOpStaaf`, bij elke modelwijziging) was
// O(staven × knopen²): bij 4840 staven ~36 s per wijziging.
//
// Drie lagen, met ruime marges zodat een drukke machine de test niet laat vallen:
//   [1] de functie zelf: lineair (2400 gelijke lasten ruim onder 150 ms; de
//       oude versie had daar > 1 s voor) en dezelfde uitkomst op een keten;
//   [2] zoekKnopenOpStaaf: dezelfde bevinding, en 4840 staven ruim onder 1 s;
//   [3] een volledige render van het echte FemCanvas (react-dom/server) met
//       4840 staven en 2400 lijnlasten blijft onder een ruime grens;
//   [4] de bron: FemCanvas memoïseert de labels en de stapeling, en
//       LibraryDialog bouwt niets op als hij dicht is.
import { build } from "esbuild";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
let geslaagd = 0, gefaald = 0;
const log = (s) => console.log(s);
const check = (naam, ok, detail = "") => {
  if (ok) { geslaagd++; log(`  ✓ ${naam}${detail ? " — " + detail : ""}`); }
  else { gefaald++; log(`  ✗ ${naam}${detail ? " — " + detail : ""}`); }
};

/** Portaal van `velden` × `lagen`: kolommen, liggers met elk q = −5 kN/m (geval 1). */
function raamwerk(velden, lagen) {
  const nodes = [], beams = [], loads = [], supports = [];
  const id = (i, j) => j * (velden + 1) + i + 1;
  for (let j = 0; j <= lagen; j++) for (let i = 0; i <= velden; i++) nodes.push({ id: id(i, j), x: i * 1000, z: j * 700 });
  let b = 0, l = 0;
  for (let j = 0; j < lagen; j++) for (let i = 0; i <= velden; i++) {
    beams.push({ id: ++b, from: id(i, j), to: id(i, j + 1), material: "S235", profile: "HEA200" });
  }
  for (let j = 1; j <= lagen; j++) for (let i = 0; i < velden; i++) {
    beams.push({ id: ++b, from: id(i, j), to: id(i + 1, j), material: "S235", profile: "IPE300" });
    loads.push({ id: ++l, type: "lineLoad", caseId: 1, beamId: b, q: -5 });
  }
  for (let i = 0; i <= velden; i++) supports.push({ nodeId: id(i, 0), type: "pinned" });
  return { nodes, beams, loads, supports };
}
const tijd = (fn, keer = 3) => {
  let best = Infinity, uit;
  for (let k = 0; k < keer; k++) { const t = performance.now(); uit = fn(); best = Math.min(best, performance.now() - t); }
  return { ms: best, uit };
};

log("[1] verborgenLijnlastLabels is lineair");
const { verborgenLijnlastLabels } = await import("./src/lib/lijnlastLabels.ts");
{
  // Ligger in drie stukken op één lijn + een losse ligger elders: alleen de
  // middelste van de drie houdt zijn label (gedrag ongewijzigd).
  const knopen = [{ id: 1, x: 0, z: 0 }, { id: 2, x: 1000, z: 0 }, { id: 3, x: 2000, z: 0 },
    { id: 4, x: 3000, z: 0 }, { id: 5, x: 0, z: 5000 }, { id: 6, x: 3000, z: 5000 }];
  const staven = [{ id: 1, from: 1, to: 2 }, { id: 2, from: 2, to: 3 }, { id: 3, from: 3, to: 4 }, { id: 4, from: 5, to: 6 }];
  const last = (id, beamId) => ({ id, beamId, caseId: 1, q: -5, trapezium: false, qDir: "z", qCoord: "global", startFrac: 0, endFrac: 1, stapelOffset: 0 });
  const v = verborgenLijnlastLabels([last(11, 3), last(12, 1), last(13, 2), last(14, 4)], staven, knopen);
  check("keten van drie: de buitenste twee verborgen, de middelste en de losse ligger houden hun label",
    v.size === 2 && v.has(11) && v.has(12) && !v.has(13) && !v.has(14), JSON.stringify([...v]));
}
{
  const m = raamwerk(60, 40); // 2400 gelijke lijnlasten in één groep
  const invoer = m.loads.map((l) => ({ id: l.id, beamId: l.beamId, caseId: 1, q: -5, trapezium: false,
    qDir: "z", qCoord: "global", startFrac: 0, endFrac: 1, stapelOffset: 0 }));
  const { ms, uit } = tijd(() => verborgenLijnlastLabels(invoer, m.beams, m.nodes));
  // Per laag één keten van 60 liggers: alles op één label per laag na verborgen.
  check("2400 gelijke lasten: 40 lagen × 59 verborgen labels", uit.size === 40 * 59, String(uit.size));
  check("2400 gelijke lasten binnen 150 ms (oude O(n²)-versie: > 1 s)", ms < 150, `${ms.toFixed(1)} ms`);
}

log("\n[2] zoekKnopenOpStaaf zonder kubische kosten");
const { zoekKnopenOpStaaf } = await import("./src/lib/modelControle.ts");
{
  const m = raamwerk(60, 40);
  // Eén losse knoop 2 mm naast het midden van de eerste ligger van laag 1.
  const ligger = m.beams.find((b) => b.id === (60 + 1) * 40 + 1);
  const [a, c] = [ligger.from, ligger.to].map((id) => m.nodes.find((n) => n.id === id));
  const model = { ...m, nodes: [...m.nodes, { id: 99999, x: (a.x + c.x) / 2, z: a.z + 2 }], plates: [] };
  const { ms, uit } = tijd(() => zoekKnopenOpStaaf(model, 5), 2);
  check("de losse knoop op de ligger wordt gevonden, verder niets",
    uit.length === 1 && uit[0].beamId === ligger.id && uit[0].nodeIds[0] === 99999, JSON.stringify(uit.map((b) => [b.beamId, b.nodeIds])));
  check(`${m.beams.length} staven × ${model.nodes.length} knopen binnen 1000 ms (oude versie: ~36 s)`, ms < 1000, `${ms.toFixed(0)} ms`);
}

log("\n[3] volledige render van het echte FemCanvas");
const map = mkdtempSync(join(tmpdir(), "tekenvlak-prestatie-"));
try {
  const uitvoer = join(map, "canvas.mjs");
  await build({
    absWorkingDir: HIER, bundle: true, format: "esm", platform: "node", jsx: "automatic",
    stdin: {
      contents: `
        import { renderToString } from "react-dom/server";
        import { createElement } from "react";
        import FemCanvas from "./src/components/fem/FemCanvas";
        export const render = (props) => renderToString(createElement(FemCanvas, props));`,
      resolveDir: HIER, loader: "tsx",
    },
    outfile: uitvoer, logLevel: "error",
    // react-dom/server (CommonJS) vraagt Node-modules op met require.
    banner: { js: 'import { createRequire as __maakRequire } from "node:module"; const require = __maakRequire(import.meta.url);' },
    define: { "process.env.NODE_ENV": '"production"' },
    loader: { ".css": "empty", ".svg": "dataurl", ".png": "dataurl", ".woff": "dataurl", ".woff2": "dataurl", ".ttf": "dataurl" },
    // Niet-uitgevoerde Node-tak van triangle-wasm, zoals Vite hem externaliseert.
    external: ["fs", "path"],
  });
  const { render } = await import(pathToFileURL(uitvoer).href);
  const m = raamwerk(60, 40);
  const niets = () => {};
  const props = {
    tool: "select", nodes: m.nodes, beams: m.beams, supports: m.supports, plates: [], loads: m.loads,
    selection: null, activeLoadCaseId: 1, setSelection: niets, addNode: () => 0, updateNode: niets,
    addBeam: () => null, addPlate: () => 0, addSupport: niets, addLoad: niets, deleteSelected: niets,
    splitBeamAt: niets, translateSelection: () => false, copySelection: () => false,
    rotateSelection: () => false, mirrorSelection: () => false,
    grid: { show: true, showLines: true, spacingMm: 500 }, showLoads: true,
  };
  const { ms, uit } = tijd(() => render(props), 1);
  const lijnlasten = (uit.match(/fem-lineload-group/g) ?? []).length;
  check(`${m.beams.length} staven en ${m.loads.length} lijnlasten worden getekend`, lijnlasten === m.loads.length, `${lijnlasten} lastgroepen`);
  // Ruime grens: vóór deze reparatie > 40 s (modelcontrole ~36 s, labels > 1 s),
  // erna ~5 s, waarvan het meeste de kipsteunweergave (doorgaande lijnen).
  check("één volledige render binnen 15 s", ms < 15000, `${ms.toFixed(0)} ms`);
} finally {
  rmSync(map, { recursive: true, force: true });
}

log("\n[4] bron: geen zware herberekening per muisbeweging");
const canvas = readFileSync(join(HIER, "src", "components", "fem", "FemCanvas.tsx"), "utf8");
check("FemCanvas memoïseert de verborgen lijnlastlabels",
  /const verborgenLabels = useMemo\(\(\) => verborgenLijnlastLabels\(/.test(canvas));
check("FemCanvas memoïseert de stapeling van lijnlasten en de actieve lasten",
  /const qStapel = useMemo\(/.test(canvas) && /const activeLoads = useMemo\(/.test(canvas));
const bibliotheek = readFileSync(join(HIER, "src", "components", "settings", "LibraryDialog.tsx"), "utf8");
check("LibraryDialog bouwt zijn profieltabel niet op als hij dicht is", /\n  if \(!open\) return null;\n/.test(bibliotheek));

log(`\n${geslaagd} geslaagd, ${gefaald} gefaald`);
if (gefaald > 0) process.exit(1);

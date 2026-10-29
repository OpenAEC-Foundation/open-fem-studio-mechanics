# openaec-mcp-server

Model Context Protocol (MCP) server that exposes the **Open FEM Studio** /
**OpenAEC** engines and the 2D FEM solver to MCP clients (Claude Desktop,
Claude Code, etc.). It speaks JSON-RPC 2.0 over stdio and wraps the same
Rust crates the Tauri desktop app uses, so a tool call from Claude returns
byte-identical results to clicking through the UI.

The fixed tools, in groups (the exact roster is pinned by
`tests/stdio_roundtrip.rs` and `tests/drie_wegen_kruistabel.rs`), plus one tool
per command of the app's command register — see *Commando's uit de app*:

| group | tools |
|---|---|
| steel profiles and sections | `list_steel_profiles`, `compute_section_properties` |
| 2D FEM solver | `fem_solver_status`, `validate_fem_model`, `load_fem_project`, `solve_fem_model` |
| 3D frame and plate solver | `solve_open_fem_3d` |
| 3D frame solver, `frame3d` track (same pinned Dedaliano/Stabileo revision) | `solve_frame3d` |
| experimental native Rust FEM kernels (one contract for all element types) | `solve_native_fem` |
| 3D steel hall (generator, optionally solved) | `open_fem_3d_staalhal_maken` |
| IFC4 structural analysis model import (optionally solved) | `open_fem_3d_ifc_importeren` |
| local file import through extensions | `project_import` (see [extension guide](../../../docs/extensies.md)) |
| driving the running app | the `gui_*` tools, see the last section |
| the app's command register: 3D model, project, undo | one tool per command (`model3d_*`, `project_*`, `app_*`), generated from the app's catalogue — see *Commando's uit de app* |



**Belastingen.** In het 3D-model heeft elke soort last een eigen tool
(`model3d_load_nodal_add`, `model3d_load_member_add`, …; zie *Commando's uit de
app*). In het 2D-model nog niet: de 2D-rekentools nemen
`loadCases`, `loads` en (optioneel) `combinations` mee in het verzoek;
`gui_build_model` bouwt ze in de draaiende app op. Een 2D-last erbij betekent
het model opnieuw sturen.

**Eigen factoren, bewust gekozen.** Een blijvend geval met een factor die niet
uit NEN-EN 1990 NB tabel NB.4/NB.5 komt, staat als `FOUT:` in `warnings` (en
`validate_fem_model` geeft `ok: false`), met per factor wat de NB geeft en of de
set een schaal K_FI maal NB.4 volgt (`1,22 ≈ 0,9 × 1,35 (K_FI CC1 op NB.4 6.10a;
NB.5 CC1 geeft 1,2)`). De herkomst "projectbestand van vóór september 2026"
staat er alleen bij een echt spoor (de kolom van de oude standaardset, of
factoren voor gevallen die niet bestaan). Zijn de factoren bewust gekozen, dan
legt `project_combinations_confirmOwnFactors` (of de knop *Behoud eigen
factoren* in de app) ze vast in `combinations[].bevestigdeFactoren`; intrekken
met `project_combinations_revokeOwnFactors`. Een bevestiging geldt per factor en
alleen voor precies die waarde, rekent niet mee, en staat daarna als vermelding
in `warnings` in plaats van als `FOUT:`. `load_fem_project` geeft het veld mee;
geef de combinaties ongewijzigd terug aan `solve_fem_model`.


## Get the binary

**With the installer (from version 0.3.15).** The desktop installers ship the
server next to the app, so no Rust toolchain is needed:

| platform | path |
|---|---|
| Windows | `%LOCALAPPDATA%\Open FEM Studio\openaec-mcp-server.exe` |
| macOS | `/Applications/Open FEM Studio.app/Contents/MacOS/openaec-mcp-server` |
| Linux (.deb) | `/usr/bin/openaec-mcp-server` |

It is wired in through `bundle.externalBin` in `src-tauri/tauri.bundel.conf.json`,
which only the release build passes (`npm run tauri:build`, and the release
workflow). `scripts/mcp-sidecar.mjs` builds the server first and puts it in
`src-tauri/binaries/` under the target triple Tauri asks for; `tauri dev` and
`cargo check` do not need it.

The **FEM tools**
(`solve_fem_model`, …) run the solver bundle in a Node
sidecar and need **Node ≥ 20** on the PATH; `fem_solver_status` says whether
that chain is complete, and the other tools keep working without it.

## Build from source

The server lives in the same Cargo workspace as the rest of OpenAEC.

```bash
cd src-tauri
cargo build --release -p openaec-mcp-server
```

The binary is produced at:

```
src-tauri/target/release/openaec-mcp-server         # Linux/macOS
src-tauri/target/release/openaec-mcp-server.exe     # Windows
```

The binary is fully self-contained (the steel-profile catalogue and PDF fonts
are baked in via `include_bytes!`). No data files need to ship alongside it.

## Een AI-assistent koppelen

In de app staat alles op één plek: **Instellingen → AI-assistent (MCP)** (ook via
het lint *Instellingen → AI-assistent (MCP)*). Daar staat het pad van de
meegeleverde server, en er zijn drie wegen om hem aan een assistent te koppelen:

1. **De knop "Toevoegen aan Claude Desktop".** Zet de regel `open-fem-studio`
   (`{ "command": "<pad>", "args": [] }`) in `mcpServers` van
   `%APPDATA%\Claude\claude_desktop_config.json` (macOS:
   `~/Library/Application Support/Claude/`). Andere servers en instellingen
   blijven staan, met dezelfde volgorde en inspringing; vooraf komt er een
   reservekopie `claude_desktop_config.json.<JJJJMMDD-UUMMSS>.bak` (UTC) naast;
   staat er ongeldige JSON in het bestand, dan weigert de knop en blijft het
   bestand onaangeroerd. Start Claude Desktop daarna opnieuw.
2. **Claude Code**, met de opdracht die het paneel laat kopiëren:

   ```bash
   claude mcp add --scope user open-fem-studio -- "C:\Users\you\AppData\Local\Open FEM Studio\openaec-mcp-server.exe"
   ```

3. **Een andere MCP-client**, met het JSON-fragment uit het paneel:

   ```json
   {
     "mcpServers": {
       "open-fem-studio": {
         "command": "C:\\Users\\you\\AppData\\Local\\Open FEM Studio\\openaec-mcp-server.exe",
         "args": []
       }
     }
   }
   ```

De rekentools werken daarmee meteen. Voor de `gui_*`-tools en de
app-commando's zonder `project` moet de app draaien. Bij een nieuwe installatie
staat **"Bediening door een AI-assistent toestaan (MCP)"** standaard aan. Een
expliciete keuze voor uit blijft ook na updates bewaard. Bij een ongeldig of
onleesbaar instellingenbestand blijft het kanaal uit. De app luistert alleen
op 127.0.0.1 en vereist voor iedere opdracht de sessiesleutel uit het alleen
voor de gebruiker leesbare `gui-control.json`. De assistent kan anders
`gui_start_app` aanroepen, die de geïnstalleerde app met bediening start als hij
nog niet draait — alleen voor die sessie; de bewaarde instelling verandert niet.
Voor ontwikkelaars blijft `OPENAEC_GUI_CONTROL=1` werken.

## Wire it into Claude Desktop / Claude Code

The app does this for you (see *Een AI-assistent koppelen* above). By hand:
add an entry to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "open-fem-studio": {
      "command": "C:\\Users\\you\\AppData\\Local\\Open FEM Studio\\openaec-mcp-server.exe",
      "args": []
    }
  }
}
```

The config file lives at:

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Restart Claude Desktop after editing. All 55 fixed tools (plus the app's
commands) should appear in the tools picker. For Claude Code:

```bash
claude mcp add --scope user open-fem-studio -- "C:\Users\you\AppData\Local\Open FEM Studio\openaec-mcp-server.exe"
```

To raise the log level (logs go to **stderr** so they never collide with
JSON-RPC traffic on stdout), set the env var `OPENAEC_MCP_LOG=debug`:

```json
{
  "mcpServers": {
    "open-fem-studio": {
      "command": "C:\\path\\to\\openaec-mcp-server.exe",
      "env": { "OPENAEC_MCP_LOG": "debug" }
    }
  }
}
```

## Tools

All tool I/O matches the existing `ts-rs`-generated TypeScript types in
`src/lib/types/`, so the same JSON shapes
work for both Tauri and MCP callers.

### `list_steel_profiles`

Returns every profile in the catalogue (HEA, HEB, HEM, IPE, UNP, RHS, SHS,
CHS) with geometry, section properties, and EN 1993-1-1 buckling curves.

**Request**:
```json
{ "name": "list_steel_profiles", "arguments": {} }
```

**Response** (truncated):
```json
{
  "profiles": [
    {
      "name": "HEA200",
      "kind": "ISection",
      "geometry": { "h": 190, "b": 200, "tw": 6.5, "tf": 10, "r": 18 },
      "properties": { "area_mm2": 5380, "iy_mm4": 36900000, ... },
      "buckling_curves": { "y_axis": "b", "z_axis": "c" }
    },
    ...
  ]
}
```


### `compute_section_properties`

Recomputes section properties from the catalogue **geometry** (so the result
is independent of the catalogue's stored property values — useful for
spot-checking). Dispatches to `i_section_props`, `channel_section_props`, or
`rhs_section_props` based on `ProfileKind`. CHS profiles fall back to
catalogue values (no analytical helper exists yet — see "Known limitations").

**Request**:
```json
{ "name": "compute_section_properties", "arguments": { "profile_name": "HEA200" } }
```

**Response**: a `SectionProperties` object — `area_mm2`, `iy_mm4`, `iz_mm4`,
`wel_y_mm3`, `wpl_y_mm3`, `it_mm4`, `iw_mm6`, `iy_radius_mm`, etc.




## 3D-raamwerk (`solve_open_fem_3d`)

Dezelfde functie `open_fem_3d::solve` als het Tauri-command en de
ontwikkelbrowser: een ruimtelijk raamwerk, lineair of in directe tweede orde
(`analysis: "p-delta"`, de standaard). Eenheden m, kN, kNm en MPa; het schema
is op elk niveau strikt en het contract weigert onbekende velden.

**Hout in 3D.** Een materiaal kan `gMpa` opgeven naast `eMpa` en `nu`.
Zonder `gMpa` volgt de schuifmodulus als voorheen uit `E/(2(1+ν))`.
Voor een houtsterkteklasse geeft de app `E_mean` en `G_mean` onafhankelijk door.
De adapter schaalt per combinatie van materiaal en doorsnede de torsieconstante
en eventuele afschuifoppervlakken, zodat de vastgepinde isotrope kern dezelfde
`G·J` en `G·A_s` gebruikt. Buigstijfheid `E·I` verandert daardoor niet.

**Tweede orde.** De adapter itereert zelf: (K + K_G(N))·u = F met een verse
factorisatie per iteratie, tot de relatieve verplaatsingswijziging onder
`tolerance` ligt. Een tangent die niet positief definiet is, geeft een melding
"instabiliteit". De reacties zijn ((K + K_G)·u − F), zodat de krachtensom exact
sluit; de momentensom om de oorsprong in de onvervormde stand wijkt precies af
met het tweede-ordemoment Σ N·(e_x × Δu). Vooraf bepaalt de adapter de eerste
knikfactor α_cr (`buckling.modes[0].loadFactor`) uit dezelfde K en K_G; bij
α_cr ≤ 1 weigert de berekening. EN 1993-1-1, 5.2.1 vraagt α_cr ≥ 10 voor een
eerste-ordeberekening. K_G houdt rekening met vrijgegeven staafeinden.

**Trek-alleen.** `members[].tensionOnly: true` maakt een staaf trek-alleen
(bijvoorbeeld een windverband van rond staal). Per berekening valt een
trek-alleen staaf weg zolang zij op druk zou staan; bij tweede orde convergeert
die set eerst lineair en daarna in tweede orde. Het resultaat noemt de
inactieve staven (`inactiveMembers`, met nul-krachten en nul-lijnen in de
uitvoer) en het aantal statusrondes (`tensionOnlyRounds`). Staaflasten op een
inactieve staaf gaan als statisch gelijkwaardige knooplasten naar de
eindknopen. Een staaf die een knoop los laat hangen of een set die blijft
wisselen, geeft een melding met staafnummers.

**Starre schijven.** `diaphragms: [{ id, nodeIds }]` koppelt X, Y en de
rotatie om Z van de knopen als één star horizontaal vlak. Voorwaarden: minstens
twee bestaande knopen, alle binnen 1 mm op dezelfde hoogte, een knoop in
hoogstens één schijf, en hoogstens één knoop die de schijf in haar vlak
vasthoudt (oplegging in X, Y of rotatie om Z); die knoop wordt de meester.
Liggen alle knopen in X en Y vast, dan valt de schijf met een melding weg.

**Montage van trek-alleen staven.** `tensionOnlyFit: { nodalLoads,
memberLoads, memberPointLoads, thermalLoads, surfaceLoads }` zijn de lasten die
al op het frame staan wanneer de verbanden gemonteerd worden, bijvoorbeeld de
permanente belasting met factor 1. Zelfde vorm en keuring als de gewone lasten;
opgelegde verplaatsingen horen bij het rekengeval en doen niet mee. Elke
trek-alleen staaf krijgt de spanningsloze lengte L + Δ0, met Δ0 de verlenging
van haar koorde (u_j − u_i)·e_x onder de montagelasten (min de vrije
temperatuurverlenging van de staaf zelf). Δ0 werkt als gelijkwaardige uniforme
temperatuur ΔT = Δ0/(α·L) met de α van het materiaal (anders 12·10⁻⁶/K), in
elke statusronde en in de tweede orde. De eerste montageberekening is lineair
met alle staven actief, zodat het frame lood staat; omdat het verband daarin
zelf meedraagt, past de adapter opnieuw op de nieuwe koorde tot de
verbandkrachten niet meer veranderen (hoogstens 12 berekeningen). Onder alleen
de montagelasten dragen de verbanden dan niets, behalve een kracht die het
frame zonder verbanden niet kan dragen (een scheefstand die alleen de
verbanden tegenhouden): die blijft, en voor dat deel houdt het verband zijn
lengte uit de lode stand. Het resultaat geeft Δ0 per staaf
(`tensionOnlyFit: [{ memberId, deltaMm }]`) en een melding met het aantal
aangepaste staven, de grootste |Δ0| en het aantal montageberekeningen.
Ontbreekt het veld, dan rekent alles als voorheen.

**Kruisregel.** `tensionOnlyCrossRule: true`: twee trek-alleen staven die
elkaar in hun inwendige snijden (kleinste afstand tussen de assen < 1 mm, het
snijpunt meer dan 1 mm van de einden, geen gedeelde eindknoop) vormen een
kruis; drie of meer staven door één punt tellen niet. Zou in een kruis geen
diagonaal meedoen, dan blijft die met de grootste normaalkracht actief (voor
een inactieve staaf de normaalkracht uit haar verlenging), ook met een kleine
drukkracht. Het resultaat noemt die staven (`crossRuleMembers`); de melding
geeft het aantal kruisen waarin de regel nodig was en de grootste drukkracht in
een actieve trek-alleen staaf.

**Staaf op bedding.** `members[].bedding: { kKnPerM3?, widthM,
kLateralKnPerM3?, compressionOnly? }` legt een staaf op grondveren (Winkler)
over haar hele lengte: verticaal (globaal Z, de grond ligt onder de staaf) met
de lijnstijfheid k·b, en desgewenst zijdelings (horizontaal loodrecht op de
staafas, naar beide zijden, altijd lineair; bij een staaf steiler dan 45°, een
(schoor)paal, rondom in twee richtingen loodrecht op de as). Minstens één van
beide constanten; een (bijna) verticale staaf (|e_x·Z| > 0,95, een paal)
krijgt alleen `kLateralKnPerM3`. Met `compressionOnly` vallen de
verticale veren weg waar de staaf omhoog komt. De adapter knipt de staaf zelf
fijn genoeg. Het resultaat geeft per staaf op bedding (`bedding: [{ memberId,
points: [{ t, settlementM, pressureKnPerM, lateralKnPerM?, active }],
maxPressureKnPerM, minPressureKnPerM, maxSettlementM, totalReactionKn,
liftedFraction }]`) de zakking (positief omlaag), de lijnlast van de grond op
de staaf (positief omhoog) en het deel van de lengte zonder contact; de
grondveren staan niet bij de oplegreacties.

**Plaat op bedding.** `plates[].bedding: { kKnPerM3, compressionOnly? }` legt
een plaat op grondveren (Winkler), bijvoorbeeld een vloer op zand: de adapter
zet op elke knoop van haar elementen een veer k·A_trib loodrecht op het
plaatvlak, met A_trib het tributaire oppervlak uit de elementen van die plaat
(samen het plaatoppervlak min de openingen). De grond ligt aan de onderzijde:
tegen de plaatnormaal in (de z-as van de plaatassen; bij een vloer globaal
−Z). Bij een wand legt de assenafspraak die zijde vast en is zij niet te
kiezen: een wand in het XZ-vlak heeft de grond aan +Y, in het YZ-vlak aan −X
(de diagnostics noemen haar; ligt de grond aan de andere kant, dan zijn
zakking en gronddruk van teken omgekeerd en is `compressionOnly` niet
bruikbaar). Met `compressionOnly` vallen de veren weg waar de plaat loskomt. Het
resultaat geeft per plaat op bedding (`plateBedding: [{ plateId, nodes:
[{ nodeId, settlementM, pressureKnPerM2, active }], maxPressureKnPerM2,
minPressureKnPerM2, maxSettlementM, totalReactionKn, liftedFraction }]`) de
zakking (positief de grond in), de gronddruk k·zakking (0 waar geen contact) en
het deel van het oppervlak zonder contact; de grondveren staan niet bij de
oplegreacties.

`gui_build_3d_model` kent dezelfde velden in de app: `beams[].tension_only`,
`beams[].bedding: { k_kn_per_m3?, width_m, k_lateral_kn_per_m3?,
compression_only? }`, `plates[].bedding: { k_kn_per_m3, compression_only? }`, `diaphragms: [{ nodes, name? }]` met 1-gebaseerde knoopindices, en de
modelinstellingen `tension_only_fit_after_permanent` (montagelasten zijn de
blijvende belastinggevallen met factor 1, inclusief eigen gewicht en
belastingvlakken) en `tension_only_cross_rule`. In de app werkt het eigen
gewicht van een trek-alleen staaf als twee gelijke knooplasten op haar einden
(kabelwerking), niet als verdeelde last.

## Stalen hal (`open_fem_3d_staalhal_maken`)

Een complete stalen hal als 3D-raamwerk met één aanroep: spanten (kolommen en
spantliggers), gordingen, randliggers, dak- en wandverbanden, de lasten G, S,
wind dwars en wind langs, het vaste geval "Eigen gewicht", en desgewenst een
betonnen **balkrooster op palen** als fundering. Dezelfde generator zit achter
de wizard **Stalen hal…** in de app (lint, groep Project, en het
welkomstscherm) en achter de bedieningsopdracht `staalhal_maken`
(`gui_build_3d_steel_hall`): wie een hal via de API maakt, krijgt knoop voor
knoop hetzelfde model als in de wizard.

**De keten.** De hal wordt in de solverbundel gebouwd
(`design-mockup/src/components/openFem3d/wizards/staalhal.ts`, sidecar
`staalhal_maken`). Met `reken: true` rekent `open_fem_3d::solve` — dezelfde
kern als `solve_open_fem_3d` — elk belast geval en elke standaardcombinatie; de
sidecar (`staalhal_uitwerken`) werkt de resultaten uit.


### Argumenten

| veld | standaard | betekenis |
|---|---|---|
| `hal` | `{}` | de parameters van de hal, zie hieronder |
| `reken` | `false` | meteen doorrekenen met de 3D-kern |
| `analyse` | `"linear"` | de resultaten: `"linear"` (eerste orde, zoals het projectbestand) of `"p-delta"`, zonder scheefstand |
| `gevolgklasse` | `"CC2"` | factoren van de standaardcombinaties (NEN-EN 1990 NB) |
| `stramien` | `true` | stramien en levels van de hal in het projectbestand |
| `detail` | `"samenvatting"` | `"volledig"`: ook alle reacties en verplaatsingen per geval |
| `timeout_s` | — | tijdslimiet per sidecar-aanroep |


**`hal`** — alle lengtes in **mm**. Ontbrekende velden krijgen de standaardwaarde;
samen is dat de voorbeeldhal van `docs/verificatie/3d-raamwerk/staalhal-60x30.ifcfem`.
Een onbekend veld, een verkeerd type of een onzinnige combinatie wordt
GEWEIGERD (`INVOER_ONGELDIG`), met in `detail.problemen` per probleem een code,
het veld en een Nederlandse melding — nooit een stille standaardwaarde.

| veld | standaard | betekenis |
|---|---|---|
| `lengteMm` | 60000 | lengte (x) |
| `breedteMm` | 30000 | overspanning (y) |
| `spantafstandMm` | 6000 | GROOTSTE h.o.h.-afstand; aantal vakken = ⌈lengte/spantafstand⌉, gelijk verdeeld. Niet samen met `aantalVakken` |
| `aantalVakken` | — | aantal vakken (spanten = vakken + 1), in plaats van `spantafstandMm` |
| `goothoogteMm` | 8000 | goothoogte (lage zijde bij een lessenaarsdak) |
| `dak.type` | `"zadeldak"` | `"zadeldak"`, `"lessenaarsdak"` of `"platdak"` |
| `dak.nokhoogteMm` / `dak.hellingGraden` | helling 1 : 10 | nokhoogte (lessenaarsdak: hoge zijde) óf helling; niet allebei |
| `gordingafstandMm` | 2500 | GROOTSTE gordingafstand, horizontaal; bij een zadeldak valt de nok op een gording |
| `profielen.{kolom,spantligger,gording,randligger,verband}` | HEA 450, IPE 600, IPE 160, HEA 160, CHS 88.9x4 | `{ profiel, materiaal }`, catalogusprofiel en S235–S460 |
| `kolomvoet` | `"ingeklemd"` | of `"scharnierend"` (dan is wandverband verplicht) |
| `verbanden.vakken` | `"kopvakken"` | `"kopvakken"`, `"alle"`, `"geen"` of vaknummers (1 = eerste vak) |
| `verbanden.dak` / `verbanden.wanden` | `true` / `true` | kruis in elk gordingveld / in beide langsgevels |
| `fundering.type` | `"opleggingen"` | of `"balkrooster"` |
| `fundering.balkBreedteMm` × `balkHoogteMm`, `betonklasse` | 400 × 600, C20/25 | funderingsbalken |
| `fundering.dwarsbalken` | `"elkSpant"` | of `"kopspanten"`; langsbalken liggen altijd onder beide kolomlijnen |
| `fundering.diepteMm` | 800 | systeemlijn (hart balk) onder peil; > 0: een betonnen poer verbindt kolomvoet en rooster |
| `fundering.paalKzKnPerMm` | 100 | verticale veer per paal |
| `fundering.paalHorizontaal` | `"veren"` | veer per paal (`paalKhKnPerMm`, 5) of `"statischBepaald"` (u_x+u_y in de eerste paal, u_y in de laatste van kolomlijn y = 0) |
| `fundering.paalAfstandMm` | 6000 | grootste paalafstand langs een balk; onder elke kolom staat een paal |
| `lasten.dakafwerkingKnM2` / `sneeuwKnM2` | 0,3 / 0,56 | kN/m² horizontale projectie, als lijnlast op de gordingen |
| `lasten.wind.bron` | `"handmatig"` | `"handmatig"` (`drukKnM2` 0,64, `zuigingKnM2` 0,40, `dakZuigingKnM2` 0,48) of `"stuwdruk"`: q_p(z = nok) uit NEN-EN 1991-1-4 (`windgebied` II, `terreincategorie` III), c_pe,10 zones D/E van tabel 7.1 en `cDak` (0,6) op het hele dak |
| `eigenGewicht` | `true` | geval "Eigen gewicht" (id 5), ρ·A·g per staaf, ook rooster en poeren |
| `projectnaam` | `""` | leeg: "Staalhal L × B m" |

Belastinggevallen van de hal: 1 Permanent (G), 2 Sneeuw (S), 3 Wind dwars (W,
+Y: kolommen loef druk en lij zuiging, dak opwaarts), 4 Wind langs (W, +X: de
helft van de kopgevel op de dakrand van het eerste spant), 5 Eigen gewicht. De
app koppelt ze bij "Maken" aan de gevallen van het project (op naam en type;
ontbrekende komen erbij).

### Uitvoer

- `project` — de inhoud van een projectbestand (op te slaan als `.ifcfem`, te
  openen in de app of met `gui_load_model`);
- `parameters` — de genormaliseerde parameters (weer als `hal` te gebruiken);
- `samenvatting` — `aantallen`, `maten` (werkelijke spant- en gordingafstand,
  helling, verbandvakken), `groepen` (staafnummers per rol: kolom, spantligger,
  gording, randligger, dakverband, wandverband, funderingsbalk, poer),
  `paalknopen`, de lasten (bij stuwdruk met afleiding), `belastingsom` per geval
  en `eigenGewichtKn` (staal/beton);
- `waarschuwingen` — aandachtspunten, bijv. lasten per m² projectie bij een
  helling boven 10°, of de statisch bepaalde horizontale oplegging;
- met `reken`: `berekening.gevallen[]` en `berekening.combinaties[]` met
  `reactiesomKn`, `belastingsomKn`, `evenwicht` (kern én onafhankelijke
  krachten- en momentensom), `maxVerplaatsingMm`, `maxGootverplaatsingMm` en
  (balkrooster) `paalreacties`; `grenzen_ter_vergelijking` (L/250, h/150);

### Voorbeeld

```json
{ "name": "open_fem_3d_staalhal_maken", "arguments": {
    "hal": {
      "lengteMm": 48000, "breedteMm": 24000, "spantafstandMm": 6000, "goothoogteMm": 7000,
      "dak": { "type": "zadeldak", "hellingGraden": 6 },
      "profielen": { "kolom": { "profiel": "HEA 400", "materiaal": "S355" } },
      "kolomvoet": "scharnierend",
      "verbanden": { "vakken": [1, 8], "dak": true, "wanden": true },
      "fundering": { "type": "balkrooster", "dwarsbalken": "kopspanten", "paalAfstandMm": 4000 },
      "lasten": { "wind": { "bron": "stuwdruk", "windgebied": "II", "terreincategorie": "III" } }
    },
    "reken": true } }
```


**In de draaiende app** (bedieningskanaal: Instellingen → AI-assistent (MCP), of `OPENAEC_GUI_CONTROL=1`):
`gui_build_3d_steel_hall { "hal": { … } }` — paginaopdracht `staalhal_maken`.
Het 3D-model wordt vervangen als één undo-stap, de gevallen van de hal worden
aan die van het project gekoppeld, het stramien en het eigen gewicht worden
gezet en het 3D-werkblad opent passend in beeld; het antwoord noemt de
aantallen, de staafnummers per groep en per geval van de hal het geval van het
project. Een fout in de parameters komt terug met alle problemen, zonder dat
er iets verandert.

## IFC-analysemodel importeren (`open_fem_3d_ifc_importeren`)

Een IFC4-analysemodel (Structural Analysis View: `IfcStructuralAnalysisModel`
met knopen, staven, vlakken, belastinggevallen en combinaties) als 3D-project.
Dezelfde import zit achter de knop **Rekenmodel importeren** op het IFC-tabblad
van het lint (en Bestand → Openen) en achter de bedieningsopdracht
`ifc_analysemodel_importeren` (`gui_import_ifc_analysis_model`): wie een bestand
via de API importeert, krijgt knoop voor knoop hetzelfde project als in de app.

**De keten.** De server leest het bestand (UTF-8, anders ISO 8859-1); de import
zelf draait in de solverbundel (`design-mockup/src/io/ifcAnalyseImport.ts`,
sidecar `ifc_importeren`). Met `reken: true` rekent `open_fem_3d::solve` elk
belast geval en elke combinatie uit het bestand (heeft het bestand er geen: de
standaardset van de app voor `gevolgklasse`), werkt de sidecar
(`ifc_uitwerken`) de resultaten uit.
Kent de 3D-kern een onderdeel nog niet (trek-alleen staven, starre schijven) of mist een staaf een
profiel, dan is `berekening.uitgevoerd` false met de reden; er wordt niets
weggelaten om toch te rekenen.


### Argumenten

| veld | standaard | betekenis |
|---|---|---|
| `pad` | — (verplicht) | absoluut pad naar het `.ifc`-bestand (IFC4, STEP-vorm) |
| `analysemodel` | — | naam (hoofdletterongevoelig) of volgnummer vanaf 1; verplicht als het bestand meer dan één analysemodel heeft, anders komt er een fout met de lijst |
| `reken` | `false` | meteen doorrekenen met de 3D-kern |
| `analyse` | `"linear"` | de resultaten: `"linear"` of `"p-delta"`, zonder scheefstand |
| `gevolgklasse` | `"CC2"` | alleen voor de standaardset, als het bestand geen combinaties heeft |
| `detail` | `"samenvatting"` | `"volledig"`: ook reacties en verplaatsingen per geval |
| `timeout_s` | — | tijdslimiet per sidecar-aanroep |


### Wat er wordt ingelezen

- eenheden uit `IfcUnitAssignment` (ook mm en kN; een `IfcDerivedUnit` gaat voor, de vlaklast valt anders terug op `PRESSUREUNIT`), omgerekend naar m, kN, kN/m, kN/m² en kNm;
- plaatsing via de `IfcLocalPlacement`-keten en de `SharedPlacement` van het model;
- knopen (`IfcStructuralPointConnection`) met opleggingen en veren; staven (`IfcStructuralCurveMember`) met profiel (I, U, kokers, buizen, massief rond als `RD <d>`, een stalen rechthoek als `Strip <b>x<t>`; op naam of op afmetingen), staalsoort, rolhoek uit `Axis` en eindscharnieren (`IfcRelConnectsStructuralMember`); een staaf die ook tussen haar eindpunten aan een knoop hangt (een doorgaande ligger over een kolom of tussensteunpunt), wordt daar geknipt: de lasten gaan over de delen, de tussenknopen zijn star;
- trek-alleen: `TENSION_MEMBER`, `CABLE` en een `PIN_JOINED_MEMBER` van massief rond staal of van een platte strip (dikte ≤ ¼ breedte); een pendelstaaf met een ander profiel (ook een gedrongen strip) blijft een staaf die ook druk opneemt;
- vlakken: horizontale membraanvlakken die knopen delen worden per hoogte één starre schijf; vlakken zonder stijfheid dragen belastingvlakken (overspanningsrichting uit een eigenschap "Overspanningsrichting"/"SpanDirection" met X of Y, anders twee richtingen);
- belastinggevallen (type uit ActionType en ActionSource; `SelfWeightCoefficients` (0, 0, −1) = het automatische eigen gewicht; `SYSTEM_IMPERFECTION` = "overig", en de scheefstand van het project staat dan uit), vlak-, lijn- en puntlasten (een vlaklast met een eigen face die samenvalt met de rand van het vlak geldt voor het hele vlak; een kleinere face wordt gemeld en niet ingelezen), eigen combinaties (factoren uit `IfcRelAssignsToGroupByFactor`, type uit Purpose of naam) en levels uit `IfcBuildingStorey`.

### Uitvoer

- `project` — de inhoud van een projectbestand (`.ifcfem`), te openen in de app of met `gui_load_model`;
- `modellen` — de analysemodellen in het bestand (nummer, naam, beschrijving, aantallen) en `analysemodel` — het gekozen model;
- `verslag` — `aantallen`, `trekAlleen`, `schijven`, en in Nederlandse zinnen `toelichting`, `waarschuwingen` (benaderd of aangenomen) en `nietOndersteund` (niet ingelezen), gelijke meldingen samen met een telling;
- met `reken`: `berekening` met `uitgevoerd` (en anders `reden`), `gevallen[]` en `combinaties[]` met `reactiesomKn`, `belastingsomKn`, `evenwicht` en `maxVerplaatsingMm`.

### Voorbeeld

```json
{ "name": "open_fem_3d_ifc_importeren", "arguments": {
    "pad": "C:/projecten/hal/analysemodel.ifc", "analysemodel": "Hal", "reken": true } }
```

**In de draaiende app** (bedieningskanaal: Instellingen → AI-assistent (MCP), of `OPENAEC_GUI_CONTROL=1`):
`gui_import_ifc_analysis_model { "path": "…", "analysis_model": "Hal" }` —
de app leest het bestand, zet het als nieuw 3D-project neer (zonder te vragen
naar niet-opgeslagen werk) en geeft het verslag terug.

## Commando's uit de app (`model3d_*`, `project_*`, `app_*`)

De app heeft een commandoregister (`design-mockup/src/api/`): elke
modelfunctie is daar een commando met een naam, een Nederlandse beschrijving
en een streng invoerschema. Deze server maakt van elk commando een tool. De
lijst komt uit `assets/api-catalogus.json`, die `npm run build:sidecar` uit
de app schrijft; een nieuw commando in de app is na het bouwen dus vanzelf
een tool. Het register dekt nu het 3D-model, de gevallen en combinaties, het
stramien, ongedaan maken en opslaan; het 2D-model, rekenen, en
weergave en rapport volgen.

- **Naam**: de commandonaam met `_` voor `.`, dus `model3d.node.add` wordt
  `model3d_node_add`.
- **Documentcommando's** (`model3d_*`, `project_*`) werken op een project.
  - Met `project` (pad naar een `.ifcfem` of `.ifcfem2d`) is er geen app
    nodig: de server leest het bestand, voert het commando uit in de
    solverbundel en schrijft het resultaat terug (eerst naast het bestand,
    dan in één keer vervangen). `save: false` laat het bestand staan.
    Antwoord: `{output, saved, project}`.
  - Zonder `project` gaat het commando naar de draaiende app (bediening aan via
    Instellingen → AI-assistent (MCP), `gui_start_app` of `OPENAEC_GUI_CONTROL=1`,
    zie de laatste sectie), als één stap die
    `app_undo` of Ctrl+Z ongedaan maakt. Antwoord: `{output, via: "app"}`.
- **App-commando's** (`app_undo`, `app_redo`, `app_project_save`,
  `app_project_open`) werken alleen in de draaiende app.
- **Niet-opgeslagen werk**: in de app weigeren `project_new` en
  `app_project_open` als het project niet-opgeslagen wijzigingen heeft, tenzij
  `discardChanges: true`. Dit kanaal stelt de gebruiker geen vragen.
- **Fouten** komen met een vaste code in `structuredContent.error_code`, met
  een remedie: `ONBEKEND_COMMANDO` (met suggesties), `INVOER_ONGELDIG` (met de
  problemen per veld), `GEEN_DOCUMENT`, `NIET_GEVONDEN`, `GEWEIGERD` (een
  modelregel weigert; de reden staat erbij), `ALLEEN_IN_APP`,
  `BESTAND_ONLEESBAAR` en `INTERN`. Een verkeerd argument van de tool zelf
  (`project` bij een app-commando, een ander bestandstype) geeft
  `ARGUMENT_ONGELDIG`.
- **Eenheden**: m, kN, kN/m, kN/m², kNm; de profielrotatie in graden
  (`rollAngleDeg`). `model3d_get` geeft het model zoals het project het
  bewaart (de rolhoek dan in radialen).

Voorbeeld: een kolom op een bestand, zonder app.

```json
{"name": "project_new", "arguments": {"project": "C:/werk/kolom.ifcfem"}}
{"name": "model3d_node_add", "arguments": {"project": "C:/werk/kolom.ifcfem", "x": 0, "y": 0, "z": 0}}
{"name": "model3d_node_add", "arguments": {"project": "C:/werk/kolom.ifcfem", "x": 0, "y": 0, "z": 4}}
{"name": "model3d_beam_add", "arguments": {"project": "C:/werk/kolom.ifcfem", "startNodeId": 1, "endNodeId": 2, "profileName": "HEA 200"}}
{"name": "model3d_support_set", "arguments": {"project": "C:/werk/kolom.ifcfem", "nodeId": 1, "preset": "fixed"}}
{"name": "model3d_load_nodal_add", "arguments": {"project": "C:/werk/kolom.ifcfem", "nodeId": 2, "fx": 5, "fz": -100}}
```

Hetzelfde in de draaiende app: laat `project` weg.

Welke functie van de 3D-bediening bij welk commando hoort, en wat in een
latere fase komt, staat in `design-mockup/src/api/dekking.ts`;
`design-mockup/test-api-dekking.mjs` faalt zodra de 3D-bediening een functie
krijgt zonder commando. Eind-tot-eind door de echte app, via deze server:
`node design-mockup/referentie-gui/api-app.mjs`.

## Architecture

- **Transport**: newline-delimited JSON-RPC 2.0 on stdin/stdout. One message
  per line.
- **Protocol**: implements `initialize`, `notifications/initialized`,
  `tools/list`, `tools/call`, and `ping`. Other methods return -32601.
- **Concurrency**: each request is dispatched on its own `tokio::spawn`, so a
  long-running calculation does not block subsequent reads. CPU-bound work
  (the Rust kernels) runs on
  `tokio::task::spawn_blocking` so it does not starve the I/O scheduler.
- **Error mapping**: malformed request → `-32700`, unknown method → `-32601`,
  invalid `tools/call` params → `-32602`. Per the MCP spec, **tool execution
  errors** (e.g. unknown profile name, malformed tool input) are
  returned in `result.isError = true` rather than as JSON-RPC errors, so the
  model can read them and self-correct.
- **Logging**: `tracing` to stderr. Set `OPENAEC_MCP_LOG=debug` for verbose
  output.

## Test

```bash
cargo test -p openaec-mcp-server
```

| test | what it pins down |
|---|---|
| `stdio_roundtrip.rs` | the full handshake against the real binary: `initialize` → `notifications/initialized` → `tools/list` → `tools/call`, and the complete tool roster |
| `schema_strikt.rs` | the input schemas of the tools (the 3D, steel-hall, IFC-import and `gui_start_app` tools, and the check tools where present) are complete and strict; a typo in a field name is refused, not silently defaulted; the `combinations` of `solve_fem_model` and `check_fem_model` know `bevestigdeFactoren` and nothing else besides the five combination fields |
| `eigen_factoren_mcp.rs` | deliberately chosen custom factors (issue #196) end to end: reference project P01 (K_FI = 0.9 × NB.4) through `validate_fem_model` with `project_path` is `ok: false` with the scale in the error and no "before September 2026" origin; the same file with `bevestigdeFactoren` is `ok: true` with the confirmed factors as a note; `load_fem_project` returns the confirmation and `solve_fem_model` with exactly those combinations has no `FOUT:` and the same results as without it (needs Node ≥ 20) |
| `fem_golden.rs`, `sidecar.rs`, `fout_paden.rs` | the FEM chain: golden values, the Node sidecar, and the error paths |
| `ifc_import_mcp.rs` | `open_fem_3d_ifc_importeren` end to end on the synthetic files of `docs/verificatie/ifc-analyse`: without a model choice the error lists both analysis models; the canopy model is imported, solved and checked with ΣR per load case equal to hand values and equilibrium everywhere, its check runs P-Δ with sway imperfection φ = 1/200 in ±X/±Y (issue #199) with ΣR per direction equal to the hand value ∓φ·ΣR_z; the hall comes back with its report and an honest calculation status; the mm/kN file gives exactly the same model; a missing file is reported (needs Node ≥ 20) |
| `api_tools.rs` | the tools generated from the app's command catalogue: a chain of commands on a temporary project file (headless, through the Node sidecar), `save: false`, and the error codes — `NIET_GEVONDEN`, `INVOER_ONGELDIG`, `BESTAND_ONLEESBAAR`, and `ARGUMENT_ONGELDIG` for another file type or `project` on an app command (needs Node ≥ 20) |
| `extensie_import.rs` | `project_import` through the actual MCP binary and Node sidecar: the example extension produces an `.ifcfem` file; an unknown type is refused without overwriting it (needs Node ≥ 20) |
| `staalhal_mcp.rs` | `open_fem_3d_staalhal_maken` end to end: the default hall equals the example project file node for node, every schema default equals the generator's, ΣR per load case and Σ pile reactions match hand values, equilibrium in every case and combination, and parameter errors come back with code and field (needs Node ≥ 20) |
| `gui_start_app_pijpen.rs` | the app that `gui_start_app` starts does not hold the client's pipes open: a stand-in app (a copy of the test binary that keeps running) is started through the real server with piped stdio, the server stops on a closed stdin, and stdout and stderr must close within 2 s — on Windows the server clears the inherit flag of its own std handles before it starts the app |
| `gui_bereikbaarheid.rs` | what a client hears when the app is not reachable — no control file, a closed port, a control file from an earlier session (token refused) — on a `gui_*` tool and on an app command: the text says *Instellingen → AI-assistent (MCP)*, `gui_start_app` and `OPENAEC_GUI_CONTROL=1`, with error code `APP_NIET_BEREIKBAAR`; and `gui_start_app` without an app executable starts nothing (`APP_NIET_GEVONDEN`). Runs with its own `OPENAEC_GUI_CONTROL_FILE` and a non-existent `OPENAEC_APP` |


The unit tests of `gui_start_app` (in `src/gui_tools.rs`) start a stand-in app — the test binary itself, restarted with only the test `nep_app` — that writes a control file and answers `/status` and the page command `status`: the tool waits for the control file of THAT process and for the page, ignores a stale control file, reports a process that stops at once (`APP_GESTOPT`, the single-instance case) and does not wait past `timeout_s` (`APP_START_TIJD`). Further unit tests pin that only an app of this user in this session counts as running (`tasklist` with the own session, `pgrep -u` with the own uid; on Windows checked against the test process itself) and that the control file is looked up in the app data folder per platform, as Tauri chooses it.


## Known limitations

- **CHS section properties**: `compute_section_properties` returns the
  catalogue values for CHS profiles because no `chs_section_props` analytical
  helper exists in the `section-properties` crate yet.
- **No auth**: stdio transport is trusted by definition. Do not expose this
  server over TCP without adding authentication.

## Roadmap


## GUI tools: driving the running desktop app (`gui_*`)

Twenty-three tools operate the **running** Open FEM Studio desktop app through
its control channel. They are not engine calls and are therefore outside the
three-ways rule — they *are* the way to the GUI.

The channel is on after a fresh installation. Change it in **Settings → AI assistant (MCP)** (Dutch UI:
*Instellingen → AI-assistent (MCP)*), "Allow an AI assistant to control the app
(MCP)". An explicit off choice stays off after updates. Invalid or unreadable
settings also keep the channel off. The choice is stored (`ai-assistent.json` in the
app data folder), applies at once — switching it off removes the control file
and closes the port, switching it on again gives a new port and token — and
starts the channel at every later start. Or let the assistant call
`gui_start_app`: when the app is not running it starts the installed app (next to
this server, or `OPENAEC_APP`) with the channel on and waits for it. That channel
lasts for that session only: the saved setting stays as it was, and the panel
shows the session apart from it (the checkbox shows the saved choice) with a
button to switch it off now. The started app inherits nothing from this server —
no stdin/stdout/stderr, and on Windows not the client's pipes either (the server
clears the inherit flag of its own std handles first), so the client still sees
the server's stdout close when the server exits. For developers and test
scripts the environment variable still works:

```
set OPENAEC_GUI_CONTROL=1
"%LOCALAPPDATA%\Open FEM Studio\open-fem-studio.exe"
```

The app then listens on `127.0.0.1:<free port>` with a per-session token and
writes `gui-control.json` (`{pid, poort, token, versie}`) to its app data folder
`org.openaec.fem-studio`: under `%LOCALAPPDATA%` on Windows,
`~/Library/Application Support` on macOS, and `$XDG_DATA_HOME` or
`~/.local/share` on Linux. On macOS and Linux the file is readable by the user
only (0600; a new folder 0700); on Windows its protected ACL grants access to
the current user only, because the token gives full control. The tools
find it there (override with `OPENAEC_GUI_CONTROL_FILE`); an app up to 2026.39.1
uses `org.openaec.fem2d-studio`, which the tools fall back to. The liveness check
`GET /status` answers at once with the token, also while a long command runs; the commands
themselves run one at a time, in order. While the channel is active the
status bar shows *bediening op afstand actief*. Nothing listens without the
default-on setting or the variable, no request succeeds without the token, and the file
is removed on exit (`gui_quit` exits through the app's own path so that
happens). The app does not start a channel over the control file of another
running instance whose port still answers. When the app is not reachable, every
`gui_*` tool (and every app command without `project`) fails with error code
`APP_NIET_BEREIKBAAR` and says what to do.

The installed app keeps a single window: double-clicking a `.ifcfem` or
`.ifcfem2d` file opens it in the running app, also in the one with the
channel. The other side of that: if Open FEM Studio is already running without
the channel, starting it again with `OPENAEC_GUI_CONTROL=1` only brings that
window to the front, and no channel listens. Switch the setting on in that
window, or close it first; `gui_start_app` sees the running app (of this user,
in this session — an app in another user's session does not count), starts no
second one and says so (`APP_DRAAIT_ZONDER_KANAAL`). A separate
instance next to the user's app (as the scripts in `design-mockup/referentie-gui/`
start one) needs both `OPENAEC_GUI_CONTROL=1` and its own
`OPENAEC_GUI_CONTROL_FILE`; such an instance stays outside the single window.
A development build (`npm run tauri dev`) stays outside it too, unless it is
started with `OPENAEC_EEN_INSTANTIE=1`.

| Tool | What it does in the app |
|---|---|
| `gui_status` | reachable? pid, port, version, active view, selection, member count |
| `gui_start_app {timeout_s?}` | starts the installed app with the channel on (for that session only) when it is not running, and waits (default 60 s, 5–300) for the channel and the page; starts nothing when the channel is already reachable, and no second app when the app runs without the channel |
| `gui_load_model {path}` | loads a `.femp`/`.ifcfem`/`.ifcfem2d` (read by the app process) |
| `gui_build_model {...}` | builds nodes/beams/supports/loads through the store actions |
| `gui_build_3d_model {...}` | builds a 3D frame in metres, with supports, nodal loads, optional member profiles, tension-only members, rigid diaphragms and optional levels (nodes and plates linked to a level) |
| `gui_configure_3d_view {...}` | sets the 3D camera, visibility, how plates are drawn (`plateDisplay`: `volume`, `surface` or `mesh`), the size of nodes and supports (`nodeSizePercent`, `supportSizePercent`: 25–400 %), profile volumes, the structural grid (X/Y grid axes and levels; linked nodes follow a level) and the section box (`section_box`: `enabled`, with `min_m`/`max_m` as `{x, y, z}` in metres or `fit`: `model`/`selection`; only what lies inside the box is drawn, selectable and snappable) and the exploded view (`explode`: `mode` `levels` or `elementTypes`, `amount_mm` 0–10000 per step; `elementTypes` puts supports at 0, columns at 1×, beams at 2× and plates at 3× the distance; display only, editing in the app is blocked while it is on) |
| `gui_select_member {id}` | selects a member as if clicked |
| `gui_set_cage {beam_id, cage}` | sets `checkConfig.betonKorf` (a `ReinforcementCage`) |
| `gui_set_analysis {analysis_type}` | `eersteOrde` / `tweedeOrdeGeometrisch` / `tweedeOrdeFysisch` |
| `gui_solve` | the full Bereken run (solver, non-linear concrete round when asked); returns when all is done, with per-combination extremes |
| `gui_set_view {view}` | `default`, `report`, `insights`, `ifc` (full edition also `check`) |
| `gui_detach_report` | opens the live report in its own window; returns its label |
| `gui_screenshot {window, path, dom?}` | real pixels via `PrintWindow` (or `dom: true` → html2canvas) |
| `gui_export_report_pdf {path, report_type?, page_size?, orientation?, project?}` | the standard live report (volledig/beperkt) as PDF via WebView2 `PrintToPdf`; refuses with a reason without a current calculation and check; settings apply to this export only; returns `{path, bytes, pages, sheets, report_type, pdf_base64}` — Windows only |
| `gui_build_3d_steel_hall {hal}` | builds a steel hall with the wizard's generator (same `hal` as `open_fem_3d_staalhal_maken`): one undo step, project load cases coupled, structural grid set |
| `gui_import_ifc_analysis_model {path, analysis_model?}` | imports an IFC4 structural analysis model as a new 3D project with the same import as the ribbon button "Rekenmodel importeren" and `open_fem_3d_ifc_importeren`; the app reads the file; returns the report |
| `gui_quit` | closes the app gracefully |


Every action returns only once the app *is* in the new state (store
subscriptions, not timers), and a failure carries the app's own message.

End-to-end example — the reinforcement workflow through the installed app,
with screenshots: `node design-mockup/referentie-gui/wapening-workflow.mjs`.

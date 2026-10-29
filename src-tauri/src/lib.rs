use frame3d_solver::{
    EngineInfo as Frame3DEngineInfo, SolveRequest3D as Frame3DSolveRequest,
    SolveResult3D as Frame3DSolveResult,
};
use open_fem_3d::{EngineInfo as OpenFem3DEngineInfo, SolveRequest3D, SolveResult3D};
use openaec_native_fem::dispatch::{NativeFemRequest, NativeFemResult};
use section_properties::opdracht::{Invoer as DoorsnedeInvoer, Uitvoer as DoorsnedeUitvoer};
use steel_profiles::SteelProfile;

/// Het bedieningskanaal van de app — alleen actief met de instelling
/// "Bediening door een AI-assistent toestaan (MCP)" of `OPENAEC_GUI_CONTROL=1`.
/// Geen rekenkern en dus geen drie-wegen-regel; zie de moduletekst.
///
/// `pub` omdat de unit-tests van `gui_control::rapport`, `::kanaal` en
/// `::instelling` in tests/ staan: de unit-testharnas van deze lib laadt op
/// Windows niet (zie build.rs).
pub mod gui_control;
use gui_control::GuiControl;
/// Een projectbestand openen dat het besturingssysteem aanreikt (dubbelklik,
/// "Openen met", een tweede start terwijl de app draait; issue #90). `pub`
/// om dezelfde reden als `gui_control`: de tests staan in tests/.
pub mod bestandskoppeling;
/// Een AI-assistent aan de app koppelen (issue #109): de meegeleverde
/// MCP-server vinden en hem in de config van Claude Desktop zetten. `pub` om
/// dezelfde reden als `gui_control`: de tests staan in tests/.
pub mod mcp_koppeling;
pub mod extensies;
use std::sync::Arc;
use tauri::Manager;

// De commands hieronder zijn één-op-één gespiegeld in `crates/toetsbrug`
// (dezelfde functies als JSON-in/JSON-uit voor de browser) en in de MCP-server
// `crates/openaec-mcp-server`. Wie hier een command toevoegt, voegt hem daar
// ook toe — anders werkt hij alleen in de desktop-app.
//
// Die drie lijsten worden tegen elkaar gehouden door
// `crates/openaec-mcp-server/tests/drie_wegen_kruistabel.rs`. Die test valt in
// beide richtingen om, dus een command dat maar twee wegen krijgt komt niet
// ongemerkt langs; wat bewust geen derde weg heeft, staat daar met reden in de
// uitzonderingslijst.

#[tauri::command]
fn list_steel_profiles() -> Vec<SteelProfile> {
    steel_profiles::db().all().to_vec()
}


/// Doorsnede-eigenschappen van een of meer geometrieën — de motor achter de
/// profieleditor.
///
/// Dezelfde rekengang als de binary `doorsnedemotor` en als het eindpunt
/// `/api/doorsnede` van de dev-server: alle drie roepen ze
/// `section_properties::opdracht::reken` aan. Zonder dit command werkte de
/// profieleditor alleen op de dev-server en bleef hij in de geïnstalleerde app
/// wachten op een motor die er niet was.
///
/// Eén geometrie die niet door de motor komt laat de hele aanroep falen, met
/// de naam erbij: een halve lijst met stilzwijgend ontbrekende doorsneden is
/// erger dan een duidelijke fout.
#[tauri::command]
async fn bereken_doorsneden(invoer: Vec<DoorsnedeInvoer>) -> Result<Vec<DoorsnedeUitvoer>, String> {
    let mut uit = Vec::with_capacity(invoer.len());
    for i in &invoer {
        match section_properties::opdracht::reken(i) {
            Ok(u) => uit.push(u),
            Err(e) => {
                let naam = i.naam();
                return Err(if naam.is_empty() {
                    e
                } else {
                    format!("{naam}: {e}")
                });
            }
        }
    }
    Ok(uit)
}


/// Beschikbare productie-engine voor ruimtelijke raamwerken. De descriptor
/// komt uit dezelfde adapter als de berekening, zodat versie en capaciteiten
/// in de instellingen niet los van de werkelijk meegebouwde kern kunnen raken.
#[tauri::command]
fn frame3d_engine_info() -> Frame3DEngineInfo {
    frame3d_solver::engine_info()
}

/// 3D-raamwerk (spoor `frame3d`): geversioneerde, strikte grens naar Dedaliano/Stabileo.
/// De standaardanalyse in het verzoek is directe tweede orde (P-Delta); de
/// adapter levert daarbij ook eigenknikresultaten als er drukstaven zijn.
#[tauri::command]
async fn solve_frame3d(input: Frame3DSolveRequest) -> Result<Frame3DSolveResult, String> {
    frame3d_solver::solve(input)
}

/// Experimentele eigen Rust-FEM-kern, met één contract voor alle elementtypen.
#[tauri::command]
async fn solve_native_fem(inputs: NativeFemRequest) -> Result<NativeFemResult, String> {
    openaec_native_fem::dispatch::solve_native_fem(inputs)
}

/// Descriptor van de Open FEM 3D-engine (zie `frame3d_engine_info`).
#[tauri::command]
fn open_fem_3d_engine_info() -> OpenFem3DEngineInfo {
    open_fem_3d::engine_info()
}

/// 3D-raamwerk: geversioneerde, strikte grens naar de externe 3D-kern.
/// De standaardanalyse in het verzoek is directe tweede orde (P-Delta); de
/// adapter levert daarbij ook eigenknikresultaten als er drukstaven zijn.
#[tauri::command]
async fn solve_open_fem_3d(input: SolveRequest3D) -> Result<SolveResult3D, String> {
    open_fem_3d::solve(input)
}

// ── Het bedieningskanaal ────────────────────────────────────────────────────
// Twee commands, dun: de logica staat in `gui_control`. Ze staan hier als
// functie omdat elke naam in `generate_handler!` een functie in dít bestand
// hoort te zijn — dat bewaakt `tests/drie_wegen_kruistabel.rs`, en die regel
// geldt voor deze twee net zo goed als voor de rekenkern-commands.

/// Staat het kanaal aan? De pagina vraagt dit bij het laden en luistert
/// alleen dan — in een gewone sessie kost `bediening.ts` niets.
#[tauri::command]
fn gui_control_actief(control: tauri::State<'_, Arc<GuiControl>>) -> bool {
    control.is_actief()
}

/// Het antwoord van de pagina op een opdracht met dit id.
#[tauri::command]
fn gui_control_antwoord(
    control: tauri::State<'_, Arc<GuiControl>>,
    id: u64,
    uitkomst: serde_json::Value,
) -> Result<(), String> {
    control.antwoord(id, uitkomst)
}

// ── Lokale importextensies (issue #83) ────────────────────────────────────
#[tauri::command]
fn extensies_lezen(app: tauri::AppHandle, mappen: Vec<String>) -> Result<Vec<extensies::GevondenExtensie>, String> {
    extensies::lezen(&app, mappen)
}

#[tauri::command]
fn extensie_script_lezen(map: String, main: String) -> Result<String, String> {
    extensies::script_lezen(map, main)
}

#[tauri::command]
fn extensie_bestand_lezen(app: tauri::AppHandle, pad: String, mappen: Vec<String>, ingeschakelde_ids: Vec<String>) -> Result<Vec<u8>, String> {
    extensies::bestand_lezen(&app, pad, mappen, ingeschakelde_ids)
}

#[tauri::command]
fn extensie_zip_installeren(app: tauri::AppHandle, zip_pad: String) -> Result<String, String> {
    extensies::zip_installeren(&app, zip_pad)
}

#[tauri::command]
fn extensie_verwijderen(app: tauri::AppHandle, map: String) -> Result<(), String> {
    extensies::verwijderen(&app, map)
}

// ── De schakelaar van het kanaal (issue #109) ───────────────────────────────
// Instellingen → AI-assistent (MCP): de keuze bewaren en het kanaal meteen
// starten of stoppen. Dun; de logica staat in `gui_control`.

/// Staat de bediening door een AI-assistent toe (bewaard), luistert het
/// kanaal, op welke poort, en waarom niet.
#[tauri::command]
fn gui_kanaal_status(control: tauri::State<'_, Arc<GuiControl>>) -> gui_control::KanaalStatus {
    control.status()
}

/// De schakelaar aan: bewaren en het kanaal starten.
#[tauri::command]
fn gui_kanaal_aan(
    app: tauri::AppHandle,
    control: tauri::State<'_, Arc<GuiControl>>,
) -> Result<gui_control::KanaalStatus, String> {
    control.zet_aan(&app)
}

/// De schakelaar uit: het kanaal stoppen (vindbestand weg) en bewaren.
#[tauri::command]
fn gui_kanaal_uit(
    app: tauri::AppHandle,
    control: tauri::State<'_, Arc<GuiControl>>,
) -> Result<gui_control::KanaalStatus, String> {
    control.zet_uit(&app)
}

// ── Een AI-assistent koppelen (issue #109) ──────────────────────────────────
// Geen rekenkern: het paneel AI-assistent (MCP) vraagt waar de meegeleverde
// MCP-server staat, en zet hem op een klik van de gebruiker in de config van
// Claude Desktop. De logica staat in `mcp_koppeling`.

/// Het pad van de MCP-server (of waar gezocht is), en de config van Claude Desktop.
#[tauri::command]
fn mcp_koppeling_info() -> mcp_koppeling::KoppelInfo {
    mcp_koppeling::info()
}

/// Zet de regel `open-fem-studio` in claude_desktop_config.json (met
/// reservekopie; ongeldige JSON wordt geweigerd). Alleen na een klik. Een
/// weigering komt als `{code, melding, config, regel, kolom}`, zodat het
/// paneel haar vertaalt.
#[tauri::command]
fn mcp_claude_desktop_toevoegen() -> Result<mcp_koppeling::KoppelUitkomst, mcp_koppeling::KoppelFout> {
    mcp_koppeling::voeg_toe_aan_claude_desktop()
}

// ── De bestandskoppeling ────────────────────────────────────────────────────
// Geen rekenkern: de pagina haalt hiermee op welke bestanden het
// besturingssysteem aanreikte. De logica staat in `bestandskoppeling`.

/// De paden die klaarstaan om te openen; de wachtrij is daarna leeg. De
/// pagina vraagt dit bij het laden en na elk event `bestandskoppeling:bestanden`.
#[tauri::command]
fn bestandskoppeling_ophalen(wachtrij: tauri::State<'_, bestandskoppeling::Wachtrij>) -> Vec<String> {
    wachtrij.haal_op()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    // EERSTE plugin: in een tweede start stopt hij het proces in zijn eigen
    // setup, vóór de andere plugins, het bedieningskanaal en een venster er
    // zijn; de bestanden van die start gaan naar de draaiende app. Niet in een
    // debugbuild en niet in een instantie met bedieningskanaal én eigen
    // vindbestand (een testscript); zie `bestandskoppeling::een_instantie_bewaken`.
    if bestandskoppeling::een_instantie_bewaken(
        cfg!(debug_assertions),
        gui_control::gevraagd(),
        gui_control::eigen_vindbestand().is_some(),
        bestandskoppeling::in_debug_gevraagd(),
    ) {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, werkmap| {
            bestandskoppeling::tweede_start(app, &argv, &werkmap);
        }));
    }
    builder
        .manage(bestandskoppeling::Wachtrij::default())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            list_steel_profiles,
            bereken_doorsneden,
            frame3d_engine_info,
            solve_frame3d,
            solve_native_fem,
            open_fem_3d_engine_info,
            solve_open_fem_3d,
            gui_control_actief,
            gui_control_antwoord,
            extensies_lezen,
            extensie_script_lezen,
            extensie_bestand_lezen,
            extensie_zip_installeren,
            extensie_verwijderen,
            gui_kanaal_status,
            gui_kanaal_aan,
            gui_kanaal_uit,
            mcp_koppeling_info,
            mcp_claude_desktop_toevoegen,
            bestandskoppeling_ophalen,
        ])
        .setup(|app| {
            // Zet het bedieningskanaal op, of niet — `start` kijkt zelf naar de
            // omgevingsvariabele en de bewaarde instelling, en levert anders
            // een kanaal dat "uit" zegt (en later aan kan).
            let control = gui_control::start(app.handle());
            app.manage(control);
            // Een bestand waarmee de app gestart is (dubbelklik in de
            // verkenner): klaarzetten tot de pagina het ophaalt.
            bestandskoppeling::eerste_start(app.handle());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| match &event {
            // Bij afsluiten het vindbestand weghalen: een achtergebleven
            // gui-control.json zou een client naar een dode poort sturen.
            tauri::RunEvent::Exit => {
                if let Some(control) = app.try_state::<Arc<GuiControl>>() {
                    control.opruimen();
                }
            }
            // macOS: een dubbelklik in Finder komt als URL's, niet via argv.
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Opened { urls } => {
                bestandskoppeling::geopend(app, urls);
            }
            _ => {}
        });
}

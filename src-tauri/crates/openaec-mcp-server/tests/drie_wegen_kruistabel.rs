//! De volledige kruistabel van de drie wegen — de bewaking op de projectregel
//! zelf.
//!
//! DE REGEL
//! Elke rekenkern in dit project hoort langs drie wegen bereikbaar te zijn:
//!
//! 1. een Tauri-command in `src-tauri/src/lib.rs` dat óók in
//!    `generate_handler!` staat (de desktop-app);
//! 2. een opdracht in `crates/toetsbrug` (de dev-server, `/api/toetsing`);
//! 3. een gereedschap in deze MCP-server.
//!
//! WAT ER TOT NU TOE ONTBRAK
//! Er was geen enkele bewaking op die tabel als geheel. Drie testbestanden
//! (`drie_wegen_beton.rs`, `drie_wegen_beff.rs`, `drie_wegen_dekking.rs`) kijken
//! wel naar `generate_handler!`, maar elk noemt met de hand een handvol
//! betonnamen. Een nieuwe rekenkern die maar twee wegen kreeg — precies wat er
//! met hout en kruislaaghout gebeurde — liep daar zonder één rood testresultaat
//! langs. Dit bestand houdt de drie NAMENLIJSTEN werkelijk tegen elkaar, en
//! valt in beide richtingen om: een command zonder toetsbrug-opdracht net zo
//! goed als een toetsbrug-opdracht zonder command.
//!
//! HOE DE DRIE LIJSTEN WORDEN GELEZEN
//! * **Weg 1** uit de BRON van `src-tauri/src/lib.rs`: de namen tussen
//!   `generate_handler![` en de sluithaak. Dat is de enige lijst die telt —
//!   een `#[tauri::command]` dat er niet in staat, bestaat voor de app niet.
//! * **Weg 2** uit de BRON van `crates/toetsbrug/src/lib.rs`: de patronen van
//!   de match-armen in `behandel`. Dat is letterlijk de lijst die de dev-server
//!   accepteert.
//! * **Weg 3** uit de DRAAIENDE server: de test start de werkelijke binary en
//!   vraagt `tools/list`. Er wordt niets nagebouwd.
//!
//! DE KOPPELTABEL IS MET OPZET HANDWERK
//!
//! WAT GEEN DRIE WEGEN HEEFT, STAAT IN [`UITZONDERINGEN`] MET REDEN
//! Stilzwijgend overslaan mag niet: dan is een openstaand gat niet te
//! onderscheiden van iets dat bewust maar één weg heeft. Elke onvolledige rij
//! draagt daarom een reden, en die reden zegt of het om programmawerk gaat dat
//! langs een andere weg geen betekenis heeft (een bestandspad bestaat in een
//! browser niet) of om een gat dat gewoon nog open staat.

use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::process::Stdio;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::time::timeout;

const BIN_PATH: &str = env!("CARGO_BIN_EXE_openaec-mcp-server");

// ── De koppeltabel ──────────────────────────────────────────────────────────

/// Eén rekenkern, met zijn naam langs elk van de drie wegen.
struct Rij {
    /// Het Tauri-command zoals het in `generate_handler!` staat.
    tauri: Option<&'static str>,
    /// De opdracht van `toetsbrug::behandel`.
    toetsbrug: Option<&'static str>,
    /// Het gereedschap in `tools/list` van deze server.
    mcp: Option<&'static str>,
    /// Waarom een weg ontbreekt. Leeg bij een volledige rij; verplicht — en
    /// een hele zin — bij een rij in [`UITZONDERINGEN`].
    reden: &'static str,
}

/// De rekenkernen die alle drie de wegen hebben.
///
/// De drie kolommen zijn drie los van elkaar gelezen namenlijsten; dat ze
/// hier op één regel staan is de enige plek waar de koppeling wordt
/// vastgelegd.
const KRUISTABEL: &[Rij] = &[
    Rij {
        tauri: Some("solve_native_fem"),
        toetsbrug: Some("solve_native_fem"),
        mcp: Some("solve_native_fem"),
        reden: "",
    },
    Rij {
        tauri: Some("list_steel_profiles"),
        toetsbrug: Some("list_steel_profiles"),
        mcp: Some("list_steel_profiles"),
        reden: "",
    },
];


/// Wat geen drie wegen heeft — met de reden erbij.
///
/// Twee soorten redenen, en het verschil is belangrijk:
/// - programmawerk dat langs een andere weg geen betekenis heeft (een pad naar
///   een bestand op schijf bestaat in een browser niet), en
/// - een gat dat gewoon nog open staat. Dat mag hier staan, maar niet
///   stilzwijgend.
/// De reden voor elke `gui_*`-rij hieronder. Eén tekst, want het is één
/// argument: dit zijn geen rekenkern-opdrachten.
const BEDIENING_REDEN: &str =
    "Bedieningsopdracht, geen rekenkern-opdracht: de gui_*-tools sturen de draaiende \
     desktop-app aan over haar bedieningskanaal (src-tauri/src/gui_control.rs) en zíjn daarmee \
     de weg naar de GUI. Er wordt niets gerekend dat langs de toetsbrug of een Tauri-command \
     zou moeten kunnen; de app is de enige plek waar een korf gezet of een venster geopend \
     kan worden.";

/// Waarom de API-tools (één per commando van het app-register) als groep buiten
/// de koppeltabel staan. Het zijn geen rekenkern-opdrachten maar de commando's
/// van de app zelf (`design-mockup/src/api/`): dezelfde zuivere modelfuncties als
/// de GUI, zonder app uitgevoerd in de sidecar of in de draaiende app via het
/// bedieningskanaal. Een Tauri-command of toetsbrugopdracht zou een tweede
/// toegang tot dezelfde functie zijn. Hun namen komen uit de ingebakken
/// catalogus (`assets/api-catalogus.json`), niet uit een lijst hier; daarom per
/// groep en niet per rij.
const API_REDEN: &str =
    "Commando van het app-register (src/api/): geen rekenkern-opdracht en daarmee buiten de \
     drie-wegen-regel; de catalogus is de bron.";

/// De MCP-namen van de API-commando's, uit dezelfde catalogus als de server.
fn api_tools_uit_de_catalogus() -> Vec<String> {
    let catalogus: serde_json::Value = serde_json::from_str(include_str!("../assets/api-catalogus.json"))
        .expect("assets/api-catalogus.json is geldige JSON");
    catalogus["commands"]
        .as_array()
        .expect("commands")
        .iter()
        .map(|c| c["name"].as_str().expect("naam").replace('.', "_"))
        .collect()
}

/// De reden voor de twee Tauri-commands van het kanaal zelf.
const KANAAL_REDEN: &str =
    "Het bedieningskanaal zelf: hiermee vraagt de pagina aan Rust of het kanaal aanstaat, en \
     meldt zij wat een opdracht opleverde. Geen rekenkern; de toetsbrug en de MCP-server hebben \
     er niets aan.";

/// De reden voor de drie commands van de schakelaar (issue #109).
const SCHAKELAAR_REDEN: &str =
    "De schakelaar van het bedieningskanaal zelf (Instellingen → AI-assistent (MCP)): de pagina \
     bewaart hiermee of een AI-assistent de app mag bedienen en zet het kanaal meteen aan of uit. \
     Programmawerk van de desktop-app; er wordt niets gerekend, en een MCP-client hoort het kanaal \
     niet zelf aan te kunnen zetten.";

/// De reden voor de twee commands van het koppelpaneel (issue #109).
const KOPPELING_REDEN: &str =
    "Programmawerk van de desktop-app: het paneel AI-assistent (MCP) vraagt waar de meegeleverde \
     MCP-server staat en zet hem op een klik van de gebruiker in de config van Claude Desktop. Er \
     wordt niets gerekend; de toetsbrug en de MCP-server hebben er niets aan.";

/// De reden voor het command van de bestandskoppeling (issue #90).
const BESTANDSKOPPELING_REDEN: &str =
    "Programmawerk van de desktop-app: de pagina haalt hiermee op welke projectbestanden het \
     besturingssysteem aanreikte (dubbelklik, Openen met, een tweede start). Een browser of een \
     MCP-client heeft geen bestandskoppeling; er wordt niets gerekend.";

const EXTENSIE_REDEN: &str =
    "Programmawerk van de desktop-app: lokale extensiemappen scannen, hun scripts en toegestane \
     importbestanden lezen, ZIP-installatie en verwijderen. Er wordt niets gerekend; de MCP-server \
     gebruikt zijn eigen extensiepad zonder deze Tauri-commando's.";

const UITZONDERINGEN: &[Rij] = &[
    // ── Het bedieningskanaal (gui_control.rs) en zijn MCP-tools ──────────────
    Rij { tauri: Some("gui_control_actief"), toetsbrug: None, mcp: None, reden: KANAAL_REDEN },
    Rij { tauri: Some("gui_control_antwoord"), toetsbrug: None, mcp: None, reden: KANAAL_REDEN },
    // De schakelaar van het kanaal (issue #109): Instellingen → AI-assistent (MCP).
    Rij { tauri: Some("gui_kanaal_status"), toetsbrug: None, mcp: None, reden: SCHAKELAAR_REDEN },
    Rij { tauri: Some("gui_kanaal_aan"), toetsbrug: None, mcp: None, reden: SCHAKELAAR_REDEN },
    Rij { tauri: Some("gui_kanaal_uit"), toetsbrug: None, mcp: None, reden: SCHAKELAAR_REDEN },
    // ── Een AI-assistent koppelen (mcp_koppeling.rs, issue #109) ─────────────
    Rij { tauri: Some("mcp_koppeling_info"), toetsbrug: None, mcp: None, reden: KOPPELING_REDEN },
    Rij { tauri: Some("mcp_claude_desktop_toevoegen"), toetsbrug: None, mcp: None, reden: KOPPELING_REDEN },
    // ── De bestandskoppeling (bestandskoppeling.rs) ──────────────────────────
    Rij { tauri: Some("bestandskoppeling_ophalen"), toetsbrug: None, mcp: None, reden: BESTANDSKOPPELING_REDEN },
    Rij { tauri: Some("extensies_lezen"), toetsbrug: None, mcp: None, reden: EXTENSIE_REDEN },
    Rij { tauri: Some("extensie_script_lezen"), toetsbrug: None, mcp: None, reden: EXTENSIE_REDEN },
    Rij { tauri: Some("extensie_bestand_lezen"), toetsbrug: None, mcp: None, reden: EXTENSIE_REDEN },
    Rij { tauri: Some("extensie_zip_installeren"), toetsbrug: None, mcp: None, reden: EXTENSIE_REDEN },
    Rij { tauri: Some("extensie_verwijderen"), toetsbrug: None, mcp: None, reden: EXTENSIE_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("project_import"), reden: EXTENSIE_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_status"), reden: BEDIENING_REDEN },
    // Start de geïnstalleerde app met het kanaal aan als hij nog niet draait (issue #109).
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_start_app"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_load_model"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_build_model"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_build_3d_model"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_build_3d_steel_hall"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_import_ifc_analysis_model"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_configure_3d_view"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_select_3d_combination"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_select_member"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_select_3d_plate"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_split_3d_member"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_set_cage"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_set_analysis"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_solve"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_set_view"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_detach_report"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_screenshot"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_export_report_pdf"), reden: BEDIENING_REDEN },
    Rij { tauri: None, toetsbrug: None, mcp: Some("gui_quit"), reden: BEDIENING_REDEN },
    Rij {
        tauri: Some("solve_frame3d"),
        toetsbrug: None,
        mcp: Some("solve_frame3d"),
        reden: "De 3D-raamwerkkern is rechtstreeks beschikbaar in de desktop-app en in MCP. De ontwikkelbrowser roept hetzelfde versievaste contract via /api/frame3d/solve aan; die HTTP-route loopt buiten de algemene toetsbrug omdat zij een eigen Rust-binary met tweede-orde- en knikanalyse gebruikt.",
    },
    Rij {
        tauri: Some("frame3d_engine_info"),
        toetsbrug: None,
        mcp: None,
        reden: "Metadata-command voor de solverregistratie van de desktop-app. De MCP-tool solve_frame3d levert dezelfde engine-id, revisie en licentie in ieder rekenresultaat; een afzonderlijke toetsbrug- of MCP-opdracht voegt daarom geen rekenroute toe.",
    },
    Rij {
        tauri: Some("solve_open_fem_3d"),
        toetsbrug: None,
        mcp: Some("solve_open_fem_3d"),
        reden: "De 3D-raamwerkkern is rechtstreeks beschikbaar in de desktop-app en in MCP. De ontwikkelbrowser roept hetzelfde versievaste contract via /api/openFem3d/solve aan; die HTTP-route loopt buiten de algemene toetsbrug omdat zij een eigen Rust-binary met tweede-orde- en knikanalyse gebruikt.",
    },
    Rij {
        tauri: None,
        toetsbrug: None,
        mcp: Some("open_fem_3d_staalhal_maken"),
        reden: "Geen eigen rekenkern: de hal komt uit de TypeScript-generator van de wizard, die in de app zelf draait en voor MCP in de solverbundel. Het rekenen en toetsen erachter gaat door `open_fem_3d::solve` en `steel_check::check_all_beams`, die als `solve_open_fem_3d` en `check_steel_beams` al langs hun wegen bereikbaar zijn; in de app bouwt de wizard het model en rekent de knop Berekenen.",
    },
    Rij {
        tauri: None,
        toetsbrug: None,
        mcp: Some("open_fem_3d_ifc_importeren"),
        reden: "Geen eigen rekenkern: de import van een IFC4-analysemodel is de TypeScript-functie achter de knop \"Rekenmodel importeren\", die in de app zelf draait en voor MCP in de solverbundel. Het rekenen en toetsen erachter gaat door `open_fem_3d::solve` en `steel_check::check_all_beams`, die als `solve_open_fem_3d` en `check_steel_beams` al langs hun wegen bereikbaar zijn; in de app importeert de knop het model en rekent de knop Berekenen.",
    },
    Rij {
        tauri: None,
        toetsbrug: None,
        mcp: Some("fem_resultaten_ifc_schrijven"),
        reden: "Geen eigen rekenkern: het .ifcfemresults-bestand (issue #87) bouwt de TypeScript-functie `bouwIfcResultaten` achter de exportkaart \"Resultaten (.ifcfemresults)\", die in de app zelf draait en voor MCP in de solverbundel. Het rekenen ervoor is `rekenDoor`, dezelfde doorrekening als solve_fem_model; een Tauri-command of toetsbrugopdracht zou geen rekenroute toevoegen.",
    },
    Rij {
        tauri: None,
        toetsbrug: None,
        mcp: Some("fem_resultaten_ifc_lezen"),
        reden: "Geen eigen rekenkern: het teruglezen van een .ifcfemresults-bestand is de TypeScript-functie `leesIfcResultaten`, die de app bij Openen zelf gebruikt en die voor MCP in de solverbundel staat. Er wordt niets gerekend.",
    },
    Rij {
        tauri: Some("open_fem_3d_engine_info"),
        toetsbrug: None,
        mcp: None,
        reden: "Metadata-command voor de solverregistratie van de desktop-app. De MCP-tool solve_open_fem_3d levert dezelfde engine-id, revisie en licentie in ieder rekenresultaat; een afzonderlijke toetsbrug- of MCP-opdracht voegt daarom geen rekenroute toe.",
    },
    Rij {
        tauri: Some("bereken_doorsneden"),
        toetsbrug: None,
        mcp: None,
        reden: "De tweede weg loopt hier niet via de toetsbrug maar via de losse binary `doorsnedemotor`, die de dev-server op `/api/doorsnede` aanroept; beide voeren `section_properties::opdracht::reken` uit. De derde weg ontbreekt: er is geen MCP-gereedschap dat een vrij opgegeven geometrie doorrekent.",
    },
    Rij {
        tauri: None,
        toetsbrug: None,
        mcp: Some("compute_section_properties"),
        reden: "Alleen MCP. Rekent de doorsnedegrootheden opnieuw uit de CATALOGUSgeometrie van een profielnaam; de app heeft daar geen command voor omdat zij de catalogus zelf al draagt. Het verwante `bereken_doorsneden` is niet hetzelfde: dat neemt een vrij opgegeven geometrie.",
    },
    Rij {
        tauri: None,
        toetsbrug: None,
        mcp: Some("fem_solver_status"),
        reden: "Zuiver programmawerk van deze server: het meldt of er een Node-runtime is en of de ingebakken solverbundel bij de protocolversie past. De app en de dev-server draaien diezelfde solver in hun eigen runtime en hebben geen sidecar om te diagnosticeren.",
    },
    Rij {
        tauri: None,
        toetsbrug: None,
        mcp: Some("load_fem_project"),
        reden: "Zuiver programmawerk: het leest een .ifcfem2d van een pad op schijf. De app opent bestanden via haar eigen dialoog en een browser kent geen bestandspaden, dus langs die twee wegen heeft dit geen betekenis.",
    },
    Rij {
        tauri: None,
        toetsbrug: None,
        mcp: Some("validate_fem_model"),
        reden: "Geen rekenkern in Rust: de controle draait in de solverbundel, die in de app en op de dev-server al in de eigen runtime meedraait. Dit gereedschap is de weg naar diezelfde bundel voor een client buiten de app.",
    },
    Rij {
        tauri: None,
        toetsbrug: None,
        mcp: Some("solve_fem_model"),
        reden: "Geen rekenkern in Rust: de solve draait in de solverbundel, dezelfde die de app in haar eigen runtime uitvoert. Er is dus niets om als Tauri-command of toetsbrug-opdracht aan te bieden.",
    },
];


fn alle_rijen() -> Vec<&'static Rij> {
    #[allow(unused_mut)]
    let mut rijen: Vec<&'static Rij> = KRUISTABEL.iter().chain(UITZONDERINGEN.iter()).collect();
    rijen
}

/// Volledige rijen (alle drie de wegen) en uitzonderingen van deze build.
fn volledige_rijen() -> Vec<&'static Rij> {
    #[allow(unused_mut)]
    let mut rijen: Vec<&'static Rij> = KRUISTABEL.iter().collect();
    rijen
}

fn uitzonderingsrijen() -> Vec<&'static Rij> {
    #[allow(unused_mut)]
    let mut rijen: Vec<&'static Rij> = UITZONDERINGEN.iter().collect();
    rijen
}

// ── De drie lijsten lezen ───────────────────────────────────────────────────

/// De bron zoals DEZE build hem compileert.
fn zoals_deze_build(bron: String) -> String {
    bron
}

fn bron(pad: &[&str]) -> String {
    let mut p = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    for deel in pad {
        p.push(deel);
    }
    std::fs::read_to_string(&p).unwrap_or_else(|e| panic!("{} niet leesbaar: {e}", p.display()))
}

/// Weg 1: de namen tussen `generate_handler![` en de sluithaak.
///
/// Per regel: commentaarregels (o.a. de editiemarkeringen) tellen niet, en
/// een attribuut vóór de naam (`#[cfg(…)] naam,`) wordt eraf gehaald.
fn tauri_commands() -> Vec<String> {
    let bron = zoals_deze_build(bron(&["..", "..", "src", "lib.rs"]));
    let start = bron
        .find("generate_handler![")
        .expect("`generate_handler!` staat niet in src-tauri/src/lib.rs");
    let na = &bron[start + "generate_handler![".len()..];
    let mut namen = Vec::new();
    let mut gesloten = false;
    for regel in na.lines() {
        let mut t = regel.trim();
        if t.starts_with(']') {
            gesloten = true;
            break;
        }
        if t.is_empty() || t.starts_with("//") {
            continue;
        }
        while t.starts_with("#[") {
            let eind = t.find(']').expect("attribuut zonder sluithaak in `generate_handler!`");
            t = t[eind + 1..].trim_start();
        }
        namen.extend(t.split(',').map(str::trim).filter(|s| !s.is_empty()).map(str::to_owned));
    }
    assert!(gesloten, "`generate_handler!` is niet gesloten");
    namen
}

/// Weg 2: de patronen van de match-armen in `toetsbrug::behandel`.
///
/// Een arm is een regel die met een aanhalingsteken begint en verderop een
/// `=>` heeft; alles wat vóór die pijl tussen aanhalingstekens staat is een
/// opdrachtnaam, zodat ook een arm met meerdere patronen (`"a" | "b" =>`)
/// volledig wordt gelezen. De armen zijn de enige regels in dat bestand die zo
/// beginnen — een tekst binnen een uitdrukking staat altijd achter code.
fn toetsbrug_opdrachten() -> Vec<String> {
    let bron = zoals_deze_build(bron(&["..", "toetsbrug", "src", "lib.rs"]));
    let mut namen = Vec::new();
    for regel in bron.lines() {
        let t = regel.trim();
        if !t.starts_with('"') {
            continue;
        }
        let Some(pijl) = t.find("=>") else { continue };
        let mut rest = &t[..pijl];
        while let Some(begin) = rest.find('"') {
            let na = &rest[begin + 1..];
            let Some(eind) = na.find('"') else { break };
            namen.push(na[..eind].to_owned());
            rest = &na[eind + 1..];
        }
    }
    assert!(
        !namen.is_empty(),
        "geen enkele opdracht gevonden in crates/toetsbrug/src/lib.rs — is `behandel` van vorm veranderd?"
    );
    namen
}

/// Weg 3: `tools/list` van de werkelijk draaiende server.
async fn mcp_gereedschappen() -> Vec<String> {
    let (mut child, mut stdin, mut reader) = start_server().await;
    schrijf(
        &mut stdin,
        json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }),
    )
    .await;
    let resp = lees_bericht(&mut reader).await;
    assert!(resp["error"].is_null(), "tools/list gaf een fout: {resp:?}");
    let namen: Vec<String> = resp["result"]["tools"]
        .as_array()
        .expect("tools/list levert een array")
        .iter()
        .map(|t| {
            t["name"]
                .as_str()
                .expect("elk gereedschap heeft een naam")
                .to_owned()
        })
        .collect();
    let _ = child.kill().await;
    namen
}

// ── De MCP-server over stdio ────────────────────────────────────────────────

async fn lees_bericht<R>(reader: &mut R) -> Value
where
    R: AsyncBufReadExt + Unpin,
{
    let mut regel = String::new();
    let n = timeout(Duration::from_secs(60), reader.read_line(&mut regel))
        .await
        .expect("timeout bij het wachten op een antwoord")
        .expect("read_line mislukt");
    assert!(n > 0, "EOF op stdout — de server is onverwacht gestopt");
    serde_json::from_str(regel.trim())
        .unwrap_or_else(|e| panic!("ongeldige JSON-RPC-regel {regel:?}: {e}"))
}

async fn schrijf(stdin: &mut ChildStdin, waarde: Value) {
    let mut regel = serde_json::to_string(&waarde).unwrap();
    regel.push('\n');
    stdin.write_all(regel.as_bytes()).await.unwrap();
    stdin.flush().await.unwrap();
}

async fn start_server() -> (Child, ChildStdin, BufReader<ChildStdout>) {
    let mut child = Command::new(BIN_PATH)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("server starten");
    let mut stdin = child.stdin.take().expect("stdin");
    let stdout = child.stdout.take().expect("stdout");
    let mut reader = BufReader::new(stdout);

    schrijf(
        &mut stdin,
        json!({
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": { "name": "drie-wegen-kruistabel", "version": "0.0.0" }
            }
        }),
    )
    .await;
    let resp = lees_bericht(&mut reader).await;
    assert!(resp["error"].is_null(), "initialize gaf een fout: {resp:?}");

    (child, stdin, reader)
}

// ── Vergelijking ────────────────────────────────────────────────────────────

/// Houdt één kolom van de koppeltabel tegen één werkelijke namenlijst.
///
/// Valt in BEIDE richtingen om:
/// - een naam in de lijst die in geen enkele rij voorkomt (iemand heeft een
///   weg toegevoegd zonder de andere twee te regelen);
/// - een naam in de tabel die niet meer in de lijst staat (iemand heeft een weg
///   hernoemd of weggehaald).
fn vergelijk_kolom(
    kolom: &str,
    uit_de_tabel: impl Fn(&Rij) -> Option<&'static str>,
    werkelijk: &[String],
    waar: &str,
) {
    let mut tabel: BTreeMap<&str, usize> = BTreeMap::new();
    for rij in alle_rijen() {
        if let Some(naam) = uit_de_tabel(rij) {
            *tabel.entry(naam).or_insert(0) += 1;
        }
    }
    for (naam, aantal) in &tabel {
        assert_eq!(
            *aantal, 1,
            "`{naam}` staat {aantal} keer in de kolom {kolom} van de koppeltabel; \
             elke naam hoort bij precies één rekenkern"
        );
    }

    let ontbreekt_in_de_tabel: Vec<&String> = werkelijk
        .iter()
        .filter(|n| !tabel.contains_key(n.as_str()))
        .collect();
    assert!(
        ontbreekt_in_de_tabel.is_empty(),
        "{waar} kent {ontbreekt_in_de_tabel:?}, maar die staan niet in de koppeltabel van \
         tests/drie_wegen_kruistabel.rs. Zet ze in KRUISTABEL met hun naam langs alle drie de \
         wegen, of — als een weg bewust ontbreekt — in UITZONDERINGEN mét de reden."
    );

    let bestaat_niet_meer: Vec<&str> = tabel
        .keys()
        .filter(|n| !werkelijk.iter().any(|w| w == *n))
        .copied()
        .collect();
    assert!(
        bestaat_niet_meer.is_empty(),
        "de koppeltabel noemt {bestaat_niet_meer:?} in de kolom {kolom}, maar {waar} kent die \
         naam niet (meer). Hernoemd of weggehaald? Werk de tabel bij."
    );
}

// ── De tests ────────────────────────────────────────────────────────────────

/// De kern van dit bestand: de drie werkelijke namenlijsten tegen de
/// koppeltabel, kolom voor kolom en in beide richtingen.
#[tokio::test]
async fn de_drie_namenlijsten_dekken_elkaar() {
    let commands = tauri_commands();
    let opdrachten = toetsbrug_opdrachten();
    let alle_gereedschappen = mcp_gereedschappen().await;

    // De API-tools als groep (zie API_REDEN): elk commando uit de catalogus
    // staat in tools/list, en geen rij van de koppeltabel draagt zo'n naam.
    let api = api_tools_uit_de_catalogus();
    for naam in &api {
        assert!(alle_gereedschappen.contains(naam), "API-tool `{naam}` uit de catalogus ontbreekt in tools/list");
        assert!(
            !alle_rijen().iter().any(|r| r.mcp == Some(naam.as_str())),
            "`{naam}` is een API-tool uit de catalogus en hoort niet in de koppeltabel. {API_REDEN}"
        );
    }
    let gereedschappen: Vec<String> = alle_gereedschappen.into_iter().filter(|n| !api.contains(n)).collect();

    vergelijk_kolom(
        "tauri",
        |r| r.tauri,
        &commands,
        "`generate_handler!` in src-tauri/src/lib.rs",
    );
    vergelijk_kolom(
        "toetsbrug",
        |r| r.toetsbrug,
        &opdrachten,
        "`behandel` in crates/toetsbrug/src/lib.rs",
    );
    vergelijk_kolom(
        "mcp",
        |r| r.mcp,
        &gereedschappen,
        "`tools/list` van de MCP-server",
    );
}

/// Een command dat wel als functie bestaat maar niet in `generate_handler!`
/// staat, bestaat voor de app niet — en geen enkele Rust-test merkt dat.
/// Andersom: een naam in `generate_handler!` zonder functie is een
/// compilatiefout, dus die kant hoeft hier niet.
#[test]
fn elk_geregistreerd_command_bestaat_ook_als_functie() {
    let bron = bron(&["..", "..", "src", "lib.rs"]);
    for command in tauri_commands() {
        assert!(
            bron.contains(&format!("fn {command}(")),
            "`{command}` staat in generate_handler! maar er is geen functie `{command}` in \
             src-tauri/src/lib.rs"
        );
    }
}

/// De indeling van de tabel klopt met zichzelf: in [`KRUISTABEL`] staan alleen
/// volledige rijen (en die dragen geen reden, want er valt niets uit te
/// leggen), in [`UITZONDERINGEN`] alleen onvolledige (en die dragen er wél
/// een).
///
/// Waarom dit een aparte test is: zonder deze controle zou een onvolledige rij
/// ongemerkt in KRUISTABEL kunnen belanden, en dan zou een ontbrekende weg er
/// als een volledige uitzien.
#[test]
fn de_tabel_scheidt_volledige_rijen_van_uitzonderingen() {
    for rij in volledige_rijen() {
        let naam = rij.tauri.or(rij.toetsbrug).or(rij.mcp).expect("lege rij");
        assert!(
            rij.tauri.is_some() && rij.toetsbrug.is_some() && rij.mcp.is_some(),
            "`{naam}` staat in KRUISTABEL maar mist een weg; hij hoort in UITZONDERINGEN"
        );
        assert!(
            rij.reden.is_empty(),
            "`{naam}` heeft alle drie de wegen, dus de reden hoort leeg te zijn"
        );
    }
    for rij in uitzonderingsrijen() {
        let naam = rij.tauri.or(rij.toetsbrug).or(rij.mcp).expect("lege rij");
        assert!(
            rij.tauri.is_none() || rij.toetsbrug.is_none() || rij.mcp.is_none(),
            "`{naam}` heeft alle drie de wegen en hoort dus in KRUISTABEL"
        );
        // Een reden van drie woorden legt niets uit. De ondergrens is grof
        // gekozen; het gaat erom dat er een zin staat en geen streepje.
        assert!(
            rij.reden.len() >= 60,
            "`{naam}` mist een bruikbare reden; schrijf op of dit programmawerk is dat langs een \
             andere weg geen betekenis heeft, of een gat dat nog open staat"
        );
    }
}

/// Elke rekenkern staat onder één naam in de tabel, ook als die naam per weg
/// verschilt. Twee rijen die hetzelfde gereedschap claimen zou betekenen dat
/// een gat achter een dubbele koppeling wegvalt.
#[test]
fn geen_enkele_rij_is_helemaal_leeg() {
    for (i, rij) in alle_rijen().iter().enumerate() {
        assert!(
            rij.tauri.is_some() || rij.toetsbrug.is_some() || rij.mcp.is_some(),
            "rij {i} van de koppeltabel noemt geen enkele weg"
        );
    }
}


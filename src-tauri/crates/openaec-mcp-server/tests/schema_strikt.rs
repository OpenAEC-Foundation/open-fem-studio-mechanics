//! Strikt schema en strikte invoer voor de MCP-tools.
//!
//! De test drijft de echte binary over stdio, net als `stdio_roundtrip.rs`.

use serde_json::{json, Value};
use std::process::Stdio;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::time::timeout;

const BIN_PATH: &str = env!("CARGO_BIN_EXE_openaec-mcp-server");

/// Lees één regel JSON-RPC en ontleed hem. Ruime timeout: de eerste aanroep
/// initialiseert de profielendatabase.
async fn lees_bericht<R>(reader: &mut R) -> Value
where
    R: AsyncBufReadExt + Unpin,
{
    let mut regel = String::new();
    let n = timeout(Duration::from_secs(30), reader.read_line(&mut regel))
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

/// Start de server en doe de `initialize`-handshake.
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
                "clientInfo": { "name": "schema-strikt-test", "version": "0.0.0" }
            }
        }),
    )
    .await;
    let resp = lees_bericht(&mut reader).await;
    assert_eq!(resp["id"], 1);
    assert!(resp["error"].is_null(), "initialize gaf een fout: {resp:?}");

    (child, stdin, reader)
}


/// Roep één tool aan en geef het `result`-object terug.
async fn roep_tool_aan(
    stdin: &mut ChildStdin,
    reader: &mut BufReader<ChildStdout>,
    id: u32,
    tool: &str,
    argumenten: Value,
) -> Value {
    schrijf(
        stdin,
        json!({
            "jsonrpc": "2.0", "id": id, "method": "tools/call",
            "params": { "name": tool, "arguments": argumenten }
        }),
    )
    .await;
    let resp = lees_bericht(reader).await;
    assert_eq!(resp["id"], id);
    resp["result"].clone()
}


/// Eén tooldefinitie uit `tools/list`.
async fn tooldefinitie(
    stdin: &mut ChildStdin,
    reader: &mut BufReader<ChildStdout>,
    id: u32,
    naam: &str,
) -> Value {
    schrijf(
        stdin,
        json!({ "jsonrpc": "2.0", "id": id, "method": "tools/list", "params": {} }),
    )
    .await;
    let resp = lees_bericht(reader).await;
    resp["result"]["tools"]
        .as_array()
        .expect("tools is een array")
        .iter()
        .find(|t| t["name"] == naam)
        .unwrap_or_else(|| panic!("{naam} ontbreekt in tools/list"))
        .clone()
}

/// De foutmelding zoals de client hem te zien krijgt.
fn foutmelding(result: &Value) -> String {
    result["content"][0]["text"]
        .as_str()
        .unwrap_or("")
        .to_string()
}

// ── 1. Het schema zelf ──────────────────────────────────────────────────────


/// Het kenmerk `eigenGewicht` van een belastinggeval (issue #42) staat in het
/// STRIKTE schema van de belastinggevallen, in elke tool die een model
/// aanneemt: `additionalProperties: false` op het geval, en het veld zelf
/// alleen `true`. Zonder het veld in het schema zou een client het kenmerk
/// niet kunnen meesturen (strikt = geweigerd); met `false` toegestaan zou
/// "geen kenmerk" twee spellingen hebben, en stuurt een model met
/// `eigenGewicht: false` het eigen gewicht stil naar het eerste blijvende
/// geval. De rekenkant staat in `eigen_gewicht_geval_mcp.rs`.
#[tokio::test]
async fn schema_van_de_belastinggevallen_kent_het_kenmerk_eigen_gewicht_strikt() {
    let (mut child, mut stdin, mut reader) = start_server().await;
    #[allow(unused_mut)]
    let mut namen = vec!["solve_fem_model", "validate_fem_model"];
    for (i, naam) in namen.iter().enumerate() {
        let tool = tooldefinitie(&mut stdin, &mut reader, 60 + i as u32, naam).await;
        let geval = &tool["inputSchema"]["properties"]["model"]["properties"]["loadCases"]["items"];
        assert_eq!(
            geval["additionalProperties"],
            json!(false),
            "{naam}: het schema van een belastinggeval hoort strikt te zijn: {geval}"
        );
        let veld = &geval["properties"]["eigenGewicht"];
        assert_eq!(
            veld["type"],
            json!("boolean"),
            "{naam}: eigenGewicht ontbreekt: {geval}"
        );
        assert_eq!(
            veld["enum"],
            json!([true]),
            "{naam}: alleen true is toegestaan: {veld}"
        );
        let zelf_gewicht =
            &tool["inputSchema"]["properties"]["model"]["properties"]["selfWeightEnabled"];
        assert!(
            zelf_gewicht["description"]
                .as_str()
                .unwrap_or("")
                .contains("eigenGewicht"),
            "{naam}: selfWeightEnabled hoort naar het kenmerk te verwijzen: {zelf_gewicht}"
        );
    }
    drop(stdin);
    let _ = timeout(Duration::from_secs(5), child.wait()).await;
}
/// Belastingvlakken in het 3D-model van de app (`gui_build_3d_model`): het
/// schema zoals een client het via `tools/list` ziet, is strikt op elk niveau.
/// Zonder `additionalProperties: false` zou een tikfout als `distrbution` stil
/// wegvallen, en zonder vaste keuzelijsten zou een onbekende lastrichting pas
/// in de app opvallen. De app keurt hetzelfde nog eens in
/// `parseOpenFem3DModel`; de afdracht zelf bewaakt
/// design-mockup/test-open-fem3d-belastingvlak.mjs.
#[tokio::test]
async fn schema_van_de_belastingvlakken_in_het_3d_model_is_strikt() {
    let (mut child, mut stdin, mut reader) = start_server().await;
    let tool = tooldefinitie(&mut stdin, &mut reader, 90, "gui_build_3d_model").await;
    let schema = &tool["inputSchema"];
    assert_eq!(schema["additionalProperties"], json!(false));
    let vlakken = &schema["properties"]["load_panels"];
    assert_eq!(vlakken["type"], json!("array"));
    let vlak = &vlakken["items"];
    assert_eq!(vlak["additionalProperties"], json!(false), "een belastingvlak hoort strikt te zijn: {vlak}");
    assert_eq!(vlak["required"], json!(["nodes", "q", "direction", "distribution"]));
    assert_eq!(vlak["properties"]["direction"]["enum"], json!(["gravity", "normal", "verticalSurface"]));
    assert_eq!(vlak["properties"]["distribution"]["enum"], json!(["oneWay", "twoWay"]));
    assert_eq!(vlak["properties"]["span_direction"]["additionalProperties"], json!(false));
    assert_eq!(vlak["properties"]["span_direction"]["required"], json!(["x", "y", "z"]));
    for veld in ["nodes", "case_id", "q", "direction", "distribution", "span_direction", "excluded_beams"] {
        assert!(vlak["properties"].get(veld).is_some(), "{veld} ontbreekt in het schema van een belastingvlak");
    }
    let beschrijving = vlakken["description"].as_str().unwrap_or("");
    for woord in ["HORIZONTAL PROJECTION", "per m² panel", "45-degree", "nearest beam"] {
        assert!(beschrijving.contains(woord), "de beschrijving hoort {woord:?} uit te leggen: {beschrijving}");
    }
    let weergave = tooldefinitie(&mut stdin, &mut reader, 91, "gui_configure_3d_view").await;
    assert_eq!(
        weergave["inputSchema"]["properties"]["visibility"]["properties"]["loadPanels"]["type"],
        json!("boolean"),
        "de zichtbaarheid van de belastingvlakken hoort schakelbaar te zijn"
    );
    assert_eq!(
        weergave["inputSchema"]["properties"]["visibility"]["properties"]["levelMarks"]["type"],
        json!("boolean"),
        "de peilmaten bij de levels horen los van het stramien schakelbaar te zijn (issue #92)"
    );
    // De grootte van knopen en opleggingen (issue #82): een getal in % van de
    // automatische maat, 25–400; het strikte schema laat geen andere sleutel door.
    let zicht = &weergave["inputSchema"]["properties"]["visibility"];
    assert_eq!(zicht["additionalProperties"], json!(false));
    for sleutel in ["nodeSizePercent", "supportSizePercent"] {
        assert_eq!(zicht["properties"][sleutel]["type"], json!("number"), "{sleutel} hoort een getal te zijn");
        assert_eq!(zicht["properties"][sleutel]["minimum"], json!(25), "{sleutel}: ondergrens 25 %");
        assert_eq!(zicht["properties"][sleutel]["maximum"], json!(400), "{sleutel}: bovengrens 400 %");
    }
    // De plaatweergave (issue #78): één keuze uit volume, surface en mesh; een
    // andere tekst laat het strikte schema niet door.
    assert_eq!(zicht["properties"]["plateDisplay"]["type"], json!("string"));
    assert_eq!(
        zicht["properties"]["plateDisplay"]["enum"],
        json!(["volume", "surface", "mesh"]),
        "de plaatweergave hoort een van drie standen te zijn (issue #78)"
    );
    // De section box (issue #86): strikt op elk niveau. Zonder
    // `additionalProperties: false` viel een tikfout als `max` (in plaats van
    // `max_m`) stil weg en kreeg de doos de modelgrenzen.
    let doos = &weergave["inputSchema"]["properties"]["section_box"];
    assert_eq!(doos["additionalProperties"], json!(false), "{doos}");
    assert_eq!(doos["required"], json!(["enabled"]), "aan/uit is verplicht");
    assert_eq!(doos["properties"]["enabled"]["type"], json!("boolean"));
    assert_eq!(doos["properties"]["fit"]["enum"], json!(["model", "selection"]));
    let punt = &weergave["inputSchema"]["$defs"]["pointM"];
    assert_eq!(punt["additionalProperties"], json!(false), "{punt}");
    assert_eq!(punt["required"], json!(["x", "y", "z"]));
    for grens in ["min_m", "max_m"] {
        assert_eq!(doos["properties"][grens]["$ref"], json!("#/$defs/pointM"), "{grens}");
    }
    // De explode (issue #198): strikt. Een tikfout als `amount` (in plaats van
    // `amount_mm`) of een andere modus mag niet stil een standaardwaarde geven.
    let explode = &weergave["inputSchema"]["properties"]["explode"];
    assert_eq!(explode["additionalProperties"], json!(false), "{explode}");
    assert_eq!(explode["properties"]["mode"]["enum"], json!(["levels", "elementTypes"]));
    assert_eq!(explode["properties"]["amount_mm"]["type"], json!("number"));
    assert_eq!(explode["properties"]["amount_mm"]["minimum"], json!(0));
    assert_eq!(explode["properties"]["amount_mm"]["maximum"], json!(10000));
    drop(stdin);
    let _ = timeout(Duration::from_secs(5), child.wait()).await;
}

/// Staaf op bedding (issue #106) over de echte binary: het schema van
/// `solve_open_fem_3d` (members[].bedding) en van `gui_build_3d_model`
/// (beams[].bedding) is strikt, `gui_configure_3d_view` kent de laag
/// Gronddruk, een tikfout in een beddingveld wordt geweigerd, en een vrije
/// balk van 6 m onder een gelijkmatige last q = 30 kN/m op k·b = 50 000 ·
/// 0,6 = 30 000 kN/m² zakt overal q/(k·b) = 1 mm, met Σ veerkrachten = q·L.
#[tokio::test]
async fn staaf_op_bedding_via_mcp_is_strikt_en_rekent() {
    let (mut child, mut stdin, mut reader) = start_server().await;
    let tool = tooldefinitie(&mut stdin, &mut reader, 120, "solve_open_fem_3d").await;
    let bedding = &tool["inputSchema"]["properties"]["members"]["items"]["properties"]["bedding"];
    assert_eq!(bedding["additionalProperties"], json!(false), "{bedding}");
    assert_eq!(bedding["required"], json!(["widthM"]));
    for veld in ["kKnPerM3", "widthM", "kLateralKnPerM3", "compressionOnly"] {
        assert!(bedding["properties"].get(veld).is_some(), "{veld} ontbreekt");
    }
    let bouw = tooldefinitie(&mut stdin, &mut reader, 121, "gui_build_3d_model").await;
    let app = &bouw["inputSchema"]["properties"]["beams"]["items"]["properties"]["bedding"];
    assert_eq!(app["additionalProperties"], json!(false), "{app}");
    assert_eq!(app["required"], json!(["width_m"]));
    let weergave = tooldefinitie(&mut stdin, &mut reader, 122, "gui_configure_3d_view").await;
    assert_eq!(weergave["inputSchema"]["properties"]["visibility"]["properties"]["groundPressure"]["type"], json!("boolean"));

    let verzoek = json!({
        "analysis": "linear",
        "nodes": [{ "id": 1, "x": 0, "y": 0, "z": 0 }, { "id": 2, "x": 6, "y": 0, "z": 0 }],
        "materials": [{ "id": 1, "name": "S235", "eMpa": 210000, "nu": 0.3 }],
        "sections": [{ "id": 1, "name": "balk", "areaM2": 0.0149, "iyM4": 2.517e-4, "izM4": 8.56e-5, "torsionJM4": 1.85e-6 }],
        "members": [{ "id": 1, "startNodeId": 1, "endNodeId": 2, "materialId": 1, "sectionId": 1,
            "bedding": { "kKnPerM3": 50000, "widthM": 0.6 } }],
        "supports": [{ "nodeId": 1, "ux": true, "uy": true, "uz": false, "rx": true, "ry": false, "rz": true }],
        "nodalLoads": [],
        "memberLoads": [{ "id": 1, "memberId": 1, "qyStartKnPerM": 0, "qyEndKnPerM": 0, "qzStartKnPerM": -30, "qzEndKnPerM": -30,
            "startPositionM": 0, "endPositionM": 6 }],
        "bucklingModes": 0
    });
    let uit = roep_tool_aan(&mut stdin, &mut reader, 123, "solve_open_fem_3d", verzoek.clone()).await;
    assert_eq!(uit["isError"], json!(false), "{uit}");
    let lid = &uit["structuredContent"]["bedding"][0];
    assert_eq!(lid["memberId"], json!(1), "{uit}");
    let punten = lid["points"].as_array().expect("punten");
    assert!(punten.len() >= 3);
    for punt in punten {
        let zakking = punt["settlementM"].as_f64().unwrap();
        assert!((zakking - 0.001).abs() <= 0.01 * 0.001, "zakking {zakking} op t = {}", punt["t"]);
    }
    let som = lid["totalReactionKn"].as_f64().unwrap();
    assert!((som - 180.0).abs() < 1e-6, "Σ veerkrachten {som}");
    // Een tikfout in een beddingveld: het contract weigert onbekende velden.
    let mut tikfout = verzoek;
    tikfout["members"][0]["bedding"] = json!({ "kKnPerm3": 50000, "widthM": 0.6 });
    schrijf(&mut stdin, json!({
        "jsonrpc": "2.0", "id": 124, "method": "tools/call",
        "params": { "name": "solve_open_fem_3d", "arguments": tikfout }
    })).await;
    let antwoord = lees_bericht(&mut reader).await;
    let melding = antwoord["error"]["message"].as_str().map(str::to_owned)
        .unwrap_or_else(|| foutmelding(&antwoord["result"]));
    assert!(melding.contains("kKnPerm3"), "{antwoord}");
    drop(stdin);
    let _ = timeout(Duration::from_secs(5), child.wait()).await;
}

/// Lijnlast in een globale richting (issue #80) over de echte binary: het
/// schema van `solve_open_fem_3d` kent globalDirection, qStartKnPerM,
/// qEndKnPerM en perProjection strikt, een tikfout in een lastveld wordt
/// geweigerd, en een vrij opgelegde schuine spant (4 m horizontaal, 3 m
/// omhoog) onder sneeuw q = 2 kN/m per horizontale meter heeft ΣRz = q·4 m =
/// 8 kN; per staafmeter (zonder perProjection) q·5 m = 10 kN.
#[tokio::test]
async fn globale_lijnlast_via_mcp_is_strikt_en_rekent() {
    let (mut child, mut stdin, mut reader) = start_server().await;
    let tool = tooldefinitie(&mut stdin, &mut reader, 130, "solve_open_fem_3d").await;
    let last = &tool["inputSchema"]["properties"]["memberLoads"]["items"];
    assert_eq!(last["additionalProperties"], json!(false), "{last}");
    assert_eq!(last["required"], json!(["id", "memberId"]));
    assert_eq!(last["properties"]["globalDirection"]["enum"], json!(["x", "y", "z"]));
    for veld in ["qStartKnPerM", "qEndKnPerM", "perProjection"] {
        assert!(last["properties"].get(veld).is_some(), "{veld} ontbreekt");
    }

    let verzoek = |per_projectie: bool| json!({
        "analysis": "linear",
        "nodes": [{ "id": 1, "x": 0, "y": 0, "z": 0 }, { "id": 2, "x": 4, "y": 0, "z": 3 }],
        "materials": [{ "id": 1, "name": "S235", "eMpa": 210000, "nu": 0.3 }],
        "sections": [{ "id": 1, "name": "spant", "areaM2": 0.00538, "iyM4": 8.356e-5, "izM4": 6.04e-6, "torsionJM4": 2.01e-7 }],
        "members": [{ "id": 1, "startNodeId": 1, "endNodeId": 2, "materialId": 1, "sectionId": 1 }],
        "supports": [
            { "nodeId": 1, "ux": true, "uy": true, "uz": true, "rx": true, "ry": false, "rz": true },
            { "nodeId": 2, "ux": false, "uy": true, "uz": true, "rx": false, "ry": false, "rz": false }
        ],
        "nodalLoads": [],
        "memberLoads": [{ "id": 1, "memberId": 1, "globalDirection": "z", "qStartKnPerM": -2, "qEndKnPerM": -2,
            "perProjection": per_projectie, "startPositionM": 0, "endPositionM": 5 }],
        "bucklingModes": 0
    });
    // Een tikfout in een lastveld: het contract weigert onbekende velden (ook een kern van vóór #80).
    let mut tikfout = verzoek(true);
    tikfout["memberLoads"][0] = json!({ "id": 1, "memberId": 1, "globalDirecton": "z", "qStartKnPerM": -2, "qEndKnPerM": -2 });
    schrijf(&mut stdin, json!({
        "jsonrpc": "2.0", "id": 131, "method": "tools/call",
        "params": { "name": "solve_open_fem_3d", "arguments": tikfout }
    })).await;
    let antwoord = lees_bericht(&mut reader).await;
    let melding = antwoord["error"]["message"].as_str().map(str::to_owned)
        .unwrap_or_else(|| foutmelding(&antwoord["result"]));
    assert!(melding.contains("globalDirecton"), "{antwoord}");

    for (id, per_projectie, verwacht) in [(132, true, 8.0), (133, false, 10.0)] {
        schrijf(&mut stdin, json!({
            "jsonrpc": "2.0", "id": id, "method": "tools/call",
            "params": { "name": "solve_open_fem_3d", "arguments": verzoek(per_projectie) }
        })).await;
        let antwoord = lees_bericht(&mut reader).await;
        let uit = &antwoord["result"];
        assert_eq!(uit["isError"], json!(false), "{antwoord}");
        let som: f64 = uit["structuredContent"]["reactions"].as_array().expect("reacties").iter()
            .map(|r| r["fz"].as_f64().unwrap()).sum();
        assert!((som - verwacht).abs() < 1e-6, "ΣRz {som}, verwacht {verwacht} (per projectie: {per_projectie})");
    }
    drop(stdin);
    let _ = timeout(Duration::from_secs(5), child.wait()).await;
}

/// Verlopende staaf (issue #73) over de echte binary: het schema van
/// `solve_open_fem_3d` kent `partSectionIds` (2 tot 64 doorsnede-id's), en een
/// uitkrager van 4 m in twee gelijke delen (I₁ = 2·10⁻⁴ m⁴ aan de inklemming,
/// I₂ = 5·10⁻⁵ m⁴ aan het vrije eind) onder P = 10 kN zakt aan het eind
///   w = P/E·[ (4³ − 2³)/3 / I₁ + 2³/3 / I₂ ] = 10/2,1·10⁸ · 146 666,7 = 6,984 mm
/// (alleen buiging, exact: het verzoek geeft geen afschuifoppervlak mee), met
/// het inklemmingsmoment P·L = 40 kNm op de ene staaf.
#[tokio::test]
async fn verlopende_staaf_via_mcp_is_strikt_en_rekent() {
    let (mut child, mut stdin, mut reader) = start_server().await;
    let tool = tooldefinitie(&mut stdin, &mut reader, 140, "solve_open_fem_3d").await;
    let delen = &tool["inputSchema"]["properties"]["members"]["items"]["properties"]["partSectionIds"];
    assert_eq!(delen["type"], json!("array"), "{delen}");
    assert_eq!((delen["minItems"].clone(), delen["maxItems"].clone()), (json!(2), json!(64)));
    assert_eq!(delen["items"]["minimum"], json!(1));

    let verzoek = json!({
        "analysis": "linear",
        "nodes": [{ "id": 1, "x": 0, "y": 0, "z": 0 }, { "id": 2, "x": 4, "y": 0, "z": 0 }],
        "materials": [{ "id": 1, "name": "S235", "eMpa": 210000, "nu": 0.3 }],
        "sections": [
            { "id": 1, "name": "begin", "areaM2": 0.01, "iyM4": 2e-4, "izM4": 2e-5, "torsionJM4": 1e-6 },
            { "id": 2, "name": "eind", "areaM2": 0.006, "iyM4": 5e-5, "izM4": 5e-6, "torsionJM4": 5e-7 }
        ],
        "members": [{ "id": 1, "startNodeId": 1, "endNodeId": 2, "materialId": 1, "sectionId": 1, "partSectionIds": [1, 2] }],
        "supports": [{ "nodeId": 1, "ux": true, "uy": true, "uz": true, "rx": true, "ry": true, "rz": true }],
        "nodalLoads": [{ "id": 1, "nodeId": 2, "fx": 0, "fy": 0, "fz": -10, "mx": 0, "my": 0, "mz": 0 }],
        "bucklingModes": 0
    });
    schrijf(&mut stdin, json!({
        "jsonrpc": "2.0", "id": 141, "method": "tools/call",
        "params": { "name": "solve_open_fem_3d", "arguments": verzoek }
    })).await;
    let antwoord = lees_bericht(&mut reader).await;
    // De server linkt de kern als crate: hij kent partSectionIds altijd.
    assert!(antwoord["error"].is_null(), "{antwoord}");
    let uit = &antwoord["result"];
    assert_eq!(uit["isError"], json!(false), "{antwoord}");
    let verplaatsingen = uit["structuredContent"]["displacements"].as_array().unwrap();
    assert_eq!(verplaatsingen.len(), 2, "alleen de modelknopen, geen grensknoop van de delen: {verplaatsingen:?}");
    let eind = verplaatsingen.iter().find(|d| d["nodeId"] == json!(2)).unwrap()["uz"].as_f64().unwrap();
    let verwacht = 10.0 / 2.1e8 * ((64.0 - 8.0) / 3.0 / 2e-4 + 8.0 / 3.0 / 5e-5);
    assert!(((-eind) - verwacht).abs() <= 1e-12 * verwacht, "zakking {eind}, verwacht −{verwacht}");
    let krachten = uit["structuredContent"]["memberForces"].as_array().unwrap();
    assert_eq!(krachten.len(), 1, "de delen zijn weer één staaf: {krachten:?}");
    let moment = krachten[0]["myStartKnm"].as_f64().unwrap();
    assert!((moment.abs() - 40.0).abs() < 1e-12 * 40.0, "inklemmingsmoment {moment}");
    drop(stdin);
    let _ = timeout(Duration::from_secs(5), child.wait()).await;
}

/// Trek-alleen en starre schijven over de echte binary: het schema van
/// `solve_open_fem_3d` is strikt, een tikfout in een schijfveld wordt
/// geweigerd en een kruisverband levert precies één inactieve diagonaal.
/// Portaal 6 × 4 m met scharnierende voeten en ligger, H = 12 kN: de
/// trekdiagonaal draagt H·d/L = 12·√52/6 = 14,4222 kN.
#[tokio::test]
async fn trek_alleen_en_schijven_via_mcp_zijn_strikt_en_rekenen() {
    let (mut child, mut stdin, mut reader) = start_server().await;
    let tool = tooldefinitie(&mut stdin, &mut reader, 95, "solve_open_fem_3d").await;
    let schema = &tool["inputSchema"];
    assert_eq!(schema["properties"]["members"]["items"]["properties"]["tensionOnly"]["type"], json!("boolean"));
    assert_eq!(schema["properties"]["diaphragms"]["items"]["additionalProperties"], json!(false));
    assert_eq!(schema["properties"]["diaphragms"]["items"]["required"], json!(["id", "nodeIds"]));

    let scharnier = json!({ "myStart": true, "myEnd": true, "mzStart": true, "mzEnd": true });
    let voet = |id: u64| json!({ "nodeId": id, "ux": true, "uy": true, "uz": true, "rx": true, "ry": false, "rz": true });
    let verzoek = json!({
        "analysis": "linear",
        "nodes": [
            { "id": 1, "x": 0, "y": 0, "z": 0 }, { "id": 2, "x": 6, "y": 0, "z": 0 },
            { "id": 3, "x": 0, "y": 0, "z": 4 }, { "id": 4, "x": 6, "y": 0, "z": 4 }
        ],
        "materials": [{ "id": 1, "name": "S235", "eMpa": 210000, "nu": 0.3 }],
        "sections": [
            { "id": 1, "name": "kolom", "areaM2": 0.01, "iyM4": 8e-5, "izM4": 8e-5, "torsionJM4": 5e-6 },
            { "id": 2, "name": "verband", "areaM2": 0.001, "iyM4": 1e-6, "izM4": 1e-6, "torsionJM4": 2e-6 }
        ],
        "members": [
            { "id": 1, "startNodeId": 1, "endNodeId": 3, "materialId": 1, "sectionId": 1 },
            { "id": 2, "startNodeId": 2, "endNodeId": 4, "materialId": 1, "sectionId": 1 },
            { "id": 3, "startNodeId": 3, "endNodeId": 4, "materialId": 1, "sectionId": 1, "releases": scharnier },
            { "id": 4, "startNodeId": 1, "endNodeId": 4, "materialId": 1, "sectionId": 2, "releases": scharnier, "tensionOnly": true },
            { "id": 5, "startNodeId": 2, "endNodeId": 3, "materialId": 1, "sectionId": 2, "releases": scharnier, "tensionOnly": true }
        ],
        "supports": [voet(1), voet(2)],
        "nodalLoads": [{ "id": 1, "nodeId": 3, "fx": 12, "fy": 0, "fz": 0, "mx": 0, "my": 0, "mz": 0 }],
        "bucklingModes": 0
    });
    let uit = roep_tool_aan(&mut stdin, &mut reader, 96, "solve_open_fem_3d", verzoek.clone()).await;
    assert_eq!(uit["isError"], json!(false), "{uit}");
    let resultaat = &uit["structuredContent"];
    assert_eq!(resultaat["inactiveMembers"], json!([5]), "{resultaat}");
    assert_eq!(resultaat["tensionOnlyRounds"], json!(2), "een statuswissel en een bevestiging");
    let n4 = resultaat["memberForces"].as_array().unwrap().iter()
        .find(|f| f["memberId"] == json!(4)).unwrap()["nStartKn"].as_f64().unwrap();
    assert!((n4 - 12.0 * 52f64.sqrt() / 6.0).abs() < 1e-9, "N diagonaal {n4}");

    // Een tikfout in een schijfveld: het contract weigert onbekende velden.
    let mut tikfout = verzoek;
    tikfout["diaphragms"] = json!([{ "id": 1, "nodeId": [3, 4] }]);
    schrijf(&mut stdin, json!({
        "jsonrpc": "2.0", "id": 97, "method": "tools/call",
        "params": { "name": "solve_open_fem_3d", "arguments": tikfout }
    })).await;
    let antwoord = lees_bericht(&mut reader).await;
    let melding = antwoord["error"]["message"].as_str().map(str::to_owned)
        .unwrap_or_else(|| foutmelding(&antwoord["result"]));
    assert!(melding.contains("nodeId"), "{antwoord}");
    drop(stdin);
    let _ = timeout(Duration::from_secs(5), child.wait()).await;
}

/// Montagelasten en kruisregel via MCP: hetzelfde scharnierende portaal met
/// P = 100 kN op beide koppen (de permanente last, ook de montagelast) en
/// H = 12 kN. Zonder strips verkorten de kolommen P·h/(E·A) = 100·4/(2,1·10⁶)
/// m en gaat het frame niet opzij, dus beide strips passen op Δ0 = −s·P·h/(E·A)
/// met s = 4/√52: −0,105 662 mm. Onder G + H draagt G dan niets in de strips en
/// staat strip 5 op druk; strip 4 draagt H/cos θ = 14,4222 kN (het portaal met
/// één strip is statisch bepaald). De kruisregel is hier niet nodig.
#[tokio::test]
async fn montage_en_kruisregel_via_mcp_zijn_strikt_en_rekenen() {
    let (mut child, mut stdin, mut reader) = start_server().await;
    let tool = tooldefinitie(&mut stdin, &mut reader, 98, "solve_open_fem_3d").await;
    let schema = &tool["inputSchema"];
    assert_eq!(schema["properties"]["tensionOnlyFit"]["additionalProperties"], json!(false));
    assert_eq!(schema["properties"]["tensionOnlyCrossRule"]["type"], json!("boolean"));

    let scharnier = json!({ "myStart": true, "myEnd": true, "mzStart": true, "mzEnd": true });
    let voet = |id: u64| json!({ "nodeId": id, "ux": true, "uy": true, "uz": true, "rx": true, "ry": false, "rz": true });
    let g = json!([
        { "id": 1, "nodeId": 3, "fx": 0, "fy": 0, "fz": -100, "mx": 0, "my": 0, "mz": 0 },
        { "id": 2, "nodeId": 4, "fx": 0, "fy": 0, "fz": -100, "mx": 0, "my": 0, "mz": 0 }
    ]);
    let mut lasten = g.as_array().unwrap().clone();
    lasten.push(json!({ "id": 3, "nodeId": 3, "fx": 12, "fy": 0, "fz": 0, "mx": 0, "my": 0, "mz": 0 }));
    let verzoek = json!({
        "analysis": "linear",
        "nodes": [
            { "id": 1, "x": 0, "y": 0, "z": 0 }, { "id": 2, "x": 6, "y": 0, "z": 0 },
            { "id": 3, "x": 0, "y": 0, "z": 4 }, { "id": 4, "x": 6, "y": 0, "z": 4 }
        ],
        "materials": [{ "id": 1, "name": "S235", "eMpa": 210000, "nu": 0.3 }],
        "sections": [
            { "id": 1, "name": "kolom", "areaM2": 0.01, "iyM4": 8e-5, "izM4": 8e-5, "torsionJM4": 5e-6 },
            { "id": 2, "name": "verband", "areaM2": 0.001, "iyM4": 1e-6, "izM4": 1e-6, "torsionJM4": 2e-6 }
        ],
        "members": [
            { "id": 1, "startNodeId": 1, "endNodeId": 3, "materialId": 1, "sectionId": 1 },
            { "id": 2, "startNodeId": 2, "endNodeId": 4, "materialId": 1, "sectionId": 1 },
            { "id": 3, "startNodeId": 3, "endNodeId": 4, "materialId": 1, "sectionId": 1, "releases": scharnier },
            { "id": 4, "startNodeId": 1, "endNodeId": 4, "materialId": 1, "sectionId": 2, "releases": scharnier, "tensionOnly": true },
            { "id": 5, "startNodeId": 2, "endNodeId": 3, "materialId": 1, "sectionId": 2, "releases": scharnier, "tensionOnly": true }
        ],
        "supports": [voet(1), voet(2)],
        "nodalLoads": lasten,
        "tensionOnlyFit": { "nodalLoads": g },
        "tensionOnlyCrossRule": true,
        "bucklingModes": 0
    });
    let uit = roep_tool_aan(&mut stdin, &mut reader, 99, "solve_open_fem_3d", verzoek.clone()).await;
    assert_eq!(uit["isError"], json!(false), "{uit}");
    let resultaat = &uit["structuredContent"];
    assert_eq!(resultaat["inactiveMembers"], json!([5]), "{resultaat}");
    let n4 = resultaat["memberForces"].as_array().unwrap().iter()
        .find(|f| f["memberId"] == json!(4)).unwrap()["nStartKn"].as_f64().unwrap();
    assert!((n4 - 12.0 * 52f64.sqrt() / 6.0).abs() < 1e-6, "N diagonaal {n4}");
    let verwacht_mm = -(4.0 / 52f64.sqrt()) * 100.0 * 4.0 / (2.1e8 * 0.01) * 1000.0;
    let fit = resultaat["tensionOnlyFit"].as_array().expect("tensionOnlyFit in het resultaat");
    assert_eq!(fit.len(), 2);
    for (regel, id) in fit.iter().zip([4, 5]) {
        assert_eq!(regel["memberId"], json!(id));
        let delta = regel["deltaMm"].as_f64().unwrap();
        assert!((delta - verwacht_mm).abs() < 1e-6 * verwacht_mm.abs(), "Δ0 staaf {id}: {delta} tegen {verwacht_mm}");
    }
    assert!(resultaat.get("crossRuleMembers").is_none(), "de regel was niet nodig: {resultaat}");
    let meldingen = resultaat["diagnostics"].as_array().unwrap();
    assert!(meldingen.iter().any(|m| m.as_str().unwrap().contains("de regel was nergens nodig")), "{meldingen:?}");

    // Een tikfout in de montagelasten: het contract weigert onbekende velden.
    let mut tikfout = verzoek;
    tikfout["tensionOnlyFit"] = json!({ "nodalLoad": [] });
    schrijf(&mut stdin, json!({
        "jsonrpc": "2.0", "id": 100, "method": "tools/call",
        "params": { "name": "solve_open_fem_3d", "arguments": tikfout }
    })).await;
    let antwoord = lees_bericht(&mut reader).await;
    let melding = antwoord["error"]["message"].as_str().map(str::to_owned)
        .unwrap_or_else(|| foutmelding(&antwoord["result"]));
    assert!(melding.contains("nodalLoad"), "{antwoord}");
    drop(stdin);
    let _ = timeout(Duration::from_secs(5), child.wait()).await;
}

// ── De stalen hal ───────────────────────────────────────────────────────────

/// Alle objectniveaus van een schema, met hun pad.
fn objectniveaus(pad: &str, schema: &Value, uit: &mut Vec<(String, Value)>) {
    if let Some(eigenschappen) = schema.get("properties").and_then(Value::as_object) {
        uit.push((pad.to_owned(), schema.clone()));
        for (k, v) in eigenschappen {
            objectniveaus(&format!("{pad}.{k}"), v, uit);
        }
    }
}

/// `open_fem_3d_staalhal_maken` en `gui_build_3d_steel_hall` zijn op ELK
/// objectniveau strikt (`additionalProperties: false`), delen hetzelfde
/// halschema, en dat schema draagt de standaardwaarden van de voorbeeldhal.
/// Dat de velden gelijk zijn aan de poort van de generator bewaakt de
/// unittest `schema_spiegelt_de_veldpoort_van_de_generator`; dat de
/// standaardwaarden die van de generator zijn, `tests/staalhal_mcp.rs`.
#[tokio::test]
async fn schema_van_de_staalhal_is_strikt_op_elk_niveau() {
    let (mut child, mut stdin, mut reader) = start_server().await;
    let tool = tooldefinitie(&mut stdin, &mut reader, 70, "open_fem_3d_staalhal_maken").await;
    let gui = tooldefinitie(&mut stdin, &mut reader, 71, "gui_build_3d_steel_hall").await;
    let mut niveaus = Vec::new();
    objectniveaus("inputSchema", &tool["inputSchema"], &mut niveaus);
    assert!(niveaus.len() >= 13, "te weinig objectniveaus: {}", niveaus.len());
    for (pad, niveau) in &niveaus {
        assert_eq!(niveau["additionalProperties"], json!(false), "{pad} is niet strikt");
    }
    let hal = &tool["inputSchema"]["properties"]["hal"];
    assert_eq!(&gui["inputSchema"]["properties"]["hal"], hal, "één halschema voor MCP en bediening");
    assert_eq!(gui["inputSchema"]["additionalProperties"], json!(false));
    let p = &hal["properties"];
    assert_eq!(p["lengteMm"]["default"], json!(60000.0));
    assert_eq!(p["breedteMm"]["default"], json!(30000.0));
    assert_eq!(p["goothoogteMm"]["default"], json!(8000.0));
    assert_eq!(p["profielen"]["properties"]["kolom"]["properties"]["profiel"]["default"], json!("HEA 450"));
    assert_eq!(p["fundering"]["properties"]["type"]["enum"], json!(["opleggingen", "balkrooster"]));
    assert_eq!(p["lasten"]["properties"]["wind"]["properties"]["bron"]["enum"], json!(["handmatig", "stuwdruk"]));
    assert_eq!(tool["inputSchema"]["properties"]["analyse"]["enum"], json!(["linear", "p-delta"]));
    drop(stdin);
    let _ = timeout(Duration::from_secs(5), child.wait()).await;
}


/// Een tikfout in de toolargumenten (`rekenen` in plaats van `reken`) wordt
/// GEWEIGERD, niet genegeerd: anders zou de client een model zonder
/// berekening terugkrijgen terwijl hij er om vroeg.
#[tokio::test]
async fn tikfout_in_de_staalhalargumenten_wordt_geweigerd() {
    let (mut child, mut stdin, mut reader) = start_server().await;
    let uit = roep_tool_aan(&mut stdin, &mut reader, 72, "open_fem_3d_staalhal_maken", json!({ "rekenen": true })).await;
    assert_eq!(uit["isError"], json!(true), "{uit}");
    let melding = foutmelding(&uit);
    assert!(melding.contains("unknown field") && melding.contains("rekenen"), "{melding}");
    assert_eq!(uit["structuredContent"]["error_code"], json!("ARGUMENT_ONGELDIG"));
    let detail = roep_tool_aan(&mut stdin, &mut reader, 73, "open_fem_3d_staalhal_maken", json!({ "detail": "alles" })).await;
    assert_eq!(detail["isError"], json!(true), "{detail}");
    let gui = roep_tool_aan(&mut stdin, &mut reader, 74, "gui_build_3d_steel_hall", json!({ "hall": {} })).await;
    assert_eq!(gui["isError"], json!(true), "{gui}");
    assert!(foutmelding(&gui).contains("unknown field"), "{}", foutmelding(&gui));
    drop(stdin);
    let _ = timeout(Duration::from_secs(5), child.wait()).await;
}

// ── 3D-platen via solve_open_fem_3d ─────────────────────────────────────────

/// Een vierkante vloer 4×4 m (2×2 MITC4-elementen), in de hoeken vast en
/// vlaklast −5 kN/m²: Σ Rz = 5·16 = 80 kN.
fn plaatverzoek() -> Value {
    let mut nodes = Vec::new();
    for j in 0..3 {
        for i in 0..3 {
            nodes.push(json!({ "id": 1 + j * 3 + i, "x": 2.0 * i as f64, "y": 2.0 * j as f64, "z": 0.0 }));
        }
    }
    let id = |i: usize, j: usize| 1 + j * 3 + i;
    let mut elements = Vec::new();
    for j in 0..2 {
        for i in 0..2 {
            elements.push(json!({
                "id": elements.len() + 1, "plateId": 1,
                "nodeIds": [id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)]
            }));
        }
    }
    let supports: Vec<Value> = [id(0, 0), id(2, 0), id(2, 2), id(0, 2)].iter().map(|n| json!({
        "nodeId": n, "ux": true, "uy": true, "uz": true, "rx": false, "ry": false, "rz": false
    })).collect();
    json!({
        "schemaVersion": 2,
        "analysis": "linear",
        "nodes": nodes,
        "materials": [{ "id": 1, "name": "C30/37", "eMpa": 33000.0, "nu": 0.2 }],
        "plates": [{ "id": 1, "materialId": 1, "thicknessM": 0.2 }],
        "shellElements": elements,
        "surfaceLoads": [{ "id": 1, "plateId": 1, "qxKnPerM2": 0.0, "qyKnPerM2": 0.0, "qzKnPerM2": -5.0 }],
        "supports": supports,
        "bucklingModes": 0
    })
}

#[tokio::test]
async fn solve_open_fem_3d_rekent_platen_en_weigert_een_tikfout() {
    let (mut child, mut stdin, mut reader) = start_server().await;
    let tool = tooldefinitie(&mut stdin, &mut reader, 70, "solve_open_fem_3d").await;
    let props = &tool["inputSchema"]["properties"];
    for veld in ["plates", "shellElements", "surfaceLoads"] {
        assert_eq!(props[veld]["items"]["additionalProperties"], json!(false), "{veld} hoort strikt te zijn");
    }
    let uitkomst = roep_tool_aan(&mut stdin, &mut reader, 71, "solve_open_fem_3d", plaatverzoek()).await;
    assert!(uitkomst["isError"] != json!(true), "plaatmodel rekent niet: {}", foutmelding(&uitkomst));
    let tekst = foutmelding(&uitkomst);
    let resultaat: Value = serde_json::from_str(&tekst).expect("resultaat is JSON");
    let som: f64 = resultaat["reactions"].as_array().unwrap().iter().map(|r| r["fz"].as_f64().unwrap()).sum();
    assert!((som - 80.0).abs() < 1e-6, "Σ Rz = {som}");
    assert_eq!(resultaat["schemaVersion"], json!(2));
    assert_eq!(resultaat["plates"][0]["plateId"], json!(1));
    assert!(resultaat["shellNodes"].as_array().is_some_and(|v| v.len() == 9));

    let mut tikfout = plaatverzoek();
    tikfout["plates"][0] = json!({ "id": 1, "materialId": 1, "thickness": 0.2 });
    let fout = roep_tool_aan(&mut stdin, &mut reader, 72, "solve_open_fem_3d", tikfout).await;
    assert_eq!(fout["isError"], json!(true), "een tikfout in een plaatveld hoort geweigerd te worden");

    let mut tweede_orde = plaatverzoek();
    tweede_orde["analysis"] = json!("p-delta");
    let fout = roep_tool_aan(&mut stdin, &mut reader, 73, "solve_open_fem_3d", tweede_orde).await;
    assert!(foutmelding(&fout).contains("P-Delta"), "{}", foutmelding(&fout));
    drop(stdin);
    let _ = timeout(Duration::from_secs(5), child.wait()).await;
}

/// Plaat op bedding (issue #107) over de echte binary: het schema van
/// `solve_open_fem_3d` (plates[].bedding) en van `gui_build_3d_model`
/// (plates[].bedding) is strikt, en een tikfout in een beddingveld wordt
/// geweigerd. Een vloer van 4 × 4 m (2 × 2 MITC4-elementen), alleen in haar
/// vlak gesteund, onder q = 5 kN/m² op k = 20 000 kN/m³: overal een zakking
/// q/k = 0,25 mm en gronddruk q (afrondingsruis, 10⁻⁹) en Σ veerkrachten
/// q·A = 80 kN.
#[tokio::test]
async fn plaat_op_bedding_via_mcp_is_strikt_en_rekent() {
    let (mut child, mut stdin, mut reader) = start_server().await;
    let tool = tooldefinitie(&mut stdin, &mut reader, 170, "solve_open_fem_3d").await;
    let bedding = &tool["inputSchema"]["properties"]["plates"]["items"]["properties"]["bedding"];
    assert_eq!(bedding["additionalProperties"], json!(false), "{bedding}");
    assert_eq!(bedding["required"], json!(["kKnPerM3"]));
    for veld in ["kKnPerM3", "compressionOnly"] {
        assert!(bedding["properties"].get(veld).is_some(), "{veld} ontbreekt");
    }
    let bouw = tooldefinitie(&mut stdin, &mut reader, 171, "gui_build_3d_model").await;
    let app = &bouw["inputSchema"]["properties"]["plates"]["items"]["properties"]["bedding"];
    assert_eq!(app["additionalProperties"], json!(false), "{app}");
    assert_eq!(app["required"], json!(["k_kn_per_m3"]));

    // De vloer van plaatverzoek, maar alleen in haar vlak gesteund: verticaal draagt de grond.
    let mut verzoek = plaatverzoek();
    verzoek["plates"][0]["bedding"] = json!({ "kKnPerM3": 20000.0 });
    verzoek["supports"] = json!([
        { "nodeId": 1, "ux": true, "uy": true, "uz": false, "rx": false, "ry": false, "rz": false },
        { "nodeId": 3, "ux": false, "uy": true, "uz": false, "rx": false, "ry": false, "rz": false }
    ]);
    let uit = roep_tool_aan(&mut stdin, &mut reader, 172, "solve_open_fem_3d", verzoek.clone()).await;
    let melding = foutmelding(&uit);
    assert!(uit["isError"] != json!(true), "plaat op bedding rekent niet: {melding}");
    let resultaat: Value = serde_json::from_str(&melding).expect("resultaat is JSON");
    let vloer = &resultaat["plateBedding"][0];
    assert_eq!(vloer["plateId"], json!(1), "{resultaat}");
    let knopen = vloer["nodes"].as_array().expect("knopen");
    assert_eq!(knopen.len(), 9, "elke knoop van de vloer");
    for knoop in knopen {
        let zakking = knoop["settlementM"].as_f64().unwrap();
        assert!((zakking - 0.00025).abs() <= 1e-9 * 0.00025, "zakking {zakking} op knoop {}", knoop["nodeId"]);
        let druk = knoop["pressureKnPerM2"].as_f64().unwrap();
        assert!((druk - 5.0).abs() <= 1e-9 * 5.0, "gronddruk {druk} op knoop {}", knoop["nodeId"]);
        assert_eq!(knoop["active"], json!(true));
    }
    let som = vloer["totalReactionKn"].as_f64().unwrap();
    assert!((som - 80.0).abs() < 1e-9 * 80.0, "Σ veerkrachten {som}");
    assert_eq!(vloer["liftedFraction"].as_f64(), Some(0.0));
    // Een tikfout in een beddingveld: het schema weigert onbekende velden.
    let mut tikfout = verzoek;
    tikfout["plates"][0]["bedding"] = json!({ "kKnPerm3": 20000.0 });
    schrijf(&mut stdin, json!({
        "jsonrpc": "2.0", "id": 173, "method": "tools/call",
        "params": { "name": "solve_open_fem_3d", "arguments": tikfout }
    })).await;
    let antwoord = lees_bericht(&mut reader).await;
    let melding = antwoord["error"]["message"].as_str().map(str::to_owned)
        .unwrap_or_else(|| foutmelding(&antwoord["result"]));
    assert!(melding.contains("kKnPerm3"), "{antwoord}");
    drop(stdin);
    let _ = timeout(Duration::from_secs(5), child.wait()).await;
}

// ── De import van een IFC4-analysemodel ─────────────────────────────────────

/// `open_fem_3d_ifc_importeren` en `gui_import_ifc_analysis_model` zijn op ELK
/// objectniveau strikt, het pad is verplicht en de keuze van het analysemodel
/// (naam of volgnummer vanaf 1) is in beide hetzelfde schema. Dat de import
/// zelf klopt, bewaakt `tests/ifc_import_mcp.rs`.
#[tokio::test]
async fn schema_van_de_ifc_import_is_strikt_op_elk_niveau() {
    let (mut child, mut stdin, mut reader) = start_server().await;
    let tool = tooldefinitie(&mut stdin, &mut reader, 80, "open_fem_3d_ifc_importeren").await;
    let gui = tooldefinitie(&mut stdin, &mut reader, 81, "gui_import_ifc_analysis_model").await;
    for (naam, schema) in [("open_fem_3d_ifc_importeren", &tool["inputSchema"]), ("gui_import_ifc_analysis_model", &gui["inputSchema"])] {
        let mut niveaus = Vec::new();
        objectniveaus("inputSchema", schema, &mut niveaus);
        assert!(!niveaus.is_empty(), "{naam} heeft geen objectniveau");
        for (pad, niveau) in &niveaus {
            assert_eq!(niveau["additionalProperties"], json!(false), "{naam}: {pad} is niet strikt");
        }
    }
    assert_eq!(tool["inputSchema"]["required"], json!(["pad"]));
    assert_eq!(gui["inputSchema"]["required"], json!(["path"]));
    assert_eq!(
        tool["inputSchema"]["properties"]["analysemodel"], gui["inputSchema"]["properties"]["analysis_model"],
        "één schema voor de keuze van het analysemodel"
    );
    let keuze = &tool["inputSchema"]["properties"]["analysemodel"]["oneOf"];
    assert_eq!(keuze[0]["type"], json!("string"));
    assert_eq!(keuze[1]["minimum"], json!(1));
    assert_eq!(tool["inputSchema"]["properties"]["analyse"]["enum"], json!(["linear", "p-delta"]));
    assert_eq!(tool["inputSchema"]["properties"]["gevolgklasse"]["enum"], json!(["CC1", "CC2", "CC3"]));
    drop(stdin);
    let _ = timeout(Duration::from_secs(5), child.wait()).await;
}

/// Een tikfout in de argumenten (`rekenen`, `analysis-model`) wordt GEWEIGERD:
/// anders zou de client een import zonder berekening, of van het verkeerde
/// analysemodel, terugkrijgen terwijl hij iets anders vroeg.
#[tokio::test]
async fn tikfout_in_de_ifc_importargumenten_wordt_geweigerd() {
    let (mut child, mut stdin, mut reader) = start_server().await;
    let uit = roep_tool_aan(&mut stdin, &mut reader, 82, "open_fem_3d_ifc_importeren",
        json!({ "pad": "C:/bestaat/niet.ifc", "rekenen": true })).await;
    assert_eq!(uit["isError"], json!(true), "{uit}");
    let melding = foutmelding(&uit);
    assert!(melding.contains("unknown field") && melding.contains("rekenen"), "{melding}");
    assert_eq!(uit["structuredContent"]["error_code"], json!("ARGUMENT_ONGELDIG"));
    let zonder = roep_tool_aan(&mut stdin, &mut reader, 83, "open_fem_3d_ifc_importeren", json!({})).await;
    assert_eq!(zonder["isError"], json!(true), "zonder pad: {zonder}");
    let nul = roep_tool_aan(&mut stdin, &mut reader, 84, "open_fem_3d_ifc_importeren",
        json!({ "pad": "C:/bestaat/niet.ifc", "analysemodel": 0 })).await;
    assert_eq!(nul["isError"], json!(true), "analysemodel 0: {nul}");
    let gui = roep_tool_aan(&mut stdin, &mut reader, 85, "gui_import_ifc_analysis_model",
        json!({ "path": "C:/x.ifc", "analysis-model": 1 })).await;
    assert_eq!(gui["isError"], json!(true), "{gui}");
    assert!(foutmelding(&gui).contains("unknown field"), "{}", foutmelding(&gui));
    drop(stdin);
    let _ = timeout(Duration::from_secs(5), child.wait()).await;
}

// ── De app starten (issue #109) ─────────────────────────────────────────────

/// `gui_start_app` heeft één optioneel argument, `timeout_s` (5–300 s), en
/// weigert al het andere: een tikfout (`timeout`) mag niet stil de standaard
/// van 60 s opleveren, en zeker geen ander gedrag. De weigering komt vóór er
/// iets gestart of gezocht wordt.
#[tokio::test]
async fn schema_van_gui_start_app_is_strikt() {
    let (mut child, mut stdin, mut reader) = start_server().await;
    let tool = tooldefinitie(&mut stdin, &mut reader, 90, "gui_start_app").await;
    let s = &tool["inputSchema"];
    assert_eq!(s["type"], json!("object"));
    assert_eq!(s["additionalProperties"], json!(false));
    assert!(s.get("required").is_none() || s["required"] == json!([]), "{s}");
    let t = &s["properties"]["timeout_s"];
    assert_eq!(t["type"], json!("integer"));
    assert_eq!(t["minimum"], json!(5));
    assert_eq!(t["maximum"], json!(300));
    assert_eq!(t["default"], json!(60));
    assert_eq!(s["properties"].as_object().unwrap().len(), 1, "alleen timeout_s");
    let beschrijving = tool["description"].as_str().unwrap();
    assert!(beschrijving.contains("OPENAEC_APP"), "{beschrijving}");
    assert!(beschrijving.contains("AI assistant (MCP)"), "{beschrijving}");

    let tikfout = roep_tool_aan(&mut stdin, &mut reader, 91, "gui_start_app", json!({ "timeout": 10 })).await;
    assert_eq!(tikfout["isError"], json!(true), "{tikfout}");
    assert!(foutmelding(&tikfout).contains("unknown field"), "{}", foutmelding(&tikfout));
    assert_eq!(tikfout["structuredContent"]["error_code"], json!("ARGUMENT_ONGELDIG"));
    for buiten in [json!({ "timeout_s": 1 }), json!({ "timeout_s": 301 })] {
        let uit = roep_tool_aan(&mut stdin, &mut reader, 92, "gui_start_app", buiten.clone()).await;
        assert_eq!(uit["isError"], json!(true), "{buiten}: {uit}");
        assert_eq!(uit["structuredContent"]["error_code"], json!("ARGUMENT_ONGELDIG"), "{buiten}");
    }
    drop(stdin);
    let _ = timeout(Duration::from_secs(5), child.wait()).await;
}

// ── Aluminium (NEN-EN 1999-1-1, issue #5) ──────────────────────────────────



// ── Eigen factoren, bewust gekozen (issue #196) ──────────────────────────────

/// De combinaties van de 2D-rekentools kennen
/// `bevestigdeFactoren` (bewust gekozen eigen factoren, zoals `load_fem_project`
/// ze teruggeeft), en blijven verder strikt: geen ander veld erbij. Zonder het
/// veld in het schema kon een cliënt die combinaties niet ongewijzigd
/// teruggeven, en kwam de FOUT terug. Wat de server ermee doet, staat in
/// `eigen_factoren_mcp.rs` (die vraagt Node; deze test niet).
#[tokio::test]
async fn combinaties_kennen_de_bevestigde_eigen_factoren_strikt() {
    let (mut child, mut stdin, mut reader) = start_server().await;
    #[allow(unused_mut)]
    let mut namen = vec!["solve_fem_model"];
    for (i, naam) in namen.iter().enumerate() {
        let tool = tooldefinitie(&mut stdin, &mut reader, 200 + i as u32, naam).await;
        let item = &tool["inputSchema"]["properties"]["combinations"]["items"];
        assert_eq!(item["additionalProperties"], json!(false), "{naam}: {item}");
        let mut velden: Vec<&str> = item["properties"].as_object().unwrap().keys().map(String::as_str).collect();
        velden.sort_unstable();
        assert_eq!(velden, ["bevestigdeFactoren", "factors", "formula", "id", "name", "type"], "{naam}");
        let veld = &item["properties"]["bevestigdeFactoren"];
        assert_eq!(veld["type"], json!("object"), "{naam}: {veld}");
        assert_eq!(veld["additionalProperties"], json!({ "type": "number" }), "{naam}: {veld}");
        assert!(veld["description"].as_str().unwrap_or("").contains("PRECIES"), "{naam}: {veld}");
    }
    drop(stdin);
    let _ = timeout(Duration::from_secs(5), child.wait()).await;
}

// ── Metselwerk (NEN-EN 1996-1-1, issue #98) ────────────────────────────────


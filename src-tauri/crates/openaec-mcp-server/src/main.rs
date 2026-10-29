//! openaec-mcp-server — Model Context Protocol server exposing the
//! OpenAEC engines and the 2D FEM solver over stdio (JSON-RPC 2.0).
//!
//! Speaks newline-delimited JSON-RPC on stdin/stdout. stderr is reserved
//! for human-readable tracing (so it never collides with protocol traffic).
//!
//! Implements the minimal subset of MCP needed for tool calls from
//! Claude Desktop / Claude Code: `initialize`, `notifications/initialized`,
//! `tools/list`, `tools/call`. Protocol version: 2025-06-18.
//!
//! Heavy work (the Rust kernels) runs on
//! `tokio::task::spawn_blocking` so the stdio reader never stalls.

// De toolschema's zijn één grote `json!`-boom; met de velden `staafeinden` en
// `staaf_notities` (september 2026) liep die tegen de standaardgrens van 128
// macro-expansies aan.
#![recursion_limit = "512"]

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::Mutex;

/// De vijf FEM-tools. Ze rekenen niet hier maar in de Node-sidecar, op
/// letterlijk dezelfde solver als de app. Zie `fem_tools.rs`.
mod fem_tools;

/// Ruimtelijke raamwerken: dezelfde versievaste Rust-adapter als de app.
mod frame3d_tools;
mod native_fem_tools;
mod open_fem_3d_tools;

/// De stalen hal (`open_fem_3d_staalhal_maken`): de generator van de wizard in
/// de sidecar en rekenen met de 3D-kern hierboven.
mod staalhal_tools;

/// De import van een IFC4-analysemodel (`open_fem_3d_ifc_importeren`): de
/// import van de app in de sidecar en rekenen met de 3D-kern, langs dezelfde
/// keten als de stalen hal.
mod ifc_import_tools;
/// Resultaten als `.ifcfemresults` (issue #87): rekenen en het IFC4-bestand
/// bouwen in de sidecar (`io/ifcResultaten.ts`, dezelfde functie als de
/// exportkaart in de app), en zo'n bestand teruglezen.
mod ifc_resultaten_tools;
mod extensie_tools;


/// De GUI-tools: bedienen de DRAAIENDE desktop-app over haar bedieningskanaal
/// (Instellingen → AI-assistent (MCP), of `OPENAEC_GUI_CONTROL=1`), en
/// `gui_start_app` start de geïnstalleerde app met dat kanaal aan. Geen
/// rekenkern-opdrachten en dus buiten de
/// drie-wegen-regel — zij zíjn de weg naar de GUI. Zie `gui_tools.rs`.
mod gui_tools;


/// De API-commando's van de app (het commandoregister in `design-mockup/src/api/`):
/// één tool per commando, uit de ingebakken catalogus. Met `project` zonder app op
/// een bestand (via de sidecar), anders in de draaiende app. Zie `api_tools.rs`.
mod api_tools;
// `detail: "samenvatting"`: antwoorden van enkele kB (#229).
mod samenvatting;
/// Schema's van modelvelden van het projectbestand.
mod model_schema;

const PROTOCOL_VERSION: &str = "2025-06-18";
const SERVER_NAME: &str = "openaec-fem";
const SERVER_VERSION: &str = env!("CARGO_PKG_VERSION");

// ── JSON-RPC types ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct Request {
    jsonrpc: String,
    #[serde(default)]
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Option<Value>,
}

#[derive(Debug, Serialize)]
struct Response {
    jsonrpc: &'static str,
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<RpcError>,
}

#[derive(Debug, Serialize)]
struct RpcError {
    code: i32,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
}

impl RpcError {
    fn invalid_params(msg: impl Into<String>) -> Self {
        Self {
            code: -32602,
            message: msg.into(),
            data: None,
        }
    }
    fn tool_exec(msg: impl Into<String>) -> Self {
        Self {
            code: -32000,
            message: msg.into(),
            data: None,
        }
    }
    fn method_not_found(method: &str) -> Self {
        Self {
            code: -32601,
            message: format!("Method not found: {method}"),
            data: None,
        }
    }

    /// De fout als machineleesbaar object, voor `structuredContent` op het
    /// toolfoutpad.
    ///
    /// Waarom dit bestaat: `tools/call` geeft een toolfout per MCP-spec terug
    /// als een *geslaagd* resultaat met `isError: true`, zodat het model de fout
    /// kan lezen. Daarbij verdampten tot nu toe de foutcode en `data`, en bleef
    /// er alleen een tekstregel over. Voor een client leest "Node ontbreekt" dan
    /// identiek aan "je raamwerk is een mechanisme" — de eerste is een
    /// installatieprobleem, de tweede een constructieve bevinding. Bij
    /// rekensoftware mag een ontbrekende runtime nooit op een rekenfout lijken,
    /// dus gaan code, melding, remedie en detail hier mee terug.
    ///
    /// `data` is de bron zodra die er is: de FEM-tools vullen hem al met
    /// `error_code`, `melding`, `remedie` en `detail`. Ontbreekt hij, dan wordt
    /// er een code afgeleid uit de JSON-RPC-code, zodat een client ALTIJD iets
    /// machineleesbaars krijgt en nooit op de meldingstekst hoeft te matchen.
    fn gestructureerde_fout(&self) -> Value {
        let mut velden = match &self.data {
            Some(Value::Object(map)) => map.clone(),
            // Een niet-object `data` (geen enkele tool doet dit vandaag) gaat
            // ongewijzigd mee als detail in plaats van verloren te gaan.
            Some(anders) => {
                let mut m = Map::new();
                m.insert("detail".to_owned(), anders.clone());
                m
            }
            None => Map::new(),
        };
        velden
            .entry("error_code")
            .or_insert_with(|| json!(afgeleide_foutcode(self.code)));
        velden
            .entry("melding")
            .or_insert_with(|| json!(self.message));
        // De sleutel staat er altijd, desnoods op `null`: dan is zichtbaar dat
        // er geen remedie bekend is, in plaats van dat het veld ontbreekt en de
        // client moet raden of hij iets mist.
        velden.entry("remedie").or_insert(Value::Null);
        Value::Object(velden)
    }
}

/// JSON-RPC-code → machineleesbare foutcode, als terugval voor tools die er zelf
/// nog geen meegeven (de vijf staaltools).
///
/// Bewust grof en kort: dit is een terugvalwaarde, geen tweede codelijst naast
/// die van de sidecar. `ARGUMENT_ONGELDIG` is dezelfde code die `fem_tools`
/// gebruikt voor een ondeugdelijke aanroep, zodat een client één begrip heeft
/// voor "jouw aanroep deugde niet".
fn afgeleide_foutcode(code: i32) -> &'static str {
    match code {
        -32602 => "ARGUMENT_ONGELDIG",
        -32601 => "TOOL_ONBEKEND",
        _ => "TOOL_MISLUKT",
    }
}

fn ok(id: Value, result: Value) -> Response {
    Response {
        jsonrpc: "2.0",
        id,
        result: Some(result),
        error: None,
    }
}
fn err(id: Value, error: RpcError) -> Response {
    Response {
        jsonrpc: "2.0",
        id,
        result: None,
        error: Some(error),
    }
}

// ── Tool registry ────────────────────────────────────────────────────────────


const BESCHRIJVING_DOORSNEDE: &str = "Herberekent de doorsnedegrootheden (A, Iy, Iz, Wel, Wpl, Av, It, Iw, traagheidsstralen, zwaartepunt, schuifmiddelpunt, plastische neutrale lijn) van een catalogusprofiel uit zijn genormeerde maten met de exacte doorsnedemotor van section-properties: contourintegralen voor de meetkundige grootheden, een numerieke torsieoplossing (met insluiting van It) voor It en Iw. Dezelfde motor die de catalogus vult; flenshelling van UNP en INP, walsuitrondingen en de EN 10210-hoekstralen van kokers zitten erin. Het antwoord is plat (area_mm2, iy_mm4, ...) plus diagnostiek (a_mesh_afwijking, it_onzekerheid, meldingen, tijd_ms). 'catalogus_vergelijking' zet de cataloguswaarden van I_t en I_w ernaast, met hun bron en het verschil: bij IPE/HEA/HEB/HEM is de catalogus-I_t de EN 10365-tabelwaarde en de catalogus-I_w de motorwaarde; de it-onzekerheidsband is de numerieke insluiting voor de geïdealiseerde contour, geen band rond de tabel.";

fn tool_definitions() -> Value {
    let mut tools: Vec<Value> = Vec::new();
    tools.push(
        json!({
            "name": "list_steel_profiles",
            "description": "List all steel cross-section profiles in the OpenAEC database (HEA, HEB, IPE, HEM, UNP, RHS, SHS, CHS). Each profile includes geometry, section properties, and EN 1993-1-1 buckling curves. 'bronnen' says per group which properties come from a published profile table and which are computed: for IPE/HEA/HEB/HEM A, I, W, i, A_v and I_t are EN 10365 table values while I_w comes from the section engine (the table I_w is an upper bound).",
            "inputSchema": { "type": "object", "properties": {}, "additionalProperties": false }
        })
    );
    tools.push(
        json!({
            "name": "compute_section_properties",
            "description": BESCHRIJVING_DOORSNEDE,
            "inputSchema": {
                "type": "object",
                "properties": {
                    "profile_name": { "type": "string", "description": "e.g. 'HEA200'" }
                },
                "required": ["profile_name"],
                "additionalProperties": false
            }
        })
    );
    let lijst = &mut tools;
    lijst.extend(fem_tools::tool_definitions());
    lijst.extend(frame3d_tools::tool_definitions());
    lijst.extend(native_fem_tools::tool_definitions());
    lijst.extend(open_fem_3d_tools::tool_definitions());
    lijst.extend(staalhal_tools::tool_definitions());
    lijst.extend(ifc_import_tools::tool_definitions());
    lijst.extend(ifc_resultaten_tools::tool_definitions());
    lijst.extend(extensie_tools::tool_definitions());
    lijst.extend(gui_tools::tool_definitions());
    lijst.extend(api_tools::tool_definitions());
    Value::Array(tools)
}

// ── Tool dispatch ────────────────────────────────────────────────────────────

async fn dispatch_tool(name: &str, args: Value) -> Result<Value, RpcError> {
    match name {
        "list_steel_profiles" => {
            let profiles = tokio::task::spawn_blocking(|| steel_profiles::db().all().to_vec())
                .await
                .map_err(|e| RpcError::tool_exec(format!("join error: {e}")))?;
            // Issue #241: de catalogus mengt tabel- en motorwaarden; per
            // groep staat hier welke grootheid waarvandaan komt.
            Ok(json!({ "profiles": profiles, "bronnen": steel_profiles::herkomst_groepen() }))
        }
        "compute_section_properties" => {
            let profile_name = args
                .get("profile_name")
                .and_then(Value::as_str)
                .ok_or_else(|| RpcError::invalid_params("missing string field 'profile_name'"))?
                .to_owned();
            let naam = profile_name.clone();
            let result = tokio::task::spawn_blocking(move || compute_section_props(&profile_name))
                .await
                .map_err(|e| RpcError::tool_exec(format!("join error: {e}")))??;
            let mut v = serde_json::to_value(result)
                .map_err(|e| RpcError::tool_exec(format!("serialize result: {e}")))?;
            voeg_catalogusvergelijking_toe(&naam, &mut v);
            Ok(v)
        }
        // De FEM-tools. Ze rekenen niet hier: `fem_tools` zet het verzoek klaar
        // voor de Node-sidecar, die dezelfde solverfuncties uitvoert als de app.
        fem if fem_tools::is_fem_tool(fem) => fem_tools::dispatch(fem, args).await,
        frame3d if frame3d_tools::is_frame3d_tool(frame3d) => {
            frame3d_tools::dispatch(frame3d, args).await
        }
        native if native_fem_tools::is_native_fem_tool(native) => {
            native_fem_tools::dispatch(native, args).await
        }
        open_fem_3d if open_fem_3d_tools::is_open_fem_3d_tool(open_fem_3d) => {
            open_fem_3d_tools::dispatch(open_fem_3d, args).await
        }
        hal if staalhal_tools::is_staalhal_tool(hal) => staalhal_tools::dispatch(hal, args).await,
        ifc if ifc_import_tools::is_ifc_import_tool(ifc) => ifc_import_tools::dispatch(ifc, args).await,
        res if ifc_resultaten_tools::is_ifc_resultaten_tool(res) => ifc_resultaten_tools::dispatch(res, args).await,
        extensie if extensie_tools::is_extensie_tool(extensie) => extensie_tools::dispatch(extensie, args).await,
        // De GUI-tools: geen rekenwerk, maar opdrachten aan de draaiende app
        // over haar bedieningskanaal. Zie `gui_tools.rs`.
        gui if gui_tools::is_gui_tool(gui) => gui_tools::dispatch(gui, args).await,
        api if api_tools::is_api_tool(api) => api_tools::dispatch(api, args).await,
        other => Err(RpcError::method_not_found(other)),
    }
}


fn compute_section_props(
    profile_name: &str,
) -> Result<section_properties::opdracht::Uitvoer, RpcError> {
    use steel_profiles::ProfileKind;
    // Tot september 2026 rekende dit gereedschap met oude handboekformules
    // (basisaudit nr 34): zonder flenshelling (UNP: I_z +15 %, W_pl,z −32 %),
    // met een grove It en Iw. Nu gaat het door `section_properties::opdracht`,
    // dezelfde ingang als het generatiescript dat de catalogus vult, zodat
    // het antwoord de catalogus reproduceert in plaats van tegenspreekt.
    let profile = steel_profiles::db()
        .find(profile_name)
        .ok_or_else(|| RpcError::invalid_params(format!("unknown profile: {profile_name}")))?;
    let g = &profile.geometry;
    let schuin = g.flange_slope > 0.0;
    let soort = match profile.kind {
        ProfileKind::ISection if schuin => "ISectionSchuin",
        ProfileKind::ISection => "ISection",
        ProfileKind::Channel if schuin => "ChannelSchuin",
        ProfileKind::Channel => "Channel",
        ProfileKind::Rhs => "Rhs",
        ProfileKind::Shs => "Shs",
        ProfileKind::Chs => "Chs",
        ProfileKind::Angle => "Angle",
        // Massief rond staal: de motor rekent dezelfde cirkel als de
        // catalogus (exacte kwartbogen; I_t numeriek).
        ProfileKind::RoundBar => "RoundBar",
        // Platstaal: een massieve rechthoek met h = de breedte b van de strip
        // (langs z) en b = de dikte t. De motor geeft daarbij ook de kleine
        // welvingsconstante van een rechthoek; de catalogus zet I_w op 0.
        ProfileKind::FlatBar => "Rechthoek",
    };
    let invoer: section_properties::opdracht::Invoer = serde_json::from_value(json!({
        "naam": profile.name,
        "soort": soort,
        "h": g.h, "b": g.b, "tw": g.tw, "tf": g.tf, "t": g.t, "r": g.r, "r2": g.r2,
    }))
    .map_err(|e| RpcError::tool_exec(format!("doorsnedemotor-invoer: {e}")))?;
    section_properties::opdracht::reken(&invoer)
        .map_err(|e| RpcError::tool_exec(format!("doorsnedemotor: {e}")))
}

/// Issue #241: zet naast de motoruitkomst van `compute_section_properties` de
/// cataloguswaarden van I_t en I_w, met hun bron en het verschil, en de
/// toelichting op de herkomst. Zo staat de menging van tabel- en motorwaarden
/// in de catalogus niet ongemeld naast elkaar.
fn voeg_catalogusvergelijking_toe(profile_name: &str, v: &mut Value) {
    let Some(p) = steel_profiles::db().find(profile_name) else { return };
    let h = steel_profiles::herkomst(p);
    let bron = |veld: &str| {
        if h.tabel.contains(&veld) {
            "profieltabel (EN 10365)"
        } else {
            "berekend (doorsnedemotor of gesloten formule)"
        }
    };
    let vergelijk = |veld: &str, catalogus: f64| {
        let motor = v[veld].as_f64().unwrap_or(f64::NAN);
        let verschil = if catalogus != 0.0 { (motor - catalogus) / catalogus * 100.0 } else { f64::NAN };
        json!({
            "catalogus": catalogus,
            "bron_catalogus": bron(veld),
            "motor": motor,
            "verschil_motor_pct": if verschil.is_finite() { json!(verschil) } else { Value::Null },
        })
    };
    let it = vergelijk("it_mm4", p.properties.it_mm4);
    let iw = vergelijk("iw_mm6", p.properties.iw_mm6);
    if let Value::Object(m) = v {
        m.insert(
            "catalogus_vergelijking".to_owned(),
            json!({ "it_mm4": it, "iw_mm6": iw, "toelichting": h.toelichting }),
        );
    }
}

// ── JSON-RPC method dispatch ────────────────────────────────────────────────

/// Returns `None` for notifications (no response should be written).
async fn handle_request(req: Request) -> Option<Response> {
    if req.jsonrpc != "2.0" {
        if let Some(id) = req.id {
            return Some(err(
                id,
                RpcError {
                    code: -32600,
                    message: format!(
                        "Invalid Request: jsonrpc must be '2.0', got '{}'",
                        req.jsonrpc
                    ),
                    data: None,
                },
            ));
        }
        return None;
    }

    let id = req.id.clone();
    let is_notification = id.is_none();

    let response_payload: Result<Value, RpcError> = match req.method.as_str() {
        "initialize" => Ok(json!({
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": { "tools": { "listChanged": false } },
            "serverInfo": { "name": SERVER_NAME, "version": SERVER_VERSION }
        })),
        "notifications/initialized" | "initialized" => {
            tracing::info!("client initialized");
            return None;
        }
        "tools/list" => Ok(json!({ "tools": tool_definitions() })),
        "tools/call" => {
            let params = req.params.unwrap_or_else(|| json!({}));
            let name = match params.get("name").and_then(Value::as_str) {
                Some(n) => n.to_owned(),
                None => {
                    let resp = err(
                        id.unwrap_or(Value::Null),
                        RpcError::invalid_params("tools/call requires 'name' string param"),
                    );
                    return Some(resp);
                }
            };
            let arguments = params
                .get("arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));
            match dispatch_tool(&name, arguments).await {
                Ok(value) => {
                    // Per MCP spec: tool result is wrapped as { content: [{type: "text", text: <json>}], isError: false }
                    let text = serde_json::to_string(&value)
                        .unwrap_or_else(|e| format!("{{\"error\":\"serialize: {e}\"}}"));
                    Ok(json!({
                        "content": [{ "type": "text", "text": text }],
                        "isError": false,
                        "structuredContent": value
                    }))
                }
                Err(e) => {
                    // Tool execution errors are reported in result, not as JSON-RPC errors,
                    // per MCP spec for tools/call (so the model can see them).
                    //
                    // De tekstregel is voor een mens; `structuredContent` houdt
                    // de foutcode, de Nederlandse remedie en het detail heel.
                    // Zonder dat is een storing in de rekenketen voor een client
                    // niet te onderscheiden van een constructieve bevinding —
                    // zie `RpcError::gestructureerde_fout`.
                    Ok(json!({
                        "content": [{ "type": "text", "text": format!("Error: {}", e.message) }],
                        "isError": true,
                        "structuredContent": e.gestructureerde_fout()
                    }))
                }
            }
        }
        "ping" => Ok(json!({})),
        other => Err(RpcError::method_not_found(other)),
    };

    if is_notification {
        return None;
    }
    let id = id.unwrap_or(Value::Null);
    Some(match response_payload {
        Ok(v) => ok(id, v),
        Err(e) => err(id, e),
    })
}

// ── Stdio loop ───────────────────────────────────────────────────────────────

async fn run_stdio() -> std::io::Result<()> {
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();
    let stdout = Arc::new(Mutex::new(stdout));

    let mut reader = BufReader::new(stdin).lines();
    // Elk verzoek draait als eigen taak. Sluit de client stdin direct na zijn
    // verzoeken (een pijp, een script), dan maakt de server die taken eerst af:
    // anders eindigt main en vallen de antwoorden weg.
    let mut lopend = tokio::task::JoinSet::new();
    while let Some(line) = reader.next_line().await? {
        let line = line.trim().to_string();
        if line.is_empty() { continue; }
        // Afgeronde taken opruimen, zodat de set in een lange sessie niet groeit.
        while lopend.try_join_next().is_some() {}

        let stdout = stdout.clone();
        lopend.spawn(async move {
            let resp = match serde_json::from_str::<Request>(&line) {
                Ok(req) => handle_request(req).await,
                Err(e) => {
                    tracing::warn!(error = %e, raw = %line, "failed to parse request");
                    Some(err(
                        Value::Null,
                        RpcError {
                            code: -32700,
                            message: format!("Parse error: {e}"),
                            data: None,
                        },
                    ))
                }
            };
            if let Some(resp) = resp {
                match serde_json::to_string(&resp) {
                    Ok(mut s) => {
                        s.push('\n');
                        let mut out = stdout.lock().await;
                        if let Err(e) = out.write_all(s.as_bytes()).await {
                            tracing::error!(error = %e, "stdout write failed");
                        }
                        if let Err(e) = out.flush().await {
                            tracing::error!(error = %e, "stdout flush failed");
                        }
                    }
                    Err(e) => tracing::error!(error = %e, "failed to serialize response"),
                }
            }
        });
    }
    while lopend.join_next().await.is_some() {}
    Ok(())
}

#[tokio::main(flavor = "multi_thread")]
async fn main() -> std::io::Result<()> {
    // Tracing → stderr only. stdout is exclusively for protocol traffic.
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_env("OPENAEC_MCP_LOG")
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tracing::info!(
        version = SERVER_VERSION,
        "openaec-mcp-server starting on stdio"
    );
    run_stdio().await?;
    tracing::info!("openaec-mcp-server shutting down (stdin closed)");
    Ok(())
}

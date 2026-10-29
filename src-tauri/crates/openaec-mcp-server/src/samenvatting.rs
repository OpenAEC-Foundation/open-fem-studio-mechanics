//! Compacte samenvatting van antwoorden (`detail: "samenvatting"`, issue #229):
//! lijsten per knoop, staaf en plaatelement worden aantallen met hun uitersten.

use serde_json::{json, Map, Value};



/// Het grootste |veld| over een lijst objecten, met het id-veld erbij.
fn grootste(lijst: &[Value], id: &str, velden: &[&str]) -> Option<Value> {
    let mut beste: Option<(f64, &Value, &str)> = None;
    for item in lijst {
        for veld in velden {
            if let Some(v) = item[*veld].as_f64() {
                if beste.map_or(true, |(b, _, _)| v.abs() > b) {
                    beste = Some((v.abs(), item, veld));
                }
            }
        }
    }
    beste.map(|(_, item, veld)| json!({ id: item[id].clone(), "veld": veld, "waarde": item[veld].clone() }))
}

/// Het 3D-rekenresultaat (`SolveResult3D`, camelCase) als samenvatting: alle
/// kale velden en de kleine samenvattingen (engine, analysis, secondOrder,
/// equilibrium, forceBalance, buckling-status en -modes, plates, diagnostics,
/// inactiveMembers, …) blijven; de lijsten per knoop, staaf en plaatelement
/// worden aantallen plus hun uitersten. Er wordt niets herberekend.
fn samenvat_3d_resultaat(r: &Value) -> Value {
    let Some(obj) = r.as_object() else { return r.clone() };
    let mut uit = Map::new();
    let mut aantallen = Map::new();
    let mut uitersten = Map::new();
    for (sleutel, waarde) in obj {
        match (sleutel.as_str(), waarde) {
            ("displacements", Value::Array(l)) => {
                aantallen.insert(sleutel.clone(), json!(l.len()));
                if let Some(m) = grootste(l, "nodeId", &["ux", "uy", "uz"]) {
                    uitersten.insert("verplaatsing_m".into(), m);
                }
                if let Some(m) = grootste(l, "nodeId", &["rx", "ry", "rz"]) {
                    uitersten.insert("rotatie_rad".into(), m);
                }
            }
            ("reactions", Value::Array(l)) => {
                aantallen.insert(sleutel.clone(), json!(l.len()));
                let mut som = [0.0_f64; 3];
                for item in l {
                    for (i, veld) in ["fx", "fy", "fz"].iter().enumerate() {
                        som[i] += item[*veld].as_f64().unwrap_or(0.0);
                    }
                }
                uit.insert("reactieSomKn".into(), json!(som));
                // Een paar opleggingen zijn klein en dragen het oordeel.
                if l.len() <= 20 {
                    uit.insert(sleutel.clone(), waarde.clone());
                }
            }
            ("memberForces", Value::Array(l)) => {
                aantallen.insert(sleutel.clone(), json!(l.len()));
                for (naam, velden) in [
                    ("N_kN", ["nStartKn", "nEndKn"]),
                    ("Vy_kN", ["vyStartKn", "vyEndKn"]),
                    ("Vz_kN", ["vzStartKn", "vzEndKn"]),
                    ("T_kNm", ["torsionStartKnm", "torsionEndKnm"]),
                    ("My_kNm", ["myStartKnm", "myEndKnm"]),
                    ("Mz_kNm", ["mzStartKnm", "mzEndKnm"]),
                ] {
                    if let Some(m) = grootste(l, "memberId", &velden) {
                        uitersten.insert(format!("staafeinde_{naam}"), m);
                    }
                }
            }
            // Snedekrachtlijnen: per component de staaf met de grootste
            // |waarde| over de hele lijn (maxAbsValue), dus ook in het veld.
            ("diagrams", Value::Object(d)) => {
                let mut lijnen = Map::new();
                for (component, lijst) in d {
                    let Some(l) = lijst.as_array() else { continue };
                    if let Some(m) = grootste(l, "memberId", &["maxAbsValue"]) {
                        lijnen.insert(component.clone(), m);
                    }
                }
                aantallen.insert(sleutel.clone(), json!(d.values().filter_map(Value::as_array).map(Vec::len).max().unwrap_or(0)));
                uitersten.insert("snedekrachtlijnen".into(), Value::Object(lijnen));
            }
            ("buckling", Value::Object(b)) => {
                let mut kort = Map::new();
                for (k, v) in b {
                    if k == "members" {
                        aantallen.insert("buckling.members".into(), json!(v.as_array().map(Vec::len).unwrap_or(0)));
                    } else {
                        kort.insert(k.clone(), v.clone());
                    }
                }
                uit.insert(sleutel.clone(), Value::Object(kort));
            }
            // Eén regel per plaat met haar uitersten: klein, blijft.
            ("plates", _) => {
                uit.insert(sleutel.clone(), waarde.clone());
            }
            (_, Value::Array(l)) if !l.iter().all(|v| v.is_string() || v.is_number()) => {
                aantallen.insert(sleutel.clone(), json!(l.len()));
            }
            ("plateMesh", Value::Object(_)) => {
                aantallen.insert(sleutel.clone(), json!(1));
            }
            _ => {
                uit.insert(sleutel.clone(), waarde.clone());
            }
        }
    }
    uit.insert("uitersten".into(), Value::Object(uitersten));
    uit.insert("weggelaten".into(), Value::Object(aantallen));
    Value::Object(uit)
}

/// `gui_solve` als samenvatting (#229). Het 2D-antwoord is al kort en blijft
/// zoals het is. Het 3D-antwoord verliest de lijsten per knoop, staaf en
/// plaatelement (zie [`samenvat_3d_resultaat`]); meldingen en het
/// combinatieoverzicht blijven.
pub(crate) fn samenvat_gui_solve(uit: &mut Value) {
    let Some(map) = uit.as_object_mut() else { return };
    if map.get("dimension").and_then(Value::as_str) == Some("3d") {
        if let Some(r) = map.get("result") {
            let kort = samenvat_3d_resultaat(r);
            map.insert("result".into(), kort);
        }
    }
    map.insert("detail".into(), json!("samenvatting"));
    map.insert(
        "toelichting_detail".into(),
        json!(TOELICHTING_GUI_SOLVE),
    );
}

const TOELICHTING_GUI_SOLVE: &str = "Samenvatting: lijsten per knoop, staaf en plaatelement staan als aantal in `result.weggelaten` en met hun uitersten in `result.uitersten`. Vraag `detail: \"volledig\"` (standaard) voor alles.";
const BESCHRIJVING_DETAIL: &str = "\"samenvatting\" geeft een kort antwoord: lijsten per knoop, staaf en plaatelement worden aantallen met hun uitersten. \"volledig\" (standaard) geeft alles.";

/// Lees `detail` (`"samenvatting"` of `"volledig"`) uit de argumenten en haal
/// het eruit, zodat de rest naar een strikte invoerstructuur kan.
pub(crate) fn neem_detail(args: &mut Value) -> Result<bool, String> {
    match args.as_object_mut().and_then(|m| m.remove("detail")) {
        None => Ok(false),
        Some(Value::String(s)) if s == "volledig" => Ok(false),
        Some(Value::String(s)) if s == "samenvatting" => Ok(true),
        Some(v) => Err(format!("`detail` moet \"samenvatting\" of \"volledig\" zijn, niet {v}.")),
    }
}

/// Het schema van `detail`, gedeeld door de tools die het kennen.
pub(crate) fn schema_detail() -> Value {
    json!({
        "type": "string", "enum": ["volledig", "samenvatting"], "default": "volledig",
        "description": BESCHRIJVING_DETAIL
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn toets(id: &str, uc: f64) -> Value {
        json!({ "id": id, "kind": { "type": "Resistance", "data": {
            "id": id, "title": "Buiging", "article": "6.1.6",
            "force_state": { "combination_id": 3, "position_mm": 2000.0,
                "forces": { "n_ed": 0.0, "vy_ed": 0.0, "vz_ed": 6.0, "mt_ed": 0.0, "my_ed": 6.0, "mz_ed": 0.0 } },
            "formula_latex": "\\frac{a}{b}", "variables": [{ "symbol": "a", "value": 1.0, "unit": "" }],
            "value": 14.77, "unit": "MPa", "uc": { "ed": 9.481, "rd": 14.77, "uc": uc, "formula_latex": "x" },
            "status": "Ok", "notes": ["lange toelichting"], "deelstappen": [{ "titel": "stap" }]
        }}})
    }



    /// gui_solve 3D: twee knopen, één staaf, een plaat met 600 elementen.
    /// De lijsten worden aantallen met hun uitersten; oordeel en
    /// samenvattingen blijven; 2D blijft zoals het was.
    #[test]
    fn gui_solve_3d_wordt_kort_en_2d_blijft() {
        let elementen: Vec<Value> = (0..600).map(|i| json!({ "elementId": i, "plateId": 1,
            "values": { "mxxKnmPerM": i as f64 * 0.01, "myyKnmPerM": 0.0 } })).collect();
        let mut uit = json!({
            "dimension": "3d", "melding": null, "maxVerplaatsingMm": 12.5,
            "combinatieResultaten": [{ "id": 1, "maxVerplaatsingMm": 12.5, "alphaCr": 11.0 }],
            "result": {
                "schemaVersion": 2, "engine": { "id": "e" }, "analysis": "pDelta",
                "displacements": [
                    { "nodeId": 1, "ux": 0.0, "uy": 0.0, "uz": 0.0, "rx": 0.0, "ry": 0.0, "rz": 0.0 },
                    { "nodeId": 2, "ux": 0.001, "uy": 0.0, "uz": -0.0125, "rx": 0.0, "ry": 0.004, "rz": 0.0 }],
                "reactions": [{ "nodeId": 1, "fx": -2.0, "fy": 0.0, "fz": 30.0, "mx": 0.0, "my": 5.0, "mz": 0.0 }],
                "memberForces": [{ "memberId": 7, "nStartKn": -3.0, "nEndKn": -3.0, "myStartKnm": 0.0, "myEndKnm": -40.0 }],
                "diagrams": { "momentY": [{ "memberId": 7, "points": [{ "x": 0.0, "value": 0.0 }], "maxValue": 45.0, "minValue": -40.0, "maxAbsValue": 45.0 }],
                              "axial": [{ "memberId": 7, "points": [], "maxValue": -3.0, "minValue": -3.0, "maxAbsValue": 3.0 }] },
                "buckling": { "status": "available", "modes": [{ "mode": 1, "loadFactor": 11.0 }], "members": [{ "memberId": 7 }] },
                "diagnostics": ["d"], "inactiveMembers": [3],
                "plates": [{ "plateId": 1, "elementCount": 600, "extremes": [{ "q": "mxx" }] }],
                "shellElements": elementen,
            },
            "steel": { "results": [{ "beam_id": 7, "uc_max": 0.5, "status": "Ok", "checks": [toets("b", 0.5)] }],
                       "skipped": [{ "beamId": 8, "reason": "hout" }], "notes": ["n"] },
            "concrete": null, "timber": null,
        });
        let groot = serde_json::to_string(&uit).unwrap().len();
        samenvat_gui_solve(&mut uit);
        let klein = serde_json::to_string(&uit).unwrap().len();
        assert!(klein < 4000 && klein * 5 < groot, "{groot} → {klein}");
        let r = &uit["result"];
        assert!(r.get("shellElements").is_none() && r.get("displacements").is_none() && r.get("diagrams").is_none());
        assert_eq!(r["weggelaten"]["shellElements"], json!(600));
        assert_eq!(r["weggelaten"]["displacements"], json!(2));
        assert_eq!(r["uitersten"]["verplaatsing_m"], json!({ "nodeId": 2, "veld": "uz", "waarde": -0.0125 }));
        assert_eq!(r["uitersten"]["snedekrachtlijnen"]["momentY"], json!({ "memberId": 7, "veld": "maxAbsValue", "waarde": 45.0 }));
        assert_eq!(r["uitersten"]["staafeinde_My_kNm"]["waarde"], json!(-40.0));
        assert_eq!(r["reactieSomKn"], json!([-2.0, 0.0, 30.0]));
        assert_eq!(r["buckling"]["modes"][0]["loadFactor"], json!(11.0));
        assert!(r["buckling"].get("members").is_none());
        assert_eq!(r["plates"][0]["elementCount"], json!(600));
        assert_eq!(r["inactiveMembers"], json!([3]));
        assert_eq!(uit["steel"]["skipped"][0]["beamId"], json!(8));
        assert_eq!(uit["combinatieResultaten"][0]["alphaCr"], json!(11.0));
        assert_eq!(uit["detail"], json!("samenvatting"));

        let twee_d = json!({ "combinaties": [{ "combinatie": 1, "M_max_kNm": 4.0 }], "toetsing": { "getoetst": 3 } });
        let mut kopie = twee_d.clone();
        samenvat_gui_solve(&mut kopie);
        assert_eq!(kopie["combinaties"], twee_d["combinaties"]);
        assert_eq!(kopie["toetsing"], twee_d["toetsing"]);
    }

    #[test]
    fn detail_wordt_gelezen_en_verwijderd() {
        let mut a = json!({ "detail": "samenvatting", "x": 1 });
        assert_eq!(neem_detail(&mut a), Ok(true));
        assert_eq!(a, json!({ "x": 1 }));
        assert_eq!(neem_detail(&mut json!({})), Ok(false));
        assert_eq!(neem_detail(&mut json!({ "detail": "volledig" })), Ok(false));
        assert!(neem_detail(&mut json!({ "detail": "kort" })).is_err());
    }
}

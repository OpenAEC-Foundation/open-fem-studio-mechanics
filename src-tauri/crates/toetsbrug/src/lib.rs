//! `toetsbrug` — de normtoetsing als JSON-in / JSON-uit, zodat de browser er
//! ook bij kan.
//!
//! De toetsing draait in Rust en was daardoor alleen bereikbaar vanuit de
//! desktop-app: de frontend roept hem aan via Tauri's `invoke`, en dat bestaat
//! in een gewone browser niet. Wie de app op de dev-server bekeek, kreeg overal
//! waar toetsing hoort te staan een melding dat de desktop-app nodig is — in
//! het canvas én in het rapport.
//!
//! Deze crate biedt dezelfde functies aan als de Tauri-commands, met precies
//! dezelfde typen, zodat er geen tweede implementatie ontstaat. De dev-server
//! roept de binary aan (zie `vite.config.ts`) en geeft het antwoord door.
//!
//! ```text
//! echo '{"opdracht":"check_steel_beams","inputs":[…]}' | toetsbrug
//! ```
//!
//! WAAROM LIB + BIN
//! [`behandel`] staat in het libdeel en niet in `main.rs`, om dezelfde reden
//! als bij `openaec-mcp-server`: zo kan een test bij de werkelijke
//! opdrachtafhandeling zonder een proces te hoeven starten. De
//! drie-wegen-verificatie (`openaec-mcp-server/tests/drie_wegen_beton.rs`)
//! vergelijkt het antwoord van déze functie met dat van de MCP-server en van
//! de rekengang achter het Tauri-command. Zonder libdeel zou die vergelijking
//! de toetsbrug moeten naprogrammeren, en dan toont ze niets aan.
//!
//! De binary is een doorgeefluik: invoer op stdin, uitvoer op stdout, beide
//! JSON. Een fout komt terug als `{"fout": "…"}` met afsluitcode 1; de
//! aanroeper hoeft stderr niet te lezen.

use openaec_native_fem::dispatch::NativeFemRequest;
use serde::Deserialize;
use serde_json::Value;

/// Eén verzoek. `opdracht` kiest de functie; de rest hangt daarvan af.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Verzoek {
    pub opdracht: String,
    /// Staaltoetsing: de staven die getoetst moeten worden.
    #[serde(default)]
    pub inputs: Option<Value>,
}

pub fn behandel(v: Verzoek) -> Result<Value, String> {
    match v.opdracht.as_str() {
        "solve_native_fem" => {
            let inputs = v.inputs.ok_or("solve_native_fem vraagt om `inputs`")?;
            let request: NativeFemRequest =
                serde_json::from_value(inputs).map_err(|e| format!("native FEM-invoer: {e}"))?;
            serde_json::to_value(openaec_native_fem::dispatch::solve_native_fem(request)?)
                .map_err(|e| e.to_string())
        }
        "list_steel_profiles" => {
            serde_json::to_value(steel_profiles::db().all()).map_err(|e| e.to_string())
        }
        andere => Err(format!("onbekende opdracht: {andere}")),
    }
}

#[cfg(test)]
mod native_fem_tests {
    use super::*;

    #[test]
    fn native_square_mesh_uses_the_shared_dispatcher_contract() {
        let value = serde_json::json!({
            "opdracht": "solve_native_fem",
            "inputs": { "kind": "squareMesh", "input": {
                "originX": 0, "originY": 0, "widthM": 2, "heightM": 2,
                "cellSizeM": 1, "materialId": 1, "thicknessM": 0.1
            }}
        });
        let request: Verzoek = serde_json::from_value(value).unwrap();
        let answer = behandel(request).unwrap();
        assert_eq!(answer["kind"], "squareMesh");
        assert_eq!(answer["result"]["nodes"].as_array().unwrap().len(), 9);
    }

    #[test]
    fn j2_sparse_pcg_reaches_the_shared_dispatcher_contract() {
        let mut inputs: Value = serde_json::from_str(include_str!(
            "../../native-fem/examples/volume3d-j2-steel-coupon.json"
        ))
        .unwrap();
        inputs["input"]["options"]["linearBackend"] = "sparsePcg".into();
        inputs["input"]["options"]["pcgThreads"] = 2.into();
        let request = Verzoek {
            opdracht: "solve_native_fem".into(),
            inputs: Some(inputs),
        };
        let answer = behandel(request).unwrap();
        assert_eq!(answer["kind"], "volume3dJ2");
        assert_eq!(answer["result"]["linearBackendUsed"], "sparsePcg");
        assert!(answer["result"]["trueFreeResidualKn"].as_f64().unwrap() < 1e-4);
    }

    #[test]
    fn prestressed_beam_accepts_piecewise_modulus_and_shear_links_through_bridge() {
        let value = serde_json::json!({
            "opdracht": "solve_native_fem",
            "inputs": { "kind": "prestressedBeam", "input": {
                "spanM": 10,
                "section": {
                    "areaM2": 0.5, "inertiaM4": 0.02,
                    "topFibreM": 0.3, "bottomFibreM": 0.3, "eMpa": 30000
                },
                "stiffnessSegments": [
                    {"startM": 0, "endM": 5, "eMpa": 30000},
                    {"startM": 5, "endM": 10, "eMpa": 15000}
                ],
                "tendon": {"kind": "parabolic", "endEccentricityM": 0, "midEccentricityM": 0.2},
                "initialForceKn": 1000,
                "lossFraction": 0.2,
                "serviceUniformDownwardKnPerM": 16,
                "shearLinks": {
                    "webWidthMm": 300,
                    "effectiveDepthMm": 500,
                    "leverArmMm": 450,
                    "alphaCw": 1,
                    "nu1": 0.6,
                    "fcdMpa": 20,
                    "fywdMpa": 435,
                    "cotTheta": 2,
                    "providedAswMm2": 157,
                    "providedSpacingMm": 150
                }
            }}
        });
        let request: Verzoek = serde_json::from_value(value).unwrap();
        let answer = behandel(request).unwrap();
        assert_eq!(answer["kind"], "prestressedBeam");
        assert_eq!(
            answer["result"]["service"]["stations"][3]["effectiveEMpa"],
            15000.0
        );
        assert!(
            answer["result"]["service"]["stations"][3]["shearLinks"]
                ["requiredAswPerSpacingMm2PerMm"]
                .as_f64()
                .unwrap()
                > 0.0
        );
    }
}

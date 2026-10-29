//! Schema's van modelvelden die het projectbestand draagt en die zowel de
//! modeltools (`fem_tools`: `checkConfig` per staaf, de plaatvelden
//! `wapening` en `plooi`) als de toetstools (`concrete_tools`, `plate_tools`)
//! gebruiken. Ze staan hier, los van de toetsmodules, zodat het modelschema
//! ook in de editie zonder normtoetsing hetzelfde projectbestand beschrijft.

use serde_json::{json, Value};

/// Eén rij hoofdwapening (`RebarRow`): aantal staven en diameter.
pub(crate) fn schema_wapeningsrij(omschrijving: &str) -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "description": omschrijving,
        "required": ["count", "diameter_mm"],
        "properties": {
            "count": { "type": "integer", "minimum": 0, "description": "Aantal staven in de rij; 0 = geen wapening aan deze zijde." },
            "diameter_mm": { "type": "number", "minimum": 0, "description": "Staafdiameter in mm." }
        }
    })
}

pub(crate) fn schema_steel_branch() -> Value {
    json!({
        "type": "string", "enum": ["Horizontal", "Inclined"], "default": "Horizontal",
        "description": "Bovenste tak van het staaldiagram (3.2.7(2), figuur 3.8). \"Horizontal\" = 3.2.7(2)b, horizontaal op f_yd zonder rekgrens (default). \"Inclined\" = 3.2.7(2)a, hellend tot k·f_yk/gamma_S bij eps_uk, met rekgrens eps_ud = 0,9·eps_uk (NB)."
    })
}

/// Schema van `reinforcement_zones` — de wapening die LANGS de staaf
/// verandert.
///
/// Twee gescheiden lijsten, omdat de grenzen van de langswapening (§9.2.1.3,
/// inkorting) en die van de beugels (§9.2.2, verdichting bij het steunpunt) in
/// de praktijk niet samenvallen en door verschillende toetsen worden gelezen.
/// Beide lijsten zijn optioneel en BEIDE LEEG betekent: `cage` geldt over de
/// hele staaf — het gedrag van vóór dit veld.
///
/// Het veld moet hier staan ook al is het optioneel: `additionalProperties:
/// false` zou het anders wegfilteren voordat de kern het ziet, en dan zou een
/// gebruiker die de wapening netjes per zone opgeeft langs deze weg
/// stilzwijgend met één korf over de hele staaf worden doorgerekend.
pub(crate) fn schema_wapeningszones() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "description": "De wapening die LANGS de staaf verandert, in twee gescheiden lijsten: 'longitudinal' voor de inkorting van de langswapening (EN 1992-1-1 §9.2.1.3) en 'stirrups' voor de beugelverdichting (§9.2.2). BEIDE LEEG (of het hele veld weglaten) = de korf uit 'cage' geldt over de hele staaf; dat is het gedrag van voor dit veld. Is een lijst NIET leeg, dan moeten haar zones de hele staaf beslaan zonder gat en zonder overlap: een stuk zonder wapening wordt uitgedrukt met een zone met 0 staven, niet met een gat.",
        "properties": {
            "longitudinal": {
                "type": "array",
                "description": "De langswapening per stuk (§9.2.1.3 'Inkorting van op trek belaste langswapening'). Per ZIJDE (top/bottom) moeten de zones aaneensluiten en samen de hele staaf beslaan; boven en onder korten los van elkaar in en worden dus apart beoordeeld. Leeg = de rijen 'top' en 'bottom' van 'cage' gelden overal.",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["side", "row", "x_start_mm", "x_end_mm"],
                    "properties": {
                        "side": { "type": "string", "enum": ["Bottom", "Top"],
                            "description": "Aan welke zijde deze staven liggen: \"Bottom\" = onderwapening (z = 0), \"Top\" = bovenwapening (z = h). Vult respectievelijk cage.bottom en cage.top op dit stuk." },
                        "row": schema_wapeningsrij("Het aantal staven en de diameter op dit stuk. Een LEGE rij (count = 0) is geldig en betekent 'hier ligt aan deze zijde geen langswapening' - zo wordt een afgekorte staaf uitgedrukt."),
                        "x_start_mm": { "type": "number", "minimum": 0,
                            "description": "Begin van het STAAL langs de staaf, in mm vanaf het beginknoop. Dit is het fysieke staafuiteinde, niet de plaats waar de staaf zijn volle kracht levert: binnen l_bd vanaf het uiteinde telt de staaf volgens §9.2.1.3(3) LINEAIR mee (figuur 9.2)." },
                        "x_end_mm": { "type": "number", "exclusiveMinimum": 0,
                            "description": "Einde van het staal langs de staaf, in mm vanaf het beginknoop; groter dan x_start_mm en niet groter dan de staaflengte." },
                        "bar_shape": { "type": "string", "enum": ["Recht", "AndersDanRecht"], "default": "Recht",
                            "description": "Vorm van de staafeinden - tabel 8.2, regel 'Vorm van de staaf'. \"Recht\" (default) geeft alpha_1 = 1,0; \"AndersDanRecht\" (ombuiging, haak of lus volgens figuur 8.1 b/c/d) geeft bij een trekstaaf met c_d > 3*diameter alpha_1 = 0,7 en verkort l_bd dus met 30 %. Alleen invullen als de staaf werkelijk zo is gebogen." },
                        "casting_position": { "type": "string",
                            "enum": ["Onderzijde", "Bovenzijde", "Glijbekisting", "GoedAangetoond"],
                            "default": "Onderzijde",
                            "description": "Waar deze staven lagen ten opzichte van de STORTRICHTING - figuur 8.2, bepaalt eta_1 in (8.2) en dus l_bd. \"Onderzijde\" (default) = de gewone situatie bij werk ter plaatse. \"Bovenzijde\" = eta_1 = 0,7 zodra h > 250 mm. \"Glijbekisting\" = altijd eta_1 = 0,7. \"GoedAangetoond\" = eta_1 = 1,0 omdat is aangetoond dat de aanhechting goed is (art. 8.4.2(2) laat dat uitdrukkelijk toe). Dit is een UITVOERINGSgegeven dat het rekenmodel niet kan afleiden; het scheelt in l_bd een factor 1/0,7 = 1,43." }
                    }
                }
            },
            "stirrups": {
                "type": "array",
                "description": "De beugels per stuk (§9.2.2). De zones moeten aaneensluiten en samen de hele staaf beslaan. Leeg = de beugelvelden van 'cage' gelden overal. Een stuk ZONDER beugels is hierin niet uit te drukken: §6.2.1(4) eist ook zonder rekenkundige noodzaak de minimumwapening van §9.2.2, behalve bij platen met dwarsverdeling en bij elementen van ondergeschikt belang - laat voor die gevallen deze lijst leeg.",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["x_start_mm", "x_end_mm", "spacing_mm", "legs", "diameter_mm"],
                    "properties": {
                        "x_start_mm": { "type": "number", "minimum": 0,
                            "description": "Begin van de zone langs de staaf, in mm vanaf het beginknoop." },
                        "x_end_mm": { "type": "number", "exclusiveMinimum": 0,
                            "description": "Einde van de zone langs de staaf, in mm vanaf het beginknoop; groter dan x_start_mm en niet groter dan de staaflengte." },
                        "spacing_mm": { "type": "number", "exclusiveMinimum": 0,
                            "description": "Hart-op-hartafstand s van de beugels LANGS de lengteas, in mm - symbool s in (9.4), begrensd door s_l,max in §9.2.2(6). In een zone VERPLICHT: wie een stuk staaf apart benoemt, zegt daarmee wat er ligt." },
                        "legs": { "type": "integer", "minimum": 1,
                            "description": "Aantal beugelbenen n dat een verticale doorsnede kruist (§9.2.2(5)); A_sw = n*(pi/4)*diameter^2. In een zone VERPLICHT en ten minste 1." },
                        "diameter_mm": { "type": "number", "exclusiveMinimum": 0,
                            "description": "Beugeldiameter in mm. In een zone VERPLICHT en groter dan 0; de nationale bijlage bij §9.2.2(9) eist bovendien ten minste 5 mm, wat de detailleringstoets nakijkt." }
                    }
                }
            }
        }
    })
}

/// Schema van `exposure_class`. Dezelfde opsomming als bij
/// `concrete_cover_check`; hier is hij de ingang van tabel 7.1N in plaats van
/// tabel 4.4N.
pub(crate) fn schema_milieuklasse() -> Value {
    json!({
        "type": "string",
        "enum": ["X0", "XC1", "XC2", "XC3", "XC4", "XD1", "XD2", "XD3",
                 "XS1", "XS2", "XS3", "XF1", "XF2", "XF3", "XF4",
                 "XA1", "XA2", "XA3"],
        "description": "Milieuklasse van het ELEMENT uit tabel 4.1 - de enige ingang van de door de nationale bijlage vervangen tabel 7.1N, en dus van w_max. Betonstaal: X0/XC1 -> 0,40 mm; XC2-XC4 -> 0,30 mm; XD en XS -> 0,20 mm. Voor XF en XA geeft tabel 7.1N geen w_max en meldt de toets dat. Dit is tevens de terugval voor de zijden die in de korf (cover_top / cover_bottom / cover_sides) geen eigen klasse dragen. Weglaten = niet opgegeven; er is met opzet geen standaardklasse, want die zou een scheurwijdte kunnen goedkeuren die bij het werkelijke milieu veel te groot is. Zie `list_exposure_classes`."
    })
}

/// Schema van `structural_class`. Dezelfde opsomming als bij
/// `concrete_cover_check`.
pub(crate) fn schema_constructieklasse() -> Value {
    json!({
        "type": "string",
        "enum": ["S1", "S2", "S3", "S4", "S5", "S6"],
        "description": "Constructieklasse van het ELEMENT (4.4.1.2(5)), de rij-ingang van tabel 4.4N. Weglaten = S4, de waarde die de nationale bijlage voorschrijft voor een ontwerplevensduur van 50 jaar. De klasse staat NIET per zijde: alle vijf de criteria van de door de nationale bijlage vervangen tabel 4.3N (ontwerplevensduur 100 jaar, ontwerplevensduur 75 jaar, sterkteklasse, element met plaatgeometrie, gewaarborgde kwaliteitsbeheersing) zijn eigenschappen van het element. De klasse wordt niet uit die tabel afgeleid; zij is invoer."
    })
}

/// Schema van een [`Kniklengtekeuze`]: een vakje van figuur 5.7 of l₀ zelf.
///
/// EÉN FUNCTIE VOOR BEIDE ASSEN. `buckling_length` (het rekenvlak) en
/// `buckling_length_z` (de tweede as) dragen hetzelfde Rust-type; een tweede
/// overgetypt schema zou uiteenlopen zodra er een vakje bij komt, en dan
/// filtert `additionalProperties: false` op één van de twee assen een geldige
/// keuze weg.
pub(crate) fn schema_kniklengtekeuze(richting: &str) -> Value {
    json!({
        "type": "object",
        "description": format!("Hoe l0 {richting} wordt bepaald. Twee wegen: een vast geval uit figuur 5.7, of l0 rechtstreeks. De vakjes f) en g) van figuur 5.7 (gedeeltelijke inklemming, vergelijkingen (5.15) en (5.16)) worden hier NIET aangeboden: die vragen k = (theta/M)*(EI/l) per staafeind, inclusief het effect van scheurvorming in de verhinderende elementen (§5.8.3.2(5)), en dat getal is uit een raamwerkmodel niet af te lezen. Wie het wel heeft, rekent (5.15)/(5.16) uit en vult de uitkomst in als 'Opgegeven'."),
        "oneOf": [
            {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "soort": { "const": "Figuur57" },
                    "geval": {
                        "type": "string",
                        "enum": ["ScharnierendScharnierend", "Console", "IngeklemdScharnierend",
                                 "TweezijdigIngeklemdGeschoord", "TweezijdigIngeklemdOngeschoord"],
                        "description": "Het vakje uit figuur 5.7. a) ScharnierendScharnierend: l0 = l, geschoord. b) Console: l0 = 2l, ongeschoord (een console houdt zichzelf overeind). c) IngeklemdScharnierend: l0 = 0,7l, geschoord. d) TweezijdigIngeklemdGeschoord: l0 = l/2. e) TweezijdigIngeklemdOngeschoord: l0 = l, rotatie verhinderd maar bovenaan zijdelings vrij. Het geval moet bij de schoring van dezelfde as passen; doet het dat niet, dan komt er een leesbare fout en geen getal."
                    }
                },
                "required": ["soort", "geval"]
            },
            {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "soort": { "const": "Opgegeven" },
                    "l0_m": { "type": "number", "exclusiveMinimum": 0,
                        "description": "De kniklengte l0 in m, rechtstreeks. Voor wie (5.15), (5.16) of (5.17) zelf heeft doorgerekend of een aparte knikanalyse heeft gedaan; de afleiding legt dan vast DAT l0 is opgegeven en niet waaruit." }
                },
                "required": ["soort", "l0_m"]
            }
        ]
    })
}

/// Schema van `column` — de §5.8-gegevens van een op druk belast element.
///
/// GESCHOORD IS VERPLICHT ZODRA DIT BLOK BESTAAT, en dat is geen strengheid om
/// de strengheid: §5.8.1 definieert geschoord als een ONTWERPAANNAME en niet
/// als een eigenschap van de constructie, en het verschil is groot — een factor
/// twee in l₀ tussen (5.15) en (5.16), en C = 0,7 die voor een ongeschoord
/// element is voorgeschreven terwijl een geschoorde kolom C > 1,7 kan halen.
/// Een standaardwaarde zou dat besluit stilzwijgend nemen.
///
/// DE TWEEDE AS. `bracing_z`, `buckling_length_z` en `m0_edz_knm` zijn de
/// gegevens om de z-as voor §5.8.9 (dubbele buiging). Zij MOETEN hier staan
/// ook al zijn ze optioneel: `additionalProperties: false` zou ze anders
/// wegfilteren vóórdat de kern ze ziet, en dan rekent een cliënt die de
/// schoring om z wél heeft opgegeven stilzwijgend met die van het rekenvlak.
pub(crate) fn schema_kolom() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "description": "De §5.8-gegevens van een op DRUK belast element: het ontwerpbesluit geschoord/ongeschoord, de kniklengte, de kruip, de twee keuzen die §9.5 nodig heeft, en de gegevens om de TWEEDE as (z) voor §5.8.9. Weglaten = niet opgegeven; staat er normaaldruk op de staaf, dan komt §5.8.3.1 als NotApplicable terug met de reden, en staat er geen druk op, dan meldt de toets dat §5.8 niet van toepassing is. Er wordt nooit iets aangenomen.",
        "properties": {
            "bracing": {
                "type": "string",
                "enum": ["Geschoord", "Ongeschoord"],
                "description": "Draagt dit element bij aan de horizontale stabiliteit? (§5.8.1), om de y-as (in het rekenvlak). VERPLICHT en zonder standaardwaarde: de norm noemt dit tweemaal letterlijk iets dat 'in de berekeningen is aangenomen'. Geschoord = het element draagt NIET bij aan de stabiliteit; Ongeschoord (schorend) = het draagt er wel aan bij en krijgt daarmee C = 0,7 opgelegd."
            },
            "buckling_length": schema_kniklengtekeuze("om de y-as (in het rekenvlak)"),
            "bracing_z": {
                "type": "string",
                "enum": ["Geschoord", "Ongeschoord"],
                "description": "Geschoord of ongeschoord om de Z-AS, de richting loodrecht op het rekenvlak (§5.8.1). Een kolom kan in het vlak geschoord zijn en er loodrecht op niet, dus dit is een EIGEN gegeven. Weglaten = de keuze van `bracing` wordt ook om z aangehouden, en de toets meldt dat; het is een terugval en geen afleiding."
            },
            "buckling_length_z": schema_kniklengtekeuze("om de z-as (loodrecht op het rekenvlak)"),
            "m0_edz_knm": { "type": "number",
                "description": "Een EXTERN eerste-orde-moment om de z-as in kNm, constant over de staaf, opgeteld bij het M_z uit de omhullende. Weglaten = 0. Het veld bestaat omdat de vlakke raamwerkoplosser geen M_z levert; een ruimtelijk model of een handberekening vult het. Ook zonder dit veld is M_Edz NIET nul: de imperfectie van §5.2 en het tweede-orde-effect om z komen er altijd bij." },
            "phi_inf_t0": { "type": "number", "minimum": 0,
                "description": "Eindwaarde van de kruipcoefficient phi(oneindig,t0) volgens §3.1.4. Weglaten = niet opgegeven; deze toets rekent §3.1.4 niet zelf uit - bereken de waarde volgens bijlage B met de tool `concrete_creep_coefficient` (relatieve luchtvochtigheid, h0, cementklasse, t0) en vul haar hier in. Zonder deze waarde blijft phi_ef onbekend: §5.8.3.1(1) staat dan A = 0,7 toe - GEEN veilige kant maar de waarde bij phi_ef van ongeveer 2,14, en de toets meldt dat als WAARSCHUWING - en om de z-as, waar de norm voor phi_ef geen standaardwaarde geeft (§5.8.4(1)P, §5.8.6(4)), is e_2 zonder kruip een ondergrens: `5.8.9_moment_z` en `5.8.9_dubbele_buiging` komen dan als NotApplicable terug (of NotOk als de ondergrens al faalt) en `phi_ef_z`, `e_2_z_mm`, `m_edz_knm` en `interactie_5_39` blijven leeg. Met deze waarde maar zonder `sls_quasi_permanent_envelope` geldt phi(oneindig,t0) als bovengrens van phi_ef: A = min(0,7; 1/(1 + 0,2*phi)) en phi_ef,z = phi, met een waarschuwing." },
            "stirrup_zone": {
                "type": "string",
                "enum": ["Regulier", "BijBalkOfPlaat", "BijOverlappingslas"],
                "description": "Waar in de kolom ligt de beschouwde doorsnede, voor s_cl,tmax (§9.5.3(4))? Regulier = de volle waarde van §9.5.3(3). BijBalkOfPlaat = binnen een afstand gelijk aan de grootste kolomafmeting boven of onder een balk of plaat: maal 0,6. BijOverlappingslas = nabij een overlappingslas met Phi_l groter dan 14 mm: maal 0,6. Weglaten = niet opgegeven; s_cl,tmax komt dan als NotApplicable terug. 'Regulier' wordt NIET aangenomen: dat is de ruimste tak."
            },
            "lap_situation": {
                "type": "string",
                "enum": ["GeenLassen", "LassenBuitenDezeDoorsnede", "TerPlaatseVanLas"],
                "description": "Overlappingssituatie voor A_s,max (NB bij §9.5.2(3)): GeenLassen en TerPlaatseVanLas geven 0,08*A_c, LassenBuitenDezeDoorsnede 0,04*A_c. Weglaten = niet opgegeven; A_s,max komt dan als NotApplicable terug. Er wordt niets aangenomen: het verschil is een factor twee en 'geen lassen' is de ruimste tak."
            }
        },
        "required": ["bracing", "buckling_length"]
    })
}

/// De plooitoets van één plaatveld (EN 1993-1-5 §10(5a)); `model` = de vorm
/// in het projectbestand (zonder de velden die de modelbouwer invult).
pub(crate) fn schema_plooi(model: bool) -> Value {
    let mut schema = json!({
        "type":"object", "additionalProperties":false,
        "description":"Optionele EN 1993-1-5 §10(5a) toets van één volledig asgelijnd rechthoekig onverstijfd veld zonder openingen. Maten in mm. Geen automatische steun uit meshknopen. Niet-uniforme spanningen, trek en kolominteractie worden geweigerd. Zonder invoer blijft de oude vloeicontrole gelden.",
        "properties": {
            "expected_element_ids":{"type":"array","minItems":1,"uniqueItems":true,"items":{"type":"integer","minimum":0},"description":"Verplichte volledige elementset uit de mesh, onafhankelijk van beschikbare spanningen. Iedere combinatie moet exact deze set leveren."},
            "a_mm":{"type":"number","exclusiveMinimum":0,"description":"Volledige veldlengte in globale x-richting, mm."},
            "b_mm":{"type":"number","exclusiveMinimum":0,"description":"Volledige veldlengte in globale z-richting, mm."},
            "randvoorwaarden":{"type":"string","enum":["vierzijdig_scharnierend"],"description":"Vier continue scharnierende steunen UIT HET VLAK; afzonderlijk onderbouwd."},
            "steun_bron":{"type":"string","minLength":1,"description":"Herkomst van de bevestigde steunvoorwaarden; ontwerp/tekening."},
            "onverstijfd":{"type":"boolean","description":"Moet true zijn; verstijfde velden zijn niet ondersteund."},
            "uniforme_spanning":{"type":"boolean","description":"Bevestiging uniform volledig veld. De kern controleert tevens alle elementspanningen per combinatie; niet-uniform wordt geweigerd."},
            "rechthoek_zonder_openingen":{"type":"boolean","description":"Directe API: bevestiging van de volledige asgelijnde rechthoek zonder openingen."},
            "geometrie_fout":{"type":"string","description":"Fout uit de modelbouwer; leidt altijd tot weigering."}
        },
        "required":["expected_element_ids","a_mm","b_mm","randvoorwaarden","steun_bron","onverstijfd","uniforme_spanning","rechthoek_zonder_openingen"]
    });
    if model {
        let props = schema["properties"].as_object_mut().unwrap();
        props.remove("rechthoek_zonder_openingen");
        props.remove("geometrie_fout");
        props.remove("expected_element_ids");
        schema["required"]
            .as_array_mut()
            .unwrap()
            .retain(|v| v != "rechthoek_zonder_openingen" && v != "expected_element_ids");
    }
    schema
}

/// Eén wapeningslaag (`PlaatWapeningLaag`).
pub(crate) fn schema_wapeningslaag() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["dekking_mm"],
        "description": "Eén wapeningslaag: OF `diameter_mm` met `hoh_mm`, OF `as_mm2_per_m` — niet beide. Met alleen `as_mm2_per_m` worden diameter- en staafafstandseisen (9.6.1(3), 9.6.2(3), 9.6.3(2)) en (7.11), evenals het UGT-momentevenwicht over de wanddikte, niet getoetst, met reden.",
        "properties": {
            "diameter_mm": { "type": "number", "exclusiveMinimum": 0, "description": "Staafdiameter Ø in mm." },
            "hoh_mm": { "type": "number", "exclusiveMinimum": 0, "description": "Hart-op-hartafstand van de staven in mm." },
            "as_mm2_per_m": { "type": "number", "exclusiveMinimum": 0, "description": "Wapeningsoppervlakte in mm² per meter wand (alternatief voor Ø + h.o.h.)." },
            "dekking_mm": { "type": "number", "exclusiveMinimum": 0, "description": "Betondekking op deze staven, van het wandoppervlak tot de staaf, in mm." }
        }
    })
}

/// De wapening in één richting (`PlaatWapeningRichting`).
pub(crate) fn schema_wapeningsrichting(beschrijving: &str) -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "description": beschrijving,
        "properties": {
            "zijde_1": schema_wapeningslaag(),
            "zijde_2": schema_wapeningslaag()
        }
    })
}

/// De aanwezige wapening van een betonwand (`PlaatWapeningInvoer`).
pub(crate) fn schema_wapening_aanwezig() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["staalsoort", "horizontaal", "verticaal"],
        "description": "Alleen beton: de aanwezige wapening van de wand, per richting en per zijde. Dan toetst de kern per element en per zijde de aanwezige tegen de benodigde wapening van bijlage F, inclusief momentevenwicht over de dikte, de wandregels van 9.6, een voldoende bovengrens voor minimumwapening bij aangetoonde BGT-trek (7.3.2; onvoldoende bovengrens = niet aangetoond, geen bewezen normfalen) en, met `milieuklasse` en `frequente_combinaties`, de scheurwijdte (7.3.4) waar dat onderbouwd kan. Weglaten = alleen benodigde wapening en betondruk, met de melding dat de aanwezige wapening niet is ingevoerd. Bij een ander materiaal wordt de plaat geweigerd.",
        "properties": {
            "staalsoort": { "type": "string", "enum": ["B500A", "B500B", "B500C"], "description": "Betonstaalsoort (f_yk)." },
            "f_ct_eff_mpa": { "type": "number", "exclusiveMinimum": 0, "description": "Treksterkte op het verwachte scheurtijdstip, N/mm². Ontbreekt: 7.3.2 en 7.3.4 niet getoetst." },
            "langdurend": { "type": "boolean", "description": "Belastingsduur voor 7.3.4: true langdurend, false kortdurend. Ontbreekt: scheurwijdte niet getoetst." },
            "hoge_aanhechting": { "type": "boolean", "description": "Aanhechting voor 7.3.4: true hoog, false glad. Scheurwijdte alleen voor eenassige membraantrek met symmetrische lagen en voldoende kleine staafafstand." },
            "horizontaal": schema_wapeningsrichting("Wapening in de horizontale modelrichting (x). Aan beide zijden verplicht (9.6.3(1))."),
            "verticaal": schema_wapeningsrichting("Wapening in de verticale modelrichting (z). Ten minste één zijde."),
            "milieuklasse": {
                "type": "string",
                "enum": ["X0", "XC1", "XC2", "XC3", "XC4", "XD1", "XD2", "XD3", "XS1", "XS2", "XS3", "XF1", "XF2", "XF3", "XF4", "XA1", "XA2", "XA3"],
                "description": "Milieuklasse (tabel 4.1): de ingang van tabel 7.1N (NB) voor w_max. Weglaten = scheurwijdte niet getoetst; er wordt geen klasse aangenomen."
            }
        }
    })
}

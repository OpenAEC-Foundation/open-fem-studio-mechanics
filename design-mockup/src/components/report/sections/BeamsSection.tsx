/**
 * BeamsSection — invoertabel staven: id, knopen, lengte (afgeleid uit de
 * knoopcoördinaten), materiaal, profiel, scharnieren en — waar ingesteld —
 * de kernvelden van de toetsconfiguratie (kniklengtes/kipsteunen) compact.
 * Leest live uit de ReportDataContext.
 */
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { Beam } from "../../fem/femTypes";
import { beamLengthMm } from "../../../lib/staafMeetkunde";
import { useReportData } from "../ReportDataContext";
import { fmtLenM } from "../reportFormat";

/** Scharnieren compact: "begin: Ry · einde: Ry" — leeg = star ("—"). */
function releasesText(t: TFunction, beam: Beam): string {
  const r = beam.releases;
  if (!r) return "—";
  const side = (tx?: boolean, tz?: boolean, ry?: boolean): string =>
    [tx && "Tx", tz && "Tz", ry && "Ry"].filter(Boolean).join(",");
  const start = side(r.startTx, r.startTz, r.startRy);
  const end = side(r.endTx, r.endTz, r.endRy);
  if (!start && !end) return "—";
  const parts: string[] = [];
  if (start) parts.push(t("report.releaseStart", { scharnieren: start }));
  if (end) parts.push(t("report.releaseEnd", { scharnieren: end }));
  return parts.join(" · ");
}


export default function BeamsSection() {
  const { t } = useTranslation("ribbon");
  const { nodes, beams } = useReportData();

  const sorted = [...beams].sort((a, b) => a.id - b.id);

  return (
    <div className="rpt-block">
      <h2 className="rpt-h2">{t("report.sectionBeams", "Staven")}</h2>

      {sorted.length === 0 ? (
        <p className="rpt-empty-note">
          {t("report.noBeams", "Geen staven in het model.")}
        </p>
      ) : (
        <table className="rpt-table">
          <thead>
            <tr>
              <th>{t("report.colId", "Id")}</th>
              <th>{t("report.colNodes", "Knopen")}</th>
              <th className="rpt-num">{t("report.colLength", "Lengte [m]")}</th>
              <th>{t("report.colMaterial", "Materiaal")}</th>
              <th>{t("report.colProfile", "Profiel")}</th>
              <th>{t("report.colHinges", "Scharnieren")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => (
              <tr key={b.id}>
                <td>{b.id}</td>
                <td>{b.from} → {b.to}</td>
                <td className="rpt-num">{fmtLenM(beamLengthMm(b, nodes))}</td>
                <td>{b.material ?? "S235"}</td>
                <td>{b.profile ?? "HEA160"}</td>
                <td>{releasesText(t, b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

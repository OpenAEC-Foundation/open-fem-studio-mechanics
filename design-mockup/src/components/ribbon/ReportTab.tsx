/**
 * ReportTab — ribbonknoppen bij het rapport.
 *
 * TWEE UITDRAAIEN, MET EEN DUIDELIJK VERSCHIL
 * -------------------------------------------
 * "Afdrukken / PDF" print het LIVE rapport: de weergave op het Rapport-tabblad
 * (ReportPreview / ReportShell), via de printdialoog van de webview. Dat is het
 * volledige document — alle hoofdstukken, in de taal van de app, met de
 * sectiekeuze uit de zijbalk.
 *
 */
import { useTranslation } from "react-i18next";
import RibbonGroup from "./RibbonGroup";
import RibbonButton from "./RibbonButton";
import RibbonButtonStack from "./RibbonButtonStack";
import { useReportStore } from "../../stores/reportStore";
import { useWindowManager } from "../../hooks/useWindowManager";
import { b2 } from "./b2Icons";
import { toetsVoor } from "../../lib/sneltoetsen";

const printIcon = b2("file.print");
const detachIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="7" width="13" height="13" rx="1.5" stroke-width="2"/><path d="M8 7V4.5A1.5 1.5 0 019.5 3h10A1.5 1.5 0 0121 4.5v10a1.5 1.5 0 01-1.5 1.5H16" stroke-width="2" stroke-linecap="round"/></svg>`;
const a4Icon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="1.5" stroke-width="2"/><text x="12" y="15" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor" stroke="none">A4</text></svg>`;
const a3Icon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1.5" stroke-width="2"/><text x="12" y="14.5" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor" stroke="none">A3</text></svg>`;
const portraitIcon = b2("report.portrait");
const landscapeIcon = b2("report.landscape");

interface ReportTabProps {
  /** @deprecated Ongebruikt — de losse HTML-export is vervangen door het live rapport zelf. */
  onExportHtml?: () => void;
  /**
   * De afleiding van de initiële scheefstand, woordelijk zoals
   * `lib/scheefstandNorm.scheefstandToelichting` haar opstelt.
   *
   * Komt uit App.tsx, waar φ op één plaats wordt bepaald — dezelfde tekst die
   * de balk onder het canvas als tooltip toont en die het live rapport bij de
   * uitgangspunten zet. Sinds issue #199 nooit leeg in de app: de UGT-toets
   * rekent altijd met deze scheefstand, ook met de schakelaar uit. Leeg of
   * afwezig (een andere aanroeper) laat de PDF erover zwijgen.
   */
  scheefstandToelichting?: string;
  /** Het analysetype en α_cr per combinatie, zoals App.tsx het opstelt (basisaudit nr 27). */
  analyseToelichting?: string;
  /**
   * De omschrijving van de gegenereerde windlasten (tabel, α, φ, coëfficiënt),
   * zoals App.tsx haar met `vrijstaandDakUitgangspunten` uit het model opstelt
   * — dezelfde tekst als in het live rapport (issue #16).
   */
  windToelichting?: string;
}

export default function ReportTab(_props: ReportTabProps) {
  const { t } = useTranslation("ribbon");

  const pageSize = useReportStore((s) => s.pageSize);
  const orientation = useReportStore((s) => s.orientation);
  const setPageSize = useReportStore((s) => s.setPageSize);
  const setOrientation = useReportStore((s) => s.setOrientation);
  const { createDetachedWindow } = useWindowManager();

  // De Rapport-tab is alleen actief wanneer de rapportview getoond wordt
  // (Ribbon koppelt tab ↔ view), dus window.print() print het rapport.
  const handlePrint = () => window.print();

  const handleDetach = () => {
    void createDetachedWindow({
      view: "report",
      title: t("report.report", "Rapport"),
      width: 860,
      height: 1100,
    });
  };

  return (
    <div className="ribbon-content">
      <div className="ribbon-groups">
        {/* Rapport — afdrukken/PDF + eigen venster */}
        <RibbonGroup label={t("report.report", "Rapport")}>
          <RibbonButton
            icon={printIcon}
            label={t("report.print", "Afdrukken / PDF")}
            shortcut={toetsVoor("afdrukken")}
            size="large"
            onClick={handlePrint}
          />
          {/* R5 — werkt óók in de browser: createDetachedWindow valt daar
              terug op window.open op dezelfde origin (BroadcastChannel-sync). */}
          <RibbonButton
            icon={detachIcon}
            label={t("report.detach", "Naast je scherm")}
            size="large"
            onClick={handleDetach}
          />
        </RibbonGroup>

        {/* Weergave — papierformaat + oriëntatie (werken door in @page) */}
        <RibbonGroup label={t("report.display", "Weergave")}>
          <RibbonButtonStack>
            <RibbonButton
              icon={a4Icon}
              label="A4"
              size="small"
              active={pageSize === "A4"}
              onClick={() => setPageSize("A4")}
            />
            <RibbonButton
              icon={a3Icon}
              label="A3"
              size="small"
              active={pageSize === "A3"}
              onClick={() => setPageSize("A3")}
            />
          </RibbonButtonStack>
          <RibbonButtonStack>
            <RibbonButton
              icon={portraitIcon}
              label={t("report.portrait", "Staand")}
              size="small"
              active={orientation === "portrait"}
              onClick={() => setOrientation("portrait")}
            />
            <RibbonButton
              icon={landscapeIcon}
              label={t("report.landscape", "Liggend")}
              size="small"
              active={orientation === "landscape"}
              onClick={() => setOrientation("landscape")}
            />
          </RibbonButtonStack>
        </RibbonGroup>
      </div>
    </div>
  );
}

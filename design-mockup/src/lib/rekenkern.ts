/**
 * rekenkern — de Rust-rekenkern aanroepen, in de desktop-app (Tauri) en in de
 * browser (dev-brug `/api/toetsing` van de ontwikkelserver, zie vite.config.ts).
 * Stond eerder in `stores/checkStore.ts`, dat de naam nog doorgeeft.
 */
import { invoke } from "@tauri-apps/api/core";
import { isTauriApp } from "./tauri";

/**
 * Roep de Rust-rekenkern aan, waar de app ook draait.
 *
 * In de desktop-app gaat dat via Tauri; in de browser via de dev-brug. De
 * aanroepers merken het verschil niet, en dat is de bedoeling — de rekenkern
 * hoort niet af te hangen van de schil waarin de app toevallig staat.
 *
 * ── EEN ANTWOORD DAT GEEN ANTWOORD IS ──────────────────────────────────────
 *
 * `/api/toetsing` bestaat alleen zolang de ONTWIKKELSERVER draait; die
 * middleware zit in `vite.config.ts` en niet in de gebouwde bestanden. Vraagt
 * een statische bouw in de browser toch om de rekenkern, dan krijgt hij geen
 * 404 maar de `index.html` van de app met status 200 — de gewone terugval van
 * een enkelbladige toepassing. Dat is de gevaarlijkste soort antwoord: het ziet
 * er geslaagd uit. `.json().catch(() => null)` maakte er `null` van, en dat
 * `null` ging als resultaat naar de aanroeper. Het venster tekende dan niets,
 * zonder één woord waarom.
 *
 * Daarom wordt hier op de LETTERLIJKE tekst gewacht en zelf ontleed: is zij
 * geen JSON, dan is er geen rekenkern aan de andere kant en zegt de fout dat,
 * in plaats van de gebruiker met een lege tekening achter te laten.
 */
export async function roepKern<T>(opdracht: string, inputs?: unknown): Promise<T> {
  if (isTauriApp()) {
    return invoke<T>(opdracht, inputs !== undefined ? { inputs } : undefined);
  }
  const antwoord = await fetch("/api/toetsing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ opdracht, inputs }),
  });
  const ruw = await antwoord.text();
  let data: unknown = null;
  let isJson = true;
  try {
    data = JSON.parse(ruw);
  } catch {
    isJson = false;
  }
  if (!isJson) {
    throw new Error(
      `De rekenkern is hier niet bereikbaar: /api/toetsing gaf geen JSON terug ` +
        `(status ${antwoord.status}). Buiten de desktop-app loopt de rekenkern via de ` +
        `dev-brug van de ontwikkelserver; in een gebouwde webversie bestaat die niet.`,
    );
  }
  if (!antwoord.ok || (data && typeof data === "object" && "fout" in data)) {
    throw new Error(
      (data as { fout?: string })?.fout ??
        `De rekenkern antwoordde met status ${antwoord.status}.`,
    );
  }
  return data as T;
}

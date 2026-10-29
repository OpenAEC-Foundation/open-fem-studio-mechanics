/**
 * Lastlabels op het 2D-tekenvlak: een reeks aansluitende staven op één lijn
 * met precies dezelfde lijnlast (bijvoorbeeld een ligger die in drie stukken
 * is geknipt) kreeg op elke staaf een eigen label "q=… kN/m". Op korte staven
 * schoven die labels over elkaar heen. Nu toont alleen de middelste staaf van
 * zo'n keten het label. De pijlen en het aanklikken blijven per staaf werken.
 *
 * Telt alleen voor een gelijkmatige last over de hele staaf zonder
 * stapelverschuiving: een deellast, een trapezium of een gestapelde band
 * houdt altijd zijn eigen label.
 */
export interface LijnlastVoorLabel {
  id: number;
  beamId: number;
  caseId: number;
  /** Gelijkmatige waarde; ontbreekt bij een trapezium. */
  q: number | undefined;
  trapezium: boolean;
  qDir: string;
  qCoord: string;
  startFrac: number;
  endFrac: number;
  /** Stapelverschuiving van de band (px); 0 = niet gestapeld. */
  stapelOffset: number;
}

export function verborgenLijnlastLabels(
  lasten: readonly LijnlastVoorLabel[],
  staven: readonly { id: number; from: number; to: number }[],
  knopen: readonly { id: number; x: number; z: number }[],
): Set<number> {
  const staaf = new Map(staven.map((s) => [s.id, s]));
  const knoop = new Map(knopen.map((k) => [k.id, k]));
  const kandidaten = lasten.filter((l) => !l.trapezium && l.q !== undefined
    && l.startFrac <= 1e-9 && l.endFrac >= 1 - 1e-9 && Math.abs(l.stapelOffset) < 1e-9
    && staaf.has(l.beamId));
  // Lineair in het aantal lasten: dit draait bij elke render van het
  // tekenvlak (ook bij elke muisbeweging). De eerdere versie vergeleek alle
  // paren in een groep en kopieerde de groep bij elke toevoeging; bij een
  // model met honderden gelijke vloerlasten kostte dat tientallen ms per frame.
  const groepen = new Map<string, LijnlastVoorLabel[]>();
  for (const l of kandidaten) {
    const sleutel = `${l.caseId}|${l.q}|${l.qDir}|${l.qCoord}`;
    const groep = groepen.get(sleutel);
    if (groep) groep.push(l); else groepen.set(sleutel, [l]);
  }
  type Richting = { ux: number; uz: number; a: { x: number; z: number }; b: { x: number; z: number } };
  const richtingen = new Map<number, Richting | null>();
  const richting = (beamId: number): Richting | null => {
    const bekend = richtingen.get(beamId);
    if (bekend !== undefined) return bekend;
    const s = staaf.get(beamId)!;
    const a = knoop.get(s.from), b = knoop.get(s.to);
    const L = a && b ? Math.hypot(b.x - a.x, b.z - a.z) : 0;
    const r = a && b && L > 0 ? { ux: (b.x - a.x) / L, uz: (b.z - a.z) / L, a, b } : null;
    richtingen.set(beamId, r);
    return r;
  };
  const verborgen = new Set<number>();
  for (const groep of groepen.values()) {
    if (groep.length < 2) continue;
    // Twee lasten horen bij dezelfde keten als hun staven een knoop delen en
    // evenwijdig zijn; met een gedeelde knoop liggen ze dan op één lijn.
    // Alleen lasten aan dezelfde knoop worden vergeleken (per knoop een lijst).
    const ouder = groep.map((_, i) => i);
    const wortel = (i: number): number => { while (ouder[i] !== i) i = ouder[i] = ouder[ouder[i]]; return i; };
    const perKnoop = new Map<number, number[]>();
    groep.forEach((l, i) => {
      if (!richting(l.beamId)) return;
      const s = staaf.get(l.beamId)!;
      for (const n of s.from === s.to ? [s.from] : [s.from, s.to]) {
        const lijst = perKnoop.get(n);
        if (lijst) lijst.push(i); else perKnoop.set(n, [i]);
      }
    });
    for (const lijst of perKnoop.values()) {
      for (let p = 0; p < lijst.length; p++) {
        const ri = richting(groep[lijst[p]].beamId)!;
        for (let q = p + 1; q < lijst.length; q++) {
          const rj = richting(groep[lijst[q]].beamId)!;
          if (Math.abs(ri.ux * rj.uz - ri.uz * rj.ux) < 1e-6) ouder[wortel(lijst[p])] = wortel(lijst[q]);
        }
      }
    }
    const ketens = new Map<number, LijnlastVoorLabel[]>();
    groep.forEach((l, i) => {
      const w = wortel(i);
      const keten = ketens.get(w);
      if (keten) keten.push(l); else ketens.set(w, [l]);
    });
    for (const keten of ketens.values()) {
      if (keten.length < 2) continue;
      // Langs de lijn ordenen op het midden van elke staaf; de middelste houdt het label.
      const r = richting(keten[0].beamId)!;
      const positie = new Map(keten.map((l) => {
        const d = richting(l.beamId)!;
        return [l.id, ((d.a.x + d.b.x) / 2) * r.ux + ((d.a.z + d.b.z) / 2) * r.uz] as const;
      }));
      const geordend = [...keten].sort((p, q) => positie.get(p.id)! - positie.get(q.id)!);
      const houd = geordend[Math.floor((geordend.length - 1) / 2)].id;
      for (const l of geordend) if (l.id !== houd) verborgen.add(l.id);
    }
  }
  return verborgen;
}

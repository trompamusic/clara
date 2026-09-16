import { PageGeometry } from "../../score/measureScorePage";
export const EMBODIMENT = "http://purl.org/vocab/frbr/core#embodimentOf";
export const AT = "http://purl.org/NET/c4dm/timeline.owl#at";
export type Instant = { "@id"?: string; [key: string]: any };
export const array = <T>(value: T | T[] | null | undefined): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];
export const noteId = (value: string) =>
  value.slice(value.lastIndexOf("#") + 1);
export const time = (instant: Instant) =>
  parseFloat(String(instant[AT]).replace(/[PS]/g, ""));
export const ids = (instant: Instant): string[] =>
  array<{ "@id": string }>(instant[EMBODIMENT])
    .filter(
      (e) =>
        e?.["@id"] &&
        !e["@id"].startsWith("https://terms.trompamusic.eu/maps#inserted"),
    )
    .map((e) => noteId(e["@id"]));
// RDF bodyValue commonly arrives as a numeric string. Missing values must
// not be coerced to zero; a performed velocity of zero is valid.
export function velocityValue(value: unknown): number | null {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    value === "" ||
    (typeof value === "string" && !value.trim())
  )
    return null;
  const velocity = Number(value);
  return Number.isFinite(velocity) && velocity >= 0 && velocity <= 127
    ? velocity
    : null;
}
export type Timemap = Array<{ qstamp: number; tstamp: number; on?: string[] }>;
export interface CommittedPage {
  uri: string;
  page: number;
  appliedOptions: Record<string, unknown>;
  mei: string;
  timemap: Timemap;
  geometry: PageGeometry | null;
}
export function memoLast<T extends (...args: any[]) => any>(fn: T): T {
  let previous: any[] | undefined;
  let result: ReturnType<T>;
  return ((...args: Parameters<T>) => {
    if (
      !previous ||
      args.length !== previous.length ||
      args.some((arg, i) => arg !== previous![i])
    ) {
      result = fn(...args);
      previous = args;
    }
    return result;
  }) as T;
}
export function scoreMetadata(mei: string, timemap: Timemap) {
  const timemapByNoteId: Record<string, { qstamp: number; tstamp: number }> =
    {};
  timemap.forEach((t) =>
    (t.on || [])
      .filter(
        (id) => !id.startsWith("https://terms.trompamusic.eu/maps#inserted"),
      )
      .forEach((id) => {
        timemapByNoteId[noteId(id)] = { qstamp: t.qstamp, tstamp: t.tstamp };
      }),
  );
  const doc = new DOMParser().parseFromString(mei, "text/xml");
  const staffmap: Record<string, string> = {};
  const stafflayermap: Record<string, Record<string, string>> = {};
  const stafflayertuples = new Set<string>();
  Array.from(doc.getElementsByTagName("staff")).forEach((s) => {
    const id = s.getAttribute("xml:id"),
      n = s.getAttribute("n");
    if (!id || !n) return;
    staffmap[id] = n;
    stafflayermap[id] = {};
    Array.from(s.getElementsByTagName("layer")).forEach((l) => {
      const lid = l.getAttribute("xml:id"),
        ln = l.getAttribute("n");
      if (!lid || !ln) return;
      stafflayermap[id][lid] = ln;
      stafflayertuples.add(n + ":" + ln);
    });
  });
  const noteAttributes: Record<
    string,
    { pname: string | null; oct: string | null }
  > = {};
  Array.from(doc.getElementsByTagName("note")).forEach((n) => {
    const id = n.getAttribute("xml:id");
    if (id)
      noteAttributes[id] = {
        pname: n.getAttribute("pname"),
        oct: n.getAttribute("oct"),
      };
  });
  return {
    timemap,
    timemapByNoteId,
    staffmap,
    stafflayermap,
    stafflayertuples,
    noteAttributes,
  };
}
export function averageQstamp(
  noteIds: string[],
  map: ReturnType<typeof scoreMetadata>["timemapByNoteId"],
) {
  const values = noteIds.map((id) => map[id]?.qstamp).filter(Number.isFinite);
  return values.length
    ? values.reduce((sum, q) => sum + q, 0) / values.length
    : null;
}
export function pageData(
  page: CommittedPage,
  metadata: ReturnType<typeof scoreMetadata>,
  instantsByNoteId: Record<string, Record<string, Instant | Instant[]>>,
) {
  const geometry = page.geometry!;
  const timelinesToVis = Object.keys(instantsByNoteId);
  const instantsByScoretime: Record<string, Record<string, Instant[]>> = {};
  const notesForGroup: Record<
    string,
    Record<string, PageGeometry["notes"][string][]>
  > = {};
  timelinesToVis.forEach((tl) => {
    const seen = new Set();
    const instants = Object.keys(geometry.notes)
      .flatMap((id) => array(instantsByNoteId[tl][id]))
      .filter((inst) => {
        if (!inst || time(inst) < 0 || !Number.isFinite(time(inst)))
          return false;
        const identity = inst["@id"] || inst;
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      })
      .sort((a, b) => time(a) - time(b));
    const groups: Record<string, Instant[]> = {};
    instants.forEach((inst) => {
      const q = averageQstamp(ids(inst), metadata.timemapByNoteId);
      if (q !== null) (groups[String(q)] ||= []).push(inst);
    });
    instantsByScoretime[tl] = groups;
    notesForGroup[tl] = {};
    Object.keys(groups).forEach((q) => {
      notesForGroup[tl][q] = groups[q].flatMap((inst) =>
        ids(inst)
          .map((id) => geometry.notes[id])
          .filter(Boolean),
      );
    });
  });
  return { geometry, timelinesToVis, instantsByScoretime, notesForGroup };
}
export function dynamicsPoints(
  page: ReturnType<typeof pageData>,
  performed: Record<string, Record<string, number | string>>,
) {
  const result: Record<string, Record<string, Record<string, any>>> = {};
  page.timelinesToVis.forEach((tl) => {
    result[tl] = {};
    Object.entries(page.notesForGroup[tl]).forEach(([q, notes]) => {
      const staffs: Record<string, Record<string, typeof notes>> = {};
      notes.forEach((note) => {
        if (
          !note.staffId ||
          !note.layerId ||
          velocityValue(performed[note.id]?.[tl]) === null
        )
          return;
        ((staffs[note.staffId] ||= {})[note.layerId] ||= []).push(note);
      });
      const summarize = (ns: typeof notes) => ({
        avgX: ns.reduce((s, n) => s + (n.x + n.x2) / 2, 0) / ns.length,
        yMin: Math.min(...ns.map((n) => velocityValue(performed[n.id][tl])!)),
        yMax: Math.max(...ns.map((n) => velocityValue(performed[n.id][tl])!)),
      });
      const points: Record<string, any> = {};
      Object.entries(staffs).forEach(([staff, layers]) => {
        points[staff] = {
          ...summarize(Object.values(layers).flat()),
          layers: Object.fromEntries(
            Object.entries(layers).map(([layer, ns]) => [layer, summarize(ns)]),
          ),
        };
      });
      if (Object.keys(points).length) result[tl][q] = points;
    });
  });
  return result;
}

export function dynamicsDrawing(
  page: ReturnType<typeof pageData>,
  performed: Record<string, Record<string, number | string>>,
  staffmap: Record<string, string>,
  stafflayermap: Record<string, Record<string, string>>,
) {
  const points = dynamicsPoints(page, performed);
  return Object.fromEntries(
    page.timelinesToVis.map((tl) => {
      const ordered = Object.keys(points[tl]).sort(
        (a, b) => Number(a) - Number(b),
      );
      const summary = ordered.flatMap((qstamp) => {
        const staffId = Object.keys(points[tl][qstamp])[0];
        const staff = points[tl][qstamp][staffId];
        return staff && staffmap[staffId]
          ? [
              {
                qstamp,
                x: Math.round(staff.avgX),
                y: Math.round(staff.yMax),
                staff: staffmap[staffId],
              },
            ]
          : [];
      });
      const segments = summary.flatMap((from, i) => {
        const to = summary[i + 1];
        return to && Number(to.qstamp) - Number(from.qstamp) <= 4
          ? [{ from, to }]
          : [];
      });
      const staffs: Record<string, { x: number; min: number; max: number }[]> =
        {};
      const layers: Record<string, { x: number; min: number }[]> = {};
      ordered.forEach((q) =>
        Object.entries(points[tl][q]).forEach(([staffId, staff]) => {
          const sn = staffmap[staffId];
          if (!sn) return;
          (staffs[sn] ||= []).push({
            x: Math.round(staff.avgX),
            min: Math.round(staff.yMin),
            max: Math.round(staff.yMax),
          });
          Object.entries(staff.layers).forEach(
            ([layerId, layer]: [string, any]) => {
              const ln = stafflayermap[staffId]?.[layerId];
              if (ln)
                (layers[sn + ":" + ln] ||= []).push({
                  x: Math.round(layer.avgX),
                  min: Math.round(layer.yMin),
                });
            },
          );
        }),
      );
      const staffPolygons = Object.fromEntries(
        Object.entries(staffs).map(([staff, values]) => [
          staff,
          [
            ...values.map((p) => `${p.x},${p.min}`),
            ...values
              .slice()
              .reverse()
              .map((p) => `${p.x},${p.max}`),
          ].join(" "),
        ]),
      );
      // Retain the existing layer drawing policy (a closed path through minima).
      const layerPolygons = Object.fromEntries(
        Object.entries(layers).map(([layer, values]) => [
          layer,
          values.map((p) => `${p.x},${p.min}`).join(" "),
        ]),
      );
      return [tl, { summary, segments, staffPolygons, layerPolygons }];
    }),
  );
}

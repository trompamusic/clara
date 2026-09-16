/* Classic worker protocol v2. Keep the URL version in ErrorRibbonVis in sync. */
const EMBODIMENT = "http://purl.org/vocab/frbr/core#embodimentOf";
const AT = "http://purl.org/NET/c4dm/timeline.owl#at";
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
function knownIds(instant, map) {
  return array(instant[EMBODIMENT]).map(e => e && e["@id"])
    .filter(id => typeof id === "string" && !id.startsWith("https://terms.trompamusic.eu/maps#inserted"))
    .map(id => id.slice(id.lastIndexOf("#") + 1)).filter(id => Number.isFinite(map[id]?.qstamp));
}
function average(ids, map) {
  return ids.length ? ids.reduce((sum, id) => sum + map[id].qstamp, 0) / ids.length : null;
}
onmessage = ({ data }) => {
  const { requestId } = data;
  try {
    const { timelinesToVis, performanceErrors, instantsByPerfTime, timemapByNoteId: map } = data;
    const result = {};
    timelinesToVis.forEach(tl => {
      const ordered = array(instantsByPerfTime[tl]).filter(i => parseFloat(String(i[AT]).replace(/[PS]/g, "")) >= 0)
        .slice().sort((a, b) => parseFloat(String(a[AT]).replace(/[PS]/g, "")) - parseFloat(String(b[AT]).replace(/[PS]/g, "")));
      result[tl] = array(performanceErrors[tl]?.inserted).flatMap(instant => {
        const index = ordered.findIndex(i => instant["@id"] ? i["@id"] === instant["@id"] : i[AT] === instant[AT]);
        if (index === -1) return [];
        let context = knownIds(instant, map);
        if (!context.length) {
          const before = ordered.slice(0, index).reverse().find(i => knownIds(i, map).length);
          const after = ordered.slice(index + 1).find(i => knownIds(i, map).length);
          context = [...(before ? knownIds(before, map) : []), ...(after ? knownIds(after, map) : [])];
        }
        const qstamp = average(context, map);
        return qstamp === null ? [] : [{ qstamp, instant }];
      });
    });
    postMessage({ requestId, result });
  } catch (error) {
    postMessage({ requestId, error: String(error.message || error) });
  }
};

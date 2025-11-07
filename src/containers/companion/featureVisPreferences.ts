export type FeatureVisPrefs = {
  displayTempoCurves: boolean;
  displayErrorRibbon: boolean;
  displayDynamicsSummary: boolean;
  displayDynamicsPerStaff: string[];
  displayDynamicsPerStaffLayer: string[];
};

export function storageKeyForUri(uri?: string | null): string | null {
  return uri ? `at.ac.mdw.trompa:${uri}` : null;
}

export function readFeatureVisPrefs(
  uri: string | null | undefined,
  availableStaffNumbers: Set<string>,
  availableStaffLayerTuples: Set<string>,
): FeatureVisPrefs | null {
  const key = storageKeyForUri(uri);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const valid =
      parsed &&
      typeof parsed === "object" &&
      "displayTempoCurves" in parsed &&
      "displayErrorRibbon" in parsed &&
      "displayDynamicsSummary" in parsed &&
      "displayDynamicsPerStaff" in parsed &&
      "displayDynamicsPerStaffLayer" in parsed;
    if (!valid) {
      localStorage.removeItem(key);
      return null;
    }
    const perStaff = Array.isArray(parsed.displayDynamicsPerStaff)
      ? parsed.displayDynamicsPerStaff.filter(
          (n: unknown) => typeof n === "string" && availableStaffNumbers.has(n),
        )
      : [];
    const perStaffLayer = Array.isArray(parsed.displayDynamicsPerStaffLayer)
      ? parsed.displayDynamicsPerStaffLayer.filter(
          (n: unknown) =>
            typeof n === "string" && availableStaffLayerTuples.has(n),
        )
      : [];
    const prefs: FeatureVisPrefs = {
      displayTempoCurves: !!parsed.displayTempoCurves,
      displayErrorRibbon: !!parsed.displayErrorRibbon,
      displayDynamicsSummary: !!parsed.displayDynamicsSummary,
      displayDynamicsPerStaff: perStaff,
      displayDynamicsPerStaffLayer: perStaffLayer,
    };
    return prefs;
  } catch (e) {
    if (typeof window !== "undefined" && key) {
      try {
        localStorage.removeItem(key);
        // eslint-disable-next-line no-empty
      } catch (_) {}
    }
    return null;
  }
}

export function writeFeatureVisPrefs(
  uri: string | null | undefined,
  prefs: FeatureVisPrefs,
): void {
  const key = storageKeyForUri(uri);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch (_) {
    // ignore storage errors
  }
}

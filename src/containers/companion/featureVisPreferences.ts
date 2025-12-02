export type FeatureVisMode = "pageView" | "featureVis";

export type FeatureVisPrefs = {
  displayTempoCurves: boolean;
  displayErrorRibbon: boolean;
  displayDynamicsSummary: boolean;
  displayDynamicsPerStaff: string[];
  displayDynamicsPerStaffLayer: string[];
  featureVisMode?: FeatureVisMode;
};

export function storageKeyForUri(uri?: string | null): string | null {
  return uri ? `at.ac.mdw.trompa:${uri}` : null;
}

type StoredPrefs = Record<string, unknown>;

function readStoredPrefs(key: string): StoredPrefs | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as StoredPrefs;
    }
    localStorage.removeItem(key);
  } catch (e) {
    try {
      localStorage.removeItem(key);
      // eslint-disable-next-line no-empty
    } catch (_) {}
  }
  return null;
}

function writeStoredPrefs(key: string, prefs: StoredPrefs): void {
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch (_) {
    // ignore storage errors
  }
}

function isFeatureVisMode(value: unknown): value is FeatureVisMode {
  return value === "pageView" || value === "featureVis";
}

export function readFeatureVisPrefs(
  uri: string | null | undefined,
  availableStaffNumbers: Set<string>,
  availableStaffLayerTuples: Set<string>,
): FeatureVisPrefs | null {
  const key = storageKeyForUri(uri);
  if (!key) return null;
  const stored = readStoredPrefs(key);
  if (!stored) return null;
  const hasControls =
    "displayTempoCurves" in stored &&
    "displayErrorRibbon" in stored &&
    "displayDynamicsSummary" in stored &&
    "displayDynamicsPerStaff" in stored &&
    "displayDynamicsPerStaffLayer" in stored;
  if (!hasControls) {
    return null;
  }
  const perStaff = Array.isArray(stored.displayDynamicsPerStaff)
    ? (stored.displayDynamicsPerStaff as unknown[]).filter(
        (n): n is string =>
          typeof n === "string" && availableStaffNumbers.has(n),
      )
    : [];
  const perStaffLayer = Array.isArray(stored.displayDynamicsPerStaffLayer)
    ? (stored.displayDynamicsPerStaffLayer as unknown[]).filter(
        (n): n is string =>
          typeof n === "string" && availableStaffLayerTuples.has(n),
      )
    : [];
  const prefs: FeatureVisPrefs = {
    displayTempoCurves: !!stored.displayTempoCurves,
    displayErrorRibbon: !!stored.displayErrorRibbon,
    displayDynamicsSummary: !!stored.displayDynamicsSummary,
    displayDynamicsPerStaff: perStaff,
    displayDynamicsPerStaffLayer: perStaffLayer,
  };
  if (isFeatureVisMode((stored as FeatureVisPrefs).featureVisMode)) {
    prefs.featureVisMode = (stored as FeatureVisPrefs).featureVisMode;
  }
  return prefs;
}

export function writeFeatureVisPrefs(
  uri: string | null | undefined,
  prefs: Partial<FeatureVisPrefs>,
): void {
  const key = storageKeyForUri(uri);
  if (!key) return;
  const existing = readStoredPrefs(key) || {};
  const merged = { ...existing, ...prefs };
  writeStoredPrefs(key, merged);
}

export function readFeatureVisModePreference(
  uri: string | null | undefined,
): FeatureVisMode | null {
  const key = storageKeyForUri(uri);
  if (!key) return null;
  const stored = readStoredPrefs(key);
  if (!stored) return null;
  const maybeMode = (stored as FeatureVisPrefs).featureVisMode;
  return isFeatureVisMode(maybeMode) ? maybeMode : null;
}

export function writeFeatureVisModePreference(
  uri: string | null | undefined,
  mode: FeatureVisMode,
): void {
  writeFeatureVisPrefs(uri, { featureVisMode: mode });
}

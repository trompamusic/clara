# FeatureVis data refactor on the MELD renderer

Implemented in `feature-vis-lifecycle` against baseline `9e9bb70`, independently
of the own-score rewrite. No renderer/provider migration is included.

## Handoff and invalidation

`SelectableScore` publishes after its MELD child commits. It supplies the SVG
and the actual cached page's URI, page number and rendering options, together
with the toolkit's MEI and timemap. Companion verifies the requested layout,
measures geometry only in feature mode, and publishes one plain record.
The observer remains a fallback notification; its debounce and animation-frame
callbacks are cancelled on unmount. Duplicate notifications for the same SVG
and cache entry are ignored. A missing/superseded score clears the record.

The old renderer has no generation counter. Record identity invalidates page
calculations, including remeasurement. Metadata is reused while page cache
entries are shared, and refreshed when the score cache is replaced. No timestamps
or invented applied-options provenance are used. Resize measures only a current,
connected, ready feature-mode SVG, using the record's stored provenance.

FeatureVis owns memoized score metadata and page grouping, plus controls and
hover state. Tempo range depends on score/performance inputs independently of
page projection. Dynamics accepts numeric RDF strings, including zero, and
produces numeric points, connectors and polygon strings. Layer polygons retain
the previous closed-path-through-minima drawing policy. Summary curves retain
the previous first-staff-per-group policy; per-staff/layer projections now retain
all represented staves. Ordinary pages keep FeatureVis and its worker mounted;
leaving feature mode unmounts them.

The worker uses protocol v2 and a versioned URL. Its request identity and source
references exclude page geometry and current selection. Replies are checked
against both identity and current props. Invalid envelopes and native worker
errors end loading. Inserted markers seek using the complete instant object.

## Checks performed on 2026-09-16

- `npx tsc --noEmit`: passed.
- ESLint on changed source: no errors; existing Companion unused-import/argument
  and legacy-ref warnings remain.
- `git diff --check`: passed.
- `node --check public/workers/errorRibbonWorker.js`: passed (syntax only).
- Development webpack compilation: passed with existing warnings, including
  missing source maps in Solid dependencies.
- `npm test -- --runInBand`: cannot run; this baseline has no `test` script and
  contains no existing test files. No test infrastructure was introduced.

## Chrome observations and remaining acceptance

Used `http://localhost:3012/demo`, without authentication, with Clara Schumann's
*Romanze ohne Opuszahl* and the Sight-read rendition. Loaded page mode page 1/3,
then entered feature mode page 1/17. Observed tempo curves and inserted/deleted
markers immediately after entry; inspected 96 tempo points in the DOM. The
actual versioned worker produced inserted markers for all three renditions.
A screenshot of the initial chart/score layout was inspected in the conversation.

The first run exposed a leftover tempo tooltip conversion call, fixed before
retesting. Dynamics was initially empty because RDF velocities are strings
(e.g. `"36"`, `"38"`, `"48"`); runtime inspection confirmed this and numeric
normalization was corrected. Browser control temporarily failed, then recovered
in a fresh Chrome window. Final-code observations:

- All three charts visibly populated; page 1 had 96 tempo and 96 dynamics points.
- All six measured barline x coordinates exactly matched the chart barlines.
- Navigated to page 3: same FeatureVis instance, same worker, request ID remained
  2, and same timemap metadata reference; page notes changed as expected.
  Page 3 had 74 tempo and 75 dynamics points, with no NaN/Infinity SVG attributes.
- Enabled staff 1 dynamics; its control and polygon persisted across navigation.
- Dispatched a DOM click on an inserted marker for another performance through
  DevTools: selected Take 2 and video currentTime became 46 seconds. Its handler
  forwards the actual instant. Worker identity/request ID stayed unchanged.
- Injected a valid stale worker envelope: existing result was retained.
- Injected a malformed envelope: visible error and loading=false.
- Switched with `p` then `v`: old instance unmounted, old worker message/error
  handlers were null, new worker mounted and returned a result without error.
  Staff 1 preference restored and its dynamics polygon was visible.
  This sequence returned to page 1; it does not establish later-page preservation.

### Follow-up acceptance run

- Layer 1:1 toggle produced the three expected performance polygons and restored
  after leaving/re-entering feature mode.
- Hover showed details immediately, remained visible immediately after mouseout,
  and was hidden after 600 ms (configured delay 500 ms). Page navigation cleared
  visible hover state.
- Feature page 2 -> page mode retained its target note. Page mode page 2 ->
  feature mode mapped to page 6, with the target note still present.
- Tempo click requested 7.759 seconds, dynamics click requested 15.279 seconds,
  and inserted click passed an instant corresponding to 13.309 seconds including
  the performance offset. Actual media positions were 7, 15, and 13 seconds.
  Companion's pre-existing `onReady` handler floors pending seek times; exact
  subsecond seeking therefore does not pass. The handler is unchanged by this
  refactor.
- Deleted-note IDs exactly matched alignment data on feature pages 6 and 7
  (one each), and page-mode pages 2 and 3 (two and six respectively).
- Scroll, window zoom/resize, and browser zoom to 90% retained exact barline
  alignment (four measured x differences all zero on feature page 6). Browser
  zoom was restored afterwards.

**Playback-following blocker found before the fixes below:** video playback advanced, but Companion's last
media tick stayed zero. Calling the actual ReactPlayer progress method exposed
`Invariant Violation: update(): $merge expects a target of type 'object'; got
undefined` in MELD's timesync reducer. `TICK` merges into a missing media-resource
entry. Inspection of the unchanged dependency shows `REGISTER_CLOCK` replaces
`mediaResources` with an empty map when registering an already-present URI,
which can cause this after repeated seeks/performance selections. This was the clock-registration failure fixed below.

Interaction assertions used temporary DevTools instrumentation and dispatched
DOM events, plus native browser controls. The first inserted-marker probe tried
to inspect an uncaptured instant and caused a diagnostic TypeError; the corrected
probe captured the actual child callback argument successfully. That diagnostic
error is separate from the timesync reducer failure above.

These cases remain **unverified**, not passed:

- Replacement-input races, native worker errors, empty/malformed musical data,
  and observing actual worker termination beyond cleared handlers/unmounted state.

### Playback fixes and final regression checks

- `5d63585`: override only MELD's `REGISTER_CLOCK` action through its supported
  reducer-registration API. Duplicate registration is a no-op; new clocks retain
  all existing clock times and annotations. Other actions use MELD's reducer.
  Direct assertions passed for initialization, duplicate registration, adding a
  second clock, retaining references/data, immutability, and delegation.
- `bcbd660`: use explicit seconds for Companion seeks, retain fractional values,
  and accept a pending zero-second seek in the player-ready callback.
- Removing the development effect-frequency guard exposed normal playback again,
  but the user preferred retaining it. The final code restores the guard and
  changes playback polling from 10 ms to 50 ms. This remains inside the existing
  100 ms active-note window, while avoiding the guard's 60-effects/second limit.
- Chrome demo, final code with guard enabled: repeated chart clicks followed by
  six seconds of playback produced 101 ticks, advanced media time to 45.632134
  and Companion time to 45.606592, highlighted an active note, and automatically
  moved from feature page 1 to page 3. The same error-ribbon instance remained.
- Final seek comparisons: tempo expected 7.759 / actual 7.758999; dynamics
  expected 49.010 / actual 49.009999; inserted note expected/actual 46.143.
  These are browser floating-point/media precision differences, not truncation.
- Player-ready callback checks landed at exactly 0.25 seconds and zero seconds.
- After paused playback settled, a 1.2-second observation recorded zero extra
  progress ticks. No runaway-effect or timesync crash occurred in this run.
- TypeScript and changed-source ESLint passed (existing Companion warnings only).
  Development webpack compiled with existing source-map/lint warnings.

No automated test infrastructure or permanent diagnostic API was introduced.
No implementation commit/hash or completed status has been added to the external
plan. The remaining cases above are not claimed as complete release acceptance.

## Verovio source/history investigation

Cloned the full repository to `../verovio` at the user's request. Checkout HEAD
was `c98d7004c` (2026-09-16). The demo identifies its toolkit as
`6.3.0-425dd7b`.

Commit [`1d24642e6`](https://github.com/rism-digital/verovio/commit/1d24642e6331b61157b109d5dac28eaa1ae2c992)
(2021-08-23, first included in tag `version-3.6.0`) removed `BarLineAttr` and
stored the left/right position in `BarLine`. Thus the old `.barLineAttr` selector
misses barlines in current output. Measurement uses `.barLine` for the imported
Verovio version, without requiring IDs or supporting the obsolete output class.

The 2025 commit `6d68313ea` changed `GetClassName()` to return lowerCamelCase and
removed the equivalent lowercase conversion from `AppendIdAndClass`; this did
not itself change the emitted `.barLine` spelling. In version 6.3,
`include/vrv/barline.h` returns `barLine`, `src/view_page.cpp` starts a graphic for
the BarLine object, and `src/svgdevicecontext.cpp` writes that class to its SVG
group. The final browser check confirmed matching barline coordinates on demo page 1.

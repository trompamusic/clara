# Score ownership

`ScoreProvider` owns one session: the current MEI request, `ScoreRenderer`, and
published snapshot. App and Perform each mount it around Companion. The session
and its commands are created once with a lazy state initializer; mutable renderer
state stays in the session closure, outside the component tree.

`load(uri, options)` aborts the previous request and disposes the previous toolkit.
The replacement toolkit is constructed only after its MEI arrives. Late responses
cannot publish, and options changed during the fetch apply to the arriving score.
Failure and provider unmount also dispose the toolkit. Navigation while no renderer
is available does nothing.

Separate state and command contexts expose complete snapshots and stable commands.
`withScore` adapts these hooks for the class-based Companion. `ClaraScore` just
renders loading/error status and the SVG; `PageControls` reads the same snapshot
and calls navigation commands directly.

## Mode changes and DOM measurement

`applyModeChange(options, targetNote)` changes layout, resolves the note's page,
and publishes only the final score. Companion batches this command with its mode
state change, including native keyboard events under React 16. There is no pending
navigation callback or mirrored page/count/MEI state in Companion.

The renderer still computes an SVG when applying options, then another when
navigating. Only the final SVG reaches React, so generations can skip: the existing
test observes `1:1:1:encoded` followed by `3:2:2:line` (generation, page, DOM page,
layout). This is one published score update, not a promise of one React commit.

Companion owns the score DOM wrapper. After a ready snapshot commits,
`componentDidUpdate` collects note nodes for playback and publishes the plain
committed-page record used by FeatureVis. Geometry is measured only in feature
mode. This measurement still requires a subsequent local state update. Snapshot
identity prevents repeated measurement and distinguishes reloads whose numeric
generation restarts. Missing committed SVG reports failure to the provider; resize
during loading/error simply does nothing.

FeatureVis receives coherent plain page data, stays mounted across ordinary page
turns, and unmounts when leaving feature mode. The provider never owns DOM nodes.

## Verification — 2026-09-16

Chrome at `localhost:3020/demo`, Clara Schumann Romanze, Take 1:

- Loaded the score, turned pages, and selected segment B (page 2).
- Switched page 2 to feature page 6 at the same passage, then back to page 2.
- Tempo, dynamics and error charts appeared aligned with the score. Staff 1's
  dynamics control survived an ordinary page turn; the chart container retained
  DOM identity from feature page 6 to 7. Leaving feature mode removed it.
- The inspected feature page had no SVG attributes containing NaN or Infinity.
- Console-dispatched keyboard events exercised the document listener for next
  page and both modes. Physical keyboard/menu automation was unreliable; segment
  selection was verified with a console-dispatched select change as well.

All 23 existing/adapted and targeted ownership tests pass, as does TypeScript.
The added ownership checks cover late fetch replacement and same-URI reload
disposal. Browser validation did not cover throttled replacement/error recovery,
resize during loading, physical keyboard paint timing, or a full playback/seek
regression. The separate FeatureVis branch's broader manual acceptance still
applies; the checks above verify this integration rather than replacing it.

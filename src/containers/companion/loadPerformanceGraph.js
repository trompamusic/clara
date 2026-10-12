import { applyMiddleware, combineReducers, createStore } from "redux";
import thunk from "redux-thunk";
import { createGraphReducer } from "meld-clients-core/lib/reducers/reducer_graph";
import traversalPool from "meld-clients-core/lib/reducers/reducer_traversalPool";
import sessionControl from "meld-clients-core/lib/reducers/reducer_sessionControl";
import {
  registerTraversal,
  traverse,
  setFetchFunction,
  setTraversalObjectives,
  checkTraversalObjectives,
} from "meld-clients-core/lib/actions/index";

const objectives = [
  "http://purl.org/ontology/mo/Performance",
  "http://www.linkedmusic.org/ontologies/segment/Segment",
  "http://purl.org/NET/c4dm/timeline.owl#Instant",
  "http://www.w3.org/ns/oa#Annotation",
  "http://purl.org/ontology/mo/Score",
].map((type) => ({ "@type": type }));

// Each page load owns its graph. React receives only complete framed results.
export function loadPerformanceGraph({
  uri,
  params,
  fetch: fetchFn,
  signal,
  onProgress,
}) {
  const store = createStore(
    combineReducers({
      graph: createGraphReducer({ computeOutcomesHash: false }),
      traversalPool,
      sessionControl,
    }),
    applyMiddleware(thunk),
  );
  return new Promise((resolve, reject) => {
    const requests = new AbortController();
    let score = null;
    let settled = false;
    let scheduled = false;
    let processing = false;
    let frame;
    let unsubscribe = () => {};
    const finish = (error, outcomes) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      cancelAnimationFrame(frame);
      signal.removeEventListener("abort", abort);
      if (error) {
        requests.abort();
        reject(error);
      } else resolve({ outcomes, score });
    };
    const abort = () =>
      finish(new DOMException("Page load cancelled", "AbortError"));
    const pump = () => {
      scheduled = false;
      if (settled) return;
      try {
        let state = store.getState();
        if (processing) {
          if (state.graph.allObjectivesApplied) {
            const outcomes = state.graph.outcomes;
            if (
              outcomes.length !== objectives.length ||
              !Array.from(outcomes).every(
                (outcome) => outcome && typeof outcome === "object",
              )
            ) {
              throw new Error("Performance processing failed");
            }
            finish(null, outcomes);
          }
          return;
        }
        if (!score) {
          const published = state.graph.graph.find(
            (node) => node["http://purl.org/ontology/mo/published_as"],
          );
          const scoreUri =
            published?.["http://purl.org/ontology/mo/published_as"]?.[0]?.[
              "@id"
            ];
          if (scoreUri) {
            score = { uri: scoreUri, mei: null };
            // Use the same global, rate-limited fetch as the score provider.
            fetch(scoreUri, { mode: "cors", signal: requests.signal })
              .then(async (response) => {
                if (!response.ok)
                  throw new Error(
                    `Could not load score: HTTP ${response.status}`,
                  );
                const mei = await response.text();
                if (settled) return;
                score.mei = mei;
                schedule();
              })
              .catch((error) => finish(error));
          }
        }
        while (
          state.traversalPool.running < 10 &&
          Object.keys(state.traversalPool.pool).length
        ) {
          const next = Object.keys(state.traversalPool.pool)[0];
          store.dispatch(traverse(next, state.traversalPool.pool[next]));
          state = store.getState();
        }
        const pending =
          state.traversalPool.running +
          Object.keys(state.traversalPool.pool).length +
          (score && score.mei === null ? 1 : 0);
        onProgress({
          status: "traversing",
          loaded:
            state.graph.graphDocs.length +
            (score && score.mei !== null ? 1 : 0),
          pending,
        });
        if (pending) return;
        if (!state.graph.graph.length)
          throw new Error("Traversal returned no score data");
        if (!score) throw new Error("Traversal returned no published score");
        processing = true;
        onProgress({ status: "processing" });
        // Paint the processing state before JSON-LD framing occupies the thread.
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            try {
              store.dispatch(
                checkTraversalObjectives(
                  state.graph.graph,
                  state.graph.objectives,
                ),
              );
            } catch (error) {
              finish(error);
            }
          });
        });
      } catch (error) {
        finish(error);
      }
    };
    const schedule = () => {
      if (settled || scheduled) return;
      scheduled = true;
      // Meld publishes a document before registering its outgoing links. Inspect
      // the queue only after that entire synchronous dispatch chain finishes.
      Promise.resolve().then(pump);
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    store.dispatch(
      setFetchFunction(async (input, init) => {
        if (requests.signal.aborted)
          throw new DOMException("Page load cancelled", "AbortError");
        const response = await fetchFn(input, {
          ...init,
          signal: requests.signal,
        });
        if (!response.ok && response.status !== 304)
          throw new Error(`HTTP ${response.status}: ${input}`);
        return response;
      }),
    );
    store.dispatch(setTraversalObjectives(objectives));
    unsubscribe = store.subscribe(schedule);
    store.dispatch(registerTraversal(uri, params));
  });
}

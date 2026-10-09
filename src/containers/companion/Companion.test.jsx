/* global jest, beforeEach, afterEach, test, expect */
import { renderToStaticMarkup } from "react-dom/server";
import { Companion } from "./Companion";

jest.mock("../../selectable-score/selectable-score", () => () => null);
jest.mock("../../selectable-score/next-page-button", () => () => null);
jest.mock("../../selectable-score/prev-page-button", () => () => null);
jest.mock("./FeatureVis", () => () => null);
jest.mock("./MidiPlayer", () => ({ MidiPlayer: () => null }));
jest.mock("./AuthenticatedMediaPlayer", () => () => null);
jest.mock("meld-clients-core/lib/actions/index", () => ({}));

const timeline = "https://example.org/timeline";
const performance = {
  "@id": "https://example.org/performance",
  "http://www.w3.org/2000/01/rdf-schema#label": "Morning practice",
  "http://purl.org/ontology/mo/recorded_as": {
    "http://purl.org/ontology/mo/available_as": { "@id": "take.mid" },
    "http://purl.org/ontology/mo/time": {
      "http://purl.org/NET/c4dm/timeline.owl#onTimeLine": { "@id": timeline },
    },
  },
};

function companion() {
  const instance = new Companion({
    traversalPool: { running: 0, pool: {} },
    graph: { allObjectivesApplied: true },
    score: { loadStatus: {} },
    registerClock: jest.fn(),
    onPerformanceSelected: jest.fn(),
  });
  instance.state.performances = [performance];
  instance.state.loading = false;
  instance.setState = (update, callback) => {
    instance.state = { ...instance.state, ...update };
    callback?.();
  };
  return instance;
}

beforeEach(() => jest.spyOn(console, "log").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test("missing timeline leaves the current selection intact and explains the failure", () => {
  const instance = companion();
  const previous = { "@id": "previous-performance" };
  instance.state.selectedPerformance = previous;
  instance.state.selectedVideo = "previous.mid";

  instance.handlePerformanceSelected(performance["@id"]);

  expect(instance.state.selectedPerformance).toBe(previous);
  expect(instance.state.selectedVideo).toBe("previous.mid");
  expect(instance.state.performanceLoadError).toContain(
    "timeline couldn’t be loaded",
  );
  expect(instance.props.registerClock).not.toHaveBeenCalled();
  expect(instance.props.onPerformanceSelected).not.toHaveBeenCalled();
});

test("a rendition can be selected once its timeline is available", () => {
  const instance = companion();
  instance.handlePerformanceSelected(performance["@id"]);
  instance.state.instantsByPerfTime = { [timeline]: [{}] };
  instance.state.instantsByNoteId = { [timeline]: { note: {} } };

  instance.handlePerformanceSelected(performance["@id"]);

  expect(instance.state.performanceLoadError).toBe("");
  expect(instance.state.selectedPerformance).toBe(performance);
  expect(instance.props.registerClock).toHaveBeenCalledWith("take.mid");
  expect(instance.props.onPerformanceSelected).toHaveBeenCalledWith(
    performance["@id"],
  );
});

test("deleted-note highlighting tolerates a missing timeline", () => {
  const instance = companion();
  instance.state.selectedPerformance = performance;
  document.body.innerHTML = '<span class="note deleted"></span>';

  expect(() => instance.highlightDeletedNotes()).not.toThrow();
  expect(document.querySelector(".note")).not.toHaveClass("deleted");
  document.body.innerHTML = "";
});

function renditionOption(instance) {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(instance.render());
  return container.querySelector(`option[value="${performance["@id"]}"]`);
}

test("missing renditions stay disabled while loading and after traversal fails", () => {
  const instance = companion();
  instance.props.traversalPool.running = 1;
  let option = renditionOption(instance);
  expect(option.disabled).toBe(true);
  expect(option.textContent).toBe("Morning practice — loading…");

  instance.props.traversalPool.running = 0;
  instance.props.graph.allObjectivesApplied = false;
  expect(renditionOption(instance).textContent).toContain("loading…");

  instance.props.graph.allObjectivesApplied = true;
  option = renditionOption(instance);
  expect(option.disabled).toBe(true);
  expect(option.textContent).toBe("Morning practice — unavailable");

  instance.state.instantsByPerfTime = { [timeline]: [{}] };
  instance.state.instantsByNoteId = { [timeline]: { note: {} } };
  option = renditionOption(instance);
  expect(option.disabled).toBe(false);
  expect(option.textContent).toBe("Morning practice");
});

test("URL selection waits for loading, explains missing data, and selects if it becomes available", () => {
  const instance = companion();
  instance.props.selectedPerformance = performance["@id"];
  instance.props.traversalPool.running = 1;
  instance.applyInitialPerformanceSelection();
  expect(instance.state.performanceLoadError).toBe("");
  expect(instance.props.registerClock).not.toHaveBeenCalled();

  instance.props.traversalPool.running = 0;
  instance.applyInitialPerformanceSelection();
  expect(instance.state.performanceLoadError).toContain(
    "timeline couldn’t be loaded",
  );
  expect(instance.initialPerformanceAppliedId).toBe("");
  instance.setState = jest.fn(instance.setState);
  instance.applyInitialPerformanceSelection();
  expect(instance.setState).not.toHaveBeenCalled();

  instance.state.instantsByPerfTime = { [timeline]: [{}] };
  instance.state.instantsByNoteId = { [timeline]: { note: {} } };
  instance.applyInitialPerformanceSelection();
  expect(instance.state.performanceLoadError).toBe("");
  expect(instance.state.selectedPerformance).toBe(performance);
  expect(instance.initialPerformanceAppliedId).toBe(performance["@id"]);
  expect(instance.props.onPerformanceSelected).not.toHaveBeenCalled();
});

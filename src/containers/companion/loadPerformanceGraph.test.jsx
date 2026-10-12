/* eslint-env jest, node */
import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { Companion } from "./Companion";
import {
  ScoreProvider,
  useScoreState,
  useScoreCommands,
} from "../../score/ScoreProvider";
import { deferred, fakeToolkit, setRuntime } from "../../score/testToolkit";
import { loadPerformanceGraph } from "./loadPerformanceGraph";

jest.mock("./FeatureVis", () => () => null);
jest.mock("./MidiPlayer", () => ({ MidiPlayer: () => null }));
jest.mock("./AuthenticatedMediaPlayer", () => () => null);
// Use JSON-LD's browser build, as webpack does, instead of its Node HTTP loader.
jest.mock(
  require.resolve("jsonld", {
    paths: [require.resolve("meld-clients-core/package.json")],
  }),
  () =>
    jest.requireActual(
      require.resolve("jsonld/dist/jsonld.js", {
        paths: [require.resolve("meld-clients-core/package.json")],
      }),
    ),
);

const root = "https://example.org/score";
const performance = "https://example.org/performance";
const timeline = "https://example.org/timeline";
const mei = "https://scores.example.org/score.mei";
const mo = "http://purl.org/ontology/mo/";
const tl = "http://purl.org/NET/c4dm/timeline.owl#";
const documents = {
  [root]: {
    "@id": root,
    "@type": `${mo}Score`,
    [`${mo}published_as`]: { "@id": mei },
    "http://www.w3.org/2004/02/skos/core#related": { "@id": performance },
  },
  [performance]: {
    "@id": performance,
    "@type": `${mo}Performance`,
    "http://www.w3.org/2000/01/rdf-schema#label": "Practice",
    [`${mo}performance_of`]: { "@id": root },
    [`${mo}recorded_as`]: {
      "@id": `${performance}#signal`,
      [`${mo}available_as`]: { "@id": "https://media.example.org/take.mid" },
      [`${mo}time`]: {
        "@id": `${performance}#time`,
        [`${tl}onTimeLine`]: { "@id": timeline },
      },
    },
  },
  [timeline]: { "@id": timeline, "@type": `${tl}Timeline` },
};
const response = (uri) => ({
  ok: true,
  status: 200,
  headers: new Headers({ "Content-Type": "application/ld+json" }),
  json: async () => documents[uri],
});

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  setRuntime({ toolkit: jest.fn(() => fakeToolkit()) });
  global.fetch = jest.fn(async () => ({
    ok: true,
    text: async () => "<mei/>",
  }));
});
afterEach(() => {
  setRuntime();
  jest.restoreAllMocks();
});

function Page({ fetchFn }) {
  const scoreState = useScoreState();
  const scoreCommands = useScoreCommands();
  return (
    <Companion
      uri={root}
      userPOD="https://example.org/"
      fetch={fetchFn}
      scoreState={scoreState}
      scoreCommands={scoreCommands}
      registerClock={jest.fn()}
      tickTimedResource={jest.fn()}
    />
  );
}

test("the page waits for discovered performance and timeline responses, then score rendering", async () => {
  const take = deferred();
  const times = deferred();
  const score = deferred();
  const fetchFn = jest.fn((uri) =>
    uri === performance
      ? take.promise
      : uri === timeline
        ? times.promise
        : Promise.resolve(response(uri)),
  );
  global.fetch = jest.fn(() => score.promise);
  const view = render(
    <ScoreProvider>
      <Page fetchFn={fetchFn} />
    </ScoreProvider>,
  );
  await waitFor(() =>
    expect(fetchFn).toHaveBeenCalledWith(performance, expect.anything()),
  );
  expect(view.getByRole("status")).toBeVisible();
  expect(view.getByRole("status")).toHaveTextContent(
    "Loaded 1 documents · 2 pending",
  );
  expect(view.container.querySelector(".score")).toBeNull();
  expect(global.fetch).toHaveBeenCalledWith(mei, expect.anything());
  await act(async () =>
    score.resolve({ ok: true, text: async () => "<mei/>" }),
  );
  expect(global.verovio.toolkit).not.toHaveBeenCalled();
  expect(view.getByRole("status")).toHaveTextContent("Downloading…");

  await act(async () => take.resolve(response(performance)));
  await waitFor(() =>
    expect(fetchFn).toHaveBeenCalledWith(timeline, expect.anything()),
  );
  expect(view.getByRole("status")).toBeVisible();
  expect(view.container.querySelector(".score")).toBeNull();

  await act(async () => times.resolve(response(timeline)));
  expect(view.getByRole("status")).toHaveTextContent("Processing…");
  await waitFor(() => expect(view.queryByRole("status")).toBeNull());
  expect(view.container.querySelector(".score > svg")).toBeVisible();
  expect(fetchFn).toHaveBeenCalledTimes(3);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("a failed MEI download aborts performance requests without waiting for them", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  const take = deferred();
  const fetchFn = jest.fn((uri) =>
    uri === performance ? take.promise : Promise.resolve(response(uri)),
  );
  global.fetch = jest.fn(async () => ({ ok: false, status: 404 }));
  const view = render(
    <ScoreProvider>
      <Page fetchFn={fetchFn} />
    </ScoreProvider>,
  );
  await waitFor(() => expect(view.getByRole("alert")).toBeVisible());
  const request = fetchFn.mock.calls.find(([uri]) => uri === performance);
  expect(request[1].signal.aborted).toBe(true);
  expect(view.queryByRole("status")).toBeNull();
  expect(global.verovio.toolkit).not.toHaveBeenCalled();
  await act(async () => take.resolve(response(performance)));
  expect(fetchFn).toHaveBeenCalledTimes(2);
});

test("processing waits for the MEI body even when traversal has finished", async () => {
  const body = deferred();
  global.fetch = jest.fn(async () => ({ ok: true, text: () => body.promise }));
  const fetchFn = jest.fn(async (uri) => response(uri));
  const progress = jest.fn();
  const result = loadPerformanceGraph({
    uri: root,
    params: { extendObjectPrefix: ["https://example.org/"] },
    fetch: fetchFn,
    signal: new AbortController().signal,
    onProgress: progress,
  });
  await waitFor(() =>
    expect(progress).toHaveBeenLastCalledWith({
      status: "traversing",
      loaded: 3,
      pending: 1,
    }),
  );
  body.resolve("<mei/>");
  await expect(result).resolves.toMatchObject({
    score: { uri: mei, mei: "<mei/>" },
  });
});

test("cancelling a load aborts its requests and prevents later processing", async () => {
  const controller = new AbortController();
  const rootResponse = deferred();
  const fetchFn = jest.fn(() => rootResponse.promise);
  const onProgress = jest.fn();
  const result = loadPerformanceGraph({
    uri: root,
    params: {},
    fetch: fetchFn,
    signal: controller.signal,
    onProgress,
  });
  await waitFor(() => expect(fetchFn).toHaveBeenCalled());
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
  expect(fetchFn.mock.calls[0][1].signal.aborted).toBe(true);
  onProgress.mockClear();
  rootResponse.resolve(response(root));
  await act(async () => {});
  expect(onProgress).not.toHaveBeenCalled();
  expect(fetchFn).toHaveBeenCalledTimes(1);
});

test("a failed root request ends the page load with an error", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  const fetchFn = jest.fn(async () => ({ ok: false, status: 503 }));
  const view = render(
    <ScoreProvider>
      <Page fetchFn={fetchFn} />
    </ScoreProvider>,
  );
  await waitFor(() => expect(view.getByRole("alert")).toBeVisible());
  expect(view.getByRole("button", { name: "Reload" })).toBeVisible();
  expect(view.queryByRole("status")).toBeNull();
  expect(view.container.querySelector(".score")).toBeNull();
});

test("each visit downloads its own graph instead of reusing a previous traversal", async () => {
  const fetchFn = jest.fn(async (uri) => response(uri));
  const load = () =>
    loadPerformanceGraph({
      uri: root,
      params: { extendObjectPrefix: ["https://example.org/"] },
      fetch: fetchFn,
      signal: new AbortController().signal,
      onProgress: () => {},
    });
  await load();
  fetchFn.mockClear();
  const { outcomes } = await load();
  expect(fetchFn).toHaveBeenCalledTimes(3);
  expect(outcomes[0]["@id"]).toBe(performance);
});

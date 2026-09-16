import React, { createRef, useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ClaraScore, { ClaraScoreHandle, ScoreRenderInfo } from "./ClaraScore";
import { deferred, fakeToolkit, fetchMei, setRuntime } from "./testToolkit";

let toolkit: ReturnType<typeof fakeToolkit>;
let construct: jest.Mock;
beforeEach(() => {
  toolkit = fakeToolkit();
  construct = jest.fn(() => toolkit);
  setRuntime({ toolkit: construct });
  global.fetch = fetchMei();
});
afterEach(() => {
  setRuntime();
});

test("HTTP failure reports an error after one plain CORS fetch, without constructing a toolkit", async () => {
  const fetchImpl = fetchMei(),
    onError = jest.fn();
  fetchImpl.mockResolvedValue({ ok: false, status: 403 } as Response);
  global.fetch = fetchImpl;
  render(
    <ClaraScore
      uri="score.mei"
      mode="pageView"
      options={{}}
      onError={onError}
    />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 403");
  expect(fetchImpl.mock.calls).toEqual([
    ["score.mei", { mode: "cors", signal: expect.any(AbortSignal) }],
  ]);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(construct).not.toHaveBeenCalled();
});

test.each(["response", "body"])(
  "unmount during pending %s aborts the request and constructs no toolkit",
  async (phase) => {
    const response = deferred<Response>(),
      body = deferred<string>();
    const onRender = jest.fn(),
      onError = jest.fn();
    global.fetch = jest.fn(() => response.promise);
    const { unmount } = render(
      <ClaraScore
        uri="a"
        mode="pageView"
        options={{}}
        onRender={onRender}
        onError={onError}
      />,
    );
    const received = { ok: true, text: () => body.promise } as Response;
    if (phase === "body") await act(async () => response.resolve(received));
    const signal = jest.mocked(global.fetch).mock.calls[0][1]!.signal!;
    expect(construct).not.toHaveBeenCalled();
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => {
      response.resolve(received);
      body.resolve("mei");
    });
    expect(construct).not.toHaveBeenCalled();
    expect(onRender).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  },
);

test("onRender reports a committed SVG exactly once per render; navigation accepts all target forms", async () => {
  const ref = createRef<ClaraScoreHandle>();
  const onRender = jest.fn((info: ScoreRenderInfo) => {
    expect(info.svgElement).toBeInTheDocument();
    expect(info.svgElement).toHaveAttribute(
      "data-page",
      String(info.currentPage),
    );
  });
  const { unmount, rerender } = render(
    <ClaraScore
      ref={ref}
      uri="a"
      mode="pageView"
      options={{ breaks: "encoded", svgAdditionalAttribute: ["note@pname"] }}
      onRender={onRender}
    />,
  );
  await waitFor(() => expect(onRender).toHaveBeenCalledTimes(1));
  rerender(
    <ClaraScore
      ref={ref}
      uri="a"
      mode="pageView"
      options={{ svgAdditionalAttribute: ["note@pname"], breaks: "encoded" }}
      onRender={onRender}
    />,
  );
  act(() => ref.current!.prevPage());
  expect(onRender).toHaveBeenCalledTimes(1);
  expect(toolkit.redoLayout).not.toHaveBeenCalled();
  for (const target of ["note", "#note", "uri#note"])
    act(() => ref.current!.goToNote(target));
  expect(toolkit.getPageWithElement.mock.calls).toEqual([
    ["note"],
    ["note"],
    ["note"],
  ]);
  expect(onRender).toHaveBeenCalledTimes(4);
  unmount();
  expect(toolkit.destroy).toHaveBeenCalledTimes(1);
});

test("mode changes during fetch use the latest options on the first render", async () => {
  const text = deferred<string>();
  global.fetch = jest.fn(
    async () => ({ ok: true, text: () => text.promise }) as Response,
  );
  const onRender = jest.fn();
  const { rerender } = render(
    <ClaraScore
      uri="a"
      mode="pageView"
      options={{ breaks: "encoded" }}
      onRender={onRender}
    />,
  );
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  rerender(
    <ClaraScore
      uri="a"
      mode="featureVis"
      options={{ breaks: "line" }}
      onRender={onRender}
    />,
  );
  expect(construct).not.toHaveBeenCalled();
  expect(toolkit.setOptions).not.toHaveBeenCalled();
  await act(async () => text.resolve("mei"));
  expect(toolkit.setOptions.mock.calls).toEqual([[{ breaks: "line" }]]);
  expect(onRender).toHaveBeenCalledTimes(1);
  expect(onRender.mock.calls[0][0].svgElement).toHaveAttribute(
    "data-layout",
    "line",
  );
});

test.each(["missing runtime", "construction", "load", "options", "navigation"])(
  "%s failure enters error state, reports onError, and prevents later navigation",
  async (source) => {
    const onError = jest.fn(),
      onRender = jest.fn(),
      ref = createRef<ClaraScoreHandle>();
    if (source === "missing runtime") setRuntime();
    if (source === "construction")
      construct.mockImplementation(() => {
        throw new Error("Toolkit construction failed");
      });
    if (source === "load") toolkit.loadData.mockReturnValue(false);
    const { rerender } = render(
      <ClaraScore
        ref={ref}
        uri="a"
        mode="pageView"
        options={{}}
        onError={onError}
        onRender={onRender}
      />,
    );
    if (source === "options" || source === "navigation") {
      await waitFor(() => expect(onRender).toHaveBeenCalledTimes(1));
      toolkit.renderToSVG.mockImplementation(() => {
        throw new Error("render failed");
      });
      if (source === "options")
        rerender(
          <ClaraScore
            ref={ref}
            uri="a"
            mode="featureVis"
            options={{ breaks: "line" }}
            onError={onError}
            onRender={onRender}
          />,
        );
      else act(() => ref.current!.nextPage());
    }
    const alert = await screen.findByRole("alert");
    if (source === "missing runtime")
      expect(alert).toHaveTextContent("Verovio runtime is unavailable");
    if (source === "construction")
      expect(alert).toHaveTextContent("Toolkit construction failed");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(ref.current!.getSvgElement()).toBeNull();
    toolkit.renderToSVG.mockClear();
    act(() => ref.current!.nextPage());
    expect(toolkit.renderToSVG).not.toHaveBeenCalled();
  },
);

test("a render callback can request a dependent layout and navigation with matching committed metadata", async () => {
  const ref = createRef<ClaraScoreHandle>(),
    seen: string[] = [];
  function Harness() {
    const [mode, setMode] = useState<"pageView" | "featureVis">("pageView");
    return (
      <ClaraScore
        ref={ref}
        uri="a"
        mode={mode}
        options={{ breaks: mode === "pageView" ? "encoded" : "line" }}
        onRender={(info) => {
          seen.push(
            `${info.generation}:${info.currentPage}:${info.svgElement.getAttribute("data-page")}:${info.svgElement.getAttribute("data-layout")}`,
          );
          if (info.generation === 1) setMode("featureVis");
          if (info.generation === 2) ref.current!.goToNote("note");
        }}
      />
    );
  }
  render(<Harness />);
  await waitFor(() => expect(seen).toHaveLength(3));
  expect(seen).toEqual(["1:1:1:encoded", "2:1:1:line", "3:2:2:line"]);
});

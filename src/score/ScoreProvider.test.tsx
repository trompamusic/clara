import React, { useEffect, useLayoutEffect, useRef } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ClaraScore from "./ClaraScore";
import {
  ScoreProvider,
  useScoreState,
  useScoreCommands,
  ScoreCommands,
  ReadyScore,
} from "./ScoreProvider";
import { VerovioOptions } from "./ScoreRenderer";
import { deferred, fakeToolkit, fetchMei, setRuntime } from "./testToolkit";

let toolkit: ReturnType<typeof fakeToolkit>;
let construct: jest.Mock;
let commands: ScoreCommands;
beforeEach(() => {
  toolkit = fakeToolkit();
  construct = jest.fn(() => toolkit);
  setRuntime({ toolkit: construct });
  global.fetch = fetchMei();
});
afterEach(() => {
  setRuntime();
});

type RenderInfo = ReadyScore & { svgElement: SVGElement };
interface HarnessProps {
  uri?: string;
  options?: VerovioOptions;
  onRender?: (info: RenderInfo) => void;
  onError?: (error: Error) => void;
}
const defaultOptions = {};
function Harness({
  uri = "a",
  options = defaultOptions,
  onRender,
  onError,
}: HarnessProps) {
  const score = useScoreState();
  const actions = useScoreCommands();
  const container = useRef<HTMLDivElement>(null);
  const initialOptions = useRef(options);
  commands = actions;
  useEffect(() => {
    actions.load(uri, initialOptions.current);
  }, [actions, uri]);
  useLayoutEffect(() => {
    actions.setOptions(options);
  }, [actions, options]);
  useLayoutEffect(() => {
    if (score.status === "error") onError?.(score.error);
    if (score.status !== "ready") return;
    const svgElement = container.current!.querySelector("svg");
    if (!svgElement) {
      actions.reportRenderFailure(
        score,
        new Error("Verovio returned no score SVG"),
      );
      return;
    }
    onRender?.({ ...score, svgElement });
  }, [score, actions, onRender, onError]);
  return (
    <div ref={container}>
      <ClaraScore mode="pageView" />
    </div>
  );
}
function TestScore(props: HarnessProps) {
  return (
    <ScoreProvider>
      <Harness {...props} />
    </ScoreProvider>
  );
}

test("HTTP failure reports an error after one plain CORS fetch, without constructing a toolkit", async () => {
  const fetchImpl = fetchMei(),
    onError = jest.fn();
  fetchImpl.mockResolvedValue({ ok: false, status: 403 } as Response);
  global.fetch = fetchImpl;
  render(<TestScore uri="score.mei" onError={onError} />);
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
      <TestScore onRender={onRender} onError={onError} />,
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

test("snapshots match committed SVG exactly once per render; navigation accepts all target forms", async () => {
  const onRender = jest.fn((info: RenderInfo) => {
    expect(info.svgElement).toBeInTheDocument();
    expect(info.svgElement).toHaveAttribute(
      "data-page",
      String(info.currentPage),
    );
  });
  const { unmount, rerender } = render(
    <TestScore
      options={{ breaks: "encoded", svgAdditionalAttribute: ["note@pname"] }}
      onRender={onRender}
    />,
  );
  await waitFor(() => expect(onRender).toHaveBeenCalledTimes(1));
  const originalCommands = commands;
  rerender(
    <TestScore
      options={{ svgAdditionalAttribute: ["note@pname"], breaks: "encoded" }}
      onRender={onRender}
    />,
  );
  act(() => commands.prevPage());
  expect(onRender).toHaveBeenCalledTimes(1);
  expect(toolkit.redoLayout).not.toHaveBeenCalled();
  for (const target of ["note", "#note", "uri#note"])
    act(() => commands.goToNote(target));
  expect(toolkit.getPageWithElement.mock.calls).toEqual([
    ["note"],
    ["note"],
    ["note"],
  ]);
  expect(onRender).toHaveBeenCalledTimes(4);
  expect(commands).toBe(originalCommands);
  unmount();
  expect(toolkit.destroy).toHaveBeenCalledTimes(1);
});

test("mode changes during fetch use the latest options on the first render", async () => {
  const text = deferred<string>();
  global.fetch = jest.fn(
    async () => ({ ok: true, text: () => text.promise }) as Response,
  );
  const onRender = jest.fn();
  render(<TestScore options={{ breaks: "encoded" }} onRender={onRender} />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  act(() => commands.applyModeChange({ breaks: "line" }, null));
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
  "%s failure enters error state and prevents later navigation",
  async (source) => {
    const onError = jest.fn(),
      onRender = jest.fn();
    if (source === "missing runtime") setRuntime();
    if (source === "construction")
      construct.mockImplementation(() => {
        throw new Error("Toolkit construction failed");
      });
    if (source === "load") toolkit.loadData.mockReturnValue(false);
    render(<TestScore onError={onError} onRender={onRender} />);
    if (source === "options" || source === "navigation") {
      await waitFor(() => expect(onRender).toHaveBeenCalledTimes(1));
      toolkit.renderToSVG.mockImplementation(() => {
        throw new Error("render failed");
      });
      act(() =>
        source === "options"
          ? commands.setOptions({ breaks: "line" })
          : commands.nextPage(),
      );
    }
    const alert = await screen.findByRole("alert");
    if (source === "missing runtime")
      expect(alert).toHaveTextContent("Verovio runtime is unavailable");
    if (source === "construction")
      expect(alert).toHaveTextContent("Toolkit construction failed");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".score svg")).toBeNull();
    toolkit.renderToSVG.mockClear();
    act(() => commands.nextPage());
    expect(toolkit.renderToSVG).not.toHaveBeenCalled();
  },
);

test("mode switch publishes only the final layout and target page", async () => {
  const seen: string[] = [];
  const onRender = (info: RenderInfo) => {
    seen.push(
      `${info.generation}:${info.currentPage}:${info.svgElement.getAttribute("data-page")}:${info.svgElement.getAttribute("data-layout")}`,
    );
    if (info.generation === 1)
      commands.applyModeChange({ breaks: "line" }, "note");
  };
  render(<TestScore options={{ breaks: "encoded" }} onRender={onRender} />);
  await waitFor(() => expect(seen).toHaveLength(2));
  expect(seen).toEqual(["1:1:1:encoded", "3:2:2:line"]);
});

test("replacing a pending load ignores its late response", async () => {
  const first = deferred<Response>();
  const fetchImpl = fetchMei();
  fetchImpl.mockImplementationOnce(() => first.promise);
  global.fetch = fetchImpl;
  const onRender = jest.fn();
  render(<TestScore onRender={onRender} />);
  act(() => commands.load("b", { breaks: "line" }));
  await waitFor(() => expect(onRender).toHaveBeenCalledTimes(1));
  expect(jest.mocked(global.fetch).mock.calls[0][1]!.signal!.aborted).toBe(true);
  await act(async () => {
    first.resolve({ ok: true, text: async () => "obsolete" } as Response);
  });
  expect(construct).toHaveBeenCalledTimes(1);
  expect(onRender).toHaveBeenCalledTimes(1);
  expect(onRender.mock.calls[0][0].uri).toBe("b");
});

test("same-URI reload disposes each toolkit once despite repeating the generation", async () => {
  const replacement = fakeToolkit();
  construct.mockReturnValueOnce(toolkit).mockReturnValueOnce(replacement);
  const onRender = jest.fn();
  const { unmount } = render(<TestScore onRender={onRender} />);
  await waitFor(() => expect(onRender).toHaveBeenCalledTimes(1));
  const previous = onRender.mock.calls[0][0];
  act(() => commands.load("a", {}));
  expect(toolkit.destroy).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(onRender).toHaveBeenCalledTimes(2));
  const current = onRender.mock.calls[1][0];
  expect(current.uri).toBe(previous.uri);
  expect(current.generation).toBe(previous.generation);
  unmount();
  expect(toolkit.destroy).toHaveBeenCalledTimes(1);
  expect(replacement.destroy).toHaveBeenCalledTimes(1);
});

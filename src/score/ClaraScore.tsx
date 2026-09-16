import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import equal from "fast-deep-equal";
import { ScoreRenderer, TimemapEntry, VerovioOptions } from "./ScoreRenderer";

export interface ScoreRenderInfo {
  uri: string;
  options: VerovioOptions;
  svgElement: SVGElement;
  currentPage: number;
  pageCount: number;
  generation: number;
  mei: string;
  timemap: TimemapEntry[];
}

export interface ClaraScoreHandle {
  nextPage(): void;
  prevPage(): void;
  goToPage(n: number): void;
  goToNote(target: string): void;
  getSvgElement(): SVGElement | null;
}

interface ClaraScoreProps {
  uri: string;
  mode: "pageView" | "featureVis";
  options: VerovioOptions;
  onRender?: (info: ScoreRenderInfo) => void;
  onError?: (error: Error) => void;
}

type ViewState =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; svg: string; info: Omit<ScoreRenderInfo, "svgElement"> };

const ClaraScore = forwardRef<ClaraScoreHandle, ClaraScoreProps>(
  function ClaraScore(props, ref) {
    const { uri, mode, options } = props;
    const scoreElement = useRef<HTMLDivElement>(null);
    // Present only after loading succeeds; null means navigation is unavailable.
    const renderer = useRef<ScoreRenderer | null>(null);
    const latest = useRef(props);
    const [view, setView] = useState<ViewState>({ status: "loading" });

    // On every render, stash the current props so the callbacks below can reach the
    // latest onRender/onError without being rebuilt each time.
    useLayoutEffect(() => {
      latest.current = props;
    });

    // Called when the fetch or Verovio throws: throw away the renderer, show the error,
    // tell the parent. Every later command sees no renderer and quietly does nothing.
    const fail = useCallback((cause: unknown) => {
      renderer.current?.dispose();
      renderer.current = null;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      setView({ status: "error", error });
      latest.current.onError?.(error);
    }, []);

    // Called after any successful render: copy the SVG and its page/count/mei/timemap
    // into state as one snapshot, so the SVG can't get paired with another page's data.
    const publish = useCallback((score: ScoreRenderer) => {
      setView({
        status: "ready",
        svg: score.currentSvg,
        info: {
          uri: latest.current.uri,
          options: score.options,
          currentPage: score.currentPage,
          pageCount: score.pageCount,
          generation: score.generation,
          mei: score.getMei(),
          timemap: score.getTimemap(),
        },
      });
    }, []);

    // On mount, and whenever the score url changes: fetch the MEI, build a renderer,
    // render page 1. On the way out, cancel the fetch and destroy the renderer.
    useEffect(() => {
      const controller = new AbortController();
      let cancelled = false;
      let score: ScoreRenderer | undefined;
      async function load() {
        try {
          const response = await fetch(uri, {
            mode: "cors",
            signal: controller.signal,
          });
          if (!response.ok)
            throw new Error(`Could not load score: HTTP ${response.status}`);
          const mei = await response.text();
          if (cancelled) return;
          score = new ScoreRenderer();
          // No asynchronous gap between reading committed options and rendering.
          score.load(mei, latest.current.options);
          renderer.current = score;
          publish(score);
        } catch (error) {
          if (!cancelled) {
            score?.dispose();
            fail(error);
          }
        }
      }
      void load();
      return () => {
        cancelled = true;
        controller.abort();
        renderer.current = null;
        score?.dispose();
      };
    }, [uri, fail, publish]);

    // When the Verovio options change — i.e. a page-view/feature-vis switch: re-lay out
    // the score and publish the new SVG. Does nothing until a score has loaded.
    useLayoutEffect(() => {
      const score = renderer.current;
      if (!score || equal(options, score.options)) return;
      try {
        score.setOptions(options);
        publish(score);
      } catch (error) {
        fail(error);
      }
    }, [options, fail, publish]);

    // Once the new SVG is on the page: hand the parent its snapshot and the real <svg>
    // node to query. The parent must wait for this before asking for another render —
    // two in one tick and React drops the first.
    useLayoutEffect(() => {
      if (view.status !== "ready" || view.info.uri !== uri || !renderer.current)
        return;
      const svgElement = scoreElement.current?.querySelector("svg");
      if (!svgElement) {
        fail(new Error("Verovio returned no score SVG"));
        return;
      }
      latest.current.onRender?.({ ...view.info, svgElement });
    }, [view, uri, fail]);

    // Runs behind every ref command: skip if no score is loaded, run the command, then
    // publish only if the page actually changed.
    const navigate = useCallback(
      (action: (score: ScoreRenderer) => void) => {
        const score = renderer.current;
        if (!score) return;
        try {
          const generation = score.generation;
          action(score);
          if (score.generation !== generation) publish(score);
        } catch (error) {
          fail(error);
        }
      },
      [fail, publish],
    );

    // After mount, build what the parent gets in ref.current: the five commands it's
    // allowed to send, and nothing else.
    useImperativeHandle(
      ref,
      () => ({
        nextPage: () => navigate((score) => score.nextPage()),
        prevPage: () => navigate((score) => score.prevPage()),
        goToPage: (n) => navigate((score) => score.renderPage(n)),
        goToNote: (target) =>
          navigate((score) => {
            const page = score.pageForElement(target);
            if (page > 0) score.renderPage(page);
            else console.warn("Note unavailable in score:", target);
          }),
        getSvgElement: () =>
          renderer.current
            ? (scoreElement.current?.querySelector("svg") ?? null)
            : null,
      }),
      [navigate],
    );

    return (
      <div
        id={uri}
        className={`scorepane ${mode}`}
        data-score-status={view.status}
        aria-busy={view.status === "loading"}
      >
        {view.status === "loading" && <div role="status">Loading score…</div>}
        {view.status === "error" && (
          <div role="alert">Could not display score: {view.error.message}</div>
        )}
        <div
          ref={scoreElement}
          className="score"
          dangerouslySetInnerHTML={{
            __html:
              view.status === "ready" && view.info.uri === uri ? view.svg : "",
          }}
        />
      </div>
    );
  },
);

export default ClaraScore;

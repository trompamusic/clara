import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import equal from "fast-deep-equal";
import { ScoreRenderer, TimemapEntry, VerovioOptions } from "./ScoreRenderer";

export interface ReadyScore {
  status: "ready";
  uri: string;
  svg: string;
  currentPage: number;
  pageCount: number;
  appliedOptions: VerovioOptions;
  generation: number;
  mei: string;
  timemap: TimemapEntry[];
}
export type ScoreState =
  | { status: "idle"; uri: string }
  | { status: "loading"; uri: string }
  | { status: "error"; uri: string; error: Error }
  | ReadyScore;

export interface ScoreCommands {
  load(uri: string, options: VerovioOptions): void;
  setOptions(options: VerovioOptions): void;
  applyModeChange(options: VerovioOptions, targetNote: string | null): void;
  nextPage(): void;
  prevPage(): void;
  goToPage(page: number): void;
  goToNote(target: string): void;
  reportRenderFailure(snapshot: ReadyScore, error: Error): void;
}

const ScoreStateContext = createContext<ScoreState | null>(null);
const ScoreCommandsContext = createContext<ScoreCommands | null>(null);

export function useScoreState(): ScoreState {
  const state = useContext(ScoreStateContext);
  if (!state) throw new Error("ScoreProvider is required");
  return state;
}
export function useScoreCommands(): ScoreCommands {
  const commands = useContext(ScoreCommandsContext);
  if (!commands) throw new Error("ScoreProvider is required");
  return commands;
}

// One session per provider. Mutable toolkit/request state stays here; React sees
// only complete snapshots. Commands keep the same identity across page changes.
function createSession(publish: (state: ScoreState) => void) {
  let renderer: ScoreRenderer | null = null;
  let request: AbortController | null = null;
  let uri = "";
  let options: VerovioOptions = {};
  let pendingTarget: string | null = null;
  let snapshot: ScoreState = { status: "idle", uri };
  const emit = (value: ScoreState) => {
    snapshot = value;
    publish(value);
  };
  const dispose = () => {
    request?.abort();
    request = null;
    renderer?.dispose();
    renderer = null;
  };
  const fail = (cause: unknown) => {
    dispose();
    emit({
      status: "error",
      uri,
      error: cause instanceof Error ? cause : new Error(String(cause)),
    });
  };
  const publishScore = (score: ScoreRenderer) =>
    emit({
      status: "ready",
      uri,
      svg: score.currentSvg,
      currentPage: score.currentPage,
      pageCount: score.pageCount,
      appliedOptions: score.options,
      generation: score.generation,
      mei: score.getMei(),
      timemap: score.getTimemap(),
    });
  const navigate = (action: (score: ScoreRenderer) => void) => {
    if (!renderer) return;
    try {
      const generation = renderer.generation;
      action(renderer);
      if (generation !== renderer.generation) publishScore(renderer);
    } catch (error) {
      fail(error);
    }
  };
  const goToNote = (score: ScoreRenderer, target: string) => {
    const page = score.pageForElement(target);
    if (page > 0) score.renderPage(page);
    else console.warn("Note unavailable in score:", target);
  };
  const applyOptions = (score: ScoreRenderer) => {
    if (!equal(options, score.options)) score.setOptions(options);
  };
  const commands: ScoreCommands = {
    load(nextUri, nextOptions) {
      dispose();
      uri = nextUri;
      options = nextOptions;
      pendingTarget = null;
      const controller = new AbortController();
      request = controller;
      emit({ status: "loading", uri });
      void (async () => {
        try {
          const response = await fetch(nextUri, {
            mode: "cors",
            signal: controller.signal,
          });
          if (!response.ok)
            throw new Error(`Could not load score: HTTP ${response.status}`);
          const mei = await response.text();
          if (controller.signal.aborted || request !== controller) return;
          // Construct only after data arrives; options may have changed during fetch.
          const score = new ScoreRenderer();
          renderer = score;
          score.load(mei, options);
          if (pendingTarget) goToNote(score, pendingTarget);
          pendingTarget = null;
          publishScore(score);
        } catch (error) {
          if (!controller.signal.aborted && request === controller) fail(error);
        }
      })();
    },
    setOptions(nextOptions) {
      options = nextOptions;
      navigate(applyOptions);
    },
    applyModeChange(nextOptions, targetNote) {
      options = nextOptions;
      pendingTarget = renderer ? null : targetNote;
      navigate((score) => {
        applyOptions(score);
        if (targetNote) goToNote(score, targetNote);
      });
    },
    nextPage: () => navigate((score) => score.nextPage()),
    prevPage: () => navigate((score) => score.prevPage()),
    goToPage: (page) => navigate((score) => score.renderPage(page)),
    goToNote: (target) => navigate((score) => goToNote(score, target)),
    reportRenderFailure(reported, error) {
      if (snapshot === reported) fail(error);
    },
  };
  return { commands, dispose };
}

export function ScoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ScoreState>({ status: "idle", uri: "" });
  const [session] = useState(() => createSession(setState));
  useEffect(() => () => session.dispose(), [session]);
  return (
    <ScoreCommandsContext.Provider value={session.commands}>
      <ScoreStateContext.Provider value={state}>
        {children}
      </ScoreStateContext.Provider>
    </ScoreCommandsContext.Provider>
  );
}

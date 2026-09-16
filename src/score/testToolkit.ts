import { VerovioOptions, VerovioRuntime } from "./ScoreRenderer";

export function fakeToolkit() {
  let options: VerovioOptions = {};
  return {
    setOptions: jest.fn((value: VerovioOptions) => {
      options = value;
    }),
    loadData: jest.fn(() => true),
    redoLayout: jest.fn(),
    getPageCount: jest.fn(() => 3),
    renderToSVG: jest.fn(
      (page: number) =>
        `<svg data-page="${page}" data-layout="${options.breaks || "encoded"}"><g class="note" id="note-${page}"/></svg>`,
    ),
    getPageWithElement: jest.fn((id: string) => (id === "absent" ? 0 : 2)),
    getMEI: jest.fn(
      () =>
        '<mei><staff xml:id="staff-1" n="1"><layer xml:id="layer-1" n="1"><note xml:id="note-1" pname="c" oct="4"/></layer></staff></mei>',
    ),
    renderToTimemap: jest.fn(() => [{ qstamp: 0, tstamp: 0, on: ["note-1"] }]),
    destroy: jest.fn(),
  };
}

export function setRuntime(runtime?: VerovioRuntime) {
  Object.defineProperty(globalThis, "verovio", {
    configurable: true,
    writable: true,
    value: runtime,
  });
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function fetchMei() {
  return jest.fn(
    async () => ({ ok: true, text: async () => "mei" }) as Response,
  );
}

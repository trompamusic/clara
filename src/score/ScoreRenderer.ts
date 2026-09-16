export type VerovioOptions = Record<
  string,
  string | number | boolean | string[]
>;

export interface TimemapEntry {
  qstamp: number;
  tstamp: number;
  on?: string[];
  off?: string[];
}

export interface VerovioToolkit {
  setOptions(options: VerovioOptions): void;
  loadData(mei: string): boolean;
  redoLayout(): void;
  getPageCount(): number;
  renderToSVG(page: number): string;
  getPageWithElement(id: string): number;
  getMEI(): string;
  renderToTimemap(): TimemapEntry[];
  destroy?(): void;
}

export interface VerovioRuntime {
  toolkit: new () => VerovioToolkit;
}

function createDefaultToolkit(): VerovioToolkit {
  const runtime = (
    globalThis as typeof globalThis & { verovio?: VerovioRuntime }
  ).verovio;
  if (typeof runtime?.toolkit !== "function") {
    throw new Error("Verovio runtime is unavailable");
  }
  return new runtime.toolkit();
}

export class ScoreRenderer {
  private readonly toolkit: VerovioToolkit;
  private disposed = false;
  private loaded = false;
  private svg = "";
  private page = 0;
  private pages = 0;
  private revision = 0;
  private mei = "";
  private timemap: TimemapEntry[] = [];
  private appliedOptions: VerovioOptions = {};

  constructor(toolkit?: VerovioToolkit) {
    this.toolkit = toolkit ?? createDefaultToolkit();
  }

  // Loading and rendering are synchronous; the view owns fetching/cancellation.
  load(mei: string, options: VerovioOptions): void {
    if (this.disposed) throw new Error("ScoreRenderer has been disposed");
    this.toolkit.setOptions(options);
    this.appliedOptions = options;
    if (!this.toolkit.loadData(mei))
      throw new Error("Verovio could not parse the score");
    this.pages = this.toolkit.getPageCount();
    this.mei = this.toolkit.getMEI();
    this.timemap = this.toolkit.renderToTimemap();
    this.loaded = true;
    this.renderPage(1);
  }

  setOptions(options: VerovioOptions): void {
    this.assertLoaded();
    this.toolkit.setOptions(options);
    this.toolkit.redoLayout();
    this.appliedOptions = options;
    this.pages = this.toolkit.getPageCount();
    this.renderPage(this.page);
  }

  renderPage(n: number): void {
    this.assertLoaded();
    if (this.pages < 1 || !Number.isFinite(n))
      throw new Error("Invalid score page");
    const page = Math.max(1, Math.min(this.pages, Math.trunc(n)));
    const svg = this.toolkit.renderToSVG(page);
    if (!svg) throw new Error("Verovio could not render the score");
    this.svg = svg;
    this.page = page;
    this.revision += 1;
  }

  nextPage(): void {
    this.assertLoaded();
    if (this.page < this.pages) this.renderPage(this.page + 1);
  }

  prevPage(): void {
    this.assertLoaded();
    if (this.page > 1) this.renderPage(this.page - 1);
  }

  pageForElement(target: string): number {
    this.assertLoaded();
    const id = target.split("#").pop();
    return id ? this.toolkit.getPageWithElement(id) : 0;
  }

  get options(): VerovioOptions {
    return this.appliedOptions;
  }
  get currentSvg(): string {
    return this.svg;
  }
  get currentPage(): number {
    return this.page;
  }
  get pageCount(): number {
    return this.pages;
  }
  get generation(): number {
    return this.revision;
  }
  getMei(): string {
    this.assertLoaded();
    return this.mei;
  }
  getTimemap(): TimemapEntry[] {
    this.assertLoaded();
    return this.timemap;
  }

  private assertLoaded(): void {
    if (this.disposed) throw new Error("ScoreRenderer has been disposed");
    if (!this.loaded) throw new Error("No score loaded");
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (typeof this.toolkit.destroy === "function") this.toolkit.destroy();
  }
}

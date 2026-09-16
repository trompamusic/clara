/** @jest-environment node */
import { ScoreRenderer } from "./ScoreRenderer";
import { fakeToolkit } from "./testToolkit";

function loaded() {
  const toolkit = fakeToolkit();
  const renderer = new ScoreRenderer(toolkit);
  renderer.load("mei", {});
  return { toolkit, renderer };
}

test("paging clamps and boundary navigation neither calls Verovio nor increments generation", () => {
  const { renderer, toolkit } = loaded();
  renderer.prevPage();
  expect(toolkit.renderToSVG).toHaveBeenCalledTimes(1);
  expect(renderer.generation).toBe(1);
  renderer.nextPage();
  expect(renderer.currentPage).toBe(2);
  renderer.renderPage(100);
  renderer.nextPage();
  expect(renderer.currentPage).toBe(3);
  expect(renderer.generation).toBe(3);
  renderer.renderPage(-10);
  expect(renderer.currentPage).toBe(1);
  expect(renderer.currentSvg).toContain('data-page="1"');
});

test("relayout re-reads page count, clamps the page, and retains cached MEI/timemap", () => {
  const { renderer, toolkit } = loaded();
  const mei = renderer.getMei(),
    timemap = renderer.getTimemap();
  renderer.renderPage(3);
  toolkit.getPageCount.mockReturnValue(1);
  renderer.setOptions({ breaks: "line" });
  expect(renderer.pageCount).toBe(1);
  expect(renderer.currentPage).toBe(1);
  expect(renderer.generation).toBe(3);
  expect(renderer.getMei()).toBe(mei);
  expect(renderer.getTimemap()).toBe(timemap);
  expect(toolkit.getMEI).toHaveBeenCalledTimes(1);
  expect(toolkit.renderToTimemap).toHaveBeenCalledTimes(1);
});

test.each(["note", "#note", "https://score#note"])(
  "normalizes %s for note lookup",
  (target) => {
    const { renderer, toolkit } = loaded();
    expect(renderer.pageForElement(target)).toBe(2);
    expect(toolkit.getPageWithElement).toHaveBeenCalledWith("note");
    expect(renderer.pageForElement("absent")).toBe(0);
  },
);

test("falsy loadData and rendering/layout failures propagate", () => {
  const { renderer, toolkit } = loaded();
  toolkit.loadData.mockReturnValue(false);
  expect(() => renderer.load("bad mei", {})).toThrow("parse");
  toolkit.renderToSVG.mockReturnValue("");
  expect(() => renderer.nextPage()).toThrow("render");
  toolkit.setOptions.mockImplementation(() => {
    throw new Error("options failed");
  });
  expect(() => renderer.setOptions({})).toThrow("options failed");
});

test("dispose destroys once and prevents further toolkit calls", () => {
  const { renderer, toolkit } = loaded();
  renderer.dispose();
  renderer.dispose();
  toolkit.loadData.mockClear();
  toolkit.renderToSVG.mockClear();
  for (const operation of [
    () => renderer.load("mei", {}),
    () => renderer.setOptions({}),
    () => renderer.renderPage(1),
    () => renderer.nextPage(),
    () => renderer.prevPage(),
    () => renderer.pageForElement("note"),
    () => renderer.getMei(),
    () => renderer.getTimemap(),
  ]) {
    expect(operation).toThrow("ScoreRenderer has been disposed");
  }
  expect(toolkit.destroy).toHaveBeenCalledTimes(1);
  expect(toolkit.loadData).not.toHaveBeenCalled();
  expect(toolkit.renderToSVG).not.toHaveBeenCalled();
});

test("score operations reject use before load", () => {
  const toolkit = fakeToolkit();
  const renderer = new ScoreRenderer(toolkit);
  for (const operation of [
    () => renderer.setOptions({}),
    () => renderer.renderPage(1),
    () => renderer.nextPage(),
    () => renderer.prevPage(),
    () => renderer.pageForElement("note"),
    () => renderer.getMei(),
    () => renderer.getTimemap(),
  ]) {
    expect(operation).toThrow("No score loaded");
  }
  expect(toolkit.setOptions).not.toHaveBeenCalled();
  expect(toolkit.renderToSVG).not.toHaveBeenCalled();
  expect(toolkit.getPageWithElement).not.toHaveBeenCalled();
  renderer.load("mei", {});
  expect(renderer.currentPage).toBe(1);
});

test("dispose tolerates runtimes without destroy", () => {
  const renderer = new ScoreRenderer({ ...fakeToolkit(), destroy: undefined });
  expect(() => renderer.dispose()).not.toThrow();
});

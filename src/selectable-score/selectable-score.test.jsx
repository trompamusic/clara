/* global jest, test, expect, require */
import React from "react";
import { render } from "@testing-library/react";
import SelectableScore from "./selectable-score";

jest.mock("react-redux", () => ({ connect: () => (component) => component }));
jest.mock("meld-clients-core/lib/actions/index", () => ({}));
jest.mock("@inrupt/solid-client-authn-browser", () => ({ fetch: jest.fn() }));
jest.mock("dragselect/dist/DragSelect", () => jest.fn());
jest.mock("meld-clients-core/lib/containers/score", () => {
  const React = require("react");
  return React.forwardRef(function MockScore({ uri }, ref) {
    return (
      <div ref={ref}>
        <div className="score">{uri === "ready" && <svg />}</div>
      </div>
    );
  });
});

test.each(["ready", "pending"])(
  "announces score readiness once when initially %s",
  (uri) => {
    const onScoreReady = jest.fn();
    const props = {
      score: { SVG: { ready: {} }, vrvTk: {} },
      selectorString: "",
      onScoreReady,
    };
    const view = render(<SelectableScore {...props} uri={uri} />);
    expect(onScoreReady).toHaveBeenCalledTimes(uri === "ready" ? 1 : 0);

    view.rerender(<SelectableScore {...props} uri="ready" />);
    expect(onScoreReady).toHaveBeenCalledTimes(1);
    expect(onScoreReady.mock.calls[0][0].tagName.toLowerCase()).toBe("svg");

    view.rerender(<SelectableScore {...props} uri="ready" />);
    expect(onScoreReady).toHaveBeenCalledTimes(1);
  },
);

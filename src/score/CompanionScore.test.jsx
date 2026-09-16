/* eslint-env jest, node */
import React, { createRef } from "react";
import {
  ScoreProvider,
  useScoreState,
  useScoreCommands,
} from "./ScoreProvider";
import { act, render, waitFor } from "@testing-library/react";
import { Companion } from "../containers/companion/Companion";
import { fakeToolkit, fetchMei, setRuntime } from "./testToolkit";

jest.mock("meld-clients-core/lib/actions/index", () => ({}));
jest.mock("../containers/companion/MidiPlayer", () => ({
  MidiPlayer: () => null,
}));
jest.mock("../containers/companion/AuthenticatedMediaPlayer", () => () => null);

const mockMounts = [];
jest.mock("../containers/companion/FeatureVis", () => {
  const React = require("react");
  return class VisualizationProbe extends React.Component {
    componentDidMount() {
      mockMounts.push({
        layout: this.props.committedPage.appliedOptions.breaks,
        notes: Object.keys(this.props.committedPage.geometry.notes),
      });
    }
    render() {
      return <div data-testid="feature-vis" />;
    }
  };
});

// Exercise Companion's real score rendering and mode handlers without traversal.
class ScoreOnlyCompanion extends Companion {
  UNSAFE_componentWillMount() {}
  componentDidMount() {}
  componentDidUpdate() {
    this.syncScoreDom();
  }
  componentWillUnmount() {}
}

const originalBBox = SVGElement.prototype.getBBox;
const originalCTM = SVGElement.prototype.getScreenCTM;
beforeEach(() => {
  SVGElement.prototype.getBBox = () => ({ x: 10, y: 20, width: 5, height: 5 });
  SVGElement.prototype.getScreenCTM = () => ({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
  });
});
afterEach(() => {
  if (originalBBox) SVGElement.prototype.getBBox = originalBBox;
  else delete SVGElement.prototype.getBBox;
  if (originalCTM) SVGElement.prototype.getScreenCTM = originalCTM;
  else delete SVGElement.prototype.getScreenCTM;
  setRuntime();
  mockMounts.length = 0;
});

test("mode switches mount visualizations only after the new score layout commits", async () => {
  const toolkit = fakeToolkit();
  setRuntime({ toolkit: jest.fn(() => toolkit) });
  global.fetch = fetchMei();
  const ref = createRef();
  let commands;
  function Harness() {
    const scoreState = useScoreState();
    const scoreCommands = useScoreCommands();
    commands = scoreCommands;
    return (
      <ScoreOnlyCompanion
        scoreState={scoreState}
        scoreCommands={scoreCommands}
        ref={ref}
        uri="test-performance"
        graph={{}}
        traversalPool={{}}
        traverse={jest.fn()}
        registerTraversal={jest.fn()}
        setTraversalObjectives={jest.fn()}
        checkTraversalObjectives={jest.fn()}
        registerClock={jest.fn()}
        tickTimedResource={jest.fn()}
      />
    );
  }
  const view = render(
    <ScoreProvider>
      <Harness />
    </ScoreProvider>,
  );
  act(() => {
    ref.current.setState({ loading: false, currentScore: "score.mei" });
    commands.load("score.mei", ref.current.state.vrvOptions);
  });
  await waitFor(() => expect(ref.current.scoreReady).toBe(true));
  expect(mockMounts).toHaveLength(0);

  act(() => commands.goToPage(2));
  for (let visit = 1; visit <= 2; visit++) {
    act(() => ref.current.setModeFeatureVis());
    await waitFor(() => expect(mockMounts).toHaveLength(visit));
    expect(mockMounts[visit - 1]).toEqual({
      layout: "line",
      notes: ["note-2"],
    });
    expect(ref.current.props.scoreState.currentPage).toBe(2);
    act(() => ref.current.setModePageView());
    expect(ref.current.scoreReady).toBe(true);
    expect(view.queryByTestId("feature-vis")).toBeNull();
    expect(ref.current.props.scoreState.currentPage).toBe(2);
  }
});

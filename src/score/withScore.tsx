import React from "react";
import {
  ScoreState,
  ScoreCommands,
  useScoreState,
  useScoreCommands,
} from "./ScoreProvider";

export interface ScoreProps {
  scoreState: ScoreState;
  scoreCommands: ScoreCommands;
}
export default function withScore<P extends ScoreProps>(
  Component: React.ComponentType<P>,
) {
  return function WithScore(props: Omit<P, keyof ScoreProps>) {
    const scoreState = useScoreState();
    const scoreCommands = useScoreCommands();
    return (
      <Component
        {...(props as P)}
        scoreState={scoreState}
        scoreCommands={scoreCommands}
      />
    );
  };
}

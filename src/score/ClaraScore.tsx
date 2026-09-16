import React from "react";
import { useScoreState } from "./ScoreProvider";

export default function ClaraScore({
  mode,
}: {
  mode: "pageView" | "featureVis";
}) {
  const score = useScoreState();
  return (
    <div
      id={score.uri}
      className={`scorepane ${mode}`}
      data-score-status={score.status}
      aria-busy={score.status === "loading"}
    >
      {score.status === "loading" && <div role="status">Loading score…</div>}
      {score.status === "error" && (
        <div role="alert">Could not display score: {score.error.message}</div>
      )}
      <div
        className="score"
        dangerouslySetInnerHTML={{
          __html: score.status === "ready" ? score.svg : "",
        }}
      />
    </div>
  );
}

import React from "react";
import { useScoreState, useScoreCommands } from "./ScoreProvider";

interface PageControlsProps {
  following: boolean;
  mode: "pageView" | "featureVis";
}

export default function PageControls({ following, mode }: PageControlsProps) {
  const score = useScoreState();
  const { nextPage, prevPage } = useScoreCommands();
  const currentPage = score.status === "ready" ? score.currentPage : 0;
  const pageCount = score.status === "ready" ? score.pageCount : 0;
  const canNavigate = !following && pageCount > 0;

  return (
    <div
      id="pageControlsWrapper"
      className={`${mode} ${following ? "following" : ""}`.trim()}
    >
      {canNavigate && currentPage > 1 ? (
        <button
          type="button"
          className="selectable-score-prevPageButton"
          onClick={prevPage}
        >
          <img src="/static/prev.svg" alt="Previous page" />
        </button>
      ) : (
        <div />
      )}
      <span id="pageNum">
        {pageCount > 0 ? `Page ${currentPage} / ${pageCount}` : ""}
      </span>
      {canNavigate && currentPage < pageCount ? (
        <button
          type="button"
          className="selectable-score-nextPageButton"
          onClick={nextPage}
        >
          <img src="/static/next.svg" alt="Next page" />
        </button>
      ) : (
        <div />
      )}
    </div>
  );
}

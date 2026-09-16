import React from "react";

interface PageControlsProps {
  currentPage: number;
  pageCount: number;
  following: boolean;
  mode: "pageView" | "featureVis";
  onNextPage(): void;
  onPrevPage(): void;
}

export default function PageControls({
  currentPage,
  pageCount,
  following,
  mode,
  onNextPage,
  onPrevPage,
}: PageControlsProps) {
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
          onClick={onPrevPage}
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
          onClick={onNextPage}
        >
          <img src="/static/next.svg" alt="Next page" />
        </button>
      ) : (
        <div />
      )}
    </div>
  );
}

import React from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { scoreNextPageStatic } from "meld-clients-core/lib/actions/index";

const NextPageButton = ({
  uri,
  currentPage,
  pageCount,
  pageState,
  mei,
  buttonContent = "",
  scoreNextPageStatic: dispatchNextPage,
}) => {
  const handleClick = () => {
    console.log("[NextPageButton] click", {
      uri,
      currentPage,
      pageCount,
      pageState,
      hasMei: !!mei,
    });
    if (typeof currentPage !== "number") {
      console.warn("[NextPageButton] Missing currentPage for", uri);
      return;
    }
    if (!mei) {
      console.warn("[NextPageButton] Missing MEI data for", uri);
      return;
    }
    dispatchNextPage(uri, currentPage, mei);
  };

  if (
    pageState &&
    typeof pageState.currentPage === "number" &&
    typeof pageCount === "number" &&
    pageState.currentPage >= pageCount
  ) {
    console.debug("[NextPageButton] disabled - last page", {
      uri,
      pageState,
      pageCount,
    });
  }

  return (
    <div
      className="selectable-score-nextPageButton"
      role="button"
      onClick={handleClick}
    >
      {buttonContent}
    </div>
  );
};

function mapStateToProps(state, ownProps) {
  const score = state.score || {};
  const pageState = score.pageState || {};
  const meiMap = score.MEI || {};
  const currentScoreState =
    ownProps.uri && pageState[ownProps.uri]
      ? pageState[ownProps.uri]
      : undefined;

  return {
    currentPage:
      currentScoreState && typeof currentScoreState.currentPage === "number"
        ? currentScoreState.currentPage
        : undefined,
    pageCount:
      currentScoreState && typeof currentScoreState.pageCount === "number"
        ? currentScoreState.pageCount
        : undefined,
    pageState: currentScoreState,
    mei: ownProps.uri ? meiMap[ownProps.uri] : undefined,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      scoreNextPageStatic,
    },
    dispatch,
  );
}

export default connect(mapStateToProps, mapDispatchToProps)(NextPageButton);

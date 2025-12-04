import React from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { scorePrevPageStatic } from "meld-clients-core/lib/actions/index";

const PrevPageButton = ({
  uri,
  currentPage,
  pageCount,
  pageState,
  mei,
  buttonContent = "",
  scorePrevPageStatic: dispatchPrevPage,
}) => {
  const handleClick = () => {
    console.log("[PrevPageButton] click", {
      uri,
      currentPage,
      pageCount,
      pageState,
      hasMei: !!mei,
    });
    if (typeof currentPage !== "number") {
      console.warn("[PrevPageButton] Missing currentPage for", uri);
      return;
    }
    if (!mei) {
      console.warn("[PrevPageButton] Missing MEI data for", uri);
      return;
    }
    dispatchPrevPage(uri, currentPage, mei);
  };

  if (
    pageState &&
    typeof pageState.currentPage === "number" &&
    pageState.currentPage <= 1
  ) {
    console.debug("[PrevPageButton] disabled - first page", {
      uri,
      pageState,
    });
  }

  return (
    <div
      className="selectable-score-prevPageButton"
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
      scorePrevPageStatic,
    },
    dispatch,
  );
}

export default connect(mapStateToProps, mapDispatchToProps)(PrevPageButton);

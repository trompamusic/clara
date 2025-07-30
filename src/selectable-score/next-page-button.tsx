import React from "react";
import { connect } from "react-redux";
import { bindActionCreators, Dispatch } from "redux";
import { scoreNextPageStatic } from "meld-clients-core/lib/actions";
import {
  ScoreData,
  ScoreState,
  ScorePageProps,
  NextPageDispatchProps,
} from "./types";

type Props = ScorePageProps & { score: ScoreData } & NextPageDispatchProps;

const NextPageButton: React.FC<Props> = ({
  uri,
  buttonContent = "",
  score,
  scoreNextPageStatic,
}) => {
  const nextPage = () => {
    scoreNextPageStatic(uri, score.pageState[uri].currentPage, score.MEI[uri]);
  };

  return (
    <div className="selectable-score-nextPageButton" onClick={nextPage}>
      {buttonContent}
    </div>
  );
};

const mapStateToProps = (state: ScoreState) => ({
  score: state.score,
});

const mapDispatchToProps = (dispatch: Dispatch): NextPageDispatchProps =>
  bindActionCreators({ scoreNextPageStatic }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(NextPageButton);

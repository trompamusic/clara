import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators, Dispatch } from 'redux';
import { scorePrevPageStatic } from 'meld-clients-core/lib/actions/index';
import { ScoreData, ScoreState, ScorePageProps, PrevPageDispatchProps } from './types';

type Props = ScorePageProps & { score: ScoreData } & PrevPageDispatchProps;

const PrevPageButton: React.FC<Props> = ({ uri, buttonContent = "", score, scorePrevPageStatic }) => {
  const prevPage = () => {
    scorePrevPageStatic(
      uri,
      score.pageState[uri].currentPage,
      score.MEI[uri]
    );
  };

  return (
    <div className="selectable-score-prevPageButton" onClick={prevPage}>
      {buttonContent}
    </div>
  );
};

const mapStateToProps = (state: ScoreState) => ({
  score: state.score
});

const mapDispatchToProps = (dispatch: Dispatch): PrevPageDispatchProps =>
  bindActionCreators(
    { scorePrevPageStatic },
    dispatch
  );

export default connect(mapStateToProps, mapDispatchToProps)(PrevPageButton);
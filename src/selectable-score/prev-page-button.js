import React, { Component } from 'react';
import { connect } from 'react-redux' ;
import { bindActionCreators } from 'redux';
import { scorePrevPageStatic } from 'meld-clients-core/lib/actions/index';

class PrevPageButton extends Component { 
  constructor(props) { 
    super(props);
    this.prevPage = this.prevPage.bind(this);
  }

  prevPage() { 
    this.props.scorePrevPageStatic(this.props.uri, this.props.score.pageState[this.props.uri].currentPage, this.props.score.MEI[this.props.uri]);
  }
  
  render() { 
    const buttonContent = "buttonContent" in this.props 
      ? this.props.buttonContent
      : "";
    return(
      <div className="selectable-score-prevPageButton" onClick={this.prevPage}>
        { buttonContent }
      </div>
    )
  }
}

function mapStateToProps({ score }) {
  return { score }
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators( { 
    scorePrevPageStatic,
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(PrevPageButton);

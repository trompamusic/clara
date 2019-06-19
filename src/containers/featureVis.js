import React, { Component } from 'react';
import { connect } from 'react-redux' ;
import { bindActionCreators } from 'redux';

const {Raphael,Paper,Set,Circle,Ellipse,Image,Rect,Text,Path,Line} = require('react-raphael');

class FeatureVis extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      width: this.props.width || 100,
      height: this.props.height || 100
    }
  }
  componentDidUpdate(prevProps, prevState) { 
    // if we have loaded instances
    if(Object.keys(this.props.instantsByNoteId).length) { 
      const notes = this.props.notes;
      // for each timeline we need to visualise:
      this.props.timelinesToVis.map( (tl) => { 
        // find the instants coresponding to notes on this page
        const instantsOnPage = this.props.notesOnPage.forEach( (note) => { 
          console.log("Looking at note: ", note);
          return this.props.instantsByNoteId[tl][note.getAttribute("id")]
        })
        console.log("TL: ", tl, " Instants on page: ", instantsOnPage);
      })
    }
  }

  render() {
    return(
      <Paper width={ this.state.width } height={ this.state.height }>
        <Set>
          <Rect x={30} y={148} width={240} height={150} attr={{"fill":"#10a54a","stroke":"#f0c620","stroke-width":5}}/>
        </Set>
      </Paper>
    )
  }
}

function mapStateToProps({ graph }) {
  return { graph }
}

function mapDispatchToProps(dispatch) { 
  return bindActionCreators( { 
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(FeatureVis);

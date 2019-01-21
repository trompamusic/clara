import React, { Component } from 'react';
import ReactDOM from 'react-dom'
import { connect } from 'react-redux' ;
import { bindActionCreators } from 'redux';
import { Media, Player, controls, utils } from 'react-media-player'
const { PlayPause, CurrentTime, Progress, SeekBar, Duration, MuteUnmute, Volume, Fullscreen } = controls
const { formatTime } = utils

import Score from 'meld-clients-core/src/containers/score';
import { traverse, setTraversalObjectives, checkTraversalObjectives, scoreNextPageStatic, scorePrevPageStatic, scorePageToComponentTarget } from 'meld-clients-core/src/actions/index';
import { registerClock, tickTimedResource } from 'meld-clients-core/src/actions/index'

const scoreUri = "Beethoven_WoO80-32-Variationen-c-Moll.mei";
//const scoreUri = "test.mei"

const vrvOptions = {
	scale: 45,
	pageHeight: 1600,
	pageWidth: 2200,
	noFooter: 1,
	unit: 6 
};

class Variations extends Component {
  constructor(props) {
    super(props);
		// Following bindings required to make 'this' work in the callbacks
    this.state = { segments: [] }
		this.projectAnnotations = this.projectAnnotations.bind(this);
		this.handleSegmentSelected = this.handleSegmentSelected.bind(this);
  }

  componentWillMount() { 
    this.props.setTraversalObjectives([
      { "@type": "http://www.linkedmusic.org/ontologies/segment/Segment" }
    ]);
  }

  componentDidMount() { 
    this.props.traverse("variations.json", {numHops:0});
   }

  componentDidUpdate(prevProps, prevState) { 
    console.log('updating');
		if("graph" in prevProps) { 
			// check our traversal objectives if the graph has updated
			if(prevProps.graph.graph.length !== this.props.graph.graph.length) { 
				this.props.checkTraversalObjectives(this.props.graph.graph, this.props.graph.objectives);
			}
			if(prevProps.graph.outcomesHash !== this.props.graph.outcomesHash) { 
				// outcomes have changed, need to update our projections!
				this.projectAnnotations(this.props.graph.outcomes);
			}
		}
  }

  render() { 
    console.log("Segments now: ", this.state.segments);
    return(
      <div id="wrapper">
        <Score uri={ scoreUri } key = { scoreUri } options = { vrvOptions }/>
        <div id="prev" onClick={() => {
          this.props.scorePrevPageStatic(scoreUri, this.props.score.pageNum, this.props.score.MEI[scoreUri])
        }}> Previous </div>
        <div id="next" onClick={(e) => {
	  e.stopPropagation();
          this.props.scoreNextPageStatic(scoreUri, this.props.score.pageNum, this.props.score.MEI[scoreUri]); 
        }}> Next </div>
        <select name="segmentSelect" onChange={ this.handleSegmentSelected }>
          <option value="none">Select a segment...</option>
          { 
            this.state.segments.map( (seg) => { 
              return (
                <option key={ seg["@id"] } value={ seg["@id"] }>
                  { seg["http://www.w3.org/1999/02/22-rdf-syntax-ns#label"] }
                </option>
              )
            })
          }
       </select>
      </div>
    )
  }

  handleSegmentSelected(e) { 
    console.log("Selected: ", e.target.value);
    const selected = this.state.segments.filter( (seg) => { return seg["@id"] === e.target.value });
    const target = selected[0]["http://purl.org/vocab/frbr/core#embodiment"]["http://www.w3.org/1999/02/22-rdf-syntax-ns#member"]["@id"];
    this.props.scorePageToComponentTarget(target, scoreUri, this.props.score.MEI[scoreUri]);
  }

  projectAnnotations(outcomes) { 
    let segments = [];
    console.log("~~~OUTSIDE MAP ", outcomes[0]["@graph"]);
    outcomes[0]["@graph"].map( (outcome) => {
      // FIXME "targets" and "bodies" here should really be 
      // "fragments" and "payloads" or similar in the core reducer
      // TODO, think through and improve
      segments.push(outcome)
    })
    this.setState({ segments });
  }
}


function mapStateToProps({ score, graph }) {
  return { score, graph }
}

function mapDispatchToProps(dispatch) { 
  return bindActionCreators( { traverse, setTraversalObjectives, checkTraversalObjectives, scoreNextPageStatic, scorePrevPageStatic, scorePageToComponentTarget }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(Variations);

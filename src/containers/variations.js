import React, { Component } from 'react';
import ReactDOM from 'react-dom'
import { connect } from 'react-redux' ;
import { bindActionCreators } from 'redux';
import { Media, Player, controls, utils, withMediaProps } from 'react-media-player'
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
    this.state = { 
      performances: [], 
      segments: [], 
      selectedVideo: "",
      selectedPerformance: "",
      lastMediaTick: 0,
      currentPerfSegment: {},
      currentSegment: {},
      seekTo:""
    }
	// Following bindings required to make 'this' work in the callbacks
    this.processTraversalOutcomes = this.processTraversalOutcomes.bind(this);
    this.handleSegmentSelected = this.handleSegmentSelected.bind(this);
    this.handlePerformanceSelected = this.handlePerformanceSelected.bind(this);
    this.tick = this.tick.bind(this);
    this.findSegmentToSeekTo = this.findSegmentToSeekTo.bind(this);
  }

  componentWillMount() { 
    this.props.setTraversalObjectives([
      { "@type": "http://purl.org/ontology/mo/Performance" },
      { "@type": "http://www.linkedmusic.org/ontologies/segment/Segment" }
    ]);
  }

  componentDidMount() { 
    this.props.traverse("performance/BeethovenWettbewerb/WoO80.json", {
      numHops:2, 
      objectPrefixWhitelist:["http://localhost:8080/"],
      objectPrefixBlacklist:["http://localhost:8080/videos/", "http://localhost:8080/Beethoven_WoO80-32-Variationen-c-Moll.mei"]
    });
  }

  componentDidUpdate(prevProps, prevState) { 
		if("graph" in prevProps) { 
			// check our traversal objectives if the graph has updated
			if(prevProps.graph.graph.length !== this.props.graph.graph.length) { 
				this.props.checkTraversalObjectives(this.props.graph.graph, this.props.graph.objectives);
			}
			if(prevProps.graph.outcomesHash !== this.props.graph.outcomesHash) { 
				// outcomes have changed, need to update our projections!
				this.processTraversalOutcomes(this.props.graph.outcomes);
			}
		}
//    if("time" in this.state.seekTo && this.refs.media.src === this.state.seekTo["video"]) {
//      console.log("HELLO", this.state);
//      const time = this.state.seekTo.time; 
//      this.refs.media.seekTo(time);
//      this.setState({seekTo: {} })
//    }

  }

  render() { 
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
        <select name="segmentSelect" onChange={ this.handleSegmentSelected } ref='segmentSelect'>
          <option value="none">Select a segment...</option>
          { 
            this.state.segments.map( (seg) => { 
              return (
                <option key={ seg["@id"] } value={ seg["@id"] }>
                  { seg["http://www.w3.org/2000/01/rdf-schema#label"] }
                </option>
              )
            })
          }
       </select>
       <select name="perfSelect" onChange={ this.handlePerformanceSelected }>
        <option value="none">Select a rendition...</option>
        {
          this.state.performances.map( (perf) => { 
            return( 
              <option key={ perf["@id"] } value={ perf["@id"] }>
                { perf["http://www.w3.org/2000/01/rdf-schema#label"] }
              </option>
            )
          })
        }
      </select>
      <Media ref="media">
        <div className="media">
          <div className="media-player">
            <Player 
              autoPlay={true} 
              src={ this.state.selectedVideo } 
              onTimeUpdate={ (t) => {
                this.tick(this.state.selectedVideo, t)
              } }
              onPlay={ () => {
                if(this.state.seekTo) { 
                  this.refs.media.seekTo(this.state.seekTo);
                  this.setState({seekTo: ""});
                }
              } }
            />
          </div>
          <div className="media-controls">
            <PlayPause/>
            <CurrentTime/>
            <SeekBar/>
            <Duration/>
         </div>
       </div>
     </Media>
    </div>
    )
  }

  handleSegmentSelected(e) { 
    console.log("Segment selected: ", e.target);
    const selected = this.state.segments.filter( (seg) => { return seg["@id"] === e.target.value });
    const target = selected[0]["http://purl.org/vocab/frbr/core#embodiment"]["http://www.w3.org/2000/01/rdf-schema#member"]["@id"];
    this.props.scorePageToComponentTarget(target, scoreUri, this.props.score.MEI[scoreUri]);
    // if a video is selected, jump to the beginning of this segment in its performance timeline
    if(this.state.selectedPerformance)  {
      const timelineSegment = this.findSegmentToSeekTo(selected[0]);
      if(timelineSegment.length) { 
        const startTime = timelineSegment[0]["http://purl.org/NET/c4dm/timeline.owl#beginsAtDuration"].replace(/\D/g, '');
        console.log("Trying to seek to: ", startTime)
        this.refs.media.seekTo(startTime);
      }
    }
  }
  
  handlePerformanceSelected(e) { 
    console.log("Rendition selected: ", e.target);
    const selected = this.state.performances.filter( (perf) => { return perf["@id"] === e.target.value });
    const selectedVideo = selected[0]["http://purl.org/ontology/mo/recorded_as"]["http://purl.org/ontology/mo/available_as"]["@id"];
    const selectedPerformance = selected[0];
    this.setState({ selectedVideo, selectedPerformance });
		this.props.registerClock(selectedVideo);
    if("@id" in this.state.currentSegment) { 
      // set up a jump to the currently selected segment in this performance
      const timelineSegment = this.findSegmentToSeekTo(this.state.currentSegment, selectedPerformance);
      if(timelineSegment.length) {
        const startTime = timelineSegment[0]["http://purl.org/NET/c4dm/timeline.owl#beginsAtDuration"].replace(/\D/g, '');
        this.setState({ seekTo: startTime });
      }
    }
  }

  findSegmentToSeekTo(seg, selectedPerformance = this.state.selectedPerformance) { 
    console.log("Got segment: ", seg);
    console.log("Got performance: ", selectedPerformance);
    // find the time segment on the selected performance's timeline that corresponds to the
    // selected segment
    const timelineSegment = this.props.graph.outcomes[1]["@graph"].filter( (s) => { 
      const selectedTimeline = selectedPerformance["http://purl.org/ontology/mo/recorded_as"]["http://purl.org/ontology/mo/time"]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"];
      console.log("Selected timeline: ", selectedTimeline);
      if("http://purl.org/NET/c4dm/timeline.owl#onTimeLine" in s &&
         s["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"]===selectedTimeline &&
         s["http://purl.org/vocab/frbr/core#embodimentOf"]["@id"]===seg["@id"]) { 
        return seg;
      }
    })
    return timelineSegment;
  }
	
  tick(id,t) {
		if(Math.floor(t.currentTime) > this.state.lastMediaTick || // if we've progressed across the next second boundary, 
			 t.currentTime < this.state.lastMediaTick) { // OR if we've gone back in time (user did a seek)...
			this.setState({ lastMediaTick: Math.floor(t.currentTime) }); // keep track of this time tick)
			// dispatch a "TICK" action 
			// any time-sensitive component subscribes to it, 
			// triggering time-anchored annotations triggered as appropriate
			this.props.tickTimedResource(id, Math.floor(t.currentTime));
      if(this.state.selectedPerformance) { 
        const selectedTimeline = this.state.selectedPerformance["http://purl.org/ontology/mo/recorded_as"]["http://purl.org/ontology/mo/time"]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"];
        // find timeline segments associated with this timeline
        const timelineSegments = this.props.graph.outcomes[1]["@graph"].filter( (seg) => { 
          if("http://purl.org/NET/c4dm/timeline.owl#onTimeLine" in seg) { 
            return seg["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"] === selectedTimeline;
          }
        });
        // update current segment if we can find one
        const newSeg = timelineSegments.filter( (seg) => {
          if("http://purl.org/NET/c4dm/timeline.owl#beginsAtDuration" in seg &&
             "http://purl.org/NET/c4dm/timeline.owl#endsAtDuration" in seg &&
             seg["http://purl.org/NET/c4dm/timeline.owl#beginsAtDuration"].replace(/\D/g, '') <= t.currentTime &&
             seg["http://purl.org/NET/c4dm/timeline.owl#endsAtDuration"].replace(/\D/g, '') >= t.currentTime) { 
            // FIXME this should check and validate formatting of times
            return seg;
          }
        });
        // if we've found a new segment, and it's different to the current one
        // (or no current one exists yet)
        if(newSeg.length > 0 && (
            newSeg[0]["@id"] !== this.state.currentPerfSegment["@id"] ||
            !("@id" in this.state.currentPerfSegment)  
          )) {
          // we have found a matching timed segment, and it's different to the current one
          // FIXME this should check if multiple segments match
          const structSegment = newSeg[0]["http://purl.org/vocab/frbr/core#embodimentOf"]
          this.setState({ 
            currentPerfSegment:newSeg[0], 
            currentSegment: structSegment
           });
          this.refs.segmentSelect.value = structSegment["@id"];
          const target = structSegment["http://purl.org/vocab/frbr/core#embodiment"]["http://www.w3.org/2000/01/rdf-schema#member"]["@id"];;
          this.props.scorePageToComponentTarget(target, scoreUri, this.props.score.MEI[scoreUri]);
        }
      }
		}
	}

  processTraversalOutcomes(outcomes) { 
    let segments = [];
    let performances= [];
    if(outcomes.length === 2 && 
      typeof outcomes[0] !== 'undefined' && 
      typeof outcomes[1] !== 'undefined') { 
      outcomes[0]["@graph"].map( (outcome) => {
        performances.push(outcome)
      });
      outcomes[1]["@graph"].map( (outcome) => {
        const types = Array.isArray(outcome["@type"]) ? outcome["@type"] : [outcome["@type"]];
        if(types.indexOf("http://purl.org/NET/c4dm/timeline.owl#Interval") === -1) { 
          // only add structural segments, not timeline segments (which are performance dependent...)
          segments.push(outcome)
        }
      });
      this.setState({ performances, segments });
    }
  }
}


function mapStateToProps({ score, graph }) {
  return { score, graph }
}

function mapDispatchToProps(dispatch) { 
  return bindActionCreators( { 
    traverse, 
    setTraversalObjectives, 
    checkTraversalObjectives, 
    scoreNextPageStatic, 
    scorePrevPageStatic, 
    scorePageToComponentTarget, 
    registerClock,
    tickTimedResource
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(Variations);

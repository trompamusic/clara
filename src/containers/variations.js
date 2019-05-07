import React, { Component } from 'react';
import ReactDOM from 'react-dom'
import { connect } from 'react-redux' ;
import { bindActionCreators } from 'redux';
import ReactPlayer from 'react-player'
//import { Media, Player, controls, utils, withMediaProps } from 'react-media-player'
//const { PlayPause, CurrentTime, Progress, SeekBar, Duration, MuteUnmute, Volume, Fullscreen } = controls
//const { formatTime } = utils

import Score from 'meld-clients-core/src/containers/score';
import { traverse, setTraversalObjectives, checkTraversalObjectives, scoreNextPageStatic, scorePrevPageStatic, scorePageToComponentTarget } from 'meld-clients-core/src/actions/index';
import { registerClock, tickTimedResource } from 'meld-clients-core/src/actions/index'

const scoreUri = "Beethoven_WoO80-32-Variationen-c-Moll.mei";

const vrvOptions = {
	scale: 45,
	pageHeight: 1080,
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
      instants: [],
      instantsByPerfTime: [],
      selectedVideo: "",
      selectedPerformance: "",
      lastMediaTick: 0,
      currentPerfSegment: {},
      currentSegment: {},
      seekTo:"",
      videoOffset: 0 // in seconds
    }
	// Following bindings required to make 'this' work in the callbacks
    this.processTraversalOutcomes = this.processTraversalOutcomes.bind(this);
    this.handleSegmentSelected = this.handleSegmentSelected.bind(this);
    this.handlePerformanceSelected = this.handlePerformanceSelected.bind(this);
    this.tick = this.tick.bind(this);
    this.findInstantToSeekTo = this.findInstantToSeekTo.bind(this);
  }

  componentWillMount() { 
    this.props.setTraversalObjectives([
      { "@type": "http://purl.org/ontology/mo/Performance" },
      { "@type": "http://www.linkedmusic.org/ontologies/segment/Segment" },
      { "@type": "http://purl.org/NET/c4dm/timeline.owl#Instant" }
    ]);
  }

  componentDidMount() { 
    this.props.traverse("performance/BeethovenWettbewerb/WoO80-all.json", {
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
  }

  ref = player => {
    this.player = player
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
                  { seg["http://www.w3.org/2000/01/rdf-schema#label"] || seg["@id"].substring(seg["@id"].lastIndexOf("-") +1) }
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
        <ReactPlayer 
          playing
          ref={this.ref}
          url={ this.state.selectedVideo }
          progressInterval = { 10 } // update rate in milliseconds 
          controls={ true }
          onProgress={ (p) => {
            this.tick(this.state.selectedVideo, p["playedSeconds"])
          }}
//         onPlay={ () => {
//           if(this.state.seekTo) { 
//             console.log("Render loop onPlay: seeking to ", this.state.seekTo);
//             this.player.seekTo(this.state.seekTo);
//             this.setState({seekTo: ""});
//           }
//         }}
          onReady={ () => {
            if(this.state.seekTo) { 
              console.log("Render loop onReady: seeking to ", this.state.seekTo);
              this.player.seekTo(this.state.seekTo);
              this.setState({seekTo: ""});
            }
          }}
        />
      </div>
    )
  }

  handleSegmentSelected(e) { 
    const selected = this.state.segments.filter( (seg) => { return seg["@id"] === e.target.value });
    const target = selected[0]["http://purl.org/vocab/frbr/core#embodiment"]["http://www.w3.org/2000/01/rdf-schema#member"]["@id"];
    this.props.scorePageToComponentTarget(target, scoreUri, this.props.score.MEI[scoreUri]);
    // if a video is selected, jump to the beginning of this segment in its performance timeline
    if(this.state.selectedPerformance)  {
      const timelineSegment = this.findInstantToSeekTo(selected[0]);
      console.log("timelineSegment: ", timelineSegment)
      if(timelineSegment.length) { 
        const dur = timelineSegment[0]["http://purl.org/NET/c4dm/timeline.owl#atDuration"];
        let startTime = parseFloat(dur.substr(1, dur.length-2));
        // HACK: Offsets should be incorporated into data model through timeline maps
        startTime += parseFloat(this.state.selectedPerformance["https://meld.linkedmusic.org/terms/offset"]);  
        console.log("Trying to seek to: ", startTime, parseFloat(this.state.selectedPerformance["https://meld.linkedmusic.org/terms/offset"]));
        this.player.seekTo(startTime);
        this.setState({currentSegment: selected[0]}); 
      }
    }
  }
  
  handlePerformanceSelected(e) { 
    console.log("Rendition selected: ", e.target);
    const selected = this.state.performances.filter( (perf) => { return perf["@id"] === e.target.value });
    const selectedVideo = selected[0]["http://purl.org/ontology/mo/recorded_as"]["http://purl.org/ontology/mo/available_as"]["@id"];
    const selectedPerformance = selected[0];
		this.props.registerClock(selectedVideo);
    let newState = { selectedVideo, selectedPerformance };
    if("@id" in this.state.currentSegment) { 
      // set up a jump to the currently selected segment in this performance
      const timelineSegment = this.findInstantToSeekTo(this.state.currentSegment, selectedPerformance);
      if(timelineSegment.length) {
        const dur = timelineSegment[0]["http://purl.org/NET/c4dm/timeline.owl#atDuration"];
        let startTime = parseFloat(dur.substr(1, dur.length-2));
        startTime += parseFloat(selectedPerformance["https://meld.linkedmusic.org/terms/offset"]);  
        newState["seekTo"] = startTime;
      }
    }
    this.setState(newState);
  }

  findInstantToSeekTo(segment, selectedPerformance = this.state.selectedPerformance) { 
    const selectedTimeline = selectedPerformance["http://purl.org/ontology/mo/recorded_as"]["http://purl.org/ontology/mo/time"]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"];
    // find the time instant on the selected performance's timeline that corresponds to the
    // selected segment
    const timelineSegment = this.props.graph.outcomes[2]["@graph"].filter( (i) => { 
      if(!("http://purl.org/NET/c4dm/timeline.owl#onTimeLine" in i) || 
         i["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"]!==selectedTimeline) { 
        return false;
      }
      let segNotes = [];
        // do any of our instant's note embodiments match one of the segment's note embodiments?
      segNotes = segment["http://purl.org/vocab/frbr/core#embodiment"]["https://meld.linkedmusic.org/terms/notes"].filter( (segNote) => {
        // ensure array (in chords, one timeline instance maps to multiple note instances)
        i["http://purl.org/vocab/frbr/core#embodimentOf"] = Array.isArray(i["http://purl.org/vocab/frbr/core#embodimentOf"]) ? 
          i["http://purl.org/vocab/frbr/core#embodimentOf"] :
          [ i["http://purl.org/vocab/frbr/core#embodimentOf"] ] 
        const embodimentFound = i["http://purl.org/vocab/frbr/core#embodimentOf"].filter( (e) => {
          return e["@id"] === segNote["@id"]
        })
        return embodimentFound.length // true if we found a matching embodiment
      })
      return segNotes.length; // true if we found a matching instance
    })
    // returned them in chronological order
    const sorted = timelineSegment.sort( (a, b) => { 
      let aDur = a["http://purl.org/NET/c4dm/timeline.owl#atDuration"]
      let bDur = b["http://purl.org/NET/c4dm/timeline.owl#atDuration"]
      return parseFloat(aDur.substr(1, aDur.length-2)) - parseFloat(bDur.substr(1, bDur.length-2))
    })
    console.log("timelineSegment: ", timelineSegment, "sorted: ", sorted);
    return sorted;
  }
	
  tick(id,t) {
    if(!("@id" in this.state.currentSegment)) { 
      return // ignore unless segment selected
    }
    t += this.state.videoOffset;
		if(t > this.state.lastMediaTick || // if we've progressed across the next second boundary, 
			 t < this.state.lastMediaTick) { // OR if we've gone back in time (user did a seek)...
			let newState = { lastMediaTick: t }; // keep track of this time tick)
			// dispatch a "TICK" action 
			// any time-sensitive component subscribes to it, 
			// triggering time-anchored annotations triggered as appropriate
			this.props.tickTimedResource(id, t);
      if(this.state.selectedPerformance) { 
        // find closest corresponding instant on this timeline
        const thisTimeline = this.state.selectedPerformance["http://purl.org/ontology/mo/recorded_as"]["http://purl.org/ontology/mo/time"]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"];
        const thisOffset = this.state.selectedPerformance["https://meld.linkedmusic.org/terms/offset"]
        let closestInstantIx = this.state.instantsByPerfTime[thisTimeline].findIndex( (i) => { 
          let dur = i["http://purl.org/NET/c4dm/timeline.owl#atDuration"];
          dur = dur.substr(1, dur.length-2);
          return parseFloat(dur) + parseFloat(thisOffset) > t;
        });
        console.log("Got closest instant IX: ", closestInstantIx, " lastMediaTick: ", this.state.lastMediaTick);
        // if we're at 0 use that, otherwise use the one before this one 
        // (i.e., closest without going over)
        closestInstantIx = closestInstantIx===0 ? closestInstantIx : closestInstantIx - 1;
        let currentNotes = this.state.instantsByPerfTime[thisTimeline][closestInstantIx]["http://purl.org/vocab/frbr/core#embodimentOf"];
        // handle array (instant might correspond to chord or multiple voices...)
        currentNotes = Array.isArray(currentNotes) ? currentNotes : [currentNotes];
        // clear any pre-existing active notes
        const previouslyActive = document.getElementsByClassName("active")
        Array.from(previouslyActive).map( (n) => { n.classList.remove("active") });
        let currentNoteElement;
        let currentMeasure;
        let noteToFlipTo;
        currentNotes.map( (n) => { 
          const currentNoteId =n["@id"].substr(n["@id"].lastIndexOf("#")+1);
        // highlight the current note if on current page
          currentNoteElement = document.getElementById(currentNoteId);
          if(currentNoteElement) { 
            currentNoteElement.classList.add("active");
            currentMeasure = currentNoteElement.closest(".measure")
          } else if(currentNoteId === "inserted_state") { 
            // oops! wrong note played (according to MAPS at least)
            // visualise this by CSS animation on the (most recent) measure (assuming we have one)
              console.log("Inserted state detected at noteID: ", currentNoteId);
              document.querySelector("svg").classList.add("errorDetected");
              // and clear the animation a second later (so that we can punish the next pianist that gets this meausure wrong!)
              setTimeout( () => { 
                document.querySelector("svg").classList.remove("errorDetected") 
              }, 1000); 
          } else { 
            // note not on this page; so we'll need to flip to it
            noteToFlipTo = n;
          }
        })
        if(noteToFlipTo && closestInstantIx > 0) { 
          // a note wasn't on this page -- so flip to its page
          // (closestInstantIx > 0 to avoid flipping to first page each time we swap performance)
          console.log("Asking Score to flip to: ", noteToFlipTo);
          this.props.scorePageToComponentTarget(noteToFlipTo["@id"], scoreUri, this.props.score.MEI[scoreUri]);
        } else if(currentNoteElement) { 
          // check whether we're in a new section segment
          // BUT, Verovio doesn't include sections in the hierarchy of its output
          // Instead it uses "milestones" on the measure level
          // So, follow siblings backwards from the current measure until we hit a section
          // start point
          let sibling = currentMeasure.previousElementSibling;
          while(sibling) { 
            if(sibling.matches(".section")) { 
              break;
            }
            sibling = sibling.previousElementSibling;
          }
          //console.log("Found section: ", sibling, " measure: ", currentMeasure, " note: ", currentNoteElement);
          const sectionId = sibling ? sibling.getAttribute("id") : "";
        //  console.log("Note: ", currentNoteElement,  "Measure: ", currentMeasure, " Section ID: ", sectionId);
          if(sectionId && sectionId  !== this.state.currentSegment["@id"].substr(this.state.currentSegment["@id"].lastIndexOf("#") + 1)) { 
            // we've entered a new section (segment)
            // find the corresponding segment in our outcomes
            const newSeg = this.props.graph.outcomes[1]["@graph"].filter( (s) => {
              return s["@id"].substr(s["@id"].lastIndexOf("#")+1) === sectionId
            });
            if(newSeg.length === 0) { console.log("WARNING: Cannot find segment corresponding to section ", sectionId, " of note", currentNoteElement) }
            else if(newSeg.length > 1) { console.log("WARNING: Duplicate segment found corresponding to section ", sectionId, " of note ", currentNoteElement) }
            if(newSeg.length) { 
              console.log("SETTING TO: ", newSeg[0]);
              // update selection box
              this.refs.segmentSelect.value = newSeg[0]["@id"];
              // update state
              newState["currentSegment"] = newSeg[0];
            }
          }
        } 
      }
      this.setState(newState);
		}
	}

  processTraversalOutcomes(outcomes) { 
    let segments = [];
    let performances= [];
    let instants = [];
    let instantsByPerfTime = {};
    if(outcomes.length === 3 && 
      typeof outcomes[0] !== 'undefined' && 
      typeof outcomes[1] !== 'undefined' &&
      typeof outcomes[2] !== 'undefined') { 
      outcomes[0]["@graph"].map( (outcome) => {
        performances.push(outcome)
      });
      outcomes[1]["@graph"].map( (outcome) => {
        segments.push(outcome)
      });
      segments = segments.sort( (a, b) => { 
        return parseInt(a["https://meld.linkedmusic.org/terms/order"]) - parseInt(b["https://meld.linkedmusic.org/terms/order"])
      })
      console.log("Sorted segments: ", segments)
      outcomes[2]["@graph"].map( (outcome) => {
        instants.push(outcome)
        if(outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"] in instantsByPerfTime) {
          instantsByPerfTime[outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"]].push(outcome)
        } else { 
          instantsByPerfTime[outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"]] = [outcome]
        }
      });
      Object.keys(instantsByPerfTime).map( (tl) => { 
        // order the instances along each timeline
        instantsByPerfTime[tl] = instantsByPerfTime[tl].sort( (a, b) => { 
          let aDur = a["http://purl.org/NET/c4dm/timeline.owl#atDuration"];
          let bDur = b["http://purl.org/NET/c4dm/timeline.owl#atDuration"];
          return parseFloat(aDur.substr(1, aDur.length-2)) - parseFloat(bDur.substr(1, bDur.length-2))
        })
      })
      this.setState({ performances, segments, instants, instantsByPerfTime });
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

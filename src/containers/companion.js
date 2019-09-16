import React, { Component } from 'react';
import ReactDOM from 'react-dom'
import { connect } from 'react-redux' ;
import { bindActionCreators } from 'redux';
import ReactPlayer from 'react-player'
//import { Media, Player, controls, utils, withMediaProps } from 'react-media-player'
//const { PlayPause, CurrentTime, Progress, SeekBar, Duration, MuteUnmute, Volume, Fullscreen } = controls
//const { formatTime } = utils

import Score from 'meld-clients-core/src/containers/score';
import { traverse, registerTraversal, setTraversalObjectives, checkTraversalObjectives, scoreNextPageStatic, scorePrevPageStatic, scorePageToComponentTarget, fetchScore } from 'meld-clients-core/src/actions/index';
import { registerClock, tickTimedResource } from 'meld-clients-core/src/actions/index'


const vrvOptions = {
	scale: 45,
  adjustPageHeight: 1,
	pageHeight: 1080,
	pageWidth: 2200,
	noFooter: 1,
	unit: 6
};

class Companion extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      performances: [], 
      segments: [], 
      instants: [],
      instantsByPerfTime: [],
      instantsByNoteId: [],
      selectedVideo: "",
      selectedPerformance: "",
      lastMediaTick: 0,
      previouslyActive: [],
      currentPerfSegment: {},
      currentSegment: {},
      currentScore: "",
      seekTo:"",
      videoOffset: 0, // in seconds
      progressInterval: 1, // of video playback (callback rate), in milliseconds
      activeWindow: .1, // window of notes before current instant considered active, in seconds 
      traversalThreshold: 20, // max parallel traversal threads,
      loading: true, // flip when traversals are completed
      scoreFollowing: true, // if true, page automatically with playback 
      showConfidence: false, // if true, visualise MAPS confidence per instant
      showVelocities: true, // if true, visualise note velocities
      showInsertedDeleted: true, // if true, visualise note insertions and deletions
      minMappedVelocity: 0, // minimum opacity (when note played at smallest expected velocity
      maxMappedVelocity: 255, // max opacity (when note played at largest expected velocity)
      minExpectedVel: 0, // guesstimate as to a note played at pianissimo (unit: midi velocity)
      maxExpectedVel: 110 // guesstimate as to a note played at fortissimo (unit: midi velocity)
    }
	// Following bindings required to make 'this' work in the callbacks
    this.processTraversalOutcomes = this.processTraversalOutcomes.bind(this);
    this.handleSegmentSelected = this.handleSegmentSelected.bind(this);
    this.handlePerformanceSelected = this.handlePerformanceSelected.bind(this);
    this.tick = this.tick.bind(this);
    this.findInstantToSeekTo = this.findInstantToSeekTo.bind(this);
    this.assignClickHandlersToNotes = this.assignClickHandlersToNotes.bind(this);
    this.createInstantBoundingRects = this.createInstantBoundingRects.bind(this);
    this.highlightDeletedNotes = this.highlightDeletedNotes.bind(this);
    this.monitorKeys= this.monitorKeys.bind(this);
    this.mapVelocity = this.mapVelocity.bind(this);
    this.ensureArray = this.ensureArray.bind(this);
  }

  componentWillMount() { 
    this.props.setTraversalObjectives([
      { "@type": "http://purl.org/ontology/mo/Performance" },
      { "@type": "http://www.linkedmusic.org/ontologies/segment/Segment" },
      { "@type": "http://purl.org/NET/c4dm/timeline.owl#Instant" }
    ]);
  }

  componentDidMount() { 
    this.props.registerTraversal(this.props.uri, {
      numHops:5, 
      objectPrefixWhitelist:["http://localhost:8080/", "http://localhost:4000"],
      objectPrefixBlacklist:[
        "http://localhost:8080/videos/", 
        "http://localhost:8080/Beethoven_Op126Nr3.mei", 
        "http://localhost:8080/Beethoven_WoO80-32-Variationen-c-Moll.mei",
        "http://localhost:8080/Beethoven_Op126Nr3#"
      ]
    });
    document.addEventListener('keydown', this.monitorKeys);
  }

  componentDidUpdate(prevProps, prevState) { 
    if("traversalPool" in this.props && Object.keys(this.props.traversalPool.pool).length === 0 &&
      prevProps.traversalPool.running > 0 && this.props.traversalPool.running === 0) { 
      // finished all traversals
      this.setState({ "loading": false });
      console.log("Attempting to process outcomes:", this.props.graph.outcomes);
      this.props.checkTraversalObjectives(this.props.graph.graph, this.props.graph.objectives);
    }
    if("graph" in prevProps) { 
      // check our traversal objectives if the graph has updated
      if(prevProps.graph.outcomesHash !== this.props.graph.outcomesHash) { 
        // outcomes have changed, need to update our projections!
        this.processTraversalOutcomes(this.props.graph.outcomes);
      }
    }
    if("traversalPool" in this.props &&  // if traversal pool reducer ready
      Object.keys(this.props.traversalPool.pool).length && // and a traversal is waiting in the pool
      this.props.traversalPool.running < this.state.traversalThreshold  // and we don't have too many
    ) {  
      // then start another traversal
      const nextTraversalUri = Object.keys(this.props.traversalPool.pool)[0];
      const nextTraversalParams = this.props.traversalPool.pool[nextTraversalUri];
      this.props.traverse(nextTraversalUri, nextTraversalParams);
    }

    if("score" in prevProps && this.state.selectedPerformance &&
       prevProps.score.pageNum !== this.props.score.pageNum) {
      // page has been turned; reassign click handlers
//      this.assignClickHandlersToNotes();
      this.createInstantBoundingRects();
      this.highlightDeletedNotes();
    }
    if("score" in prevProps && this.state.selectedPerformance &&
      prevState.selectedPerformance !== this.state.selectedPerformance) { 
      // performance has been changed; reassign click handlers
//      this.assignClickHandlersToNotes();
      this.createInstantBoundingRects();
      this.highlightDeletedNotes();
    }
    if(prevState.showConfidence !== this.state.showConfidence) { 
      this.createInstantBoundingRects(); // showConfidence preference changed; redraw boxes
      this.refs.showConfidenceToggle.checked = this.state.showConfidence;
    }
    if(prevState.scoreFollowing !== this.state.scoreFollowing) { 
      this.refs.pageControlsWrapper.classList.toggle("following");
      "next" in this.refs && this.refs.next.classList.toggle("following");
      "prev" in this.refs && this.refs.prev.classList.toggle("following");
      this.refs.scoreFollowingToggle.checked = this.state.scoreFollowing;
    }

  }
  
  componentWillUnmount() { 
    // clean up...
    document.removeEventListener('keydown', this.monitorKeys);
  }

  monitorKeys(e) { 
    console.log("got: ", e);
    if("score" in this.props) { 
      switch(e.which) { 
        case 37: // left arrow
          if(this.props.score.pageNum > 1) { 
            this.props.scorePrevPageStatic(this.state.currentScore, this.props.score.pageNum, this.props.score.MEI[this.state.currentScore])
          }
          break;
        case 39: // right arrow
          if(this.props.score.pageNum < this.props.score.pageCount) { 
            this.props.scoreNextPageStatic(this.state.currentScore, this.props.score.pageNum, this.props.score.MEI[this.state.currentScore]); 
          }
          break;
        case 67: // 'c'  => "confidence"
          if(this.state.selectedPerformance) { 
            this.setState({ showConfidence: !this.state.showConfidence });
          }
          break;
        case 70: // 'f'  => "follow"
          if(this.state.selectedPerformance) { 
            this.setState({ scoreFollowing: !this.state.scoreFollowing });
          }
          break;
      }
    }
  }

  highlightDeletedNotes() { 
    // highlight deleted notes (i.e., notes missed out during performance) on this page
    // n.b. per Nakamura alignment convention, deleted notes have a performance time of -1
    //
    // first, tidy up left-over deleted notes from previous invocations (e.g. on another performance)
    Array.prototype.map.call(document.querySelectorAll(".deleted"), (d) => { d.classList.remove("deleted") });
    if(this.state.selectedPerformance && this.state.showInsertedDeleted) { 
      //FIXME Skolemization bug currently causing two identical times (intervals), one for performance and one for signal. For now, pick the first
      const thisTime = this.ensureArray(this.state.selectedPerformance["http://purl.org/ontology/mo/recorded_as"]["http://purl.org/ontology/mo/time"])
      const thisTimeline = thisTime[0]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"];
      const deletedNotesInstant = this.state.instantsByPerfTime[thisTimeline].filter( (i) => { 
        let dur = i["http://purl.org/NET/c4dm/timeline.owl#atDuration"];
        dur = parseInt(dur.substr(1, dur.length-2));
        return dur === -1; // all deleted notes "occur" at this instant
      })
      if(deletedNotesInstant.length) { // could be 0 in a perfect performance...
        console.log("deleted notes instant: ", deletedNotesInstant);
        const deletedNotes = deletedNotesInstant[0]["http://purl.org/vocab/frbr/core#embodimentOf"];
        deletedNotes.map( (n) => { 
          let noteOnPage = document.getElementById(n["@id"].substr(n["@id"].indexOf("#")+1));
          if(noteOnPage) {
            noteOnPage.classList.add("deleted");
          }
        })
      }
    }
  }
  createInstantBoundingRects() {
    // draw bounding rectangles for the note(s) on this page representing each instance
    let notesOnPagePerInstant = {};
    const boundingBoxesWrapper = document.getElementById("instantBoundingBoxes");
    // clear previous bounding boxes
    while(boundingBoxesWrapper.firstChild) { 
      boundingBoxesWrapper.removeChild(boundingBoxesWrapper.firstChild)
    }
    console.log("Selected performance: ", this.state.selectedPerformance)
    const selectedSignal = this.ensureArray(this.state.selectedPerformance["http://purl.org/ontology/mo/recorded_as"]);
    const selectedInstant = this.ensureArray(selectedSignal[0]["http://purl.org/ontology/mo/time"]);
    const selectedTimeline = this.ensureArray(selectedInstant[0]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"])[0]["@id"];
    const notes = ReactDOM.findDOMNode(this.scoreComponent).querySelectorAll(".note");
    Array.prototype.map.call(notes, (n) => { 
      // associate notes on this page with their instant duration
      if(n.getAttribute("id") in this.state.instantsByNoteId[selectedTimeline]) {
        let nDur = this.state.instantsByNoteId[selectedTimeline][n.getAttribute("id")]["http://purl.org/NET/c4dm/timeline.owl#atDuration"];
        nDur = parseFloat(nDur.substr(1, nDur.length-2)) + parseFloat(this.state.selectedPerformance["https://meld.linkedmusic.org/terms/offset"]);
        if(nDur in notesOnPagePerInstant) { 
          notesOnPagePerInstant[nDur].push(n);
        } else { 
          notesOnPagePerInstant[nDur] = [n];
        }
      }
    })
    Object.keys(notesOnPagePerInstant).map( (i) => { 
      // for each instant, figure out the minimal bounding box that contains all its notes
      let boxLeft = 10000;
      let boxTop = 10000;
      let boxRight= 0 
      let boxBottom= 0;
      let noteId;
      notesOnPagePerInstant[i].map( (n) => { 
        // to contain all notes, we want to minimise left and top, 
        // and maximise right and bottom
        const boundRect = n.getBoundingClientRect();
        boxLeft = boundRect.left + window.scrollX < boxLeft ? boundRect.left + window.scrollX : boxLeft; 
        boxTop  = boundRect.top + window.scrollY < boxTop ? boundRect.top + window.scrollY: boxTop; 
        boxRight= boundRect.right > boxRight? boundRect.right : boxRight; 
        boxBottom= boundRect.bottom > boxBottom ? boundRect.bottom: boxBottom; 
        // remember a note ID for indexing into instantsByNoteId (to retrieve confidence) further below
        noteId = n.getAttribute("id"); 
      });
      // now draw the containing elements:
      // confidenceBoundDiv -- visualisation of confidence -- background behind notes
      // clickableBoundDiv -- transparent click catcher for interaction -- foreground infront of notes
      const confidenceBoundDiv = document.createElement("div");
      const clickableBoundDiv= document.createElement("div");
      confidenceBoundDiv.setAttribute("id", "conf-" + i);
      confidenceBoundDiv.classList.add("confidenceBoundedInstant");
      confidenceBoundDiv.setAttribute("style", 
         "position:absolute;" + 
         "left:"    + Math.floor(boxLeft) + "px;" + 
         "top:"   + Math.floor(boxTop) + "px;" + 
         "width:" + Math.ceil(boxRight - boxLeft) + "px;" + 
         "height:"+ Math.ceil(boxBottom - boxTop) + "px;" + 
         "background: rgba(255,0,0," + parseFloat(1 - this.state.instantsByNoteId[selectedTimeline][noteId]["https://terms.trompamusic.eu/maps#confidence"] * .01) + ");" + 
         "z-index: -1;"
      );
      clickableBoundDiv.setAttribute("id", "conf-" + i);
      clickableBoundDiv.classList.add("clickableBoundedInstant");
      clickableBoundDiv.setAttribute("style", 
         "position:absolute;" + 
         "left:"    + Math.floor(boxLeft) + "px;" + 
         "top:"   + Math.floor(boxTop) + "px;" + 
         "width:" + Math.ceil(boxRight - boxLeft) + "px;" + 
         "height:"+ Math.ceil(boxBottom - boxTop) + "px;" + 
         "background: rgba(0,0,0,0);" + 
         "z-index: 1;"
      );
      clickableBoundDiv.onclick = (e) => { 
        let nDur = this.state.instantsByNoteId[selectedTimeline][noteId]["http://purl.org/NET/c4dm/timeline.owl#atDuration"]
        if(parseInt(nDur.substr(1,nDur.length-2)) === -1) {
          // this is a deleted (i.e. unperformed) note; thus we can't seek to it!
          return
        }
        console.log("On bounding box click, attempting to  seek to: ", nDur);
        nDur = parseFloat(nDur.substr(1, nDur.length-2)) + parseFloat(this.state.selectedPerformance["https://meld.linkedmusic.org/terms/offset"]);  
        this.tick(this.state.selectedVideo, nDur);
        this.player.seekTo(Math.floor(nDur)); 
        // reset note velocities display for all notes after this one
        const notesOnPage = document.querySelectorAll(".note");
        const thisNote = document.querySelector("#" + noteId);
        const noteIndex = Array.prototype.indexOf.call(notesOnPage, thisNote);
        const notesAfterThisOne = Array.prototype.slice.call(notesOnPage, noteIndex+1);
        notesAfterThisOne.map( (n) => { 
          n.style.fill="";
          n.style.stroke="";
        })
      }
      let nDur = this.state.instantsByNoteId[selectedTimeline][noteId]["http://purl.org/NET/c4dm/timeline.owl#atDuration"]
      nDur = nDur.substr(1, nDur.length-2);
      if(parseInt(nDur) === -1) { 
        clickableBoundDiv.setAttribute("title", "This note was not sounded during the selected performance");
      } else { 
        clickableBoundDiv.setAttribute("title", "time: " + nDur.substr(1, nDur.length-2) + 
        " velocity: " + parseFloat(this.state.instantsByNoteId[selectedTimeline][noteId]["https://terms.trompamusic.eu/maps#velocity"]) + 
        " confidence: " + parseFloat(this.state.instantsByNoteId[selectedTimeline][noteId]["https://terms.trompamusic.eu/maps#confidence"]));
      }
      // only add confidence visualisation if user wants us to
      if(this.state.showConfidence) {
        boundingBoxesWrapper.appendChild(confidenceBoundDiv);
      }
      boundingBoxesWrapper.appendChild(clickableBoundDiv);
    })
  }

  assignClickHandlersToNotes() {
    // check if our score page has updated
    const selectedTimeline = this.state.selectedPerformance["http://purl.org/ontology/mo/recorded_as"]["http://purl.org/ontology/mo/time"]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"];
    const notes = ReactDOM.findDOMNode(this.scoreComponent).querySelectorAll(".note");
    Array.prototype.map.call(notes, (n) => { 
      if(n.getAttribute("id") in this.state.instantsByNoteId[selectedTimeline]) {
        let nDur = this.state.instantsByNoteId[selectedTimeline][n.getAttribute("id")]["http://purl.org/NET/c4dm/timeline.owl#atDuration"]
        nDur = parseFloat(nDur.substr(1, nDur.length-2)) + parseFloat(this.state.selectedPerformance["https://meld.linkedmusic.org/terms/offset"]);  
        n.onclick = (e) => { 
          console.log("On note click, attempting to  seek to: ", nDur);
          this.tick(this.state.selectedVideo, nDur);
          this.player.seekTo(Math.floor(nDur));
        }
      }
    });
  }

  ref = player => {
    this.player = player;
  }

  render() { 
    if(this.state.loading) { 
      return(<div id="wrapper">Loading, please wait</div>);
    } else {
      return(
        <div id="wrapper">
          <div id="logoWrapper">
            <img src="/static/trompa.png" id="trompaLogo" alt="TROMPA Project logo" />
            <img src="/static/mdw.svg" id="mdwLogo" alt="University of Music and Performing Arts Vienna, Austria logo" />
          </div>
          <div id="instantBoundingBoxes" />
          { this.state.currentScore 
            ? <Score uri={ this.state.currentScore } key = { this.state.currentScore } options = { vrvOptions } ref={(score) => { this.scoreComponent = score}}/>
            : <div className="loadingMsg">Loading score, please wait...</div>
          }
        <div id="pageControlsWrapper" ref="pageControlsWrapper">
          { this.props.score.pageNum > 1 
            ? <div id="prev" ref="prev" onClick={() => {
                this.props.scorePrevPageStatic(this.state.currentScore, this.props.score.pageNum, this.props.score.MEI[this.state.currentScore])
              }}> <img src="/static/prev.svg" alt="Previous page"/></div>
            : <div id="prev" />
          }
          { this.props.score.pageCount > 0
              ? <span id="pageNum">Page {this.props.score.pageNum} / {this.props.score.pageCount}</span> 
              : <span id="pageNum"/>
          }
          { this.props.score.pageCount === 0 || this.props.score.pageNum < this.props.score.pageCount
          ? <div id="next" ref="next" onClick={(e) => {
              this.props.scoreNextPageStatic(this.state.currentScore, this.props.score.pageNum, this.props.score.MEI[this.state.currentScore]); 
            }}> <img src="/static/next.svg" alt="Next page"/></div>
          : <div id="next" />
          }
        </div>
          { this.state.performances.length === 0 
            ? <div className="loadingMsg">Loading selectors, please wait...</div>
            : <div id="selectWrapper">
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
              { this.state.selectedPerformance 
              ? <span> 
                  <span id="scoreFollowToggle">
                    <input 
                      type="checkbox" 
                      ref="scoreFollowingToggle"
                      defaultChecked={ this.state.scoreFollowing }
                      onChange={ () => { 
                        this.setState({ scoreFollowing: !this.state.scoreFollowing }) 
                      }}
                    />
                    Score-following
                  </span>
                  <span id="confidenceToggle">
                      <input 
                        type="checkbox" 
                        ref="showConfidenceToggle"
                        defaultChecked={ this.state.showConfidence }
                        onChange={ () => { 
                          this.setState({ showConfidence: !this.state.showConfidence});
                        }}
                      />
                      Alignment confidence
                  </span>
                  <span id="velocitiesToggle">
                      <input 
                        type="checkbox" 
                        ref="showVelocitiesToggle"
                        defaultChecked={ this.state.showVelocities }
                        onChange={ () => { 
                          this.setState({ showVelocities: !this.state.showVelocities});
                        }}
                      />
                      Note velocities
                  </span>
                  <span id="insertedDeletedToggle">
                      <input 
                        type="checkbox" 
                        ref="showInsertedDeletedToggle"
                        defaultChecked={ this.state.showInsertedDeleted}
                        onChange={ () => { 
                          if(this.state.showInsertedDeleted) { 
                            // if we're unselecting, reset any deleted notes
                            Array.prototype.map.call(document.querySelectorAll(".deleted"), (d) => { d.classList.remove("deleted") });
                          } 
                          this.setState({ showInsertedDeleted: !this.state.showInsertedDeleted}, () => { this.highlightDeletedNotes() });
                        }}
                      />
                      Inserted / deleted notes
                  </span>
                </span>
              : <span>
                  <span id="scoreFollowToggle" className="hidden"/>
                  <span id="confidenceToggle" className="hidden" />
                </span>
              }
              </div>
          }
          <div className="videoWrapper">
            <ReactPlayer 
              playing
              ref={this.ref}
              url={ this.state.selectedVideo }
              progressInterval = { this.state.progressInterval } // update rate in milliseconds 
              controls={ true }
              width="100%"
              height="100%"
              onProgress={ (p) => {
                this.tick(this.state.selectedVideo, p["playedSeconds"])
              }}
              onReady={ () => {
                if(this.state.seekTo) { 
                  console.log("Render loop onReady: seeking to ", this.state.seekTo);
                  this.player.seekTo(Math.floor(this.state.seekTo));
                  this.setState({seekTo: ""});
                }
              }}
            />
          </div>
        </div>
      )
    }
  }

  handleSegmentSelected(e) { 
    const selected = this.state.segments.filter( (seg) => { return seg["@id"] === e.target.value });
    const target = selected[0]["http://purl.org/vocab/frbr/core#embodiment"]["http://www.w3.org/2000/01/rdf-schema#member"]["@id"];
    this.props.scorePageToComponentTarget(target, this.state.currentScore, this.props.score.MEI[this.state.currentScore]);
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
        this.player.seekTo(Math.floor(startTime));
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
    document.querySelectorAll(".note").forEach( (n) => { n.style.fill=""; n.style.stroke=""; }) // reset note velocities
    this.setState(newState);
  }

  findInstantToSeekTo(segment, selectedPerformance = this.state.selectedPerformance) { 
    //FIXME Skolemization bug currently causing two identical times (intervals), one for performance and one for signal. For now, pick the first
    const thisTime = this.ensureArray(selectedPerformance["http://purl.org/ontology/mo/recorded_as"]["http://purl.org/ontology/mo/time"])
    const selectedTimeline = thisTime[0]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"];
    // find the time instant on the selected performance's timeline that corresponds to the
    // selected segment
    const timelineSegment = this.props.graph.outcomes[2]["@graph"].filter( (i) => { 
      console.log("Inside filter. Looking at ", i)
      if(!("http://purl.org/NET/c4dm/timeline.owl#onTimeLine" in i) || 
         i["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"]!==selectedTimeline) { 
        return false;
      }
      let segNotes = [];
        // do any of our instant's note embodiments match one of the segment's note embodiments?
      console.log("Filtering on seg notes: ", segment["http://purl.org/vocab/frbr/core#embodiment"]["https://meld.linkedmusic.org/terms/notes"])
      segNotes = segment["http://purl.org/vocab/frbr/core#embodiment"]["https://meld.linkedmusic.org/terms/notes"].filter( (segNote) => {
        // ensure array (in chords, one timeline instance maps to multiple note instances)
        const embodiments = this.ensureArray(i["http://purl.org/vocab/frbr/core#embodimentOf"]) 
        const embodimentFound = embodiments.filter( (e) => {
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
    // remove any occurring at -1 (indicating deleted notes)
    const filtered = sorted.filter( (n) => {
      let dur = n["http://purl.org/NET/c4dm/timeline.owl#atDuration"]; 
      dur = parseInt(dur.substr(1, dur.length-2));
      return(dur !== -1)
    })
    return filtered;
  }

  mapVelocity(vel) { 
    let value = (vel - this.state.minExpectedVel) * (this.state.maxMappedVelocity - this.state.minMappedVelocity) / (this.state.maxExpectedVel - this.state.minExpectedVel) + this.state.minMappedVelocity;
    value = Math.max(0, value) // can't have < 0
    value = Math.max(value, 1) // can't have > 1
    return Math.floor(value);
  }

  tick(id,t) {
    if(!("@id" in this.state.currentSegment)) { 
      return // ignore unless segment selected
    }
    t += this.state.videoOffset;
    let newState = { lastMediaTick: t }; // keep track of this time tick)
    // dispatch a "TICK" action 
    // any time-sensitive component subscribes to it, 
    // triggering time-anchored annotations triggered as appropriate
    this.props.tickTimedResource(id, t);
    if(this.state.selectedPerformance) { 
      // find closest corresponding instants (within a window of progressInterval milliseconds) on this timeline
      //FIXME Skolemization bug currently causing two identical times (intervals), one for performance and one for signal. For now, pick the first
      const thisTime = this.ensureArray(this.state.selectedPerformance["http://purl.org/ontology/mo/recorded_as"]["http://purl.org/ontology/mo/time"])
      const thisTimeline = thisTime[0]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"];
      const thisOffset = this.state.selectedPerformance["https://meld.linkedmusic.org/terms/offset"];
      let closestInstantIndices = this.state.instantsByPerfTime[thisTimeline].reduce( (indices, instant, thisIndex) => { 
        let dur = instant["http://purl.org/NET/c4dm/timeline.owl#atDuration"];
        dur = dur.substr(1, dur.length-2);
        const offsetDur = parseFloat(dur) + parseFloat(thisOffset);
        //console.log("offsetDur: ", offsetDur, " t: ", t, " pI: ", this.state.progressInterval);
        if(offsetDur > (t - this.state.activeWindow) && offsetDur <= t) { 
          indices.push(thisIndex);
        }
        return indices;
      }, []);

//      let closestInstantIx = this.state.instantsByPerfTime[thisTimeline].findIndex( (i) => { 
//        let dur = i["http://purl.org/NET/c4dm/timeline.owl#atDuration"];
//        dur = dur.substr(1, dur.length-2);
//        return parseFloat(dur) + parseFloat(thisOffset) > t;
//      });
//      //console.log("Got closest instant IX: ", closestInstantIx, " lastMediaTick: ", this.state.lastMediaTick);
      // if we're at 0 use that, otherwise use the one before this one 
      // (i.e., closest without going over)
//      closestInstantIx = closestInstantIx===0 ? closestInstantIx : closestInstantIx - 1;
//     if(closestInstantIx in this.state.instantsByPerfTime[thisTimeline]) {
      const previouslyActive = document.getElementsByClassName("active")
      if(previouslyActive.length && closestInstantIndices.length) { 
        newState["previouslyActive"] = Array.from(previouslyActive);
        Array.from(previouslyActive).map( (n) => { 
          n.classList.remove("active"); 
        });
      }
      //console.log("Tick: ", t, ", offset: ", thisOffset + t, ", closest instants: ", closestInstantIndices);
      closestInstantIndices.map( (closestInstantIx) => {
        let currentNotes = this.state.instantsByPerfTime[thisTimeline][closestInstantIx]["http://purl.org/vocab/frbr/core#embodimentOf"];
        // handle array (instant might correspond to chord or multiple voices...)
        currentNotes = Array.isArray(currentNotes) ? currentNotes : [currentNotes];
        // clear any pre-existing active notes
        let currentNoteElement;
        let currentMeasure;
        let noteToFlipTo;
        currentNotes.map( (n) => { 
          const currentNoteId =n["@id"].substr(n["@id"].lastIndexOf("#")+1);
        // highlight the current note if on current page
          currentNoteElement = document.getElementById(currentNoteId);
          if(currentNoteElement) { 
            currentNoteElement.classList.add("active");
            if(this.state.showVelocities) { 
              let mappedVel = this.mapVelocity(this.state.instantsByPerfTime[thisTimeline][closestInstantIx]["https://terms.trompamusic.eu/maps#velocity"])
              let hex = "#ff" + (this.state.maxMappedVelocity - mappedVel).toString(16) + "00ff"; // higher vel == less green, so redder colour
              currentNoteElement.style.fill = hex; 
              currentNoteElement.style.stroke = hex;
            }
            currentMeasure = currentNoteElement.closest(".measure")
          } else if(currentNoteId === "inserted_state" && this.state.showInsertedDeleted) { 
            // oops! wrong note played (according to MAPS at least)
            // visualise this by CSS animation on the (most recent) measure 
            // (only if we are showing alignment confidence)
              if(this.state.previouslyActive.length) {
                this.state.previouslyActive[0].closest(".measure").classList.add("errorDetected");
              // and clear the animation a second later (so that we can punish the next pianist that gets this meausure wrong!)
                setTimeout( (element) => { 
                  element.closest(".measure").classList.remove("errorDetected");

                }, 1000, this.state.previouslyActive[0]); 
              } else { console.log("Insert state detected but no previously active note!"); }
          } else { 
            // note not on this page; so we'll need to flip to it
            noteToFlipTo = n;
          }
        }, this)
        if(noteToFlipTo && closestInstantIx > 0) { 
          // a note wasn't on this page -- if we are score-following, flip to its page
          // (the closestInstantIx > 0 check is to avoid flipping to first page each time we swap performance)
          if(this.state.scoreFollowing) { 
            console.log("Asking Score to flip to: ", noteToFlipTo);
            this.props.scorePageToComponentTarget(noteToFlipTo["@id"], this.state.currentScore, this.props.score.MEI[this.state.currentScore]);
          }
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
      })
      this.setState(newState);
		}
	}

  ensureArray(val) { 
    return Array.isArray(val) ? val : [val]
  }

  processTraversalOutcomes(outcomes) { 
    let segments = [];
    let performances= [];
    let instants = [];
    let instantsByPerfTime = {};
    let instantsByNoteId = {};
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
        const embodiments = Array.isArray(outcome["http://purl.org/vocab/frbr/core#embodimentOf"]) ? 
                                outcome["http://purl.org/vocab/frbr/core#embodimentOf"] :
                                [ outcome["http://purl.org/vocab/frbr/core#embodimentOf"] ];
        // instants per PerfTime
        if(outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"] in instantsByPerfTime) {
          instantsByPerfTime[outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"]].push(outcome)
        } else { 
          instantsByPerfTime[outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"]] = [outcome]
        }
        // instants per NoteId
        embodiments.map( (e) => { 
          const eId = e["@id"].substr(e["@id"].lastIndexOf("#")+1);
          if(outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"] in instantsByNoteId) {
            instantsByNoteId[outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"]][eId] = outcome;
          } else { 
            instantsByNoteId[outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"]] = { [eId]: outcome };
          }
        })
      });
      Object.keys(instantsByPerfTime).map( (tl) => { 
        // order the instances along each timeline
        instantsByPerfTime[tl] = instantsByPerfTime[tl].sort( (a, b) => { 
          let aDur = a["http://purl.org/NET/c4dm/timeline.owl#atDuration"];
          let bDur = b["http://purl.org/NET/c4dm/timeline.owl#atDuration"];
          return parseFloat(aDur.substr(1, aDur.length-2)) - parseFloat(bDur.substr(1, bDur.length-2))
        })
      })
      // set our MEI score based on the first performance
      // TODO this assumes all performances are of the same score - check that assumption;
      // to support multi-score, need to set state on every performance selection
      if(performances.length) { 
        console.log("Performances:", performances)
        const currentPerformance = this.ensureArray(performances[0]["http://purl.org/ontology/mo/performance_of"])[0]
        console.log("Current performance: ", currentPerformance)
        const currentScore = currentPerformance["http://purl.org/ontology/mo/published_as"]["@id"];
        this.props.fetchScore(currentScore); // register it with reducer to obtain page count, etc
        this.setState({ performances, segments, instants, instantsByPerfTime, instantsByNoteId, currentScore });
      }
    }
  }
}


function mapStateToProps({ score, graph, traversalPool }) {
  return { score, graph, traversalPool }
}

function mapDispatchToProps(dispatch) { 
  return bindActionCreators( { 
    fetchScore,
    traverse, 
    registerTraversal,
    setTraversalObjectives, 
    checkTraversalObjectives, 
    scoreNextPageStatic, 
    scorePrevPageStatic, 
    scorePageToComponentTarget, 
    registerClock,
    tickTimedResource
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(Companion);

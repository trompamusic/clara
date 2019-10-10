import React, { Component } from 'react';
import ReactDOM from 'react-dom'
import { connect } from 'react-redux' ;
import { bindActionCreators } from 'redux';

//const {Raphael,Paper,Set,Circle,Ellipse,Image,Rect,Text,Path,Line} = require('react-raphael');

class FeatureVis extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      width: this.props.width || 100,
      height: this.props.height || 100,
      instantsOnPage: {},
      instantsByScoretime: {},
      noteElementsByNoteId: {},
      timemap: [],
      timemapByNoteId: {},
      pointsPerTimeline: {}
    }
    this.setInstantsOnPage = this.setInstantsOnPage.bind(this);
    this.setInstantsByScoretime = this.setInstantsByScoretime.bind(this);
    this.setNoteElementsByNoteId = this.setNoteElementsByNoteId.bind(this);
    this.ensureArray = this.ensureArray.bind(this);
    this.convertCoords = this.convertCoords.bind(this);
    this.calculateQStampForInstant = this.calculateQStampForInstant.bind(this);
    this.noteElementsForInstant = this.noteElementsForInstant.bind(this);
    this.setPointsPerTimeline = this.setPointsPerTimeline.bind(this);
  }

/*
  componentDidMount(){ 
    if(Object.keys(this.props.instantsByNoteId).length) { 
      const notes = this.props.notes;
      let instantsOnPage = {};
      // for each timeline we need to visualise:
      this.props.timelinesToVis.map( (tl) => { 
//        console.log("Notes on page: ", this.props.notesOnPage);
        // find the instants coresponding to notes on this page
        instantsOnPage[tl] = Array.from(this.props.notesOnPage).map( (note) => { 
          //console.log("Looking at note: ", note);
          return this.props.instantsByNoteId[tl][note.getAttribute("id")]
        })
      })
      console.log("Instants on page: ", instantsOnPage);
    } else { 
      console.log("FeatureVis mounted without notesOnPage")
    }
  }
*/
  componentDidMount() { 
    this.setNoteElementsByNoteId();
    this.setState({ timemap: this.props.score.vrvTk.renderToTimemap() }, () => {
      let timemapByNoteId = {};
      // generate "inverted" timemap (by note onset)
      this.state.timemap.filter((t) => {
        // only care about times with onsets
        return "on" in t;
      }).map((t) => { 
        t.on.map((id) => { 
          timemapByNoteId[id] = {
            qstamp: t.qstamp,
            tstamp: t.tstamp
          }
        });
      })
      this.setState({ timemapByNoteId });
    })
  }

  componentDidUpdate(prevProps, prevState) { 
    if("score" in prevProps && prevProps.score.pageNum !== this.props.score.pageNum  // page flipped
    ) { 
      this.setNoteElementsByNoteId();
    }
  }

  setInstantsByScoretime() { 
    console.log("enter setInstantsByScoretime")
    let instantsByScoretime = {};
    // for each timeline we need to visualise:
    this.props.timelinesToVis.map( (tl) => { 
      instantsByScoretime[tl] = {};
      // for each timeline instant 
      this.state.instantsOnPage[tl].map( (inst) => { 
        // average qstamps of note onsets at this instant
        let embodimentsAtInstant = this.ensureArray(inst["http://purl.org/vocab/frbr/core#embodimentOf"])
        let noteIdsAtInstant = embodimentsAtInstant.map((n) => { 
          return n["@id"].substr(n["@id"].lastIndexOf("#")+1);
        })
        let avgQstamp = noteIdsAtInstant.reduce((sumQ, noteId) => { 
          return sumQ += this.state.timemapByNoteId[noteId].qstamp;
        }, 0) / noteIdsAtInstant.length;
        // conceivable that distinct performed instants share a scoretime
        // so, maintain an array of instants at each scoretime
        if(avgQstamp in instantsByScoretime[tl]) { 
          instantsByScoretime[tl][avgQstamp].push(inst);
        } else { 
          instantsByScoretime[tl][avgQstamp] = [inst];
        }
      })
    })
    console.log("setting instantsByScoretime: ", instantsByScoretime);
    this.setState({ instantsByScoretime }, () => {
      // now set points per timeline
      this.setPointsPerTimeline()
    });
  }

  setNoteElementsByNoteId() { 
    let noteElementsByNoteId = {};
    Array.from(this.props.notesOnPage).map( (note) => {
      noteElementsByNoteId[note.getAttribute("id")] = note;
    })
    this.setState({ noteElementsByNoteId }, () => {
      // now set instants on page
      this.setInstantsOnPage();
    });
  }

  noteElementsForInstant(inst) { 
    let noteElements = this.ensureArray(inst["http://purl.org/vocab/frbr/core#embodimentOf"]).map( (n) => { 
      // return note (DOM) elements corresponding to each embodiment
      return this.state.noteElementsByNoteId[n["@id"].substr(n["@id"].lastIndexOf("#")+1)]
    })
    noteElements = noteElements.filter( (note) => { 
      // filter out undefined notes (deleted notes might not be notesOnPage)
      return note
    })
    return noteElements;
  }

  setInstantsOnPage() { 
    if(Object.keys(this.props.instantsByNoteId).length) { 
      let instantsOnPage = {};
      // for each timeline we need to visualise:
      this.props.timelinesToVis.map( (tl) => { 
        // find the instants coresponding to notes on this page
        instantsOnPage[tl] = Array.from(this.props.notesOnPage).map( (note) => { 
          return this.props.instantsByNoteId[tl][note.getAttribute("id")]
        }).filter( (inst) => {
          // filter out undefined instants (i.e. when note doesn't appear in timeline)
          // and instants at duration -1 (deleted notes)
          return inst && parseFloat(inst["http://purl.org/NET/c4dm/timeline.owl#atDuration"].replace(/[PS]/g, "")) > -1
        }).sort( (a, b) => {
          // ensure order by performance time
          return parseFloat(a["http://purl.org/NET/c4dm/timeline.owl#atDuration"].replace(/[PS]/g, "")) - 
          parseFloat(b["http://purl.org/NET/c4dm/timeline.owl#atDuration"].replace(/[PS]/g, ""))  
        });
        console.log("Num instants before duplicate filter:", instantsOnPage[tl].length);
        instantsOnPage[tl] = instantsOnPage[tl].filter( (inst, ix) => { 
          return ix > 0 && inst["@id"] !== instantsOnPage[tl][ix-1]["@id"];
        })
        console.log("Num instants after duplicate filter:", instantsOnPage[tl].length);
      })
      this.setState({instantsOnPage}, () => { 
        // now set instantsByScoretime
        this.setInstantsByScoretime();
      })
    }
  }

    // https://stackoverflow.com/questions/26049488/how-to-get-absolute-coordinates-of-object-inside-a-g-group  
  convertCoords(elem) {
    const x = elem.getBBox().x;
    const y = elem.getBBox().y;
    const offset = elem.closest("svg").parentElement.getBoundingClientRect();
    const matrix = elem.getScreenCTM();
    return {
        x: (matrix.a * x) + (matrix.c * y) + matrix.e - offset.left,
        y: (matrix.b * x) + (matrix.d * y) + matrix.f - offset.top
    };
  }
  
  ensureArray(val) { 
    return Array.isArray(val) ? val : [val]
  }

  calculateQStampForInstant(inst) { 
    // qstamp == time in quarter notes (as per verovio timemap)
    // as multiple notes (with potentially different qstamps) could share a performed
    // instant, calculate an (average) qstamp per instant here
    const noteElements = this.noteElementsForInstant(inst);
    const sumQ = noteElements.reduce( (q, note) => {
      const noteId = note.getAttribute("id");
      const qstamp = this.state.timemapByNoteId[noteId].qstamp;
      return q += qstamp;
    }, 0);
    return sumQ / noteElements.length;
  }

  setPointsPerTimeline() { 
    let pointsPerTimeline={};
    this.props.timelinesToVis.map( (tl, ix) => { 
      let scoretimeArray = Object.keys(this.state.instantsByScoretime[tl]).sort((a,b) => { 
        return parseFloat(a) - parseFloat(b)
      })
      // for each instant on this page ...
      let pointsForThisTl = scoretimeArray.map( (qstamp, ix) =>  { 
      // xpos should be average x position for note elements at this qstamp
        let noteElementsAtQstamp = [];
        this.state.instantsByScoretime[tl][qstamp].map((inst) => {
          noteElementsAtQstamp.push(this.noteElementsForInstant(inst));
        });
        let sumXPos = noteElementsAtQstamp.flat().reduce((sumX, note) => { 
          let absolute = this.convertCoords(note);
          return sumX + absolute.x;
        }, 0);
        let avgXPos = sumXPos / noteElementsAtQstamp.length;
        // calculate y position (default to 0 on first instant)
        let yPos = 0;
        if(ix > 0) { 
          // calculate change in avg performance time of instants at previous and current qstamp
          // TODO optimise (cache)
          const theseTimestamps = this.state.instantsByScoretime[tl][qstamp].map((inst) => {
            return parseFloat(inst["http://purl.org/NET/c4dm/timeline.owl#atDuration"].replace(/[PS]/g, ""))
          });
          const thisT = theseTimestamps.reduce((sumT, t) => (sumT + t)) / theseTimestamps.length

          const prevTimestamps = this.state.instantsByScoretime[tl][scoretimeArray[ix-1]].map((inst) => {
            return parseFloat(inst["http://purl.org/NET/c4dm/timeline.owl#atDuration"].replace(/[PS]/g, ""))
          })
          const prevT = prevTimestamps.reduce((sumT, t) => (sumT + t)) / prevTimestamps.length;

          const deltaT = thisT - prevT;

          // calculate change in scoretime (qstamp) between this and the current one
          const deltaQ = parseFloat(qstamp) - parseFloat(scoretimeArray[ix-1])

          // calculate inter-instant-interval (change in performance time per change in score time)
          const iii = deltaT / deltaQ
          yPos = iii * 50 // TODO come up with a sensible mapping
        }
        // return point data for this timeline and scoretime 
        console.log(tl, avgXPos, qstamp);
        return {x: avgXPos, y: yPos, qstamp:qstamp};
      })
      pointsPerTimeline[tl] = pointsForThisTl;
    })
    this.setState({ pointsPerTimeline });
  }

  render() {
    if(Object.keys(this.state.pointsPerTimeline).length) {
      // TODO for each timeline...
      const tlPoints = this.state.pointsPerTimeline[Object.keys(this.state.pointsPerTimeline)[0]];
      console.log(tlPoints);
      let lines = [];
      let rects = [];
      tlPoints.map( (pt,ix) => { 
        let prevX = 0;
        let prevY = 0;
        if(ix > 0) { 
          prevX = tlPoints[ix-1].x;
          prevY = tlPoints[ix-1].y;
        }
        lines.push(<line x1={prevX} x2={pt.x} y1={prevY} y2={pt.y} strokeWidth="1" stroke="black" key={"line-"+ix}/>)
        rects.push(<ellipse cx={pt.x} cy={pt.y} rx="5" ry="3" id={pt.qstamp} stroke="black" fill="none" key={"rect-"+ix}/>)
      });
      return (
        <svg id="featureVis" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width="1800.00px" height="100px" transform="scale(1,-1) translate(0, 50)">
              { rects }
              { lines }
        </svg>
      )
    } else { 
      return ( <div>No SVG or you!</div> )
      //<Paper width={ this.state.width } height={ this.state.height }>
      //  <Set>
      //    <Rect x={30} y={148} width={240} height={150} attr={{"fill":"#10a54a","stroke":"#f0c620","stroke-width":5}}/>
      //  </Set>
      //</Paper>
    }
  }
}

function mapStateToProps({ graph, score }) {
  return { graph, score }
}

function mapDispatchToProps(dispatch) { 
  return bindActionCreators( { 
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(FeatureVis);
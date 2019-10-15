import React, { Component } from 'react';
import ReactDOM from 'react-dom'
import { connect } from 'react-redux' ;
import { bindActionCreators } from 'redux';

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
      pointsPerTimeline: {},
      currentTimeline: this.props.currentTimeline,
      currentQstamp: ""
    }
    this.setInstantsOnPage = this.setInstantsOnPage.bind(this);
    this.setInstantsByScoretime = this.setInstantsByScoretime.bind(this);
    this.setNoteElementsByNoteId = this.setNoteElementsByNoteId.bind(this);
    this.ensureArray = this.ensureArray.bind(this);
    this.convertCoords = this.convertCoords.bind(this);
    this.calculateQStampForInstant = this.calculateQStampForInstant.bind(this);
    this.noteElementsForInstant = this.noteElementsForInstant.bind(this);
    this.setPointsPerTimeline = this.setPointsPerTimeline.bind(this);
    this.calculateAvgQstampFromNoteIds = this.calculateAvgQstampFromNoteIds.bind(this);
  }

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
    if(prevProps.currentTimeline !== this.props.currentTimeline) { 
      this.setState({ currentTimeline: this.props.currentTimeline });
    }
    
    if("currentlyActiveNoteIds" in prevProps &&
      prevProps.currentlyActiveNoteIds.join("") !== this.props.currentlyActiveNoteIds.join("")) { 
      this.setState({ currentQstamp: this.calculateAvgQstampFromNoteIds(this.props.currentlyActiveNoteIds) }, () => {
        // clear previously active
        const previouslyActive = ReactDOM.findDOMNode(this.featureSvg).querySelectorAll(".active");
        Array.from(previouslyActive).map((p) => p.classList.remove("active"));
        // grab elements on current timeline
        const currentTlElements = ReactDOM.findDOMNode(this.featureSvg).querySelectorAll(".currentTl");
        // make those active with a qstamp at or before the currentQstamp
        Array.from(currentTlElements).map((e) => { 
          if(parseFloat(e.getAttribute("data-qstamp")) <= this.state.currentQstamp) { 
            e.classList.add("active");
          }
        })
      })
    }
  }

  calculateAvgQstampFromNoteIds(noteIds) { 
    return noteIds.reduce((sumQ, noteId) => { 
          return sumQ += this.state.timemapByNoteId[noteId].qstamp;
        }, 0) / noteIds.length;
  }


  setInstantsByScoretime() { 
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
        const avgQstamp = this.calculateAvgQstampFromNoteIds(noteIdsAtInstant);
        // conceivable that distinct performed instants share a scoretime
        // so, maintain an array of instants at each scoretime
        if(avgQstamp in instantsByScoretime[tl]) { 
          instantsByScoretime[tl][avgQstamp].push(inst);
        } else { 
          instantsByScoretime[tl][avgQstamp] = [inst];
        }
      })
    })
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
        instantsOnPage[tl] = instantsOnPage[tl].filter( (inst, ix) => { 
          return ix > 0 && inst["@id"] !== instantsOnPage[tl][ix-1]["@id"];
        })
      })
      this.setState({instantsOnPage}, () => { 
        // now set instantsByScoretime
        this.setInstantsByScoretime();
      })
    }
  }

    // https://stackoverflow.com/questions/26049488/how-to-get-absolute-coordinates-of-object-inside-a-g-group  
  convertCoords(elem) {
    if(document.getElementById(elem.getAttribute("id"))) { 
      const x = elem.getBBox().x;
      const y = elem.getBBox().y;
      const offset = elem.closest("svg").parentElement.getBoundingClientRect();
      const matrix = elem.getScreenCTM();
      return {
          x: (matrix.a * x) + (matrix.c * y) + matrix.e - offset.left,
          y: (matrix.b * x) + (matrix.d * y) + matrix.f - offset.top
      };
    } else {
      console.warn("Element unavailable on page: ", elem.getAttribute("id"));
      return { x:0, y:0 }
    }
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
        let avgXPos = sumXPos / noteElementsAtQstamp.flat().length;
        
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

          // calculate inter-instant-interval (change in score time per change in performed time)
          const iii = deltaQ / deltaT;
          yPos = iii * 50 // TODO come up with a sensible mapping
        }
        // if our point is on the current timeline and before or equal to the current qstamp, we are "active"
        const isActive = tl === this.props.currentTimeline && qstamp <= this.state.currentQstamp;
        // return point data for this timeline and scoretime 
        return {x: avgXPos, y: yPos, qstamp:qstamp, instants:this.state.instantsByScoretime[tl][qstamp], isActive };
      })
      pointsPerTimeline[tl] = pointsForThisTl;
    })
    this.setState({ pointsPerTimeline });
  }

  render() {
    if(Object.keys(this.state.pointsPerTimeline).length) {
      let svgElements = [];
      // generate barlines
      Array.from(this.props.barlinesOnPage).map((bl,ix) => { 
        const absolute = this.convertCoords(bl);
        svgElements.push(<line x1={absolute.x} x2={absolute.x} y1="0" y2="100" className="barLineAttr" key={"barline" + ix} />);
      })
      // generate points and lines for each timeline
      // ensure that the currently active timeline (if any) is painted last, to paint over the others
      // (no z-index CSS for SVGs...)
      let timelinesInOrder = this.props.timelinesToVis;
      if(this.props.currentTimeline) {
        const currentTlIndex = timelinesInOrder.indexOf(this.props.currentTimeline);
        if(currentTlIndex > -1) { 
          timelinesInOrder.splice(currentTlIndex,1);
          timelinesInOrder.push(this.props.currentTimeline);

        }
        else { 
          console.warn("FeatureVis: Cannot find current timeline in timelinesToVis");
        }
      }
      timelinesInOrder.map((tl) => { 
        // for each timeline...
        let lines = [];
        let points = [];
        const tlPoints = this.state.pointsPerTimeline[tl];
        tlPoints.map( (pt,ix) => { 
          let instantsString = pt.instants.map((inst) => inst["@id"]).join(",");
          // determine CSS class: "currentTl" if timeline corresponds to selected performance
          // "active" if point is before or equal to the currently active qstamp (in playback)
          let className = tl === this.state.currentTimeline ? "currentTl" : "";
          let prevX = 0;
          let prevY = 0;
          if(ix > 0) { 
            prevX = tlPoints[ix-1].x;
            prevY = tlPoints[ix-1].y;
          }
          if(ix === 0) { 
            // at the first point:
            // no line to previous (because no previous)
            // "steal" Y position from 2nd point (because no iii at first point)
            points.push(<ellipse className = {className} data-qstamp = {pt.qstamp} cx={pt.x} cy={tlPoints[ix+1].y} rx="3" ry="3" id={pt.qstamp} fill="none" key={"point-"+tl+ix}><title>Point: {instantsString} qstamp: { pt.qstamp }</title></ellipse>);
          } else if(ix === 1) { 
            // at the second point:
            // dotted horizontal line to previous (with stolen Y position)
            // "normal" point
            lines.push(<line className = {className} data-qstamp = {pt.qstamp} x1={prevX} x2={pt.x} y1={pt.y} y2={pt.y} strokeDasharray="2 1" key={"line-"+tl+ix}><title>Line: {instantsString} qstamp: {pt.qstamp} </title></line>);
            points.push(<ellipse className = {className} data-qstamp = {pt.qstamp} cx={pt.x} cy={pt.y} rx="3" ry="3" id={pt.qstamp} fill="none" key={"point-"+tl+ix}><title>Point: {instantsString} qstamp: { pt.qstamp }</title></ellipse>);
          } else {
            lines.push(<line className = {className} data-qstamp = {pt.qstamp} x1={prevX} x2={pt.x} y1={prevY} y2={pt.y} key={"line-"+tl+ix}><title>Line: {instantsString} qstamp: {pt.qstamp} </title></line>);
            points.push(<ellipse className = {className} data-qstamp = {pt.qstamp} cx={pt.x} cy={pt.y} rx="3" ry="3" id={pt.qstamp} fill="none" key={"point-"+tl+ix}><title>Point: {instantsString} qstamp: { pt.qstamp }</title></ellipse>);
          }
        });
        // SVGs don't support CSS z-index, so we need to be careful with our ordering:
        // We want whole timelines to be consistent in their z-axis ordering
        // But on a given timeline, we want points to paint over lines.
        svgElements = [...svgElements, lines, points];
      });
      return (
        <svg id="featureVis" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width="1800.00px" height="100px" transform="scale(1,-1) translate(0, 50)" ref = {(featureSvg) => { this.featureSvg = featureSvg } }>
              { svgElements }
        </svg>
      )
    } else { 
      return ( <div id="featureVisLoading" >Rendering feature SVG...</div> )
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

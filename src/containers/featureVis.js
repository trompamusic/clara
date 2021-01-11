import React, { Component } from 'react';
import { connect } from 'react-redux' ;
import { bindActionCreators } from 'redux';
import TempoCurveVis from './tempoCurveVis';
import DynamicsVis from './dynamicsVis';


class FeatureVis extends Component {
  constructor(props) {
    super(props);
    this.state = {
      width: this.props.width || "1280",
      height: this.props.height || "120",
      instantsOnPage: {},
      instantsByScoretime: {},
      noteElementsByNoteId: {},
      timemap: [],
      timemapByNoteId: {},
      currentTimeline: this.props.currentTimeline,
      currentQstamp: "",
    }
    this.setInstantsOnPage = this.setInstantsOnPage.bind(this);
    this.setInstantsByScoretime = this.setInstantsByScoretime.bind(this);
    this.setNoteElementsByNoteId = this.setNoteElementsByNoteId.bind(this);
    this.ensureArray = this.ensureArray.bind(this);
    this.convertCoords = this.convertCoords.bind(this);
    this.calculateQStampForInstant = this.calculateQStampForInstant.bind(this);
    this.noteElementsForInstant = this.noteElementsForInstant.bind(this);
    this.calculateAvgQstampFromNoteIds = this.calculateAvgQstampFromNoteIds.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.makePoint = this.makePoint.bind(this);
    this.makeLine = this.makeLine.bind(this);
  }

  componentDidMount() {
    // ON ELEMENT LOAD
    // Get handles for note elements on current (i.e., first) page...
    this.setNoteElementsByNoteId();
    // Calculate Verovio timemap, i.e. the score times
    this.setState({ timemap: this.props.score.vrvTk.renderToTimemap() }, () => {
      let timemapByNoteId = {};
      // generate "inverted" timemap (by note onset)
      this.state.timemap.filter((t) => {
        // only care about times with onsets
        return "on" in t;
      }).forEach((t) => {
        t.on.forEach((id) => {
          // build score time lookup by note id
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
    if(prevProps.notesOnPage[0] !== this.props.notesOnPage[0]
    ) {
      // page changed, set handles for note elements on new page
      this.setNoteElementsByNoteId();
    }
    if(prevProps.currentTimeline !== this.props.currentTimeline) {
      // selected timeline has changed, update state accordingly
      this.setState({ currentTimeline: this.props.currentTimeline });
    }
    if("currentlyActiveNoteIds" in prevProps &&
      prevProps.currentlyActiveNoteIds.join("") !== this.props.currentlyActiveNoteIds.join("")) {
      // "active" (highlighted) note Ids have changed, update current score time
      this.setState({ currentQstamp: this.calculateAvgQstampFromNoteIds(this.props.currentlyActiveNoteIds) })
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
    this.props.timelinesToVis.forEach( (tl) => {
      instantsByScoretime[tl] = {};
      // for each timeline instant
      this.state.instantsOnPage[tl].forEach( (inst) => {
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
    this.setState({
      instantsByScoretime: instantsByScoretime,
      instantsByScoretimeLastModified: new Date().valueOf()
    });
  }

  setNoteElementsByNoteId() {
    let noteElementsByNoteId = {};
    Array.from(this.props.notesOnPage).forEach( (note) => {
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
      this.props.timelinesToVis.forEach( (tl) => {
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
    if(document.getElementById(elem.getAttribute("id"))
      && elem.style.display !== "none" && (elem.getBBox().x !== 0 || elem.getBBox().y !== 0)) {
      const x = elem.getBBox().x;
      const width = elem.getBBox().width;
      const y = elem.getBBox().y;
      const height = elem.getBBox().height;
      const offset = elem.closest("svg").parentElement.getBoundingClientRect();
      const matrix = elem.getScreenCTM();
      return {
          x: (matrix.a * x) + (matrix.c * y) + matrix.e - offset.left,
          y: (matrix.b * x) + (matrix.d * y) + matrix.f - offset.top,
          x2: (matrix.a * (x + width)) + (matrix.c * y) + matrix.e - offset.left,
          y2: (matrix.b * x) + (matrix.d * (y + height)) + matrix.f - offset.top
      };
    } else {
      console.warn("Element unavailable on page: ", elem.getAttribute("id"));
      return { x:0, y:0, x2:0, y2:0 }
    }
  }

  ensureArray(val) {
    return Array.isArray(val) ? val : [val]
  }

  calculateQStampForInstant(inst) {
    // qstamp == time in quarter notes (as per verovio timemap
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

  handleClick(qstamp,tl) {
    // seek to earliest instant on the clicked timeline at the clicked scoretime
    if(tl in this.state.instantsByScoretime) {
      this.props.seekToInstant(this.state.instantsByScoretime[tl][qstamp][0]);
    }
  }


  render() {
    return (
      <div id="featureVisContainer">
        <div class="visLabel"> Tempo </div>
        <TempoCurveVis
            width = { this.state.width }
            height = { this.state.height }
            barlinesOnPage = { this.props.barlinesOnPage }
            convertCoords = { this.convertCoords }
            handleClick = { this.handleClick }
            instantsByScoretime = { this.state.instantsByScoretime }
            instantsByScoretimeLastModified = { this.state.instantsByScoretimeLastModified }
            timelinesToVis = { this.props.timelinesToVis }
            noteElementsForInstant = { this.noteElementsForInstant }
            makePoint = { this.makePoint }
            makeLine = { this.makeLine }
          />
        <div class="visLabel"> Dynamics </div>
          <DynamicsVis
            width = { this.state.width }
            height = { this.state.height }
            barlinesOnPage = { this.props.barlinesOnPage }
            convertCoords = { this.convertCoords }
            handleClick = { this.handleClick }
            instantsByScoretime = { this.state.instantsByScoretime }
            instantsByScoretimeLastModified = { this.state.instantsByScoretimeLastModified }
            timelinesToVis = { this.props.timelinesToVis }
            noteElementsForInstant = { this.noteElementsForInstant }
            makePoint = { this.makePoint }
            makeLine = { this.makeLine }
            performedElements = { this.props.performedElements } 
            scoreComponent = { this.props.scoreComponent }
          />
      </div>
    )
  }

  makePoint(className, qstamp, tl, cx, cy, rx, ry, key, titleString) {
    // return SVG for a "point" (e.g. ellipse) on the visualisation
    return <ellipse 
      className={className} 
      data-qstamp={qstamp} 
      cx={cx} cy={cy} 
      rx={rx} ry={ry} 
      id={qstamp} 
      key={key}
      onClick={ () => this.handleClick(qstamp,tl) }>
        <title>{titleString}</title>
      </ellipse>;
  }

  makeLine(className, qstamp, tl, x1, y1, x2, y2, key, titleString) { 
    // return SVG for a line segment on the visualisation
    return <line 
    className={className} 
    data-qstamp={qstamp} 
    x1={x1} y1={y1} 
    x2={x2} y2={y2} 
    key={key}
    onClick={ () => this.handleClick(qstamp,tl) }>
      <title>{titleString}</title>
    </line>;
  }
}

function mapStateToProps({ score }) {
  return { score }
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators( {
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps, false, {forwardRef: true})(FeatureVis);

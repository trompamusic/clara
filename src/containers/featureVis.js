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
      layermap: {},
      currentTimeline: this.props.currentTimeline,
      currentQstamp: "",
      displayTempoCurves: true, 
      displayDynamicsSummary: true, 
      displayDynamicsPerLayer: new Set() // display detailed dynamics for these layer numbers
    }
    this.setInstantsOnPage = this.setInstantsOnPage.bind(this);
    this.setInstantsByScoretime = this.setInstantsByScoretime.bind(this);
    this.setNoteElementsByNoteId = this.setNoteElementsByNoteId.bind(this);
    this.ensureArray = this.ensureArray.bind(this);
    this.calculateQStampForInstant = this.calculateQStampForInstant.bind(this);
    this.noteElementsForInstant = this.noteElementsForInstant.bind(this);
    this.calculateAvgQstampFromNoteIds = this.calculateAvgQstampFromNoteIds.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.makePoint = this.makePoint.bind(this);
    this.makeLine = this.makeLine.bind(this);
    this.makePolygon = this.makePolygon.bind(this);
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
          t.on
            // filter out inserted notes (by definition they don't have a corersponding MEI element)
            .filter((id) => !(id.startsWith("https://terms.trompamusic.eu/maps#inserted")))
            // build score time lookup by MEI note id
            .forEach((id) => {
              timemapByNoteId[id] = {
                qstamp: t.qstamp,
                tstamp: t.tstamp
              }
          });
      });
      // map layer IDs to layer numbers
      const mei = this.props.score.vrvTk.getMEI();
      const meiDoc = new DOMParser().parseFromString(mei, "text/xml");
      const layerElements = Array.from(meiDoc.getElementsByTagName("layer"));
      let layermap = {};
      layerElements.map((l) => layermap[l.getAttribute("xml:id")] = l.getAttribute("n"));
      this.setState({ timemapByNoteId, layermap });
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
          if(!(noteId in this.state.timemapByNoteId && "qstamp" in this.state.timemapByNoteId[noteId])) { 
            console.info("Skipping inserted note in AvgQstmp calculation: ", noteId)
            return sumQ;
          }
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
    let noteElements = this.ensureArray(inst["http://purl.org/vocab/frbr/core#embodimentOf"])
      // filter out inserted notes (as by definition they don't have corresponding MEI elements)
      .filter( (n) => !(n["@id"].startsWith("https://terms.trompamusic.eu/maps#inserted")))
      // return note (DOM) elements corresponding to each embodiment
      .map( (n) => {
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
          return inst && parseFloat(inst["http://purl.org/NET/c4dm/timeline.owl#at"].replace(/[PS]/g, "")) > -1
        }).sort( (a, b) => {
          // ensure order by performance time
          return parseFloat(a["http://purl.org/NET/c4dm/timeline.owl#at"].replace(/[PS]/g, "")) -
          parseFloat(b["http://purl.org/NET/c4dm/timeline.owl#at"].replace(/[PS]/g, ""))
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
        <div id="featureVisControls">
          Features to visualise: 
              <input 
                type="checkbox" 
                defaultChecked={ this.state.displayTempoCurves}
                onChange={ () => 
                  { this.setState({ displayTempoCurves: !this.state.displayTempoCurves }) }
                }
              /> Tempo curves
              <input 
                type="checkbox" 
                defaultChecked={ this.state.displayDynamicsSummary }
                onChange={ () => 
                  { this.setState({ displayDynamicsSummary: !this.state.displayDynamicsSummary }) }
                }
              /> Dynamics (summary)
              <span id="dynamicsPerLayerControls">        
                Detailed dynamics per layer: 
                { [...new Set(Object.values(this.state.layermap).sort())].map( (n) => 
                  <span key={ "dynamicsPerLayerCheckboxWrapper" + n }> 
                    <input 
                      type="checkbox" 
                      checked={ this.state.displayDynamicsPerLayer.has(n) }
                      key={ "dynamicsPerLayerCheckbox" + n }
                      onChange={ () => {
                        const updated = new Set(this.state.displayDynamicsPerLayer);
                        updated.has(n) ? updated.delete(n) : updated.add(n);
                        this.setState({ displayDynamicsPerLayer: updated });
                      }}
                    />{n}
                  </span>
                )}
                <span className="selectDynamicsAggregate" id="selectAllDynamics"
                  onClick= { () => this.setState({ 
                    displayDynamicsPerLayer: new Set(Object.values(this.state.layermap))
                  })}
                >All</span>
                <span className="selectDynamicsAggregate" id="selectNoDynamics"
                  onClick= { () => this.setState({ 
                    displayDynamicsPerLayer: new Set()
                  })}
                >None</span>
              </span>
        </div>
        { this.state.displayTempoCurves 
         ? <> <div className="visLabel"> Tempo </div>
            <TempoCurveVis
              width = { this.state.width }
              height = { this.state.height }
              currentTimeline = { this.props.currentTimeline }
              barlinesOnPage = { this.props.barlinesOnPage }
              convertCoords = { this.props.convertCoords }
              handleClick = { this.handleClick }
              instantsByScoretime = { this.state.instantsByScoretime }
              instantsByScoretimeLastModified = { this.state.instantsByScoretimeLastModified }
              timelinesToVis = { this.props.timelinesToVis }
              noteElementsForInstant = { this.noteElementsForInstant }
              makePoint = { this.makePoint }
              makeLine = { this.makeLine }
            /></>
          : <></>
        }
        { this.state.displayDynamicsSummary || this.state.displayDynamicsPerLayer.size
          ? <>
              <DynamicsVis
                width = { this.state.width }
                height = { this.state.height }
                currentTimeline = { this.props.currentTimeline }
                barlinesOnPage = { this.props.barlinesOnPage }
                convertCoords = { this.props.convertCoords }
                handleClick = { this.handleClick }
                instantsByScoretime = { this.state.instantsByScoretime }
                instantsByScoretimeLastModified = { this.state.instantsByScoretimeLastModified }
                timelinesToVis = { this.props.timelinesToVis }
                noteElementsForInstant = { this.noteElementsForInstant }
                makePoint = { this.makePoint }
                makeLine = { this.makeLine }
                makePolygon = { this.makePolygon }
                performedElements = { this.props.performedElements } 
                layermap = { this.state.layermap }
                scoreComponent = { this.props.scoreComponent }
                displayDynamicsSummary = { this.state.displayDynamicsSummary }
                displayDynamicsPerLayer =  { this.state.displayDynamicsPerLayer }
              />
            </>
          : <></>
        }
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

  makePolygon(className, tl, points, key, titleString) { 
    return <polygon
    className={className}
    points={points}
    key={key}
    >
      <title>{titleString}</title>
    </polygon>;
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

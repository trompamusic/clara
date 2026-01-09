import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import TempoCurveVis from "./TempoCurveVis";
import ErrorRibbonVis from "./ErrorRibbonVis";
import DynamicsVis from "./DynamicsVis";
import ZoomBox from "./ZoomBox";
import FeatureVisControls from "./FeatureVisControls";
import {
  readFeatureVisPrefs,
  writeFeatureVisPrefs,
} from "./featureVisPreferences";

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
      staffmap: {}, // keeps the mapping from staff xml:id to staff n's
      stafflayermap: {}, // mapping from staff xml:id to contained layer id's, and from there to layer n's
      stafflayertuples: new Set(), // set of staff n : layer n tuples
      currentTimeline: this.props.currentTimeline,
      currentQstamp: "",
      errors: {},
      noteAttributes: {}, // lookup table of pname and oct by note id
      displayTempoCurves: true,
      displayErrorRibbon: true,
      displayDynamicsSummary: true,
      displayDynamicsPerStaff: new Set(), // display detailed dynamics for these staff numbers
      displayDynamicsPerStaffLayer: new Set(), // display detailed dynamics for these staff-layer numbers
      zoomBoxLeft: "0px",
      zoomBoxTop: "0px",
      zoomBoxVisibility: "hidden",
      zoomBoxScoretime: null,
      zoomBoxTimeline: null,
      controlsLoaded: false,
    };
    this.zoomBoxDisplayTimer = null;
  }

  componentDidMount() {
    // ON ELEMENT LOAD
    // Get handles for note elements on current (i.e., first) page...
    this.setNoteElementsByNoteId();
    // Calculate Verovio timemap, i.e. the score times
    this.setState({ timemap: this.props.score.vrvTk.renderToTimemap() }, () => {
      let timemapByNoteId = {};
      // generate "inverted" timemap (by note onset)
      this.state.timemap
        .filter((t) => {
          // only care about times with onsets
          return "on" in t;
        })
        .forEach((t) => {
          t.on
            // filter out inserted notes (by definition they don't have a corersponding MEI element)
            .filter(
              (id) =>
                !id.startsWith("https://terms.trompamusic.eu/maps#inserted"),
            )
            // build score time lookup by MEI note id
            .forEach((id) => {
              timemapByNoteId[id] = {
                qstamp: t.qstamp,
                tstamp: t.tstamp,
              };
            });
        });
      // map staff IDs to staff numbers
      const mei = this.props.score.vrvTk.getMEI();
      const meiDoc = new DOMParser().parseFromString(mei, "text/xml");
      const staffElements = Array.from(meiDoc.getElementsByTagName("staff"));
      const layerElements = Array.from(meiDoc.getElementsByTagName("layer"));
      let staffmap = {};
      let stafflayermap = {};
      const newTuples = new Set(this.state.stafflayertuples);
      staffElements.forEach(
        (s) => (staffmap[s.getAttribute("xml:id")] = s.getAttribute("n")),
      );
      layerElements.forEach((l) => {
        const layerId = l.getAttribute("xml:id");
        const layerN = l.getAttribute("n");
        const s = l.closest("staff");
        const staffId = s.getAttribute("xml:id");
        const staffN = s.getAttribute("n");
        if (!(staffId in stafflayermap)) {
          stafflayermap[staffId] = { [layerId]: l.getAttribute("n") };
        } else {
          stafflayermap[staffId][layerId] = l.getAttribute("n");
        }
        newTuples.add(staffN + ":" + layerN);
      });
      // look up note attributes (pname, octave...)
      const noteElements = Array.from(meiDoc.getElementsByTagName("note"));
      const noteAttributes = {};
      noteElements.forEach((n) => {
        noteAttributes[n.getAttribute("xml:id")] = {
          pname: n.getAttribute("pname"),
          oct: n.getAttribute("oct"),
        };
      });
      this.setState({
        timemapByNoteId,
        staffmap,
        stafflayermap,
        noteAttributes,
        stafflayertuples: newTuples,
      });
    });
  }

  componentDidUpdate(prevProps) {
    //if(prevProps.notesOnPage[0] !== this.props.notesOnPage[0]
    if (
      prevProps.latestScoreUpdateTimestamp <
      this.props.latestScoreUpdateTimestamp
    ) {
      // page changed, set handles for note elements on new page
      this.setNoteElementsByNoteId();
    }
    if (prevProps.currentTimeline !== this.props.currentTimeline) {
      // selected timeline has changed, update state accordingly
      this.setState({ currentTimeline: this.props.currentTimeline });
    }
    if (
      "currentlyActiveNoteIds" in prevProps &&
      prevProps.currentlyActiveNoteIds.join("") !==
        this.props.currentlyActiveNoteIds.join("")
    ) {
      // "active" (highlighted) note Ids have changed, update current score time
      this.setState({
        currentQstamp: this.calculateAvgQstampFromNoteIds(
          this.props.currentlyActiveNoteIds,
        ),
      });
    }
    // Load persisted controls once staff information is available
    if (
      !this.state.controlsLoaded &&
      (Object.keys(this.state.staffmap).length ||
        this.state.stafflayertuples.size)
    ) {
      this.loadControlsFromStorage();
      this.setState({ controlsLoaded: true });
    }
    // If the bound URI changes, reload preferences for the new key
    if (prevProps.uri !== this.props.uri) {
      this.setState({ controlsLoaded: false }, () => {
        if (
          Object.keys(this.state.staffmap).length ||
          this.state.stafflayertuples.size
        ) {
          this.loadControlsFromStorage();
          this.setState({ controlsLoaded: true });
        }
      });
    }
  }

  getStorageKey = () => {
    return this.props.uri ? `at.ac.mdw.trompa:${this.props.uri}` : null;
  };

  persistControls = () => {
    writeFeatureVisPrefs(this.props.uri, {
      displayTempoCurves: this.state.displayTempoCurves,
      displayErrorRibbon: this.state.displayErrorRibbon,
      displayDynamicsSummary: this.state.displayDynamicsSummary,
      displayDynamicsPerStaff: Array.from(this.state.displayDynamicsPerStaff),
      displayDynamicsPerStaffLayer: Array.from(
        this.state.displayDynamicsPerStaffLayer,
      ),
    });
  };

  loadControlsFromStorage = () => {
    const availableStaff = new Set(Object.values(this.state.staffmap));
    const availableTuples = new Set(this.state.stafflayertuples);
    const loaded = readFeatureVisPrefs(
      this.props.uri,
      availableStaff,
      availableTuples,
    );
    if (!loaded) return;
    this.setState(
      {
        displayTempoCurves: loaded.displayTempoCurves,
        displayErrorRibbon: loaded.displayErrorRibbon,
        displayDynamicsSummary: loaded.displayDynamicsSummary,
        displayDynamicsPerStaff: new Set(loaded.displayDynamicsPerStaff),
        displayDynamicsPerStaffLayer: new Set(
          loaded.displayDynamicsPerStaffLayer,
        ),
      },
      this.persistControls,
    );
  };

  calculateAvgQstampFromNoteIds = (noteIds) => {
    return (
      noteIds.reduce((sumQ, noteId) => {
        if (
          !(
            noteId in this.state.timemapByNoteId &&
            "qstamp" in this.state.timemapByNoteId[noteId]
          )
        ) {
          console.info(
            "Skipping inserted note in AvgQstmp calculation: ",
            noteId,
          );
          return sumQ;
        }
        return (sumQ += this.state.timemapByNoteId[noteId].qstamp);
      }, 0) / noteIds.length
    );
  };

  setInstantsByScoretime = () => {
    let instantsByScoretime = {};
    // for each timeline we need to visualise:
    this.props.timelinesToVis.forEach((tl) => {
      instantsByScoretime[tl] = {};
      // for each timeline instant
      this.state.instantsOnPage[tl].forEach((inst) => {
        // average qstamps of note onsets at this instant
        let embodimentsAtInstant = this.props.ensureArray(
          inst["http://purl.org/vocab/frbr/core#embodimentOf"],
        );
        let noteIdsAtInstant = embodimentsAtInstant.map((n) => {
          return n["@id"].substr(n["@id"].lastIndexOf("#") + 1);
        });
        const avgQstamp = this.calculateAvgQstampFromNoteIds(noteIdsAtInstant);
        // conceivable that distinct performed instants share a scoretime
        // so, maintain an array of instants at each scoretime
        if (avgQstamp in instantsByScoretime[tl]) {
          instantsByScoretime[tl][avgQstamp].push(inst);
        } else {
          instantsByScoretime[tl][avgQstamp] = [inst];
        }
      });
    });
    this.setState({
      instantsByScoretime: instantsByScoretime,
      instantsByScoretimeLastModified: new Date().valueOf(),
    });
  };

  setNoteElementsByNoteId = () => {
    let noteElementsByNoteId = {};
    Array.from(this.props.notesOnPage).forEach((note) => {
      noteElementsByNoteId[note.getAttribute("id")] = note;
    });
    this.setState({ noteElementsByNoteId }, () => {
      // now set instants on page
      this.setInstantsOnPage();
    });
  };

  noteElementsForInstant = (inst) => {
    let noteElements = this.props
      .ensureArray(inst["http://purl.org/vocab/frbr/core#embodimentOf"])
      // filter out inserted notes (as by definition they don't have corresponding MEI elements)
      .filter(
        (n) =>
          !n["@id"].startsWith("https://terms.trompamusic.eu/maps#inserted"),
      )
      // return note (DOM) elements corresponding to each embodiment
      .map((n) => {
        return this.state.noteElementsByNoteId[
          n["@id"].substr(n["@id"].lastIndexOf("#") + 1)
        ];
      });
    noteElements = noteElements.filter((note) => {
      // filter out undefined notes (deleted notes might not be notesOnPage)
      return note;
    });
    return noteElements;
  };

  setInstantsOnPage = () => {
    if (Object.keys(this.props.instantsByNoteId).length) {
      let instantsOnPage = {};
      // for each timeline we need to visualise:
      this.props.timelinesToVis.forEach((tl) => {
        // find the instants coresponding to notes on this page
        instantsOnPage[tl] = Array.from(this.props.notesOnPage)
          .map((note) => {
            return this.props.instantsByNoteId[tl][note.getAttribute("id")];
          })
          .filter((inst) => {
            // filter out undefined instants (i.e. when note doesn't appear in timeline)
            // and instants at duration -1 (deleted notes)
            return (
              inst &&
              parseFloat(
                inst["http://purl.org/NET/c4dm/timeline.owl#at"].replace(
                  /[PS]/g,
                  "",
                ),
              ) > -1
            );
          })
          .sort((a, b) => {
            // ensure order by performance time
            return (
              parseFloat(
                a["http://purl.org/NET/c4dm/timeline.owl#at"].replace(
                  /[PS]/g,
                  "",
                ),
              ) -
              parseFloat(
                b["http://purl.org/NET/c4dm/timeline.owl#at"].replace(
                  /[PS]/g,
                  "",
                ),
              )
            );
          });
        instantsOnPage[tl] = instantsOnPage[tl].filter((inst, ix) => {
          return ix > 0 && inst["@id"] !== instantsOnPage[tl][ix - 1]["@id"];
        });
      });
      this.setState({ instantsOnPage }, () => {
        // now set instantsByScoretime
        this.setInstantsByScoretime();
      });
    }
  };

  handleMouseEnter = (e, qstamp, tl) => {
    const clientRect = e.getBoundingClientRect();
    if (typeof e !== "undefined" && !e.classList.contains("inpainted")) {
      this.setState({
        zoomBoxLeft: Math.round(clientRect.x),
        zoomBoxTop: Math.round(clientRect.y),
        zoomBoxVisibility: "visible",
        zoomBoxScoretime: qstamp,
        zoomBoxTimeline: tl,
      });
    }
  };

  handleMouseLeave = (e) => {
    if (typeof e !== "undefined" && !e.classList.contains("inpainted")) {
      this.setState({
        zoomBoxVisibility: "hidden",
      });
    }
  };

  calculateQStampForInstant = (inst) => {
    // qstamp == time in quarter notes (as per verovio timemap
    // as multiple notes (with potentially different qstamps) could share a performed
    // instant, calculate an (average) qstamp per instant here
    const noteElements = this.noteElementsForInstant(inst);
    const sumQ = noteElements.reduce((q, note) => {
      const noteId = note.getAttribute("id");
      const qstamp = this.state.timemapByNoteId[noteId].qstamp;
      return (q += qstamp);
    }, 0);
    return sumQ / noteElements.length;
  };

  handleClick = (qstamp, tl) => {
    // seek to earliest instant on the clicked timeline at the clicked scoretime
    if (
      tl in this.state.instantsByScoretime &&
      qstamp in this.state.instantsByScoretime[tl]
    ) {
      this.props.seekToInstant(this.state.instantsByScoretime[tl][qstamp][0]);
    }
  };

  handleClickSeekToInstant = (atTime, tl) => {
    // seek to this instant on the clicked timeline
    if (tl in this.state.instantsByScoretime) {
      this.props.seekToInstant(atTime);
    }
  };

  render() {
    return (
      <div
        id="featureVisContainer"
        className={this.props.mode === "featureVis" ? "" : "removedFromDisplay"}
      >
        <ZoomBox
          left={this.state.zoomBoxLeft}
          top={this.state.zoomBoxTop}
          visibility={this.state.zoomBoxVisibility}
          scoretime={this.state.zoomBoxScoretime}
          timeline={this.state.zoomBoxTimeline}
          instantsByScoretime={this.state.instantsByScoretime}
          performedElements={this.props.performedElements}
          performanceErrors={this.state.performanceErrors}
          noteAttributes={this.state.noteAttributes}
          ensureArray={this.props.ensureArray}
          makePoint={this.makePoint}
          makeLine={this.makeLine}
          width="300"
          height="300"
        />
        <FeatureVisControls
          displayTempoCurves={this.state.displayTempoCurves}
          displayErrorRibbon={this.state.displayErrorRibbon}
          displayDynamicsSummary={this.state.displayDynamicsSummary}
          displayDynamicsPerStaff={this.state.displayDynamicsPerStaff}
          displayDynamicsPerStaffLayer={this.state.displayDynamicsPerStaffLayer}
          staffmap={this.state.staffmap}
          stafflayertuples={this.state.stafflayertuples}
          onToggleTempoCurves={() =>
            this.setState(
              { displayTempoCurves: !this.state.displayTempoCurves },
              this.persistControls,
            )
          }
          onToggleErrorRibbon={() =>
            this.setState(
              { displayErrorRibbon: !this.state.displayErrorRibbon },
              this.persistControls,
            )
          }
          onToggleDynamicsSummary={() =>
            this.setState(
              { displayDynamicsSummary: !this.state.displayDynamicsSummary },
              this.persistControls,
            )
          }
          onTogglePerStaff={(n) => {
            const updated = new Set(this.state.displayDynamicsPerStaff);
            updated.has(n) ? updated.delete(n) : updated.add(n);
            this.setState(
              { displayDynamicsPerStaff: updated },
              this.persistControls,
            );
          }}
          onSelectAllPerStaff={() =>
            this.setState(
              {
                displayDynamicsPerStaff: new Set(
                  Object.values(this.state.staffmap),
                ),
              },
              this.persistControls,
            )
          }
          onSelectNonePerStaff={() =>
            this.setState(
              { displayDynamicsPerStaff: new Set() },
              this.persistControls,
            )
          }
          onTogglePerStaffLayer={(n) => {
            const updated = new Set(this.state.displayDynamicsPerStaffLayer);
            updated.has(n) ? updated.delete(n) : updated.add(n);
            this.setState(
              { displayDynamicsPerStaffLayer: updated },
              this.persistControls,
            );
          }}
          onSelectAllPerStaffLayer={() =>
            this.setState(
              {
                displayDynamicsPerStaffLayer: new Set(
                  this.state.stafflayertuples,
                ),
              },
              this.persistControls,
            )
          }
          onSelectNonePerStaffLayer={() =>
            this.setState(
              { displayDynamicsPerStaffLayer: new Set() },
              this.persistControls,
            )
          }
        />
        <div
          className={this.state.displayTempoCurves ? "" : "removedFromDisplay"}
        >
          <div
            className={
              this.state.displayTempoCurves ? "visLabel" : "removedFromDisplay"
            }
          >
            {" "}
            Tempo{" "}
          </div>
          <TempoCurveVis
            width={this.state.width}
            height={this.state.height}
            currentTimeline={this.props.currentTimeline}
            barlinesOnPage={this.props.barlinesOnPage}
            convertCoords={this.props.convertCoords}
            handleClick={this.handleClick}
            displayTempoCurves={this.state.displayTempoCurves}
            currentQstamp={this.state.currentQstamp}
            instantsByScoretime={this.state.instantsByScoretime}
            instantsByScoretimeLastModified={
              this.state.instantsByScoretimeLastModified
            }
            timelinesToVis={this.props.timelinesToVis}
            noteElementsForInstant={this.noteElementsForInstant}
            makePoint={this.makePoint}
            makeLine={this.makeLine}
            instantsByNoteId={this.props.instantsByNoteId}
            timemapByNoteId={this.state.timemapByNoteId}
            ensureArray={this.props.ensureArray}
          />
        </div>
        <div
          className={
            this.state.displayErrorRibbon
              ? "errorRibbon"
              : "errorRibbon removedFromDisplay"
          }
          style={{ height: this.state.height + "px" }}
        >
          <div
            className={
              this.state.displayErrorRibbon ? "visLabel" : "removedFromDisplay"
            }
          >
            {" "}
            Error visualisation{" "}
          </div>
          <ErrorRibbonVis
            width={this.state.width}
            height={this.state.height}
            currentTimeline={this.props.currentTimeline}
            timelinesToVis={this.props.timelinesToVis}
            barlinesOnPage={this.props.barlinesOnPage}
            convertCoords={this.props.convertCoords}
            handleClick={this.handleClick}
            handleClickSeekToInstant={this.handleClickSeekToInstant}
            instantsOnPage={this.state.instantsOnPage}
            instantsByPerfTime={this.props.instantsByPerfTime}
            instantsByScoretime={this.state.instantsByScoretime}
            instantsByScoretimeLastModified={
              this.state.instantsByScoretimeLastModified
            }
            noteElementsForInstant={this.noteElementsForInstant}
            notesOnPage={this.props.notesOnPage}
            performanceErrors={this.props.performanceErrors}
            timemapByNoteId={this.state.timemapByNoteId}
            timemap={this.state.timemap}
            latestScoreUpdateTimestamp={this.props.latestScoreUpdateTimestamp}
            scoreComponent={this.props.scoreComponent}
            makeRect={this.makeRect}
            makeLine={this.makeLine}
            makePoint={this.makePoint}
            ensureArray={this.props.ensureArray}
          />
        </div>
        <DynamicsVis
          width={this.state.width}
          height={this.state.height}
          currentTimeline={this.props.currentTimeline}
          currentQstamp={this.state.currentQstamp}
          barlinesOnPage={this.props.barlinesOnPage}
          convertCoords={this.props.convertCoords}
          handleClick={this.handleClick}
          instantsByScoretime={this.state.instantsByScoretime}
          instantsByScoretimeLastModified={
            this.state.instantsByScoretimeLastModified
          }
          timelinesToVis={this.props.timelinesToVis}
          noteElementsForInstant={this.noteElementsForInstant}
          makePoint={this.makePoint}
          makeLine={this.makeLine}
          makePolygon={this.makePolygon}
          performedElements={this.props.performedElements}
          staffmap={this.state.staffmap}
          stafflayermap={this.state.stafflayermap}
          stafflayertuples={this.state.stafflayertuples}
          scoreComponent={this.props.scoreComponent}
          displayDynamicsSummary={this.state.displayDynamicsSummary}
          displayDynamicsPerStaff={this.state.displayDynamicsPerStaff}
          displayDynamicsPerStaffLayer={this.state.displayDynamicsPerStaffLayer}
        />
      </div>
    );
  }

  makeRect = (
    className,
    qstamp,
    tl,
    x,
    y,
    width,
    height,
    key,
    titleString,
    clickHandler = () => this.handleClick(qstamp, tl),
  ) => {
    // return SVG for a "point" (e.g. ellipse) on the visualisation
    return (
      <rect
        className={className}
        data-qstamp={qstamp}
        x={x}
        y={y}
        width={width}
        height={height}
        id={qstamp}
        key={key}
        onClick={clickHandler}
      >
        <title>{titleString}</title>
      </rect>
    );
  };

  makePoint = (
    className,
    qstamp,
    tl,
    cx,
    cy,
    rx,
    ry,
    key,
    titleString,
    colour = "",
  ) => {
    // return SVG for a "point" (e.g. ellipse) on the visualisation
    return (
      <ellipse
        className={className}
        data-qstamp={qstamp}
        data-timeline={tl}
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        id={tl + "-" + qstamp}
        key={key}
        fill={colour}
        stroke={colour}
        onClick={() => this.handleClick(qstamp, tl)}
        onMouseEnter={(e) => {
          clearTimeout(this.zoomBoxDisplayTimer);
          this.handleMouseEnter(e.currentTarget, qstamp, tl);
        }}
        onMouseLeave={(e) => {
          this.zoomBoxDisplayTimer = setTimeout(
            this.handleMouseLeave(e.currentTarget),
            500,
          );
        }}
      >
        {/*<title>{titleString}</title>*/}
      </ellipse>
    );
  };

  makeLine = (className, qstamp, tl, x1, y1, x2, y2, key, titleString) => {
    // return SVG for a line segment on the visualisation
    return (
      <line
        className={className}
        data-qstamp={qstamp}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        key={key}
        onClick={() => this.handleClick(qstamp, tl)}
      >
        <title>{titleString}</title>
      </line>
    );
  };

  makePolygon = (className, tl, points, key, titleString) => {
    return (
      <polygon className={className} points={points} key={key}>
        <title>{titleString}</title>
      </polygon>
    );
  };
}

function mapStateToProps({ score }) {
  return { score };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({}, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps, false, {
  forwardRef: true,
})(FeatureVis);

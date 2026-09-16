import React, { Component } from "react";
import ReactDOM from "react-dom";
import PropTypes, { InferProps } from "prop-types";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import equal from "fast-deep-equal";

import ClaraScore from "../../score/ClaraScore";
import PageControls from "../../score/PageControls";
import withScore from "../../score/withScore";

import {
  traverse,
  registerTraversal,
  setTraversalObjectives,
  checkTraversalObjectives,
  registerClock,
  tickTimedResource,
} from "meld-clients-core/lib/actions/index";

import FeatureVis from "./FeatureVis";
import { measureScorePage } from "../../score/measureScorePage";
import { MidiPlayer } from "./MidiPlayer";
import AuthenticatedMediaPlayer from "./AuthenticatedMediaPlayer";
import {
  readFeatureVisModePreference,
  writeFeatureVisModePreference,
} from "./featureVisPreferences";

const vrvOptionsPageView = {
  scale: 45,
  adjustPageHeight: true,
  pageHeight: 2000,
  pageWidth: 2400,
  footer: "none",
  unit: 6,
  breaks: "encoded",
  svgAdditionalAttribute: ["note@pname", "note@oct"],
};

const vrvOptionsFeatureVis = {
  scale: 45,
  adjustPageHeight: true,
  pageHeight: 100,
  pageWidth: 3000,
  breaks: "line",
  footer: "none",
  header: "none",
  unit: 6,
  svgAdditionalAttribute: ["clef@shape", "clef@line"],
};

export class Companion extends Component {
  /** @type {CompanionProps} */
  props;
  constructor(props) {
    super(props);
    this.state = {
      performances: [],
      segments: [],
      instants: [],
      instantsByPerfTime: [],
      instantsByNoteId: [],
      notesOnPage: [],
      committedPage: null,
      selectedVideo: "",
      selectedPerformance: "",
      performanceSelectionCleared: false,
      lastMediaTick: 0,
      previouslyActive: [],
      currentlyActiveNoteIds: [],
      currentPerfSegment: {},
      currentSegment: {},
      currentScore: "",
      seekTo: "",
      videoOffset: 0, // in seconds
      activeWindow: 0.1, // window of notes before current instant considered active, in seconds
      traversalThreshold: 10, // max parallel traversal threads,
      loading: true, // flip when traversals are completed
      scoreFollowing: true, // if true, page automatically with playback
      showVelocities: true, // if true, visualise note velocities
      showInsertedDeleted: true, // if true, visualise note insertions and deletions
      minMappedVelocity: 0, // minimum opacity (when note played at smallest expected velocity
      maxMappedVelocity: 255, // max opacity (when note played at largest expected velocity)
      minExpectedVel: 0, // guesstimate as to a note played at pianissimo (unit: midi velocity)
      maxExpectedVel: 110, // guesstimate as to a note played at fortissimo (unit: midi velocity)
      isPlaying: false,
      mode: "pageView", // currently either pageView (portrait style) or featureVis (flattened single-system with visualisation)
      vrvOptions: vrvOptionsPageView,
      performedElements: {},
      performanceErrors: {},
    };
    this.player = React.createRef();
    this.scoreComponent = React.createRef();
    this.initialPerformanceAppliedId = "";
    this.featureVisPreferenceAppliedForUri = null;
  }

  UNSAFE_componentWillMount() {
    this.props.setTraversalObjectives([
      { "@type": "http://purl.org/ontology/mo/Performance" },
      { "@type": "http://www.linkedmusic.org/ontologies/segment/Segment" },
      { "@type": "http://purl.org/NET/c4dm/timeline.owl#Instant" },
      { "@type": "http://www.w3.org/ns/oa#Annotation" },
      { "@type": "http://purl.org/ontology/mo/Score" },
    ]);
  }

  componentDidMount() {
    console.log(
      "Attempting to start traversal with ",
      this.props.uri,
      " with profile: ",
      this.props.userProfile,
    );
    const params = {
      numHops: 6,
      extendObjectPrefix: [],
    };
    if (this.props.userPOD) {
      // TODO: Handle case where userPod ends with a / or not.
      // If we are to load any resources from the external web,
      // e.g. MEI files or segmentations,
      // we must add them all to the whitelist!
      params["extendObjectPrefix"] = [
        this.props.userPOD,
        ...params["extendObjectPrefix"],
        "https://clara.solidcommunity.net/",
      ];
      params["ignoreObjectPrefix"] = [
        `${this.props.userPOD}at.ac.mdw.trompa/midi`,
        `${this.props.userPOD}at.ac.mdw.trompa/webmidi`,
        `${this.props.userPOD}at.ac.mdw.trompa/audio`,
        `${this.props.userPOD}/private/audio`,
        `${this.props.userPOD}private/audio`,
        `https://tpl-alignment-test.trompa-solid.upf.edu/public/mei`,
      ];
    }
    this.props.registerTraversal(this.props.uri, params);
    document.addEventListener("keydown", this.monitorKeys);
    window.addEventListener("resize", this.remeasureScorePage);
    this.setState({
      vrvOptions:
        this.state.mode === "featureVis"
          ? vrvOptionsFeatureVis
          : vrvOptionsPageView,
    });
  }

  isGraphReady = () => {
    const timelineIds = Object.keys(this.state.instantsByNoteId || {});
    return (
      !this.state.loading &&
      this.state.performances.length > 0 &&
      timelineIds.length > 0
    );
  };

  persistFeatureVisMode = (mode) => {
    writeFeatureVisModePreference(this.props.uri, mode);
    if (this.props.uri) {
      this.featureVisPreferenceAppliedForUri = this.props.uri;
    }
  };

  applyFeatureVisModePreference = () => {
    if (!this.isGraphReady()) {
      return;
    }
    const { uri, selectedPerformance } = this.props;
    if (
      !uri ||
      !selectedPerformance ||
      this.featureVisPreferenceAppliedForUri === uri
    ) {
      return;
    }
    const selectedPerformanceId =
      this.state.selectedPerformance && this.state.selectedPerformance["@id"];
    if (selectedPerformanceId !== selectedPerformance) {
      // Wait until the requested performance has been selected via traversal
      return;
    }
    const savedMode = readFeatureVisModePreference(uri);
    if (savedMode && savedMode !== this.state.mode) {
      if (savedMode === "featureVis") {
        this.setModeFeatureVis();
      } else {
        this.setModePageView();
      }
      return;
    }
    this.featureVisPreferenceAppliedForUri = uri;
  };

  deleteSelectedPerformance = () => {
    if (
      window.confirm(
        "Do you really wish to PERMANENTLY DELETE this performance? " +
          this.state.selectedPerformance[
            "http://www.w3.org/2000/01/rdf-schema#label"
          ],
      )
    ) {
      this.props
        .fetch(this.state.selectedPerformance["@id"], { method: "DELETE" })
        .then(() => {
          /*
          timelinesToVis = { Object.keys(this.state.instantsByNoteId) }
          this.setState({
            performances: this.state.performances.filter((p) => p["@id"] !== this.state.selectedPerformance["@id"]),
            selectedPerformance:"",
            currentTimeline: ""
          })
        })
        */
          window.location.reload();
        })
        .catch((e) =>
          console.error(
            "Couldn't delete selected performance: ",
            this.state.selectedPerformance["@id"],
            e,
          ),
        );
    }
  };

  get scoreReady() {
    return (
      this.props.scoreState.status === "ready" &&
      this.props.scoreState.uri === this.state.currentScore
    );
  }

  scoreResetState = () => ({ notesOnPage: [], committedPage: null });

  // Score SVG commits before this parent's componentDidUpdate. Keep geometry
  // local to the DOM owner; the provider publishes only renderer data.
  syncScoreDom = () => {
    const score = this.props.scoreState;
    if (!this.scoreReady) {
      this.measuredScore = null;
      if (this.state.committedPage) this.setState(this.scoreResetState());
      return;
    }
    if (this.state.loading || this.measuredScore === score) return;
    const svg = this.scoreComponent.current?.querySelector(".score > svg");
    if (!svg) {
      this.props.scoreCommands.reportRenderFailure(
        score,
        new Error("Verovio returned no score SVG"),
      );
      return;
    }
    const committedPage = {
      uri: score.uri,
      page: score.currentPage,
      generation: score.generation,
      appliedOptions: score.appliedOptions,
      mei: score.mei,
      timemap: score.timemap,
      geometry:
        this.state.mode === "featureVis" &&
        equal(score.appliedOptions, this.state.vrvOptions)
          ? measureScorePage(svg)
          : null,
    };
    this.measuredScore = score;
    this.setState({
      committedPage,
      notesOnPage: svg.querySelectorAll(".note"),
    });
  };

  remeasureScorePage = () => {
    const record = this.state.committedPage;
    const svg = this.scoreComponent.current?.querySelector(".score > svg");
    if (
      !this.scoreReady ||
      this.measuredScore !== this.props.scoreState ||
      this.state.mode !== "featureVis" ||
      !record?.geometry ||
      !svg?.isConnected
    )
      return;
    const geometry = measureScorePage(svg);
    this.setState((state) =>
      state.committedPage === record
        ? { committedPage: { ...record, geometry } }
        : null,
    );
  };

  componentDidUpdate(prevProps, prevState) {
    this.syncScoreDom();
    if (
      prevProps.uri !== this.props.uri ||
      prevProps.selectedPerformance !== this.props.selectedPerformance
    ) {
      this.featureVisPreferenceAppliedForUri = null;
    }
    this.applyInitialPerformanceSelection();
    this.applyFeatureVisModePreference();
    if (
      "traversalPool" in prevProps &&
      Object.keys(this.props.traversalPool.pool).length === 0 &&
      prevProps.traversalPool.running > 0 &&
      this.props.traversalPool.running === 0
    ) {
      // finished all traversals
      this.setState({ loading: false }, () => {
        this.props.checkTraversalObjectives(
          this.props.graph.graph,
          this.props.graph.objectives,
        );
      });
    }
    if ("graph" in prevProps) {
      // check our traversal objectives if the graph has updated
      if (
        !prevProps.graph.allObjectivesApplied &&
        this.props.graph.allObjectivesApplied
      ) {
        // outcomes have changed, need to update our projections!
        this.processTraversalOutcomes(this.props.graph.outcomes);
      }
    }
    if (
      "traversalPool" in this.props && // if traversal pool reducer ready
      Object.keys(this.props.traversalPool.pool).length && // and a traversal is waiting in the pool
      this.props.traversalPool.running < this.state.traversalThreshold // and we don't have too many
    ) {
      // then start another traversal
      const nextTraversalUri = Object.keys(this.props.traversalPool.pool)[0];
      const nextTraversalParams =
        this.props.traversalPool.pool[nextTraversalUri];
      this.props.traverse(nextTraversalUri, nextTraversalParams);
    }

    if (
      this.scoreReady &&
      this.state.selectedPerformance &&
      (prevState.committedPage !== this.state.committedPage ||
        prevState.selectedPerformance !== this.state.selectedPerformance)
    ) {
      this.highlightDeletedNotes();
    }
  }

  componentWillUnmount() {
    // clean up...
    document.removeEventListener("keydown", this.monitorKeys);
    window.removeEventListener("resize", this.remeasureScorePage);
  }

  getTargetNoteForModeSwitch = () => {
    // Determine which note to focus on after mode switch:
    // - If playing with active notes, follow the currently sounding note
    // - Otherwise, follow the first note visible on the current page
    if (this.state.isPlaying && this.state.currentlyActiveNoteIds.length > 0) {
      return this.state.currentlyActiveNoteIds[0];
    }
    if (this.state.notesOnPage && this.state.notesOnPage.length > 0) {
      return this.state.notesOnPage[0].getAttribute("id");
    }
    return null;
  };

  setMode = (mode, options) => {
    if (this.state.mode === mode) return;
    const targetNote = this.getTargetNoteForModeSwitch();
    this.persistFeatureVisMode(mode);
    // Keyboard events use a native listener in React 16. Batch the UI mode and
    // final score snapshot so they commit together there as well as on clicks.
    ReactDOM.unstable_batchedUpdates(() => {
      this.setState({ mode, vrvOptions: options });
      this.props.scoreCommands.applyModeChange(options, targetNote);
    });
  };

  setModeFeatureVis = () => this.setMode("featureVis", vrvOptionsFeatureVis);
  setModePageView = () => this.setMode("pageView", vrvOptionsPageView);

  monitorKeys = (e) => {
    if (this.scoreReady) {
      switch (e.which) {
        case 37: // left arrow
          this.props.scoreCommands.prevPage();
          break;
        case 39: // right arrow
          this.props.scoreCommands.nextPage();
          break;
        case 70: // 'f'  => "follow"
          if (this.state.selectedPerformance) {
            this.setState({ scoreFollowing: !this.state.scoreFollowing });
          }
          break;
        case 80: // 'p'  => "pageView"
          this.setModePageView();
          break;
        case 86: // 'v'  => "featureVis"
          this.setModeFeatureVis();
          break;
      }
    }
  };

  highlightDeletedNotes = () => {
    // highlight deleted notes (i.e., notes missed out during performance) on this page
    // n.b. per Nakamura alignment convention, deleted notes have a performance time of -1
    //
    // first, tidy up left-over deleted notes from previous invocations (e.g. on another performance)
    Array.prototype.map.call(
      document.querySelectorAll(".note.deleted"),
      (d) => {
        d.classList.remove("deleted");
      },
    );
    if (this.state.selectedPerformance && this.state.showInsertedDeleted) {
      //FIXME Skolemization bug currently causing two identical times (intervals), one for performance and one for signal. For now, pick the first
      const thisTime = this.ensureArray(
        this.state.selectedPerformance[
          "http://purl.org/ontology/mo/recorded_as"
        ]["http://purl.org/ontology/mo/time"],
      );
      const thisTimeline =
        thisTime[0]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"];
      const deletedNotesInstant = this.state.instantsByPerfTime[
        thisTimeline
      ].filter((i) => {
        let dur = i["http://purl.org/NET/c4dm/timeline.owl#at"];
        dur = parseInt(dur.substr(1, dur.length - 2));
        return dur === -1; // all deleted notes "occur" at this instant
      });
      if (deletedNotesInstant.length) {
        // could be 0 in a perfect performance...
        const deletedNotes =
          deletedNotesInstant[0][
            "http://purl.org/vocab/frbr/core#embodimentOf"
          ];
        deletedNotes.forEach((n) => {
          let noteOnPage = document.getElementById(
            n["@id"].substr(n["@id"].indexOf("#") + 1),
          );
          if (noteOnPage) {
            noteOnPage.classList.add("deleted");
          }
        });
      }
    }
  };
  getInstantBoundingRectElements = () => {
    // build React elements for the note bounding rectangles based on current DOM
    if (
      !this.scoreReady ||
      this.measuredScore !== this.props.scoreState ||
      !this.state.selectedPerformance ||
      !this.scoreComponent.current ||
      !this.state.instantsByNoteId
    ) {
      return [];
    }
    const selectedSignal = this.ensureArray(
      this.state.selectedPerformance["http://purl.org/ontology/mo/recorded_as"],
    );
    const selectedInstant = this.ensureArray(
      selectedSignal[0]["http://purl.org/ontology/mo/time"],
    );
    const selectedTimeline = this.ensureArray(
      selectedInstant[0]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"],
    )[0]["@id"];
    const instantsByNote = this.state.instantsByNoteId[selectedTimeline];
    if (!instantsByNote) {
      return [];
    }
    const scoreNode = ReactDOM.findDOMNode(this.scoreComponent.current);
    if (!scoreNode) {
      return [];
    }
    const notesOnPagePerInstant = {};
    // Associate notes on this page with their instant duration (including offset)
    Array.prototype.forEach.call(this.state.notesOnPage, (noteEl) => {
      const noteIdAttr = noteEl.getAttribute("id");
      if (noteIdAttr && noteIdAttr in instantsByNote) {
        let nDur =
          instantsByNote[noteIdAttr][
            "http://purl.org/NET/c4dm/timeline.owl#at"
          ];
        nDur =
          parseFloat(nDur.substr(1, nDur.length - 2)) +
          parseFloat(
            this.state.selectedPerformance[
              "https://meld.linkedmusic.org/terms/offset"
            ],
          );
        if (nDur in notesOnPagePerInstant) {
          notesOnPagePerInstant[nDur].push(noteEl);
        } else {
          notesOnPagePerInstant[nDur] = [noteEl];
        }
      }
    });

    const elements = [];

    // For each instant, figure out the minimal bounding box that contains all its notes
    Object.keys(notesOnPagePerInstant).forEach((instantKey) => {
      let boxLeft = 10000;
      let boxTop = 10000;
      let boxRight = 0;
      let boxBottom = 0;
      let noteId;

      notesOnPagePerInstant[instantKey].forEach((n) => {
        const boundRect = this.convertCoords(n);
        // To contain all notes, minimise left/top and maximise right/bottom
        boxLeft = boundRect.x < boxLeft ? boundRect.x : boxLeft;
        boxTop = boundRect.y < boxTop ? boundRect.y : boxTop;
        boxRight = boundRect.x2 > boxRight ? boundRect.x2 : boxRight;
        boxBottom = boundRect.y2 > boxBottom ? boundRect.y2 : boxBottom;
        noteId = n.getAttribute("id"); // keep one note id for metadata lookups
      });

      if (!noteId) {
        return;
      }

      const nDurRaw =
        instantsByNote[noteId]["http://purl.org/NET/c4dm/timeline.owl#at"];
      const nDurValue = nDurRaw.substr(1, nDurRaw.length - 2);
      const isDeleted = parseInt(nDurValue) === -1;

      const sharedStyle = {
        position: "absolute",
        left: Math.floor(boxLeft),
        top: Math.floor(boxTop),
        width: Math.ceil(boxRight - boxLeft),
        height: Math.ceil(boxBottom - boxTop),
      };

      const handleClick = () => {
        if (isDeleted) {
          // This is a deleted (unperformed) note; nothing to seek
          return;
        }
        let nDur =
          this.state.instantsByNoteId[selectedTimeline][noteId][
            "http://purl.org/NET/c4dm/timeline.owl#at"
          ];
        nDur =
          parseFloat(nDur.substr(1, nDur.length - 2)) +
          parseFloat(
            this.state.selectedPerformance[
              "https://meld.linkedmusic.org/terms/offset"
            ],
          );
        this.setState({ isPlaying: true });
        this.tick(this.state.selectedVideo, nDur);
        if (this.player.current) {
          this.player.current.seekTo(nDur, "seconds");
        }
        // Reset note velocities display for notes after this instant so they redraw when played
        const notesOnPage = document.querySelectorAll(".note");
        const thisNote = document.querySelector("#" + noteId);
        const noteIndex = Array.prototype.indexOf.call(notesOnPage, thisNote);
        const notesAfterThisOne = Array.prototype.slice.call(
          notesOnPage,
          noteIndex + 1,
        );
        notesAfterThisOne.forEach((n) => {
          n.style.fill = "";
          n.style.stroke = "";
        });
      };

      const title = isDeleted
        ? "This note was not sounded during the selected performance"
        : `time: ${nDurValue} velocity: ${parseFloat(
            this.state.instantsByNoteId[selectedTimeline][noteId][
              "https://terms.trompamusic.eu/maps#velocity"
            ],
          )}`;

      elements.push(
        <div
          key={`conf-${instantKey}-clickable`}
          id={`conf-${instantKey}`}
          className="clickableBoundedInstant"
          title={title}
          style={{
            ...sharedStyle,
            background: "rgba(0,0,0,0)",
            zIndex: 1,
          }}
          onClick={handleClick}
        />,
      );
    });

    return elements;
  };
  // https://stackoverflow.com/questions/26049488/how-to-get-absolute-coordinates-of-object-inside-a-g-group
  convertCoords = (elem) => {
    if (
      !!elem &&
      document.getElementById(elem.getAttribute("id")) &&
      elem.style.display !== "none" &&
      (elem.getBBox().x !== 0 || elem.getBBox().y !== 0)
    ) {
      const x = elem.getBBox().x;
      const width = elem.getBBox().width;
      const y = elem.getBBox().y;
      const height = elem.getBBox().height;
      const offset = elem.closest("svg").parentElement.getBoundingClientRect();
      const matrix = elem.getScreenCTM();
      return {
        x: matrix.a * x + matrix.c * y + matrix.e - offset.left,
        y: matrix.b * x + matrix.d * y + matrix.f - offset.top,
        x2: matrix.a * (x + width) + matrix.c * y + matrix.e - offset.left,
        y2: matrix.b * x + matrix.d * (y + height) + matrix.f - offset.top,
      };
    } else {
      console.warn("Element unavailable on page: ", elem.getAttribute("id"));
      return { x: 0, y: 0, x2: 0, y2: 0 };
    }
  };

  assignClickHandlersToNotes = () => {
    // check if our score page has updated
    const selectedTimeline =
      this.state.selectedPerformance["http://purl.org/ontology/mo/recorded_as"][
        "http://purl.org/ontology/mo/time"
      ]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"];
    const notes = ReactDOM.findDOMNode(
      this.scoreComponent.current,
    ).querySelectorAll(".note");
    Array.prototype.map.call(notes, (n) => {
      if (
        n.getAttribute("id") in this.state.instantsByNoteId[selectedTimeline]
      ) {
        let nDur =
          this.state.instantsByNoteId[selectedTimeline][n.getAttribute("id")][
            "http://purl.org/NET/c4dm/timeline.owl#at"
          ];
        nDur =
          parseFloat(nDur.substr(1, nDur.length - 2)) +
          parseFloat(
            this.state.selectedPerformance[
              "https://meld.linkedmusic.org/terms/offset"
            ],
          );
        n.onclick = (e) => {
          console.log("On note click, attempting to  seek to: ", nDur);
          this.tick(this.state.selectedVideo, nDur);
          console.log(this.player);
          if (this.player.current) {
            this.player.current.seekTo(nDur, "seconds");
          }
        };
      }
    });
  };

  render() {
    if (this.state.loading) {
      return <div id="wrapper">Loading, please wait</div>;
    } else {
      let currentTimeline = "";
      if (this.state.selectedPerformance) {
        currentTimeline =
          this.state.selectedPerformance[
            "http://purl.org/ontology/mo/recorded_as"
          ]["http://purl.org/ontology/mo/time"][
            "http://purl.org/NET/c4dm/timeline.owl#onTimeLine"
          ]["@id"] || ""; // FIXME skolemisation bug causing multiple copies of time entity
      }
      let featureVisElement = "";
      if (
        this.scoreReady &&
        this.state.mode === "featureVis" &&
        this.state.committedPage?.geometry
      ) {
        featureVisElement = (
          <FeatureVis
            key={this.state.currentScore}
            committedPage={this.state.committedPage}
            uri={this.props.uri}
            performedElements={this.state.performedElements}
            performanceErrors={this.state.performanceErrors}
            instantsByNoteId={this.state.instantsByNoteId}
            instantsByPerfTime={this.state.instantsByPerfTime}
            currentTimeline={currentTimeline}
            currentlyActiveNoteIds={this.state.currentlyActiveNoteIds}
            seekToInstant={this.seekToInstant}
            ensureArray={this.ensureArray}
            width={1400}
          />
        );
      }

      const pageControlsWrapper = this.state.currentScore ? (
        <PageControls
          following={this.state.scoreFollowing}
          mode={this.state.mode}
        />
      ) : null;
      const currentScore = this.state.currentScore ? (
        <div ref={this.scoreComponent} id="scoreSelectionArea">
          <ClaraScore mode={this.state.mode} />
        </div>
      ) : (
        <div className="loadingMsg">Loading, please wait...</div>
      );

      const selectedPerformanceId =
        this.state.selectedPerformance && this.state.selectedPerformance["@id"];
      const performanceSelectValue = selectedPerformanceId
        ? selectedPerformanceId
        : this.state.performanceSelectionCleared
          ? "none"
          : "placeholder";

      return (
        <div id="wrapper">
          {featureVisElement}
          <div id="instantBoundingBoxes">
            {this.getInstantBoundingRectElements()}
          </div>
          {currentScore}
          {pageControlsWrapper}
          <div id="selectWrapper">
            <select
              name="segmentSelect"
              disabled={!this.scoreReady}
              onChange={this.handleSegmentSelected}
              ref="segmentSelect"
            >
              <option value="none">Select a segment...</option>
              {this.state.segments.map((seg) => {
                return (
                  <option key={seg["@id"]} value={seg["@id"]}>
                    {seg["http://www.w3.org/2000/01/rdf-schema#label"] ||
                      seg["@id"].substr(seg["@id"].lastIndexOf("#") + 1)}
                  </option>
                );
              })}
            </select>
            <select
              name="perfSelect"
              value={performanceSelectValue}
              onChange={(e) => this.handlePerformanceSelected(e.target.value)}
            >
              <option value="placeholder" disabled>
                Select a rendition...
              </option>
              <option value="none">-- None --</option>
              {this.state.performances
                .sort((a, b) =>
                  a["http://www.w3.org/2000/01/rdf-schema#label"].localeCompare(
                    b["http://www.w3.org/2000/01/rdf-schema#label"],
                  ),
                )
                .map((perf) => {
                  return (
                    <option key={perf["@id"]} value={perf["@id"]}>
                      {perf["http://www.w3.org/2000/01/rdf-schema#label"]}
                    </option>
                  );
                })}
            </select>
            &nbsp;
            <span>
              {this.state.performances.length &&
              this.state.selectedPerformance ? (
                <span>
                  <span id="scoreFollowToggle">
                    <input
                      id="controlAutomaticPageTurning"
                      type="checkbox"
                      checked={this.state.scoreFollowing}
                      onChange={() => {
                        this.setState({
                          scoreFollowing: !this.state.scoreFollowing,
                        });
                      }}
                    />
                    &nbsp;
                    <label htmlFor="controlAutomaticPageTurning">
                      Automatic page turning
                    </label>
                  </span>
                  &nbsp;
                  <span id="modeToggle">
                    <input
                      type="checkbox"
                      id="controlFeatureVisualisation"
                      ref="modeToggle"
                      checked={this.state.mode === "featureVis"}
                      onChange={() => {
                        if (this.state.mode === "featureVis") {
                          this.setModePageView();
                        } else {
                          this.setModeFeatureVis();
                        }
                      }}
                    />
                    &nbsp;
                    <label htmlFor="controlFeatureVisualisation">
                      Feature visualisation
                    </label>
                  </span>
                </span>
              ) : (
                <span />
              )}
            </span>
            {this.state.selectedPerformance ? (
              <div id="currentPerformanceLabel">
                Current performance:{" "}
                <strong>
                  {
                    this.state.selectedPerformance[
                      "http://www.w3.org/2000/01/rdf-schema#label"
                    ]
                  }
                </strong>
                {!this.props.demo && (
                  <button
                    className="delete"
                    onClick={() => this.deleteSelectedPerformance()}
                  >
                    Delete performance
                  </button>
                )}
              </div>
            ) : (
              <div />
            )}
          </div>
          <div className="videoWrapper">
            {this.state.selectedVideo && (
              <AuthenticatedMediaPlayer
                src={this.state.selectedVideo}
                demo={!!this.props.demo}
                fetchFn={this.props.fetch}
                playing={this.state.isPlaying}
                onPlay={this.handlePlayerPlay}
                onPause={this.handlePlayerPause}
                progressInterval={50} // 20 Hz stays within the 100 ms note-activation window
                onProgress={(p) => {
                  this.tick(this.state.selectedVideo, p["playedSeconds"]);
                }}
                onReady={() => {
                  if (Number.isFinite(this.state.seekTo) && this.player.current) {
                    console.log(
                      "Render loop onReady: seeking to ",
                      this.state.seekTo,
                    );
                    this.player.current.seekTo(this.state.seekTo, "seconds");
                    this.setState({ seekTo: "" });
                  }
                }}
                playerRef={this.player}
                audioOnly={!this.props.demo}
              />
            )}
          </div>
        </div>
      );
    }
  }

  handleSegmentSelected = (e) => {
    if (!this.scoreReady) return;
    const selected = this.state.segments.filter((seg) => {
      return seg["@id"] === e.target.value;
    });
    if (!selected.length) return;
    const target =
      selected[0]["http://purl.org/vocab/frbr/core#embodiment"][
        "http://www.w3.org/2000/01/rdf-schema#member"
      ]["@id"];
    this.props.scoreCommands.goToNote(target);
    // if a video is selected, jump to the beginning of this segment in its performance timeline
    if (this.state.selectedPerformance) {
      const timelineSegment = this.findInstantToSeekTo(selected[0]);
      console.log("timelineSegment: ", timelineSegment);
      if (timelineSegment.length) {
        const dur =
          timelineSegment[0]["http://purl.org/NET/c4dm/timeline.owl#at"];
        let startTime = parseFloat(dur.substr(1, dur.length - 2));
        // HACK: Offsets should be incorporated into data model through timeline maps
        startTime += parseFloat(
          this.state.selectedPerformance[
            "https://meld.linkedmusic.org/terms/offset"
          ],
        );
        console.log(
          "Trying to seek to: ",
          startTime,
          parseFloat(
            this.state.selectedPerformance[
              "https://meld.linkedmusic.org/terms/offset"
            ],
          ),
        );
        if (this.player.current) {
          this.player.current.seekTo(startTime, "seconds");
        }
        this.setState({ currentSegment: selected[0] });
      }
    }
  };

  seekToInstant = (instant) => {
    // seek to a specific instant on a particular timeline
    // (switching to the performance of that timeline if necessary)
    const performances = this.state.performances.filter(
      (p) =>
        p["http://purl.org/ontology/mo/recorded_as"][
          "http://purl.org/ontology/mo/time"
        ]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"] ===
        instant["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"],
    );
    if (!performances.length) {
      console.warn(
        "Tried to seek to instant on timeline of non-existant performance: ",
        instant,
      );
    } else {
      const selectedPerformance = performances[0];
      // The performance is mo:recorded_as an mo:Signal
      // The signal is mo:available_as an mp3 is
      // The MIDI file is mo:derived_from of the signal
      const selectedVideo =
        selectedPerformance["http://purl.org/ontology/mo/recorded_as"][
          "http://purl.org/ontology/mo/available_as"
        ]["@id"];
      let dur = instant["http://purl.org/NET/c4dm/timeline.owl#at"];
      dur = parseFloat(dur.substr(1, dur.length - 2));
      let seekTo =
        dur +
        parseFloat(
          selectedPerformance["https://meld.linkedmusic.org/terms/offset"],
        );
      document.querySelectorAll(".note").forEach((n) => {
        n.style.fill = "";
        n.style.stroke = "";
      }); // reset note velocities
      this.setState(
        {
          selectedVideo,
          selectedPerformance,
          seekTo,
          performanceSelectionCleared: false,
          isPlaying: false,
        },
        () => {
          this.props.registerClock(selectedVideo);
          if (this.player.current) {
            this.player.current.seekTo(seekTo, "seconds");
          }
        },
      );
    }
  };

  handlePerformanceSelected = (perfId, options = {}) => {
    const { notifyParent = true } = options;
    console.log("Rendition selected: ", perfId);
    if (perfId === "placeholder") {
      return;
    }
    if (!perfId || perfId === "none") {
      document.querySelectorAll(".note").forEach((n) => {
        n.style.fill = "";
        n.style.stroke = "";
      });
      this.setState(
        {
          selectedPerformance: "",
          selectedVideo: "",
          seekTo: "",
          performanceSelectionCleared: true,
          isPlaying: false,
        },
        () => {
          this.initialPerformanceAppliedId = "";
          if (this.state.mode !== "pageView") {
            this.setModePageView();
          }
          if (notifyParent && this.props.onPerformanceSelected) {
            this.props.onPerformanceSelected(undefined);
          }
        },
      );
      return;
    }
    const selected = this.findPerformanceByIdentifier(perfId);
    if (!selected) {
      console.warn("Unable to locate performance", perfId);
      return;
    }
    const selectedVideo =
      selected["http://purl.org/ontology/mo/recorded_as"][
        "http://purl.org/ontology/mo/available_as"
      ]["@id"];
    const selectedPerformance = selected;
    this.props.registerClock(selectedVideo);
    let newState = {
      selectedVideo,
      selectedPerformance,
      performanceSelectionCleared: false,
      isPlaying: false,
    };
    if ("@id" in this.state.currentSegment) {
      // set up a jump to the currently selected segment in this performance
      const timelineSegment = this.findInstantToSeekTo(
        this.state.currentSegment,
        selectedPerformance,
      );
      if (timelineSegment.length) {
        const dur =
          timelineSegment[0]["http://purl.org/NET/c4dm/timeline.owl#at"];
        let startTime = parseFloat(dur.substr(1, dur.length - 2));
        startTime += parseFloat(
          selectedPerformance["https://meld.linkedmusic.org/terms/offset"],
        );
        newState["seekTo"] = startTime;
      }
    }
    document.querySelectorAll(".note").forEach((n) => {
      n.style.fill = "";
      n.style.stroke = "";
    }); // reset note velocities
    this.setState(newState, () => {
      if (notifyParent && this.props.onPerformanceSelected) {
        this.props.onPerformanceSelected(selected["@id"]);
      }
    });
  };

  applyInitialPerformanceSelection = () => {
    const initialPerformanceId = this.props.selectedPerformance;
    if (
      !initialPerformanceId ||
      !this.isGraphReady() ||
      this.initialPerformanceAppliedId === initialPerformanceId
    ) {
      return;
    }
    const timelineIds = Object.keys(this.state.instantsByNoteId || {});

    const matchingPerformance =
      this.findPerformanceByIdentifier(initialPerformanceId);
    if (!matchingPerformance) {
      return;
    }

    const performances =
      this.ensureArray(
        matchingPerformance["http://purl.org/ontology/mo/recorded_as"],
      ) || [];
    const matchingTimeline = performances
      .map((signal) =>
        this.ensureArray(signal["http://purl.org/ontology/mo/time"]),
      )
      .flat()
      .map((instant) =>
        this.ensureArray(
          instant["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"],
        ),
      )
      .flat()
      .map((timeline) => timeline && timeline["@id"])
      .find((id) => id && timelineIds.includes(id));

    if (!matchingTimeline) {
      return;
    }

    this.initialPerformanceAppliedId = initialPerformanceId;
    this.handlePerformanceSelected(matchingPerformance["@id"], {
      notifyParent: false,
    });
  };

  findPerformanceByIdentifier = (identifier) => {
    if (!identifier) {
      return undefined;
    }
    const trimmedIdentifier = identifier.trim();
    return this.state.performances.find((perf) => {
      const perfUri = perf["@id"];
      return perfUri ? perfUri === trimmedIdentifier : false;
    });
  };

  findInstantToSeekTo = (
    segment,
    selectedPerformance = this.state.selectedPerformance,
  ) => {
    //FIXME Skolemization bug currently causing two identical times (intervals), one for performance and one for signal. For now, pick the first
    const thisTime = this.ensureArray(
      selectedPerformance["http://purl.org/ontology/mo/recorded_as"][
        "http://purl.org/ontology/mo/time"
      ],
    );
    const selectedTimeline =
      thisTime[0]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"];
    // find the time instant on the selected performance's timeline that corresponds to the
    // selected segment
    const timelineSegment = this.props.graph.outcomes[2]["@graph"].filter(
      (i) => {
        if (
          !("http://purl.org/NET/c4dm/timeline.owl#onTimeLine" in i) ||
          i["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"] !==
            selectedTimeline
        ) {
          return false;
        }
        let segNotes = [];
        // do any of our instant's note embodiments match one of the segment's note embodiments?
        segNotes = segment["http://purl.org/vocab/frbr/core#embodiment"][
          "https://meld.linkedmusic.org/terms/notes"
        ].filter((segNote) => {
          // ensure array (in chords, one timeline instance maps to multiple note instances)
          const embodiments = this.ensureArray(
            i["http://purl.org/vocab/frbr/core#embodimentOf"],
          );
          const embodimentFound = embodiments.filter((e) => {
            return e["@id"] === segNote["@id"];
          });
          return embodimentFound.length; // true if we found a matching embodiment
        });
        return segNotes.length; // true if we found a matching instance
      },
    );
    // returned them in chronological order
    const sorted = timelineSegment.sort((a, b) => {
      let aDur = a["http://purl.org/NET/c4dm/timeline.owl#at"];
      let bDur = b["http://purl.org/NET/c4dm/timeline.owl#at"];
      return (
        parseFloat(aDur.substr(1, aDur.length - 2)) -
        parseFloat(bDur.substr(1, bDur.length - 2))
      );
    });
    // remove any occurring at -1 (indicating deleted notes)
    const filtered = sorted.filter((n) => {
      let dur = n["http://purl.org/NET/c4dm/timeline.owl#at"];
      dur = parseInt(dur.substr(1, dur.length - 2));
      return dur !== -1;
    });
    return filtered;
  };

  mapVelocity = (vel) => {
    let value =
      ((vel - this.state.minExpectedVel) *
        (this.state.maxMappedVelocity - this.state.minMappedVelocity)) /
        (this.state.maxExpectedVel - this.state.minExpectedVel) +
      this.state.minMappedVelocity;
    value = Math.max(0, value); // can't have < 0
    value = Math.max(value, 1); // can't have > 1
    return Math.floor(value);
  };

  tick = (id, t) => {
    t += this.state.videoOffset;
    let newState = { lastMediaTick: t }; // keep track of this time tick)
    // dispatch a "TICK" action
    // any time-sensitive component subscribes to it,
    // triggering time-anchored annotations triggered as appropriate
    this.props.tickTimedResource(id, t);
    if (this.state.selectedPerformance) {
      // find closest corresponding instants (within a window of progressInterval milliseconds) on this timeline
      //FIXME Skolemization bug currently causing two identical times (intervals), one for performance and one for signal. For now, pick the first
      const thisTime = this.ensureArray(
        this.state.selectedPerformance[
          "http://purl.org/ontology/mo/recorded_as"
        ]["http://purl.org/ontology/mo/time"],
      );
      const thisTimeline =
        thisTime[0]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"];
      const thisOffset =
        this.state.selectedPerformance[
          "https://meld.linkedmusic.org/terms/offset"
        ];
      let closestInstantIndices = this.state.instantsByPerfTime[
        thisTimeline
      ].reduce((indices, instant, thisIndex) => {
        let dur = instant["http://purl.org/NET/c4dm/timeline.owl#at"];
        dur = dur.substr(1, dur.length - 2);
        const offsetDur = parseFloat(dur) + parseFloat(thisOffset);
        if (offsetDur > t - this.state.activeWindow && offsetDur <= t) {
          indices.push(thisIndex);
        }
        return indices;
      }, []);

      const previouslyActive = document.querySelectorAll(".note.active");
      if (previouslyActive.length && closestInstantIndices.length) {
        newState["previouslyActive"] = Array.from(previouslyActive);
        Array.from(previouslyActive).forEach((n) => {
          n.classList.remove("active");
        });
      }
      //console.log("Tick: ", t, ", offset: ", thisOffset + t, ", closest instants: ", closestInstantIndices);
      closestInstantIndices.forEach((closestInstantIx) => {
        let currentNotes =
          this.state.instantsByPerfTime[thisTimeline][closestInstantIx][
            "http://purl.org/vocab/frbr/core#embodimentOf"
          ];
        // handle array (instant might correspond to chord or multiple voices...)
        currentNotes = Array.isArray(currentNotes)
          ? currentNotes
          : [currentNotes];
        // clear any pre-existing active notes
        let currentNoteElement;
        let currentMeasure;
        let noteToFlipTo;
        currentNotes.forEach((n) => {
          const currentNoteId = n["@id"].substr(n["@id"].lastIndexOf("#") + 1);
          // highlight the current note if on current page
          currentNoteElement = document.getElementById(currentNoteId);
          if (currentNoteElement) {
            currentNoteElement.classList.add("active");
            if (this.state.showVelocities) {
              let mappedVel = this.mapVelocity(
                this.state.instantsByPerfTime[thisTimeline][closestInstantIx][
                  "https://terms.trompamusic.eu/maps#velocity"
                ],
              );
              let hex =
                "#ff" +
                (this.state.maxMappedVelocity - mappedVel).toString(16) +
                "00ff"; // higher vel == less green, so redder colour
              currentNoteElement.style.fill = hex;
              currentNoteElement.style.stroke = hex;
            }
            currentMeasure = currentNoteElement.closest(".measure");
          } else if (
            currentNoteId === "inserted_state" &&
            this.state.showInsertedDeleted
          ) {
            // oops! wrong note played (according to MAPS at least)
            // visualise this by CSS animation on the (most recent) measure
            if (this.state.previouslyActive.length) {
              this.state.previouslyActive[0]
                .closest(".measure")
                .classList.add("errorDetected");
              // and clear the animation a second later (so that we can punish the next pianist that gets this meausure wrong!)
              setTimeout(
                (element) => {
                  element.closest(".measure").classList.remove("errorDetected");
                },
                1000,
                this.state.previouslyActive[0],
              );
            } else {
              console.log(
                "Insert state detected but no previously active note!",
              );
            }
          } else {
            // note not on this page; so we'll need to flip to it
            noteToFlipTo = n;
          }
        }, this);
        newState["currentlyActiveNoteIds"] = currentNotes
          .flat()
          .map((n) => n["@id"].substr(n["@id"].indexOf("#") + 1));
        if (noteToFlipTo && closestInstantIx > 0) {
          // a note wasn't on this page -- if we are score-following, flip to its page
          // (the closestInstantIx > 0 check is to avoid flipping to first page each time we swap performance)
          if (this.scoreReady && this.state.scoreFollowing) {
            console.log("Asking Score to flip to: ", noteToFlipTo);
            this.props.scoreCommands.goToNote(noteToFlipTo["@id"]);
          }
        } else if (currentNoteElement) {
          // check whether we're in a new section segment
          // BUT, Verovio doesn't include sections in the hierarchy of its output
          // Instead it uses "milestones" on the measure level
          // So, follow siblings backwards from the current measure until we hit a section
          // start point
          let sibling = currentMeasure.previousElementSibling;
          while (sibling) {
            if (sibling.matches(".section")) {
              break;
            }
            sibling = sibling.previousElementSibling;
          }
          //console.log("Found section: ", sibling, " measure: ", currentMeasure, " note: ", currentNoteElement);
          const sectionId = sibling ? sibling.getAttribute("id") : "";
          //  console.log("Note: ", currentNoteElement,  "Measure: ", currentMeasure, " Section ID: ", sectionId);
          if (
            sectionId &&
            (!("@id" in this.state.currentSegment) ||
              sectionId !==
                this.state.currentSegment["@id"].substr(
                  this.state.currentSegment["@id"].lastIndexOf("#") + 1,
                ))
          ) {
            // we've entered a new section (segment)
            //find the corresponding segment in our outcomes
            let segments;
            if ("@graph" in this.props.graph.outcomes[1]) {
              segments = this.props.graph.outcomes[1]["@graph"];
            } else {
              segments = [this.props.graph.outcomes[1]];
            }
            const newSeg = segments.filter((s) => {
              return (
                s["@id"].substr(s["@id"].lastIndexOf("#") + 1) === sectionId
              );
            });
            if (newSeg.length === 0) {
              console.log(
                "WARNING: Cannot find segment corresponding to section ",
                sectionId,
                " of note",
                currentNoteElement,
              );
            } else if (newSeg.length > 1) {
              console.log(
                "WARNING: Duplicate segment found corresponding to section ",
                sectionId,
                " of note ",
                currentNoteElement,
              );
            }
            if (newSeg.length) {
              console.log("SETTING TO: ", newSeg[0]);
              // update selection box
              this.refs.segmentSelect.value = newSeg[0]["@id"];
              // update state
              newState["currentSegment"] = newSeg[0];
            }
          }
        }
      });

      // Only update state if active notes have actually changed to avoid unnecessary re-renders
      // Most playback time is spent on sustained notes or rests where nothing changes
      const newActiveNoteIds = newState.currentlyActiveNoteIds || [];
      const currentActiveNoteIds = this.state.currentlyActiveNoteIds || [];
      const activeNotesChanged =
        newActiveNoteIds.length !== currentActiveNoteIds.length ||
        !newActiveNoteIds.every((id, idx) => id === currentActiveNoteIds[idx]);

      // Also update if segment changed (happens rarely, when crossing section boundaries)
      const segmentChanged =
        newState.currentSegment &&
        newState.currentSegment !== this.state.currentSegment;

      if (activeNotesChanged || segmentChanged) {
        this.setState(newState);
      }
    }
  };

  handlePlayerPlay = () => {
    if (!this.state.isPlaying) {
      this.setState({ isPlaying: true });
    }
  };

  handlePlayerPause = () => {
    if (this.state.isPlaying) {
      this.setState({ isPlaying: false });
    }
  };

  ensureArray = (val) => {
    return Array.isArray(val) ? val : [val];
  };

  processTraversalOutcomes = (outcomes) => {
    console.log("PROCESSING OUTCOMES: ", outcomes);
    let segments = [];
    let performances = [];
    let instants = [];
    let instantsByPerfTime = {};
    let instantsByNoteId = {};
    let performedElements = {};
    let performanceErrors = {};
    if (
      outcomes.length === 5 &&
      //typeof outcomes[0] !== 'undefined' &&
      typeof outcomes[1] !== "undefined" &&
      typeof outcomes[2] !== "undefined" &&
      typeof outcomes[3] !== "undefined"
    ) {
      if (
        typeof outcomes[0] !== "undefined" &&
        Object.keys(outcomes[0]).length
      ) {
        if ("@graph" in outcomes[0]) {
          outcomes[0]["@graph"].forEach((outcome) => {
            performances.push(outcome);
          });
        } else {
          performances.push(outcomes[0]);
        }
      }
      if ("@graph" in outcomes[1]) {
        outcomes[1]["@graph"].forEach((outcome) => {
          segments.push(outcome);
        });
      }
      segments = segments.sort((a, b) => {
        return (
          parseInt(a["https://meld.linkedmusic.org/terms/order"]) -
          parseInt(b["https://meld.linkedmusic.org/terms/order"])
        );
      });
      console.log("Sorted segments: ", segments);
      if ("@graph" in outcomes[2]) {
        outcomes[2]["@graph"].forEach((outcome) => {
          instants.push(outcome);
          const embodiments = Array.isArray(
            outcome["http://purl.org/vocab/frbr/core#embodimentOf"],
          )
            ? outcome["http://purl.org/vocab/frbr/core#embodimentOf"]
            : [outcome["http://purl.org/vocab/frbr/core#embodimentOf"]];
          // instants per PerfTime
          if (
            outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"][
              "@id"
            ] in instantsByPerfTime
          ) {
            instantsByPerfTime[
              outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"]
            ].push(outcome);
          } else {
            instantsByPerfTime[
              outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"]["@id"]
            ] = [outcome];
          }
          // instants per NoteId
          embodiments.forEach((e) => {
            const eId = e["@id"].substr(e["@id"].lastIndexOf("#") + 1);
            if (
              outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"][
                "@id"
              ] in instantsByNoteId
            ) {
              instantsByNoteId[
                outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"][
                  "@id"
                ]
              ][eId] = outcome;
            } else {
              instantsByNoteId[
                outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"][
                  "@id"
                ]
              ] = { [eId]: outcome };
            }
          });
          // performance errors:
          // * deleted (omitted) notes exist in the MEI but were not performed;
          // they have a score time (MEI embodiment) but not a performed time
          // instead, the alignment process gives them a fake performed time of -1.
          if (
            this.ensureArray(
              outcome["http://purl.org/NET/c4dm/timeline.owl#at"],
            )[0] === "P-1S"
          ) {
            // this timeline has one or more deleted / omitted notes!
            if (
              outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"][
                "@id"
              ] in performanceErrors
            ) {
              performanceErrors[
                outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"][
                  "@id"
                ]
              ].deleted =
                outcome["http://purl.org/vocab/frbr/core#embodimentOf"];
            } else {
              performanceErrors[
                outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"][
                  "@id"
                ]
              ] = {
                deleted:
                  outcome["http://purl.org/vocab/frbr/core#embodimentOf"],
              };
            }
          }
          // * inserted notes do not exist in the MEI, but *were* performed;
          // they have a performed time but not a score time (MEI embodiment)
          // instead, the alignment process gives them an embodiment representing the note played, like:
          // "https://terms.trompamusic.eu/maps#inserted_G4"
          let inserted = this.ensureArray(
            outcome["http://purl.org/vocab/frbr/core#embodimentOf"],
          ).filter((embodiment) =>
            embodiment["@id"].startsWith(
              "https://terms.trompamusic.eu/maps#inserted",
            ),
          );
          if (inserted.length) {
            // this timeline has one or more inserted notes!
            if (
              outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"][
                "@id"
              ] in performanceErrors
            ) {
              if (
                "inserted" in
                performanceErrors[
                  outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"][
                    "@id"
                  ]
                ]
              ) {
                performanceErrors[
                  outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"][
                    "@id"
                  ]
                ].inserted.push(outcome);
              } else {
                performanceErrors[
                  outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"][
                    "@id"
                  ]
                ].inserted = [outcome];
              }
            } else {
              performanceErrors[
                outcome["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"][
                  "@id"
                ]
              ] = {
                inserted: [outcome],
              };
            }
          }
        });
      }
      // filter annotations to only those which are oa#describing (i.e., describing dynamics)
      // TODO: consider a custom TROMPA motivation to be more restrictive here
      if ("@graph" in outcomes[3]) {
        outcomes[3]["@graph"]
          .filter((outcome) => {
            if (
              "http://www.w3.org/ns/oa#motivatedBy" in outcome &&
              outcome["http://www.w3.org/ns/oa#motivatedBy"]["@id"] ===
                "http://www.w3.org/ns/oa#describing"
            ) {
              return true;
            } else return false;
          })
          .forEach((outcome) => {
            // the annotation target's source is the MEI element
            // and its scope is the performance timeline.
            // Build a look-up table of:
            // { mei-element: { timeline: velocityVal } }
            let target = outcome["http://www.w3.org/ns/oa#hasTarget"];
            let targetMEI =
              target["http://www.w3.org/ns/oa#hasSource"]["@id"].split("#")[1];
            let targetScope = target["http://www.w3.org/ns/oa#hasScope"]["@id"];
            // FIXME The velocity value should hang off the annotation, not off the target
            let velocity = outcome["http://www.w3.org/ns/oa#bodyValue"];
            if (targetMEI in performedElements) {
              performedElements[targetMEI][targetScope] = velocity;
            } else {
              performedElements[targetMEI] = { [targetScope]: velocity };
            }
          });
      }
      Object.keys(instantsByPerfTime).forEach((tl) => {
        // order the instances along each timeline
        instantsByPerfTime[tl] = instantsByPerfTime[tl].sort((a, b) => {
          let aDur = a["http://purl.org/NET/c4dm/timeline.owl#at"];
          let bDur = b["http://purl.org/NET/c4dm/timeline.owl#at"];
          return (
            parseFloat(aDur.substr(1, aDur.length - 2)) -
            parseFloat(bDur.substr(1, bDur.length - 2))
          );
        });
      });
      // set our MEI score based on the first performance
      // TODO this assumes all performances are of the same score - check that assumption;
      // to support multi-score, need to set state on every performance selection
      if (performances.length) {
        console.log("Performances:", performances);
        const currentPerformance = this.ensureArray(
          performances[0]["http://purl.org/ontology/mo/performance_of"],
        )[0];
        console.log("Current performance: ", currentPerformance);
        if ("http://purl.org/ontology/mo/published_as" in currentPerformance) {
          const currentScore =
            currentPerformance["http://purl.org/ontology/mo/published_as"][
              "@id"
            ];
          ReactDOM.unstable_batchedUpdates(() => {
            const changed = currentScore !== this.state.currentScore;
            this.setState({
              performances,
              segments,
              instants,
              instantsByPerfTime,
              instantsByNoteId,
              currentScore,
              performedElements,
              performanceErrors,
              ...(changed ? this.scoreResetState() : {}),
            });
            if (changed)
              this.props.scoreCommands.load(
                currentScore,
                this.state.vrvOptions,
              );
          });
        }
      } else if (Object.keys(outcomes[4]).length) {
        let currentScore;
        if ("@graph" in outcomes[4]) {
          currentScore =
            outcomes[4]["@graph"][0][
              "http://purl.org/ontology/mo/published_as"
            ]["@id"];
        } else {
          currentScore =
            outcomes[4]["http://purl.org/ontology/mo/published_as"]["@id"];
        }
        // there are no performances -- force pageView mode and disable scorefollowing
        ReactDOM.unstable_batchedUpdates(() => {
          const changed = currentScore !== this.state.currentScore;
          this.setState({
            segments,
            currentScore,
            mode: "pageView",
            vrvOptions: vrvOptionsPageView,
            scoreFollowing: false,
            ...(changed ? this.scoreResetState() : {}),
          });
          if (changed)
            this.props.scoreCommands.load(currentScore, vrvOptionsPageView);
          else this.props.scoreCommands.setOptions(vrvOptionsPageView);
        });
      }
    }
  };
}

// PropTypes documentation:
// - graph: Redux state from graph reducer
//   - graph.graph: Array - Array of graph nodes
//   - graph.objectives: Array - Array of traversal objectives
//   - graph.outcomes: Array - Array of traversal outcomes (indexed: 0=performances, 1=segments, 2=instants, 3=annotations, 4=scores)
//   - graph.allObjectivesApplied: boolean - Whether all traversal objectives have been applied
// - traversalPool: Redux state from traversalPool reducer
//   - traversalPool.running: number - Number of currently running traversals
//   - traversalPool.pool: Record<string, any> - Map of traversal URIs to their parameters
//   - traversalPool.graphDocs: Array<string> - Array of graph document URIs
const companionOwnPropTypes = {
  uri: PropTypes.string.isRequired,
  userPOD: PropTypes.string,
  userProfile: PropTypes.string,
  fetch: PropTypes.func,
  selectedPerformance: PropTypes.string,
  onPerformanceSelected: PropTypes.func,
  demo: PropTypes.bool,
};

const companionInjectedPropTypes = {
  scoreState: PropTypes.object.isRequired,
  scoreCommands: PropTypes.object.isRequired,
  graph: PropTypes.object.isRequired,
  traversalPool: PropTypes.object.isRequired,
  traverse: PropTypes.func.isRequired,
  registerTraversal: PropTypes.func.isRequired,
  setTraversalObjectives: PropTypes.func.isRequired,
  checkTraversalObjectives: PropTypes.func.isRequired,
  registerClock: PropTypes.func.isRequired,
  tickTimedResource: PropTypes.func.isRequired,
};

const companionPropTypes = {
  ...companionOwnPropTypes,
  ...companionInjectedPropTypes,
};

/** @typedef {InferProps<typeof companionPropTypes>} CompanionProps */
/** @typedef {InferProps<typeof companionOwnPropTypes>} CompanionOwnProps */

Companion.propTypes = companionPropTypes;

function mapStateToProps({ graph, traversalPool }) {
  return {
    graph,
    traversalPool,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      traverse,
      registerTraversal,
      setTraversalObjectives,
      checkTraversalObjectives,
      registerClock,
      tickTimedResource,
    },
    dispatch,
  );
}

const ConnectedCompanion = connect(
  mapStateToProps,
  mapDispatchToProps,
)(withScore(Companion));

const CompanionComponent =
  /** @type {import("react").ComponentType<CompanionOwnProps>} */ (
    ConnectedCompanion
  );

export default CompanionComponent;

import React, { Component } from "react";
import ReactDOM from "react-dom";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import SelectableScore from "../../selectable-score/selectable-score";
import NextPageButton from "../../selectable-score/next-page-button";
import PrevPageButton from "../../selectable-score/prev-page-button";

import {
  traverse,
  registerTraversal,
  setTraversalObjectives,
  checkTraversalObjectives,
  scoreNextPageStatic,
  scorePrevPageStatic,
  scorePageToComponentTarget,
  fetchScore,
} from "meld-clients-core/lib/actions/index";
import {
  registerClock,
  tickTimedResource,
} from "meld-clients-core/lib/actions/index";

import FeatureVis from "./FeatureVis";
import { MidiPlayer } from "./MidiPlayer";

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

class Companion extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selection: [],
      performances: [],
      segments: [],
      instants: [],
      instantsByPerfTime: [],
      instantsByNoteId: [],
      notesOnPage: [],
      barlinesOnPage: [],
      selectedVideo: "",
      selectedPerformance: "",
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
      showConfidence: false, // if true, visualise MAPS confidence per instant
      showVelocities: true, // if true, visualise note velocities
      showInsertedDeleted: true, // if true, visualise note insertions and deletions
      minMappedVelocity: 0, // minimum opacity (when note played at smallest expected velocity
      maxMappedVelocity: 255, // max opacity (when note played at largest expected velocity)
      minExpectedVel: 0, // guesstimate as to a note played at pianissimo (unit: midi velocity)
      maxExpectedVel: 110, // guesstimate as to a note played at fortissimo (unit: midi velocity)
      mode: "pageView", // currently either pageView (portrait style) or featureVis (flattened single-system with visualisation)
      featureVisPageNum: 0, // guards against race conditions between Vrv score and featureVis svg
      latestObservedPageNum: 0,
      observingScore: false, // control behaviour of DOM change observer (to catch Verovio SVG render completions)
      scoreComponentLoadingStarted: false,
      scoreComponentLoaded: false, // know when to initially start the DOM observer
      performedElements: {},
      performanceErrors: {},
      latestScoreUpdateTimestamp: 0,
      toggleAnnotationRetrieval: true, // set to true when annotation update required
      highlights: [], // circles drawn to respond to highlight annotations
      highlightsOnPage: [], // ... those with at least one target on current page
      selectorString: "", // forwarded to SelectableScore
      circleButtonActive: false,
      deleteAnnoButtonActive: false,
      onSelect: () => console.error("onSelect with no selection handler"),
    };
    this.player = React.createRef();
    this.featureVis = React.createRef();
    this.scoreComponent = React.createRef();
    // this.solidClient = new SolidClient(this.props.session);
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
    this.setState({
      vrvOptions:
        this.state.mode === "featureVis"
          ? vrvOptionsFeatureVis
          : vrvOptionsPageView,
    });
  }

  submitCircleAnnotation = () => {
    // const anno = {
    //   "@context": "http://www.w3.org/ns/anno.jsonld",
    //   "target": this.state.selection.map( (elem) => this.state.currentScore + "#" + elem.getAttribute("id") ),
    //   "motivation": "highlighting"
    // }
    // let submitHandlerArgs = "submitHandlerArgs" in this.props ? this.props.submitHandlerArgs : {};
    // this.solidClient.saveAnnotation(anno, new URL(this.props.annotationContainerUri).pathname)
    //     .then((resp) => this.handleResponse(resp))
    //     .catch((err) => `Couldn't save annotation: ${err}`);
    this.setState({ circleButtonActive: false, selection: [] });
  };

  deleteAnnotations = () => {
    if (
      window.confirm(
        "Do you really wish to permanently erase " +
          this.state.selection.length +
          " annotations?",
      )
    ) {
      // this.state.selection.map((s) => {
      //   this.solidClient.deleteAnnotation(s.dataset.uri)
      //     .then(() => s.parentNode.removeChild(s))
      //     .catch((e) => console.error("Couldn't delete annotation: ", s, e))
      // })
    }
    this.setState({ deleteAnnoButtonActive: false, selection: [] });
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

  determineHighlightsOnPage = () => {
    if (this.scoreComponent.current) {
      const highlightsOnPage = this.state.highlights.filter((hl) => {
        const targetsOnPage = this.ensureArray(hl.target).filter((t) => {
          const frag = t.substr(t.lastIndexOf("#"));
          return (
            ReactDOM.findDOMNode(this.scoreComponent.current).querySelector(
              frag,
            ) !== null
          );
        });
        return targetsOnPage.length > 0;
      });
      this.setState({ highlightsOnPage });
    }
  };

  handleDOMChangeObserved = () => {
    if (this.scoreComponent.current) {
      this.setState(
        {
          observingScore: false,
          scoreComponentLoaded: true,
          notesOnPage: ReactDOM.findDOMNode(
            this.scoreComponent.current,
          ).querySelectorAll(".note"),
          barlinesOnPage: ReactDOM.findDOMNode(
            this.scoreComponent.current,
          ).querySelectorAll(".barLineAttr"),
          latestScoreUpdateTimestamp: Date.now(),
        },
        () => {
          this.determineHighlightsOnPage();
          if (this.state.selectedPerformance) {
            this.createInstantBoundingRects();
          }
        },
      );
    }
  };

  handleReceiveAnnotationContainerContent = (content) => {
    console.log("Received annotation container content: ", content);
    const myHighlights = this.ensureArray(content).filter((anno) => {
      // filter out any annotations that don't concern the current score
      let forMe = [];
      if (this.ensureArray(anno["motivation"]).includes("highlighting")) {
        forMe = this.ensureArray(anno["target"]).filter((t) => {
          console.log("Comparing", t, this.state.currentScore);
          return t.startsWith(this.state.currentScore);
        });
      }
      return forMe.length > 0;
    });
    console.log("Setting highlights: ", myHighlights);
    this.setState(
      { toggleAnnotationRetrieval: false, highlights: myHighlights },
      () => {
        this.determineHighlightsOnPage();
      },
    );
  };

  handleResponse = (res) => {
    // POST completed, retrieve the container content
    this.setState({ toggleAnnotationRetrieval: true });
  };

  componentDidUpdate(prevProps, prevState) {
    if (
      !this.state.scoreComponentLoadingStarted &&
      this.scoreComponent.current
    ) {
      let scorepane = ReactDOM.findDOMNode(
        this.scoreComponent.current,
      ).querySelector(".scorepane");
      //  reflect the mode (pageView vs featureVis) onto the scorepane
      if (scorepane) {
        // if scorepane has rendered...
        let modes = ["pageView", "featureVis"];
        scorepane.classList.remove(...modes);
        scorepane.classList.add(this.state.mode);
        // observe the score element for DOM changes
        this.setState({
          observingScore: true,
          scoreComponentLoadingStarted: true,
        });
      }
    }

    if (
      this.scoreComponent.current &&
      JSON.stringify(prevState.highlightsOnPage) !==
        JSON.stringify(this.state.highlightsOnPage)
    ) {
      let scorepane = ReactDOM.findDOMNode(
        this.scoreComponent.current,
      ).querySelector(".scorepane");
      let annopane = scorepane.querySelector(".annotations");
      let scoreSvg = scorepane.querySelector(".score svg");
      annopane.innerHTML = ""; // clear previously rendered highlights
      // create a new, empty anno pane
      if (this.state.highlightsOnPage.length) {
        const annoSvg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        annoSvg.setAttribute("width", scoreSvg.getAttribute("width"));
        annoSvg.setAttribute("height", scoreSvg.getAttribute("height"));
        annoSvg.setAttribute("id", "highlightAnnotationsSvg");
        annoSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        annoSvg.setAttribute("xmlnsXlink", "http://www.w3.org/1999/xlink");
        this.state.highlightsOnPage.forEach((hl) => {
          const bboxes = this.ensureArray(hl.target)
            .filter((t) => {
              const el = scorepane.querySelector(t.substr(t.lastIndexOf("#")));
              // filter out any targets not currently on page
              return el !== null;
            })
            .map((t) => {
              const el = scorepane.querySelector(t.substr(t.lastIndexOf("#")));
              return this.convertCoords(el);
            });
          // determine enveloping bbox
          const minX = Math.min(...bboxes.map((b) => b.x));
          const minY = Math.min(...bboxes.map((b) => b.y));
          const maxX2 = Math.max(...bboxes.map((b) => b.x2));
          const maxY2 = Math.max(...bboxes.map((b) => b.y2));
          const ellipse = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "ellipse",
          );
          ellipse.setAttribute("cx", (minX + maxX2) / 2);
          ellipse.setAttribute("cy", (minY + maxY2) / 2);

          // Add padding so we don't circle too tightly -- but not too much!
          const paddedRx = Math.min((maxX2 - minX) / 1.6, maxX2 - minX + 20);
          const paddedRy = Math.min((maxY2 - minY) / 1.3, maxY2 - minY + 20);

          ellipse.addEventListener(
            "click",
            (t) => console.log("I was clicked: ", t),
            true,
          );

          ellipse.setAttribute("rx", paddedRx);
          ellipse.setAttribute("ry", paddedRy);
          ellipse.dataset.uri = hl["@id"];
          ellipse.classList.add("highlightEllipse");
          ellipse.classList.add("scoreAnnotation");
          annoSvg.appendChild(ellipse);
          annopane.appendChild(annoSvg);
        });
      }
    }

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
      "score" in prevProps &&
      this.state.selectedPerformance &&
      prevProps.score.latestRenderedPageNum !==
        this.props.score.latestRenderedPageNum // page flipped while performance selected
    ) {
      this.createInstantBoundingRects();
      this.highlightDeletedNotes();
    }

    if (
      "score" in prevProps &&
      this.state.selectedPerformance &&
      prevState.selectedPerformance !== this.state.selectedPerformance
    ) {
      // performance has been changed; reassign click handlers
      //      this.assignClickHandlersToNotes();
      this.createInstantBoundingRects();
      this.highlightDeletedNotes();
      this.setState({
        notesOnPage: ReactDOM.findDOMNode(
          this.scoreComponent.current,
        ).querySelectorAll(".note"),
      });
    }
    if (prevState.showConfidence !== this.state.showConfidence) {
      this.createInstantBoundingRects(); // showConfidence preference changed; redraw boxes
      // TODO: This ref has dissapared
      // this.refs.showConfidenceToggle.checked = this.state.showConfidence;
    }
    if (
      this.state.performances.length &&
      prevState.scoreFollowing !== this.state.scoreFollowing
    ) {
      this.refs.pageControlsWrapper.classList.toggle("following");
      this.refs.scoreFollowingToggle.checked = this.state.scoreFollowing;
    }
  }

  componentWillUnmount() {
    // clean up...
    document.removeEventListener("keydown", this.monitorKeys);
  }

  setModeFeatureVis = () => {
    this.setState({
      mode: "featureVis",
      vrvOptions: vrvOptionsFeatureVis,
      scoreComponentLoadingStarted: false,
      scoreComponentLoaded: false,
    });
  };

  setModePageView = () => {
    this.setState({
      mode: "pageView",
      vrvOptions: vrvOptionsPageView,
      scoreComponentLoadingStarted: false,
      scoreComponentLoaded: false,
    });
  };

  monitorKeys = (e) => {
    console.log("key pressed: ", e);
    if ("score" in this.props) {
      switch (e.which) {
        case 37: // left arrow
          if (
            this.props.score.pageState[this.state.currentScore].currentPage > 1
          ) {
            this.props.scorePrevPageStatic(
              this.state.currentScore,
              this.props.score.pageState[this.state.currentScore].currentPage,
              this.props.score.MEI[this.state.currentScore],
            );
          }
          break;
        case 39: // right arrow
          if (
            this.props.score.pageState[this.state.currentScore].currentPage <
            this.props.score.pageState[this.state.currentScore].pageCount
          ) {
            this.props.scoreNextPageStatic(
              this.state.currentScore,
              this.props.score.pageState[this.state.currentScore].currentPage,
              this.props.score.MEI[this.state.currentScore],
            );
          }
          break;
        case 67: // 'c'  => "confidence"
          if (this.state.selectedPerformance) {
            this.setState({ showConfidence: !this.state.showConfidence });
          }
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
        default: // other key
          console.log("Unhandled key pressed: ", e);
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
  createInstantBoundingRects = () => {
    // draw bounding rectangles for the note(s) on this page representing each instance
    let notesOnPagePerInstant = {};
    const boundingBoxesWrapper = document.getElementById(
      "instantBoundingBoxes",
    );
    // clear previous bounding boxes
    while (boundingBoxesWrapper.firstChild) {
      boundingBoxesWrapper.removeChild(boundingBoxesWrapper.firstChild);
    }
    console.log("Selected performance: ", this.state.selectedPerformance);
    const selectedSignal = this.ensureArray(
      this.state.selectedPerformance["http://purl.org/ontology/mo/recorded_as"],
    );
    const selectedInstant = this.ensureArray(
      selectedSignal[0]["http://purl.org/ontology/mo/time"],
    );
    const selectedTimeline = this.ensureArray(
      selectedInstant[0]["http://purl.org/NET/c4dm/timeline.owl#onTimeLine"],
    )[0]["@id"];
    console.log("Selected timeline: ", selectedTimeline);
    const notes = ReactDOM.findDOMNode(
      this.scoreComponent.current,
    ).querySelectorAll(".note");
    Array.prototype.map.call(notes, (n) => {
      // associate notes on this page with their instant duration
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
        if (nDur in notesOnPagePerInstant) {
          notesOnPagePerInstant[nDur].push(n);
        } else {
          notesOnPagePerInstant[nDur] = [n];
        }
      }
    });
    Object.keys(notesOnPagePerInstant).forEach((i) => {
      // for each instant, figure out the minimal bounding box that contains all its notes
      let boxLeft = 10000;
      let boxTop = 10000;
      let boxRight = 0;
      let boxBottom = 0;
      let noteId;

      // if we have feature visualisation (featureVis) rendered on page, need to nudge notes down
      let nudgeForFeatureVis = false;
      if (
        this.featureVis.current &&
        ReactDOM.findDOMNode(this.featureVis.current).matches("svg")
      ) {
        nudgeForFeatureVis = true;
      }

      notesOnPagePerInstant[i].forEach((n) => {
        // to contain all notes, we want to minimise left and top,
        // and maximise right and bottom
        const boundRect = this.convertCoords(n);
        boxLeft = boundRect.x < boxLeft ? boundRect.x : boxLeft;
        boxTop = boundRect.y < boxTop ? boundRect.y : boxTop;
        boxRight = boundRect.x2 > boxRight ? boundRect.x2 : boxRight;
        boxBottom = boundRect.y2 > boxBottom ? boundRect.y2 : boxBottom;
        // remember a note ID for indexing into instantsByNoteId (to retrieve confidence) further below
        noteId = n.getAttribute("id");
      });
      // now draw the containing elements:
      // confidenceBoundDiv -- visualisation of confidence -- background behind notes
      // clickableBoundDiv -- transparent click catcher for interaction -- foreground infront of notes
      const confidenceBoundDiv = document.createElement("div");
      const clickableBoundDiv = document.createElement("div");
      confidenceBoundDiv.setAttribute("id", "conf-" + i);
      confidenceBoundDiv.classList.add("confidenceBoundedInstant");
      if (nudgeForFeatureVis) {
        confidenceBoundDiv.classList.add("featureVis");
      }
      confidenceBoundDiv.setAttribute(
        "style",
        "position:absolute;" +
          "left:" +
          Math.floor(boxLeft) +
          "px;" +
          "top:" +
          Math.floor(boxTop) +
          "px;" +
          "width:" +
          Math.ceil(boxRight - boxLeft) +
          "px;" +
          "height:" +
          Math.ceil(boxBottom - boxTop) +
          "px;" +
          "background: rgba(0,0,0," +
          parseFloat(
            1 -
              this.state.instantsByNoteId[selectedTimeline][noteId][
                "https://terms.trompamusic.eu/maps#confidence"
              ] *
                0.01,
          ) +
          ");" +
          "z-index: -2;",
      );
      clickableBoundDiv.setAttribute("id", "conf-" + i);
      clickableBoundDiv.classList.add("clickableBoundedInstant");
      if (nudgeForFeatureVis) {
        clickableBoundDiv.classList.add("featureVis");
      }
      clickableBoundDiv.setAttribute(
        "style",
        "position:absolute;" +
          "left:" +
          Math.floor(boxLeft) +
          "px;" +
          "top:" +
          Math.floor(boxTop) +
          "px;" +
          "width:" +
          Math.ceil(boxRight - boxLeft) +
          "px;" +
          "height:" +
          Math.ceil(boxBottom - boxTop) +
          "px;" +
          "background: rgba(0,0,0,0);" +
          "z-index: 1;",
      );
      clickableBoundDiv.onclick = (e) => {
        let nDur =
          this.state.instantsByNoteId[selectedTimeline][noteId][
            "http://purl.org/NET/c4dm/timeline.owl#at"
          ];
        if (parseInt(nDur.substr(1, nDur.length - 2)) === -1) {
          // this is a deleted (i.e. unperformed) note; thus we can't seek to it!
          return;
        }
        console.log("On bounding box click, attempting to  seek to: ", nDur);
        nDur =
          parseFloat(nDur.substr(1, nDur.length - 2)) +
          parseFloat(
            this.state.selectedPerformance[
              "https://meld.linkedmusic.org/terms/offset"
            ],
          );
        this.tick(this.state.selectedVideo, nDur);
        console.log("attempting to seek to ", Math.floor(nDur));
        if (this.player.current) {
          if (this.player.current.playing) {
            this.player.current.stop();
            this.player.current.currentTime = Math.floor(nDur);
            this.player.current.start();
          } else {
            this.player.current.currentTime = Math.floor(nDur);
          }
        }
        // reset note velocities display for all notes after this one
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
      let nDur =
        this.state.instantsByNoteId[selectedTimeline][noteId][
          "http://purl.org/NET/c4dm/timeline.owl#at"
        ];
      nDur = nDur.substr(1, nDur.length - 2);
      if (parseInt(nDur) === -1) {
        console.log("Deleted note detected: ", noteId);
        clickableBoundDiv.setAttribute(
          "title",
          "This note was not sounded during the selected performance",
        );
      } else {
        clickableBoundDiv.setAttribute(
          "title",
          "time: " +
            nDur.substr(1, nDur.length - 2) +
            " velocity: " +
            parseFloat(
              this.state.instantsByNoteId[selectedTimeline][noteId][
                "https://terms.trompamusic.eu/maps#velocity"
              ],
            ) +
            " confidence: " +
            parseFloat(
              this.state.instantsByNoteId[selectedTimeline][noteId][
                "https://terms.trompamusic.eu/maps#confidence"
              ],
            ),
        );
      }
      // only add confidence visualisation if user wants us to
      if (this.state.showConfidence) {
        boundingBoxesWrapper.appendChild(confidenceBoundDiv);
      }
      boundingBoxesWrapper.appendChild(clickableBoundDiv);
    });
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
            this.player.current.currentTime = Math.floor(nDur);
          }
        };
      }
    });
  };

  handleSelectionChange = (selection) => {
    this.setState({ selection });
    this.state.onSelect();
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
      if (this.state.scoreComponentLoaded) {
        //&& this.state.currentScore in this.props.score.pageState) {
        featureVisElement = (
          <FeatureVis
            performedElements={this.state.performedElements}
            performanceErrors={this.state.performanceErrors}
            notesOnPage={this.state.notesOnPage}
            barlinesOnPage={this.state.barlinesOnPage}
            instantsByNoteId={this.state.instantsByNoteId}
            instantsByPerfTime={this.state.instantsByPerfTime}
            timelinesToVis={Object.keys(this.state.instantsByNoteId)}
            currentTimeline={currentTimeline}
            currentlyActiveNoteIds={this.state.currentlyActiveNoteIds}
            seekToInstant={this.seekToInstant}
            scoreComponent={this.scoreComponent}
            convertCoords={this.convertCoords}
            latestScoreUpdateTimestamp={this.state.latestScoreUpdateTimestamp}
            mode={this.state.mode}
            ref={this.featureVis}
            ensureArray={this.ensureArray}
            width={1400}
          />
        );
      }

      let pageControlsWrapper = "";
      if (
        "pageState" in this.props.score &&
        this.state.currentScore &&
        this.state.currentScore in this.props.score.pageState
      ) {
        pageControlsWrapper = (
          <div
            id="pageControlsWrapper"
            ref="pageControlsWrapper"
            className={this.state.mode + " following"}
          >
            {!this.state.scoreFollowing &&
            this.props.score.pageState[this.state.currentScore].currentPage >
              1 ? (
              <PrevPageButton
                buttonContent={
                  <img src="/static/prev.svg" alt="Previous page" />
                }
                uri={this.state.currentScore}
              />
            ) : (
              <div />
            )}

            {this.props.score.pageState[this.state.currentScore].pageCount >
            0 ? (
              <span id="pageNum">
                Page{" "}
                {
                  this.props.score.pageState[this.state.currentScore]
                    .currentPage
                }{" "}
                /{" "}
                {this.props.score.pageState[this.state.currentScore].pageCount}
              </span>
            ) : (
              <span id="pageNum" />
            )}

            {!this.state.scoreFollowing &&
            this.props.score.pageState[this.state.currentScore].currentPage <
              this.props.score.pageState[this.state.currentScore].pageCount ? (
              <NextPageButton
                buttonContent={<img src="/static/next.svg" alt="Next page" />}
                uri={this.state.currentScore}
              />
            ) : (
              <div />
            )}
          </div>
        );
      }
      let currentScore = (
        <div className="loadingMsg">Loading, please wait...</div>
      );
      if (this.state.currentScore) {
        currentScore = (
          <div ref={this.scoreComponent} id="scoreSelectionArea">
            <SelectableScore
              uri={this.state.currentScore}
              key={this.state.currentScore}
              vrvOptions={this.state.vrvOptions}
              selectorString={this.state.selectorString}
              selectionArea="#scoreSelectionArea"
              onSelectionChange={this.handleSelectionChange}
              onScoreUpdate={this.handleDOMChangeObserved}
              annotationContainerUri={this.props.annotationContainerUri}
              onReceiveAnnotationContainerContent={
                this.handleReceiveAnnotationContainerContent
              }
              toggleAnnotationRetrieval={this.state.toggleAnnotationRetrieval}
            />
          </div>
        );
      }

      return (
        <div id="wrapper">
          {featureVisElement}
          <div id="instantBoundingBoxes" />
          {currentScore}
          {pageControlsWrapper}
          <div id="selectWrapper">
            <select
              name="segmentSelect"
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
              defaultValue="none"
              value={this.state.selectedPerformance["@id"]}
              onChange={(e) => this.handlePerformanceSelected(e.target.value)}
            >
              <option value="none">Select a rendition...</option>
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
              this.state.selectedPerformance !== "" ? (
                <span>
                  <span id="scoreFollowToggle">
                    <input
                      id="controlAutomaticPageTurning"
                      type="checkbox"
                      ref="scoreFollowingToggle"
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
              {"demo" in this.props ? (
                <div className="annoButtons">
                  <button id="circleButton" disabled>
                    Circle
                  </button>
                </div>
              ) : (
                <div className="annoButtons">
                  <button
                    id="circleButton"
                    className={this.state.circleButtonActive ? "active" : ""}
                    onClick={() => {
                      console.log("CLICK!", this.state.circleButtonActive);
                      this.setState({
                        selectorString: !this.state.circleButtonActive
                          ? ".note, .dir, .dynam"
                          : "",
                        onSelect: !this.state.circleButtonActive
                          ? this.submitCircleAnnotation
                          : () =>
                              console.error(
                                "onSelect with no selection handler",
                              ),
                        circleButtonActive: !this.state.circleButtonActive,
                        deleteAnnoButtonActive: false,
                      });
                    }}
                  >
                    {" "}
                    Circle{" "}
                  </button>
                  <button
                    id="deleteAnnoButton"
                    className={
                      this.state.deleteAnnoButtonActive ? "active" : ""
                    }
                    onClick={() => {
                      console.log("CLICK!", this.state.deleteAnnoButtonActive);
                      this.setState({
                        selectorString: !this.state.deleteAnnoButtonActive
                          ? ".scoreAnnotation"
                          : "",
                        onSelect: !this.state.deleteAnnoButtonActive
                          ? this.deleteAnnotations
                          : () =>
                              console.error(
                                "onSelect with no selection handler",
                              ),
                        deleteAnnoButtonActive:
                          !this.state.deleteAnnoButtonActive,
                        circleButtonActive: false,
                      });
                    }}
                  >
                    {" "}
                    Delete annotations{" "}
                  </button>
                </div>
              )}
              {"demo" in this.props
                ? "Score annotation not supported in demo version"
                : ""}
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
                <button
                  className="delete"
                  onClick={() => this.deleteSelectedPerformance()}
                >
                  Delete performance
                </button>
              </div>
            ) : (
              <div />
            )}
          </div>
          <div className="videoWrapper">
            <MidiPlayer
              ref={this.player}
              url={this.state.selectedVideo}
              onNote={(note) => {
                this.tick(this.state.selectedVideo, note.endTime);
              }}
            />
          </div>
        </div>
      );
    }
  }

  handleSegmentSelected = (e) => {
    const selected = this.state.segments.filter((seg) => {
      return seg["@id"] === e.target.value;
    });
    const target =
      selected[0]["http://purl.org/vocab/frbr/core#embodiment"][
        "http://www.w3.org/2000/01/rdf-schema#member"
      ]["@id"];
    this.props.scorePageToComponentTarget(
      target,
      this.state.currentScore,
      this.props.score.MEI[this.state.currentScore],
    );
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
          this.player.current.currentTime = Math.floor(startTime);
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
      // The performance is mo:recorded_as an mo:Signal, the signal is mo:derived_from the midi file
      const selectedVideo =
        selectedPerformance["http://purl.org/ontology/mo/recorded_as"][
          "http://purl.org/ontology/mo/derived_from"
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
      this.setState({ selectedVideo, selectedPerformance, seekTo }, () => {
        this.props.registerClock(selectedVideo);
        if (this.player.current) {
          this.player.current.currentTime = seekTo;
        }
      });
    }
  };

  handlePerformanceSelected = (perfId) => {
    console.log("Rendition selected: ", perfId);
    if (perfId === "none") {
      return;
    }
    const selected = this.state.performances.filter((perf) => {
      return perf["@id"] === perfId;
    });
    const selectedVideo =
      selected[0]["http://purl.org/ontology/mo/recorded_as"][
        "http://purl.org/ontology/mo/derived_from"
      ]["@id"];
    const selectedPerformance = selected[0];
    this.props.registerClock(selectedVideo);
    let newState = { selectedVideo, selectedPerformance };
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
    this.setState(newState);
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
            // (only if we are showing alignment confidence)
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
          if (this.state.scoreFollowing) {
            console.log("Asking Score to flip to: ", noteToFlipTo);
            this.props.scorePageToComponentTarget(
              noteToFlipTo["@id"],
              this.state.currentScore,
              this.props.score.MEI[this.state.currentScore],
            );
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
      this.setState(newState);
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
          this.props.fetchScore(currentScore); // register it with reducer to obtain page count, etc
          this.setState({
            performances,
            segments,
            instants,
            instantsByPerfTime,
            instantsByNoteId,
            currentScore,
            performedElements,
            performanceErrors,
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
        this.props.fetchScore(currentScore); // register it with reducer to obtain page count, etc
        // there are no performances -- force pageView mode and disable scorefollowing
        this.setState({
          segments,
          currentScore,
          mode: "pageView",
          scoreFollowing: false,
        });
      }
    }
  };
}

function mapStateToProps({ score, graph, traversalPool }) {
  return { score, graph, traversalPool };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      fetchScore,
      traverse,
      registerTraversal,
      setTraversalObjectives,
      checkTraversalObjectives,
      scoreNextPageStatic,
      scorePrevPageStatic,
      scorePageToComponentTarget,
      registerClock,
      tickTimedResource,
    },
    dispatch,
  );
}

export default connect(mapStateToProps, mapDispatchToProps, false, {
  forwardRef: true,
})(Companion);

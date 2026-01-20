import React, { Component } from "react";
import ReactDOM from "react-dom";

const defaultY = 80; // for edge-case of only-one-note-on-page

// Standard metronome markings (BPM values)
const STANDARD_METRONOME_MARKINGS = [
  40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 63, 66, 69, 72, 76, 80, 84, 88,
  92, 96, 100, 104, 108, 112, 116, 120, 126, 132, 138, 144, 152, 160, 168, 176,
  184, 200, 208,
];

export default class TempoCurveVis extends Component {
  constructor(props) {
    super(props);
    this.state = {
      width: this.props.width || "1280",
      height: this.props.height || "120",
      pointsPerTimeline: {},
      tempoRange: null, // { min: number, max: number, displayMin: number, displayMax: number }
      selectedMetronomeMarkings: [],
    };
    this.tempoCurveSvg = React.createRef();
  }

  componentDidMount() {
    console.log("tempo mounted with props ", this.props);
    this.calculateGlobalTempoRange();
  }
  componentDidUpdate(prevProps) {
    if (
      "currentQstamp" in prevProps &&
      prevProps.currentQstamp !== this.props.currentQstamp
    ) {
      // current score time has changed, e.g. because playback has progressed
      // clear previously active
      const previouslyActive = ReactDOM.findDOMNode(
        this.tempoCurveSvg.current,
      ).querySelectorAll(".active");
      Array.from(previouslyActive).map((p) => p.classList.remove("active"));
      // grab elements on current timeline
      const currentTlElements = ReactDOM.findDOMNode(
        this.tempoCurveSvg.current,
      ).querySelectorAll(".currentTl");
      // make those active with a qstamp at or before the currentQstamp
      Array.from(currentTlElements).forEach((e) => {
        if (
          parseFloat(e.getAttribute("data-qstamp")) <= this.props.currentQstamp
        ) {
          e.classList.add("active");
        }
      });
    }
    if (
      "instantsByScoretimeLastModified" in prevProps &&
      prevProps.instantsByScoretimeLastModified !==
        this.props.instantsByScoretimeLastModified
    ) {
      // instantsByScoretime changed, e.g. because page has been flipped
      // recalculate points per timeline
      this.setPointsPerTimeline();
    }
    // Recalculate global tempo range if instantsByNoteId or timemapByNoteId changed
    if (
      prevProps.instantsByNoteId !== this.props.instantsByNoteId ||
      prevProps.timemapByNoteId !== this.props.timemapByNoteId
    ) {
      this.calculateGlobalTempoRange();
    }
  }

  // Calculate global min/max tempo from entire performance (all timelines)
  calculateGlobalTempoRange = () => {
    if (
      !this.props.instantsByNoteId ||
      !this.props.timemapByNoteId ||
      Object.keys(this.props.instantsByNoteId).length === 0
    ) {
      return;
    }

    const allTempos = [];

    // Process all timelines
    this.props.timelinesToVis.forEach((tl) => {
      if (!this.props.instantsByNoteId[tl]) {
        return;
      }

      // Get all instants for this timeline
      const allInstants = Object.values(this.props.instantsByNoteId[tl])
        .flat()
        .filter((inst) => {
          // Filter out invalid instants (duration -1)
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
          // Sort by performance time
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

      // Helper to get average qstamp for an instant from instantsByNoteId
      const getQstampForInstant = (inst) => {
        const ensureArray =
          this.props.ensureArray ||
          ((val) => (Array.isArray(val) ? val : val ? [val] : []));
        const embodiments = ensureArray(
          inst["http://purl.org/vocab/frbr/core#embodimentOf"],
        );
        const qstamps = embodiments
          .map((emb) => {
            const noteId = emb["@id"].substr(emb["@id"].lastIndexOf("#") + 1);
            return this.props.timemapByNoteId[noteId]?.qstamp;
          })
          .filter((q) => q !== undefined);

        if (qstamps.length === 0) return null;
        return qstamps.reduce((sum, q) => sum + q, 0) / qstamps.length;
      };

      // Calculate tempo (iii) between consecutive instants
      for (let i = 1; i < allInstants.length; i++) {
        const prevInst = allInstants[i - 1];
        const thisInst = allInstants[i];

        const prevT = parseFloat(
          prevInst["http://purl.org/NET/c4dm/timeline.owl#at"].replace(
            /[PS]/g,
            "",
          ),
        );
        const thisT = parseFloat(
          thisInst["http://purl.org/NET/c4dm/timeline.owl#at"].replace(
            /[PS]/g,
            "",
          ),
        );

        const deltaT = thisT - prevT;
        if (deltaT <= 0) continue; // Skip invalid intervals

        const prevQ = getQstampForInstant(prevInst);
        const thisQ = getQstampForInstant(thisInst);

        if (prevQ === null || thisQ === null) continue;

        const deltaQ = thisQ - prevQ;
        if (deltaQ <= 0) continue; // Skip invalid intervals

        // Calculate inter-instant-interval (iii)
        const iii = deltaQ / deltaT;
        const bpm = iii * 60; // Convert to BPM

        if (isFinite(bpm) && bpm > 0 && bpm < 1000) {
          // Reasonable BPM range
          allTempos.push(bpm);
        }
      }
    });

    if (allTempos.length === 0) {
      // Fallback to default range
      this.setState({
        tempoRange: {
          min: 40,
          max: 200,
          displayMin: 40,
          displayMax: 200,
        },
        selectedMetronomeMarkings: [40, 60, 80, 100, 120, 140, 160, 180, 200],
      });
      return;
    }

    // Sort tempos and find min/max
    allTempos.sort((a, b) => a - b);
    const minTempo = allTempos[0];
    const maxTempo = allTempos[allTempos.length - 1];

    // Use 10%-90% range
    const percentile10Index = Math.floor(allTempos.length * 0.1);
    const percentile90Index = Math.min(
      Math.floor(allTempos.length * 0.9),
      allTempos.length - 1,
    );
    const percentile10 = allTempos[percentile10Index];
    const percentile90 = allTempos[percentile90Index];

    const displayMin = Math.max(percentile10, minTempo * 0.5); // Don't go too far below
    const displayMax = Math.min(percentile90, maxTempo * 1.5); // Don't go too far above

    // Select appropriate metronome markings
    const selectedMarkings = this.selectMetronomeMarkings(
      displayMin,
      displayMax,
    );

    this.setState(
      {
        tempoRange: {
          min: minTempo,
          max: maxTempo,
          displayMin: displayMin,
          displayMax: displayMax,
        },
        selectedMetronomeMarkings: selectedMarkings,
      },
      () => {
        // Recalculate points when tempo range changes
        if (Object.keys(this.props.instantsByScoretime || {}).length > 0) {
          this.setPointsPerTimeline();
        }
      },
    );
  };

  // Select appropriate metronome markings within the display range
  // Ensures minimum pixel spacing between labels to avoid overlap
  selectMetronomeMarkings = (minBpm, maxBpm) => {
    const height = parseInt(this.state.height, 10) || 120;
    const minPixelSpacing = 12; // Minimum pixels between labels

    // Helper to convert BPM to y position for this range
    const bpmToYLocal = (bpm) => {
      const range = maxBpm - minBpm;
      if (range <= 0) return height / 2;
      const normalized = (bpm - minBpm) / range;
      return Math.max(0, Math.min(1, normalized)) * height;
    };

    // Filter markings within range
    const inRange = STANDARD_METRONOME_MARKINGS.filter(
      (marking) => marking >= minBpm * 0.9 && marking <= maxBpm * 1.1,
    );

    if (inRange.length === 0) {
      // If no standard markings in range, use min and max rounded to nearest 10
      return [Math.round(minBpm / 10) * 10, Math.round(maxBpm / 10) * 10];
    }

    // Select markings ensuring minimum pixel spacing
    const selected = [];
    let lastY = -Infinity;

    for (const marking of inRange) {
      const y = bpmToYLocal(marking);
      if (y - lastY >= minPixelSpacing) {
        selected.push(marking);
        lastY = y;
      }
    }

    // Always try to include the last marking if there's room
    const lastMarking = inRange[inRange.length - 1];
    if (selected[selected.length - 1] !== lastMarking) {
      const lastSelectedY = bpmToYLocal(selected[selected.length - 1]);
      const lastMarkingY = bpmToYLocal(lastMarking);
      if (lastMarkingY - lastSelectedY >= minPixelSpacing) {
        selected.push(lastMarking);
      }
    }

    return selected;
  };

  // Convert BPM to y position using dynamic scale
  bpmToY = (bpm) => {
    if (!this.state.tempoRange) {
      // Fallback to old scale
      return (bpm * 50) / 60;
    }

    const { displayMin, displayMax } = this.state.tempoRange;
    const range = displayMax - displayMin;
    if (range <= 0) {
      return this.state.height / 2;
    }

    // Map BPM to y position (0 to height)
    // Higher BPM = higher y position
    const normalized = (bpm - displayMin) / range;
    return normalized * this.state.height;
  };

  // Convert y position to BPM using dynamic scale
  yToBpm = (y) => {
    if (!this.state.tempoRange) {
      // Fallback to old scale
      return (y / 50) * 60;
    }

    const { displayMin, displayMax } = this.state.tempoRange;
    const range = displayMax - displayMin;
    if (range <= 0) {
      return displayMin;
    }

    const normalized = y / this.state.height;
    return displayMin + normalized * range;
  };

  setPointsPerTimeline = () => {
    let pointsPerTimeline = {};
    this.props.timelinesToVis.forEach((tl) => {
      let scoretimeArray = Object.keys(this.props.instantsByScoretime[tl]).sort(
        (a, b) => {
          return parseFloat(a) - parseFloat(b);
        },
      );
      // for each instant on this page ...
      let pointsForThisTl = [];
      let hadInvalidGap = false;
      scoretimeArray.forEach((qstamp, ix) => {
        // xpos should be average x position for note elements at this qstamp
        let noteElementsAtQstamp = [];
        this.props.instantsByScoretime[tl][qstamp].forEach((inst) => {
          noteElementsAtQstamp.push(this.props.noteElementsForInstant(inst));
        });
        let sumXPos = noteElementsAtQstamp.flat().reduce((sumX, note) => {
          let absolute = this.props.convertCoords(note);
          return sumX + (absolute.x + absolute.x2) / 2;
        }, 0);
        let avgXPos = sumXPos / noteElementsAtQstamp.flat().length;

        // calculate y position (default to 0 on first instant)
        let yPos = 0;
        if (ix > 0) {
          // calculate change in avg performance time of instants at previous and current qstamp
          // TODO optimise (cache)
          const theseTimestamps = this.props.instantsByScoretime[tl][
            qstamp
          ].map((inst) => {
            return parseFloat(
              inst["http://purl.org/NET/c4dm/timeline.owl#at"].replace(
                /[PS]/g,
                "",
              ),
            );
          });
          const thisT =
            theseTimestamps.reduce((sumT, t) => sumT + t) /
            theseTimestamps.length;

          const prevTimestamps = this.props.instantsByScoretime[tl][
            scoretimeArray[ix - 1]
          ].map((inst) => {
            return parseFloat(
              inst["http://purl.org/NET/c4dm/timeline.owl#at"].replace(
                /[PS]/g,
                "",
              ),
            );
          });
          const prevT =
            prevTimestamps.reduce((sumT, t) => sumT + t) /
            prevTimestamps.length;

          const deltaT = thisT - prevT;

          // calculate change in scoretime (qstamp) between this and the current one
          const deltaQ =
            parseFloat(qstamp) - parseFloat(scoretimeArray[ix - 1]);

          // calculate inter-instant-interval (change in score time per change in performed time)
          const iii = deltaQ / deltaT;
          // Convert iii to BPM and then to y position using dynamic scale
          const bpm = iii * 60;
          if (!isFinite(bpm) || bpm <= 0) {
            hadInvalidGap = true;
            return;
          }
          yPos = this.bpmToY(bpm);
        }
        // if our point is on the current timeline and before or equal to the current qstamp, we are "active"
        const isActive =
          tl === this.props.currentTimeline &&
          qstamp <= this.props.currentQstamp;
        // return point data for this timeline and scoretime
        pointsForThisTl.push({
          x: avgXPos,
          y: yPos,
          qstamp: qstamp,
          instants: this.props.instantsByScoretime[tl][qstamp],
          isActive,
          gapFromPrevValid: hadInvalidGap,
        });
        hadInvalidGap = false;
      });
      pointsPerTimeline[tl] = pointsForThisTl;
    });
    this.setState({ pointsPerTimeline });
  };

  render() {
    if (
      this.props.displayTempoCurves &&
      Object.keys(this.state.pointsPerTimeline).length
    ) {
      let svgElements = [];
      // generate barlines
      Array.from(this.props.barlinesOnPage).forEach((bl, ix) => {
        const absolute = this.props.convertCoords(bl);
        svgElements.push(
          this.props.makeLine(
            "barLineAttr", // className,
            null, // qstamp - barlines don't need one!
            null, // timeline - barlines don't need one!
            absolute.x,
            "0",
            absolute.x,
            this.state.height, // x1, y1, x2, y2
            "barline-" + ix, // react key
            null, // titleString - barlines don't need one!
          ),
        );
      });

      // generate bpm markers using selected metronome markings
      const bpmMarkersToDraw =
        this.state.selectedMetronomeMarkings.length > 0
          ? this.state.selectedMetronomeMarkings
          : [40, 60, 80, 100, 120, 140]; // Fallback
      bpmMarkersToDraw.forEach((bpm, ix) => {
        const yPos = this.bpmToY(bpm);
        svgElements.push(
          this.props.makeLine(
            "bpmMarker", // className
            null, // qstamp - bpmMarker doesn't need one!
            null, // timeline - bpmMarker doesn't need one!
            "0",
            Math.round(yPos),
            this.state.width,
            Math.round(yPos), // x1, y1, x2, y2
            "bpm-" + bpm, // reactKey
            bpm + " b.p.m.", // title string
          ),
        );
        svgElements.push(
          <text
            key={bpm + "label"}
            style={{ fontSize: 8, fill: "darkgrey" }}
            // black magic transform... (to compensate for flipped svg coord system)
            // -2 * yPos aligns with line, -4 shifts text slightly above
            transform={
              "scale(1, -1) translate(0, " + (-2 * Math.round(yPos) - 4) + ")"
            }
            x="0"
            y={Math.round(yPos)}
            className="bpmLabel"
          >
            {bpm + " b.p.m."}
          </text>,
        );
        svgElements.push(
          <text
            key={bpm + "label2"}
            style={{ fontSize: 8, fill: "darkgrey" }}
            // black magic transform... (to compensate for flipped svg coord system)
            // -2 * yPos aligns with line, -4 shifts text slightly above
            transform={
              "scale(1, -1) translate(0, " + (-2 * Math.round(yPos) - 4) + ")"
            }
            x={this.state.width - 40}
            y={Math.round(yPos)}
            className="bpmLabel"
          >
            {bpm + " b.p.m."}
          </text>,
        );
      });
      // generate points and lines for each timeline
      // ensure that the currently active timeline (if any) is painted last, to paint over the others
      // (no z-index CSS for SVGs...)
      let timelinesInOrder = this.props.timelinesToVis;
      if (this.props.currentTimeline) {
        const currentTlIndex = timelinesInOrder.indexOf(
          this.props.currentTimeline,
        );
        if (currentTlIndex > -1) {
          timelinesInOrder.splice(currentTlIndex, 1);
          timelinesInOrder.push(this.props.currentTimeline);
        } else {
          console.warn(
            "FeatureVis: Cannot find current timeline in timelinesToVis",
          );
        }
      }
      timelinesInOrder.forEach((tl) => {
        // for each timeline...
        let lines = [];
        let points = [];
        const tlPoints = this.state.pointsPerTimeline[tl];
        tlPoints.forEach((pt, ix) => {
          let instantsString = pt.instants.map((inst) => inst["@id"]).join(",");
          // determine CSS class: "currentTl" if timeline corresponds to selected performance
          // "active" if point is before or equal to the currently active qstamp (in playback)
          let className = tl === this.props.currentTimeline ? "currentTl" : "";
          const dashedClass = pt.gapFromPrevValid ? " dashed" : "";
          let prevX = 0;
          let prevY = 0;
          if (ix > 0) {
            prevX = tlPoints[ix - 1].x;
            prevY = tlPoints[ix - 1].y;
          }
          if (ix === 0) {
            // at the first point:
            // no line to previous (because no previous)
            // "steal" Y position from 2nd point (because no iii at first point)
            // UNLESS (edge-case!) it's the only note on page, in which case use middle of range
            let stolenY =
              tlPoints.length === 1
                ? this.state.tempoRange
                  ? this.bpmToY(
                      (this.state.tempoRange.displayMin +
                        this.state.tempoRange.displayMax) /
                        2,
                    )
                  : defaultY
                : tlPoints[ix + 1].y;
            points.push(
              this.props.makePoint(
                className,
                pt.qstamp,
                tl, // timeline
                pt.x,
                stolenY,
                "3",
                "3", //cx, cy, rx, ry
                "point-" + tl + ix, // react key
                "Point: " + instantsString + " qstamp: " + pt.qstamp, // titleString
              ),
            );
          } else if (ix === 1) {
            // at the second point:
            // connect line to "estimated" first point (with stolen Y position)
            // and draw a "normal" point
            lines.push(
              this.props.makeLine(
                className + " tempoConnector estimated" + dashedClass,
                pt.qstamp,
                tl, //timeline
                prevX,
                pt.y,
                pt.x,
                pt.y, // x1, y1, x2, y2
                "line-" + tl + ix, // react key
                "Line: " + instantsString + " qstamp: " + pt.qstamp, // titleString
              ),
            );
            points.push(
              this.props.makePoint(
                className,
                pt.qstamp,
                tl, //timeline
                pt.x,
                pt.y,
                "3",
                "3", //cx, cy, rx, ry
                "point-" + tl + ix, // react key
                "Point: " +
                  instantsString +
                  " qstamp: " +
                  pt.qstamp +
                  " b.p.m.: " +
                  this.yToBpm(pt.y).toFixed(2), // titleString
              ),
            );
          } else {
            // "normal" line and point
            lines.push(
              this.props.makeLine(
                className + " tempoConnector" + dashedClass,
                pt.qstamp,
                tl, //timeline
                prevX,
                prevY,
                pt.x,
                pt.y, // x1, y1, x2, y2
                "line-" + tl + ix, // react key
                "Line: " +
                  instantsString +
                  " qstamp: " +
                  pt.qstamp +
                  " b.p.m.: " +
                  this.yToBpm(pt.y).toFixed(2), // titleString
              ),
            );
            points.push(
              this.props.makePoint(
                className,
                pt.qstamp,
                tl, //timeline
                pt.x,
                pt.y,
                "3",
                "3", //cx, cy, rx, ry
                "point-" + tl + ix, // react key
                "Point: " +
                  instantsString +
                  " qstamp: " +
                  pt.qstamp +
                  " b.p.m.: " +
                  this.yToBpm(pt.y).toFixed(2), // titleString
              ),
            );
          }
        });
        // SVGs don't support CSS z-index, so we need to be careful with our ordering:
        // We want whole timelines to be consistent in their z-axis ordering
        // But on a given timeline, we want points to paint over lines.
        svgElements = [...svgElements, lines, points];
      });
      return (
        <svg
          id="tempoCurve"
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          width={this.state.width}
          height={this.state.height}
          transform="scale(1,-1) translate(0, 50)"
          ref={this.tempoCurveSvg}
        >
          {svgElements}
        </svg>
      );
    } else {
      return <div id="tempoCurveLoading">Rendering tempo curves...</div>;
    }
  }
}

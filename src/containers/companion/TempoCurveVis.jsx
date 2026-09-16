import React, { Component } from "react";
import { memoLast } from "./featureVisData";
import {
  tempoRange,
  tempoPoints,
  selectMetronomeMarkings,
  bpmToY,
} from "./tempoData";

export default class TempoCurveVis extends Component {
  range = memoLast(tempoRange);
  points = memoLast(tempoPoints);
  markings = memoLast(selectMetronomeMarkings);
  render() {
    const width = this.props.width || 1280;
    const height = this.props.height || 120;
    const range = this.range(
      this.props.instantsByNoteId,
      this.props.timemapByNoteId,
    );
    const pointsPerTimeline = this.points(this.props.pageData, range, height);
    const selectedMetronomeMarkings = this.markings(
      range.displayMin,
      range.displayMax,
      height,
    );
    const toY = (bpm) => bpmToY(bpm, range, height);
    const toBpm = (y) =>
      range.displayMin + (y / height) * (range.displayMax - range.displayMin);
    if (
      this.props.displayTempoCurves &&
      Object.keys(pointsPerTimeline).length
    ) {
      let svgElements = [];
      // generate barlines
      this.props.pageData.geometry.barlines.forEach((absolute, ix) => {
        svgElements.push(
          this.props.makeLine(
            "barLineAttr", // className,
            null, // qstamp - barlines don't need one!
            null, // timeline - barlines don't need one!
            absolute.x,
            "0",
            absolute.x,
            height, // x1, y1, x2, y2
            "barline-" + ix, // react key
            null, // titleString - barlines don't need one!
          ),
        );
      });

      // generate bpm markers using selected metronome markings
      const bpmMarkersToDraw =
        selectedMetronomeMarkings.length > 0
          ? selectedMetronomeMarkings
          : [40, 60, 80, 100, 120, 140]; // Fallback
      bpmMarkersToDraw.forEach((bpm) => {
        const yPos = toY(bpm);
        svgElements.push(
          this.props.makeLine(
            "bpmMarker", // className
            null, // qstamp - bpmMarker doesn't need one!
            null, // timeline - bpmMarker doesn't need one!
            "0",
            Math.round(yPos),
            width,
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
            x={width - 40}
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
      let timelinesInOrder = [...this.props.timelinesToVis];
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
        const tlPoints = pointsPerTimeline[tl];
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
                ? range
                  ? toY((range.displayMin + range.displayMax) / 2)
                  : 80
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
                  toBpm(pt.y).toFixed(2), // titleString
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
                  toBpm(pt.y).toFixed(2), // titleString
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
                  toBpm(pt.y).toFixed(2), // titleString
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
          width={width}
          height={height}
          transform="scale(1,-1) translate(0, 50)"
        >
          {svgElements}
        </svg>
      );
    } else {
      return <div id="tempoCurveLoading">Rendering tempo curves...</div>;
    }
  }
}

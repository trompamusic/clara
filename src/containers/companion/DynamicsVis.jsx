import React, { Component } from "react";
import { memoLast, dynamicsDrawing } from "./featureVisData";

export default class DynamicsVis extends Component {
  drawing = memoLast(dynamicsDrawing);

  render() {
    const {
      pageData,
      performedElements,
      staffmap,
      stafflayermap,
      currentTimeline,
      makePoint,
      makeLine,
      makePolygon,
    } = this.props;
    const drawing = this.drawing(
      pageData,
      performedElements,
      staffmap,
      stafflayermap,
    );
    const width = this.props.width || 1280;
    const height = this.props.height || 120;
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

    // generate dynamic (velocity) markers
    const velocityMarkersToDraw = [20, 40, 60, 80, 100, 120];
    velocityMarkersToDraw.forEach((velocity, ix) => {
      svgElements.push(
        this.props.makeLine(
          "velocityMarker", // className
          null, // qstamp - velocityMarker doesn't need one!
          null, // timeline - velocityMarker doesn't need one!
          "0",
          Math.round((velocity * 50) / 60),
          width,
          Math.round((velocity * 50) / 60), // x1, y1, x2, y2
          "velocity-" + velocity, // reactKey
          velocity + " b.p.m.", // title string
        ),
      );
      svgElements.push(
        <text
          key={velocity + "label"}
          style={{ fontSize: 8, fill: "darkgrey" }}
          // black magic transform... (to compensate for flipped svg coord system)
          transform={
            "scale(1, -1) translate(0, -" +
            Math.round(velocity * 0.7 + velocity - 0.9 * ix) +
            ")"
          }
          x="0"
          y={Math.round((velocity * 50) / 60)}
          className="velocityLabel"
        >
          {velocity}
        </text>,
      );
      svgElements.push(
        <text
          key={velocity + "label2"}
          style={{ fontSize: 8, fill: "darkgrey" }}
          // black magic transform... (to compensate for flipped svg coord system)
          transform={
            "scale(1, -1) translate(0, -" +
            Math.round(velocity * 0.7 + velocity - 0.9 * ix) +
            ")"
          }
          x={width - 40}
          y={Math.round((velocity * 50) / 60)}
          className="velocityLabel"
        >
          {velocity}
        </text>,
      );
    });

    const timelines = [...pageData.timelinesToVis].sort(
      (a, b) => Number(a === currentTimeline) - Number(b === currentTimeline),
    );
    const summary = timelines.flatMap((tl) => {
      const cls = tl === currentTimeline ? "currentTl" : "";
      return [
        ...drawing[tl].summary.map((p) =>
          makePoint(
            cls + " staffPoint staff" + p.staff,
            p.qstamp,
            tl,
            p.x,
            p.y,
            3,
            3,
            tl + p.qstamp,
            "Maximum velocity for this staff: " + p.y,
          ),
        ),
        ...drawing[tl].segments.map(({ from, to }) =>
          makeLine(
            "dynamicsConnector " + cls + " staffPoint staff" + from.staff,
            from.qstamp,
            tl,
            from.x,
            from.y,
            to.x,
            to.y,
            tl + from.qstamp + "-line",
            "qstamp from: " + from.qstamp + " qstamp to: " + to.qstamp,
          ),
        ),
      ];
    });
    const svg = (id, content) => (
      <svg
        id={id}
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        transform="scale(1,-1) translate(0, 50)"
      >
        {svgElements}
        {content}
      </svg>
    );
    return (
      <div id="dynamicsVis">
        <div
          className={
            this.props.displayDynamicsSummary ? "" : "removedFromDisplay"
          }
        >
          <div className="visLabel">Dynamics (summary)</div>
          {svg("dynamicsVisSummary", summary)}
        </div>
        {[...this.props.displayDynamicsPerStaff].sort().map((staff) => (
          <React.Fragment key={staff}>
            <div className="visLabel">Dynamics (min/max) for staff {staff}</div>
            {svg(
              "dynamicsStaff" + staff,
              timelines.map((tl) =>
                makePolygon(
                  (tl === currentTimeline ? "currentTl " : "") +
                    "staff" +
                    staff,
                  tl,
                  drawing[tl].staffPolygons[staff] || "",
                  tl + staff,
                  "staff" + staff + " on timeline " + tl,
                ),
              ),
            )}
          </React.Fragment>
        ))}
        {[...this.props.displayDynamicsPerStaffLayer].sort().map((tuple) => (
          <React.Fragment key={tuple}>
            <div className="visLabel">
              Dynamics (min/max) for staff {tuple.split(":")[0]} layer{" "}
              {tuple.split(":")[1]}
            </div>
            {svg(
              "dynamicsStaffLayer" + tuple,
              timelines.map((tl) =>
                makePolygon(
                  (tl === currentTimeline ? "currentTl " : "") +
                    "staff" +
                    tuple.split(":")[0] +
                    " layer" +
                    tuple.split(":")[1],
                  tl,
                  drawing[tl].layerPolygons[tuple] || "",
                  tl + tuple,
                  tuple + " on timeline " + tl,
                ),
              ),
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }
}

import React, { Component } from "react";
import TempoCurveVis from "./TempoCurveVis";
import ErrorRibbonVis from "./ErrorRibbonVis";
import DynamicsVis from "./DynamicsVis";
import ZoomBox from "./ZoomBox";
import FeatureVisControls from "./FeatureVisControls";
import {
  readFeatureVisPrefs,
  writeFeatureVisPrefs,
} from "./featureVisPreferences";

import {
  memoLast,
  scoreMetadata,
  pageData,
  averageQstamp,
} from "./featureVisData";

export default class FeatureVis extends Component {
  metadata = memoLast(scoreMetadata);
  derivePage = memoLast(pageData);
  combineData = memoLast((metadata, page) => ({ ...metadata, ...page }));
  data = () => {
    const page = this.props.committedPage;
    const metadata = this.metadata(page.mei, page.timemap);
    return this.combineData(
      metadata,
      this.derivePage(page, metadata, this.props.instantsByNoteId),
    );
  };
  constructor(props) {
    super(props);
    this.state = {
      displayTempoCurves: true,
      displayErrorRibbon: true,
      displayDynamicsSummary: true,
      displayDynamicsPerStaff: new Set(), // display detailed dynamics for these staff numbers
      displayDynamicsPerStaffLayer: new Set(), // display detailed dynamics for these staff-layer numbers
      zoomBoxLeft: 0,
      zoomBoxTop: 0,
      zoomBoxVisibility: "hidden",
      zoomBoxScoretime: null,
      zoomBoxTimeline: null,
    };
    this.zoomBoxDisplayTimer = null;
  }

  componentDidMount() {
    this.loadControlsFromStorage();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.uri !== this.props.uri) this.loadControlsFromStorage();
    const groups = this.data().instantsByScoretime;
    if (
      prevProps.committedPage !== this.props.committedPage ||
      (this.state.zoomBoxVisibility === "visible" &&
        !groups[this.state.zoomBoxTimeline]?.[this.state.zoomBoxScoretime])
    ) {
      clearTimeout(this.zoomBoxDisplayTimer);
      if (this.state.zoomBoxVisibility !== "hidden")
        this.setState({ zoomBoxVisibility: "hidden" });
    }
  }

  componentWillUnmount() {
    clearTimeout(this.zoomBoxDisplayTimer);
  }

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
    const availableStaff = new Set(Object.values(this.data().staffmap));
    const availableTuples = new Set(this.data().stafflayertuples);
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

  handleClick = (qstamp, tl) => {
    const group = this.data().instantsByScoretime[tl]?.[qstamp];
    if (group?.length) this.props.seekToInstant(group[0]);
  };

  handleClickSeekToInstant = (instant) => this.props.seekToInstant(instant);

  activeClass = (className, qstamp, tl) => {
    const q = averageQstamp(
      this.props.currentlyActiveNoteIds || [],
      this.data().timemapByNoteId,
    );
    return (
      className +
      (tl === this.props.currentTimeline &&
      q !== null &&
      qstamp !== null &&
      Number(qstamp) <= q
        ? " active"
        : "")
    );
  };

  render() {
    const data = this.data();
    const width = this.props.width || 1280;
    const height = this.props.height || 120;
    return (
      <div id="featureVisContainer">
        <ZoomBox
          left={this.state.zoomBoxLeft}
          top={this.state.zoomBoxTop}
          visibility={this.state.zoomBoxVisibility}
          scoretime={this.state.zoomBoxScoretime}
          timeline={this.state.zoomBoxTimeline}
          instantsByScoretime={data.instantsByScoretime}
          performedElements={this.props.performedElements}
          noteAttributes={data.noteAttributes}
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
          staffmap={data.staffmap}
          stafflayertuples={data.stafflayertuples}
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
                  Object.values(this.data().staffmap),
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
                displayDynamicsPerStaffLayer: new Set(data.stafflayertuples),
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
            pageData={data}
            width={width}
            height={height}
            currentTimeline={this.props.currentTimeline}
            displayTempoCurves={this.state.displayTempoCurves}
            timelinesToVis={data.timelinesToVis}
            makePoint={this.makePoint}
            makeLine={this.makeLine}
            instantsByNoteId={this.props.instantsByNoteId}
            timemapByNoteId={data.timemapByNoteId}
          />
        </div>
        <div
          className={
            this.state.displayErrorRibbon
              ? "errorRibbon"
              : "errorRibbon removedFromDisplay"
          }
          style={{ height: height + "px" }}
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
            instantsByNoteId={this.props.instantsByNoteId}
            pageData={data}
            width={width}
            height={height}
            currentTimeline={this.props.currentTimeline}
            handleClickSeekToInstant={this.handleClickSeekToInstant}
            instantsByPerfTime={this.props.instantsByPerfTime}
            performanceErrors={this.props.performanceErrors}
            timemapByNoteId={data.timemapByNoteId}
            timemap={data.timemap}
            makeRect={this.makeRect}
            makeLine={this.makeLine}
            makePoint={this.makePoint}
          />
        </div>
        <DynamicsVis
          pageData={data}
          width={width}
          height={height}
          currentTimeline={this.props.currentTimeline}
          makePoint={this.makePoint}
          makeLine={this.makeLine}
          makePolygon={this.makePolygon}
          performedElements={this.props.performedElements}
          staffmap={data.staffmap}
          stafflayermap={data.stafflayermap}
          stafflayertuples={data.stafflayertuples}
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
        className={this.activeClass(className, qstamp, tl)}
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
        className={this.activeClass(className, qstamp, tl)}
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
          const target = e.currentTarget;
          this.zoomBoxDisplayTimer = setTimeout(
            () => this.handleMouseLeave(target),
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
        className={this.activeClass(className, qstamp, tl)}
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

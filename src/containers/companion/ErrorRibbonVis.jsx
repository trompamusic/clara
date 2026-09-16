import React, { Component } from "react";
import { array, noteId } from "./featureVisData";

const inputKeys = [
  "performanceErrors",
  "instantsByPerfTime",
  "timemapByNoteId",
  "instantsByNoteId",
];
const inputs = (props) => inputKeys.map((key) => props[key]);
const same = (a, b) => a && b && a.every((value, i) => value === b[i]);
const validResult = (result) =>
  result &&
  typeof result === "object" &&
  !Array.isArray(result) &&
  Object.values(result).every(
    (entries) =>
      Array.isArray(entries) &&
      entries.every(
        (entry) =>
          Number.isFinite(entry?.qstamp) &&
          entry.instant &&
          typeof entry.instant === "object",
      ),
  );

export default class ErrorRibbonVis extends Component {
  state = { result: null, resultInputs: null, loading: true, error: null };
  requestId = 0;

  componentDidMount() {
    this.mounted = true;
    try {
      this.worker = new window.Worker("/workers/errorRibbonWorker.js?v=2");
      this.worker.onmessage = ({ data }) => {
        if (!this.mounted) return;
        if (
          !data ||
          !Number.isInteger(data.requestId) ||
          !(typeof data.error === "string" || validResult(data.result))
        ) {
          this.fail("Invalid error ribbon worker response");
          return;
        }
        if (
          data.requestId !== this.requestId ||
          !same(this.requestInputs, inputs(this.props))
        )
          return;
        if (data.error) this.fail(data.error);
        else
          this.setState({
            result: data.result,
            resultInputs: this.requestInputs,
            loading: false,
            error: null,
          });
      };
      this.worker.onerror = () => {
        this.workerFailed = true;
        this.fail("Error ribbon worker failed");
      };
      this.worker.onmessageerror = () =>
        this.fail("Unreadable error ribbon worker response");
      this.submit();
    } catch (error) {
      this.workerFailed = true;
      this.fail(String(error.message || error));
    }
  }

  componentDidUpdate() {
    if (!same(this.requestInputs, inputs(this.props))) this.submit();
  }

  componentWillUnmount() {
    this.mounted = false;
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.onmessageerror = null;
      this.worker.terminate();
    }
  }

  fail = (error) => {
    if (this.mounted)
      this.setState({
        loading: false,
        error,
        result: null,
        resultInputs: this.requestInputs,
      });
  };

  submit = () => {
    this.requestInputs = inputs(this.props);
    if (!this.worker || this.workerFailed) return;
    const requestId = ++this.requestId;
    this.setState({ loading: true, error: null });
    try {
      this.worker.postMessage({
        requestId,
        timelinesToVis: Object.keys(this.props.instantsByNoteId),
        ...Object.fromEntries(inputKeys.map((key) => [key, this.props[key]])),
      });
    } catch (error) {
      this.fail(String(error.message || error));
    }
  };

  render() {
    const {
      pageData: page,
      timemapByNoteId: map,
      currentTimeline,
      performanceErrors,
      makeLine,
      makeRect,
    } = this.props;
    const width = this.props.width || 1280,
      height = this.props.height || 120;
    const result = same(this.state.resultInputs, inputs(this.props))
      ? this.state.result
      : null;
    const elements = page.geometry.barlines.map((bar, i) =>
      makeLine(
        "barLineAttr",
        null,
        null,
        bar.x,
        0,
        bar.x,
        height,
        "barline-" + i,
        null,
      ),
    );
    const order = page.geometry.visualOrder.filter((id) =>
      Number.isFinite(map[id]?.qstamp),
    );
    const min = map[order[0]]?.qstamp,
      max = map[order[order.length - 1]]?.qstamp;
    const scoretimes = this.props.timemap
      .filter((t) => t.qstamp >= min && t.qstamp <= max)
      .slice()
      .sort((a, b) => a.qstamp - b.qstamp);
    [...page.timelinesToVis].sort().forEach((tl, i) => {
      const cls = tl === currentTimeline ? "currentTl" : "";
      const y =
        ((height * 0.9) / page.timelinesToVis.length) * i + 1 + height * 0.2;
      elements.push(
        makeLine(
          cls + " timelineMarker",
          null,
          tl,
          0,
          y,
          width,
          y,
          "timeline-" + tl,
          tl,
        ),
      );
      const deletedIds = new Set(
        array(performanceErrors[tl]?.deleted)
          .flatMap((d) => array(d))
          .map((e) => noteId(e["@id"])),
      );
      deletedIds.forEach((id) => {
        const note = page.geometry.notes[id];
        if (note && Number.isFinite(map[id]?.qstamp))
          elements.push(
            makeRect(
              cls + " deleted",
              map[id].qstamp,
              tl,
              note.x,
              y - 16,
              note.x2 - note.x,
              16,
              "deleted-" + tl + id,
              "deleted point in timeline " + tl,
            ),
          );
      });
      (result?.[tl] || []).forEach(({ qstamp, instant }, index) => {
        if (!(qstamp >= min && qstamp <= max)) return;
        const before = [...scoretimes]
          .reverse()
          .find((t) => t.qstamp <= qstamp);
        const after = scoretimes.find((t) => t.qstamp >= qstamp);
        if (!before) return;
        const notes = [before, after].flatMap((t) =>
          t ? page.notesForGroup[tl]?.[String(t.qstamp)] || [] : [],
        );
        if (!notes.length) return;
        const x = notes.reduce((sum, note) => sum + note.x, 0) / notes.length;
        elements.push(
          makeRect(
            cls + " inserted",
            String(before.qstamp),
            tl,
            x,
            y,
            12,
            16,
            "inserted-" + tl + index,
            "inserted point in timeline " + tl,
            () => this.props.handleClickSeekToInstant(instant, tl),
          ),
        );
      });
    });
    return (
      <div aria-busy={this.state.loading}>
        {this.state.error && (
          <div role="alert">Error visualization: {this.state.error}</div>
        )}
        <svg
          id="errorRibbon"
          xmlns="http://www.w3.org/2000/svg"
          width={width}
          height={height}
          transform="scale(1,-1) translate(0, 50)"
        >
          {elements}
        </svg>
      </div>
    );
  }
}

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Midi } from "@tonejs/midi";
import WebMidiRecorder from "./index";
import Api from "../../util/api";
import { createPerformanceLabel } from "../../util/date";
import {
  WebMidi,
  FakeInput,
  resetWebMidi,
  emitPortEvent,
} from "../../test/webmidiMock";

jest.mock("webmidi", () => require("../../test/webmidiMock"));
jest.mock("@ldo/solid-react", () => ({
  useSolidAuth: () => ({ session: { webId: "https://example.com/me" } }),
}));

const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock("../../util/api", () => ({
  __esModule: true,
  default: { alignMidi: jest.fn() },
}));

const alignMidi = Api.alignMidi as jest.Mock;

const WEB_ID = "https://example.com/me";
const SCORE = "https://example.com/score";
const OTHER_SCORE = "https://example.com/other";
const STORAGE_KEY = `at.ac.mdw.trompa-midiPerformance-https://example.com/me-${SCORE}`;
const RECORDED_AT = "2026-08-06T10:00:00.000Z";

function seedStoredTake() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ midiData: btoa("midi-bytes"), recordedAt: RECORDED_AT }),
  );
}

const flushEffects = () => act(() => Promise.resolve());

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  // jsdom's FileReader fires on the real event loop
  jest.useRealTimers();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
    fr.readAsArrayBuffer(blob);
  });
}

async function uploadedMidi(): Promise<Midi> {
  return new Midi(await blobToBytes(alignMidi.mock.calls[0][2]));
}

let input: FakeInput;

// Keyed by webId and score exactly as Perform.tsx does: the recorder holds an
// in-progress take, which must never survive into a different score.
function recorder(score = SCORE) {
  return (
    <WebMidiRecorder
      key={`${WEB_ID}-${score}`}
      score={score}
      expansionOptions={[]}
    />
  );
}

async function renderRecorder(score = SCORE) {
  const view = render(recorder(score));
  await flushEffects(); // WebMidi.enable() and the effects behind it
  return view;
}

function send(data: number[]) {
  act(() => input.send(data));
}

function advance(ms: number) {
  act(() => jest.advanceTimersByTime(ms));
}

// last note event + inactivity window + submission countdown
async function runToUpload() {
  advance(5000);
  advance(5000);
  await flushEffects();
}

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  mockNavigate.mockReset();
  alignMidi.mockReset();
  alignMidi.mockResolvedValue({ task_id: "task-1" });
  Object.defineProperty(navigator, "requestMIDIAccess", {
    value: () => undefined,
    configurable: true,
  });
  input = new FakeInput("dev-1", "Test Keyboard");
  resetWebMidi([input]);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("capture and upload", () => {
  it("records notes on any channel, with velocity-0 releases, and uploads them", async () => {
    await renderRecorder();

    expect(screen.getByText("🟢 Ready").closest(".card-header")).not.toBeNull();
    send([0x91, 60, 100]); // noteOn, channel 2
    expect(
      screen.getByText(/Recording$/).closest(".card-header"),
    ).not.toBeNull();
    expect(screen.queryByText("End take")).not.toBeInTheDocument();
    advance(1000);
    send([0x91, 60, 0]); // release as velocity-0 noteOn
    await runToUpload();

    expect(alignMidi).toHaveBeenCalledTimes(1);
    const midi = await uploadedMidi();
    expect(midi.tracks[0].notes).toHaveLength(1);
    expect(midi.tracks[0].notes[0].midi).toBe(60);
    expect(midi.tracks[0].notes[0].durationTicks).toBe(1000);
    expect(mockNavigate).toHaveBeenCalledWith(
      `/uploadwait?task=task-1&score=${SCORE}`,
    );
  });

  it("labels the upload with the recording start time, not submission time", async () => {
    await renderRecorder();

    const startedAt = Date.now();
    send([0x90, 60, 100]);
    advance(2000);
    send([0x80, 60, 0]);
    await runToUpload();

    expect(alignMidi.mock.calls[0][3]).toBe(
      createPerformanceLabel(new Date(startedAt)),
    );
  });

  it("does not finalise a chord that is still held", async () => {
    const { container } = await renderRecorder();

    send([0x90, 60, 100]);
    send([0x90, 64, 100]);
    advance(20000);

    expect(container.querySelector(".recording-status")).toBeInTheDocument();
    expect(alignMidi).not.toHaveBeenCalled();

    send([0x80, 60, 0]);
    send([0x80, 64, 0]);
    await runToUpload();

    const midi = await uploadedMidi();
    const durations = midi.tracks[0].notes.map((n) => n.durationTicks);
    expect(durations).toEqual([20000, 20000]);
  });

  it("closes a note whose noteOff never arrives when the device disconnects", async () => {
    await renderRecorder();

    send([0x90, 60, 100]);
    advance(30000);
    expect(alignMidi).not.toHaveBeenCalled();

    act(() => emitPortEvent("disconnected", input));
    advance(5000);
    await flushEffects();

    const midi = await uploadedMidi();
    expect(midi.tracks[0].notes).toHaveLength(1);
    expect(midi.tracks[0].notes[0].durationTicks).toBe(30000);
  });

  it("ignores system realtime messages entirely", async () => {
    const { container } = await renderRecorder();

    send([0xf8]); // clock while idle
    expect(
      container.querySelector(".recording-status"),
    ).not.toBeInTheDocument();

    send([0x90, 60, 100]);
    for (let i = 0; i < 100; i++) send([0xf8]);
    send([0x80, 60, 0]);
    advance(2500);
    send([0xf8]); // must not reset the inactivity window
    advance(2500);

    expect(container.querySelector(".countdown-status")).toBeInTheDocument();
    advance(5000);
    await flushEffects();

    const midi = await uploadedMidi();
    expect(midi.tracks[0].notes).toHaveLength(1);
  });
});

describe("submission countdown", () => {
  it("shows options only after cancelling submission", async () => {
    const { container } = await renderRecorder();

    send([0x90, 60, 100]);
    send([0x80, 60, 0]);
    advance(5000);

    expect(container.querySelector(".countdown-status")).toBeInTheDocument();
    expect(screen.queryByText(/Performance Options/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Stop / Edit settings"));
    advance(20000);

    expect(alignMidi).not.toHaveBeenCalled();
    // idle, but a pending take means playing would not be captured
    expect(container.querySelector(".ready-status")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Submit or discard your recording/),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Performance Options/)).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(stored.midiData).not.toContain(",");
    expect(() => atob(stored.midiData)).not.toThrow();
  });

  it("refuses a note during the countdown and still uploads the take once", async () => {
    const { container } = await renderRecorder();

    send([0x90, 60, 100]);
    send([0x80, 60, 0]);
    advance(5000);

    send([0x90, 64, 100]);
    expect(
      container.querySelector(".recording-status"),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".countdown-status")).toBeInTheDocument();

    advance(5000);
    await flushEffects();

    expect(alignMidi).toHaveBeenCalledTimes(1);
    const midi = await uploadedMidi();
    expect(midi.tracks[0].notes).toHaveLength(1);
    expect(midi.tracks[0].notes[0].midi).toBe(60);
  });

  it("keeps the take and shows the error when the automatic upload fails", async () => {
    alignMidi.mockRejectedValue(new Error("network"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await renderRecorder();

    send([0x90, 60, 100]);
    send([0x80, 60, 0]);
    await runToUpload();

    expect(
      screen.getByText(/Failed to upload performance/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Performance Options/)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("discard confirmation", () => {
  it("keeps automatic submission cancelled after cancelling discard confirmation", async () => {
    await renderRecorder();
    send([0x90, 60, 100]);
    send([0x80, 60, 0]);
    advance(5000);
    advance(4900);
    fireEvent.click(screen.getByText("Stop / Edit settings"));

    fireEvent.click(screen.getByText("Discard Recording"));
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(screen.queryByText(/Submitting in/)).not.toBeInTheDocument();
    advance(10000);
    expect(alignMidi).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Cancel"));
    advance(10000);
    expect(alignMidi).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    fireEvent.click(screen.getByText("Submit Recording"));
    await flushEffects();
    expect(alignMidi).toHaveBeenCalledTimes(1);
  });

  it("discards after cancelling submission and never uploads the discarded take", async () => {
    const { container } = await renderRecorder();
    send([0x90, 60, 100]);
    send([0x80, 60, 0]);
    advance(5000);
    fireEvent.click(screen.getByText("Stop / Edit settings"));
    fireEvent.click(screen.getByText("Discard Recording"));
    fireEvent.click(screen.getByText("Yes, Discard"));
    advance(10000);
    expect(alignMidi).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(container.querySelector(".ready-status")).toBeInTheDocument();
  });
});

describe("one performance at a time", () => {
  it("refuses recording while a take is pending, until it is discarded", async () => {
    const { container } = await renderRecorder();

    send([0x90, 60, 100]);
    send([0x80, 60, 0]);
    advance(5000);
    fireEvent.click(screen.getByText("Stop / Edit settings"));

    send([0x90, 64, 100]);
    expect(
      container.querySelector(".recording-status"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Discard Recording"));
    fireEvent.click(screen.getByText("Yes, Discard"));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    send([0x90, 64, 100]);
    expect(container.querySelector(".recording-status")).toBeInTheDocument();
  });
});

describe("performance metadata", () => {
  it("submits edited metadata after cancelling automatic submission", async () => {
    await renderRecorder();

    send([0x90, 60, 100]);
    send([0x80, 60, 0]);
    advance(5000); // countdown starts

    fireEvent.click(screen.getByText("Stop / Edit settings"));
    fireEvent.change(screen.getByLabelText(/Label for this performance/), {
      target: { value: "third attempt" },
    });

    advance(10000);
    expect(alignMidi).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Submit Recording"));
    await flushEffects();

    expect(alignMidi).toHaveBeenCalledTimes(1);
    expect(alignMidi.mock.calls[0][3]).toBe("third attempt");
  });
});

describe("recovered takes", () => {
  it("renders one amber card for a take recovered from storage", async () => {
    seedStoredTake();
    await renderRecorder();

    expect(screen.getByText(/Saved Recording/)).toBeInTheDocument();
    expect(screen.getByText(/wasn't uploaded/)).toBeInTheDocument();
    expect(screen.getAllByText(/Submit Recording/)).toHaveLength(1);
  });

  it("submits with a clean default label and no expansion field", async () => {
    seedStoredTake();
    await renderRecorder();

    fireEvent.click(screen.getByText("Submit Recording"));
    await flushEffects();

    const [, , , label, expansion] = alignMidi.mock.calls[0];
    expect(label).toBe(createPerformanceLabel(new Date(RECORDED_AT)));
    expect(expansion).toBeUndefined();
  });

  it("drops the pending take when the score changes, without touching storage", async () => {
    const { rerender } = await renderRecorder();

    send([0x90, 60, 100]);
    send([0x80, 60, 0]);
    advance(5000);
    fireEvent.click(screen.getByText("Stop / Edit settings"));
    expect(screen.getByText(/Performance Options/)).toBeInTheDocument();

    rerender(recorder(OTHER_SCORE));
    await flushEffects();

    expect(screen.queryByText(/Performance Options/)).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("abandons a take still being recorded when the score changes", async () => {
    const { rerender, container } = await renderRecorder();

    send([0x90, 60, 100]);
    send([0x80, 60, 0]);
    expect(container.querySelector(".recording-status")).toBeInTheDocument();

    rerender(recorder(OTHER_SCORE));
    await flushEffects();
    await runToUpload();

    // the in-flight take belonged to the old score: it must not finalise,
    // store or upload under the new one
    expect(alignMidi).not.toHaveBeenCalled();
    expect(screen.queryByText(/Performance Options/)).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(
      localStorage.getItem(
        `at.ac.mdw.trompa-midiPerformance-${WEB_ID}-${OTHER_SCORE}`,
      ),
    ).toBeNull();
  });
});

describe("recovery lifecycle", () => {
  it("recovers the same MIDI after a failed upload and clears it only after a successful retry", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    alignMidi.mockRejectedValueOnce(new Error("offline"));
    const firstVisit = await renderRecorder();
    send([0x90, 60, 100]);
    advance(750);
    send([0x80, 60, 0]);
    await runToUpload();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(saved.recordedAt).toBeTruthy();
    expect(screen.getByText(/Failed to upload/)).toBeInTheDocument();
    firstVisit.unmount();

    const returnVisit = await renderRecorder();
    expect(screen.getAllByText("Submit Recording")).toHaveLength(1);
    expect(screen.getByText(/Saved Recording/)).toBeInTheDocument();
    advance(20000);
    send([0x90, 64, 100]);
    expect(alignMidi).toHaveBeenCalledTimes(1);
    expect(
      returnVisit.container.querySelector(".recording-status"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Submit Recording"));
    await flushEffects();
    expect(alignMidi).toHaveBeenCalledTimes(2);
    const retryBytes = await blobToBytes(alignMidi.mock.calls[1][2]);
    expect(Array.from(retryBytes)).toEqual(
      Array.from(atob(saved.midiData), (c) => c.charCodeAt(0)),
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    returnVisit.unmount();

    const thirdVisit = await renderRecorder();
    expect(screen.queryByText(/Saved Recording/)).not.toBeInTheDocument();
    expect(
      thirdVisit.container.querySelector(".ready-status"),
    ).toBeInTheDocument();
  });

  it("keeps a take usable when storage is full", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    await renderRecorder();
    send([0x90, 60, 100]);
    advance(250);
    send([0x80, 60, 0]);
    advance(5000);
    fireEvent.click(screen.getByText("Stop / Edit settings"));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByText("Submit Recording")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Submit Recording"));
    await flushEffects();
    const midi = await uploadedMidi();
    expect(midi.tracks[0].notes[0].durationTicks).toBe(250);
  });

  it.each(["accepted", "failed"])(
    "ignores an upload that is %s after leaving the page",
    async (outcome) => {
      let resolve!: (value: { task_id: string }) => void;
      let reject!: (error: Error) => void;
      alignMidi.mockReturnValue(
        new Promise((yes, no) => {
          resolve = yes;
          reject = no;
        }),
      );
      seedStoredTake();
      const firstVisit = await renderRecorder();
      fireEvent.click(screen.getByText("Submit Recording"));
      firstVisit.unmount();
      await renderRecorder(OTHER_SCORE);
      await act(async () => {
        if (outcome === "accepted") resolve({ task_id: "late-task" });
        else reject(new Error("offline"));
      });
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
      expect(screen.queryByText(/Failed to upload/)).not.toBeInTheDocument();
    },
  );

  it("disables all recording controls for the duration of the request", async () => {
    alignMidi.mockReturnValue(new Promise(() => undefined));
    seedStoredTake();
    const { container } = await renderRecorder();
    fireEvent.click(screen.getByText("Submit Recording"));
    expect(container.querySelector("fieldset")).toBeDisabled();
    expect(screen.queryByText("Submit Recording")).not.toBeInTheDocument();
    expect(screen.queryByText("Discard Recording")).not.toBeInTheDocument();
    send([0x90, 60, 100]);
    expect(screen.queryByText("Yes, Discard")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(
      container.querySelector(".recording-status"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Uploading your performance",
    );
  });
});

describe("losing the device mid-take", () => {
  it("finalises the take, says why, and still uploads with no device present", async () => {
    const { container } = await renderRecorder();

    send([0x90, 60, 100]); // key still held: the gate would never open
    act(() => emitPortEvent("disconnected", input));

    expect(container.querySelector(".countdown-status")).toBeInTheDocument();
    expect(screen.getByText(/device changed/)).toBeInTheDocument();
    expect(screen.getByText(/No MIDI devices detected/)).toBeInTheDocument();

    advance(5000);
    await flushEffects();
    expect(alignMidi).toHaveBeenCalledTimes(1);
  });

  it("keeps recording through a reconnect returning the same device", async () => {
    const { container } = await renderRecorder();

    send([0x90, 60, 100]);
    // a fresh Input object with the same id: compared by id, not identity
    act(() =>
      emitPortEvent("connected", new FakeInput("dev-1", "Test Keyboard")),
    );

    expect(container.querySelector(".recording-status")).toBeInTheDocument();
    expect(screen.queryByText(/device changed/)).not.toBeInTheDocument();
  });

  it("leaves the countdown alone when a device disconnects during it", async () => {
    const { container } = await renderRecorder();

    send([0x90, 60, 100]);
    send([0x80, 60, 0]);
    advance(5000); // countdown running over a finished take

    act(() => emitPortEvent("disconnected", input));

    // the countdown belongs to the take, not to the device panel
    expect(container.querySelector(".countdown-status")).toBeInTheDocument();
    expect(screen.queryByText(/device changed/)).not.toBeInTheDocument();

    advance(5000);
    await flushEffects();
    expect(alignMidi).toHaveBeenCalledTimes(1);
  });

  it("finalises the take when the player switches device mid-take", async () => {
    resetWebMidi([input, new FakeInput("dev-2", "Second Keyboard")]);
    const { container } = await renderRecorder();
    const select = () => container.querySelector("select") as HTMLSelectElement;

    fireEvent.change(select(), { target: { value: "dev-1" } });
    send([0x90, 60, 100]); // key still held
    expect(container.querySelector(".recording-status")).toBeInTheDocument();

    fireEvent.change(select(), { target: { value: "dev-2" } });

    expect(container.querySelector(".countdown-status")).toBeInTheDocument();
    expect(screen.getByText(/device changed/)).toBeInTheDocument();
  });

  it("says nothing when a device disconnects while idle", async () => {
    await renderRecorder();

    act(() => emitPortEvent("disconnected", input));

    expect(screen.queryByText(/device changed/)).not.toBeInTheDocument();
  });

  it("finalises once when a disconnect lands as the settle window expires", async () => {
    await renderRecorder();

    send([0x90, 60, 100]);
    send([0x80, 60, 0]);
    act(() => {
      jest.advanceTimersByTime(5000);
      emitPortEvent("disconnected", input);
    });
    await flushEffects();

    // the timer got there first; the later event must not rewrite the reason
    expect(screen.queryByText(/device changed/)).not.toBeInTheDocument();

    advance(5000);
    await flushEffects();
    expect(alignMidi).toHaveBeenCalledTimes(1);
  });

  it("does not offer Ready when there is no device to play", async () => {
    resetWebMidi([]);
    const { container } = await renderRecorder();

    expect(container.querySelector(".ready-status")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Connect a MIDI device to record"),
    ).not.toBeInTheDocument();
  });
});

describe("one upload at a time", () => {
  it("uploads once when submission is cancelled and manually submitted near the deadline", async () => {
    await renderRecorder();

    send([0x90, 60, 100]);
    send([0x80, 60, 0]);
    advance(5000); // countdown starts

    advance(4900);
    fireEvent.click(screen.getByText("Stop / Edit settings"));
    fireEvent.click(screen.getByText("Submit Recording"));
    advance(5000); // the deadline would have passed by now
    await flushEffects();

    expect(alignMidi).toHaveBeenCalledTimes(1);
  });
});

describe("devices", () => {
  it("shows the unsupported message only when WebMIDI is missing", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    delete (navigator as any).requestMIDIAccess;
    await renderRecorder();

    expect(screen.getByText(/does not support WebMIDI/)).toBeInTheDocument();
  });

  it("does not offer Ready when WebMIDI is unavailable", async () => {
    delete (navigator as any).requestMIDIAccess;
    const { container } = await renderRecorder();

    expect(container.querySelector(".ready-status")).not.toBeInTheDocument();
  });

  it("shows the denied message when the permission prompt is refused", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    WebMidi.enable = jest.fn(async () => {
      throw new Error("denied");
    });
    await renderRecorder();

    expect(screen.getByText(/MIDI access was denied/)).toBeInTheDocument();
  });

  it("rebinds to the fresh Input object after a reconnect", async () => {
    const { container } = await renderRecorder();

    // reconnect delivers a new object with the same id
    const reconnected = new FakeInput("dev-1", "Test Keyboard");
    act(() => emitPortEvent("connected", reconnected));

    expect(input.listenerCount("midimessage")).toBe(0);
    act(() => reconnected.send([0x90, 60, 100]));
    expect(container.querySelector(".recording-status")).toBeInTheDocument();
  });

  it("reports the only device rather than offering a choice", async () => {
    const { container } = await renderRecorder();

    expect(screen.getByText("Test Keyboard")).toBeInTheDocument();
    expect(container.querySelector("select")).not.toBeInTheDocument();
  });

  it("offers a selector once there is more than one device", async () => {
    resetWebMidi([input, new FakeInput("dev-2", "Second Keyboard")]);
    const { container } = await renderRecorder();

    expect(container.querySelector("select")).toBeInTheDocument();
  });

  it("recovers when the selected device disconnects and returns", async () => {
    const { container } = await renderRecorder();

    act(() => emitPortEvent("disconnected", input));
    expect(screen.getByText(/No MIDI devices detected/)).toBeInTheDocument();

    const returned = new FakeInput("dev-1", "Test Keyboard");
    act(() => emitPortEvent("connected", returned));
    act(() => returned.send([0x90, 60, 100]));
    expect(container.querySelector(".recording-status")).toBeInTheDocument();
  });
});

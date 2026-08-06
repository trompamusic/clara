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

const SCORE = "https://example.com/score";
const STORAGE_KEY = `at.ac.mdw.trompa-midiPerformance-https://example.com/me-${SCORE}`;

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

async function renderRecorder() {
  const view = render(
    <WebMidiRecorder score={SCORE} expansionOptions={[]} />,
  );
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
});

describe("capture and upload", () => {
  it("records notes on any channel, with velocity-0 releases, and uploads them", async () => {
    await renderRecorder();

    send([0x91, 60, 100]); // noteOn, channel 2
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

  // Was covered by a 30s silence fallback. The gate is now only opened by the
  // player or by losing the device, so the note is closed on demand instead.
  it("closes a note whose noteOff never arrives when the take is ended by hand", async () => {
    await renderRecorder();

    send([0x90, 60, 100]);
    advance(30000);
    expect(alignMidi).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("End take"));
    advance(5000);
    await flushEffects();

    const midi = await uploadedMidi();
    expect(midi.tracks[0].notes).toHaveLength(1);
    expect(midi.tracks[0].notes[0].durationTicks).toBe(30000);
  });

  it("ends the take on demand and runs the countdown from there", async () => {
    const { container } = await renderRecorder();

    send([0x90, 60, 100]);
    send([0x80, 60, 0]);
    advance(1000); // still inside the settle window

    fireEvent.click(screen.getByText("End take"));
    expect(container.querySelector(".countdown-status")).toBeInTheDocument();

    advance(5000);
    await flushEffects();
    expect(alignMidi).toHaveBeenCalledTimes(1);
  });

  it("ignores system realtime messages entirely", async () => {
    const { container } = await renderRecorder();

    send([0xf8]); // clock while idle
    expect(container.querySelector(".recording-status")).not.toBeInTheDocument();

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
  it("Stop / Edit cancels the upload and keeps the take, base64-encoded", async () => {
    const { container } = await renderRecorder();

    send([0x90, 60, 100]);
    send([0x80, 60, 0]);
    advance(5000);

    fireEvent.click(screen.getByText("Stop / Edit settings"));
    advance(20000);

    expect(alignMidi).not.toHaveBeenCalled();
    expect(container.querySelector(".ready-status")).toBeInTheDocument();
    expect(screen.getByText(/Saved Recording/)).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(stored.midiData).not.toContain(",");
    expect(() => atob(stored.midiData)).not.toThrow();
  });

  it("keeps the take and shows the error when the automatic upload fails", async () => {
    alignMidi.mockRejectedValue(new Error("network"));
    await renderRecorder();

    send([0x90, 60, 100]);
    send([0x80, 60, 0]);
    await runToUpload();

    expect(
      screen.getByText(/Failed to upload performance/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Saved Recording/)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
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
    act(() => emitPortEvent("connected", new FakeInput("dev-1", "Test Keyboard")));

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
});

describe("devices", () => {
  it("shows the unsupported message only when WebMIDI is missing", async () => {
    delete (navigator as any).requestMIDIAccess;
    await renderRecorder();

    expect(
      screen.getByText(/does not support WebMIDI/),
    ).toBeInTheDocument();
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

/** Stand-in for the `webmidi` package. Tests drive it through the helpers below. */

type Listener = (event: any) => void;

export class FakeInput {
  id: string;
  name: string;
  manufacturer = "Test";
  type = "input";
  private listeners = new Map<string, Listener[]>();

  constructor(id: string, name = id) {
    this.id = id;
    this.name = name;
  }

  addListener(event: string, cb: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), cb]);
  }

  removeListener(event: string, cb?: Listener) {
    if (!cb) return this.listeners.delete(event);
    this.listeners.set(
      event,
      (this.listeners.get(event) ?? []).filter((l) => l !== cb),
    );
  }

  /** Deliver a raw MIDI message to whatever is listening. */
  send(data: number[]) {
    (this.listeners.get("midimessage") ?? []).forEach((cb) =>
      cb({ data: Uint8Array.from(data), timeStamp: Date.now() }),
    );
  }

  listenerCount(event: string) {
    return (this.listeners.get(event) ?? []).length;
  }
}

const globalListeners = new Map<string, Listener[]>();

export const WebMidi = {
  inputs: [] as FakeInput[],
  enable: jest.fn(async () => undefined),
  addListener(event: string, cb: Listener) {
    globalListeners.set(event, [...(globalListeners.get(event) ?? []), cb]);
  },
  removeListener(event: string, cb?: Listener) {
    if (!cb) return globalListeners.delete(event);
    globalListeners.set(
      event,
      (globalListeners.get(event) ?? []).filter((l) => l !== cb),
    );
  },
};

export function globalListenerCount(event: string) {
  return (globalListeners.get(event) ?? []).length;
}

/** Fire WebMidi's "connected"/"disconnected" as the real library would. */
export function emitPortEvent(event: "connected" | "disconnected", port: any) {
  (globalListeners.get(event) ?? []).forEach((cb) => cb({ port }));
}

export function resetWebMidi(inputs: FakeInput[] = []) {
  globalListeners.clear();
  WebMidi.inputs = inputs;
  WebMidi.enable = jest.fn(async () => undefined);
}

// Types the recorder imports from the real package but only uses as types.
export type Input = FakeInput;
export type MessageEvent = any;
export type PortEvent = any;

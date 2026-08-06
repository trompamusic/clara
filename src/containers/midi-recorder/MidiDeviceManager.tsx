import React, { useState, useEffect, useRef, useCallback } from "react";
import { WebMidi, Input, MessageEvent, PortEvent } from "webmidi";
import { Card, Form, Button, Spinner } from "react-bootstrap";

interface MidiDeviceManagerProps {
  onDeviceSelect: (device: Input | null) => void;
  onMidiMessage: (event: MessageEvent) => void;
  selectedDevice: Input | null;
}

const getUniqueInputsById = (inputs: Input[]): Input[] => {
  const map = new Map<string, Input>();
  inputs.forEach((input) => {
    const key =
      input.id ||
      `${input.manufacturer || "unknown"}-${input.name || "unknown"}`;
    map.set(key, input);
  });

  return Array.from(map.values());
};

const MidiDeviceManager: React.FC<MidiDeviceManagerProps> = ({
  onDeviceSelect,
  onMidiMessage,
  selectedDevice,
}) => {
  const [midiInputs, setMidiInputs] = useState<Input[]>([]);
  // null until we know: false here would render "unsupported" on first paint
  const [midiSupported, setMidiSupported] = useState<boolean | null>(null);
  const [midiPermission, setMidiPermission] = useState<
    "granted" | "denied" | "pending" | null
  >(null);

  const didInit = useRef(false);
  const mountedRef = useRef(true);
  const selectedDeviceRef = useRef<Input | null>(null);
  const portListenersRef = useRef<{
    connected?: (event: PortEvent) => void;
    disconnected?: (event: PortEvent) => void;
  }>({});

  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // WebMidi.removeListener("connected") with no callback removes every
  // listener for that event, app-wide, so keep our own and pass them back.
  const removePortListeners = useCallback(() => {
    const { connected, disconnected } = portListenersRef.current;
    if (connected) WebMidi.removeListener("connected", connected);
    if (disconnected) WebMidi.removeListener("disconnected", disconnected);
    portListenersRef.current = {};
  }, []);

  const initializeMidi = useCallback(async () => {
    if (didInit.current) return;

    if (!("requestMIDIAccess" in navigator)) {
      console.warn("Browser does not support WebMIDI");
      setMidiSupported(false);
      setMidiPermission(null);
      return;
    }

    didInit.current = true;

    setMidiSupported(true);
    setMidiPermission("pending");

    try {
      await WebMidi.enable();
      if (!mountedRef.current) return;

      setMidiPermission("granted");
      setMidiInputs(getUniqueInputsById(WebMidi.inputs));

      const handleConnected = (event: PortEvent) => {
        if (!mountedRef.current) return;
        if (event.port.type !== "input") return;

        const input = event.port as Input;
        setMidiInputs((prev) =>
          prev.some((existing) => existing.id === input.id)
            ? prev.map((existing) =>
                existing.id === input.id ? input : existing,
              )
            : [...prev, input],
        );
      };

      const handleDisconnected = (event: PortEvent) => {
        if (!mountedRef.current) return;
        if (event.port.type !== "input") return;

        setMidiInputs((prev) =>
          prev.filter((input) => input.id !== event.port.id),
        );

        if (selectedDeviceRef.current?.id === event.port.id) {
          onDeviceSelect(null);
        }
      };

      portListenersRef.current = {
        connected: handleConnected,
        disconnected: handleDisconnected,
      };
      WebMidi.addListener("connected", handleConnected);
      WebMidi.addListener("disconnected", handleDisconnected);
    } catch (err) {
      console.error("Failed to initialize MIDI:", err);
      if (!mountedRef.current) return;

      setMidiPermission("denied");
      didInit.current = false;
    }
  }, [onDeviceSelect]);

  useEffect(() => {
    initializeMidi();
  }, [initializeMidi]);

  // Selection, kept out of the setMidiInputs updater: calling the parent's
  // setter from inside one sets parent state during this component's render.
  useEffect(() => {
    if (midiInputs.length === 0) return;

    if (selectedDevice) {
      // A reconnect yields a fresh Input; the old object is dead and its
      // midimessage listener will never fire again.
      const current = midiInputs.find((input) => input.id === selectedDevice.id);
      if (current && current !== selectedDevice) onDeviceSelect(current);
      return;
    }

    if (midiInputs.length === 1) onDeviceSelect(midiInputs[0]);
  }, [midiInputs, selectedDevice, onDeviceSelect]);

  // Manage MIDI event listeners when selected device changes
  useEffect(() => {
    if (!selectedDevice) return;

    selectedDevice.addListener("midimessage", onMidiMessage);

    return () => {
      selectedDevice.removeListener("midimessage", onMidiMessage);
    };
  }, [selectedDevice, onMidiMessage]);

  // Retry MIDI access
  const retryMidiAccess = useCallback(() => {
    removePortListeners();
    didInit.current = false;
    setMidiInputs([]);
    setMidiPermission("pending");
    initializeMidi();
  }, [initializeMidi, removePortListeners]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      removePortListeners();
    };
  }, [removePortListeners]);

  // One region reporting device state, rather than six early returns that each
  // replaced the whole panel — anything rendered alongside this used to
  // disappear whenever a device did.
  const status = () => {
    if (midiSupported === null) {
      return (
        <span className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          Initializing MIDI...
        </span>
      );
    }

    if (!midiSupported) {
      return (
        <span className="text-warning">
          Your browser does not support WebMIDI. Please use a compatible
          browser.
        </span>
      );
    }

    if (midiPermission === "pending") {
      return (
        <span className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          Requesting MIDI access... Please allow access when prompted by your
          browser.
        </span>
      );
    }

    if (midiPermission === "denied") {
      return (
        <>
          <span className="text-danger">
            MIDI access was denied. Please refresh the page and allow MIDI
            access when prompted.
          </span>
          <Button onClick={retryMidiAccess} variant="outline-danger" size="sm">
            Retry MIDI Access
          </Button>
        </>
      );
    }

    if (midiInputs.length === 0) {
      return (
        <>
          <span className="text-warning">
            No MIDI devices detected. Please connect a MIDI device and refresh
            the page.
          </span>
          <Button onClick={retryMidiAccess} variant="outline-warning" size="sm">
            Refresh MIDI Devices
          </Button>
        </>
      );
    }

    // One device is not a choice: auto-selected, and reported rather than
    // offered. The selector only appears when there is something to decide.
    if (midiInputs.length === 1) {
      return (
        <>
          <span className="fw-semibold">MIDI Device:</span>
          <span>{midiInputs[0].name || "Connected"}</span>
        </>
      );
    }

    return (
      <>
        <span className="fw-semibold">MIDI Device:</span>
        <Form.Select
          style={{ width: "auto", minWidth: "200px" }}
          value={selectedDevice?.id || ""}
          onChange={(e) => {
            const device = midiInputs.find(
              (input) => input.id === e.target.value,
            );
            onDeviceSelect(device || null);
          }}
        >
          <option value="">-- Select a device --</option>
          {midiInputs.map((input, index) => (
            <option key={input.id || index} value={input.id || ""}>
              {input.name || `Device ${index + 1}`}
            </option>
          ))}
        </Form.Select>
      </>
    );
  };

  return (
    <Card>
      <Card.Header>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          {status()}
        </div>
      </Card.Header>
    </Card>
  );
};

export default MidiDeviceManager;

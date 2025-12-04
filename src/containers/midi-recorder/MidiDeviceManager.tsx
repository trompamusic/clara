import React, { useState, useEffect, useRef, useCallback } from "react";
import { WebMidi, Input, MessageEvent, PortEvent } from "webmidi";
import { Card, Form, Button, Alert, Spinner } from "react-bootstrap";

interface MidiDeviceManagerProps {
  onDeviceSelect: (device: Input | null) => void;
  onMidiMessage: (event: MessageEvent) => void;
  selectedDevice: Input | null;
  recordingStatus?: React.ReactNode;
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
  recordingStatus,
}) => {
  const [midiInputs, setMidiInputs] = useState<Input[]>([]);
  const [midiSupported, setMidiSupported] = useState(false);
  const [midiPermission, setMidiPermission] = useState<
    "granted" | "denied" | "pending" | null
  >(null);

  const didInit = useRef(false);
  const selectedDeviceRef = useRef<Input | null>(null);

  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);

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

      setMidiPermission("granted");

      WebMidi.inputs.forEach((input) => {
        console.log("input", input);
      });

      const inputs = getUniqueInputsById(WebMidi.inputs);
      setMidiInputs(inputs);

      if (inputs.length === 1) {
        onDeviceSelect(inputs[0]);
      }

      const handleConnected = (event: PortEvent) => {
        if (event.port.type === "input") {
          const input = event.port as Input;
          setMidiInputs((prev) => {
            const exists = prev.some((existing) => existing.id === input.id);
            if (exists) {
              return prev.map((existing) =>
                existing.id === input.id ? input : existing,
              );
            }

            const updated = [...prev, input];
            if (updated.length === 1) {
              onDeviceSelect(input);
            }
            return updated;
          });
        }
      };

      const handleDisconnected = (event: PortEvent) => {
        if (event.port.type === "input") {
          const disconnectedInput = event.port as Input;
          setMidiInputs((prev) =>
            prev.filter((input) => input.id !== event.port.id),
          );

          if (
            selectedDeviceRef.current &&
            selectedDeviceRef.current.id === disconnectedInput.id
          ) {
            onDeviceSelect(null);
          }
        }
      };

      WebMidi.addListener("connected", handleConnected);
      WebMidi.addListener("disconnected", handleDisconnected);
    } catch (err) {
      console.error("Failed to initialize MIDI:", err);
      setMidiPermission("denied");
      didInit.current = false;
    }
  }, [onDeviceSelect]);

  useEffect(() => {
    initializeMidi();
  }, [initializeMidi]);

  // Manage MIDI event listeners when selected device changes
  useEffect(() => {
    if (!selectedDevice) return;

    // Add listeners to selected device
    selectedDevice.addListener("noteon", onMidiMessage);
    selectedDevice.addListener("noteoff", onMidiMessage);
    selectedDevice.addListener("midimessage", onMidiMessage);

    // Cleanup function to remove listeners
    return () => {
      selectedDevice.removeListener("noteon", onMidiMessage);
      selectedDevice.removeListener("noteoff", onMidiMessage);
      selectedDevice.removeListener("midimessage", onMidiMessage);
    };
  }, [selectedDevice, onMidiMessage]);

  // Retry MIDI access
  const retryMidiAccess = useCallback(() => {
    WebMidi.removeListener("connected");
    WebMidi.removeListener("disconnected");
    didInit.current = false;
    setMidiInputs([]);
    setMidiPermission("pending");
    initializeMidi();
  }, [initializeMidi]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Remove global WebMidi listeners
      WebMidi.removeListener("connected");
      WebMidi.removeListener("disconnected");
    };
  }, []);

  console.log("midiInputs", midiInputs);

  if (!midiSupported) {
    return (
      <Alert variant="warning">
        Your browser does not support WebMIDI. Please use a compatible browser.
      </Alert>
    );
  }

  if (midiPermission === "pending") {
    return (
      <Alert variant="info">
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          Requesting MIDI access... Please allow access when prompted by your
          browser.
        </div>
      </Alert>
    );
  }

  if (midiPermission === "denied") {
    return (
      <Alert variant="danger">
        <p>
          MIDI access was denied. Please refresh the page and allow MIDI access
          when prompted.
        </p>
        <Button onClick={retryMidiAccess} variant="outline-danger" size="sm">
          Retry MIDI Access
        </Button>
      </Alert>
    );
  }

  if (midiPermission !== "granted") {
    return (
      <Alert variant="warning">
        MIDI access is not available. Please check your browser settings.
      </Alert>
    );
  }

  if (midiInputs.length === 0) {
    return (
      <Alert variant="warning">
        <p>
          No MIDI devices detected. Please connect a MIDI device and refresh the
          page.
        </p>
        <Button onClick={retryMidiAccess} variant="outline-warning" size="sm">
          Refresh MIDI Devices
        </Button>
      </Alert>
    );
  }

  return (
    <Card>
      <Card.Header>
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
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
          </div>
          {recordingStatus && <div>{recordingStatus}</div>}
        </div>
      </Card.Header>
    </Card>
  );
};

export default MidiDeviceManager;

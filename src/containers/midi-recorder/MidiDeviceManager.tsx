import React, { useState, useEffect, useRef, useCallback } from "react";
import { WebMidi, Input, MessageEvent } from "webmidi";
import { Card, Form, Button, Alert, Spinner } from "react-bootstrap";

interface MidiDeviceManagerProps {
  onDeviceSelect: (device: Input | null) => void;
  onMidiMessage: (event: MessageEvent) => void;
  selectedDevice: Input | null;
  recordingStatus?: React.ReactNode;
}

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

  // Initialize MIDI
  useEffect(() => {
    if (didInit.current) return;

    const initializeMidi = async () => {
      // First check if browser supports WebMIDI
      if (!("requestMIDIAccess" in navigator)) {
        console.warn("Browser does not support WebMIDI");
        setMidiSupported(false);
        setMidiPermission(null);
        return;
      }

      // Browser supports WebMIDI, set supported to true
      setMidiSupported(true);
      setMidiPermission("pending");

      try {
        await WebMidi.enable();

        // User granted permission
        setMidiPermission("granted");

        const inputs: Input[] = [];

        // Get all available inputs
        WebMidi.inputs.forEach((input) => {
          console.log("input", input);

          inputs.push(input);
        });

        setMidiInputs(inputs);

        // Auto-select the first device if only one is available
        if (inputs.length === 1) {
          onDeviceSelect(inputs[0]);
        }

        // Listen for device connection/disconnection
        WebMidi.addListener("connected", (event) => {
          if (event.port.type === "input") {
            const input = event.port as Input;
            setMidiInputs((prev) => {
              const newInputs = [...prev, input];
              // Auto-select if this is the first device
              if (prev.length === 0) {
                onDeviceSelect(input);
              }
              return newInputs;
            });
          }
        });

        WebMidi.addListener("disconnected", (event) => {
          if (event.port.type === "input") {
            const disconnectedInput = event.port as Input;
            setMidiInputs((prev) =>
              prev.filter((input) => input.id !== event.port.id),
            );

            // If the selected device was disconnected, clear selection
            if (selectedDevice && selectedDevice.id === disconnectedInput.id) {
              onDeviceSelect(null);
            }
          }
        });

        didInit.current = true;
      } catch (err) {
        console.error("Failed to initialize MIDI:", err);
        setMidiPermission("denied");
      }
    };

    initializeMidi();
  }, [onDeviceSelect, selectedDevice]);

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
    didInit.current = false;
    setMidiPermission("pending");
    setMidiInputs([]);

    const initializeMidi = async () => {
      try {
        await WebMidi.enable();

        setMidiPermission("granted");

        const inputs: Input[] = [];

        // Get all available inputs
        WebMidi.inputs.forEach((input) => {
          inputs.push(input);
        });

        setMidiInputs(inputs);
        didInit.current = true;
      } catch (err) {
        console.error("Failed to initialize MIDI:", err);
        setMidiPermission("denied");
      }
    };

    initializeMidi();
  }, []);

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

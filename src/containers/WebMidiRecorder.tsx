import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import Api from "../util/api";
import { useNavigate } from "react-router";
import { trackToMidi } from "../util/midi";
import { useLocalStorage } from "usehooks-ts";
import { MidiNoteOnEvent, MidiNoteOffEvent } from "midi-file";
import { WebMidi, Input, MessageEvent } from "webmidi";

// Types
interface MidiEvent {
  data: Uint8Array;
  timeStamp: number;
}

// Constants
const MIDI_TIMEOUT = 5000;

export default function WebMidiRecorder({ score }: { score: string }) {
  const { session } = useSolidAuth();
  const webId = session.webId ?? "";
  const navigate = useNavigate();

  // State
  const [midiInputs, setMidiInputs] = useState<Input[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Input | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [midiSupported, setMidiSupported] = useState(false);
  const [midiPermission, setMidiPermission] = useState<
    "granted" | "denied" | "pending" | null
  >(null);
  const [midiEvents, setMidiEvents] = useState<MidiEvent[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Refs
  const didInit = useRef(false);
  const timerRef = useRef<NodeJS.Timeout>();

  // Local storage
  const localStorageKey = `at.ac.mdw.trompa-midiPerformance-${webId}-${score}`;
  const [midiPerformance, setMidiPerformance] = useLocalStorage<string | null>(
    localStorageKey,
    null,
  );

  // Convert MIDI events to MIDI file
  const midiEventsArrayToMidiFile = useCallback((events: MidiEvent[]) => {
    if (events.length === 0) return null;

    const firstTimestamp = events[0].timeStamp;
    const trackNotes = events
      .map((e) => {
        const timeStamp = e.timeStamp - firstTimestamp;
        const d = e.data;

        if (d[0] === 144) {
          return {
            type: "noteOn",
            noteNumber: d[1],
            velocity: d[2],
            absoluteTime: timeStamp,
          } as MidiNoteOnEvent & { absoluteTime: number };
        } else if (d[0] === 128) {
          return {
            type: "noteOff",
            noteNumber: d[1],
            velocity: d[2],
            absoluteTime: timeStamp,
          } as MidiNoteOffEvent & { absoluteTime: number };
        }
        return null;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return trackToMidi(trackNotes);
  }, []);

  // Handle MIDI message
  const handleMidiMessage = useCallback(
    (mes: MessageEvent) => {
      // Only record if we have a selected device
      if (!selectedDevice) return;

      const dataArray = Array.from(mes.data);
      const status = dataArray[0];

      // Check if this is a note on or note off event on any channel
      // Note On: 0x90-0x9F (channels 1-16)
      // Note Off: 0x80-0x8F (channels 1-16)
      const isNoteOn = status >= 0x90 && status <= 0x9f;
      const isNoteOff = status >= 0x80 && status <= 0x8f;

      if (!isNoteOn && !isNoteOff) return;

      setMidiEvents((prevEvents) => [
        ...prevEvents,
        { data: mes.data, timeStamp: Date.now() },
      ]);
      setIsRecording(true);
    },
    [selectedDevice],
  );

  // Manage MIDI event listeners when selected device changes
  useEffect(() => {
    if (!selectedDevice) {
      return;
    }

    selectedDevice.addListener("noteon", handleMidiMessage);
    selectedDevice.addListener("noteoff", handleMidiMessage);
    selectedDevice.addListener("midimessage", handleMidiMessage); // Also listen for raw MIDI messages

    // Cleanup function to remove listeners
    return () => {
      selectedDevice.removeListener("noteon", handleMidiMessage);
      selectedDevice.removeListener("noteoff", handleMidiMessage);
      selectedDevice.removeListener("midimessage", handleMidiMessage);
    };
  }, [selectedDevice, handleMidiMessage]);

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
          inputs.push(input);
        });

        setMidiInputs(inputs);

        // Auto-select the first device if only one is available
        if (inputs.length === 1) {
          setSelectedDevice(inputs[0]);
        }

        // Listen for device connection/disconnection
        WebMidi.addListener("connected", (event) => {
          if (event.port.type === "input") {
            const input = event.port as Input;
            setMidiInputs((prev) => {
              const newInputs = [...prev, input];
              // Auto-select if this is the first device
              if (prev.length === 0) {
                setSelectedDevice(input);
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
              setSelectedDevice(null);
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
  }, [handleMidiMessage]);

  // Handle MIDI events timeout
  useEffect(() => {
    if (midiEvents.length === 0) {
      setIsRecording(false);
      return;
    }

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set new timer
    timerRef.current = setTimeout(() => {
      if (midiEvents.length > 0) {
        const midi = midiEventsArrayToMidiFile(midiEvents);

        if (midi) {
          setMidiPerformance(midi.toString());
          const payload = new Blob([midi]);

          Api.alignMidi(webId, score, payload)
            .then((data) => {
              setMidiPerformance(null);
              navigate(`/uploadwait?task=${data.task_id}&score=${score}`);
            })
            .catch((err) => {
              console.error("Upload failed:", err);
              setUploadError("Failed to upload performance. Please try again.");
            });
        }

        setMidiEvents([]);
        setIsRecording(false);
      }
    }, MIDI_TIMEOUT);

    // Cleanup timer on unmount or when midiEvents change
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [
    midiEvents,
    navigate,
    score,
    setMidiPerformance,
    webId,
    midiEventsArrayToMidiFile,
  ]);

  // Upload existing performance
  const uploadExistingPerformance = useCallback(async () => {
    if (!midiPerformance) return;

    try {
      const midiArray = midiPerformance.split(",").map((s) => parseInt(s));
      const midi = new Uint8Array(midiArray);
      const payload = new Blob([midi]);

      const data = await Api.alignMidi(webId, score, payload);
      setMidiPerformance(null);
      navigate(`/uploadwait?task=${data.task_id}&score=${score}`);
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadError(
        "Failed to upload existing performance. Please try again.",
      );
    }
  }, [midiPerformance, webId, score, setMidiPerformance, navigate]);

  // Clear error
  const clearError = useCallback(() => {
    setUploadError(null);
  }, []);

  // Delete saved performance
  const deletePerformance = useCallback(() => {
    setMidiPerformance(null);
  }, [setMidiPerformance]);

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
          input.addListener("noteon", handleMidiMessage);
          input.addListener("noteoff", handleMidiMessage);
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
  }, [handleMidiMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Remove global WebMidi listeners
      WebMidi.removeListener("connected");
      WebMidi.removeListener("disconnected");
    };
  }, []);

  if (!midiSupported) {
    return (
      <div id="authWrapper">
        <div>
          <p>
            Your browser does not support WebMIDI. Please use a compatible
            browser.
          </p>
        </div>
      </div>
    );
  }

  if (midiPermission === "pending") {
    return (
      <div id="authWrapper">
        <div>
          <p>
            Requesting MIDI access... Please allow access when prompted by your
            browser.
          </p>
          <div className="loading-spinner">Loading...</div>
        </div>
      </div>
    );
  }

  if (midiPermission === "denied") {
    return (
      <div id="authWrapper">
        <div>
          <p>
            MIDI access was denied. Please refresh the page and allow MIDI
            access when prompted.
          </p>
          <button onClick={retryMidiAccess}>Retry MIDI Access</button>
        </div>
      </div>
    );
  }

  // Only show recording UI if we have both support and permission
  if (midiPermission !== "granted") {
    return (
      <div id="authWrapper">
        <div>
          <p>
            MIDI access is not available. Please check your browser settings.
          </p>
        </div>
      </div>
    );
  }

  // Check if we have any MIDI devices connected
  if (midiInputs.length === 0) {
    return (
      <div id="authWrapper">
        <div>
          <p>
            No MIDI devices detected. Please connect a MIDI device and refresh
            the page.
          </p>
          <button onClick={retryMidiAccess}>Refresh MIDI Devices</button>
        </div>
      </div>
    );
  }

  return (
    <div id="authWrapper">
      <div id="midi">
        <span id="recordingIndicator">
          {selectedDevice ? (
            isRecording ? (
              <span className="isRecording">
                Recording from {selectedDevice.name || "selected device"}
              </span>
            ) : (
              <span className="isNotRecording">
                Ready to record from {selectedDevice.name || "selected device"}.
                Play MIDI notes to start recording.
              </span>
            )
          ) : (
            <span className="noDeviceSelected">
              Please select a MIDI device to record from
            </span>
          )}
        </span>

        <div className="midi-status">
          <div
            className="midi-header"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span className="midi-header-text">
              MIDI Devices ({midiInputs.length})
            </span>
            <span className="midi-header-arrow">{isExpanded ? "▼" : "▶"}</span>
          </div>

          {isExpanded && (
            <div className="midi-content">
              {midiInputs.length > 0 ? (
                <div>
                  <label
                    htmlFor="device-select"
                    className="device-select-label"
                  >
                    Select recording device:
                  </label>
                  <select
                    id="device-select"
                    value={selectedDevice?.id || ""}
                    onChange={(e) => {
                      const device = midiInputs.find(
                        (input) => input.id === e.target.value,
                      );
                      setSelectedDevice(device || null);
                    }}
                    className="device-select"
                  >
                    <option value="">-- Select a device --</option>
                    {midiInputs.map((input, index) => (
                      <option key={input.id || index} value={input.id || ""}>
                        {input.name || `Device ${index + 1}`}
                      </option>
                    ))}
                  </select>

                  {selectedDevice && (
                    <div className="selected-device-info">
                      <p>
                        <strong>Selected:</strong>{" "}
                        {selectedDevice.name || "Unknown Device"}
                      </p>
                      <p>
                        <strong>Manufacturer:</strong>{" "}
                        {selectedDevice.manufacturer || "Unknown"}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p>No MIDI devices detected</p>
              )}
            </div>
          )}
        </div>

        {uploadError && (
          <div>
            <p>{uploadError}</p>
            <button onClick={clearError}>Dismiss</button>
          </div>
        )}

        {midiPerformance && (
          <div>
            <span>
              You have a saved performance which wasn't uploaded.
              <button onClick={uploadExistingPerformance}>Upload it</button>
              <button onClick={deletePerformance}>Delete it</button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

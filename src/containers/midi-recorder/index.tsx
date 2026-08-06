import React, { useState } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useNavigate } from "react-router";
import { Input } from "webmidi";
import { Alert, Spinner } from "react-bootstrap";
import MidiDeviceManager from "./MidiDeviceManager";
import RecordingTimer from "./RecordingTimer";
import PerformanceUploader from "./PerformanceUploader";
import useRecorder from "./useRecorder";

const WebMidiRecorder: React.FC<{
  score: string;
  expansionOptions: string[];
}> = ({ score, expansionOptions }) => {
  const { session } = useSolidAuth();
  const navigate = useNavigate();
  const [selectedDevice, setSelectedDevice] = useState<Input | null>(null);
  const recorder = useRecorder(
    session.webId ?? "",
    score,
    selectedDevice?.id ?? null,
    navigate,
  );
  const { state } = recorder;
  const uploading = state.phase === "uploading";
  const draft = "draft" in state ? state.draft : null;
  const error = "error" in state ? state.error : null;

  return (
    <div id="authWrapper">
      <div id="midi" className="position-relative">
        {/* A fieldset blocks keyboard interaction as well as pointer input. */}
        <fieldset disabled={uploading} aria-busy={uploading}>
          <MidiDeviceManager
            onDeviceSelect={setSelectedDevice}
            onMidiMessage={recorder.handleMidiMessage}
            selectedDevice={selectedDevice}
            recordingStatus={
              <RecordingTimer
                state={state}
                canCapture={state.phase === "ready" && selectedDevice !== null}
                onStopSubmission={() => recorder.reviewTake()}
              />
            }
          />
          {state.phase === "takeCountdown" &&
            state.reason === "deviceChanged" && (
              <Alert variant="warning" className="mt-2 py-2 small">
                Your MIDI device changed, so the recording was finished.
              </Alert>
            )}
          {state.phase === "takeReview" && draft?.kind === "take" && (
            <PerformanceUploader
              recovered={draft.recovered}
              label={draft.label}
              expansion={draft.expansion}
              onLabelChange={(label) => recorder.editMetadata({ label })}
              onExpansionChange={(expansion) =>
                recorder.editMetadata({ expansion })
              }
              onUpload={recorder.submitTake}
              onDiscard={recorder.discardTake}
              onConfirmDiscard={() => recorder.reviewTake(true)}
              onCancelDiscard={() => recorder.reviewTake()}
              confirmingDiscard={
                state.phase === "takeReview" && state.confirmingDiscard
              }
              uploading={uploading}
              error={error}
              expansionOptions={expansionOptions}
            />
          )}
        </fieldset>
        {uploading && (
          <div
            role="status"
            className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white bg-opacity-75"
            style={{ zIndex: 10 }}
          >
            <Spinner animation="border" size="sm" className="me-2" />
            Uploading your performance…
          </div>
        )}
      </div>
    </div>
  );
};

export default WebMidiRecorder;

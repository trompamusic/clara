import React, { useState } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useNavigate } from "react-router";
import { Input } from "webmidi";
import { Alert, Button, Card, CloseButton, Spinner } from "react-bootstrap";
import MidiDeviceManager from "./MidiDeviceManager";
import RecordingTimer from "./RecordingTimer";
import PerformanceUploader from "./PerformanceUploader";
import MidiFileUpload from "./MidiFileUpload";
import PerformanceMetadataFields from "./PerformanceMetadataFields";
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
          <div className="mb-2">
            <Button
              variant="link"
              size="sm"
              className="p-0"
              style={{
                visibility: state.phase === "ready" ? "visible" : "hidden",
              }}
              onClick={recorder.toggleFileUpload}
            >
              Upload a MIDI file instead
            </Button>
            {draft?.kind === "file" && (
              <Card className="mt-2">
                <Card.Body>
                  <div className="d-flex justify-content-end mb-2">
                    <CloseButton
                      aria-label="Close file upload"
                      disabled={uploading}
                      onClick={recorder.toggleFileUpload}
                    />
                  </div>
                  <PerformanceMetadataFields
                    idPrefix="file-upload"
                    label={draft.label}
                    expansion={draft.expansion}
                    onLabelChange={(label) => recorder.editMetadata({ label })}
                    onExpansionChange={(expansion) =>
                      recorder.editMetadata({ expansion })
                    }
                    expansionOptions={expansionOptions}
                  />
                  <MidiFileUpload
                    disabled={uploading}
                    onFileAccepted={(file) =>
                      recorder.acceptFile(draft.session, file)
                    }
                    onReject={(message) =>
                      recorder.rejectFile(draft.session, message)
                    }
                  />
                  {error && (
                    <Alert variant="danger" className="mt-3">
                      {error}
                    </Alert>
                  )}
                </Card.Body>
              </Card>
            )}
          </div>

          <div hidden={draft?.kind === "file"}>
            <MidiDeviceManager
              onDeviceSelect={setSelectedDevice}
              onMidiMessage={recorder.handleMidiMessage}
              selectedDevice={selectedDevice}
              recordingStatus={
                <RecordingTimer
                  state={state}
                  canCapture={
                    state.phase === "ready" && selectedDevice !== null
                  }
                  onStopSubmission={() => recorder.reviewTake()}
                />
              }
            />
          </div>
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

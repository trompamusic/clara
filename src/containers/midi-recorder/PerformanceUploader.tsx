import React from "react";
import { Card, Form, Button, Alert } from "react-bootstrap";
import PerformanceMetadataFields from "./PerformanceMetadataFields";

interface PerformanceUploaderProps {
  recovered: boolean;
  // Metadata is owned by the recorder, not by this card: the submission
  // countdown has to be able to read what was typed here.
  label: string;
  expansion: string;
  onLabelChange: (label: string) => void;
  onExpansionChange: (expansion: string) => void;
  onUpload: () => void;
  onDiscard: () => void;
  onConfirmDiscard: () => void;
  onCancelDiscard: () => void;
  confirmingDiscard: boolean;
  uploading: boolean;
  error: string | null;
  expansionOptions: string[];
}

const PerformanceUploader: React.FC<PerformanceUploaderProps> = ({
  recovered,
  label,
  expansion,
  onLabelChange,
  onExpansionChange,
  onUpload,
  onDiscard,
  onConfirmDiscard,
  onCancelDiscard,
  confirmingDiscard,
  uploading,
  error,
  expansionOptions,
}) => {
  return (
    <Card className={`mt-3${recovered ? " border-warning" : ""}`}>
      <Card.Header className={recovered ? "bg-warning bg-opacity-10" : ""}>
        <h6 className={`mb-0${recovered ? " text-warning" : ""}`}>
          {recovered ? "💾 Saved Recording" : "Performance Options"}
        </h6>
      </Card.Header>
      <Card.Body>
        {recovered && (
          <p className="text-muted small mb-3">
            You have a saved performance which wasn't uploaded. Submit this
            performance, or discard it, before recording again.
          </p>
        )}
        <Form onSubmit={(event) => event.preventDefault()}>
          <PerformanceMetadataFields
            idPrefix="performance"
            label={label}
            expansion={expansion}
            onLabelChange={onLabelChange}
            onExpansionChange={onExpansionChange}
            expansionOptions={expansionOptions}
          />

          <div className="d-flex gap-2">
            <Button
              onClick={onUpload}
              disabled={uploading}
              variant="primary"
              size="sm"
            >
              {uploading ? "Uploading..." : "Submit Recording"}
            </Button>

            {!confirmingDiscard ? (
              <Button
                onClick={onConfirmDiscard}
                variant="outline-danger"
                size="sm"
              >
                Discard Recording
              </Button>
            ) : (
              <div className="d-flex align-items-center gap-2">
                <span className="text-muted small">Are you sure?</span>
                <Button onClick={onDiscard} variant="danger" size="sm">
                  Yes, Discard
                </Button>
                <Button
                  onClick={onCancelDiscard}
                  variant="outline-secondary"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {error && (
            <Alert variant="danger" className="mt-3">
              {error}
            </Alert>
          )}
        </Form>
      </Card.Body>
    </Card>
  );
};

export default PerformanceUploader;

import React, { useState } from "react";
import { Card, Form, Button, Alert } from "react-bootstrap";
import { PerformanceData, UploadState } from "./types";

interface PerformanceUploaderProps {
  performanceData: PerformanceData;
  onUpload: (data: PerformanceData) => Promise<void>;
  onDiscard: () => void;
  uploadState: UploadState;
  expansionOptions: string[];
}

const PerformanceUploader: React.FC<PerformanceUploaderProps> = ({
  performanceData,
  onUpload,
  onDiscard,
  uploadState,
  expansionOptions,
}) => {
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [label, setLabel] = useState("");
  const [expansion, setExpansion] = useState("no expansion");

  const handleSubmit = async () => {
    const data = {
      ...performanceData,
      label: label.trim() || undefined,
      expansion: expansion === "no expansion" ? undefined : expansion,
    };
    await onUpload(data);
  };

  const handleDiscard = () => {
    setShowDiscardConfirm(false);
    onDiscard();
  };

  if (!performanceData.midiData) {
    return null; // Don't show anything if no performance data
  }

  return (
    <Card className="mt-3">
      <Card.Header>
        <h6 className="mb-0">Performance Options</h6>
      </Card.Header>
      <Card.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="performance-label">
              Label for this performance:
            </Form.Label>
            <Form.Control
              id="performance-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., 'Morning practice session'"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label htmlFor="performance-expansion">
              Select expansion:
            </Form.Label>
            <Form.Select
              id="performance-expansion"
              value={expansion}
              onChange={(e) => setExpansion(e.target.value)}
            >
              {expansionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <div className="d-flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={uploadState.isUploading}
              variant="primary"
              size="sm"
            >
              {uploadState.isUploading ? "Uploading..." : "Submit Recording"}
            </Button>

            {!showDiscardConfirm ? (
              <Button
                onClick={() => setShowDiscardConfirm(true)}
                variant="outline-danger"
                size="sm"
              >
                Discard Recording
              </Button>
            ) : (
              <div className="d-flex align-items-center gap-2">
                <span className="text-muted small">Are you sure?</span>
                <Button onClick={handleDiscard} variant="danger" size="sm">
                  Yes, Discard
                </Button>
                <Button
                  onClick={() => setShowDiscardConfirm(false)}
                  variant="outline-secondary"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {uploadState.error && (
            <Alert variant="danger" className="mt-3">
              {uploadState.error}
            </Alert>
          )}
        </Form>
      </Card.Body>
    </Card>
  );
};

export default PerformanceUploader;

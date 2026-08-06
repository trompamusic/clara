import React, { useEffect, useState } from "react";
import { Workflow } from "./types";

interface RecordingTimerProps {
  state: Workflow;
  canCapture: boolean;
  onStopSubmission: () => void;
}

const TICK = 250;

const RecordingTimer: React.FC<RecordingTimerProps> = ({
  state,
  canCapture,
  onStopSubmission,
}) => {
  const { phase } = state;
  const startedAt = state.phase === "recording" ? state.startedAt : null;
  const deadline = state.phase === "takeCountdown" ? state.deadline : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (phase !== "recording" && phase !== "takeCountdown") return;

    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), TICK);

    return () => clearInterval(interval);
  }, [phase]);

  const elapsed = startedAt === null ? 0 : Math.max(0, now - startedAt);
  const remaining = deadline === null ? 0 : Math.max(0, deadline - now);

  // Helper function to format elapsed time
  const formatElapsedTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Never shows 0s: the take is submitted the moment it gets there
  const formatCountdown = (ms: number): string =>
    `${Math.max(1, Math.ceil(ms / 1000))}s`;

  return (
    <div className="recording-timer">
      {phase === "recording" ? (
        <span className="recording-status">
          <span className="emoji">🔴</span> Recording
          {elapsed > 0 && (
            <span className="elapsed-time">{formatElapsedTime(elapsed)}</span>
          )}
        </span>
      ) : phase === "takeCountdown" ? (
        <span className="countdown-status">
          <span className="emoji">⏸️</span> Recording stopped
          <span className="countdown-time">
            Submitting in {formatCountdown(remaining)}
          </span>
          <button
            onClick={onStopSubmission}
            className="btn btn-sm btn-outline-secondary ms-2"
            style={{ fontSize: "0.75em", padding: "2px 6px" }}
          >
            Stop / Edit settings
          </button>
        </span>
      ) : canCapture ? (
        <span className="ready-status">🟢 Ready</span>
      ) : null}
    </div>
  );
};

export default RecordingTimer;

import React, { useEffect, useState } from "react";

interface RecordingTimerProps {
  isRecording: boolean;
  elapsedTime: number;
  onTimeout: () => void;
  onStopSubmission: () => void;
  timeoutDuration?: number;
}

const RecordingTimer: React.FC<RecordingTimerProps> = ({
  isRecording,
  elapsedTime,
  onTimeout,
  onStopSubmission,
  timeoutDuration = 5000,
}) => {
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState<number>(timeoutDuration);

  // Countdown effect when recording stops
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;

    if (!isRecording && elapsedTime > 0 && showCountdown) {
      // Start countdown to submission
      setCountdown(timeoutDuration);

      countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev && prev > 100) {
            return prev - 100;
          } else {
            // Timeout reached - just return 0, let the effect handle the timeout
            return 0;
          }
        });
      }, 100);
    }

    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [isRecording, elapsedTime, showCountdown, timeoutDuration]);

  // Handle countdown timeout
  useEffect(() => {
    if (countdown === 0 && showCountdown) {
      setShowCountdown(false);
      onTimeout();
    }
  }, [countdown, showCountdown, onTimeout]);

  // Start countdown when recording stops
  useEffect(() => {
    if (!isRecording && elapsedTime > 0) {
      setShowCountdown(true);
    } else if (isRecording) {
      setShowCountdown(false);
      setCountdown(timeoutDuration);
    }
  }, [isRecording, elapsedTime, timeoutDuration]);

  // Helper function to format elapsed time
  const formatElapsedTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Helper function to format countdown
  const formatCountdown = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  const handleStopSubmission = () => {
    setShowCountdown(false);
    setCountdown(timeoutDuration);
    onStopSubmission();
  };

  return (
    <div className="recording-timer">
      {isRecording ? (
        <span className="recording-status">
          <span className="emoji">🔴</span> Recording
          {elapsedTime > 0 && (
            <span className="elapsed-time">
              {formatElapsedTime(elapsedTime)}
            </span>
          )}
        </span>
      ) : showCountdown ? (
        <span className="countdown-status">
          <span className="emoji">⏸️</span> Recording stopped
          <span className="countdown-time">
            Submitting in {formatCountdown(countdown)}
          </span>
          <button
            onClick={handleStopSubmission}
            className="btn btn-sm btn-outline-secondary ms-2"
            style={{ fontSize: "0.75em", padding: "2px 6px" }}
          >
            Stop / Edit settings
          </button>
        </span>
      ) : (
        <span className="ready-status">🟢 Ready</span>
      )}
    </div>
  );
};

export default RecordingTimer;

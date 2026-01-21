import React, { useEffect, useRef, useState } from "react";
import ReactPlayer, { ReactPlayerProps } from "react-player";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface AuthenticatedMediaPlayerProps {
  src?: string;
  demo?: boolean;
  fetchFn?: FetchFn;
  progressInterval?: number;
  onProgress?: ReactPlayerProps["onProgress"];
  onReady?: ReactPlayerProps["onReady"];
  playerRef?: ReactPlayerProps["ref"];
  playing?: boolean;
  onPlay?: ReactPlayerProps["onPlay"];
  onPause?: ReactPlayerProps["onPause"];
  width?: string | number;
  height?: string | number;
  audioOnly?: boolean;
}

const AuthenticatedMediaPlayer: React.FC<AuthenticatedMediaPlayerProps> = ({
  src = "",
  demo = false,
  fetchFn,
  progressInterval,
  onProgress,
  onReady,
  playerRef,
  playing = false,
  onPlay,
  onPause,
  width = "100%",
  height = "100%",
  audioOnly = false,
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const objectUrlRef = useRef<string>("");

  useEffect(() => {
    const revokeObjectUrl = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = "";
      }
    };

    if (!src) {
      revokeObjectUrl();
      setResolvedUrl("");
      setLoading(false);
      setError("");
      return () => revokeObjectUrl();
    }

    if (demo) {
      revokeObjectUrl();
      setResolvedUrl(src);
      setLoading(false);
      setError("");
      return () => revokeObjectUrl();
    }

    let isActive = true;
    const controller = new AbortController();
    const authenticatedFetch: FetchFn = fetchFn || fetch;

    setLoading(true);
    setError("");

    authenticatedFetch(src, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load media (status ${response.status})`);
        }
        return response.blob();
      })
      .then((blob) => {
        if (!isActive) {
          return;
        }
        const url = URL.createObjectURL(blob);
        revokeObjectUrl();
        objectUrlRef.current = url;
        setResolvedUrl(url);
      })
      .catch((err: unknown) => {
        if (!isActive || (err as Error).name === "AbortError") {
          return;
        }
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unable to load media");
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
      controller.abort();
      revokeObjectUrl();
    };
  }, [src, demo, fetchFn]);

  if (!src && !loading) {
    return null;
  }

  return (
    <div
      className="authenticatedPlayerWrapper"
      style={{ position: "relative", width, height }}
    >
      {error && (
        <Alert
          variant="danger"
          className="playerError"
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            right: 10,
            zIndex: 2,
          }}
        >
          {error}
        </Alert>
      )}
      {loading && (
        <div
          className="playerLoading"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.6)",
            zIndex: 1,
          }}
        >
          <Spinner animation="border" role="status" />
        </div>
      )}
      <ReactPlayer
        playing={playing}
        ref={playerRef}
        url={resolvedUrl || undefined}
        progressInterval={progressInterval}
        controls
        width={width}
        height={height}
        onProgress={onProgress}
        onReady={onReady}
        onPlay={onPlay}
        onPause={onPause}
        config={{
          file: {
            attributes: audioOnly
              ? {
                  controlsList: "nodownload",
                }
              : {},
            forceAudio: audioOnly,
          },
        }}
      />
    </div>
  );
};

export default AuthenticatedMediaPlayer;

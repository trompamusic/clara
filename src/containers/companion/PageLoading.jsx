import React from "react";
import Spinner from "react-bootstrap/Spinner";
import PropTypes from "prop-types";

export default function PageLoading({ load }) {
  if (load.status === "error") {
    return (
      <div className="py-5 text-center" role="alert">
        <p>
          We couldn’t load this score and its performances. Please reload to try
          again.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
  const messages = {
    traversing: "Downloading…",
    processing: "Processing…",
    score: "Processing…",
  };
  return (
    <div
      className="py-5 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Spinner animation="border" aria-hidden="true" />
      <p className="mt-3 mb-1">{messages[load.status]}</p>
      {load.status === "traversing" && (
        <p className="text-muted">
          Loaded {load.loaded} documents · {load.pending} pending
        </p>
      )}
    </div>
  );
}

PageLoading.propTypes = { load: PropTypes.object.isRequired };

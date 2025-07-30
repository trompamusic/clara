import React, { FunctionComponent, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useResource, useSubject, useLdo } from "@ldo/solid-react";
import { ScoreShapeShapeType } from "../.ldo/score.shapeTypes";
import {
  PerformanceShapeShapeType,
  SignalShapeShapeType,
} from "../.ldo/performance.shapeTypes";
import { Button, Table } from "react-bootstrap";

// Performance row component to handle useSubject properly
const PerformanceRow: FunctionComponent<{
  performance: { uri: string; id: string };
  onDelete: (uri: string, signalUri?: string) => Promise<void>;
  isDeleting: boolean;
}> = ({ performance, onDelete, isDeleting }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const performanceData = useSubject(
    PerformanceShapeShapeType,
    performance.uri,
  );

  // Get the signal data if available
  const signalUri = performanceData?.recordedAs?.["@id"];
  const signalData = useSubject(SignalShapeShapeType, signalUri || undefined);

  // Extract audio and MIDI URLs from signal data
  const audioUrl = signalData?.availableAs?.["@id"];
  const midiUrl = signalData?.derivedFrom?.["@id"];

  return (
    <tr>
      <td>
        <a href={performance.uri} target="_blank" rel="noopener noreferrer">
          {performance.id}
        </a>
      </td>
      <td>{performanceData?.label || "No date"}</td>
      <td>
        {midiUrl ? (
          <a href={midiUrl} target="_blank" rel="noopener noreferrer">
            Download MIDI
          </a>
        ) : (
          <span className="text-muted">No MIDI</span>
        )}
      </td>
      <td>
        {audioUrl ? (
          <a href={audioUrl} target="_blank" rel="noopener noreferrer">
            Download MP3
          </a>
        ) : (
          <span className="text-muted">No Audio</span>
        )}
      </td>
      <td style={{ width: "120px", minWidth: "120px" }}>
        {!showDeleteConfirm ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            style={{ width: "100%" }}
          >
            Delete
          </Button>
        ) : (
          <div style={{ display: "flex", gap: "4px" }}>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                await onDelete(performance.uri, signalUri);
                setShowDeleteConfirm(false);
              }}
              disabled={isDeleting}
              style={{ flex: 1 }}
            >
              {isDeleting ? "Deleting..." : "Confirm"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              style={{ flex: 1 }}
            >
              Cancel
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
};

const EditScore: FunctionComponent = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getResource } = useLdo();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [performancesList, setPerformancesList] = useState<any[]>([]);
  const [isLoadingPerformances, setIsLoadingPerformances] = useState(false);
  const [deletingPerformance, setDeletingPerformance] = useState<string | null>(
    null,
  );

  const scoreUri = searchParams.get("score");

  // Get the score resource and data using LDO
  const scoreResource = useResource(scoreUri || undefined);
  const score = useSubject(ScoreShapeShapeType, scoreUri || undefined);

  // Get related performances if available
  const performancesUri = score?.related?.["@id"];
  const performancesResource = useResource(performancesUri || undefined);
  const performances = useSubject(
    ScoreShapeShapeType,
    performancesUri || undefined,
  );

  // Fetch performances when the performances container is available
  React.useEffect(() => {
    if (
      performancesResource &&
      "children" in performancesResource &&
      performancesResource.isPresent()
    ) {
      const fetchPerformances = async () => {
        setIsLoadingPerformances(true);
        try {
          const children = await performancesResource.children();
          console.log(
            "Found performance children:",
            children.map((c: any) => c.uri),
          );

          // For now, just store the URIs - we'll fetch the data separately
          const performancesData = children.map((child: any) => ({
            uri: child.uri,
            id: child.uri.split("/").pop() || "unknown",
            data: null, // Will be populated by useSubject hooks
          }));

          setPerformancesList(performancesData);
        } catch (error) {
          console.error("Error fetching performances:", error);
        } finally {
          setIsLoadingPerformances(false);
        }
      };
      fetchPerformances();
    }
  }, [performancesResource]);

  // Memoize the display data to avoid unnecessary re-renders
  const displayData = useMemo(() => {
    if (!score) return null;

    return {
      title: score.title || "[unknown title]",
      url: scoreUri || "",
      originalUrl: score.publishedAs?.["@id"] || "No original URL",
      segmentsUrl: score.segments?.["@id"] || "No segments",
      performancesUrl: score.related?.["@id"] || "No performances",
      hasSegments: !!score.segments,
      hasPerformances: !!score.related,
    };
  }, [score, scoreUri]);

  // Delete function
  const handleDelete = async () => {
    if (!scoreUri) return;

    setIsDeleting(true);
    console.log("Starting deletion process for score:", scoreUri);

    try {
      // Delete all individual performances first (if performances container exists)
      if (score?.related?.["@id"]) {
        const performancesUri = score.related["@id"];
        console.log(
          "Deleting all performances from container:",
          performancesUri,
        );
        try {
          const performancesResource = getResource(performancesUri);
          if (
            performancesResource &&
            "children" in performancesResource &&
            performancesResource.isPresent()
          ) {
            // Get all performance children and delete them individually
            const children = await performancesResource.children();
            console.log(`Found ${children.length} performances to delete`);

            for (const child of children) {
              const performanceUri = child.uri;
              console.log("Deleting individual performance:", performanceUri);

              // Use the shared function to delete the performance
              // Note: We don't have signal URI here, so we'll rely on container deletion
              await deleteSinglePerformance(performanceUri);
            }
          }
        } catch (error) {
          console.error("Error accessing performances container:", error);
        }
      }

      // Delete performances container (if it exists)
      if (score?.related?.["@id"]) {
        const performancesUri = score.related["@id"];
        console.log("Deleting performances container:", performancesUri);
        try {
          const performancesResource = getResource(performancesUri);
          if (performancesResource && "delete" in performancesResource) {
            const result = await performancesResource.delete();
            if (!result.isError) {
              console.log("Successfully deleted performances container");
            } else {
              console.error(
                "Failed to delete performances container:",
                result.message,
              );
            }
          } else {
            console.log("Performances container not found or not deletable");
          }
        } catch (error) {
          console.error("Error deleting performances container:", error);
        }
      }

      // Delete segments (if it exists)
      if (score?.segments?.["@id"]) {
        const segmentsUri = score.segments["@id"];
        console.log("Deleting segments:", segmentsUri);
        try {
          const segmentsResource = getResource(segmentsUri);
          if (segmentsResource && "delete" in segmentsResource) {
            const result = await segmentsResource.delete();
            if (!result.isError) {
              console.log("Successfully deleted segments");
            } else {
              console.error("Failed to delete segments:", result.message);
            }
          } else {
            console.log("Segments resource not found or not deletable");
          }
        } catch (error) {
          console.error("Error deleting segments:", error);
        }
      }

      // Finally delete the score itself
      console.log("Deleting score:", scoreUri);
      try {
        const scoreResource = getResource(scoreUri);
        if (scoreResource && "delete" in scoreResource) {
          const result = await scoreResource.delete();
          if (!result.isError) {
            console.log("Successfully deleted score");
          } else {
            console.error("Failed to delete score:", result.message);
            throw new Error(`Failed to delete score: ${result.message}`);
          }
        } else {
          console.log("Score resource not found or not deletable");
          throw new Error("Score resource not found or not deletable");
        }
      } catch (error) {
        console.error("Error deleting score:", error);
        throw error; // Re-throw to be caught by the outer try-catch
      }

      console.log("All resources deleted successfully");
      navigate("/select");
    } catch (error) {
      console.error("Error during deletion:", error);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Shared function to delete a single performance and its related resources
  const deleteSinglePerformance = async (
    performanceUri: string,
    signalUri?: string,
  ) => {
    if (!performanceUri) return;

    console.log("Starting deletion process for performance:", performanceUri);

    try {
      // Delete related signal resources first (if they exist)
      if (signalUri) {
        console.log("Deleting related signal:", signalUri);
        try {
          const signalResource = getResource(signalUri);
          if (signalResource && "delete" in signalResource) {
            const result = await signalResource.delete();
            if (!result.isError) {
              console.log("Successfully deleted signal");
            } else {
              console.error("Failed to delete signal:", result.message);
            }
          } else {
            console.log("Signal resource not found or not deletable");
          }
        } catch (error) {
          console.error("Error deleting signal:", error);
        }
      }

      // Delete related timeline if it exists
      if (performanceUri.includes("/performances/")) {
        const timelineUri = performanceUri.replace(
          "/performances/",
          "/timelines/",
        );
        console.log("Attempting to delete related timeline:", timelineUri);
        try {
          const timelineResource = getResource(timelineUri);
          if (timelineResource && "delete" in timelineResource) {
            const result = await timelineResource.delete();
            if (!result.isError) {
              console.log("Successfully deleted timeline");
            } else {
              console.error("Failed to delete timeline:", result.message);
            }
          } else {
            console.log("Timeline resource not found or not deletable");
          }
        } catch (error) {
          console.error("Error deleting timeline:", error);
        }
      }

      // Delete the performance itself
      const performanceResource = getResource(performanceUri);
      if (performanceResource && "delete" in performanceResource) {
        const result = await performanceResource.delete();
        if (!result.isError) {
          console.log("Successfully deleted performance");
          return true;
        } else {
          console.error("Failed to delete performance:", result.message);
          return false;
        }
      } else {
        console.log("Performance resource not found or not deletable");
        return false;
      }
    } catch (error) {
      console.error("Error deleting performance:", error);
      return false;
    }
  };

  // Delete individual performance function
  const handleDeletePerformance = async (
    performanceUri: string,
    signalUri?: string,
  ) => {
    setDeletingPerformance(performanceUri);

    const success = await deleteSinglePerformance(performanceUri, signalUri);

    if (success) {
      // Remove from the list
      setPerformancesList((prev) =>
        prev.filter((p) => p.uri !== performanceUri),
      );
    }

    setDeletingPerformance(null);
  };

  if (!scoreUri) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning">
          No score URI provided. Please add ?score=URI to the URL.
        </div>
      </div>
    );
  }

  // Check if we're still loading the score
  if (
    scoreResource &&
    "isReading" in scoreResource &&
    scoreResource.isReading()
  ) {
    return (
      <div className="container mt-4">
        <div className="alert alert-info">Loading score data...</div>
      </div>
    );
  }

  // Check if there was an error loading the score
  if (scoreResource?.type === "InvalidIdentifierResouce" || !score) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger">
          Error loading score data. Please check the URL and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h1>Edit Score</h1>

      <div className="card">
        <div className="card-body">
          <h2 className="card-title">{displayData?.title}</h2>

          <div className="row">
            <div className="col-md-6">
              <h4>Score Information</h4>
              <dl className="row">
                <dt className="col-sm-4">Title:</dt>
                <dd className="col-sm-8">{displayData?.title}</dd>

                <dt className="col-sm-4">Current URL:</dt>
                <dd className="col-sm-8">
                  <a
                    href={displayData?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {displayData?.url}
                  </a>
                </dd>

                <dt className="col-sm-4">Original URL:</dt>
                <dd className="col-sm-8">
                  {displayData?.originalUrl !== "No original URL" ? (
                    <a
                      href={displayData?.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {displayData?.originalUrl}
                    </a>
                  ) : (
                    <span className="text-muted">No original URL</span>
                  )}
                </dd>
              </dl>
            </div>

            <div className="col-md-6">
              <h4>Related Resources</h4>
              <dl className="row">
                <dt className="col-sm-4">Segments:</dt>
                <dd className="col-sm-8">
                  {displayData?.hasSegments ? (
                    <a
                      href={displayData?.segmentsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {displayData?.segmentsUrl}
                    </a>
                  ) : (
                    <span className="text-muted">No segments</span>
                  )}
                </dd>

                <dt className="col-sm-4">Performances:</dt>
                <dd className="col-sm-8">
                  {displayData?.hasPerformances ? (
                    <a
                      href={displayData?.performancesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {displayData?.performancesUrl}
                    </a>
                  ) : (
                    <span className="text-muted">No performances</span>
                  )}
                </dd>
              </dl>
            </div>
          </div>

          {performances && (
            <div className="mt-4">
              {isLoadingPerformances ? (
                <div className="mt-3">
                  <p>Loading performances...</p>
                </div>
              ) : performancesList.length > 0 ? (
                <div className="mt-3">
                  <h5>Individual Performances</h5>
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Date</th>
                        <th>MIDI</th>
                        <th>Audio</th>
                        <th style={{ width: "120px" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performancesList.map((performance) => (
                        <PerformanceRow
                          key={performance.uri}
                          performance={performance}
                          onDelete={handleDeletePerformance}
                          isDeleting={deletingPerformance === performance.uri}
                        />
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <div className="mt-3">
                  <p className="text-muted">No performances found.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Section */}
      <div className="mt-4">
        <hr />
        <h4>Danger Zone</h4>
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          {!showDeleteConfirm ? (
            <div></div>
          ) : (
            <div>
              <p className="mb-0">
                <strong>Are you sure you want to delete this score?</strong>
              </p>
            </div>
          )}
          {!showDeleteConfirm ? (
            <Button
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Score"}
            </Button>
          ) : (
            <div>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={isDeleting}
                className="me-2"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete Everything"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setIsDeleting(false);
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditScore;

import { useResource, useSubject, useLdo } from "@ldo/solid-react";
import { ContainerShapeShapeType } from "../.ldo/container.shapeTypes";
import { ScoreShapeShapeType } from "../.ldo/score.shapeTypes";
import { useClaraContainer } from "./hooks";
import { useState, useEffect } from "react";

/**
 * Get the scores container for a user
 */
export const useClaraScoresForUser = () => {
  const { claraContainer } = useClaraContainer();

  // Get the scores container within CLARA
  const scoresContainerUri =
    claraContainer && claraContainer.type === "SolidContainer"
      ? claraContainer.child("scores/").uri
      : undefined;

  const scoresContainer = useResource(scoresContainerUri);
  const scoresContainerData = useSubject(
    ContainerShapeShapeType,
    scoresContainerUri,
  );

  return {
    scoresContainer,
    scoresContainerData,
    scores: scoresContainerData?.contains,
    isLoading:
      scoresContainer && "isReading" in scoresContainer
        ? scoresContainer.isReading()
        : false,
    error:
      scoresContainer &&
      "status" in scoresContainer &&
      scoresContainer.status.isError
        ? scoresContainer.status.message
        : null,
  };
};

/**
 * Hook to get a specific score document
 */
export const useClaraScore = (scoreUrl: string | undefined) => {
  const scoreResource = useResource(scoreUrl);
  const scoreData = useSubject(ScoreShapeShapeType, scoreUrl);

  return {
    scoreResource,
    scoreData,
    isLoading:
      scoreResource && "isReading" in scoreResource
        ? scoreResource.isReading()
        : false,
    error:
      scoreResource && "status" in scoreResource && scoreResource.status.isError
        ? scoreResource.status.message
        : null,
  };
};

/**
 * Hook to check if a specific score URL exists in the container
 * Uses batch loading to reduce server load and cancels pending requests when match is found
 */
export const useScoreExists = (targetUrl: string | null) => {
  const { scores, isLoading, error } = useClaraScoresForUser();
  const { getResource, getSubject } = useLdo();

  const [exists, setExists] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkedCount, setCheckedCount] = useState(0);

  // Check scores in batches and exit early when match is found
  useEffect(() => {
    // Handle null URL case
    if (targetUrl === null) {
      setExists(false);
      setCheckedCount(0);
      setCheckError("true");
      setIsChecking(false);
      return;
    }

    // Handle empty scores case
    if (!targetUrl || !scores || scores.size === 0) {
      setExists(false);
      setCheckedCount(0);
      setCheckError(null);
      setIsChecking(false);
      return;
    }

    const checkScoresInBatches = async () => {
      setIsChecking(true);
      setCheckError(null);
      setCheckedCount(0);

      // Convert LdSet to array of URLs
      const scoreUrls: string[] = [];
      scores.forEach((scoreItem) => {
        const scoreUrl = scoreItem["@id"];
        if (scoreUrl) {
          scoreUrls.push(scoreUrl);
        }
      });

      const BATCH_SIZE = 5;
      let found = false;
      let abortController: AbortController | null = null;

      try {
        // Process scores in batches
        for (let i = 0; i < scoreUrls.length && !found; i += BATCH_SIZE) {
          const batch = scoreUrls.slice(i, i + BATCH_SIZE);
          abortController = new AbortController();

          const batchPromises = batch.map(async (scoreUrl, batchIndex) => {
            const globalIndex = i + batchIndex;

            try {
              if (abortController?.signal.aborted) {
                throw new Error("Aborted");
              }

              // Get score data
              const scoreResource = getResource(scoreUrl);
              const scoreData = getSubject(ScoreShapeShapeType, scoreUrl);

              if (abortController?.signal.aborted) {
                throw new Error("Aborted");
              }

              const publishedAsUri = scoreData?.publishedAs?.["@id"];
              if (!publishedAsUri) {
                return { found: false, index: globalIndex };
              }

              if (publishedAsUri === targetUrl) {
                return { found: true, index: globalIndex };
              }

              return { found: false, index: globalIndex };
            } catch (error) {
              if (error instanceof Error && error.message === "Aborted") {
                throw error; // Re-throw abort errors
              }
              return { found: false, index: globalIndex, error: true };
            }
          });

          // Wait for batch to complete
          const batchResults = await Promise.all(batchPromises);

          // Update checked count
          const newCheckedCount = Math.min(i + batch.length, scoreUrls.length);
          setCheckedCount(newCheckedCount);

          // Check if we found a match in this batch
          const matchResult = batchResults.find((result) => result.found);
          if (matchResult) {
            found = true;
            setExists(true);
            // Abort any remaining operations
            abortController?.abort();
            break;
          }
        }

        // If we get here, no match was found
        if (!found) {
          setExists(false);
        }
      } catch (error) {
        if (error instanceof Error && error.message === "Aborted") {
          // Don't set error for aborted operations
          return;
        }
        console.error(
          `❌ useScoreExists: Error during batch processing:`,
          error,
        );
        setCheckError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setIsChecking(false);
      }
    };

    checkScoresInBatches();
  }, [targetUrl, scores, getResource, getSubject]);

  return {
    exists: exists ?? false,
    isLoading: isLoading || isChecking,
    error: error || checkError,
    totalScores: scores?.size || 0,
    checkedScores: checkedCount,
  };
};

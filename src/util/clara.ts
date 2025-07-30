import {
  getSolidDataset,
  getThing,
  getUrl,
  getUrlAll,
} from "@inrupt/solid-client";
import { useResource, useSubject } from "@ldo/solid-react";
import { ContainerShapeShapeType } from "../.ldo/container.shapeTypes";
import { ScoreShapeShapeType } from "../.ldo/score.shapeTypes";
import { PerformanceShapeShapeType } from "../.ldo/performance.shapeTypes";
import { useClaraContainer } from "./hooks";
import { WS } from "@inrupt/vocab-solid-common";
import { CLARA_CONTAINER_NAME } from "../config";
import { LDP } from "@inrupt/lit-generated-vocab-common";

export const getStorageForUser = async (
  webId: string,
  fetch: any,
): Promise<string | null> => {
  console.log(`Getting storage for user ${webId}`);
  const dataset = await getSolidDataset(webId, { fetch });
  const profileDoc = getThing(dataset, webId);
  return getUrl(profileDoc!, WS.storage);
};

export const getScoresForUser = async (
  webId: string,
  fetch: any,
): Promise<string[]> => {
  const storageUrl = await getStorageForUser(webId, fetch);
  const claraScoreContainerUrl = storageUrl + CLARA_CONTAINER_NAME + "scores/";
  return getSolidDataset(claraScoreContainerUrl, { fetch })
    .then((performanceDataset) => {
      const performanceDoc = getThing(
        performanceDataset,
        claraScoreContainerUrl,
      );
      return getUrlAll(performanceDoc!, LDP.contains);
    })
    .catch(() => {
      return [];
    });
};

export const getScoreDocument = async (url: string, fetch: any) => {
  try {
    const dataset = await getSolidDataset(url, { fetch });
    return getThing(dataset, url);
  } catch (e) {
    console.log(`Error getting score document ${url}`);
    console.log(e);
    // TODO: This could be an HTTP 500 error, mostly from NFS errors on the server.
    return null;
  }
};

/**
 * Get the scores container for a user
 */
export const useScoresForUser = () => {
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
    scores: scoresContainerData?.contains || [],
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
export const useScoreDocument = (scoreUrl: string | undefined) => {
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
 * Hook to get performance from a score
 */
export const usePerformanceFromScore = (scoreUrl: string | undefined) => {
  const { scoreData } = useScoreDocument(scoreUrl);

  // Get the related performance URI
  const performanceUri = scoreData?.related?.["@id"];
  const performanceResource = useResource(performanceUri);
  const performanceData = useSubject(PerformanceShapeShapeType, performanceUri);

  return {
    performanceResource,
    performanceData,
    performanceUri,
    isLoading:
      performanceResource && "isReading" in performanceResource
        ? performanceResource.isReading()
        : false,
    error:
      performanceResource &&
      "status" in performanceResource &&
      performanceResource.status.isError
        ? performanceResource.status.message
        : null,
  };
};

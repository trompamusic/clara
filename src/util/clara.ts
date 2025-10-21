import { useResource, useSubject } from "@ldo/solid-react";
import { ContainerShapeType } from "../.ldo/container.shapeTypes";
import { ScoreShapeType } from "../.ldo/score.shapeTypes";
import { ScoresItemListShapeType } from "../.ldo/scoresItemList.shapeTypes";
import { useClaraContainer } from "./hooks";
import { useMemo } from "react";

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
    ContainerShapeType,
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
  const scoreData = useSubject(ScoreShapeType, scoreUrl);

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
 * Read the schema.org ItemList of external scores at `scores/scores.ttl`.
 */
export const useScoresMapping = () => {
  const { claraContainer } = useClaraContainer();

  const mappingUri =
    claraContainer && claraContainer.type === "SolidContainer"
      ? claraContainer.child("scores/scores.ttl").uri
      : undefined;

  const resource = useResource(mappingUri);
  const mapping = useSubject(ScoresItemListShapeType, mappingUri);
  const items = useMemo(() => {
    const val: unknown = mapping?.itemListElement as unknown;
    // LDO collections are often LdSet (a Set). Handle Set, array, and string.
    if (
      val &&
      typeof val === "object" &&
      "forEach" in (val as any) &&
      "size" in (val as any)
    ) {
      const out: string[] = [];
      (val as Set<unknown>).forEach((v) => {
        if (typeof v === "string") out.push(v);
      });
      return out;
    }
    if (Array.isArray(val)) {
      return (val as unknown[]).filter(
        (v): v is string => typeof v === "string",
      );
    }
    if (typeof val === "string") {
      return [val];
    }
    return [] as string[];
  }, [mapping]);

  return {
    items,
    resource,
    isLoading:
      resource && "isReading" in resource ? resource.isReading() : false,
    error:
      resource && "status" in resource && resource.status.isError
        ? resource.status.message
        : null,
  };
};

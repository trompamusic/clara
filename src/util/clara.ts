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

  // Verify that the scoreData is actually a Score type (mo:Score)
  // If it's not, return null for scoreData so the component can render nothing
  const verifiedScoreData = useMemo(() => {
    if (!scoreData) return null;

    // Check if it has the type property and that it includes mo:Score
    if (scoreData.type && scoreData.type.size > 0) {
      let isScore = false;

      scoreData.type.forEach((typeObj) => {
        const typeId = typeObj?.["@id"];
        // Check if it's mo:Score (either "Score" in compact form or full IRI)
        // TODO: Ideally we want to expand this out to always be a URL instead of a compact form
        if (
          typeId === "Score" ||
          typeId === "http://purl.org/ontology/mo/Score"
        ) {
          isScore = true;
        }
      });

      return isScore ? scoreData : null;
    }

    return null;
  }, [scoreData]);

  return {
    scoreResource,
    scoreData: verifiedScoreData,
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
 * Read the schema.org ItemList of external scores at top-level `scores-list`.
 * returns items: a list of external score URLs
 * returns resource: the resource object
 * returns isLoading: true if the resource is still loading
 * returns error: the error message if the resource fails to load
 */
export const useScoreList = () => {
  const { claraContainer } = useClaraContainer();

  const mappingUri =
    claraContainer && claraContainer.type === "SolidContainer"
      ? claraContainer.child("scores-list").uri
      : undefined;

  const resource = useResource(mappingUri);
  const mapping = useSubject(ScoresItemListShapeType, mappingUri);
  const items = useMemo(() => {
    const val: unknown = mapping?.itemListElement as unknown;
    // LDO collections are often LdSet (a Set). Handle Set, array of IRIs, or single IRI.
    if (
      val &&
      typeof val === "object" &&
      "forEach" in (val as any) &&
      "size" in (val as any)
    ) {
      const out: string[] = [];
      (val as Set<any>).forEach((v) => {
        if (v && typeof v === "object" && "@id" in v)
          out.push((v as any)["@id"]);
      });
      return out;
    }
    if (Array.isArray(val)) {
      return (val as any[])
        .map((v) =>
          v && typeof v === "object" && "@id" in v ? (v as any)["@id"] : null,
        )
        .filter((s): s is string => typeof s === "string");
    }
    if (val && typeof val === "object" && "@id" in (val as any)) {
      return [(val as any)["@id"] as string];
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

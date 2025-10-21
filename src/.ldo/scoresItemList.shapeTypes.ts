import { ShapeType } from "@ldo/ldo";
import { scoresItemListSchema } from "./scoresItemList.schema";
import { scoresItemListContext } from "./scoresItemList.context";
import { ScoresItemList } from "./scoresItemList.typings";

/**
 * =============================================================================
 * LDO ShapeTypes scoresItemList
 * =============================================================================
 */

/**
 * ScoresItemList ShapeType
 */
export const ScoresItemListShapeType: ShapeType<ScoresItemList> = {
  schema: scoresItemListSchema,
  shape: "https://schema.org/ScoresItemListShape",
  context: scoresItemListContext,
};

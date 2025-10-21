import { ShapeType } from "@ldo/ldo";
import { scoreSchema } from "./score.schema";
import { scoreContext } from "./score.context";
import { Score, PublishedScore } from "./score.typings";

/**
 * =============================================================================
 * LDO ShapeTypes score
 * =============================================================================
 */

/**
 * Score ShapeType
 */
export const ScoreShapeType: ShapeType<Score> = {
  schema: scoreSchema,
  shape: "http://purl.org/ontology/mo/ScoreShape",
  context: scoreContext,
};

/**
 * PublishedScore ShapeType
 */
export const PublishedScoreShapeType: ShapeType<PublishedScore> = {
  schema: scoreSchema,
  shape: "http://purl.org/ontology/mo/PublishedScoreShape",
  context: scoreContext,
};

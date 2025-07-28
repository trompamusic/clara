import { ShapeType } from "@ldo/ldo";
import { scoreSchema } from "./score.schema";
import { scoreContext } from "./score.context";
import { ScoreShape, PublishedScoreShape } from "./score.typings";

/**
 * =============================================================================
 * LDO ShapeTypes score
 * =============================================================================
 */

/**
 * ScoreShape ShapeType
 */
export const ScoreShapeShapeType: ShapeType<ScoreShape> = {
  schema: scoreSchema,
  shape: "http://purl.org/ontology/mo/ScoreShape",
  context: scoreContext,
};

/**
 * PublishedScoreShape ShapeType
 */
export const PublishedScoreShapeShapeType: ShapeType<PublishedScoreShape> = {
  schema: scoreSchema,
  shape: "http://purl.org/ontology/mo/PublishedScoreShape",
  context: scoreContext,
};

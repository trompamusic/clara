import { ShapeType } from "@ldo/ldo";
import { timelineSchema } from "./timeline.schema";
import { timelineContext } from "./timeline.context";
import { Timeline, Instant, Annotation, Target } from "./timeline.typings";

/**
 * =============================================================================
 * LDO ShapeTypes timeline
 * =============================================================================
 */

/**
 * Timeline ShapeType
 */
export const TimelineShapeType: ShapeType<Timeline> = {
  schema: timelineSchema,
  shape: "http://purl.org/NET/c4dm/timeline.owl#TimelineShape",
  context: timelineContext,
};

/**
 * Instant ShapeType
 */
export const InstantShapeType: ShapeType<Instant> = {
  schema: timelineSchema,
  shape: "http://purl.org/NET/c4dm/timeline.owl#InstantShape",
  context: timelineContext,
};

/**
 * Annotation ShapeType
 */
export const AnnotationShapeType: ShapeType<Annotation> = {
  schema: timelineSchema,
  shape: "http://www.w3.org/ns/oa#AnnotationShape",
  context: timelineContext,
};

/**
 * Target ShapeType
 */
export const TargetShapeType: ShapeType<Target> = {
  schema: timelineSchema,
  shape: "http://www.w3.org/ns/oa#TargetShape",
  context: timelineContext,
};

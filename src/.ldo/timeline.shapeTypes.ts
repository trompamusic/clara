import { ShapeType } from "@ldo/ldo";
import { timelineSchema } from "./timeline.schema";
import { timelineContext } from "./timeline.context";
import {
  TimelineShape,
  InstantShape,
  AnnotationShape,
  TargetShape,
} from "./timeline.typings";

/**
 * =============================================================================
 * LDO ShapeTypes timeline
 * =============================================================================
 */

/**
 * TimelineShape ShapeType
 */
export const TimelineShapeShapeType: ShapeType<TimelineShape> = {
  schema: timelineSchema,
  shape: "http://purl.org/NET/c4dm/timeline.owl#TimelineShape",
  context: timelineContext,
};

/**
 * InstantShape ShapeType
 */
export const InstantShapeShapeType: ShapeType<InstantShape> = {
  schema: timelineSchema,
  shape: "http://purl.org/NET/c4dm/timeline.owl#InstantShape",
  context: timelineContext,
};

/**
 * AnnotationShape ShapeType
 */
export const AnnotationShapeShapeType: ShapeType<AnnotationShape> = {
  schema: timelineSchema,
  shape: "http://www.w3.org/ns/oa#AnnotationShape",
  context: timelineContext,
};

/**
 * TargetShape ShapeType
 */
export const TargetShapeShapeType: ShapeType<TargetShape> = {
  schema: timelineSchema,
  shape: "http://www.w3.org/ns/oa#TargetShape",
  context: timelineContext,
};

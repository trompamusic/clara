import { ShapeType } from "@ldo/ldo";
import { performanceSchema } from "./performance.schema";
import { performanceContext } from "./performance.context";
import { Performance, Signal, Interval } from "./performance.typings";

/**
 * =============================================================================
 * LDO ShapeTypes performance
 * =============================================================================
 */

/**
 * Performance ShapeType
 */
export const PerformanceShapeType: ShapeType<Performance> = {
  schema: performanceSchema,
  shape: "http://purl.org/ontology/mo/PerformanceShape",
  context: performanceContext,
};

/**
 * Signal ShapeType
 */
export const SignalShapeType: ShapeType<Signal> = {
  schema: performanceSchema,
  shape: "http://purl.org/ontology/mo/SignalShape",
  context: performanceContext,
};

/**
 * Interval ShapeType
 */
export const IntervalShapeType: ShapeType<Interval> = {
  schema: performanceSchema,
  shape: "http://purl.org/NET/c4dm/timeline.owl#IntervalShape",
  context: performanceContext,
};

import { ShapeType } from "@ldo/ldo";
import { performanceSchema } from "./performance.schema";
import { performanceContext } from "./performance.context";
import {
  PerformanceShape,
  SignalShape,
  IntervalShape,
} from "./performance.typings";

/**
 * =============================================================================
 * LDO ShapeTypes performance
 * =============================================================================
 */

/**
 * PerformanceShape ShapeType
 */
export const PerformanceShapeShapeType: ShapeType<PerformanceShape> = {
  schema: performanceSchema,
  shape: "http://purl.org/ontology/mo/PerformanceShape",
  context: performanceContext,
};

/**
 * SignalShape ShapeType
 */
export const SignalShapeShapeType: ShapeType<SignalShape> = {
  schema: performanceSchema,
  shape: "http://purl.org/ontology/mo/SignalShape",
  context: performanceContext,
};

/**
 * IntervalShape ShapeType
 */
export const IntervalShapeShapeType: ShapeType<IntervalShape> = {
  schema: performanceSchema,
  shape: "http://purl.org/NET/c4dm/timeline.owl#IntervalShape",
  context: performanceContext,
};

import { ShapeType } from "@ldo/ldo";
import { containerSchema } from "./container.schema";
import { containerContext } from "./container.context";
import { ContainerShape, ResourceShape } from "./container.typings";

/**
 * =============================================================================
 * LDO ShapeTypes container
 * =============================================================================
 */

/**
 * ContainerShape ShapeType
 */
export const ContainerShapeShapeType: ShapeType<ContainerShape> = {
  schema: containerSchema,
  shape: "http://www.w3.org/ns/ldp#ContainerShape",
  context: containerContext,
};

/**
 * ResourceShape ShapeType
 */
export const ResourceShapeShapeType: ShapeType<ResourceShape> = {
  schema: containerSchema,
  shape: "http://www.w3.org/ns/ldp#ResourceShape",
  context: containerContext,
};

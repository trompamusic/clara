import { ShapeType } from "@ldo/ldo";
import { segmentsSchema } from "./segments.schema";
import { segmentsContext } from "./segments.context";
import { SegmentLine, MEIManifestation, Segment } from "./segments.typings";

/**
 * =============================================================================
 * LDO ShapeTypes segments
 * =============================================================================
 */

/**
 * SegmentLine ShapeType
 */
export const SegmentLineShapeType: ShapeType<SegmentLine> = {
  schema: segmentsSchema,
  shape: "http://www.linkedmusic.org/ontologies/segment/SegmentLineShape",
  context: segmentsContext,
};

/**
 * MEIManifestation ShapeType
 */
export const MEIManifestationShapeType: ShapeType<MEIManifestation> = {
  schema: segmentsSchema,
  shape: "https://meld.linkedmusic.org/terms/MEIManifestationShape",
  context: segmentsContext,
};

/**
 * Segment ShapeType
 */
export const SegmentShapeType: ShapeType<Segment> = {
  schema: segmentsSchema,
  shape: "http://www.linkedmusic.org/ontologies/segment/SegmentShape",
  context: segmentsContext,
};

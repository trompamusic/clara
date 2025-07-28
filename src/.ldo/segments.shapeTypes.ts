import { ShapeType } from "@ldo/ldo";
import { segmentsSchema } from "./segments.schema";
import { segmentsContext } from "./segments.context";
import {
  SegmentLineShape,
  MEIManifestationShape,
  SegmentShape,
} from "./segments.typings";

/**
 * =============================================================================
 * LDO ShapeTypes segments
 * =============================================================================
 */

/**
 * SegmentLineShape ShapeType
 */
export const SegmentLineShapeShapeType: ShapeType<SegmentLineShape> = {
  schema: segmentsSchema,
  shape: "http://www.linkedmusic.org/ontologies/segment/SegmentLineShape",
  context: segmentsContext,
};

/**
 * MEIManifestationShape ShapeType
 */
export const MEIManifestationShapeShapeType: ShapeType<MEIManifestationShape> =
  {
    schema: segmentsSchema,
    shape: "https://meld.linkedmusic.org/terms/MEIManifestationShape",
    context: segmentsContext,
  };

/**
 * SegmentShape ShapeType
 */
export const SegmentShapeShapeType: ShapeType<SegmentShape> = {
  schema: segmentsSchema,
  shape: "http://www.linkedmusic.org/ontologies/segment/SegmentShape",
  context: segmentsContext,
};

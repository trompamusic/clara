import { LdoJsonldContext, LdSet } from "@ldo/ldo";

/**
 * =============================================================================
 * Typescript Typings for segments
 * =============================================================================
 */

/**
 * SegmentLineShape Type
 */
export interface SegmentLineShape {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  /**
   * Defines the node as a SegmentLine
   */
  type: LdSet<{
    "@id": "SegmentLine";
  }>;
}

/**
 * MEIManifestationShape Type
 */
export interface MEIManifestationShape {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  /**
   * Defines the node as a MEI Manifestation
   */
  type: LdSet<
    | {
        "@id": "Bag";
      }
    | {
        "@id": "MEIManifestation";
      }
  >;
  /**
   * Members of the manifestation
   */
  member?: LdSet<{
    "@id": string;
  }>;
  /**
   * The element that ends this manifestation
   */
  endsWith?: {
    "@id": string;
  };
  /**
   * Measure elements in this manifestation
   */
  measures?: LdSet<{
    "@id": string;
  }>;
  /**
   * Note elements in this manifestation
   */
  notes?: LdSet<{
    "@id": string;
  }>;
  /**
   * The element that starts this manifestation
   */
  startsWith?: {
    "@id": string;
  };
}

/**
 * SegmentShape Type
 */
export interface SegmentShape {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  /**
   * Defines the node as a Segment
   */
  type: LdSet<{
    "@id": "Segment";
  }>;
  /**
   * The embodiment of this segment
   */
  embodiment?: MEIManifestationShape;
  /**
   * The segment line this segment belongs to
   */
  onSegmentLine?: {
    "@id": string;
  };
  /**
   * The order of this segment
   */
  order?: string;
}

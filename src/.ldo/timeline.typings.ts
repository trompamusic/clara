import { LdoJsonldContext, LdSet } from "@ldo/ldo";

/**
 * =============================================================================
 * Typescript Typings for timeline
 * =============================================================================
 */

/**
 * Timeline Type
 */
export interface Timeline {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  /**
   * Defines the node as a Timeline
   */
  type: LdSet<{
    "@id": "Timeline";
  }>;
}

/**
 * Instant Type
 */
export interface Instant {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  /**
   * Defines the node as a Timeline Instant
   */
  type: LdSet<{
    "@id": "Instant";
  }>;
  /**
   * The time position on the timeline (e.g., 'P6.721S')
   */
  at?: string;
  /**
   * The timeline this instant belongs to
   */
  onTimeLine?: {
    "@id": string;
  };
  /**
   * The musical element this instant represents
   */
  embodimentOf?: {
    "@id": string;
  };
  /**
   * The confidence value for this instant
   */
  confidence?: string;
  /**
   * The velocity value for this instant
   */
  velocity?: string;
}

/**
 * Annotation Type
 */
export interface Annotation {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  /**
   * Defines the node as a Web Annotation
   */
  type: LdSet<{
    "@id": "Annotation";
  }>;
  /**
   * The body value of the annotation (e.g., '95', '-1')
   */
  bodyValue?: string;
  /**
   * The target of this annotation
   */
  hasTarget?: {
    "@id": string;
  };
  /**
   * The motivation for this annotation (e.g., oa:describing)
   */
  motivatedBy?: {
    "@id": string;
  };
}

/**
 * Target Type
 */
export interface Target {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  /**
   * Defines the node as an Annotation Target
   */
  type: LdSet<{
    "@id": "Target";
  }>;
  /**
   * The scope of this target (usually the timeline)
   */
  hasScope?: {
    "@id": string;
  };
  /**
   * The source of this target (usually a MEI element)
   */
  hasSource?: {
    "@id": string;
  };
}

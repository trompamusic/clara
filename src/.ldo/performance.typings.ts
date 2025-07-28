import { LdoJsonldContext, LdSet } from "@ldo/ldo";

/**
 * =============================================================================
 * Typescript Typings for performance
 * =============================================================================
 */

/**
 * PerformanceShape Type
 */
export interface PerformanceShape {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  /**
   * Defines the node as a Performance (from Music Ontology)
   */
  type: LdSet<{
    "@id": "Performance";
  }>;
  /**
   * The label of the performance (usually date/time)
   */
  label?: string;
  /**
   * The creation date and time of the performance
   */
  created?: string;
  /**
   * The score that this performance is of
   */
  performanceOf?: {
    "@id": string;
  };
  /**
   * The recording of this performance
   */
  recordedAs?: {
    "@id": string;
  };
  /**
   * The offset value for this performance
   */
  offset?: string;
}

/**
 * SignalShape Type
 */
export interface SignalShape {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  /**
   * Defines the node as a Signal (from Music Ontology)
   */
  type: LdSet<{
    "@id": "Signal";
  }>;
  /**
   * The audio file for this signal
   */
  availableAs?: {
    "@id": string;
  };
  /**
   * The MIDI file this signal is derived from
   */
  derivedFrom?: {
    "@id": string;
  };
  /**
   * The time interval for this signal
   */
  time?: IntervalShape;
}

/**
 * IntervalShape Type
 */
export interface IntervalShape {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  /**
   * Defines the node as a Timeline Interval
   */
  type: LdSet<{
    "@id": "Interval";
  }>;
  /**
   * The timeline this interval belongs to
   */
  onTimeLine?: {
    "@id": string;
  };
}

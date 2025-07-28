import { LdoJsonldContext, LdSet } from "@ldo/ldo";

/**
 * =============================================================================
 * Typescript Typings for score
 * =============================================================================
 */

/**
 * ScoreShape Type
 */
export interface ScoreShape {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  /**
   * Defines the node as a Score (from Music Ontology)
   */
  type: LdSet<{
    "@id": "Score";
  }>;
  /**
   * The title of the musical score
   */
  title?: string;
  /**
   * A link to the published version of this score (e.g., MEI file)
   */
  publishedAs?: {
    "@id": string;
  };
  /**
   * A related resource, such as a performance of this score
   */
  related?: {
    "@id": string;
  };
  /**
   * A link to segments data for this score
   */
  segments?: {
    "@id": string;
  };
}

/**
 * PublishedScoreShape Type
 */
export interface PublishedScoreShape {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  /**
   * Defines the node as a PublishedScore (from Music Ontology)
   */
  type: LdSet<{
    "@id": "PublishedScore";
  }>;
  /**
   * The location online where this score was copied from
   */
  exactMatch?: {
    "@id": string;
  };
}

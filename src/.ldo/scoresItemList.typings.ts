import { LdoJsonldContext, LdSet } from "@ldo/ldo";

/**
 * =============================================================================
 * Typescript Typings for scoresItemList
 * =============================================================================
 */

/**
 * ScoresItemList Type
 */
export interface ScoresItemList {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<{
    "@id": "ItemList";
  }>;
  itemListElement?: LdSet<{ "@id": string }>;
}

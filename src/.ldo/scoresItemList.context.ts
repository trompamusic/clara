import { LdoJsonldContext } from "@ldo/ldo";

/**
 * =============================================================================
 * scoresItemListContext: JSONLD Context for scoresItemList
 * =============================================================================
 */
export const scoresItemListContext: LdoJsonldContext = {
  type: {
    "@id": "@type",
    "@isCollection": true,
  },
  ItemList: {
    "@id": "https://schema.org/ItemList",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      itemListElement: {
        "@id": "https://schema.org/itemListElement",
        "@type": "@id",
        "@isCollection": true,
      },
    },
  },
  itemListElement: {
    "@id": "https://schema.org/itemListElement",
    "@type": "@id",
    "@isCollection": true,
  },
};

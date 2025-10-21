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
        "@type": "http://www.w3.org/2001/XMLSchema#string",
        "@isCollection": true,
      },
    },
  },
  itemListElement: {
    "@id": "https://schema.org/itemListElement",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
    "@isCollection": true,
  },
};

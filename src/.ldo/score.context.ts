import { LdoJsonldContext } from "@ldo/ldo";

/**
 * =============================================================================
 * scoreContext: JSONLD Context for score
 * =============================================================================
 */
export const scoreContext: LdoJsonldContext = {
  type: {
    "@id": "@type",
    "@isCollection": true,
  },
  Score: {
    "@id": "http://purl.org/ontology/mo/Score",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      title: {
        "@id": "http://purl.org/dc/terms/title",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      publishedAs: {
        "@id": "http://purl.org/ontology/mo/published_as",
        "@type": "@id",
      },
      related: {
        "@id": "http://www.w3.org/2004/02/skos/core#related",
        "@type": "@id",
      },
      segments: {
        "@id": "https://meld.linkedmusic.org/terms/segments",
        "@type": "@id",
      },
    },
  },
  title: {
    "@id": "http://purl.org/dc/terms/title",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  publishedAs: {
    "@id": "http://purl.org/ontology/mo/published_as",
    "@type": "@id",
  },
  related: {
    "@id": "http://www.w3.org/2004/02/skos/core#related",
    "@type": "@id",
  },
  segments: {
    "@id": "https://meld.linkedmusic.org/terms/segments",
    "@type": "@id",
  },
  PublishedScore: {
    "@id": "http://purl.org/ontology/mo/PublishedScore",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      exactMatch: {
        "@id": "http://www.w3.org/2004/02/skos/core#exactMatch",
        "@type": "@id",
      },
    },
  },
  exactMatch: {
    "@id": "http://www.w3.org/2004/02/skos/core#exactMatch",
    "@type": "@id",
  },
};

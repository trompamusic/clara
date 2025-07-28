import { LdoJsonldContext } from "@ldo/ldo";

/**
 * =============================================================================
 * segmentsContext: JSONLD Context for segments
 * =============================================================================
 */
export const segmentsContext: LdoJsonldContext = {
  type: {
    "@id": "@type",
    "@isCollection": true,
  },
  SegmentLine: {
    "@id": "http://www.linkedmusic.org/ontologies/segment/SegmentLine",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
    },
  },
  Bag: {
    "@id": "http://www.w3.org/1999/02/22-rdf-syntax-ns#Bag",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      member: {
        "@id": "http://www.w3.org/2000/01/rdf-schema#member",
        "@type": "@id",
        "@isCollection": true,
      },
      endsWith: {
        "@id": "https://meld.linkedmusic.org/terms/endsWith",
        "@type": "@id",
      },
      measures: {
        "@id": "https://meld.linkedmusic.org/terms/measures",
        "@type": "@id",
        "@isCollection": true,
      },
      notes: {
        "@id": "https://meld.linkedmusic.org/terms/notes",
        "@type": "@id",
        "@isCollection": true,
      },
      startsWith: {
        "@id": "https://meld.linkedmusic.org/terms/startsWith",
        "@type": "@id",
      },
    },
  },
  MEIManifestation: {
    "@id": "https://meld.linkedmusic.org/terms/MEIManifestation",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      member: {
        "@id": "http://www.w3.org/2000/01/rdf-schema#member",
        "@type": "@id",
        "@isCollection": true,
      },
      endsWith: {
        "@id": "https://meld.linkedmusic.org/terms/endsWith",
        "@type": "@id",
      },
      measures: {
        "@id": "https://meld.linkedmusic.org/terms/measures",
        "@type": "@id",
        "@isCollection": true,
      },
      notes: {
        "@id": "https://meld.linkedmusic.org/terms/notes",
        "@type": "@id",
        "@isCollection": true,
      },
      startsWith: {
        "@id": "https://meld.linkedmusic.org/terms/startsWith",
        "@type": "@id",
      },
    },
  },
  member: {
    "@id": "http://www.w3.org/2000/01/rdf-schema#member",
    "@type": "@id",
    "@isCollection": true,
  },
  endsWith: {
    "@id": "https://meld.linkedmusic.org/terms/endsWith",
    "@type": "@id",
  },
  measures: {
    "@id": "https://meld.linkedmusic.org/terms/measures",
    "@type": "@id",
    "@isCollection": true,
  },
  notes: {
    "@id": "https://meld.linkedmusic.org/terms/notes",
    "@type": "@id",
    "@isCollection": true,
  },
  startsWith: {
    "@id": "https://meld.linkedmusic.org/terms/startsWith",
    "@type": "@id",
  },
  Segment: {
    "@id": "http://www.linkedmusic.org/ontologies/segment/Segment",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      embodiment: {
        "@id": "http://purl.org/vocab/frbr/core#embodiment",
        "@type": "@id",
      },
      onSegmentLine: {
        "@id": "http://www.linkedmusic.org/ontologies/segment/onSegmentLine",
        "@type": "@id",
      },
      order: {
        "@id": "https://meld.linkedmusic.org/terms/order",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
    },
  },
  embodiment: {
    "@id": "http://purl.org/vocab/frbr/core#embodiment",
    "@type": "@id",
  },
  onSegmentLine: {
    "@id": "http://www.linkedmusic.org/ontologies/segment/onSegmentLine",
    "@type": "@id",
  },
  order: {
    "@id": "https://meld.linkedmusic.org/terms/order",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
};

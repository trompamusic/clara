import { LdoJsonldContext } from "@ldo/ldo";

/**
 * =============================================================================
 * performanceContext: JSONLD Context for performance
 * =============================================================================
 */
export const performanceContext: LdoJsonldContext = {
  type: {
    "@id": "@type",
    "@isCollection": true,
  },
  Performance: {
    "@id": "http://purl.org/ontology/mo/Performance",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      label: {
        "@id": "http://www.w3.org/2000/01/rdf-schema#label",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      created: {
        "@id": "http://purl.org/dc/terms/created",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      performanceOf: {
        "@id": "http://purl.org/ontology/mo/performance_of",
        "@type": "@id",
      },
      recordedAs: {
        "@id": "http://purl.org/ontology/mo/recorded_as",
        "@type": "@id",
      },
      offset: {
        "@id": "https://meld.linkedmusic.org/terms/offset",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
    },
  },
  label: {
    "@id": "http://www.w3.org/2000/01/rdf-schema#label",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  created: {
    "@id": "http://purl.org/dc/terms/created",
    "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
  },
  performanceOf: {
    "@id": "http://purl.org/ontology/mo/performance_of",
    "@type": "@id",
  },
  recordedAs: {
    "@id": "http://purl.org/ontology/mo/recorded_as",
    "@type": "@id",
  },
  offset: {
    "@id": "https://meld.linkedmusic.org/terms/offset",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  Signal: {
    "@id": "http://purl.org/ontology/mo/Signal",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      availableAs: {
        "@id": "http://purl.org/ontology/mo/available_as",
        "@type": "@id",
      },
      derivedFrom: {
        "@id": "http://purl.org/ontology/mo/derived_from",
        "@type": "@id",
      },
      time: {
        "@id": "http://purl.org/ontology/mo/time",
        "@type": "@id",
      },
    },
  },
  availableAs: {
    "@id": "http://purl.org/ontology/mo/available_as",
    "@type": "@id",
  },
  derivedFrom: {
    "@id": "http://purl.org/ontology/mo/derived_from",
    "@type": "@id",
  },
  time: {
    "@id": "http://purl.org/ontology/mo/time",
    "@type": "@id",
  },
  Interval: {
    "@id": "http://purl.org/NET/c4dm/timeline.owl#Interval",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      onTimeLine: {
        "@id": "http://purl.org/NET/c4dm/timeline.owl#onTimeLine",
        "@type": "@id",
      },
    },
  },
  onTimeLine: {
    "@id": "http://purl.org/NET/c4dm/timeline.owl#onTimeLine",
    "@type": "@id",
  },
};

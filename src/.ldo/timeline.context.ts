import { LdoJsonldContext } from "@ldo/ldo";

/**
 * =============================================================================
 * timelineContext: JSONLD Context for timeline
 * =============================================================================
 */
export const timelineContext: LdoJsonldContext = {
  type: {
    "@id": "@type",
    "@isCollection": true,
  },
  Timeline: {
    "@id": "http://purl.org/NET/c4dm/timeline.owl#Timeline",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
    },
  },
  Instant: {
    "@id": "http://purl.org/NET/c4dm/timeline.owl#Instant",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      at: {
        "@id": "http://purl.org/NET/c4dm/timeline.owl#at",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      onTimeLine: {
        "@id": "http://purl.org/NET/c4dm/timeline.owl#onTimeLine",
        "@type": "@id",
      },
      embodimentOf: {
        "@id": "http://purl.org/vocab/frbr/core#embodimentOf",
        "@type": "@id",
      },
      confidence: {
        "@id": "https://terms.trompamusic.eu/maps#confidence",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      velocity: {
        "@id": "https://terms.trompamusic.eu/maps#velocity",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
    },
  },
  at: {
    "@id": "http://purl.org/NET/c4dm/timeline.owl#at",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  onTimeLine: {
    "@id": "http://purl.org/NET/c4dm/timeline.owl#onTimeLine",
    "@type": "@id",
  },
  embodimentOf: {
    "@id": "http://purl.org/vocab/frbr/core#embodimentOf",
    "@type": "@id",
  },
  confidence: {
    "@id": "https://terms.trompamusic.eu/maps#confidence",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  velocity: {
    "@id": "https://terms.trompamusic.eu/maps#velocity",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  Annotation: {
    "@id": "http://www.w3.org/ns/oa#Annotation",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      bodyValue: {
        "@id": "http://www.w3.org/ns/oa#bodyValue",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      hasTarget: {
        "@id": "http://www.w3.org/ns/oa#hasTarget",
        "@type": "@id",
      },
      motivatedBy: {
        "@id": "http://www.w3.org/ns/oa#motivatedBy",
        "@type": "@id",
      },
    },
  },
  bodyValue: {
    "@id": "http://www.w3.org/ns/oa#bodyValue",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  hasTarget: {
    "@id": "http://www.w3.org/ns/oa#hasTarget",
    "@type": "@id",
  },
  motivatedBy: {
    "@id": "http://www.w3.org/ns/oa#motivatedBy",
    "@type": "@id",
  },
  Target: {
    "@id": "http://www.w3.org/ns/oa#Target",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      hasScope: {
        "@id": "http://www.w3.org/ns/oa#hasScope",
        "@type": "@id",
      },
      hasSource: {
        "@id": "http://www.w3.org/ns/oa#hasSource",
        "@type": "@id",
      },
    },
  },
  hasScope: {
    "@id": "http://www.w3.org/ns/oa#hasScope",
    "@type": "@id",
  },
  hasSource: {
    "@id": "http://www.w3.org/ns/oa#hasSource",
    "@type": "@id",
  },
};

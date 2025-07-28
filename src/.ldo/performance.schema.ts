import { Schema } from "shexj";

/**
 * =============================================================================
 * performanceSchema: ShexJ Schema for performance
 * =============================================================================
 */
export const performanceSchema: Schema = {
  type: "Schema",
  shapes: [
    {
      id: "http://purl.org/ontology/mo/PerformanceShape",
      type: "ShapeDecl",
      shapeExpr: {
        type: "Shape",
        expression: {
          type: "EachOf",
          expressions: [
            {
              type: "TripleConstraint",
              predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
              valueExpr: {
                type: "NodeConstraint",
                values: ["http://purl.org/ontology/mo/Performance"],
              },
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value:
                      "Defines the node as a Performance (from Music Ontology)",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://www.w3.org/2000/01/rdf-schema#label",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#string",
              },
              min: 0,
              max: 1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "The label of the performance (usually date/time)",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://purl.org/dc/terms/created",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#dateTime",
              },
              min: 0,
              max: 1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "The creation date and time of the performance",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://purl.org/ontology/mo/performance_of",
              valueExpr: {
                type: "NodeConstraint",
                nodeKind: "iri",
              },
              min: 0,
              max: 1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "The score that this performance is of",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://purl.org/ontology/mo/recorded_as",
              valueExpr: {
                type: "NodeConstraint",
                nodeKind: "iri",
              },
              min: 0,
              max: 1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "The recording of this performance",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "https://meld.linkedmusic.org/terms/offset",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#string",
              },
              min: 0,
              max: 1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "The offset value for this performance",
                  },
                },
              ],
            },
          ],
        },
      },
    },
    {
      id: "http://purl.org/ontology/mo/SignalShape",
      type: "ShapeDecl",
      shapeExpr: {
        type: "Shape",
        expression: {
          type: "EachOf",
          expressions: [
            {
              type: "TripleConstraint",
              predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
              valueExpr: {
                type: "NodeConstraint",
                values: ["http://purl.org/ontology/mo/Signal"],
              },
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "Defines the node as a Signal (from Music Ontology)",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://purl.org/ontology/mo/available_as",
              valueExpr: {
                type: "NodeConstraint",
                nodeKind: "iri",
              },
              min: 0,
              max: 1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "The audio file for this signal",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://purl.org/ontology/mo/derived_from",
              valueExpr: {
                type: "NodeConstraint",
                nodeKind: "iri",
              },
              min: 0,
              max: 1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "The MIDI file this signal is derived from",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://purl.org/ontology/mo/time",
              valueExpr: "http://purl.org/NET/c4dm/timeline.owl#IntervalShape",
              min: 0,
              max: 1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "The time interval for this signal",
                  },
                },
              ],
            },
          ],
        },
      },
    },
    {
      id: "http://purl.org/NET/c4dm/timeline.owl#IntervalShape",
      type: "ShapeDecl",
      shapeExpr: {
        type: "Shape",
        expression: {
          type: "EachOf",
          expressions: [
            {
              type: "TripleConstraint",
              predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
              valueExpr: {
                type: "NodeConstraint",
                values: ["http://purl.org/NET/c4dm/timeline.owl#Interval"],
              },
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "Defines the node as a Timeline Interval",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://purl.org/NET/c4dm/timeline.owl#onTimeLine",
              valueExpr: {
                type: "NodeConstraint",
                nodeKind: "iri",
              },
              min: 0,
              max: 1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "The timeline this interval belongs to",
                  },
                },
              ],
            },
          ],
        },
      },
    },
  ],
};

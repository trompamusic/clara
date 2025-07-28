import { Schema } from "shexj";

/**
 * =============================================================================
 * segmentsSchema: ShexJ Schema for segments
 * =============================================================================
 */
export const segmentsSchema: Schema = {
  type: "Schema",
  shapes: [
    {
      id: "http://www.linkedmusic.org/ontologies/segment/SegmentLineShape",
      type: "ShapeDecl",
      shapeExpr: {
        type: "Shape",
        expression: {
          type: "TripleConstraint",
          predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
          valueExpr: {
            type: "NodeConstraint",
            values: [
              "http://www.linkedmusic.org/ontologies/segment/SegmentLine",
            ],
          },
          annotations: [
            {
              type: "Annotation",
              predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
              object: {
                value: "Defines the node as a SegmentLine",
              },
            },
          ],
        },
      },
    },
    {
      id: "https://meld.linkedmusic.org/terms/MEIManifestationShape",
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
                values: [
                  "http://www.w3.org/1999/02/22-rdf-syntax-ns#Bag",
                  "https://meld.linkedmusic.org/terms/MEIManifestation",
                ],
              },
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "Defines the node as a MEI Manifestation",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://www.w3.org/2000/01/rdf-schema#member",
              valueExpr: {
                type: "NodeConstraint",
                nodeKind: "iri",
              },
              min: 0,
              max: -1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "Members of the manifestation",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "https://meld.linkedmusic.org/terms/endsWith",
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
                    value: "The element that ends this manifestation",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "https://meld.linkedmusic.org/terms/measures",
              valueExpr: {
                type: "NodeConstraint",
                nodeKind: "iri",
              },
              min: 0,
              max: -1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "Measure elements in this manifestation",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "https://meld.linkedmusic.org/terms/notes",
              valueExpr: {
                type: "NodeConstraint",
                nodeKind: "iri",
              },
              min: 0,
              max: -1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "Note elements in this manifestation",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "https://meld.linkedmusic.org/terms/startsWith",
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
                    value: "The element that starts this manifestation",
                  },
                },
              ],
            },
          ],
        },
      },
    },
    {
      id: "http://www.linkedmusic.org/ontologies/segment/SegmentShape",
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
                values: [
                  "http://www.linkedmusic.org/ontologies/segment/Segment",
                ],
              },
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "Defines the node as a Segment",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://purl.org/vocab/frbr/core#embodiment",
              valueExpr:
                "https://meld.linkedmusic.org/terms/MEIManifestationShape",
              min: 0,
              max: 1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "The embodiment of this segment",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate:
                "http://www.linkedmusic.org/ontologies/segment/onSegmentLine",
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
                    value: "The segment line this segment belongs to",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "https://meld.linkedmusic.org/terms/order",
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
                    value: "The order of this segment",
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

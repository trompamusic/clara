import { Schema } from "shexj";

/**
 * =============================================================================
 * scoreSchema: ShexJ Schema for score
 * =============================================================================
 */
export const scoreSchema: Schema = {
  type: "Schema",
  shapes: [
    {
      id: "http://purl.org/ontology/mo/ScoreShape",
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
                values: ["http://purl.org/ontology/mo/Score"],
              },
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "Defines the node as a Score (from Music Ontology)",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://purl.org/dc/terms/title",
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
                    value: "The title of the musical score",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://purl.org/ontology/mo/published_as",
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
                    value:
                      "A link to the published version of this score (e.g., MEI file)",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://www.w3.org/2004/02/skos/core#related",
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
                    value:
                      "A related resource, such as a performance of this score",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "https://meld.linkedmusic.org/terms/segments",
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
                    value: "A link to segments data for this score",
                  },
                },
              ],
            },
          ],
        },
      },
    },
    {
      id: "http://purl.org/ontology/mo/PublishedScoreShape",
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
                values: ["http://purl.org/ontology/mo/PublishedScore"],
              },
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value:
                      "Defines the node as a PublishedScore (from Music Ontology)",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://www.w3.org/2004/02/skos/core#exactMatch",
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
                    value:
                      "The location online where this score was copied from",
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

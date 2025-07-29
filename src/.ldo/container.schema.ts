import { Schema } from "shexj";

/**
 * =============================================================================
 * containerSchema: ShexJ Schema for container
 * =============================================================================
 */
export const containerSchema: Schema = {
  type: "Schema",
  shapes: [
    {
      id: "http://www.w3.org/ns/ldp#ContainerShape",
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
                  "http://www.w3.org/ns/ldp#Container",
                  "http://www.w3.org/ns/ldp#BasicContainer",
                  "http://www.w3.org/ns/ldp#Resource",
                ],
              },
              min: 0,
              max: 1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "Defines the node as an LDP Container",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://purl.org/dc/terms/modified",
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
                    value: "The last modification date of the container",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://www.w3.org/ns/ldp#contains",
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
                    value:
                      "A list of resources contained within this container",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://www.w3.org/ns/posix/stat#mtime",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#integer",
              },
              min: 0,
              max: 1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "POSIX modification time as Unix timestamp",
                  },
                },
              ],
            },
          ],
        },
      },
    },
    {
      id: "http://www.w3.org/ns/ldp#ResourceShape",
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
                values: ["http://www.w3.org/ns/ldp#Resource"],
              },
              min: 0,
              max: 1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "Defines the node as an LDP Resource",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://purl.org/dc/terms/modified",
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
                    value: "The last modification date of the resource",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://www.w3.org/ns/posix/stat#mtime",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#integer",
              },
              min: 0,
              max: 1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "POSIX modification time as Unix timestamp",
                  },
                },
              ],
            },
            {
              type: "TripleConstraint",
              predicate: "http://www.w3.org/ns/posix/stat#size",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#integer",
              },
              min: 0,
              max: 1,
              annotations: [
                {
                  type: "Annotation",
                  predicate: "http://www.w3.org/2000/01/rdf-schema#comment",
                  object: {
                    value: "Size of the resource in bytes",
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

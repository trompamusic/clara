import { Schema } from "shexj";

/**
 * =============================================================================
 * scoresItemListSchema: ShexJ Schema for scoresItemList
 * =============================================================================
 */
export const scoresItemListSchema: Schema = {
  type: "Schema",
  shapes: [
    {
      id: "https://schema.org/ScoresItemListShape",
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
                values: ["https://schema.org/ItemList"],
              },
            },
            {
              type: "TripleConstraint",
              predicate: "https://schema.org/itemListElement",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#string",
              },
              min: 0,
              max: -1,
            },
          ],
        },
      },
    },
  ],
};

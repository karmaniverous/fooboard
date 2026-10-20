/**
 * The parts of json-p3's parsed JSONPath this app reads (its `ast.d.ts`,
 * whose kind constants aren't exported from the package entry): node
 * kinds, and walking a node's children without its source token. Pure.
 *
 * @module
 */

/** json-p3 AST node kinds. */
export const AST = {
  CHILD_SEGMENT: 1,
  FILTER_SELECTOR: 3,
  INDEX_SELECTOR: 4,
  NAME_SELECTOR: 8,
  SLICE_SELECTOR: 9,
  WILDCARD_SELECTOR: 10,
  ABSOLUTE_QUERY: 11,
  FUNCTION_EXPRESSION: 17,
  RELATIVE_QUERY: 26,
  STRING_EXPRESSION: 27,
} as const;

/** A parsed node (any object). */
export const isAstNode = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

/** A node's child values, without the token it was parsed from. */
export const astChildren = (node: Record<string, unknown>): unknown[] =>
  Object.entries(node)
    .filter(([key]) => key !== 'token')
    .map(([, value]) => value);

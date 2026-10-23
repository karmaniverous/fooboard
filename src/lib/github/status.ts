/**
 * The HTTP statuses the GitHub adapter and the query layer tell apart.
 *
 * @module
 */

export const HTTP_STATUS = {
  notModified: 304,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  tooManyRequests: 429,
  /** The first status of a server error. */
  serverError: 500,
} as const;

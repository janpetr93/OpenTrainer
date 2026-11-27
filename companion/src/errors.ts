/** A request the client got wrong: bad JSON, a missing field, an unknown id. */
export class BadRequestError extends Error {}

/** A Strava or Google call failed or answered with something unusable. */
export class UpstreamError extends Error {}

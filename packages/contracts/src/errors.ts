/**
 * Name of the error a server-function handler throws for a deliberate 4xx.
 * Shared so the server that throws it, the client serialization adapter that
 * carries it — and its HTTP status — across the boundary, and the Sentry filter
 * that drops it all agree on one string.
 */
export const CLIENT_ERROR_NAME = "ClientError";

/**
 * Message for a request that failed because a backing store is down. Shared so
 * the server's 503 and the client's own outage notices say the same thing.
 */
export const UNAVAILABLE_MESSAGE =
	"Virtool is temporarily unavailable. Try again in a minute.";

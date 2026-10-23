import { CLIENT_ERROR_NAME } from "@virtool/contracts";

/**
 * An expected, client-facing failure a server-function handler surfaces with a
 * deliberate status: a bad login, a missing record, a name conflict, a feature
 * this deployment does not offer. It carries the message the client renders and
 * the HTTP status that names the failure. It is routine
 * control flow, not an incident, so `dropExpectedClientErrors` keeps it out of
 * Sentry — throw this rather than a plain `Error` for any deliberate status, or it
 * is reported as an incident.
 */
export class ClientError extends Error {
	/**
	 * The HTTP status that names this failure. Server functions don't set it on
	 * the response, because a function called in-process during SSR would set it
	 * on the rendered page. Carried across the boundary by
	 * `serverErrorSerializationAdapter` (`app/serverErrors.ts`) — Router's
	 * default `ShallowErrorPlugin` would keep only the message.
	 */
	declare readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = CLIENT_ERROR_NAME;
		this.status = status;
	}
}

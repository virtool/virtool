import { logger } from "./logger";
import { recordAccountLifecycleOperation } from "./metrics/registry";

/** Bounded, secret-free invitation, bootstrap, and TOTP reset telemetry. */
export function recordAccountLifecycle(input: {
	operation:
		| "invitation_create"
		| "invitation_regenerate"
		| "invitation_delete"
		| "invitation_accept"
		| "bootstrap"
		| "totp_reset";
	outcome: "success" | "failure" | "copy_only" | "queued";
	message: string;
	invitationId?: number;
	userId?: number;
	issuerUserId?: number;
}): void {
	const { operation, outcome, message, ...fields } = input;
	recordAccountLifecycleOperation(operation, outcome);
	logger.info({ ...fields, operation, outcome }, message);
}

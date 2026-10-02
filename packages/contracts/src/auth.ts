/** The path where the Better Auth handler is mounted. */
export const AUTH_BASE_PATH = "/api/auth";

/**
 * The path, below {@link AUTH_BASE_PATH}, that issues passkey options for
 * recent authentication.
 */
export const RECENT_AUTHENTICATION_PASSKEY_OPTIONS_PATH =
	"/virtool-session/passkey-options";

/**
 * Name of the error the server auth middleware throws when a request has no
 * valid session. Shared so the server that throws it, the client serialization
 * adapter that carries it across the boundary, and the query retry guard that
 * reads it all agree on one string.
 */
export const UNAUTHORIZED_ERROR_NAME = "UnauthorizedError";

/**
 * Name of the error the server auth middleware throws when the session user
 * lacks the required administrator role.
 */
export const FORBIDDEN_ERROR_NAME = "ForbiddenError";

/** Error code returned when a sensitive operation needs recent authentication. */
export const SESSION_NOT_FRESH_ERROR_NAME = "SESSION_NOT_FRESH";

/**
 * Name of the error the server auth middleware throws when a request carries a
 * restricted setup credential and asks for something outside that credential's
 * one purpose.
 *
 * A distinct name because a restricted caller is not anonymous — retrying the
 * request or sending them to the login wall is the wrong answer, and both are
 * what the 401 name already means to the client.
 */
export const SETUP_REQUIRED_ERROR_NAME = "SetupRequiredError";

/** Error name returned when a signed-in user must replace their password. */
export const PASSWORD_RESET_REQUIRED_ERROR_NAME = "PasswordResetRequiredError";

/**
 * Error name returned when instance policy requires TOTP and the signed-in
 * user has not enrolled.
 */
export const MFA_ENROLLMENT_REQUIRED_ERROR_NAME = "MfaEnrollmentRequiredError";

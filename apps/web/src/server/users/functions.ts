import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	ADMINISTRATOR_ROLE_NAMES,
	PasswordTooShortError,
} from "@virtool/contracts";
import {
	EmailInUseError,
	isValidEmail,
	normalizeEmail,
} from "@virtool/data/auth/email";
import {
	getEmailSettings,
	resolveEmailDelivery,
} from "@virtool/data/email/settings";
import {
	changePassword,
	findUsers,
	GroupMembershipError,
	getAccount,
	getAdministratorRole,
	getUser,
	InvalidPasswordError,
	listAdministratorRoles,
	listUsers,
	PendingAccountError,
	setAdministratorRole,
	UserConflictError,
	UserNotFoundError,
	updateUser,
} from "@virtool/data/users/data";
import {
	createPendingInvitation,
	getInvitation,
	InvitationNotEligibleError,
	InvitationNotFoundError,
	regenerateInvitation,
	revokeInvitation,
} from "@virtool/data/users/invitations";
import { z } from "zod";
import { realCookies } from "../auth/cookies";
import { establishLegacySession } from "../auth/core";
import { PROTECTED_OPERATIONS } from "../auth/freshness";
import { checkHandle, checkReservedHandle } from "../auth/handle";
import { getClientIp } from "../auth/ip";
import { requireAdminRole } from "../auth/middleware";
import {
	adminRole,
	authenticated,
	recentlyAuthenticated,
} from "../auth/policy";
import { checkConfiguredPasswordLength } from "../auth/service";
import { signInUsername } from "../auth/sessionActions";
import { db, keyring } from "../composition";
import { config } from "../config";
import { ClientError } from "../errors";
import {
	pageSchema,
	perPageSchema,
	rowIdSchema,
	searchTermSchema,
} from "../validation";

const administratorRoleSchema = z.enum(ADMINISTRATOR_ROLE_NAMES);

const userIdSchema = z.object({
	userId: rowIdSchema,
});

const findUsersSchema = z
	.object({
		term: searchTermSchema,
		page: pageSchema,
		perPage: perPageSchema,
		administrator: z.boolean().optional(),
		active: z.boolean().default(true),
	})
	.optional();

const searchUsersSchema = z
	.object({
		term: searchTermSchema,
		page: pageSchema,
		perPage: perPageSchema,
	})
	.optional();

// Password length is enforced by checkConfiguredPasswordLength in the handlers
// below, not here — see that function for why the validator is the wrong place
// for it.
const createUserSchema = z.object({
	email: z.string().trim().min(1).max(254),
	administratorRole: administratorRoleSchema.nullable().optional(),
	groups: z.array(rowIdSchema).default([]),
	primaryGroup: rowIdSchema.nullable().optional(),
	deliveryIntent: z.enum(["copy_only", "email"]),
});

const updateUserSchema = userIdSchema.extend({
	active: z.boolean().optional(),
	forceReset: z.boolean().optional(),
	handle: z.string().trim().min(1).optional(),
	password: z.string().optional(),
	groups: z.array(rowIdSchema).optional(),
	primaryGroup: rowIdSchema.nullable().optional(),
});

const accountHandleSchema = z.object({
	handle: z.string().trim().min(1),
});

// Password length is enforced by checkConfiguredPasswordLength in the handler,
// not here. `oldPassword` carries no length rule at all: it authenticates the
// password the user already has, and if the minimum were raised, checking it
// here would lock a user with a shorter existing password out of the very form
// that would replace it.
const changePasswordSchema = z.object({
	oldPassword: z.string().min(1),
	password: z.string(),
});

const setAdministratorRoleSchema = userIdSchema.extend({
	role: administratorRoleSchema.nullable(),
});

function rethrowAsHttp(err: unknown): never {
	if (err instanceof PasswordTooShortError) {
		setResponseStatus(400);
		throw new ClientError(err.message, 400);
	}
	if (err instanceof InvalidPasswordError) {
		setResponseStatus(400);
		throw new ClientError("Invalid credentials", 400);
	}
	if (err instanceof UserNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("User not found.", 404);
	}
	if (err instanceof UserConflictError) {
		setResponseStatus(409);
		throw new ClientError("User already exists.", 409);
	}
	if (err instanceof EmailInUseError) {
		setResponseStatus(409);
		throw new ClientError("Email address is already in use.", 409);
	}
	if (err instanceof GroupMembershipError) {
		setResponseStatus(400);
		throw new ClientError("User is not a member of group.", 400);
	}
	if (err instanceof PendingAccountError) {
		setResponseStatus(409);
		throw new ClientError("User has not completed account setup.", 409);
	}
	if (
		err instanceof InvitationNotEligibleError ||
		err instanceof InvitationNotFoundError
	) {
		setResponseStatus(409);
		throw new ClientError("Invitation is not available.", 409);
	}
	throw err;
}

async function getDeliveryAvailable(): Promise<boolean> {
	const settings = await getEmailSettings(db);
	return (
		settings.enabled &&
		resolveEmailDelivery(settings, keyring).availability === "ready"
	);
}

async function recordLifecycle(
	input: Parameters<
		typeof import("../accountLifecycleTelemetry").recordAccountLifecycle
	>[0],
): Promise<void> {
	const { recordAccountLifecycle } = await import(
		"../accountLifecycleTelemetry"
	);
	recordAccountLifecycle(input);
}

function getSetupUrl(token: string): string {
	return `${config.publicOrigin}/account-setup#token=${token}`;
}

async function requireInvitationAuthority(
	principal: Parameters<typeof requireAdminRole>[0],
	administratorRole:
		| (typeof ADMINISTRATOR_ROLE_NAMES)[number]
		| null
		| undefined,
): Promise<void> {
	await requireAdminRole(principal, administratorRole ? "full" : "users");
}

export const listAdministratorRolesFn = createServerFn({ method: "GET" })
	.middleware([adminRole("base")])
	.handler(async () => listAdministratorRoles());

/** Whether invitation email can currently be delivered. */
export const getInvitationEmailAvailabilityFn = createServerFn({
	method: "GET",
})
	.middleware([adminRole("users")])
	.handler(getDeliveryAvailable);

// Any authenticated user can see who else exists — the handles are already
// visible on samples, jobs, and analyses they can read.
export const listUsersFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.handler(async () => listUsers(db));

export const findUsersFn = createServerFn({ method: "POST" })
	.middleware([adminRole("users")])
	.validator(findUsersSchema)
	.handler(async ({ data }) => {
		return findUsers(db, {
			term: data?.term ?? "",
			page: data?.page ?? 1,
			perPage: data?.perPage ?? 25,
			administrator: data?.administrator,
			active: data?.active ?? true,
			// The one caller that asks for pending accounts. An administrator has
			// to see the invitation they issued in order to re-issue or revoke it,
			// and `findUsers` defaults to hiding them so nothing else has to
			// remember to.
			lifecycleState: "any",
		});
	});

// A paginated user search any signed-in user may run: authenticated, with no
// administrator filter. Backs the reference member picker, where a non-admin
// who holds `modify` on a reference searches users to add. `findUsersFn` above
// is the stricter administrator-only variant used by the user administration
// views.
export const searchUsersFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(searchUsersSchema)
	.handler(async ({ data }) =>
		findUsers(db, {
			term: data?.term ?? "",
			page: data?.page ?? 1,
			perPage: data?.perPage ?? 25,
		}),
	);

// Not on the authentication exception list, so an anonymous call gets a 401.
// The login wall and the authenticated route guard both rely on that: a
// rejected call is how they learn there is no session.
export const getAccountFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.handler(async ({ context }) => getAccount(db, context.principal.userId));

export const getUserFn = createServerFn({ method: "GET" })
	.middleware([adminRole("users")])
	.validator(userIdSchema)
	.handler(async ({ data }) => {
		try {
			return await getUser(db, data.userId);
		} catch (err) {
			// `throw` keeps the handler's inferred return type `User` rather than
			// `User | undefined`, so suspense consumers get a non-nullable user.
			throw rethrowAsHttp(err);
		}
	});

export const createUserFn = createServerFn({ method: "POST" })
	.middleware([recentlyAuthenticated(PROTECTED_OPERATIONS.invitationLinkIssue)])
	.validator(createUserSchema)
	.handler(async ({ context, data }) => {
		await requireInvitationAuthority(context.principal, data.administratorRole);
		const email = normalizeEmail(data.email);
		if (!isValidEmail(email)) {
			setResponseStatus(400);
			throw new ClientError("Enter a valid email address.", 400);
		}

		try {
			const result = await createPendingInvitation(db, {
				email,
				administratorRole: data.administratorRole,
				groups: data.groups,
				primaryGroup: data.primaryGroup,
				deliveryIntent: data.deliveryIntent,
				deliveryAvailable: await getDeliveryAvailable(),
				issuerUserId: context.principal.userId,
				getSetupUrl,
			});
			await recordLifecycle({
				operation: "invitation_create",
				outcome: result.invitation.delivery,
				message: "account invitation created",
				invitationId: result.invitation.id,
				userId: result.user.id,
				issuerUserId: context.principal.userId,
			});
			setResponseStatus(201);
			return result;
		} catch (err) {
			await recordLifecycle({
				operation: "invitation_create",
				outcome: "failure",
				message: "account invitation creation failed",
			});
			throw rethrowAsHttp(err);
		}
	});

export const getInvitationFn = createServerFn({ method: "GET" })
	.middleware([adminRole("users")])
	.validator(userIdSchema)
	.handler(async ({ context, data }) => {
		try {
			const role = await getAdministratorRole(db, data.userId);
			await requireInvitationAuthority(context.principal, role);
			return await getInvitation(db, data.userId);
		} catch (err) {
			throw rethrowAsHttp(err);
		}
	});

const invitationMutationSchema = userIdSchema.extend({
	deliveryIntent: z.enum(["copy_only", "email"]).optional(),
});

export const regenerateInvitationFn = createServerFn({ method: "POST" })
	.middleware([recentlyAuthenticated(PROTECTED_OPERATIONS.invitationLinkIssue)])
	.validator(invitationMutationSchema)
	.handler(async ({ context, data }) => {
		try {
			const role = await getAdministratorRole(db, data.userId);
			await requireInvitationAuthority(context.principal, role);
			const result = await regenerateInvitation(db, data.userId, {
				issuerUserId: context.principal.userId,
				deliveryIntent: data.deliveryIntent ?? "copy_only",
				deliveryAvailable: await getDeliveryAvailable(),
				getSetupUrl,
			});
			await recordLifecycle({
				operation: "invitation_regenerate",
				outcome: result.invitation.delivery,
				message: "account invitation regenerated",
				invitationId: result.invitation.id,
				userId: data.userId,
				issuerUserId: context.principal.userId,
			});
			return result;
		} catch (err) {
			await recordLifecycle({
				operation: "invitation_regenerate",
				outcome: "failure",
				message: "account invitation regeneration failed",
				userId: data.userId,
			});
			throw rethrowAsHttp(err);
		}
	});

export const revokeInvitationFn = createServerFn({ method: "POST" })
	.middleware([recentlyAuthenticated(PROTECTED_OPERATIONS.invitationLinkIssue)])
	.validator(userIdSchema)
	.handler(async ({ context, data }) => {
		try {
			const role = await getAdministratorRole(db, data.userId);
			await requireInvitationAuthority(context.principal, role);
			const invitation = await revokeInvitation(db, data.userId);
			await recordLifecycle({
				operation: "invitation_revoke",
				outcome: "success",
				message: "account invitation revoked",
				invitationId: invitation.id,
				userId: data.userId,
				issuerUserId: context.principal.userId,
			});
			return invitation;
		} catch (err) {
			await recordLifecycle({
				operation: "invitation_revoke",
				outcome: "failure",
				message: "account invitation revocation failed",
				userId: data.userId,
			});
			throw rethrowAsHttp(err);
		}
	});

export const updateUserFn = createServerFn({ method: "POST" })
	.middleware([adminRole("users")])
	.validator(updateUserSchema)
	.handler(async ({ context, data }) => {
		// A policy states the floor. This one depends on the target row, so it can
		// only be checked here: editing a user who is themselves an administrator
		// requires the full role.
		const targetRole = await getAdministratorRole(db, data.userId);
		if (targetRole !== null) {
			await requireAdminRole(context.principal, "full");
		}

		const { userId, ...values } = data;
		if (values.handle !== undefined) {
			checkHandle(values.handle);
			checkReservedHandle(values.handle);
		}
		try {
			if (values.password !== undefined) {
				await checkConfiguredPasswordLength(db, values.password);
			}
			return await updateUser(db, userId, values);
		} catch (err) {
			throw rethrowAsHttp(err);
		}
	});

export const updateAccountHandleFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(accountHandleSchema)
	.handler(async ({ context, data }) => {
		checkHandle(data.handle);
		checkReservedHandle(data.handle);

		try {
			return await updateUser(db, context.principal.userId, {
				handle: data.handle,
			});
		} catch (err) {
			throw rethrowAsHttp(err);
		}
	});

export const changePasswordFn = createServerFn({ method: "POST" })
	.middleware([
		recentlyAuthenticated(PROTECTED_OPERATIONS.accountPasswordChange),
	])
	.validator(changePasswordSchema)
	.handler(async ({ context, data }) => {
		try {
			await checkConfiguredPasswordLength(db, data.password);

			const { account, handle, migrated } = await changePassword(db, {
				userId: context.principal.userId,
				oldPassword: data.oldPassword,
				password: data.password,
			});

			if (migrated) {
				await signInUsername(handle, data.password);
			} else {
				await establishLegacySession(
					db,
					realCookies,
					context.principal.userId,
					getClientIp(),
				);
			}

			return account;
		} catch (err) {
			throw rethrowAsHttp(err);
		}
	});

export const setAdministratorRoleFn = createServerFn({ method: "POST" })
	.middleware([adminRole("full")])
	.validator(setAdministratorRoleSchema)
	.handler(async ({ context, data }) => {
		if (context.principal.userId === data.userId) {
			setResponseStatus(400);
			throw new ClientError("Cannot change own role", 400);
		}

		try {
			return await setAdministratorRole(db, data.userId, data.role);
		} catch (err) {
			throw rethrowAsHttp(err);
		}
	});

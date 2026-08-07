import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { PasswordTooShortError } from "@virtool/contracts";
import {
	changePassword,
	createUser,
	findUsers,
	GroupMembershipError,
	getAccount,
	getAdministratorRole,
	getUser,
	InvalidPasswordError,
	listAdministratorRoles,
	listUsers,
	setAdministratorRole,
	UserConflictError,
	UserNotFoundError,
	updateAccountEmail,
	updateUser,
} from "@virtool/data/users/data";
import { z } from "zod";
import { realCookies } from "../auth/cookies";
import { getClientIp } from "../auth/ip";
import { requireAdminRole } from "../auth/middleware";
import { adminRole, authenticated } from "../auth/policy";
import { checkConfiguredPasswordLength } from "../auth/service";
import { db } from "../composition";
import { ClientError } from "../errors";
import { pageSchema, perPageSchema, rowIdSchema } from "../validation";

const administratorRoleSchema = z.enum([
	"full",
	"settings",
	"spaces",
	"users",
	"base",
]);

const userIdSchema = z.object({
	userId: rowIdSchema,
});

const findUsersSchema = z
	.object({
		term: z.string().default(""),
		page: pageSchema,
		perPage: perPageSchema,
		administrator: z.boolean().optional(),
		active: z.boolean().default(true),
	})
	.optional();

const searchUsersSchema = z
	.object({
		term: z.string().default(""),
		page: pageSchema,
		perPage: perPageSchema,
	})
	.optional();

// Password length is enforced by checkConfiguredPasswordLength in the handlers
// below, not here — see that function for why the validator is the wrong place
// for it.
const createUserSchema = z.object({
	handle: z.string().trim().min(1),
	password: z.string(),
	forceReset: z.boolean().default(false),
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

const accountEmailSchema = z.object({
	email: z.string().trim(),
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

// Mirrors `check_email` in virtool/account/models.py: an empty string clears the
// address, anything else has to parse. Checked here rather than in the validator
// because a zod rejection surfaces as a 500 carrying the issue list, which is
// not something a form can put in front of a user.
function checkEmail(email: string): void {
	if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		setResponseStatus(400);
		throw new ClientError("The format of the email is invalid");
	}
}

// Reserved handle the Python service forbids; rejected before hitting the
// database so we return a clear message rather than a unique-constraint error.
// Trim defensively so whitespace-padded variants like " virtool" can't slip
// past the check even if a caller skips the schema's trim.
function checkReservedHandle(handle: string): void {
	if (handle.trim().toLowerCase() === "virtool") {
		setResponseStatus(400);
		throw new ClientError("Reserved user name: virtool");
	}
}

const setAdministratorRoleSchema = userIdSchema.extend({
	role: administratorRoleSchema.nullable(),
});

// Wrapped in createServerOnlyFn so the compiler can strip this body — and the
// domain-error imports it references — from the client bundle. A plain
// top-level helper would pin ./data and its postgres transitive dependency in
// the client graph.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof PasswordTooShortError) {
		setResponseStatus(400);
		throw new ClientError(err.message);
	}
	if (err instanceof InvalidPasswordError) {
		setResponseStatus(400);
		throw new ClientError("Invalid credentials");
	}
	if (err instanceof UserNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("User not found.");
	}
	if (err instanceof UserConflictError) {
		setResponseStatus(409);
		throw new ClientError("User already exists.");
	}
	if (err instanceof GroupMembershipError) {
		setResponseStatus(400);
		throw new ClientError("User is not a member of group.");
	}
	throw err;
});

export const listAdministratorRolesFn = createServerFn({ method: "GET" })
	.middleware([adminRole("base")])
	.handler(async () => listAdministratorRoles());

// Any authenticated user can see who else exists — the handles are already
// visible on samples, jobs, and analyses they can read.
export const listUsersFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.handler(async () => listUsers(db));

export const findUsersFn = createServerFn({ method: "GET" })
	.middleware([adminRole("users")])
	.validator(findUsersSchema)
	.handler(async ({ data }) => {
		return findUsers(db, {
			term: data?.term ?? "",
			page: data?.page ?? 1,
			perPage: data?.perPage ?? 25,
			administrator: data?.administrator,
			active: data?.active ?? true,
		});
	});

// A paginated user search any signed-in user may run, mirroring Python's
// `GET /users` (authenticated, no administrator filter). Backs the reference
// member picker, where a non-admin who holds `modify` on a reference searches
// users to add. `findUsersFn` above is the stricter administrator-only variant
// used by the user administration views.
export const searchUsersFn = createServerFn({ method: "GET" })
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
	.handler(async ({ context }) => getAccount(db, context.session.userId));

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
	.middleware([adminRole("users")])
	.validator(createUserSchema)
	.handler(async ({ data }) => {
		checkReservedHandle(data.handle);

		try {
			await checkConfiguredPasswordLength(db, data.password);

			const user = await createUser(db, {
				handle: data.handle,
				password: data.password,
				forceReset: data.forceReset,
			});
			setResponseStatus(201);
			return user;
		} catch (err) {
			throw rethrowAsHttp(err);
		}
	});

export const updateUserFn = createServerFn({ method: "POST" })
	.middleware([adminRole("users")])
	.validator(updateUserSchema)
	.handler(async ({ context, data }) => {
		// A policy states the floor. This one depends on the target row, so it can
		// only be checked here: editing a user who is themselves an administrator
		// requires the full role, mirroring the Python service.
		const targetRole = await getAdministratorRole(db, data.userId);
		if (targetRole !== null) {
			await requireAdminRole(context.session, "full");
		}

		const { userId, ...values } = data;
		if (values.handle !== undefined) {
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
		checkReservedHandle(data.handle);

		try {
			return await updateUser(db, context.session.userId, {
				handle: data.handle,
			});
		} catch (err) {
			throw rethrowAsHttp(err);
		}
	});

export const updateAccountEmailFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(accountEmailSchema)
	.handler(async ({ context, data }) => {
		checkEmail(data.email);

		try {
			return await updateAccountEmail(db, context.session.userId, data.email);
		} catch (err) {
			throw rethrowAsHttp(err);
		}
	});

export const changePasswordFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(changePasswordSchema)
	.handler(async ({ context, data }) => {
		try {
			await checkConfiguredPasswordLength(db, data.password);

			const { account, sessionId, token } = await changePassword(db, {
				userId: context.session.userId,
				oldPassword: data.oldPassword,
				password: data.password,
				ip: getClientIp(),
			});

			// The change revoked every session the user held, including the one that
			// authenticated this request. Handing back the replacement is what keeps
			// the browser signed in, the way Python's `AccountView.patch` does.
			realCookies.setSessionId(sessionId);
			realCookies.setSessionToken(token);

			return account;
		} catch (err) {
			throw rethrowAsHttp(err);
		}
	});

export const setAdministratorRoleFn = createServerFn({ method: "POST" })
	.middleware([adminRole("full")])
	.validator(setAdministratorRoleSchema)
	.handler(async ({ context, data }) => {
		if (context.session.userId === data.userId) {
			setResponseStatus(400);
			throw new ClientError("Cannot change own role");
		}

		try {
			return await setAdministratorRole(db, data.userId, data.role);
		} catch (err) {
			throw rethrowAsHttp(err);
		}
	});

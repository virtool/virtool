import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAdminRole } from "../auth/middleware";
import { PasswordTooShortError } from "../auth/passwordPolicy";
import { adminRole, authenticated } from "../auth/policy";
import { checkConfiguredPasswordLength } from "../auth/service";
import { db } from "../db/pg";
import { ClientError } from "../errors";
import { pageSchema, perPageSchema, rowIdSchema } from "../validation";
import {
	createUser as createUserImpl,
	findUsers as findUsersImpl,
	GroupMembershipError,
	getAccount as getAccountImpl,
	getAdministratorRole as getAdministratorRoleImpl,
	getUser as getUserImpl,
	listAdministratorRoles as listAdministratorRolesImpl,
	listUsers as listUsersImpl,
	setAdministratorRole as setAdministratorRoleImpl,
	UserConflictError,
	UserNotFoundError,
	updateUser as updateUserImpl,
} from "./data";

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
	force_reset: z.boolean().optional(),
	handle: z.string().trim().min(1).optional(),
	password: z.string().optional(),
	groups: z.array(rowIdSchema).optional(),
	primary_group: rowIdSchema.nullable().optional(),
});

const accountHandleSchema = z.object({
	handle: z.string().trim().min(1),
});

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
	.handler(async () => listAdministratorRolesImpl());

// Any authenticated user can see who else exists — the handles are already
// visible on samples, jobs, and analyses they can read.
export const listUsersFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.handler(async () => listUsersImpl(db));

export const findUsersFn = createServerFn({ method: "GET" })
	.middleware([adminRole("users")])
	.validator(findUsersSchema)
	.handler(async ({ data }) => {
		return findUsersImpl(db, {
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
		findUsersImpl(db, {
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
	.handler(async ({ context }) => getAccountImpl(db, context.session.userId));

export const getUserFn = createServerFn({ method: "GET" })
	.middleware([adminRole("users")])
	.validator(userIdSchema)
	.handler(async ({ data }) => {
		try {
			return await getUserImpl(db, data.userId);
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

			const user = await createUserImpl(db, {
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
		const targetRole = await getAdministratorRoleImpl(db, data.userId);
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
			return await updateUserImpl(db, userId, values);
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
			return await updateUserImpl(db, context.session.userId, {
				handle: data.handle,
			});
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
			return await setAdministratorRoleImpl(db, data.userId, data.role);
		} catch (err) {
			throw rethrowAsHttp(err);
		}
	});

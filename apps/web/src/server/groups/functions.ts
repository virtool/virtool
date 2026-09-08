import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { permissionsSchema } from "@virtool/contracts";
import {
	createGroup,
	deleteGroup,
	findGroups,
	GroupConflictError,
	GroupNotFoundError,
	getGroup,
	listGroups,
	updateGroup,
} from "@virtool/data/groups/data";
import { z } from "zod";
import { adminRole, authenticated } from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";
import { pageSchema, perPageSchema, rowIdSchema } from "../validation";

const groupIdSchema = z.object({
	groupId: rowIdSchema,
});

const findGroupsSchema = z
	.object({
		term: z.string().default(""),
		page: pageSchema,
		perPage: perPageSchema,
	})
	.optional();

const createGroupSchema = z.object({
	name: z.string().min(1),
});

const updateGroupSchema = groupIdSchema.extend({
	name: z.string().min(1).optional(),
	permissions: permissionsSchema.partial().optional(),
});

function rethrowAsHttp(err: unknown): never {
	if (err instanceof GroupNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Group not found.", 404);
	}
	if (err instanceof GroupConflictError) {
		setResponseStatus(409);
		throw new ClientError("Group name already exists.", 409);
	}
	throw err;
}

// Ordinary users need the group list to set sample rights and to pick a primary
// group, so the reads are open to any signed-in user.
export const listGroupsFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.handler(async () => listGroups(db));

export const findGroupsFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(findGroupsSchema)
	.handler(async ({ data }) =>
		findGroups(db, data?.term ?? "", data?.page ?? 1, data?.perPage ?? 25),
	);

export const getGroupFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(groupIdSchema)
	.handler(async ({ data }) => {
		try {
			return await getGroup(db, data.groupId);
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

// A group's permissions are unioned into every member's, so anyone who can
// write a group can grant themselves any permission. All three mutations are
// administrator-only.
export const createGroupFn = createServerFn({ method: "POST" })
	.middleware([adminRole("base")])
	.validator(createGroupSchema)
	.handler(async ({ data }) => {
		try {
			const group = await createGroup(db, data.name);
			setResponseStatus(201);
			return group;
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

export const updateGroupFn = createServerFn({ method: "POST" })
	.middleware([adminRole("base")])
	.validator(updateGroupSchema)
	.handler(async ({ data }) => {
		const { groupId, ...values } = data;
		try {
			return await updateGroup(db, groupId, values);
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

export const deleteGroupFn = createServerFn({ method: "POST" })
	.middleware([adminRole("base")])
	.validator(groupIdSchema)
	.handler(async ({ data }) => {
		try {
			await deleteGroup(db, data.groupId);
			return null;
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

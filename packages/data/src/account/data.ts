import { randomBytes } from "node:crypto";
import {
	type ApiKey,
	emptyPermissions,
	type Permissions,
} from "@virtool/contracts";
import { and, asc, eq, sql } from "drizzle-orm";
import { hashToken } from "../auth/tokens";
import type { Db } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { type ApiKeyRow, apiKeys as apiKeysTable } from "../db/schema/apiKeys";
import { AppError } from "../errors";

/** An API key paired with its raw secret, returned only once at creation. */
export type CreatedApiKey = {
	key: string;
	apiKey: ApiKey;
};

/** Thrown when a requested API key does not exist on the user's account. */
export class ApiKeyNotFoundError extends AppError {}

/**
 * Build the API-key representation from a stored row. Permissions are expanded
 * against `emptyPermissions()` so keys written by the legacy Python path —
 * which stored only the provided keys — still report every permission as an
 * explicit boolean, and the edit UI can offer the full checklist.
 */
function toApiKey(row: ApiKeyRow): ApiKey {
	return {
		id: row.id,
		createdAt: row.createdAt,
		name: row.name,
		permissions: { ...emptyPermissions(), ...row.permissions },
	};
}

function generateKey(): { raw: string; hashed: string } {
	const raw = randomBytes(32).toString("hex");
	return { raw, hashed: hashToken(raw) };
}

/** List the account's API keys with their stored permissions. */
export async function findApiKeys(db: Db, userId: number): Promise<ApiKey[]> {
	const rows = await db
		.select()
		.from(apiKeysTable)
		.where(eq(apiKeysTable.userId, userId))
		.orderBy(asc(apiKeysTable.id));

	return rows.map(toApiKey);
}

export async function createApiKey(
	db: Db,
	userId: number,
	values: { name: string; permissions: Partial<Permissions> },
): Promise<CreatedApiKey> {
	const { raw, hashed } = generateKey();

	const row = takeFirstOrThrow(
		await db
			.insert(apiKeysTable)
			.values({
				hashed,
				name: values.name,
				createdAt: new Date(),
				userId,
				permissions: { ...emptyPermissions(), ...values.permissions },
			})
			.returning(),
	);

	return { key: raw, apiKey: toApiKey(row) };
}

export async function updateApiKey(
	db: Db,
	userId: number,
	keyId: number,
	permissions: Partial<Permissions>,
): Promise<ApiKey> {
	// Merge the partial into the stored jsonb in a single statement; Postgres
	// does the merge server-side, so no prior read of the existing value.
	const [row] = await db
		.update(apiKeysTable)
		.set({
			permissions: sql`${apiKeysTable.permissions} || ${JSON.stringify(permissions)}::jsonb`,
		})
		.where(and(eq(apiKeysTable.id, keyId), eq(apiKeysTable.userId, userId)))
		.returning();

	if (!row) {
		throw new ApiKeyNotFoundError();
	}

	return toApiKey(row);
}

export async function deleteApiKey(
	db: Db,
	userId: number,
	keyId: number,
): Promise<void> {
	const [row] = await db
		.delete(apiKeysTable)
		.where(and(eq(apiKeysTable.id, keyId), eq(apiKeysTable.userId, userId)))
		.returning({ id: apiKeysTable.id });

	if (!row) {
		throw new ApiKeyNotFoundError();
	}
}

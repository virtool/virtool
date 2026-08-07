import type {
	Hmm,
	HmmMinimal,
	HmmSearchResult,
	HmmStatus,
	HmmStatusTask,
} from "@virtool/contracts";
import { and, asc, count, eq, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import {
	HMM_STATUS_ID,
	type HmmRelease,
	type HmmRow,
	type HmmUpdate,
	hmms,
	legacyHmmStatus,
} from "../db/schema/hmms";
import { tasks } from "../db/schema/tasks";
import { users } from "../db/schema/users";
import { AppError } from "../errors";

/** The task type the runner matches to run an HMM install. */
export const HMM_INSTALL_TASK_TYPE = "install_hmms";

const MANIFEST_URL = "https://www.virtool.ca/releases/hmms.json";

/**
 * The record returned when an install is started. Mirrors the GitHub releases
 * API payload shape (plus the appended install metadata), so it stays
 * snake_case rather than following this domain's camelCase convention.
 */
export type HmmInstalled = {
	body: string;
	created_at: string;
	filename: string;
	html_url: string;
	id: number;
	name: string;
	newer: boolean;
	published_at: string;
	ready: boolean;
	size: number;
	user: { id: number; handle: string };
};

/** Filters and pagination accepted by {@link findHmms}. */
export type FindHmmsOptions = {
	page: number;
	perPage: number;
	term: string;
};

/** Thrown when a requested HMM does not exist. */
export class HmmNotFoundError extends AppError {}

/** Thrown when the HMM status singleton row is absent. */
export class HmmStatusNotFoundError extends AppError {}

/** Thrown when an install is requested while another is still in progress. */
export class HmmInstallConflictError extends AppError {}

/** Thrown when the release manifest cannot be fetched or no release is available. */
export class HmmReleaseError extends AppError {}

function hmmMinimal(row: HmmRow): HmmMinimal {
	return {
		id: row.id,
		cluster: row.cluster,
		count: row.count,
		families: row.families,
		names: row.names,
	};
}

// Mirror of the Python `_compose_hmm_search_filter`: `names` is a JSONB array,
// so the match succeeds when any element contains the term. LIKE wildcards in
// the term are escaped so it matches literally.
function nameMatches(term: string) {
	const escaped = term
		.replace(/\\/g, "\\\\")
		.replace(/%/g, "\\%")
		.replace(/_/g, "\\_");
	const pattern = `%${escaped}%`;

	return sql`exists (select 1 from jsonb_array_elements_text(${hmms.names}) as element(value) where element.value ilike ${pattern})`;
}

async function readTask(db: Db, taskId: number): Promise<HmmStatusTask | null> {
	const [row] = await db
		.select({
			complete: tasks.complete,
			createdAt: tasks.created_at,
			error: tasks.error,
			id: tasks.id,
			progress: tasks.progress,
			step: tasks.step,
			type: tasks.type,
		})
		.from(tasks)
		.where(eq(tasks.id, taskId));

	if (!row) {
		return null;
	}

	return {
		complete: row.complete ?? false,
		createdAt: row.createdAt,
		error: row.error,
		id: row.id,
		progress: row.progress ?? 0,
		step: row.step ?? "",
		type: row.type,
	};
}

export async function getHmmStatus(db: Db): Promise<HmmStatus> {
	const [row] = await db
		.select()
		.from(legacyHmmStatus)
		.where(eq(legacyHmmStatus.id, HMM_STATUS_ID));

	if (!row) {
		throw new HmmStatusNotFoundError();
	}

	const task = row.task_id != null ? await readTask(db, row.task_id) : null;

	return {
		errors: row.errors ?? [],
		installed: row.installed ? { ready: Boolean(row.installed.ready) } : null,
		task,
	};
}

export async function findHmms(
	db: Db,
	{ page, perPage, term }: FindHmmsOptions,
): Promise<HmmSearchResult> {
	const notHidden = eq(hmms.hidden, false);
	const where = term ? and(notHidden, nameMatches(term)) : notHidden;

	const [totalRows, foundRows, rows, status] = await Promise.all([
		db.select({ value: count() }).from(hmms).where(notHidden),
		db.select({ value: count() }).from(hmms).where(where),
		db
			.select()
			.from(hmms)
			.where(where)
			.orderBy(asc(hmms.cluster), asc(hmms.id))
			.offset((page - 1) * perPage)
			.limit(perPage),
		getHmmStatus(db),
	]);

	const foundCount = takeFirstOrThrow(foundRows).value;

	return {
		items: rows.map(hmmMinimal),
		foundCount,
		page,
		pageCount: foundCount ? Math.ceil(foundCount / perPage) : 0,
		perPage,
		status,
		totalCount: takeFirstOrThrow(totalRows).value,
	};
}

export async function getHmm(db: Db, hmmId: number): Promise<Hmm> {
	const [row] = await db.select().from(hmms).where(eq(hmms.id, hmmId));

	if (!row) {
		throw new HmmNotFoundError();
	}

	return {
		...hmmMinimal(row),
		entries: row.entries,
		genera: row.genera,
		length: row.length,
		meanEntropy: row.mean_entropy,
		totalEntropy: row.total_entropy,
	};
}

/**
 * True when there is an update that has not finished installing.
 *
 * Pass `{ lock: true }` inside a transaction to take a `FOR UPDATE` row lock, so
 * a concurrent install serialises behind this read instead of racing the guard.
 */
export async function isInstallInProgress(
	db: DbOrTx,
	options: { lock?: boolean } = {},
): Promise<boolean> {
	const query = db
		.select({ updates: legacyHmmStatus.updates })
		.from(legacyHmmStatus)
		.where(eq(legacyHmmStatus.id, HMM_STATUS_ID));

	const [row] = await (options.lock ? query.for("update") : query);

	return Boolean(row?.updates?.some((update) => !update.ready));
}

// Mirrors the GitHub releases API payload shape, so it stays snake_case
// rather than following this domain's camelCase convention.
type ManifestRelease = {
	body: string;
	content_type: string;
	download_url: string;
	filename: string;
	html_url: string;
	id: number;
	name: string;
	published_at: string;
	size: number;
};

// Compare two `vX.Y.Z` release names numerically, mirroring the semver ordering
// Python applies with `VersionInfo.parse`. Missing components sort as 0.
function isNewer(candidate: string, current: string): boolean {
	const parse = (name: string) =>
		name
			.replace(/^v/, "")
			.split(".")
			.map((part) => Number.parseInt(part, 10) || 0);

	const a = parse(candidate);
	const b = parse(current);

	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		const left = a[i] ?? 0;
		const right = b[i] ?? 0;
		if (left !== right) {
			return left > right;
		}
	}

	return false;
}

// Mirror of the Python `format_hmm_release`: a release is "newer" when there is
// no stored release or nothing installed, or when it outranks the installed one.
function formatRelease(
	updated: ManifestRelease,
	release: HmmRelease | null,
	installed: HmmUpdate | null,
): Omit<HmmRelease, "retrieved_at"> {
	return {
		id: updated.id,
		name: updated.name,
		body: updated.body,
		filename: updated.filename,
		size: updated.size,
		html_url: updated.html_url,
		download_url: updated.download_url,
		published_at: updated.published_at,
		content_type: updated.content_type,
		newer:
			release == null ||
			installed == null ||
			isNewer(updated.name, installed.name),
	};
}

async function fetchManifestRelease(): Promise<ManifestRelease | null> {
	let response: Response;
	try {
		response = await fetch(MANIFEST_URL);
	} catch {
		throw new HmmReleaseError("Could not reach Virtool.ca");
	}

	if (response.status === 304) {
		return null;
	}

	if (response.status !== 200) {
		throw new HmmReleaseError("Release does not exist");
	}

	const manifest = (await response.json()) as {
		"virtool-hmm"?: ManifestRelease[];
	} | null;

	const releases = manifest?.["virtool-hmm"];

	return releases?.[0] ?? null;
}

async function upsertStatus(
	db: DbOrTx,
	values: {
		errors: string[];
		installed: HmmUpdate | null;
		release: HmmRelease | null;
	},
): Promise<void> {
	await db
		.insert(legacyHmmStatus)
		.values({ id: HMM_STATUS_ID, updates: [], ...values })
		.onConflictDoUpdate({
			target: legacyHmmStatus.id,
			set: values,
		});
}

/**
 * Refresh the stored HMM release from the www.virtool.ca manifest and return it.
 *
 * Mirrors the Python `fetch_and_update_release`: the latest manifest entry
 * replaces the stored release, `retrieved_at` is stamped, and the status
 * singleton is upserted. A fetch failure records the error on the status row
 * and rethrows.
 */
export async function fetchAndUpdateRelease(
	db: DbOrTx,
): Promise<HmmRelease | null> {
	const [status] = await db
		.select()
		.from(legacyHmmStatus)
		.where(eq(legacyHmmStatus.id, HMM_STATUS_ID));

	let release = status?.release ?? null;
	const installed = status?.installed ?? null;

	let updated: ManifestRelease | null;
	try {
		updated = await fetchManifestRelease();
	} catch (err) {
		const errors = err instanceof HmmReleaseError ? [err.message] : [];
		await upsertStatus(db, { errors, installed, release });
		throw err;
	}

	if (updated) {
		release = {
			...formatRelease(updated, release, installed),
			retrieved_at: "",
		};
	}

	if (release) {
		release = { ...release, retrieved_at: new Date().toISOString() };
	}

	await upsertStatus(db, { errors: [], installed, release });

	return release;
}

// Mirror of the Python `create_update_subdocument`: strip the transport-only
// fields off the release and stamp the install metadata.
function createUpdateSubdocument(
	release: HmmRelease,
	userId: number,
): HmmUpdate {
	const { content_type, download_url, retrieved_at, ...rest } = release;

	return {
		...rest,
		created_at: new Date().toISOString(),
		ready: false,
		user: { id: userId },
	};
}

/**
 * Point the status singleton at the new task and append the pending update.
 *
 * Returns the appended update subdocument so the caller can build the install
 * response.
 */
export async function attachInstallTask(
	db: DbOrTx,
	taskId: number,
	release: HmmRelease,
	userId: number,
): Promise<HmmUpdate> {
	const update = createUpdateSubdocument(release, userId);

	const [row] = await db
		.select({ updates: legacyHmmStatus.updates })
		.from(legacyHmmStatus)
		.where(eq(legacyHmmStatus.id, HMM_STATUS_ID));

	await db
		.update(legacyHmmStatus)
		.set({ task_id: taskId, updates: [...(row?.updates ?? []), update] })
		.where(eq(legacyHmmStatus.id, HMM_STATUS_ID));

	return update;
}

/** Read a user's handle for attaching to an install response. */
export async function getUserHandle(db: Db, userId: number): Promise<string> {
	const [row] = await db
		.select({ handle: users.handle })
		.from(users)
		.where(eq(users.id, userId));

	return row?.handle ?? "";
}

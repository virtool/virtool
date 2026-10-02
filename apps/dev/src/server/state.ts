import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
	checkAccountCredentials,
	DEFAULT_MINIMUM_PASSWORD_LENGTH,
} from "@virtool/contracts";
import type {
	DefaultAdministrator,
	DesiredState,
	Environment,
	OpenPullRequest,
	Operation,
} from "../shared/types.ts";
import { CONFIG_VERSION } from "./constants.ts";

/** Default administrator credentials, which the UI never receives. */
export type DefaultAdministratorCredentials = DefaultAdministrator & {
	password: string;
};

type WorktreeInput = {
	branch: string;
	id: string;
	path: string;
};

type EnvironmentRow = {
	branch: string;
	create_default_administrator: number | null;
	created_at: number | null;
	desired: DesiredState | null;
	environment_id: string | null;
	last_error: string | null;
	name: string | null;
	path: string;
	worktree_id: string;
	workflow_enabled: number | null;
};

type OperationRow = {
	action: Operation["action"];
	created_at: number;
	error: string | null;
	finished_at: number | null;
	id: number;
	progress: string;
	status: Operation["status"];
};

type DesiredEnvironmentRow = {
	createDefaultAdministrator: number;
	desired: DesiredState;
	generation: number;
	id: string;
	lastError: string | null;
	name: string;
	path: string;
	present: number;
	worktreeId: string;
};

function slugify(value: string): string {
	const slug = value
		.toLowerCase()
		.replace(/^refs\/heads\//, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 40);
	return slug || "detached";
}

function suffix(): string {
	return randomBytes(3).toString("hex");
}

export class StateStore {
	readonly database: DatabaseSync;
	readonly directory: string;
	readonly repositoryId: string;

	constructor(directory: string) {
		mkdirSync(directory, { recursive: true, mode: 0o700 });
		this.directory = directory;
		this.database = new DatabaseSync(join(directory, "state.sqlite"), {
			timeout: 5_000,
		});
		this.database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
		this.migrate();
		this.repositoryId = this.getOrCreateMeta("repository_id", randomUUID());
		this.getOrCreateMeta("workflow_concurrency", "1");
	}

	close(): void {
		this.database.close();
	}

	private migrate(): void {
		this.database.exec(`
			CREATE TABLE IF NOT EXISTS meta (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			) STRICT;
			CREATE TABLE IF NOT EXISTS worktrees (
				id TEXT PRIMARY KEY,
				path TEXT NOT NULL,
				branch TEXT NOT NULL,
				present INTEGER NOT NULL DEFAULT 1,
				updated_at INTEGER NOT NULL
			) STRICT;
			CREATE TABLE IF NOT EXISTS environments (
				id TEXT PRIMARY KEY,
				worktree_id TEXT NOT NULL UNIQUE REFERENCES worktrees(id),
				name TEXT NOT NULL UNIQUE,
				desired TEXT NOT NULL CHECK (desired IN ('up', 'stopped', 'absent')),
				created_at INTEGER NOT NULL,
				generation INTEGER NOT NULL DEFAULT 1,
				config_version INTEGER NOT NULL,
				last_error TEXT,
				cleanup_step TEXT,
				workflow_enabled INTEGER NOT NULL DEFAULT 1,
				create_default_administrator INTEGER NOT NULL DEFAULT 1
			) STRICT;
			CREATE TABLE IF NOT EXISTS operations (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				environment_id TEXT NOT NULL,
				action TEXT NOT NULL,
				status TEXT NOT NULL,
				progress TEXT NOT NULL,
				error TEXT,
				created_at INTEGER NOT NULL,
				finished_at INTEGER
			) STRICT;
			CREATE INDEX IF NOT EXISTS operations_environment
				ON operations(environment_id, id DESC);
		`);
		const schemaVersion = Number(this.getOrCreateMeta("schema_version", "1"));
		if (schemaVersion !== 1) {
			throw new Error(`Unsupported development state schema ${schemaVersion}`);
		}
		const environmentColumns = this.database
			.prepare("PRAGMA table_info(environments)")
			.all() as unknown as Array<{ name: string }>;
		for (const column of ["workflow_enabled", "create_default_administrator"]) {
			if (!environmentColumns.some(({ name }) => name === column)) {
				this.database.exec(
					`ALTER TABLE environments ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 1`,
				);
			}
		}
	}

	private getOrCreateMeta(key: string, fallback: string): string {
		this.database
			.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)")
			.run(key, fallback);
		const row = this.database
			.prepare("SELECT value FROM meta WHERE key = ?")
			.get(key) as { value: string };
		return row.value;
	}

	getMeta(key: string): string | null {
		const row = this.database
			.prepare("SELECT value FROM meta WHERE key = ?")
			.get(key) as { value: string } | undefined;
		return row?.value ?? null;
	}

	setMeta(key: string, value: string): void {
		this.database
			.prepare(
				"INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
			)
			.run(key, value);
	}

	synchronizeWorktrees(worktrees: WorktreeInput[]): void {
		const now = Date.now();
		this.database.exec("BEGIN IMMEDIATE");
		try {
			this.database.prepare("UPDATE worktrees SET present = 0").run();
			const statement = this.database.prepare(`
				INSERT INTO worktrees (id, path, branch, present, updated_at)
				VALUES (?, ?, ?, 1, ?)
				ON CONFLICT(id) DO UPDATE SET
					path = excluded.path,
					branch = excluded.branch,
					present = 1,
					updated_at = excluded.updated_at
			`);
			for (const worktree of worktrees) {
				statement.run(worktree.id, worktree.path, worktree.branch, now);
			}
			this.database.exec("COMMIT");
		} catch (error) {
			this.database.exec("ROLLBACK");
			throw error;
		}
	}

	/**
	 * Get the environment of a worktree, and create it when it does not exist.
	 *
	 * `createDefaultAdministrator` applies only when this call creates the environment.
	 */
	ensureEnvironment(
		worktreeId: string,
		createDefaultAdministrator = true,
	): string {
		const existing = this.database
			.prepare("SELECT id FROM environments WHERE worktree_id = ?")
			.get(worktreeId) as { id: string } | undefined;
		if (existing) {
			return existing.id;
		}
		const worktree = this.database
			.prepare("SELECT branch FROM worktrees WHERE id = ? AND present = 1")
			.get(worktreeId) as { branch: string } | undefined;
		if (!worktree) {
			throw new Error(`Unknown worktree ${worktreeId}`);
		}
		const id = randomUUID();
		const name = `${slugify(worktree.branch)}-${suffix()}`;
		this.database
			.prepare(`
				INSERT INTO environments
					(id, worktree_id, name, desired, created_at, config_version,
						create_default_administrator)
				VALUES (?, ?, ?, 'stopped', ?, ?, ?)
			`)
			.run(
				id,
				worktreeId,
				name,
				Date.now(),
				CONFIG_VERSION,
				createDefaultAdministrator ? 1 : 0,
			);
		return id;
	}

	setDesired(
		worktreeId: string,
		desired: DesiredState,
		createDefaultAdministrator = true,
	): string {
		const environmentId = this.ensureEnvironment(
			worktreeId,
			createDefaultAdministrator,
		);
		this.database
			.prepare(
				"UPDATE environments SET desired = ?, last_error = NULL WHERE id = ?",
			)
			.run(desired, environmentId);
		return environmentId;
	}

	retryEnvironment(worktreeId: string): string {
		const environment = this.database
			.prepare("SELECT id FROM environments WHERE worktree_id = ?")
			.get(worktreeId) as { id: string } | undefined;
		if (!environment) {
			throw new Error(`Worktree ${worktreeId} has no environment to retry`);
		}
		this.database
			.prepare("UPDATE environments SET last_error = NULL WHERE id = ?")
			.run(environment.id);
		return environment.id;
	}

	getDesiredEnvironments(): Array<{
		createDefaultAdministrator: boolean;
		desired: DesiredState;
		generation: number;
		id: string;
		lastError: string | null;
		name: string;
		path: string;
		present: boolean;
		worktreeId: string;
	}> {
		const rows = this.database
			.prepare(`
				SELECT e.id, e.name, e.desired, e.generation, e.last_error AS lastError,
					e.create_default_administrator AS createDefaultAdministrator,
					w.id AS worktreeId, w.path, w.present
				FROM environments e JOIN worktrees w ON w.id = e.worktree_id
				ORDER BY e.created_at
			`)
			.all() as unknown as DesiredEnvironmentRow[];
		return rows.map((row) => ({
			...row,
			createDefaultAdministrator: row.createDefaultAdministrator === 1,
			present: row.present === 1,
		}));
	}

	setDesiredByEnvironment(environmentId: string, desired: DesiredState): void {
		this.database
			.prepare(
				"UPDATE environments SET desired = ?, last_error = NULL WHERE id = ?",
			)
			.run(desired, environmentId);
	}

	getDesiredByEnvironment(environmentId: string): DesiredState | null {
		const row = this.database
			.prepare("SELECT desired FROM environments WHERE id = ?")
			.get(environmentId) as { desired: DesiredState } | undefined;
		return row?.desired ?? null;
	}

	setWorkflowsEnabled(worktreeId: string, enabled: boolean): void {
		const environmentId = this.ensureEnvironment(worktreeId);
		this.database
			.prepare("UPDATE environments SET workflow_enabled = ? WHERE id = ?")
			.run(enabled ? 1 : 0, environmentId);
	}

	startOperation(environmentId: string, action: Operation["action"]): number {
		const result = this.database
			.prepare(`
				INSERT INTO operations
					(environment_id, action, status, progress, created_at)
				VALUES (?, ?, 'pending', 'queued', ?)
			`)
			.run(environmentId, action, Date.now());
		this.database
			.prepare(`
			DELETE FROM operations WHERE id IN (
				SELECT id FROM operations ORDER BY id DESC LIMIT -1 OFFSET 200
			)
		`)
			.run();
		return Number(result.lastInsertRowid);
	}

	updateOperation(
		id: number,
		status: Operation["status"],
		progress: string,
		error: string | null = null,
	): void {
		const finishedAt =
			status === "failed" || status === "succeeded" ? Date.now() : null;
		this.database
			.prepare(`
				UPDATE operations SET status = ?, progress = ?, error = ?, finished_at = ?
				WHERE id = ?
			`)
			.run(status, progress, error, finishedAt, id);
	}

	failOperation(id: number, error: string): void {
		this.database
			.prepare(`
				UPDATE operations SET status = 'failed', error = ?, finished_at = ?
				WHERE id = ?
			`)
			.run(error, Date.now(), id);
	}

	setEnvironmentError(environmentId: string, error: string | null): void {
		this.database
			.prepare("UPDATE environments SET last_error = ? WHERE id = ?")
			.run(error, environmentId);
	}

	deleteEnvironment(environmentId: string): void {
		this.database.exec("BEGIN IMMEDIATE");
		try {
			this.database
				.prepare("DELETE FROM operations WHERE environment_id = ?")
				.run(environmentId);
			this.database
				.prepare("DELETE FROM environments WHERE id = ?")
				.run(environmentId);
			this.database.exec("COMMIT");
		} catch (error) {
			this.database.exec("ROLLBACK");
			throw error;
		}
	}

	listEnvironments(
		observed: Map<
			string,
			{
				ready: boolean;
				services: Environment["services"];
				state: Environment["observed"];
			}
		>,
		openPullRequests: Map<string, OpenPullRequest> = new Map(),
	): Environment[] {
		const rows = this.database
			.prepare(`
				SELECT w.id AS worktree_id, w.path, w.branch, e.id AS environment_id,
					e.name, e.desired, e.created_at, e.last_error, e.workflow_enabled,
					e.create_default_administrator
				FROM worktrees w LEFT JOIN environments e ON e.worktree_id = w.id
				WHERE w.present = 1 OR e.id IS NOT NULL
				ORDER BY w.path
			`)
			.all() as EnvironmentRow[];
		return rows.map((row) => {
			const current = row.environment_id
				? observed.get(row.environment_id)
				: undefined;
			const operation = row.environment_id
				? this.latestOperation(row.environment_id)
				: null;
			const inProgress =
				operation?.status === "pending" || operation?.status === "running";
			const observedState = inProgress
				? operation.action === "remove"
					? "removing"
					: operation.action === "start"
						? "starting"
						: "stopping"
				: row.last_error
					? "failed"
					: (current?.state ??
						(row.environment_id ? "stopped" : "not_created"));
			return {
				age: row.created_at,
				branch: row.branch,
				createDefaultAdministrator: row.create_default_administrator !== 0,
				desired: row.desired ?? "absent",
				id: row.environment_id,
				lastError: row.last_error,
				name: row.name,
				observed: observedState,
				openPullRequest: openPullRequests.get(row.branch) ?? null,
				operation,
				path: row.path,
				ready: current?.ready ?? false,
				services: current?.services ?? {},
				url: row.name ? `https://${row.name}.localhost:9443` : null,
				workflowEnabled: row.workflow_enabled === 1,
				worktreeId: row.worktree_id,
			};
		});
	}

	private latestOperation(environmentId: string): Operation | null {
		const row = this.database
			.prepare(`
				SELECT id, action, status, progress, error, created_at, finished_at
				FROM operations WHERE environment_id = ? ORDER BY id DESC LIMIT 1
			`)
			.get(environmentId) as OperationRow | undefined;
		return row
			? {
					action: row.action,
					createdAt: row.created_at,
					error: row.error,
					finishedAt: row.finished_at,
					id: row.id,
					progress: row.progress,
					status: row.status,
				}
			: null;
	}

	getWorkflowConcurrency(): number {
		return Number(this.getMeta("workflow_concurrency") ?? "1");
	}

	hasActiveOperations(): boolean {
		const row = this.database
			.prepare(
				"SELECT EXISTS(SELECT 1 FROM operations WHERE status IN ('pending', 'running')) AS active",
			)
			.get() as { active: number };
		return row.active === 1;
	}

	interruptActiveOperations(): void {
		this.database
			.prepare(`
				UPDATE operations
				SET status = 'failed', progress = 'interrupted',
					error = 'Daemon stopped before the operation completed',
					finished_at = ?
				WHERE status IN ('pending', 'running')
			`)
			.run(Date.now());
	}

	getDefaultAdministrator(): DefaultAdministrator | null {
		const credentials = this.getDefaultAdministratorCredentials();
		return credentials
			? { email: credentials.email, handle: credentials.handle }
			: null;
	}

	getDefaultAdministratorCredentials(): DefaultAdministratorCredentials | null {
		const handle = this.getMeta("default_administrator_handle");
		const email = this.getMeta("default_administrator_email");
		const password = this.getMeta("default_administrator_password");
		return handle && email && password ? { email, handle, password } : null;
	}

	/**
	 * Save the default administrator, keeping the saved password when `password` is empty.
	 *
	 * New environments have the default minimum password length, so the check
	 * uses that value.
	 */
	setDefaultAdministrator(input: {
		email: string;
		handle: string;
		password: string;
	}): void {
		const handle = input.handle.trim();
		const email = input.email.trim();
		const password =
			input.password || this.getMeta("default_administrator_password");
		if (!handle || !email || !password) {
			throw new Error("Handle, email, and password are required");
		}
		checkAccountCredentials(
			{ email, handle, password },
			DEFAULT_MINIMUM_PASSWORD_LENGTH,
		);
		this.database.exec("BEGIN IMMEDIATE");
		try {
			this.setMeta("default_administrator_handle", handle);
			this.setMeta("default_administrator_email", email);
			this.setMeta("default_administrator_password", password);
			this.database.exec("COMMIT");
		} catch (error) {
			this.database.exec("ROLLBACK");
			throw error;
		}
	}

	clearDefaultAdministrator(): void {
		this.database
			.prepare("DELETE FROM meta WHERE key IN (?, ?, ?)")
			.run(
				"default_administrator_email",
				"default_administrator_handle",
				"default_administrator_password",
			);
	}

	setWorkflowConcurrency(value: number): void {
		if (!Number.isInteger(value) || value < 1 || value > 32) {
			throw new Error("Workflow concurrency must be an integer from 1 to 32");
		}
		this.setMeta("workflow_concurrency", String(value));
	}
}

export { slugify };

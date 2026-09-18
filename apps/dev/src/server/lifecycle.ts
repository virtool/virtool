import { access, readFile, rm, stat, writeFile } from "node:fs/promises";
import { request } from "node:https";
import { dirname, join } from "node:path";
import type { DesiredState, Environment } from "../shared/types.ts";
import type { BuildCoordinator } from "./builds.ts";
import type { CommandRunner } from "./command.ts";
import { CONFIG_VERSION } from "./constants.ts";
import { DockerObserver } from "./docker.ts";
import { ensureEnvironmentFiles } from "./files.ts";
import { getRetryDelay } from "./retry.ts";
import type { StateStore } from "./state.ts";

type DesiredEnvironment = ReturnType<
	StateStore["getDesiredEnvironments"]
>[number];

function actionFor(desired: DesiredState): "remove" | "start" | "stop" {
	return desired === "up" ? "start" : desired === "stopped" ? "stop" : "remove";
}

/** Reconciles durable desired state with Docker Compose. */
export class Reconciler {
	private readonly active = new Map<string, Promise<void>>();
	private readonly observer: DockerObserver;
	private readonly removalAttempts = new Map<string, number>();
	private readonly retryAt = new Map<string, number>();
	private readonly restarts = new Set<string>();
	private timer: NodeJS.Timeout | undefined;
	private stopping = false;
	private tickPromise: Promise<void> | undefined;

	constructor(
		private readonly store: StateStore,
		private readonly run: CommandRunner,
		private readonly primaryWorktree: string,
		private readonly publish: () => void,
		private readonly builds: BuildCoordinator,
	) {
		this.observer = new DockerObserver(run);
	}

	start(): void {
		this.timer = setInterval(() => void this.runTick(), 1_000);
		void this.runTick();
	}

	async stop(): Promise<void> {
		this.stopping = true;
		if (this.timer) {
			clearInterval(this.timer);
		}
		await this.tickPromise;
		await Promise.all(this.active.values());
	}

	wake(): void {
		void this.runTick();
	}

	requestRestart(environmentId: string): void {
		this.restarts.add(environmentId);
		this.wake();
	}

	hasActiveWork(): boolean {
		return this.active.size > 0 || this.tickPromise !== undefined;
	}

	private async tick(): Promise<void> {
		if (this.stopping) {
			return;
		}
		for (const environment of this.store.getDesiredEnvironments()) {
			const canRetryRemoval =
				environment.desired === "absent" &&
				Date.now() >= (this.retryAt.get(environment.id) ?? 0);
			if (
				!this.active.has(environment.id) &&
				(!environment.lastError || canRetryRemoval)
			) {
				const promise = this.reconcile(environment)
					.catch((error) => {
						this.store.setEnvironmentError(
							environment.id,
							error instanceof Error ? error.message : String(error),
						);
						if (environment.desired === "absent") {
							const attempt = this.removalAttempts.get(environment.id) ?? 0;
							this.removalAttempts.set(environment.id, attempt + 1);
							this.retryAt.set(
								environment.id,
								Date.now() + getRetryDelay(attempt),
							);
						}
					})
					.finally(() => {
						this.active.delete(environment.id);
						this.publish();
					});
				this.active.set(environment.id, promise);
			}
		}
		this.publish();
	}

	private async runTick(): Promise<void> {
		if (this.tickPromise || this.stopping) {
			return this.tickPromise;
		}
		this.tickPromise = this.tick();
		try {
			await this.tickPromise;
		} finally {
			this.tickPromise = undefined;
		}
	}

	private async reconcile(environment: DesiredEnvironment): Promise<void> {
		if (!environment.present && environment.desired !== "absent") {
			await this.observer.validateProjectOwnership(
				this.environmentProject(environment.id),
				{
					environmentId: environment.id,
					generation: environment.generation,
					repositoryId: this.store.repositoryId,
				},
			);
			this.store.setDesiredByEnvironment(environment.id, "absent");
			environment.desired = "absent";
		}
		const files = await ensureEnvironmentFiles(this.store.directory, {
			environmentId: environment.id,
			name: environment.name,
			repositoryId: this.store.repositoryId,
			worktree: environment.path,
		});
		const project = this.environmentProject(environment.id);
		const observed = await this.observer.inspectEnvironment(
			project,
			files.composeFile,
			this.primaryWorktree,
		);
		if (
			(environment.desired === "up" && observed.ready) ||
			(environment.desired === "stopped" &&
				["stopped", "missing"].includes(observed.state))
		) {
			if (!this.restarts.has(environment.id)) {
				return;
			}
		}
		const operationId = this.store.startOperation(
			environment.id,
			actionFor(environment.desired),
		);
		this.publish();
		try {
			if (environment.desired === "up") {
				if (this.restarts.has(environment.id)) {
					this.store.updateOperation(
						operationId,
						"running",
						"restarting services",
					);
					await this.compose(environment, files.envFile, files.composeFile, [
						"--profile",
						"workflow",
						"stop",
					]);
				}
				await this.startEnvironment(
					environment,
					files.envFile,
					files.composeFile,
					operationId,
				);
			} else if (environment.desired === "stopped") {
				await this.compose(environment, files.envFile, files.composeFile, [
					"--profile",
					"workflow",
					"stop",
				]);
			} else {
				await this.removeEnvironment(
					environment,
					files.envFile,
					files.composeFile,
					operationId,
				);
			}
			this.store.updateOperation(operationId, "succeeded", "complete");
			this.store.setEnvironmentError(environment.id, null);
			this.removalAttempts.delete(environment.id);
			this.retryAt.delete(environment.id);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.store.updateOperation(operationId, "failed", "failed", message);
			this.store.setEnvironmentError(environment.id, message);
			if (environment.desired === "absent") {
				const attempt = this.removalAttempts.get(environment.id) ?? 0;
				this.removalAttempts.set(environment.id, attempt + 1);
				this.retryAt.set(environment.id, Date.now() + getRetryDelay(attempt));
			}
		} finally {
			this.restarts.delete(environment.id);
		}
	}

	private async checkConfigVersion(worktree: string): Promise<void> {
		const value = Number(
			(await readFile(join(worktree, "dev/version"), "utf8")).trim(),
		);
		if (value !== CONFIG_VERSION) {
			throw new Error(
				`Worktree development config version ${value} is incompatible with daemon version ${CONFIG_VERSION}`,
			);
		}
	}

	private async ensureShared(): Promise<void> {
		const project = this.sharedProject();
		const file = join(this.primaryWorktree, "dev/shared.compose.yaml");
		const initialized = this.store.getMeta("shared_initialized") === "true";
		if (initialized) {
			for (const volume of ["postgres", "azurite", "caddy-data"]) {
				try {
					await this.run("docker", [
						"volume",
						"inspect",
						`virtool-dev-${this.store.repositoryId}-${volume}`,
					]);
				} catch {
					throw new Error(
						`Shared ${volume} storage is missing; use the confirmed shared reset action`,
					);
				}
			}
		}
		await this.run(
			"docker",
			[
				"compose",
				"--project-name",
				project,
				"--file",
				file,
				"up",
				"--detach",
				"--wait",
				"--wait-timeout",
				"60",
			],
			{ cwd: this.primaryWorktree, env: this.sharedEnvironment() },
		);
		for (let attempt = 0; attempt < 20; attempt += 1) {
			try {
				await this.run(
					"docker",
					[
						"compose",
						"--project-name",
						project,
						"--file",
						file,
						"cp",
						"caddy:/data/caddy/pki/authorities/local/root.crt",
						join(this.store.directory, "root.crt"),
					],
					{ cwd: this.primaryWorktree, env: this.sharedEnvironment() },
				);
				break;
			} catch {
				if (attempt === 19) {
					throw new Error(
						"Shared HTTPS gateway did not publish its CA certificate",
					);
				}
				await new Promise((resolve) => setTimeout(resolve, 250));
			}
		}
		this.store.setMeta("shared_initialized", "true");
	}

	private async startEnvironment(
		environment: DesiredEnvironment,
		envFile: string,
		composeFile: string,
		operationId: number,
	): Promise<void> {
		this.store.updateOperation(
			operationId,
			"running",
			"checking configuration",
		);
		await this.checkConfigVersion(environment.path);
		if (!this.isStillDesired(environment.id, "up")) {
			return;
		}
		this.store.updateOperation(
			operationId,
			"running",
			"starting shared infrastructure",
		);
		await this.ensureShared();
		if (!this.isStillDesired(environment.id, "up")) {
			return;
		}
		this.store.updateOperation(
			operationId,
			"running",
			"rendering configuration",
		);
		const source = join(environment.path, "dev/compose.yaml");
		const rendered = await this.run(
			"docker",
			[
				"compose",
				"--env-file",
				envFile,
				"--project-name",
				this.environmentProject(environment.id),
				"--file",
				source,
				"--profile",
				"workflow",
				"config",
			],
			{ cwd: environment.path },
		);
		await writeFile(composeFile, rendered.stdout);
		this.store.updateOperation(
			operationId,
			"running",
			"initializing database and storage",
		);
		const worktreeOwner = await stat(environment.path);
		await rm(join(dirname(composeFile), "postgres-url"), { force: true });
		await this.compose(environment, envFile, composeFile, [
			"run",
			"--rm",
			"--user",
			`${worktreeOwner.uid}:${worktreeOwner.gid}`,
			"database-init",
		]);
		await this.compose(environment, envFile, composeFile, [
			"run",
			"--rm",
			"storage-init",
		]);
		if (!this.isStillDesired(environment.id, "up")) {
			return;
		}
		this.store.updateOperation(operationId, "running", "building core image");
		await this.builds.run("core", () =>
			this.compose(environment, envFile, composeFile, [
				"build",
				"migration",
				"jobs-api",
				"tasks",
				"web",
			]),
		);
		if (!this.isStillDesired(environment.id, "up")) {
			return;
		}
		this.store.updateOperation(operationId, "running", "running migrations");
		await this.compose(environment, envFile, composeFile, [
			"run",
			"--rm",
			"migration",
		]);
		if (!this.isStillDesired(environment.id, "up")) {
			return;
		}
		this.store.updateOperation(operationId, "running", "starting services");
		await this.compose(environment, envFile, composeFile, [
			"up",
			"--detach",
			"jobs-api",
			"tasks",
			"web",
		]);
		this.store.updateOperation(
			operationId,
			"running",
			"checking HTTPS readiness",
		);
		await this.checkReadiness(environment.name);
	}

	private isStillDesired(
		environmentId: string,
		desired: DesiredState,
	): boolean {
		return this.store.getDesiredByEnvironment(environmentId) === desired;
	}

	private async checkReadiness(name: string): Promise<void> {
		const ca = await readFile(join(this.store.directory, "root.crt"));
		for (let attempt = 0; attempt < 60; attempt += 1) {
			const ready = await new Promise<boolean>((resolve) => {
				const check = request(
					{
						ca,
						headers: { host: `${name}.localhost:9443` },
						hostname: "127.0.0.1",
						method: "GET",
						path: "/health/ready",
						port: 9443,
						servername: `${name}.localhost`,
						timeout: 1_000,
					},
					(response) => {
						response.resume();
						resolve(response.statusCode === 200);
					},
				);
				check.once("error", () => resolve(false));
				check.once("timeout", () => {
					check.destroy();
					resolve(false);
				});
				check.end();
			});
			if (ready) {
				return;
			}
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
		throw new Error(`Environment ${name} did not become ready over HTTPS`);
	}

	private async removeEnvironment(
		environment: DesiredEnvironment,
		envFile: string,
		composeFile: string,
		operationId: number,
	): Promise<void> {
		try {
			await access(composeFile);
		} catch {
			await rm(join(this.store.directory, "environments", environment.id), {
				force: true,
				recursive: true,
			});
			this.store.deleteEnvironment(environment.id);
			return;
		}
		await this.observer.validateProjectOwnership(
			this.environmentProject(environment.id),
			{
				environmentId: environment.id,
				generation: environment.generation,
				repositoryId: this.store.repositoryId,
			},
		);
		this.store.updateOperation(operationId, "running", "stopping writers");
		await this.compose(environment, envFile, composeFile, [
			"--profile",
			"workflow",
			"stop",
		]);
		this.store.updateOperation(
			operationId,
			"running",
			"deleting database and blobs",
		);
		const cleanup = await Promise.allSettled([
			this.compose(environment, envFile, composeFile, [
				"run",
				"--rm",
				"cleanup-database",
			]),
			this.compose(environment, envFile, composeFile, [
				"run",
				"--rm",
				"cleanup-storage",
			]),
		]);
		const failure = cleanup.find((result) => result.status === "rejected");
		if (failure?.status === "rejected") {
			throw failure.reason;
		}
		this.store.updateOperation(
			operationId,
			"running",
			"deleting Docker resources",
		);
		await this.compose(environment, envFile, composeFile, [
			"--profile",
			"workflow",
			"down",
			"--volumes",
			"--remove-orphans",
		]);
		await rm(join(this.store.directory, "environments", environment.id), {
			force: true,
			recursive: true,
		});
		this.store.deleteEnvironment(environment.id);
	}

	private async compose(
		environment: DesiredEnvironment,
		envFile: string,
		composeFile: string,
		args: string[],
	): Promise<void> {
		await this.run(
			"docker",
			[
				"compose",
				"--env-file",
				envFile,
				"--project-name",
				this.environmentProject(environment.id),
				"--file",
				composeFile,
				...args,
			],
			{ cwd: this.primaryWorktree },
		);
	}

	private sharedEnvironment(): NodeJS.ProcessEnv {
		return {
			...process.env,
			VT_DEV_REPOSITORY_ID: this.store.repositoryId,
			VT_DEV_STATE_DIR: this.store.directory,
		};
	}

	private sharedProject(): string {
		return `virtool-dev-${this.store.repositoryId.slice(0, 8)}-shared`;
	}

	private environmentProject(environmentId: string): string {
		return `virtool-dev-${this.store.repositoryId.slice(0, 8)}-${environmentId.slice(0, 8)}`;
	}

	async observe(): Promise<
		Map<
			string,
			{
				ready: boolean;
				services: Environment["services"];
				state: Environment["observed"];
			}
		>
	> {
		const result = new Map<
			string,
			{
				ready: boolean;
				services: Environment["services"];
				state: Environment["observed"];
			}
		>();
		await Promise.all(
			this.store.getDesiredEnvironments().map(async (environment) => {
				const composeFile = join(
					this.store.directory,
					"environments",
					environment.id,
					"compose.yaml",
				);
				result.set(
					environment.id,
					await this.observer.inspectEnvironment(
						this.environmentProject(environment.id),
						composeFile,
						this.primaryWorktree,
					),
				);
			}),
		);
		return result;
	}

	async inspectShared() {
		return this.observer.inspectShared(
			this.sharedProject(),
			join(this.primaryWorktree, "dev/shared.compose.yaml"),
			this.primaryWorktree,
			this.sharedEnvironment(),
		);
	}

	async resetShared(): Promise<void> {
		await this.run(
			"docker",
			[
				"compose",
				"--project-name",
				this.sharedProject(),
				"--file",
				join(this.primaryWorktree, "dev/shared.compose.yaml"),
				"down",
				"--volumes",
			],
			{ cwd: this.primaryWorktree, env: this.sharedEnvironment() },
		);
		this.store.setMeta("shared_initialized", "false");
	}
}

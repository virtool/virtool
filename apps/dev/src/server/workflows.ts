import { join } from "node:path";
import type { Logger } from "@virtool/logger";
import type { Environment, SchedulerState, Workflow } from "../shared/types.ts";
import type { BuildCoordinator } from "./builds.ts";
import type { CommandRunner } from "./command.ts";
import { WORKFLOWS } from "./constants.ts";
import { FairScheduler, type QueueCandidate } from "./scheduler.ts";
import type { StateStore } from "./state.ts";

const SERVICE: Record<Workflow, string> = {
	create_sample: "workflow-create-sample",
	create_subtraction: "workflow-create-subtraction",
	nuvs: "workflow-nuvs",
	pathoscope: "workflow-pathoscope",
};

type Executor = { environmentId: string; workflow: Workflow };

export class WorkflowCoordinator {
	private active: Executor[] = [];
	private buildQueue: SchedulerState["buildQueue"] = [];
	private errors: SchedulerState["errors"] = {};
	private lastError: string | null = null;
	private queues: SchedulerState["queues"] = {};
	private tickPromise: Promise<void> | undefined;
	private readonly fair = new FairScheduler();

	constructor(
		private readonly store: StateStore,
		private readonly run: CommandRunner,
		private readonly primaryWorktree: string,
		private readonly publish: () => void,
		private readonly builds: BuildCoordinator,
		private readonly logger: Logger,
	) {}

	getState(): SchedulerState {
		const concurrency = this.store.getWorkflowConcurrency();
		return {
			active: this.active,
			buildQueue: this.buildQueue,
			capacity: Math.max(0, concurrency - this.active.length),
			concurrency,
			errors: this.errors,
			lastError: this.lastError,
			queues: this.queues,
		};
	}

	async tick(environments: Environment[], launchEnabled = true): Promise<void> {
		if (this.tickPromise) {
			return this.tickPromise;
		}
		this.tickPromise = this.runTick(environments, launchEnabled);
		try {
			await this.tickPromise;
		} finally {
			this.tickPromise = undefined;
		}
	}

	async stop(): Promise<void> {
		await this.tickPromise;
	}

	private async runTick(
		environments: Environment[],
		launchEnabled: boolean,
	): Promise<void> {
		try {
			this.active = await this.discoverExecutors();
			const ready = environments.filter(
				(environment): environment is Environment & { id: string } =>
					Boolean(
						launchEnabled &&
							environment.id &&
							environment.ready &&
							environment.desired === "up" &&
							environment.workflowEnabled,
					),
			);
			const errors: SchedulerState["errors"] = {};
			const candidates: QueueCandidate[] = [];
			const queues: SchedulerState["queues"] = {};
			await Promise.all(
				ready.map(async ({ id: environmentId }) => {
					try {
						queues[environmentId] = await this.readCounts(environmentId);
					} catch (error) {
						errors[environmentId] = this.recordFailure(
							environmentId,
							error,
							"could not read workflow job counts",
						);
					}
				}),
			);
			for (const { id: environmentId } of ready) {
				const pending = queues[environmentId];
				if (!pending) {
					continue;
				}
				for (const workflow of WORKFLOWS) {
					candidates.push({
						environmentId,
						pending: pending[workflow] ?? 0,
						workflow,
					});
				}
			}
			this.queues = queues;
			const capacity = Math.max(
				0,
				this.store.getWorkflowConcurrency() - this.active.length,
			);
			for (const candidate of this.fair.select(candidates, capacity)) {
				try {
					await this.launch(candidate);
				} catch (error) {
					errors[candidate.environmentId] = this.recordFailure(
						candidate.environmentId,
						error,
						"could not launch workflow executor",
					);
				}
			}
			this.errors = errors;
			this.lastError = null;
		} catch (error) {
			this.buildQueue = [];
			this.lastError = error instanceof Error ? error.message : String(error);
			this.logger.error({ err: error }, "workflow scheduler tick failed");
		} finally {
			this.publish();
		}
	}

	private recordFailure(
		environmentId: string,
		error: unknown,
		message: string,
	): string {
		const reason = error instanceof Error ? error.message : String(error);
		this.logger.warn({ environmentId, reason }, message);
		return reason;
	}

	private async discoverExecutors(): Promise<Executor[]> {
		const { stdout } = await this.run("docker", [
			"ps",
			"--filter",
			`label=ca.virtool.dev.repository=${this.store.repositoryId}`,
			"--filter",
			"label=ca.virtool.dev.role=executor",
			"--format",
			'{{.Label "ca.virtool.dev.environment"}}|{{.Label "ca.virtool.dev.workflow"}}',
		]);
		return stdout
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				const [environmentId, workflow] = line.split("|");
				return {
					environmentId: environmentId as string,
					workflow: workflow as Workflow,
				};
			});
	}

	private async readCounts(
		environmentId: string,
	): Promise<Partial<Record<Workflow, number>>> {
		const { stdout } = await this.run("docker", [
			"exec",
			`${this.project(environmentId)}-jobs-api-1`,
			"node",
			"-e",
			"fetch('http://127.0.0.1:9950/jobs/counts').then(r=>{if(!r.ok)throw Error(String(r.status));return r.text()}).then(console.log)",
		]);
		const counts = JSON.parse(stdout.trim()) as {
			pending: Partial<Record<Workflow, number>>;
		};
		return counts.pending;
	}

	private async launch(candidate: QueueCandidate): Promise<void> {
		this.buildQueue = [
			{ environmentId: candidate.environmentId, workflow: candidate.workflow },
		];
		this.publish();
		try {
			await this.builds.run("workflow", () =>
				this.compose(candidate.environmentId, [
					"--profile",
					"workflow",
					"build",
					SERVICE[candidate.workflow],
				]),
			);
		} finally {
			this.buildQueue = [];
		}
		await this.compose(candidate.environmentId, [
			"--profile",
			"workflow",
			"run",
			"--detach",
			"--rm",
			"--no-deps",
			SERVICE[candidate.workflow],
		]);
		this.active.push({
			environmentId: candidate.environmentId,
			workflow: candidate.workflow,
		});
	}

	private compose(environmentId: string, args: string[]) {
		const directory = join(this.store.directory, "environments", environmentId);
		return this.run(
			"docker",
			[
				"compose",
				"--env-file",
				join(directory, "environment.env"),
				"--project-name",
				this.project(environmentId),
				"--file",
				join(directory, "compose.yaml"),
				...args,
			],
			{ cwd: this.primaryWorktree },
		);
	}

	private project(environmentId: string): string {
		return `virtool-dev-${this.store.repositoryId.slice(0, 8)}-${environmentId.slice(0, 8)}`;
	}
}

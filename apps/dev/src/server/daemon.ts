import { createHash } from "node:crypto";
import { readdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { getRequestListener } from "@hono/node-server";
import { createLogger } from "@virtool/logger";
import type { Mutation, OpenPullRequest, Snapshot } from "../shared/types.ts";
import { createApi, SnapshotFeed } from "./api.ts";
import { BuildCoordinator } from "./builds.ts";
import { ensureClientBuild } from "./client-build.ts";
import type { CommandRunner } from "./command.ts";
import { runCommand } from "./command.ts";
import { PROTOCOL_VERSION } from "./constants.ts";
import { DockerEvents } from "./events.ts";
import {
	discoverWorktrees,
	getOpenPullRequests,
	resolveRepository,
} from "./git.ts";
import { Reconciler } from "./lifecycle.ts";
import { checkPortAvailable } from "./port.ts";
import { getDaemonServiceName } from "./service.ts";
import {
	type ControlRequest,
	createControlServer,
	listenOnUnixSocket,
} from "./socket.ts";
import { StateStore } from "./state.ts";
import { WorkflowCoordinator } from "./workflows.ts";

async function hashDirectory(path: string): Promise<string> {
	const hash = createHash("sha256");
	async function visit(directory: string): Promise<void> {
		const entries = await readdir(directory, { withFileTypes: true });
		for (const entry of entries.sort((left, right) =>
			left.name.localeCompare(right.name),
		)) {
			if (entry.name === "dist" || entry.name === "node_modules") {
				continue;
			}
			const child = join(directory, entry.name);
			if (entry.isDirectory()) {
				await visit(child);
			} else if (entry.isFile()) {
				hash.update(child.slice(path.length));
				hash.update(await readFile(child));
			}
		}
	}
	await visit(path);
	return hash.digest("hex");
}

function emptySnapshot(repositoryId: string, concurrency: number): Snapshot {
	return {
		environments: [],
		repositoryId,
		scheduler: {
			active: [],
			buildQueue: [],
			capacity: concurrency,
			concurrency,
			lastError: null,
			queues: {},
		},
		shared: {
			initialized: false,
			lastError: null,
			services: {},
			storage: { azurite: null, postgres: null },
		},
		updatedAt: Date.now(),
		updateAvailable: false,
	};
}

/** Start the repository-scoped coordinator until it receives shutdown. */
export async function runDaemon(
	cwd: string,
	socketPath: string,
	run: CommandRunner = runCommand,
): Promise<"restart" | "shutdown"> {
	const repository = await resolveRepository(run, cwd);
	const store = new StateStore(repository.stateDirectory);
	store.interruptActiveOperations();
	store.setMeta("protocol_version", String(PROTOCOL_VERSION));
	if (store.getMeta("shared_initialized") !== "true") {
		await checkPortAvailable(9443);
	}
	const primaryHash = await hashDirectory(
		join(repository.primaryWorktree, "apps/dev"),
	);
	const clientDirectory = join(
		repository.primaryWorktree,
		"apps/dev/dist/client",
	);
	await ensureClientBuild(
		repository.primaryWorktree,
		clientDirectory,
		store.getMeta("client_hash"),
		primaryHash,
		run,
	);
	store.setMeta("client_hash", primaryHash);
	store.setMeta("daemon_hash", primaryHash);
	const feed = new SnapshotFeed(
		emptySnapshot(store.repositoryId, store.getWorkflowConcurrency()),
	);
	const builds = new BuildCoordinator();
	const logger = createLogger({ name: "dev" });
	let refreshPromise: Promise<void> | undefined;
	let openPullRequests = new Map<string, OpenPullRequest>();
	let pullRequestRefreshPromise: Promise<void> | undefined;
	let nextPullRequestRefresh = 0;
	let sharedReconciled = false;
	let sharedRetryAt = 0;
	let restartRequested = false;
	let shuttingDown = false;
	let shutdownResolve: (() => void) | undefined;
	const shutdown = new Promise<void>((resolve) => {
		shutdownResolve = resolve;
	});

	function requestRefresh(): void {
		if (!shuttingDown) {
			void refresh().catch(() => undefined);
		}
	}

	function refreshPullRequests(): void {
		if (pullRequestRefreshPromise || Date.now() < nextPullRequestRefresh) {
			return;
		}
		nextPullRequestRefresh = Date.now() + 60_000;
		pullRequestRefreshPromise = getOpenPullRequests(
			run,
			repository.primaryWorktree,
		)
			.then((result) => {
				openPullRequests = result;
				requestRefresh();
			})
			.finally(() => {
				pullRequestRefreshPromise = undefined;
			});
	}

	function reconcileSharedServices(): void {
		if (
			sharedReconciled ||
			store.getMeta("shared_initialized") !== "true" ||
			Date.now() < sharedRetryAt
		) {
			return;
		}
		sharedRetryAt = Date.now() + 30_000;
		void reconciler
			.ensureShared()
			.then(() => {
				sharedReconciled = true;
				requestRefresh();
			})
			.catch((error) => {
				logger.error({ err: error }, "shared service reconciliation failed");
			});
	}

	const reconciler = new Reconciler(
		store,
		run,
		repository.primaryWorktree,
		requestRefresh,
		builds,
	);
	const workflows = new WorkflowCoordinator(
		store,
		run,
		repository.primaryWorktree,
		requestRefresh,
		builds,
		logger,
	);
	const dockerEvents = new DockerEvents(store.repositoryId, requestRefresh);

	async function refresh(): Promise<void> {
		if (refreshPromise) {
			return refreshPromise;
		}
		refreshPullRequests();
		reconcileSharedServices();
		refreshPromise = (async () => {
			try {
				const worktrees = await discoverWorktrees(
					run,
					repository.primaryWorktree,
				);
				store.synchronizeWorktrees(worktrees);
				const [observed, shared, currentHash] = await Promise.all([
					reconciler.observe(),
					reconciler.inspectShared(),
					hashDirectory(join(repository.primaryWorktree, "apps/dev")),
				]);
				const environments = store.listEnvironments(observed, openPullRequests);
				const updateAvailable = currentHash !== primaryHash;
				feed.set({
					...feed.get(),
					environments,
					scheduler: workflows.getState(),
					shared,
					updatedAt: Date.now(),
					updateAvailable,
				});
				void workflows.tick(environments, !updateAvailable);
				if (
					updateAvailable &&
					!store.hasActiveOperations() &&
					!reconciler.hasActiveWork() &&
					workflows.getState().active.length === 0
				) {
					restartRequested = true;
					shuttingDown = true;
					shutdownResolve?.();
				}
			} finally {
				refreshPromise = undefined;
			}
		})();
		return refreshPromise;
	}

	function mutate(mutation: Mutation): void {
		if (
			mutation.action === "enable_workflows" ||
			mutation.action === "disable_workflows"
		) {
			for (const worktreeId of mutation.worktreeIds) {
				store.setWorkflowsEnabled(
					worktreeId,
					mutation.action === "enable_workflows",
				);
			}
			void refresh().catch(() => undefined);
			return;
		}
		for (const worktreeId of mutation.worktreeIds) {
			const environmentId =
				mutation.action === "retry"
					? store.retryEnvironment(worktreeId)
					: store.setDesired(
							worktreeId,
							mutation.action === "remove"
								? "absent"
								: mutation.action === "stop"
									? "stopped"
									: "up",
						);
			if (mutation.action === "restart") {
				reconciler.requestRestart(environmentId);
			}
		}
		reconciler.wake();
		void refresh().catch(() => undefined);
	}

	async function control(request: ControlRequest): Promise<unknown> {
		if (request.command === "shutdown") {
			shuttingDown = true;
			shutdownResolve?.();
			return { accepted: true };
		}
		if (request.command === "list") {
			return feed.get();
		}
		const target = request.worktree ?? cwd;
		const environment = feed
			.get()
			.environments.find((candidate) => candidate.path === target);
		if (!environment) {
			throw new Error(`Worktree is not registered: ${target}`);
		}
		mutate({
			action: request.command === "up" ? "start" : request.command,
			worktreeIds: [environment.worktreeId],
		});
		return { accepted: true, url: "https://dev.localhost:9443" };
	}

	await refresh();
	const app = createApi(
		feed,
		mutate,
		(value) => {
			store.setWorkflowConcurrency(value);
			void refresh().catch(() => undefined);
		},
		clientDirectory,
		() => reconciler.resetShared(),
		async () => {
			const { stdout } = await run(
				"journalctl",
				[
					"--user",
					"--unit",
					getDaemonServiceName(store.repositoryId),
					"--lines",
					"200",
					"--no-pager",
					"--output",
					"cat",
				],
				{ cwd: repository.primaryWorktree },
			);
			return stdout;
		},
		async (environmentId, service) => {
			const directory = join(
				repository.stateDirectory,
				"environments",
				environmentId,
			);
			const { stdout } = await run(
				"docker",
				[
					"compose",
					"--env-file",
					join(directory, "environment.env"),
					"--project-name",
					`virtool-dev-${store.repositoryId.slice(0, 8)}-${environmentId.slice(0, 8)}`,
					"--file",
					join(directory, "compose.yaml"),
					"logs",
					"--no-color",
					"--tail",
					"200",
					...(service ? [service] : []),
				],
				{ cwd: repository.primaryWorktree },
			);
			return stdout;
		},
	);
	const httpSocketPath = join(repository.stateDirectory, "http.sock");
	const http = createServer(getRequestListener(app.fetch));
	await listenOnUnixSocket(http, httpSocketPath);
	const controlServer = await createControlServer(socketPath, control);
	const discovery = setInterval(
		() => void refresh().catch(() => undefined),
		5_000,
	);
	dockerEvents.start();
	reconciler.start();
	for (const signal of ["SIGINT", "SIGTERM"] as const) {
		process.once(signal, () => {
			shuttingDown = true;
			shutdownResolve?.();
		});
	}
	await shutdown;
	shuttingDown = true;
	clearInterval(discovery);
	dockerEvents.stop();
	const httpClosed = new Promise<void>((resolve) =>
		http.close(() => resolve()),
	);
	http.closeAllConnections();
	await Promise.all([
		httpClosed,
		new Promise<void>((resolve) => controlServer.close(() => resolve())),
	]);
	await reconciler.stop();
	await refreshPromise;
	await workflows.stop();
	await Promise.all([
		rm(socketPath, { force: true }),
		rm(httpSocketPath, { force: true }),
	]);
	store.close();
	return restartRequested ? "restart" : "shutdown";
}

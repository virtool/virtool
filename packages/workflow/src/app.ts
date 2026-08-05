import { hostname } from "node:os";
import * as Sentry from "@sentry/node";
import { createLogger, type Logger } from "@virtool/logger";
import { getCommonOptions } from "@virtool/sentry";
import { createJobsApiClient } from "./client/client";
import type { WorkflowRunConfig } from "./config";
import { createWorkflowContext } from "./context";
import { claimJob } from "./lifecycle/claim";
import { startPingLoop } from "./lifecycle/ping";
import { createRunSignals, type RunSignals, runWorkflow } from "./run";
import type { Workflow } from "./step";
import { createRunSubprocess } from "./subprocess/execa";
import { createWorkPath } from "./workPath";

/**
 * Exit codes a workflow pod reports.
 *
 * A workflow that failed exits **0**: failure is a transition the jobs API
 * owns, and a non-zero exit makes the `ScaledJob` retry the pod, which is not
 * wanted. Only a genuinely broken pod exits 1, and only an intentional
 * termination exits 124 — the code the orchestrator distinguishes.
 */
export const EXIT_OK = 0;
export const EXIT_INFRASTRUCTURE_FAILURE = 1;
export const EXIT_TERMINATED = 124;

/** Options for {@link runWorkflowApp}. */
export type RunWorkflowAppOptions<TData, TState> = {
	workflow: Workflow<TData, TState>;
	config: WorkflowRunConfig;
	/** The runtime's version, baked in at bundle time. */
	runtimeVersion: string;
	/** The workflow app's version, baked in at bundle time. */
	workflowVersion: string;
	/**
	 * Ends the process. Defaults to `process.exit`.
	 *
	 * The seam exists so a test can record the code the run intended rather than
	 * take the test runner down with it.
	 */
	exit?: (code: number) => void;
	/** Defaults to a logger named after the workflow. */
	logger?: Logger;
};

/** A run's signals, plus the SIGTERM handler feeding them. */
type TerminableRunSignals = RunSignals & { dispose: () => void };

/**
 * Create the run's signals and start listening for SIGTERM.
 *
 * Installed **before** the claim, unlike Python, which installs it after. A pod
 * terminated while still polling for a job otherwise dies on Node's default
 * handler, reporting 143 rather than the 124 every other termination reports.
 */
function createTerminableRunSignals(logger: Logger): TerminableRunSignals {
	const signals = createRunSignals();

	const onSigterm = () => {
		logger.info("received sigterm, terminating workflow");

		signals.terminate();
	};

	process.on("SIGTERM", onSigterm);

	return {
		...signals,
		dispose: () => {
			process.off("SIGTERM", onSigterm);
		},
	};
}

/**
 * Initialise Sentry and describe the run.
 *
 * The DSN is passed in rather than read from the environment, because it has
 * already been through `<KEY>_FILE` resolution in `parseWorkflowRunConfig` and
 * `readDsn` would go straight back to `process.env` and miss it. No DSN means no
 * `init`, so dev and unconfigured deploys are untouched.
 */
function initSentry(
	config: WorkflowRunConfig,
	runtimeVersion: string,
	workflowVersion: string,
): void {
	if (config.sentryDsn) {
		Sentry.init({
			...getCommonOptions(config.workflow),
			dsn: config.sentryDsn,
			release: workflowVersion,
		});
	}

	Sentry.setContext("workflow", {
		runtimeVersion,
		workflowName: config.workflow,
		workflowVersion,
	});
}

/**
 * Identifies one runner to the jobs API. Matches Python's
 * `f"{socket.gethostname()}-{os.getpid()}"`.
 */
function buildRunnerId(): string {
	return `${hostname()}-${process.pid}`;
}

/**
 * Run one workflow, from claiming a job to reporting how it ended.
 *
 * This is what a workflow app's `main.ts` calls. It owns everything
 * `runWorkflow` deliberately does not: the network, the signal handler, and the
 * process exit code.
 */
export async function runWorkflowApp<TData, TState>({
	workflow,
	config,
	runtimeVersion,
	workflowVersion,
	exit = process.exit,
	logger = createLogger({ name: config.workflow }),
}: RunWorkflowAppOptions<TData, TState>): Promise<void> {
	initSentry(config, runtimeVersion, workflowVersion);

	logger.info(
		{ runtimeVersion, workflow: config.workflow, workflowVersion },
		"starting workflow runtime",
	);

	const signals = createTerminableRunSignals(logger);

	let code: number;

	try {
		code = await claimAndRun({
			config,
			logger,
			runtimeVersion,
			signals,
			workflow,
			workflowVersion,
		});
	} finally {
		signals.dispose();
	}

	// `process.exit` is immediate, so a buffered event would never leave the pod.
	// A failure to flush must not change the code the run arrived at.
	await Sentry.flush(2000).catch(() => false);

	exit(code);
}

/** @returns the exit code the pod should report. */
async function claimAndRun<TData, TState>({
	config,
	logger,
	runtimeVersion,
	signals,
	workflow,
	workflowVersion,
}: {
	config: WorkflowRunConfig;
	logger: Logger;
	runtimeVersion: string;
	signals: RunSignals;
	workflow: Workflow<TData, TState>;
	workflowVersion: string;
}): Promise<number> {
	let claimed: Awaited<ReturnType<typeof claimJob>>;

	try {
		claimed = await claimJob({
			baseUrl: config.jobsApiUrl,
			workflow: config.workflow,
			request: {
				runnerId: buildRunnerId(),
				mem: config.mem,
				cpu: config.proc,
				image: config.image,
				runtimeVersion,
				workflowVersion,
				steps: workflow.steps.map(({ id, name, description }) => ({
					id,
					name,
					description,
				})),
			},
			logger,
			// `VT_TIMEOUT` is in seconds, matching Python's
			// `asyncio.timeout(config.timeout)`.
			signal: AbortSignal.any([
				signals.signal,
				AbortSignal.timeout(config.timeout * 1000),
			]),
		});
	} catch (err) {
		logger.error({ err }, "failed to claim a job");

		return EXIT_INFRASTRUCTURE_FAILURE;
	}

	if (claimed === null) {
		if (signals.isTerminated()) {
			return EXIT_TERMINATED;
		}

		logger.warn("timed out while waiting for job");

		return EXIT_OK;
	}

	Sentry.setContext("workflow", {
		runtimeVersion,
		workflowName: config.workflow,
		workflowVersion,
		jobId: claimed.id,
	});

	const client = createJobsApiClient({
		baseUrl: config.jobsApiUrl,
		jobId: claimed.id,
		key: claimed.key,
		logger,
		signal: signals.signal,
	});

	try {
		let context: Awaited<
			ReturnType<typeof createWorkflowContext<TData, TState>>
		>;

		try {
			// The claim response carries no `args` — Python's does not either, and
			// its `job` fixture reads the full job back for them. This runtime is
			// eager, so it does that read once, here, rather than per step.
			const [job, workPath] = await Promise.all([
				client.getJob(),
				createWorkPath(config.workPath),
			]);

			context = await createWorkflowContext(workflow, {
				job: { id: job.id, workflow: job.workflow, args: job.args },
				workPath,
				proc: config.proc,
				mem: config.mem,
				logger,
				signal: signals.signal,
				client,
				// Built once, here, so every step shares one runner already bound
				// to the run's signal and cannot forget to forward cancellation.
				runSubprocess: createRunSubprocess({
					signal: signals.signal,
					logger,
				}),
			});
		} catch (err) {
			// Preparation reaches the network and the filesystem with the run's
			// signal, so a SIGTERM arriving here surfaces as a rejection rather
			// than as a clean unwind. Reporting that as a broken pod would have
			// the `ScaledJob` retry a pod that was deliberately stopped.
			if (signals.isTerminated()) {
				logger.info({ err }, "terminated while preparing the workflow run");

				return EXIT_TERMINATED;
			}

			logger.error({ err }, "failed to prepare the workflow run");

			return EXIT_INFRASTRUCTURE_FAILURE;
		}

		const ping = startPingLoop({ client, logger, signals });

		let outcome: Awaited<ReturnType<typeof runWorkflow>>;

		try {
			outcome = await runWorkflow({
				workflow,
				context,
				signals,
				logger,
				// The one place the run loop reaches the job lifecycle. There is
				// deliberately no failure counterpart: failure is an API-side
				// transition.
				onStepStart: (step) => client.startStep(step.id),
			});
		} finally {
			await ping.stop();
		}

		if (outcome.state === "succeeded") {
			try {
				await client.finish();
			} catch (err) {
				// The work is done and the outputs are written, so retrying the pod
				// would redo all of it. The job is left to the jobs API's ping
				// timeout instead.
				logger.error(
					{ err },
					"workflow succeeded but the jobs API could not be told",
				);
			}

			return EXIT_OK;
		}

		if (signals.isTerminated()) {
			return EXIT_TERMINATED;
		}

		return EXIT_OK;
	} finally {
		await client.close();
	}
}

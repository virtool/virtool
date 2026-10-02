import { hostname } from "node:os";
import * as Sentry from "@sentry/node";
import { isJobTerminalRefusal } from "@virtool/contracts";
import { createLogger, type Logger } from "@virtool/logger";
import { getCommonOptions } from "@virtool/sentry";
import { createSentryLogStream } from "@virtool/sentry/log";
import { createStorageBackend } from "@virtool/storage";
import { createJobsApiClient } from "./client/client";
import { UnauthorizedError } from "./client/errors";
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
	/**
	 * Defaults to a logger named after the workflow, which also forwards
	 * `info`-and-above records to Sentry when a DSN is configured.
	 */
	logger?: Logger;
	/**
	 * Reports an error to Sentry. Defaults to `Sentry.captureException`.
	 *
	 * The seam exists so a test can see what the run reported without a DSN.
	 */
	captureException?: CaptureException;
};

/** Reports an error with the tags that identify the run it came from. */
type CaptureException = (
	err: unknown,
	context: { tags: Record<string, string> },
) => void;

/** Reports an error, tagged with the workflow and, once claimed, the job. */
type ReportError = (err: unknown, jobId?: number) => void;

/** A run's signals, plus the SIGTERM handler feeding them. */
type TerminableRunSignals = RunSignals & { dispose: () => void };

/**
 * Create the run's signals and start listening for SIGTERM.
 *
 * Installed **before** the claim, not after it. A pod terminated while still
 * polling for a job otherwise dies on Node's default handler, reporting 143
 * rather than the 124 every other termination reports.
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
): boolean {
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

	return config.sentryDsn !== undefined;
}

/** Identifies one runner to the jobs API by its hostname and pid. */
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
	logger: providedLogger,
	captureException = Sentry.captureException,
}: RunWorkflowAppOptions<TData, TState>): Promise<void> {
	const sentryEnabled = initSentry(config, runtimeVersion, workflowVersion);

	const logger =
		providedLogger ??
		createLogger({
			name: config.workflow,
			streams: sentryEnabled
				? [
						{
							level: "info" as const,
							stream: createSentryLogStream(Sentry.logger),
						},
					]
				: undefined,
		});

	// Logged errors reach Sentry only as log records, which raise no issue and
	// trigger no alert, so every failure is also captured as an exception.
	const reportError: ReportError = (err, jobId) => {
		// A job can end while the ping loop is not watching, such as between the
		// last step and the finish call. Any request can then be refused with a
		// terminal state, and that is a cancellation, not a failure.
		if (err instanceof UnauthorizedError && isJobTerminalRefusal(err.message)) {
			return;
		}

		const tags: Record<string, string> = { workflow: config.workflow };

		if (jobId !== undefined) {
			tags.jobId = String(jobId);
		}

		captureException(err, { tags });
	};

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
			reportError,
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
	reportError,
	runtimeVersion,
	signals,
	workflow,
	workflowVersion,
}: {
	config: WorkflowRunConfig;
	logger: Logger;
	reportError: ReportError;
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
			// `VT_TIMEOUT` is in seconds, hence the conversion.
			signal: AbortSignal.any([
				signals.signal,
				AbortSignal.timeout(config.timeout * 1000),
			]),
		});
	} catch (err) {
		logger.error({ err }, "failed to claim a job");
		reportError(err);

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
			// The claim response carries no `args`, so the full job is read back
			// for them. This runtime is eager, so it does that read once, here,
			// rather than per step.
			const [job, workPath] = await Promise.all([
				client.getJob(),
				createWorkPath(config.workPath),
			]);

			context = await createWorkflowContext(workflow, {
				job: { id: job.id, workflow: job.workflow, args: job.args },
				workPath,
				proc: config.proc,
				mem: config.mem,
				workflowVersion,
				logger,
				signal: signals.signal,
				client,
				// Built once, here, so every step shares one runner already bound
				// to the run's signal and cannot forget to forward cancellation.
				runSubprocess: createRunSubprocess({
					signal: signals.signal,
					logger,
				}),
				storage: createStorageBackend(config.storage),
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
			reportError(err, claimed.id);

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

				// A cancellation or termination aborts the finish call itself, and
				// that is not a failure to report.
				if (!signals.signal.aborted) {
					reportError(err, claimed.id);
				}
			}

			return EXIT_OK;
		}

		if (signals.isTerminated()) {
			return EXIT_TERMINATED;
		}

		if (outcome.state === "failed") {
			reportError(outcome.error, claimed.id);
		}

		return EXIT_OK;
	} finally {
		await client.close();
	}
}

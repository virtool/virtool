import * as Sentry from "@sentry/node";
import { createLogger, type Logger } from "@virtool/logger";
import { getCommonOptions } from "@virtool/sentry";
import { createSentryLogStream } from "@virtool/sentry/log";

/** How long Sentry may spend flushing buffered envelopes, in milliseconds. */
const SENTRY_FLUSH_TIMEOUT = 2_000;

/** The environment every short-lived command reads, beyond its own keys. */
type CommandEnv = {
	/** Unset disables Sentry entirely, which is what dev and CI want. */
	VT_SENTRY_DSN?: string;
};

/** What {@link runCommand} needs to run one short-lived subcommand. */
type CommandOptions<Env extends CommandEnv> = {
	/** The Sentry `service` tag and the logger name. */
	service: string;
	/** The message logged when the command throws. */
	failure: string;
	/** Resolve and validate the command's `<KEY>_FILE`-backed environment. */
	parseEnv: () => Env;
	run: (env: Env, logger: Logger) => Promise<void>;
};

function parseOrFail<Env extends CommandEnv>(
	options: CommandOptions<Env>,
): Env | undefined {
	try {
		return options.parseEnv();
	} catch (err) {
		createLogger({ name: options.service }).fatal({ err }, options.failure);
		process.exitCode = 1;
		return undefined;
	}
}

/**
 * Run a subcommand that exits when its work is done, reporting a thrown error
 * to Sentry and flushing before the process exits.
 *
 * Unlike `serve` and `run`, these processes have no shutdown controller to
 * flush Sentry, and the event loop empties as soon as the command returns, so
 * the flush is awaited here. An error thrown while parsing the environment is
 * logged but not reported, because the DSN is part of that environment.
 *
 * The Sentry status is logged at `debug`, so `data-migrations export` output
 * stays pipeable.
 */
export async function runCommand<Env extends CommandEnv>(
	options: CommandOptions<Env>,
): Promise<void> {
	const env = parseOrFail(options);

	if (env === undefined) {
		return;
	}

	const sentryOptions = getCommonOptions(options.service);
	const dsn = env.VT_SENTRY_DSN;

	if (dsn) {
		Sentry.init({ ...sentryOptions, dsn });
	}

	const logger = createLogger({
		name: options.service,
		streams: dsn
			? [
					{
						level: "info" as const,
						stream: createSentryLogStream(Sentry.logger),
					},
				]
			: undefined,
	});

	logger.debug(
		{ environment: sentryOptions.environment, foundSentryDsn: Boolean(dsn) },
		dsn ? "sentry initialised" : "sentry disabled",
	);

	try {
		await options.run(env, logger);
	} catch (err) {
		Sentry.captureException(err);
		logger.fatal({ err }, options.failure);
		process.exitCode = 1;
	} finally {
		if (dsn) {
			await Sentry.flush(SENTRY_FLUSH_TIMEOUT);
		}
	}
}

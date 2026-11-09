import { hostname } from "node:os";
import pino, {
	type DestinationStream,
	type Logger,
	type LoggerOptions,
	type StreamEntry,
	type TransportMultiOptions,
	type TransportPipelineOptions,
	type TransportSingleOptions,
} from "pino";
import { DEFAULT_REDACT_PATHS, type LogLevel, resolveLevel } from "./config";

export type { Logger } from "pino";
export type { LogLevel } from "./config";
export { DEFAULT_REDACT_PATHS, LOG_LEVEL_ENV, resolveLevel } from "./config";

/** Any pino transport shape — single target, multi-target, or pipeline. */
export type LoggerTransport =
	| TransportSingleOptions
	| TransportMultiOptions
	| TransportPipelineOptions;

/** Options for `createLogger`. */
export type CreateLoggerOptions = {
	/** Service identifier baked into every log record as `name`. */
	name: string;
	/** Override the level resolved from env. */
	level?: LogLevel;
	/** Extra redact paths merged with `DEFAULT_REDACT_PATHS`. */
	redact?: readonly string[];
	/** Extra base bindings merged into every record alongside `pid`/`hostname`. */
	base?: Record<string, unknown>;
	/** Pino transport config. Mutually exclusive with `destination`. */
	transport?: LoggerTransport;
	/** Env source for level resolution. Defaults to `process.env`. */
	env?: Record<string, string | undefined>;
	/** Destination stream. Ignored when `transport` is set. */
	destination?: DestinationStream;
	/**
	 * Extra destinations to fan out to alongside the primary one. Each record is
	 * written to the primary destination and to every entry here whose level it
	 * meets. Redaction is applied before any stream sees the record. Ignored when
	 * `transport` is set.
	 */
	streams?: readonly StreamEntry<LogLevel>[];
};

/**
 * Build a pino logger.
 *
 * Pass structured fields as the first argument and a stable message as the
 * second. Do not interpolate values into the message: that defeats redaction
 * and makes records hard to search.
 *
 * Each process builds one logger at its composition root and passes it down.
 * Data functions take a `Logger` argument instead of importing one, because
 * the app that built it owns its Sentry forwarding stream. Tests pass a silent
 * logger.
 *
 * Add a destination, such as the Sentry stream, with `streams`. Redaction runs
 * before any destination sees the record.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
	const env = options.env ?? process.env;
	const level = options.level ?? resolveLevel(env);

	const pinoOptions: LoggerOptions = {
		name: options.name,
		level,
		redact: {
			paths: [...DEFAULT_REDACT_PATHS, ...(options.redact ?? [])],
			censor: "[redacted]",
		},
	};

	if (options.base) {
		pinoOptions.base = {
			pid: process.pid,
			hostname: hostname(),
			...options.base,
		};
	}

	if (options.transport) {
		return pino({ ...pinoOptions, transport: options.transport });
	}

	if (options.streams && options.streams.length > 0) {
		const primary: StreamEntry<LogLevel> = {
			level,
			stream: options.destination ?? pino.destination(1),
		};
		return pino(
			pinoOptions,
			pino.multistream<LogLevel>([primary, ...options.streams]),
		);
	}

	return pino(pinoOptions, options.destination);
}

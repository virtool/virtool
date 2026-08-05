import { createLogger, type Logger } from "@virtool/logger";

/**
 * This process's logger.
 *
 * `name` is `jobs-api`, matching the Sentry `service` tag and the
 * `application_name` segment this process connects to Postgres under, so one
 * string identifies the service across logs, errors and pool metrics.
 */
export const logger: Logger = createLogger({ name: "jobs-api" });

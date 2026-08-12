/**
 * Histogram bucket boundaries for `virtool_http_request_duration_seconds`, in
 * seconds: 5 ms to 10 s.
 *
 * Shared by every service that serves HTTP traffic (`apps/web`,
 * `apps/jobs-api`) rather than declared as a literal in each registry — two
 * independent copies matching today is coincidence, and nothing would catch
 * them drifting apart. `apps/tasks` does not use these: it serves nothing but
 * probes and a scrape, and its own `virtool_task_duration_seconds` buckets
 * are sized for tasks (1 s–2 h), not requests.
 */
export const HTTP_REQUEST_DURATION_BUCKETS = [
	0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

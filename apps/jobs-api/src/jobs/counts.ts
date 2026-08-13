import { JobState, JobWorkflow } from "@virtool/contracts";
import type { JobQueueSnapshot } from "@virtool/data/jobs/data";
import type { JobQueueReader } from "../metrics/jobs";

/**
 * Job counts grouped by state and then workflow.
 *
 * The shape is Python's `JobCounts` — every state present, every workflow
 * present under each, zeros written rather than omitted — because a KEDA
 * `metrics-api` trigger addresses one figure by a fixed path (`pending.nuvs`)
 * and a missing key is an error at the scaler, not a zero.
 *
 * Both axes come from the unions in `@virtool/contracts` rather than a literal
 * list, so a workflow added there appears here without an edit.
 */
export type JobCountsByState = Record<JobState, Record<JobWorkflow, number>>;

/** The full cross product, all zero. */
function emptyCounts(): JobCountsByState {
	return Object.fromEntries(
		JobState.options.map((state) => [
			state,
			Object.fromEntries(JobWorkflow.options.map((workflow) => [workflow, 0])),
		]),
	) as JobCountsByState;
}

/**
 * Project the queue snapshot onto the wire shape.
 *
 * **The three terminal states are always zero**, and that is a deliberate
 * divergence from Python, which groups over the whole `jobs` table. That scan
 * grows forever against a table this side cannot index, so `readJobCounts`
 * covers `pending` and `running` alone — see the bound recorded on
 * `readJobQueueBounded`. Nothing scales on how many jobs have already finished,
 * so the figures a scaler reads are the true ones; a caller wanting lifetime
 * totals is asking a question this endpoint has never been able to afford.
 *
 * A `workflow` the union does not name is dropped rather than folded onto an
 * `other` key, because the shape has no such key and inventing one would put a
 * field in front of a scaler that Python's response never carries. The column
 * is plain `text`, so this is reachable; `/metrics` is where an unrecognised
 * value is still counted.
 */
function toJobCounts(snapshot: JobQueueSnapshot): JobCountsByState {
	const counts = emptyCounts();

	for (const row of snapshot.counts) {
		const state = JobState.safeParse(row.state);
		const workflow = JobWorkflow.safeParse(row.workflow);

		if (state.success && workflow.success) {
			counts[state.data][workflow.data] = row.count;
		}
	}

	return counts;
}

/**
 * Serve `GET /jobs/counts`, the queue depth a KEDA `ScaledJob` scales on.
 *
 * Public, matching Python's `PublicRoutePolicy`: the scaler holds no job key,
 * and could not — a key is minted at claim time, which is the very thing it is
 * deciding whether to start a pod to do. What bounds the endpoint is the
 * network, exactly as for `POST /jobs/claim`: this service has no ingress.
 *
 * It reads through the **same memoized reader `/metrics` uses**, so a scaler
 * polling on its own interval and Prometheus scraping on another cost one query
 * between them rather than one each.
 *
 * A failed read is **not** caught. Answering zeros on a database blip would
 * read as a drained queue and scale the fleet to nothing; letting it reach
 * `app.onError` answers 500, and a scaler that cannot fetch its metric holds
 * its last decision instead. The read carries its own timeout, so the failure
 * arrives inside a couple of seconds rather than hanging the poll.
 */
export async function handleReadJobCounts(
	readJobQueue: JobQueueReader,
): Promise<Response> {
	return Response.json(toJobCounts(await readJobQueue()));
}

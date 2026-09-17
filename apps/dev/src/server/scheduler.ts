import type { Workflow } from "../shared/types.ts";

/** A pending workflow type in one environment. */
export type QueueCandidate = {
	environmentId: string;
	pending: number;
	workflow: Workflow;
};

/** Fair round-robin selection for global workflow capacity. */
export class FairScheduler {
	private cursor = 0;

	select(candidates: QueueCandidate[], capacity: number): QueueCandidate[] {
		if (capacity <= 0) {
			return [];
		}
		const ready = candidates.filter((candidate) => candidate.pending > 0);
		if (ready.length === 0) {
			return [];
		}
		const selected: QueueCandidate[] = [];
		const start = this.cursor % ready.length;
		for (
			let offset = 0;
			offset < ready.length && selected.length < capacity;
			offset += 1
		) {
			selected.push(ready[(start + offset) % ready.length] as QueueCandidate);
		}
		this.cursor = (start + selected.length) % ready.length;
		return selected;
	}
}

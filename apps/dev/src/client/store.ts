import { useSyncExternalStore } from "react";
import type { Snapshot } from "../shared/types.ts";

const EMPTY: Snapshot = {
	environments: [],
	repositoryId: "",
	scheduler: {
		active: [],
		buildQueue: [],
		capacity: 0,
		concurrency: 1,
		queues: {},
	},
	shared: { initialized: false, lastError: null, services: {} },
	updatedAt: 0,
	updateAvailable: false,
};

let snapshot = EMPTY;
let source: EventSource | undefined;
const listeners = new Set<() => void>();

function emit(): void {
	for (const listener of listeners) {
		listener();
	}
}

function connect(): void {
	if (source || typeof EventSource === "undefined") {
		return;
	}
	source = new EventSource("/api/events");
	source.addEventListener("state", (event) => {
		snapshot = JSON.parse(event.data) as Snapshot;
		emit();
	});
	source.onerror = () => {
		source?.close();
		source = undefined;
		setTimeout(connect, 1_000);
	};
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	connect();
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			source?.close();
			source = undefined;
		}
	};
}

/** Subscribe to the daemon's cached live snapshot. */
export function useSnapshot(): Snapshot {
	return useSyncExternalStore(
		subscribe,
		() => snapshot,
		() => EMPTY,
	);
}

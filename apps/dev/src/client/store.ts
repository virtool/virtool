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
		lastError: null,
		queues: {},
	},
	shared: {
		initialized: false,
		lastError: null,
		services: {},
		storage: { azurite: null, postgres: null },
	},
	updatedAt: 0,
	updateAvailable: false,
};

const INITIAL = {
	snapshot: EMPTY,
	connection: "connecting" as "connecting" | "live" | "reconnecting",
};
let state = INITIAL;
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
		state = {
			snapshot: JSON.parse(event.data) as Snapshot,
			connection: "live",
		};
		emit();
	});
	source.onerror = () => {
		state = { ...state, connection: "reconnecting" };
		emit();
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
			state = { ...state, connection: "connecting" };
		}
	};
}

export function useSnapshot() {
	return useSyncExternalStore(
		subscribe,
		() => state,
		() => INITIAL,
	);
}

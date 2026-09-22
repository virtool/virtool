import { existsSync } from "node:fs";
import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Mutation, Snapshot } from "../shared/types.ts";
import { MANAGEMENT_ORIGIN } from "./constants.ts";

type EnvironmentLogReader = (
	environmentId: string,
	service?: string,
) => Promise<string>;

type DaemonLogReader = () => Promise<string>;

/** Mutable snapshot feed shared by API requests and SSE clients. */
export class SnapshotFeed {
	private listeners = new Set<(snapshot: Snapshot) => void>();

	constructor(private snapshot: Snapshot) {}

	get(): Snapshot {
		return this.snapshot;
	}

	set(snapshot: Snapshot): void {
		this.snapshot = snapshot;
		for (const listener of this.listeners) {
			listener(snapshot);
		}
	}

	subscribe(listener: (snapshot: Snapshot) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}

/** Create the loopback management API and static UI application. */
export function createApi(
	feed: SnapshotFeed,
	mutate: (mutation: Mutation) => void,
	setConcurrency: (value: number) => void,
	clientDirectory: string,
	resetShared: () => Promise<void> = async () => undefined,
	readDaemonLogs?: DaemonLogReader,
	readEnvironmentLogs?: EnvironmentLogReader,
) {
	const app = new Hono();
	app.use("/api/*", async (context, next) => {
		const host = (
			context.req.header("host") ?? new URL(context.req.url).hostname
		).split(":")[0];
		if (
			host !== "127.0.0.1" &&
			host !== "localhost" &&
			host !== "dev.localhost"
		) {
			return context.json({ error: "host not allowed" }, 403);
		}
		if (context.req.method !== "GET") {
			const origin = context.req.header("origin");
			if (origin !== MANAGEMENT_ORIGIN) {
				return context.json({ error: "origin not allowed" }, 403);
			}
		}
		await next();
	});
	app.get("/api/state", (context) => context.json(feed.get()));
	app.get("/api/logs", async (context) => {
		const worktreeId = context.req.query("environment");
		const service = context.req.query("service");
		if (worktreeId) {
			const environment = feed
				.get()
				.environments.find((candidate) => candidate.worktreeId === worktreeId);
			if (!environment?.id) {
				return context.json({ error: "environment not found" }, 404);
			}
			if (service && !Object.hasOwn(environment.services, service)) {
				return context.json({ error: "service not found" }, 404);
			}
			if (!readEnvironmentLogs) {
				return context.text("");
			}
			try {
				return context.text(await readEnvironmentLogs(environment.id, service));
			} catch {
				return context.json({ error: "unable to load environment logs" }, 502);
			}
		}
		if (service) {
			return context.json({ error: "service requires an environment" }, 400);
		}
		if (!readDaemonLogs) {
			return context.text("");
		}
		try {
			return context.text(await readDaemonLogs());
		} catch {
			return context.text("");
		}
	});
	app.get("/api/events", (context) =>
		streamSSE(context, async (stream) => {
			let resolve: (() => void) | undefined;
			const snapshots: Snapshot[] = [feed.get()];
			const unsubscribe = feed.subscribe((snapshot) => {
				snapshots.push(snapshot);
				resolve?.();
			});
			stream.onAbort(() => unsubscribe());
			while (!stream.aborted) {
				const snapshot = snapshots.shift();
				if (snapshot) {
					await stream.writeSSE({
						data: JSON.stringify(snapshot),
						event: "state",
					});
					continue;
				}
				await new Promise<void>((done) => {
					resolve = done;
				});
				resolve = undefined;
			}
		}),
	);
	app.post("/api/environments", async (context) => {
		const mutation = (await context.req.json()) as Mutation;
		mutate(mutation);
		return context.json({ accepted: true }, 202);
	});
	app.post("/api/scheduler", async (context) => {
		const body = (await context.req.json()) as { concurrency: number };
		setConcurrency(body.concurrency);
		return context.json({ accepted: true }, 202);
	});
	app.post("/api/shared/reset", async (context) => {
		const body = (await context.req.json()) as { confirmation?: string };
		if (body.confirmation !== "reset") {
			return context.json({ error: "confirmation required" }, 422);
		}
		await resetShared();
		return context.json({ accepted: true }, 202);
	});
	if (existsSync(clientDirectory)) {
		app.use("/assets/*", serveStatic({ root: clientDirectory }));
		app.get("/", serveStatic({ path: join(clientDirectory, "index.html") }));
		app.get("/*", serveStatic({ path: join(clientDirectory, "index.html") }));
	} else {
		app.get("/", (context) =>
			context.text("Build @virtool/dev to install the management UI", 503),
		);
	}
	return app;
}

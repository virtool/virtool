import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { expect, test, vi } from "vitest";
import { createDevProcess } from "./process";

function createHarness() {
	const children: (EventEmitter & { kill: ReturnType<typeof vi.fn> })[] = [];
	const spawn = vi.fn(() => {
		const child = Object.assign(new EventEmitter(), { kill: vi.fn() });
		children.push(child);
		return child as unknown as ChildProcess;
	});
	return { service: createDevProcess(spawn), children, spawn };
}

test("waits for graceful exit before replacing a service", async () => {
	const { service, children, spawn } = createHarness();
	const first = new AbortController();
	await service.start(first.signal);
	first.abort();
	const replacement = service.start(new AbortController().signal);
	await Promise.resolve();
	expect(children[0]?.kill).toHaveBeenCalledWith("SIGTERM");
	expect(spawn).toHaveBeenCalledTimes(1);
	children[0]?.emit("exit", 0);
	await replacement;
	expect(spawn).toHaveBeenCalledTimes(2);
	const stopped = service.stop();
	children[1]?.emit("exit", 0);
	await stopped;
});

test("skips superseded builds while the previous service drains", async () => {
	const { service, children, spawn } = createHarness();
	await service.start(new AbortController().signal);
	const stale = new AbortController();
	const skipped = service.start(stale.signal);
	stale.abort();
	const current = service.start(new AbortController().signal);
	children[0]?.emit("exit", 0);
	await Promise.all([skipped, current]);
	expect(spawn).toHaveBeenCalledTimes(2);
	const stopped = service.stop();
	children[1]?.emit("exit", 0);
	await stopped;
});

test("shutdown waits for exit and prevents queued starts", async () => {
	const { service, children, spawn } = createHarness();
	await service.start(new AbortController().signal);
	const queued = service.start(new AbortController().signal);
	const stopped = service.stop();
	children[0]?.emit("exit", 0);
	await Promise.all([queued, stopped]);
	await service.start(new AbortController().signal);
	expect(spawn).toHaveBeenCalledTimes(1);
});

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
import { DockerEvents } from "./events.ts";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

it("ignores exec events and refreshes for container lifecycle events", () => {
	const stdout = new EventEmitter();
	const child = Object.assign(new EventEmitter(), {
		stdout,
		stderr: { resume: vi.fn() },
		kill: vi.fn(),
	});
	vi.mocked(spawn).mockReturnValue(
		child as unknown as ChildProcessWithoutNullStreams,
	);
	const onEvent = vi.fn();
	const events = new DockerEvents("repository", onEvent);

	events.start();
	stdout.emit("data", Buffer.from("exec_create\nexec_start\nsta"));
	expect(onEvent).not.toHaveBeenCalled();
	stdout.emit("data", Buffer.from("rt\nexec_die\n"));
	expect(onEvent).toHaveBeenCalledOnce();
	stdout.emit("data", Buffer.from("die\nhealth_status: healthy\n"));
	expect(onEvent).toHaveBeenCalledTimes(2);
	events.stop();
});

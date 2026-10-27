import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
import { DockerEvents } from "./events.ts";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

it("filters Docker events to container lifecycle changes", () => {
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

	const args = vi.mocked(spawn).mock.calls[0]?.[1] ?? [];
	expect(args).toContain("event=health_status");
	expect(args).not.toContain("event=exec_create");
	stdout.emit("data", Buffer.from("start\n"));
	expect(onEvent).toHaveBeenCalledOnce();
	events.stop();
});

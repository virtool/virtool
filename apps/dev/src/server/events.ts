import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";

/** Persistent Docker event stream with bounded reconnect delay. */
export class DockerEvents {
	private child: ChildProcessWithoutNullStreams | undefined;
	private pending = "";
	private reconnect: NodeJS.Timeout | undefined;
	private stopped = false;

	constructor(
		private readonly repositoryId: string,
		private readonly onEvent: () => void,
	) {}

	start(): void {
		if (this.child || this.stopped) {
			return;
		}
		const child = spawn("docker", [
			"events",
			"--filter",
			`label=ca.virtool.dev.repository=${this.repositoryId}`,
			"--format",
			"{{.Action}}",
		]);
		this.child = child;
		child.stderr.resume();
		child.stdout.on("data", (chunk: Buffer) => {
			this.pending += chunk.toString();
			const actions = this.pending.split("\n");
			this.pending = actions.pop() ?? "";
			if (actions.some((action) => !action.startsWith("exec_"))) {
				this.onEvent();
			}
		});
		child.once("error", () => this.scheduleReconnect(child));
		child.once("close", () => this.scheduleReconnect(child));
	}

	stop(): void {
		this.stopped = true;
		if (this.reconnect) {
			clearTimeout(this.reconnect);
		}
		this.child?.kill();
		this.child = undefined;
		this.pending = "";
	}

	private scheduleReconnect(child: ChildProcessWithoutNullStreams): void {
		if (this.child !== child || this.stopped) {
			return;
		}
		this.child = undefined;
		this.pending = "";
		this.reconnect = setTimeout(() => {
			this.reconnect = undefined;
			this.start();
		}, 1_000);
	}
}

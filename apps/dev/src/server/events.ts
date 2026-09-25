import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";

// Docker filters these server-side, so health-check exec events never reach the daemon.
const LIFECYCLE_EVENTS = [
	"create",
	"destroy",
	"die",
	"health_status",
	"pause",
	"start",
	"stop",
	"unpause",
];

export class DockerEvents {
	private child: ChildProcessWithoutNullStreams | undefined;
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
			"--filter",
			"type=container",
			...LIFECYCLE_EVENTS.flatMap((event) => ["--filter", `event=${event}`]),
			"--format",
			"{{.Action}}",
		]);
		this.child = child;
		child.stderr.resume();
		child.stdout.on("data", () => this.onEvent());
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
	}

	private scheduleReconnect(child: ChildProcessWithoutNullStreams): void {
		if (this.child !== child || this.stopped) {
			return;
		}
		this.child = undefined;
		this.reconnect = setTimeout(() => {
			this.reconnect = undefined;
			this.start();
		}, 1_000);
	}
}

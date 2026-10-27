import type { ChildProcess } from "node:child_process";

/** A service supervisor that drains each process before its replacement starts. */
export function createDevProcess(spawn: () => ChildProcess) {
	let child: ChildProcess | undefined;
	let exited = Promise.resolve();
	let queue = Promise.resolve();
	let stopping = false;

	function terminate() {
		child?.kill("SIGTERM");
	}

	function start(signal: AbortSignal) {
		queue = queue.then(async () => {
			terminate();
			await exited;
			if (stopping || signal.aborted) {
				return;
			}
			child = spawn();
			exited = new Promise<void>((resolve) => {
				function finish() {
					signal.removeEventListener("abort", terminate);
					child = undefined;
					resolve();
				}
				child?.once("exit", finish);
				child?.once("error", (error) => {
					process.stderr.write(`${error}\n`);
					finish();
				});
			});
			signal.addEventListener("abort", terminate, { once: true });
		});
		return queue;
	}

	async function stop() {
		stopping = true;
		terminate();
		await queue;
		await exited;
	}

	return { start, stop };
}

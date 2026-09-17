type BuildPriority = "core" | "workflow";

type QueuedBuild<T> = {
	reject: (error: unknown) => void;
	resolve: (value: T) => void;
	run: () => Promise<T>;
};

/** Serial build queue that gives core environment builds priority. */
export class BuildCoordinator {
	private active = false;
	private readonly core: QueuedBuild<unknown>[] = [];
	private readonly workflow: QueuedBuild<unknown>[] = [];

	run<T>(priority: BuildPriority, task: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const queue = priority === "core" ? this.core : this.workflow;
			queue.push({
				reject,
				resolve: resolve as (value: unknown) => void,
				run: task,
			});
			this.drain();
		});
	}

	private drain(): void {
		if (this.active) {
			return;
		}
		const next = this.core.shift() ?? this.workflow.shift();
		if (!next) {
			return;
		}
		this.active = true;
		void next
			.run()
			.then(next.resolve, next.reject)
			.finally(() => {
				this.active = false;
				this.drain();
			});
	}
}

import { createLogger, type Logger } from "@virtool/logger";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createShutdownController, type ShutdownDeps } from "./shutdown";

const logger: Logger = createLogger({ name: "test", level: "silent" });

const previousExitCode = process.exitCode;

afterEach(() => {
	// The controller sets `process.exitCode` — that is the behaviour under test —
	// and leaving it set would decide this suite's own exit status.
	process.exitCode = previousExitCode;
	vi.restoreAllMocks();
});

/** Build deps that append each step's name to `order` as it runs. */
function deps(
	order: string[],
	overrides: Partial<ShutdownDeps> = {},
): ShutdownDeps {
	return {
		logger,
		setReady: (ready) => {
			order.push(`setReady:${ready}`);
		},
		closeListener: async () => {
			order.push("closeListener");
		},
		closeDatabase: async () => {
			order.push("closeDatabase");
		},
		flushSentry: async () => {
			order.push("flushSentry");
		},
		timeout: 30,
		...overrides,
	};
}

describe("createShutdownController", () => {
	it("flips readiness before anything else and closes the pool last", async () => {
		const order: string[] = [];
		const controller = createShutdownController(deps(order));

		controller.onShutdown("a-hook", async () => {
			order.push("a-hook");
		});

		await controller.shutdown("SIGTERM");

		expect(order).toEqual([
			"setReady:false",
			"a-hook",
			"closeListener",
			"closeDatabase",
			"flushSentry",
		]);
	});

	// A hook registered later may depend on what an earlier one set up, so it has
	// to come down first.
	it("runs hooks in reverse registration order", async () => {
		const order: string[] = [];
		const controller = createShutdownController(deps(order));

		controller.onShutdown("first", async () => {
			order.push("first");
		});
		controller.onShutdown("second", async () => {
			order.push("second");
		});
		controller.onShutdown("third", async () => {
			order.push("third");
		});

		await controller.shutdown("SIGTERM");

		expect(order.slice(1, 4)).toEqual(["third", "second", "first"]);
	});

	it("awaits each hook rather than starting them together", async () => {
		const order: string[] = [];
		const controller = createShutdownController(deps(order));

		controller.onShutdown("slow", async () => {
			await new Promise((resolve) => setTimeout(resolve, 20));
			order.push("slow");
		});
		controller.onShutdown("fast", async () => {
			order.push("fast");
		});

		await controller.shutdown("SIGTERM");

		expect(order.slice(1, 3)).toEqual(["fast", "slow"]);
	});

	// Whatever went wrong in one hook, the pool still has to drain and the
	// remaining hooks still have claims to release.
	it("keeps going when a hook throws", async () => {
		const order: string[] = [];
		const controller = createShutdownController(deps(order));

		controller.onShutdown("survivor", async () => {
			order.push("survivor");
		});
		controller.onShutdown("thrower", async () => {
			throw new Error("hook failed");
		});

		await controller.shutdown("SIGTERM");

		expect(order).toEqual([
			"setReady:false",
			"survivor",
			"closeListener",
			"closeDatabase",
			"flushSentry",
		]);
	});

	// Hooks would otherwise run twice and the pool would be closed out from under
	// the first pass.
	it("ignores a second signal rather than re-entering", async () => {
		const order: string[] = [];
		const controller = createShutdownController(deps(order));

		controller.onShutdown("a-hook", async () => {
			order.push("a-hook");
		});

		await controller.shutdown("SIGTERM");
		await controller.shutdown("SIGTERM");

		expect(order.filter((step) => step === "a-hook")).toHaveLength(1);
		expect(order.filter((step) => step === "closeDatabase")).toHaveLength(1);
	});

	it("sets a zero exit code without calling process.exit", async () => {
		const exit = vi.spyOn(process, "exit").mockImplementation((() => {
			throw new Error("process.exit must never be called");
		}) as never);

		await createShutdownController(deps([])).shutdown("SIGTERM");

		expect(exit).not.toHaveBeenCalled();
		expect(process.exitCode).toBe(0);
	});

	// The backstop must not itself be the reason the process lingers: a clean
	// shutdown that finishes in milliseconds would otherwise sit out the whole
	// budget before the loop could drain.
	it("unrefs the backstop timer", async () => {
		const unref = vi.fn();
		const original = globalThis.setTimeout;

		vi.spyOn(globalThis, "setTimeout").mockImplementation(((
			handler: Parameters<typeof original>[0],
			ms?: number,
		) => {
			const handle = original(handler, ms);
			const real = handle.unref.bind(handle);

			handle.unref = () => {
				unref();
				return real();
			};

			return handle;
		}) as typeof original);

		await createShutdownController(deps([])).shutdown("SIGTERM");

		expect(unref).toHaveBeenCalled();
	});

	// A failed step that exited 0 would be indistinguishable from a clean
	// shutdown, so an undrained pool or an unflushed Sentry buffer would pass
	// unnoticed through every rollout.
	it("reports a non-zero exit code when a step throws", async () => {
		const controller = createShutdownController(
			deps([], {
				closeListener: async () => {
					throw new Error("listener failed");
				},
			}),
		);

		await controller.shutdown("SIGTERM");

		expect(process.exitCode).toBe(1);
	});

	it("reports a non-zero exit code when a hook throws", async () => {
		const controller = createShutdownController(deps([]));

		controller.onShutdown("thrower", async () => {
			throw new Error("hook failed");
		});

		await controller.shutdown("SIGTERM");

		expect(process.exitCode).toBe(1);
	});

	// The pool still has to drain and Sentry still has to flush, whatever the
	// listener did.
	it("runs the steps after one that throws", async () => {
		const order: string[] = [];
		const controller = createShutdownController(
			deps(order, {
				closeListener: async () => {
					throw new Error("listener failed");
				},
			}),
		);

		await controller.shutdown("SIGTERM");

		expect(order).toEqual(["setReady:false", "closeDatabase", "flushSentry"]);
	});

	it("reports a non-zero exit code when the sequence overruns", async () => {
		const controller = createShutdownController(
			deps([], {
				// The hook never settles, so only the backstop can end the sequence.
				closeDatabase: () => new Promise<void>(() => undefined),
				timeout: 0.02,
			}),
		);

		await controller.shutdown("SIGTERM");

		expect(process.exitCode).toBe(1);
	});
});

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

	// A stuck socket must not take the pool drain and the Sentry flush down with
	// it: those are what record the failure, so losing them loses the evidence
	// precisely when there is something to report.
	it("runs the steps after one that never settles", async () => {
		const order: string[] = [];
		const controller = createShutdownController(
			deps(order, {
				closeListener: () => new Promise<void>(() => undefined),
				timeout: 0.06,
			}),
		);

		await controller.shutdown("SIGTERM");

		expect(order).toEqual(["setReady:false", "closeDatabase", "flushSentry"]);
		expect(process.exitCode).toBe(1);
	});

	// A hook is a step of the sequence like any other, so it gets a share of the
	// budget rather than unlimited time.
	it("abandons a hook that never settles", async () => {
		const order: string[] = [];
		const controller = createShutdownController(deps(order, { timeout: 0.06 }));

		controller.onShutdown("stuck", () => new Promise<void>(() => undefined));

		await controller.shutdown("SIGTERM");

		expect(order).toEqual([
			"setReady:false",
			"closeListener",
			"closeDatabase",
			"flushSentry",
		]);
	});

	describe("a hook with a budget of its own", () => {
		// Equal division suits a socket close, where a share is always more than
		// enough. It badly under-serves a hook waiting out work: the ceiling on any
		// one step is the budget over the number of steps, however little the rest
		// need. Four steps at a 40 s budget caps a task drain at 10 s.
		it("gives it more than the equal share would", async () => {
			const order: string[] = [];
			let elapsed = 0;

			const controller = createShutdownController(
				deps(order, { timeout: 0.4 }),
			);

			controller.onShutdown(
				"drain",
				async () => {
					const startedAt = performance.now();

					await new Promise<void>((resolve) => setTimeout(resolve, 250));

					elapsed = performance.now() - startedAt;
					order.push("drain");
				},
				{ timeoutMs: 300 },
			);

			await controller.shutdown("SIGTERM");

			// An equal share of a 400 ms budget across four steps is 100 ms, which
			// would have abandoned this hook well before it settled.
			expect(elapsed).toBeGreaterThan(200);
			expect(order).toEqual([
				"setReady:false",
				"drain",
				"closeListener",
				"closeDatabase",
				"flushSentry",
			]);
			expect(process.exitCode).toBe(0);
		});

		it("abandons it at its own ceiling", async () => {
			const order: string[] = [];

			const controller = createShutdownController(deps(order, { timeout: 10 }));

			controller.onShutdown("stuck", () => new Promise<void>(() => undefined), {
				timeoutMs: 40,
			});

			await controller.shutdown("SIGTERM");

			// Bounded by its declared ceiling rather than by the whole budget, so the
			// steps behind it still run — and it is still a failed step.
			expect(order).toEqual([
				"setReady:false",
				"closeListener",
				"closeDatabase",
				"flushSentry",
			]);
			expect(process.exitCode).toBe(1);
		});

		// Declaring a ceiling reserves the time rather than taking it out of the
		// pool drain's share.
		it("does not starve the steps behind it", async () => {
			const order: string[] = [];

			const controller = createShutdownController(
				deps(order, {
					timeout: 0.4,
					closeDatabase: async () => {
						await new Promise<void>((resolve) => setTimeout(resolve, 60));
						order.push("closeDatabase");
					},
				}),
			);

			controller.onShutdown("stuck", () => new Promise<void>(() => undefined), {
				timeoutMs: 200,
			});

			await controller.shutdown("SIGTERM");

			expect(order).toContain("closeDatabase");
			expect(order).toContain("flushSentry");
		});
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

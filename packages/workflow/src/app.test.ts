import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	EXIT_INFRASTRUCTURE_FAILURE,
	EXIT_OK,
	EXIT_TERMINATED,
	runWorkflowApp,
} from "./app";
import type { WorkflowRunConfig } from "./config";
import type { WorkflowContext } from "./context";
import { defineWorkflow, type WorkflowStep } from "./step";
import { createRecordingLogger } from "./testFixtures";
import {
	respondJson,
	startTestServer,
	type TestServer,
	type TestServerHandler,
} from "./testServer";

const JOB_ID = 9;

type Data = Record<string, never>;
type State = { visited: string[] };

/** What the jobs API stand-in should do at each lifecycle point. */
type ApiBehaviour = {
	claimStatus?: number;
	cancelled?: boolean;
};

function createHandler({
	claimStatus = 200,
	cancelled = false,
}: ApiBehaviour): TestServerHandler {
	return (request, response) => {
		if (request.path === "/jobs/claim") {
			if (claimStatus !== 200) {
				respondJson(response, claimStatus, { message: "no" });
				return;
			}

			respondJson(response, 200, {
				id: JOB_ID,
				acquired: true,
				claim: {
					runnerId: "runner",
					mem: 4,
					cpu: 2,
					image: "unknown",
					runtimeVersion: "1.2.3",
					workflowVersion: "4.5.6",
				},
				claimedAt: "2026-08-05T00:00:00Z",
				createdAt: "2026-08-05T00:00:00Z",
				key: "bocxcbnu",
				state: "running",
				steps: [],
				user: { id: 1, handle: "bob", administrator_role: null },
				workflow: "create_subtraction",
			});

			return;
		}

		if (request.path.endsWith("/ping")) {
			respondJson(response, 200, {
				cancelled,
				pingedAt: "2026-08-05T00:00:00Z",
			});

			return;
		}

		if (request.path === `/jobs/${JOB_ID}`) {
			respondJson(response, 200, {
				id: JOB_ID,
				args: { subtraction_id: "foo" },
				claim: null,
				claimedAt: null,
				createdAt: "2026-08-05T00:00:00Z",
				pingedAt: null,
				progress: 0,
				state: "running",
				steps: null,
				user: { id: 1, handle: "bob", administrator_role: null },
				workflow: "create_subtraction",
			});

			return;
		}

		respondJson(response, 200, {});
	};
}

function createWorkflow(steps: WorkflowStep<Data, State>[]) {
	return defineWorkflow<Data, State>({
		name: "create_subtraction",
		buildContext: async () => ({}) as Data,
		createState: () => ({ visited: [] }),
		steps,
	});
}

function step(
	id: string,
	run: (context: WorkflowContext<Data, State>) => Promise<void> = async (
		context,
	) => {
		context.state.visited.push(id);
	},
): WorkflowStep<Data, State> {
	return { id, description: `runs ${id}`, run };
}

let server: TestServer | undefined;
let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "workflow-app-"));
});

afterEach(async () => {
	await server?.close();
	await rm(root, { recursive: true, force: true });

	server = undefined;
});

function createConfig(overrides: Partial<WorkflowRunConfig> = {}) {
	if (!server) {
		throw new Error("start the server first");
	}

	return {
		jobsApiUrl: server.baseUrl,
		mem: 4,
		proc: 2,
		workflow: "create_subtraction",
		workPath: join(root, "work"),
		timeout: 30,
		image: "unknown",
		...overrides,
	} satisfies WorkflowRunConfig;
}

async function run(
	workflow: ReturnType<typeof createWorkflow>,
	options: {
		config?: Partial<WorkflowRunConfig>;
		logger?: ReturnType<typeof createRecordingLogger>;
	} = {},
) {
	const codes: number[] = [];
	const recording = options.logger ?? createRecordingLogger();

	await runWorkflowApp({
		workflow,
		config: createConfig(options.config),
		runtimeVersion: "1.2.3",
		workflowVersion: "4.5.6",
		exit: (code) => codes.push(code),
		logger: recording.logger,
	});

	return { code: codes.at(-1), codes, records: recording.records };
}

describe("a successful run", () => {
	it("exits 0 and reports every step and the finish", async () => {
		server = await startTestServer(createHandler({}));

		const { code } = await run(
			createWorkflow([step("prepare"), step("map_default_isolates")]),
		);

		expect(code).toBe(EXIT_OK);

		const paths = server.requests.map(
			(request) => `${request.method} ${request.path}`,
		);

		expect(paths).toContain(`POST /jobs/${JOB_ID}/steps/prepare/start`);
		expect(paths).toContain(
			`POST /jobs/${JOB_ID}/steps/map_default_isolates/start`,
		);
		expect(paths).toContain(`POST /jobs/${JOB_ID}/finish`);
	});

	it("reports the step's id rather than its display name", async () => {
		server = await startTestServer(createHandler({}));

		await run(createWorkflow([step("map_default_isolates")]));

		expect(
			server.requests.some((request) =>
				request.path.includes("/steps/Map Default Isolates/"),
			),
		).toBe(false);
	});

	it("hands the workflow the args read back from the job", async () => {
		server = await startTestServer(createHandler({}));

		let args: unknown;

		await run(
			createWorkflow([
				step("prepare", async (context) => {
					args = context.job.args;
				}),
			]),
		);

		expect(args).toEqual({ subtraction_id: "foo" });
	});
});

describe("a failed run", () => {
	it("exits 0, logs the error, and never reports a finish", async () => {
		server = await startTestServer(createHandler({}));

		const { code, records } = await run(
			createWorkflow([
				step("prepare", () => Promise.reject(new Error("step blew up"))),
			]),
		);

		expect(code).toBe(EXIT_OK);

		expect(
			server.requests.some((request) => request.path.endsWith("/finish")),
		).toBe(false);

		expect(
			records().some(
				(record) => record.level === 50 && record.msg === "workflow failed",
			),
		).toBe(true);
	});
});

describe("cancellation", () => {
	it("exits 0 when a ping reports the job cancelled", async () => {
		server = await startTestServer(createHandler({ cancelled: true }));

		const { code } = await run(
			createWorkflow([
				step(
					"wait",
					(context) =>
						new Promise<void>((resolve) => {
							context.signal.addEventListener("abort", () => resolve(), {
								once: true,
							});
						}),
				),
			]),
		);

		expect(code).toBe(EXIT_OK);

		expect(
			server.requests.some((request) => request.path.endsWith("/finish")),
		).toBe(false);
	});
});

describe("termination", () => {
	it("exits 124 when sigterm arrives while polling for a job", async () => {
		server = await startTestServer(createHandler({ claimStatus: 404 }));

		const workflow = createWorkflow([step("prepare")]);

		const promise = run(workflow);

		// The handler is installed before the claim, unlike Python's, so a pod
		// terminated while polling reports 124 rather than dying on node's default.
		await new Promise<void>((resolve) => {
			const wait = setInterval(() => {
				if ((server?.requests.length ?? 0) > 0) {
					clearInterval(wait);
					resolve();
				}
			}, 5);
		});

		process.emit("SIGTERM", "SIGTERM");

		const { code } = await promise;

		expect(code).toBe(EXIT_TERMINATED);
	});

	it("exits 124 when sigterm arrives mid-run", async () => {
		server = await startTestServer(createHandler({}));

		const { code } = await run(
			createWorkflow([
				step("wait", (context) => {
					process.emit("SIGTERM", "SIGTERM");

					return new Promise<void>((resolve) => {
						context.signal.addEventListener("abort", () => resolve(), {
							once: true,
						});
					});
				}),
			]),
		);

		expect(code).toBe(EXIT_TERMINATED);
	});

	it("exits 124 when sigterm arrives while preparing the run", async () => {
		server = await startTestServer(createHandler({}));

		// An abort-aware buildContext forwards the run's signal, so a termination
		// arriving here surfaces as a rejection. Reading that as a broken pod
		// would have the ScaledJob retry one that was deliberately stopped.
		const workflow = defineWorkflow<Data, State>({
			name: "create_subtraction",
			buildContext: () => {
				process.emit("SIGTERM", "SIGTERM");

				return Promise.reject(new Error("aborted"));
			},
			createState: () => ({ visited: [] }),
			steps: [step("prepare")],
		});

		const { code } = await run(workflow);

		expect(code).toBe(EXIT_TERMINATED);
	});

	it("removes its sigterm handler when the run is over", async () => {
		server = await startTestServer(createHandler({}));

		const before = process.listenerCount("SIGTERM");

		await run(createWorkflow([step("prepare")]));

		expect(process.listenerCount("SIGTERM")).toBe(before);
	});
});

describe("no job claimed", () => {
	it("exits 0 after the claim times out", async () => {
		server = await startTestServer(createHandler({ claimStatus: 404 }));

		const { code, records } = await run(createWorkflow([step("prepare")]), {
			config: { timeout: 1 },
		});

		expect(code).toBe(EXIT_OK);

		expect(
			records().some(
				(record) => record.msg === "timed out while waiting for job",
			),
		).toBe(true);
	});
});

describe("infrastructure failures", () => {
	it("exits 1 when the claim call fails outright", async () => {
		server = await startTestServer(createHandler({ claimStatus: 500 }));

		const { code } = await run(createWorkflow([step("prepare")]));

		expect(code).toBe(EXIT_INFRASTRUCTURE_FAILURE);
	});

	it("exits 1 when the work path cannot be prepared", async () => {
		server = await startTestServer(createHandler({}));

		const workPath = join(root, "occupied");

		await writeFile(workPath, "not a directory");

		const { code } = await run(createWorkflow([step("prepare")]), {
			config: { workPath },
		});

		expect(code).toBe(EXIT_INFRASTRUCTURE_FAILURE);
	});

	it("exits 1 when buildContext throws", async () => {
		server = await startTestServer(createHandler({}));

		const workflow = defineWorkflow<Data, State>({
			name: "create_subtraction",
			buildContext: () => Promise.reject(new Error("no reference")),
			createState: () => ({ visited: [] }),
			steps: [step("prepare")],
		});

		const { code } = await run(workflow);

		expect(code).toBe(EXIT_INFRASTRUCTURE_FAILURE);
	});
});

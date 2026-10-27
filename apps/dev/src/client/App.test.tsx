// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Snapshot } from "../shared/types.ts";
import App from "./App.tsx";

const snapshot: Snapshot = {
	defaultAdministrator: null,
	environments: [
		{
			age: 1,
			branch: "feature/test",
			createDefaultAdministrator: true,
			desired: "up",
			id: "environment",
			lastError: null,
			name: "feature-test-123456",
			observed: "running",
			openPullRequest: null,
			operation: null,
			path: "/repo/worktree",
			ready: true,
			services: { web: "healthy" },
			url: "https://feature-test-123456.localhost:9443",
			workflowEnabled: true,
			worktreeId: "worktree",
		},
	],
	repositoryId: "repository",
	scheduler: {
		active: [],
		buildQueue: [],
		capacity: 1,
		concurrency: 1,
		errors: {},
		lastError: null,
		queues: {},
	},
	shared: {
		initialized: true,
		lastError: null,
		services: {},
		storage: { azurite: 2_500_000, postgres: 1_500_000 },
	},
	updatedAt: 1,
	updateAvailable: false,
};

let connection = "live";
const initial = structuredClone(snapshot);
vi.mock("./store.ts", () => ({
	useSnapshot: () => ({ snapshot, connection }),
}));
afterEach(cleanup);

function getEnvironment() {
	const environment = snapshot.environments[0];
	if (!environment) {
		throw new Error("Missing test environment");
	}
	return environment;
}

async function openEnvironmentDetails(): Promise<void> {
	await userEvent
		.setup()
		.click(screen.getByRole("link", { name: "View details for feature/test" }));
}

async function renderApp() {
	const result = render(<App />);
	await screen.findByRole("heading", { name: "Development environments" });
	return result;
}

beforeEach(() => {
	window.history.replaceState(null, "", "/");
	vi.stubGlobal("scrollTo", vi.fn());
	Object.assign(snapshot, structuredClone(initial));
	connection = "live";
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(null, { status: 202 })),
	);
	vi.stubGlobal(
		"confirm",
		vi.fn(() => false),
	);
});

it("shows live environment state and confirms destructive removal", async () => {
	const user = userEvent.setup();
	await renderApp();
	expect(screen.getByText("feature/test")).toBeInTheDocument();
	expect(screen.getByText("Ready")).toBeInTheDocument();
	expect(screen.queryByText("/repo/worktree")).not.toBeInTheDocument();
	await user.click(
		screen.getByRole("link", { name: "View details for feature/test" }),
	);
	expect(screen.getByText("/repo/worktree")).toBeVisible();
	await user.click(
		screen.getByRole("button", { name: "Delete environment data" }),
	);
	expect(window.confirm).toHaveBeenCalled();
	expect(fetch).not.toHaveBeenCalledWith(
		"/api/environments",
		expect.anything(),
	);
	await user.click(screen.getByRole("link", { name: "← Back to worktrees" }));
	expect(screen.queryByText("/repo/worktree")).not.toBeInTheDocument();
});

it("shows the open pull request in the worktree details", async () => {
	getEnvironment().openPullRequest = {
		number: 42,
		url: "https://github.com/virtool/virtool/pull/42",
	};
	await renderApp();
	expect(
		screen.queryByRole("link", { name: "Open PR #42 ↗" }),
	).not.toBeInTheDocument();
	await openEnvironmentDetails();
	expect(screen.getByRole("link", { name: "Open PR #42 ↗" })).toHaveAttribute(
		"href",
		"https://github.com/virtool/virtool/pull/42",
	);
});

it("shows actions for ready, stopped, and failed environments", async () => {
	await renderApp();
	await openEnvironmentDetails();
	expect(screen.getByRole("link", { name: "Open app" })).toHaveAttribute(
		"href",
		getEnvironment().url,
	);
	expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled();
	expect(
		screen.queryByRole("button", { name: "Start" }),
	).not.toBeInTheDocument();
	Object.assign(getEnvironment(), {
		ready: false,
		observed: "stopped",
	});
	await userEvent
		.setup()
		.click(screen.getByRole("link", { name: "← Back to worktrees" }));
	await openEnvironmentDetails();
	expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
	expect(
		screen.queryByRole("link", { name: "Open app" }),
	).not.toBeInTheDocument();
	Object.assign(getEnvironment(), {
		observed: "failed",
		lastError: "Build failed",
	});
	await userEvent
		.setup()
		.click(screen.getByRole("link", { name: "← Back to worktrees" }));
	await openEnvironmentDetails();
	expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
	expect(screen.getByRole("alert")).toHaveTextContent("Build failed");
	expect(screen.getByRole("link", { name: "View logs" })).toHaveAttribute(
		"href",
		"/logs?environment=worktree",
	);
});

it("keeps progress visible and prevents conflicting actions", async () => {
	Object.assign(getEnvironment(), {
		ready: false,
		observed: "starting",
		operation: {
			action: "start",
			createdAt: Date.now(),
			error: null,
			finishedAt: null,
			id: 1,
			status: "running",
			progress: "Migrating database",
		},
	});
	await renderApp();
	await openEnvironmentDetails();
	expect(screen.getByText("Migrating database")).toBeVisible();
	expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
});

it("retains the failed startup stage and final elapsed time", async () => {
	Object.assign(getEnvironment(), {
		lastError: "Migration failed",
		observed: "failed",
		operation: {
			action: "start",
			createdAt: 1_000,
			error: "Migration failed",
			finishedAt: 6_500,
			id: 1,
			progress: "running migrations",
			status: "failed",
		},
		ready: false,
	});
	await renderApp();
	await openEnvironmentDetails();
	const timeline = screen.getByRole("region", { name: "Startup timeline" });
	expect(timeline).toHaveTextContent("5s elapsed");
	expect(timeline).toHaveTextContent("Run migrations (failed)");
});

it("marks disconnected snapshots and disables mutations until reconnected", async () => {
	connection = "reconnecting";
	await renderApp();
	expect(screen.getByText(/Showing the last received state/)).toBeVisible();
	await openEnvironmentDetails();
	expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled();
	connection = "live";
	await userEvent
		.setup()
		.click(screen.getByRole("link", { name: "← Back to worktrees" }));
	await openEnvironmentDetails();
	expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled();
});

it("navigates between worktree, shared, workflow, and log views", async () => {
	const user = userEvent.setup();
	await renderApp();
	expect(screen.getByRole("link", { name: "Worktrees" })).toHaveAttribute(
		"aria-current",
		"page",
	);
	expect(screen.getByText("feature/test")).toBeVisible();
	await user.click(screen.getByRole("link", { name: "Shared" }));
	expect(screen.getByRole("region", { name: "Shared" })).toBeVisible();
	expect(screen.getByText("Shared infrastructure")).toBeVisible();
	expect(screen.getByText("1.5 MB")).toBeVisible();
	expect(screen.getByText("2.5 MB")).toBeVisible();
	await user.click(screen.getByRole("link", { name: "Workflows" }));
	expect(screen.getByRole("region", { name: "Workflows" })).toBeVisible();
	expect(
		screen.getByRole("heading", { name: "Workflow scheduler" }),
	).toBeVisible();
	expect(screen.getByLabelText("Global concurrency")).toBeVisible();
	expect(document.querySelector("details")).not.toBeInTheDocument();
	await user.click(screen.getByRole("link", { name: "Logs" }));
	expect(screen.getByRole("heading", { name: "Logs" })).toBeVisible();
});

it("filters, pauses, and scopes log output", async () => {
	vi.mocked(fetch).mockImplementation(async (path) => {
		if (String(path).startsWith("/api/logs")) {
			return new Response("web | listening\ntasks | idle");
		}
		return new Response(null, { status: 202 });
	});
	const user = userEvent.setup();
	await renderApp();
	await user.click(screen.getByRole("link", { name: "Logs" }));
	expect(await screen.findByText(/web \| listening/)).toBeVisible();
	await user.type(
		screen.getByRole("searchbox", { name: "Search logs" }),
		"tasks",
	);
	expect(screen.getByText("tasks | idle")).toBeVisible();
	expect(screen.queryByText(/web \| listening/)).not.toBeInTheDocument();
	const pause = screen.getByRole("button", { name: "Pause scrolling" });
	await user.click(pause);
	expect(
		screen.getByRole("button", { name: "Resume scrolling" }),
	).toHaveAttribute("aria-pressed", "true");
	await user.selectOptions(
		screen.getByRole("combobox", { name: "Environment" }),
		"worktree",
	);
	await user.selectOptions(
		screen.getByRole("combobox", { name: "Service" }),
		"web",
	);
	await user.click(screen.getByRole("button", { name: "Resume scrolling" }));
	expect(
		await screen.findByRole("button", { name: "Pause scrolling" }),
	).toBeVisible();
	expect(fetch).toHaveBeenCalledWith(
		"/api/logs?environment=worktree&service=web",
	);
	expect(screen.getByRole("button", { name: "Copy" })).toBeEnabled();
	expect(screen.getByRole("button", { name: "Download" })).toBeEnabled();
});

it("shows workflow, build, and queue activity by branch", async () => {
	snapshot.scheduler.active = [
		{ environmentId: "environment", workflow: "pathoscope" },
	];
	snapshot.scheduler.buildQueue = [
		{ environmentId: "environment", workflow: "create_sample" },
	];
	snapshot.scheduler.queues = {
		environment: { create_subtraction: 2, nuvs: 1 },
	};
	const user = userEvent.setup();
	await renderApp();
	await user.click(screen.getByRole("link", { name: "Workflows" }));
	const row = screen.getByRole("row", { name: /feature\/test/ });
	expect(within(row).getByText("Pathoscope")).toBeVisible();
	expect(within(row).getByText("Create sample")).toBeVisible();
	expect(within(row).getByText("Create subtraction: 2")).toBeVisible();
	expect(within(row).getByText("NUVs: 1")).toBeVisible();
});

it("shows scheduler failures on the affected branch", async () => {
	snapshot.scheduler.errors = { environment: "Jobs API unavailable" };
	const user = userEvent.setup();
	await renderApp();
	await user.click(screen.getByRole("link", { name: "Workflows" }));
	const row = screen.getByRole("row", { name: /feature\/test/ });
	expect(within(row).getByText("Jobs API unavailable")).toBeVisible();
});

it("restores routed views with browser navigation", async () => {
	const user = userEvent.setup();
	await renderApp();
	await user.click(screen.getByRole("link", { name: "Shared" }));
	expect(window.location.pathname).toBe("/shared");
	await user.click(screen.getByRole("link", { name: "Workflows" }));
	expect(window.location.pathname).toBe("/workflows");
	window.history.back();
	expect(await screen.findByRole("region", { name: "Shared" })).toBeVisible();
	expect(window.location.pathname).toBe("/shared");
	window.history.forward();
	expect(
		await screen.findByRole("region", { name: "Workflows" }),
	).toBeVisible();
	expect(window.location.pathname).toBe("/workflows");
});

it("loads environment detail URLs directly", async () => {
	window.history.replaceState(null, "", "/worktrees/worktree");
	await renderApp();
	expect(screen.getByText("/repo/worktree")).toBeVisible();
	expect(screen.getByRole("link", { name: "Worktrees" })).toHaveAttribute(
		"aria-current",
		"page",
	);
});

it("shows a not-found message for unknown URLs", async () => {
	window.history.replaceState(null, "", "/unknown");
	await renderApp();
	expect(screen.getByRole("alert")).toHaveTextContent("Page not found.");
});

it("keeps the shared tab compatible with older daemon snapshots", async () => {
	delete (snapshot.shared as Partial<typeof snapshot.shared>).storage;
	const user = userEvent.setup();
	await renderApp();
	await user.click(screen.getByRole("link", { name: "Shared" }));
	expect(screen.getByRole("region", { name: "Shared" })).toBeVisible();
	expect(screen.getAllByText("Unavailable")).toHaveLength(2);
});

it("shows infrastructure failures even after initialization", async () => {
	snapshot.shared.services = { postgres: "unhealthy", caddy: "healthy" };
	snapshot.shared.lastError = "Postgres unavailable";
	const user = userEvent.setup();
	await renderApp();
	await user.click(screen.getByRole("link", { name: "Shared" }));
	expect(screen.getByText("Needs attention")).toBeVisible();
	expect(
		screen.getByRole("article", { name: "postgres service" }),
	).toHaveTextContent("postgresVolume usage: 1.5 MBunhealthy");
	expect(
		screen.getByRole("article", { name: "caddy service" }),
	).toHaveTextContent("caddyhealthy");
	expect(screen.getByRole("alert")).toHaveTextContent("Postgres unavailable");
});

it("reports rejected mutations", async () => {
	vi.mocked(fetch).mockImplementation(async (path) =>
		path === "/api/environments"
			? new Response("Unable to stop", { status: 500 })
			: new Response(""),
	);
	const user = userEvent.setup();
	await renderApp();
	await user.click(
		screen.getByRole("link", { name: "View details for feature/test" }),
	);
	await user.click(screen.getByRole("button", { name: "Stop" }));
	expect(await screen.findByRole("alert")).toHaveTextContent("Unable to stop");
	expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled();
});

it("stops all created environments without selection", async () => {
	const user = userEvent.setup();
	await renderApp();
	expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
	await user.click(screen.getByRole("button", { name: "Stop all" }));
	expect(fetch).toHaveBeenCalledWith(
		"/api/environments",
		expect.objectContaining({
			body: JSON.stringify({ action: "stop", worktreeIds: ["worktree"] }),
		}),
	);
});

it("shows worktree actions and toggles workflows", async () => {
	const user = userEvent.setup();
	await renderApp();
	const open = screen.getByRole("link", { name: "Open" });
	expect(open).toHaveAttribute("href", getEnvironment().url);
	expect(open.querySelector(".lucide-external-link")).toBeInTheDocument();
	const workflows = screen.getByRole("button", { name: "Workflows" });
	expect(workflows).toHaveAttribute("aria-pressed", "true");
	expect(workflows.querySelector(".lucide-play")).toBeInTheDocument();
	await user.click(screen.getByRole("button", { name: "Restart" }));
	expect(fetch).toHaveBeenLastCalledWith(
		"/api/environments",
		expect.objectContaining({
			body: JSON.stringify({
				action: "restart",
				worktreeIds: ["worktree"],
			}),
		}),
	);
	await user.click(workflows);
	expect(screen.queryByText("Request accepted.")).not.toBeInTheDocument();
	expect(workflows.querySelector(".lucide-loader-circle")).toHaveClass(
		"animate-spin",
	);
	expect(fetch).toHaveBeenLastCalledWith(
		"/api/environments",
		expect.objectContaining({
			body: JSON.stringify({
				action: "disable_workflows",
				worktreeIds: ["worktree"],
			}),
		}),
	);
	getEnvironment().workflowEnabled = false;
	await openEnvironmentDetails();
	await user.click(screen.getByRole("link", { name: "← Back to worktrees" }));
	const pausedWorkflows = screen.getByRole("button", { name: "Workflows" });
	expect(pausedWorkflows).toHaveAttribute("aria-pressed", "false");
	expect(pausedWorkflows.querySelector(".lucide-pause")).toBeInTheDocument();
});

it("shows progress while a workflow toggle request is pending", async () => {
	vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => undefined));
	const user = userEvent.setup();
	await renderApp();
	const workflows = screen.getByRole("button", { name: "Workflows" });
	await user.click(workflows);
	expect(workflows).toBeDisabled();
	expect(workflows.querySelector(".lucide-loader-circle")).toHaveClass(
		"animate-spin",
	);
	expect(screen.queryByText("Request accepted.")).not.toBeInTheDocument();
});

it("lists uncreated worktrees in their own section", async () => {
	const base = getEnvironment();
	snapshot.environments = [
		{
			...base,
			branch: "uncreated",
			id: null,
			observed: "not_created",
			ready: false,
			url: null,
			worktreeId: "uncreated",
		},
		{
			...base,
			branch: "stopped",
			observed: "stopped",
			ready: false,
			url: null,
			worktreeId: "stopped",
		},
		{
			...base,
			branch: "failed",
			lastError: "Failed",
			observed: "failed",
			ready: false,
			url: null,
			worktreeId: "failed",
		},
		base,
	];
	await renderApp();
	expect(
		screen
			.getAllByRole("link", { name: /View details for/ })
			.map((link) => link.textContent),
	).toEqual(["feature/test", "failed", "stopped", "uncreated"]);
	const uncreated = screen.getByRole("region", { name: "No environment" });
	expect(
		within(uncreated).getByRole("link", {
			name: "View details for uncreated",
		}),
	).toBeVisible();
	expect(within(uncreated).queryByText("not created")).not.toBeInTheDocument();
	expect(
		within(screen.getByRole("region", { name: "Environments" })).queryByText(
			"uncreated",
		),
	).not.toBeInTheDocument();
	await userEvent
		.setup()
		.click(within(uncreated).getByRole("button", { name: "Create" }));
	expect(fetch).toHaveBeenLastCalledWith(
		"/api/environments",
		expect.objectContaining({
			body: JSON.stringify({
				action: "start",
				worktreeIds: ["uncreated"],
			}),
		}),
	);
});

it("saves the default administrator without showing the saved password", async () => {
	snapshot.defaultAdministrator = {
		email: "admin@example.com",
		handle: "admin",
	};
	const user = userEvent.setup();
	await renderApp();
	await user.click(screen.getByRole("link", { name: "Shared" }));

	expect(screen.getByLabelText("Handle")).toHaveValue("admin");
	expect(screen.getByLabelText("Password")).toHaveValue("");
	await user.clear(screen.getByLabelText("Handle"));
	await user.type(screen.getByLabelText("Handle"), "boss");
	await user.click(screen.getByRole("button", { name: "Save" }));

	expect(fetch).toHaveBeenCalledWith(
		"/api/default-administrator",
		expect.objectContaining({
			body: JSON.stringify({
				email: "admin@example.com",
				handle: "boss",
				password: "",
			}),
		}),
	);
	expect(await screen.findByText("Default administrator saved.")).toBeVisible();
});

it("requires a password before the first default administrator save", async () => {
	const user = userEvent.setup();
	await renderApp();
	await user.click(screen.getByRole("link", { name: "Shared" }));
	await user.type(screen.getByLabelText("Handle"), "admin");
	await user.type(screen.getByLabelText("Email"), "admin@example.com");

	expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
	expect(
		screen.queryByRole("button", { name: "Clear" }),
	).not.toBeInTheDocument();
});

it("warns that the default administrator password is plain text", async () => {
	const user = userEvent.setup();
	await renderApp();
	await user.click(screen.getByRole("link", { name: "Shared" }));

	expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
		"The daemon stores this password as plain text and gives it to each environment as plain text. Do not use a real or sensitive password.",
	);
});

it("shows why the daemon rejects a default administrator", async () => {
	vi.mocked(fetch).mockResolvedValueOnce(
		new Response("Reserved user name: virtool", { status: 422 }),
	);
	const user = userEvent.setup();
	await renderApp();
	await user.click(screen.getByRole("link", { name: "Shared" }));
	await user.type(screen.getByLabelText("Handle"), "virtool");
	await user.type(screen.getByLabelText("Email"), "admin@example.com");
	await user.type(screen.getByLabelText("Password"), "hello world");
	await user.click(screen.getByRole("button", { name: "Save" }));

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Reserved user name: virtool",
	);
});

describe("create options", () => {
	beforeEach(() => {
		Object.assign(HTMLDialogElement.prototype, {
			close(this: HTMLDialogElement) {
				this.removeAttribute("open");
				this.dispatchEvent(new Event("close"));
			},
			showModal(this: HTMLDialogElement) {
				this.setAttribute("open", "");
			},
		});
		snapshot.environments = [
			{
				...getEnvironment(),
				branch: "feature/new",
				id: null,
				observed: "not_created",
				ready: false,
				url: null,
				worktreeId: "new",
			},
		];
		snapshot.defaultAdministrator = {
			email: "admin@example.com",
			handle: "admin",
		};
	});

	function getRequestBody() {
		const [, init] = vi.mocked(fetch).mock.lastCall ?? [];
		return JSON.parse(String(init?.body));
	}

	it("creates with the default from the main button", async () => {
		const user = userEvent.setup();
		await renderApp();

		await user.click(screen.getByRole("button", { name: "Create" }));

		expect(getRequestBody()).toEqual({
			action: "start",
			worktreeIds: ["new"],
		});
	});

	it("creates without the default administrator from the dialog", async () => {
		const user = userEvent.setup();
		await renderApp();

		await user.click(
			screen.getByRole("button", { name: "More create options" }),
		);
		const dialog = screen.getByRole("dialog", { name: "Create environment" });
		expect(within(dialog).getByText("feature/new")).toBeVisible();
		const checkbox = within(dialog).getByRole("checkbox", {
			name: "Create default administrator",
		});
		expect(checkbox).toBeChecked();
		await user.click(checkbox);
		await user.click(within(dialog).getByRole("button", { name: "Create" }));

		expect(getRequestBody()).toEqual({
			action: "start",
			createDefaultAdministrator: false,
			worktreeIds: ["new"],
		});
		expect(dialog).not.toHaveAttribute("open");
	});

	it("closes the dialog without a request on cancel", async () => {
		const user = userEvent.setup();
		await renderApp();

		await user.click(
			screen.getByRole("button", { name: "More create options" }),
		);
		const dialog = screen.getByRole("dialog", { name: "Create environment" });
		await user.click(within(dialog).getByRole("checkbox"));
		await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

		expect(dialog).not.toHaveAttribute("open");
		expect(fetch).not.toHaveBeenCalled();
		await user.click(
			screen.getByRole("button", { name: "More create options" }),
		);
		expect(within(dialog).getByRole("checkbox")).toBeChecked();
	});

	it("disables the checkbox when no default administrator is set", async () => {
		snapshot.defaultAdministrator = null;
		const user = userEvent.setup();
		await renderApp();

		await user.click(
			screen.getByRole("button", { name: "More create options" }),
		);
		const dialog = screen.getByRole("dialog", { name: "Create environment" });
		expect(within(dialog).getByRole("checkbox")).toBeDisabled();
		expect(
			within(dialog).getByRole("link", { name: "Shared" }),
		).toHaveAttribute("href", "/shared");
		await user.click(within(dialog).getByRole("button", { name: "Create" }));

		expect(getRequestBody()).toEqual({
			action: "start",
			worktreeIds: ["new"],
		});
	});
});

it("shows when an environment does not create the default administrator", async () => {
	getEnvironment().createDefaultAdministrator = false;
	await renderApp();
	await openEnvironmentDetails();

	expect(screen.getByText("Default administrator: off")).toBeVisible();
});

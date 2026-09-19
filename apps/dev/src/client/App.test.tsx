// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Snapshot } from "../shared/types.ts";
import App from "./App.tsx";

const snapshot: Snapshot = {
	environments: [
		{
			age: 1,
			branch: "feature/test",
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
});

it("keeps progress visible and prevents conflicting actions", async () => {
	Object.assign(getEnvironment(), {
		ready: false,
		observed: "starting",
		operation: {
			action: "start",
			status: "running",
			progress: "Migrating database",
		},
	});
	await renderApp();
	await openEnvironmentDetails();
	expect(screen.getByText("Migrating database")).toBeVisible();
	expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
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

it("navigates between worktree, shared, workflow, and daemon log views", async () => {
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
	await user.click(screen.getByRole("link", { name: "Daemon log" }));
	expect(screen.getByRole("heading", { name: "Daemon log" })).toBeVisible();
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

it("sorts ready and failed environments above uncreated worktrees", async () => {
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
	expect(screen.getByText("Not created")).toBeVisible();
	await userEvent.setup().click(screen.getByRole("button", { name: "Create" }));
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

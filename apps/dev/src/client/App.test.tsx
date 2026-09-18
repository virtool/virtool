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
		.click(
			screen.getByRole("button", { name: "View details for feature/test" }),
		);
}

beforeEach(() => {
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
	render(<App />);
	expect(screen.getByText("feature/test")).toBeInTheDocument();
	expect(screen.getByText("Ready")).toBeInTheDocument();
	expect(screen.queryByText("/repo/worktree")).not.toBeInTheDocument();
	await user.click(
		screen.getByRole("button", { name: "View details for feature/test" }),
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
	await user.click(screen.getByRole("button", { name: "← Back to worktrees" }));
	expect(screen.queryByText("/repo/worktree")).not.toBeInTheDocument();
});

it("shows the open pull request in the worktree details", async () => {
	getEnvironment().openPullRequest = {
		number: 42,
		url: "https://github.com/virtool/virtool/pull/42",
	};
	render(<App />);
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
	const { rerender } = render(<App />);
	await openEnvironmentDetails();
	expect(screen.getByRole("link", { name: "Open app ↗" })).toHaveAttribute(
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
	rerender(<App />);
	expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
	expect(
		screen.queryByRole("link", { name: "Open app ↗" }),
	).not.toBeInTheDocument();
	Object.assign(getEnvironment(), {
		observed: "failed",
		lastError: "Build failed",
	});
	rerender(<App />);
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
	render(<App />);
	await openEnvironmentDetails();
	expect(screen.getByText("Migrating database")).toBeVisible();
	expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
});

it("marks disconnected snapshots and disables mutations until reconnected", async () => {
	connection = "reconnecting";
	const { rerender } = render(<App />);
	expect(screen.getByText(/Showing the last received state/)).toBeVisible();
	await openEnvironmentDetails();
	expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled();
	connection = "live";
	rerender(<App />);
	expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled();
});

it("switches between worktree, shared, workflow, and daemon log tabs", async () => {
	const user = userEvent.setup();
	render(<App />);
	expect(screen.getByRole("tab", { name: "Worktrees" })).toHaveAttribute(
		"aria-selected",
		"true",
	);
	expect(screen.getByText("feature/test")).toBeVisible();
	await user.click(screen.getByRole("tab", { name: "Shared" }));
	expect(screen.getByRole("tabpanel", { name: "Shared" })).toBeVisible();
	expect(screen.getByText("Shared infrastructure")).toBeVisible();
	expect(screen.getByText("1.5 MB")).toBeVisible();
	expect(screen.getByText("2.5 MB")).toBeVisible();
	await user.click(screen.getByRole("tab", { name: "Workflows" }));
	expect(screen.getByRole("tabpanel", { name: "Workflows" })).toBeVisible();
	expect(screen.getByText(/Workflow scheduler/)).toBeVisible();
	await user.click(screen.getByRole("tab", { name: "Daemon log" }));
	expect(screen.getByRole("tabpanel", { name: "Daemon log" })).toBeVisible();
	expect(screen.getByRole("heading", { name: "Daemon log" })).toBeVisible();
});

it("keeps the shared tab compatible with older daemon snapshots", async () => {
	delete (snapshot.shared as Partial<typeof snapshot.shared>).storage;
	const user = userEvent.setup();
	render(<App />);
	await user.click(screen.getByRole("tab", { name: "Shared" }));
	expect(screen.getByRole("tabpanel", { name: "Shared" })).toBeVisible();
	expect(screen.getAllByText("Unavailable")).toHaveLength(2);
});

it("shows infrastructure failures even after initialization", async () => {
	snapshot.shared.services = { postgres: "unhealthy", caddy: "healthy" };
	snapshot.shared.lastError = "Postgres unavailable";
	const user = userEvent.setup();
	render(<App />);
	await user.click(screen.getByRole("tab", { name: "Shared" }));
	expect(screen.getByText("Needs attention")).toBeVisible();
	expect(
		screen.getByRole("article", { name: "postgres service" }),
	).toHaveTextContent("postgresunhealthy");
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
	render(<App />);
	await user.click(
		screen.getByRole("button", { name: "View details for feature/test" }),
	);
	await user.click(screen.getByRole("button", { name: "Stop" }));
	expect(await screen.findByRole("alert")).toHaveTextContent("Unable to stop");
	expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled();
});

it("only offers bulk actions after selection", async () => {
	const user = userEvent.setup();
	render(<App />);
	expect(
		screen.queryByRole("button", { name: "Stop selected" }),
	).not.toBeInTheDocument();
	await user.click(
		screen.getByRole("checkbox", { name: "Select feature/test" }),
	);
	await user.click(screen.getByRole("button", { name: "Stop selected" }));
	expect(fetch).toHaveBeenCalledWith(
		"/api/environments",
		expect.objectContaining({
			body: JSON.stringify({ action: "stop", worktreeIds: ["worktree"] }),
		}),
	);
	expect(
		screen.queryByRole("button", { name: "Stop selected" }),
	).not.toBeInTheDocument();
});

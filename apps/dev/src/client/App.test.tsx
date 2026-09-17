// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
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
		queues: {},
	},
	shared: { initialized: true, lastError: null, services: {} },
	updatedAt: 1,
	updateAvailable: false,
};

vi.mock("./store.ts", () => ({ useSnapshot: () => snapshot }));

beforeEach(() => {
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
	expect(screen.getByText("ready")).toBeInTheDocument();
	await user.click(screen.getByRole("button", { name: "Remove" }));
	expect(window.confirm).toHaveBeenCalled();
	expect(fetch).not.toHaveBeenCalledWith(
		"/api/environments",
		expect.anything(),
	);
});

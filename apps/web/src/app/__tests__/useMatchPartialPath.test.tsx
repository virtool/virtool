import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMatchPartialPath } from "../useMatchPartialPath";

function TestHarness({ path, exclude }: { path: string; exclude?: string[] }) {
	const result = useMatchPartialPath(path, exclude);
	return <span data-testid="result">{String(result)}</span>;
}

async function renderWithTanStackRouter(
	ui: React.ReactElement,
	initialPath: string,
) {
	const rootRoute = createRootRoute({ component: () => <Outlet /> });
	const catchAllRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "$",
		component: () => ui,
	});
	rootRoute.addChildren([catchAllRoute]);

	const router = createRouter({
		routeTree: rootRoute,
		history: createMemoryHistory({ initialEntries: [initialPath] }),
		defaultPendingMinMs: 0,
	});

	await router.load();
	return render(<RouterProvider router={router} />);
}

async function getResult() {
	const el = await screen.findByTestId("result");
	return el.textContent === "true";
}

describe("useMatchPartialPath()", () => {
	it("should match the router's pathname", async () => {
		await renderWithTanStackRouter(
			<TestHarness path="/samples" />,
			"/samples/abc123",
		);

		expect(await getResult()).toBe(true);
	});
});

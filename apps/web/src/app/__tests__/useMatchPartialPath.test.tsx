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

describe("useMatchPartialPath (tanstack)", () => {
	it("returns true when location starts with path", async () => {
		await renderWithTanStackRouter(
			<TestHarness path="/samples" />,
			"/samples/abc123",
		);

		expect(await getResult()).toBe(true);
	});

	it("returns true for exact match", async () => {
		await renderWithTanStackRouter(<TestHarness path="/samples" />, "/samples");

		expect(await getResult()).toBe(true);
	});

	it("returns false when location does not start with path", async () => {
		await renderWithTanStackRouter(
			<TestHarness path="/samples" />,
			"/refs/abc123",
		);

		expect(await getResult()).toBe(false);
	});

	it("strips trailing slashes from path before matching", async () => {
		await renderWithTanStackRouter(
			<TestHarness path="/samples/" />,
			"/samples/abc123",
		);

		expect(await getResult()).toBe(true);
	});

	it("strips query parameters from path before matching", async () => {
		await renderWithTanStackRouter(
			<TestHarness path="/samples?page=1" />,
			"/samples/abc123",
		);

		expect(await getResult()).toBe(true);
	});

	it("returns false when location is in exclude list", async () => {
		await renderWithTanStackRouter(
			<TestHarness path="/refs" exclude={["/refs/settings"]} />,
			"/refs/settings",
		);

		expect(await getResult()).toBe(false);
	});

	it("returns false when location is below an excluded path", async () => {
		await renderWithTanStackRouter(
			<TestHarness path="/refs" exclude={["/refs/beta"]} />,
			"/refs/beta/reference-id",
		);

		expect(await getResult()).toBe(false);
	});

	it("returns true when location matches and is not excluded", async () => {
		await renderWithTanStackRouter(
			<TestHarness path="/refs" exclude={["/refs/settings"]} />,
			"/refs/abc123",
		);

		expect(await getResult()).toBe(true);
	});

	it("does not match partial segments", async () => {
		await renderWithTanStackRouter(<TestHarness path="/sample" />, "/samples");

		expect(await getResult()).toBe(false);
	});

	it("does not match all paths when given root path", async () => {
		await renderWithTanStackRouter(<TestHarness path="/" />, "/samples");

		expect(await getResult()).toBe(false);
	});

	it("matches root path exactly", async () => {
		await renderWithTanStackRouter(<TestHarness path="/" />, "/");

		expect(await getResult()).toBe(true);
	});
});

import { accountQueryKeys } from "@account/keys";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createTestQueryClient, renderWithProviders } from "@tests/setup";
import type { TimeFormat } from "@virtool/contracts";
import { type ReactNode, useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Time from "../Time";

const fakeTime = new Date("2019-02-10T17:11:00.000000Z");

let forceDateHarnessRender: () => void;

/**
 * Re-renders in place, handing `Time` a fresh `Date` instance each time,
 * the way a refetched server function does — every response is deserialized on
 * its own, so an unchanged timestamp still arrives as a new `Date`.
 * `rerender()` cannot stand in for this: it re-renders the unwrapped element,
 * which remounts the tree rather than re-rendering it.
 */
function DateHarness() {
	const [, setRenderCount] = useState(0);
	forceDateHarnessRender = () => setRenderCount((count) => count + 1);

	return <Time time={new Date("2019-04-22T10:20:20Z")} />;
}

/** Render with a signed-in account that prefers `timeFormat`. */
function renderWithTimeFormat(ui: ReactNode, timeFormat: TimeFormat) {
	const queryClient = createTestQueryClient();
	const account = createFakeAccount();

	queryClient.setQueryData(accountQueryKeys.all(), {
		...account,
		settings: { ...account.settings, timeFormat },
	});

	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	);
}

describe("<Time />", () => {
	beforeAll(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2019-04-22T10:20:30Z"));
	});

	it("should re-render when time string changes", () => {
		vi.useFakeTimers().setSystemTime(new Date("2019-04-22T10:20:30Z"));

		// Render with time that is only 10 seconds before the current (mocked) time.
		renderWithProviders(<Time time={new Date("2019-04-22T10:20:20Z")} />);
		expect(screen.getByText("10 seconds ago")).toBeInTheDocument();

		act(() => {
			vi.setSystemTime(new Date("2019-04-22T10:20:32Z"));
			vi.advanceTimersByTime(8000);
		});

		expect(screen.getByText("20 seconds ago")).toBeInTheDocument();
	});

	it("should keep ticking when re-rendered with an equal Date instance", () => {
		vi.useFakeTimers().setSystemTime(new Date("2019-04-22T10:20:30Z"));

		renderWithProviders(<DateHarness />);
		expect(screen.getByText("10 seconds ago")).toBeInTheDocument();

		// Re-render part-way to the tick. Any implementation that keys the ticker
		// on the Date's identity rather than its instant restarts it here, so a
		// component re-rendering more often than every 8s would never tick at all.
		act(() => {
			vi.advanceTimersByTime(5000);
		});
		act(() => {
			forceDateHarnessRender();
		});

		// Four seconds more: past the 8s mark for a ticker started on mount, but
		// short of a full period for one restarted by the re-render above.
		act(() => {
			vi.advanceTimersByTime(4000);
		});

		expect(screen.getByText("18 seconds ago")).toBeInTheDocument();
	});

	it("should drive every instance from a single shared interval", () => {
		vi.useFakeTimers().setSystemTime(new Date("2019-04-22T10:20:30Z"));

		const setInterval = vi.spyOn(window, "setInterval");
		const clearInterval = vi.spyOn(window, "clearInterval");

		const { unmount } = renderWithProviders(
			<>
				<Time time={new Date("2019-04-22T10:20:20Z")} />
				<Time time={new Date("2019-04-22T10:20:20Z")} />
				<Time time={new Date("2019-04-22T10:20:20Z")} />
			</>,
		);

		expect(screen.getAllByText("10 seconds ago")).toHaveLength(3);
		expect(setInterval).toHaveBeenCalledTimes(1);

		// One tick refreshes all three in a single batched render.
		act(() => {
			vi.advanceTimersByTime(8000);
		});

		expect(screen.getAllByText("18 seconds ago")).toHaveLength(3);

		// The ticker is torn down once the last instance unmounts.
		unmount();
		expect(clearInterval).toHaveBeenCalledTimes(1);

		// And starts again for a later mount. Navigating away from a list and back
		// must not leave the page with a clock that never ticks.
		renderWithProviders(<Time time={new Date("2019-04-22T10:20:20Z")} />);
		expect(setInterval).toHaveBeenCalledTimes(2);

		setInterval.mockRestore();
		clearInterval.mockRestore();
	});

	it("should show the absolute time in a tooltip on focus", () => {
		vi.useFakeTimers().setSystemTime(new Date("2019-04-22T10:20:30Z"));

		renderWithTimeFormat(<Time time={fakeTime} />, "relative");

		act(() => {
			screen.getByRole("button", { name: "2 months ago" }).focus();
		});

		expect(screen.getByRole("tooltip")).toHaveTextContent("2019-02-10 17:11");
	});

	it("should show the relative time in a tooltip on tap", () => {
		vi.useFakeTimers().setSystemTime(new Date("2019-04-22T10:20:30Z"));

		renderWithTimeFormat(<Time time={fakeTime} />, "absolute");

		fireEvent.click(screen.getByRole("button", { name: "Feb 10 at 17:11" }));

		expect(screen.getByRole("tooltip")).toHaveTextContent("2 months ago");
	});

	it("should read 'on' or 'today at' before an absolute time in a sentence", () => {
		vi.useFakeTimers().setSystemTime(new Date("2019-04-22T10:20:30Z"));

		const { container, unmount } = renderWithTimeFormat(
			<p>
				Added <Time sentence time={fakeTime} />
			</p>,
			"absolute",
		);

		expect(container).toHaveTextContent("Added on Feb 10 at 17:11");

		unmount();

		const relative = renderWithTimeFormat(
			<p>
				Added <Time sentence time={fakeTime} />
			</p>,
			"relative",
		);

		expect(relative.container).toHaveTextContent("Added 2 months ago");

		relative.unmount();

		const today = renderWithTimeFormat(
			<p>
				Added <Time sentence time={new Date("2019-04-22T08:05:00Z")} />
			</p>,
			"absolute",
		);

		expect(today.container).toHaveTextContent("Added today at 08:05");
	});

	afterAll(() => {
		vi.useRealTimers();
	});
});

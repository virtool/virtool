import { act, screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import RelativeTime from "../RelativeTime";

const fakeTime = new Date("2019-02-10T17:11:00.000000Z");

let forceDateHarnessRender: () => void;

/**
 * Re-renders in place, handing `RelativeTime` a fresh `Date` instance each time,
 * the way a refetched server function does — every response is deserialized on
 * its own, so an unchanged timestamp still arrives as a new `Date`.
 * `rerender()` cannot stand in for this: it re-renders the unwrapped element,
 * which remounts the tree rather than re-rendering it.
 */
function DateHarness() {
	const [, setRenderCount] = useState(0);
	forceDateHarnessRender = () => setRenderCount((count) => count + 1);

	return <RelativeTime time={new Date("2019-04-22T10:20:20Z")} />;
}

describe("<RelativeTime />", () => {
	beforeAll(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2019-04-22T10:20:30Z"));
	});

	it("should render 2 months ago", () => {
		renderWithProviders(<RelativeTime time={fakeTime} />);
		expect(screen.getByText("2 months ago")).toHaveTextContent("2 months ago");
	});

	it("should re-render when time prop changes", () => {
		const { rerender } = renderWithProviders(<RelativeTime time={fakeTime} />);
		expect(screen.getByText("2 months ago")).toBeInTheDocument();

		// Add one month to the time prop.
		rerender(<RelativeTime time={new Date("2019-01-10T12:21:00.000000Z")} />);

		expect(screen.queryByText("2 months ago")).toBeNull();
		expect(screen.getByText("3 months ago")).toBeInTheDocument();
	});

	it("should re-render when time string changes", () => {
		vi.useFakeTimers().setSystemTime(new Date("2019-04-22T10:20:30Z"));

		// Render with time that is only 10 seconds before the current (mocked) time.
		renderWithProviders(
			<RelativeTime time={new Date("2019-04-22T10:20:20Z")} />,
		);
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
				<RelativeTime time={new Date("2019-04-22T10:20:20Z")} />
				<RelativeTime time={new Date("2019-04-22T10:20:20Z")} />
				<RelativeTime time={new Date("2019-04-22T10:20:20Z")} />
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
		renderWithProviders(
			<RelativeTime time={new Date("2019-04-22T10:20:20Z")} />,
		);
		expect(setInterval).toHaveBeenCalledTimes(2);

		setInterval.mockRestore();
		clearInterval.mockRestore();
	});

	afterAll(() => {
		vi.useRealTimers();
	});
});

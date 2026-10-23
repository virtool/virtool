import { act, fireEvent, render, screen } from "@testing-library/react";
import { CLIENT_ERROR_NAME } from "@virtool/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RouteError from "../RouteError";

const { invalidate } = vi.hoisted(() => ({ invalidate: vi.fn() }));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	useRouter: () => ({ invalidate }),
}));

function clientError(status: number): Error {
	const error = Object.assign(new Error(`Request failed: ${status}`), {
		status,
	});
	error.name = CLIENT_ERROR_NAME;
	return error;
}

function renderError(error: Error) {
	return render(
		<RouteError error={error} reset={vi.fn()} info={{ componentStack: "" }} />,
	);
}

describe("RouteError", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		invalidate.mockReset();
	});

	it("shows an outage and retries it until the service is back", () => {
		const { unmount } = renderError(clientError(503));

		expect(
			screen.getByText("Virtool is temporarily unavailable"),
		).toBeInTheDocument();
		expect(invalidate).not.toHaveBeenCalled();

		act(() => {
			vi.advanceTimersByTime(10_000);
		});
		expect(invalidate).toHaveBeenCalledTimes(2);

		unmount();
		act(() => {
			vi.advanceTimersByTime(10_000);
		});
		expect(invalidate).toHaveBeenCalledTimes(2);
	});

	it("retries an outage on request", () => {
		renderError(clientError(503));

		fireEvent.click(screen.getByRole("button", { name: "Try again" }));

		expect(invalidate).toHaveBeenCalledTimes(1);
	});

	it("leaves other failures to the user to retry", () => {
		renderError(clientError(500));

		expect(screen.getByText("Something went wrong")).toBeInTheDocument();

		act(() => {
			vi.advanceTimersByTime(10_000);
		});
		expect(invalidate).not.toHaveBeenCalled();
	});
});

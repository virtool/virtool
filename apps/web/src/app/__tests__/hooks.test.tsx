import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "../hooks";

describe("useDebounce()", () => {
	it("should commit the draft once it has been stable for the delay", async () => {
		const onChange = vi.fn();

		const { result } = renderHook(() => useDebounce<string>("", onChange, 10));

		act(() => result.current[1]("Foo"));
		expect(result.current[0]).toBe("Foo");
		expect(onChange).not.toHaveBeenCalled();

		await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

		expect(onChange).toHaveBeenCalledExactlyOnceWith("Foo");
	});

	it("should not blank the draft while an async commit's echo is pending", async () => {
		// A router-backed onChange updates ``value`` a render later, so the render
		// triggered by the commit still sees the stale, pre-commit value. The draft
		// must survive that render rather than briefly flashing the placeholder.
		const onChange = vi.fn();

		const { result, rerender } = renderHook(
			({ value }) => useDebounce(value, onChange, 10),
			{ initialProps: { value: "" } },
		);

		act(() => result.current[1]("Foo"));

		await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
		expect(onChange).toHaveBeenCalledWith("Foo");

		// The echo has not landed: ``value`` is still the pre-commit "".
		rerender({ value: "" });
		expect(result.current[0]).toBe("Foo");

		// Once it lands, the draft simply stays put.
		rerender({ value: "Foo" });
		expect(result.current[0]).toBe("Foo");
	});

	it("should abandon a pending commit when the value changes externally", async () => {
		const onChange = vi.fn();

		const { result, rerender } = renderHook(
			({ value }) => useDebounce(value, onChange, 10),
			{ initialProps: { value: "ferret" } },
		);

		act(() => result.current[1]("ferrets"));

		// Something outside clears the term before the delay elapses.
		rerender({ value: "" });
		expect(result.current[0]).toBe("");

		await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

		expect(onChange).not.toHaveBeenCalled();
	});
});

describe("useToday()", () => {
	const originalTimeZone = process.env.TZ;

	afterEach(() => {
		process.env.TZ = originalTimeZone;
		vi.useRealTimers();
		vi.resetModules();
	});

	it("should report the UTC day when the viewer's local day is behind it", async () => {
		// 18:00 in Vancouver on the 20th is already the 21st in UTC, which is the
		// day the server resolves a date filter against.
		process.env.TZ = "America/Vancouver";
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-21T01:00:00.000Z"));

		// Imported fresh because the hook caches the day in module state, which an
		// earlier test in this file may already have filled from the real clock.
		vi.resetModules();
		const { useToday } = await import("../hooks");

		const { result } = renderHook(() => useToday());

		expect(new Date().getDate()).toBe(20);
		expect(result.current).toBe("2026-08-21");
	});
});

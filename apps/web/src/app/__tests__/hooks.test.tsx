import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebounce, useToday } from "../hooks";

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

	it("should preserve newer draft changes when an earlier commit is acknowledged", async () => {
		const onChange = vi.fn();

		const { result, rerender } = renderHook(
			({ value }) => useDebounce(value, onChange, 10),
			{ initialProps: { value: "" } },
		);

		act(() => result.current[1]("F"));
		await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

		expect(onChange).toHaveBeenCalledExactlyOnceWith("F");

		act(() => result.current[1]("Foo"));
		rerender({ value: "F" });

		expect(result.current[0]).toBe("Foo");

		await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

		expect(onChange).toHaveBeenNthCalledWith(2, "Foo");
	});

	it("should preserve the draft when an older echo follows a newer commit", async () => {
		const onChange = vi.fn();
		const { result, rerender } = renderHook(
			({ value }) => useDebounce(value, onChange, 10),
			{ initialProps: { value: "" } },
		);

		act(() => result.current[1]("F"));
		await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
		act(() => result.current[1]("Fo"));
		await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
		act(() => result.current[1]("Foo"));
		rerender({ value: "F" });

		expect(result.current[0]).toBe("Foo");
		expect(onChange).toHaveBeenNthCalledWith(2, "Fo");
		await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
		expect(onChange).toHaveBeenCalledTimes(3);
		rerender({ value: "Fo" });
		await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
		expect(result.current[0]).toBe("Foo");
		expect(onChange).toHaveBeenCalledTimes(3);
	});

	it("should honor an explicit clear that equals an outstanding commit", async () => {
		const onChange = vi.fn();
		const initialProps: { value: string; reset?: { value: string } } = {
			value: "foo",
		};
		const { result, rerender } = renderHook(
			({ value, reset }: { value: string; reset?: { value: string } }) =>
				useDebounce(value, onChange, 10, reset),
			{ initialProps },
		);

		act(() => result.current[1](""));
		await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
		act(() => result.current[1]("bar"));
		rerender({ value: "foo", reset: { value: "" } });

		expect(result.current[0]).toBe("");
		await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
		expect(onChange).toHaveBeenCalledExactlyOnceWith("");
	});

	it("should accept an external change while a commit is awaiting acknowledgement", async () => {
		const onChange = vi.fn();

		const { result, rerender } = renderHook(
			({ value }) => useDebounce(value, onChange, 10),
			{ initialProps: { value: "" } },
		);

		act(() => result.current[1]("Foo"));
		await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

		act(() => result.current[1]("Foobar"));
		rerender({ value: "ferret" });

		expect(result.current[0]).toBe("ferret");

		await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

		expect(onChange).toHaveBeenCalledExactlyOnceWith("Foo");
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
	afterEach(() => {
		vi.useRealTimers();
	});

	it("should report the current UTC day", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-21T01:00:00.000Z"));

		const { result } = renderHook(() => useToday());

		expect(result.current).toBe("2026-08-21");
	});
});

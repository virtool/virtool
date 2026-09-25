import { renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { useCapturedUrlParams } from "../hooks";

beforeEach(() => {
	window.history.replaceState({}, "", "/");
});

it("prefers the fragment and strips both fragment and query", () => {
	window.history.replaceState(
		{},
		"",
		"/verify?token=query&purpose=reset#token=fragment",
	);
	const onCapture = vi.fn();

	renderHook(() => useCapturedUrlParams(["token", "purpose"], onCapture));

	expect(onCapture).toHaveBeenCalledExactlyOnceWith({
		token: "fragment",
		purpose: "reset",
	});
	expect(window.location.pathname).toBe("/verify");
	expect(window.location.search).toBe("");
	expect(window.location.hash).toBe("");
});

it("passes null for absent parameters", () => {
	const onCapture = vi.fn();

	renderHook(() => useCapturedUrlParams(["token"], onCapture));

	expect(onCapture).toHaveBeenCalledExactlyOnceWith({ token: null });
});

it("captures once when StrictMode runs the effect twice", () => {
	window.history.replaceState({}, "", "/verify#token=abc");
	const onCapture = vi.fn();

	renderHook(() => useCapturedUrlParams(["token"], onCapture), {
		wrapper: StrictMode,
	});

	expect(onCapture).toHaveBeenCalledExactlyOnceWith({ token: "abc" });
});

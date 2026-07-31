import { writeToClipboard } from "@app/clipboard";
import { afterEach, describe, expect, it, vi } from "vitest";

function stubClipboard(clipboard: unknown) {
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: clipboard,
	});
}

afterEach(() => {
	stubClipboard(undefined);
});

describe("writeToClipboard()", () => {
	it("should write through the clipboard API", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);

		stubClipboard({ writeText });

		await writeToClipboard("copied");

		expect(writeText).toHaveBeenCalledWith("copied");
	});

	// Callers handle a rejection and nothing handles a synchronous throw, so an
	// absent API has to arrive the way a denied one does.
	it("should reject rather than throw when the API is absent", async () => {
		stubClipboard(undefined);

		await expect(writeToClipboard("copied")).rejects.toThrow(
			"The clipboard is unavailable",
		);
	});

	it("should reject when the API carries no writeText", async () => {
		stubClipboard({});

		await expect(writeToClipboard("copied")).rejects.toThrow(
			"The clipboard is unavailable",
		);
	});
});

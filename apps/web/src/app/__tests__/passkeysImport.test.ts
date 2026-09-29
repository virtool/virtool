import { expect, it, vi } from "vitest";

const browser = vi.hoisted(() => ({
	isUnavailable: true,
	startRegistration: vi.fn(),
}));

vi.mock("@simplewebauthn/browser", () => {
	if (browser.isUnavailable) {
		throw new Error("Failed to fetch dynamically imported module");
	}
	return { startRegistration: browser.startRegistration };
});

import { createPasskey } from "../passkeys";

it("loads the browser module again after a failed import", async () => {
	await expect(createPasskey({} as never)).rejects.toThrow();

	browser.isUnavailable = false;
	browser.startRegistration.mockResolvedValue({
		id: "id",
		clientExtensionResults: {},
	});

	await expect(createPasskey({} as never)).resolves.toEqual({ id: "id" });
});

import { InputError } from "@base/Input";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoViolations } from "../axe";

// Re-enabling `color-contrast` is the reason this project runs in a real
// browser: the rule needs computed layout and rendered colours, which jsdom
// cannot provide. The jsdom `web` project leaves it disabled.
const withContrast = { rules: { "color-contrast": { enabled: true } } };

describe("colour contrast in a real browser", () => {
	// Guards the WCAG AA text-contrast fixes from VIR-2693: muted `text-gray-500`
	// on white, the red `InputError` message, and white nav text on the teal
	// `bg-virtool` bar. A regression back to the old, lower-contrast tokens turns
	// this test red — which the jsdom harness could never catch.
	it("passes the fixed WCAG AA text colours", async () => {
		const { baseElement } = render(
			<main className="bg-white p-4">
				<h1>Samples</h1>
				<p className="text-gray-500">No samples found.</p>
				<InputError>Name is required.</InputError>
				<nav aria-label="Primary" className="bg-virtool p-2 text-white">
					<span>Samples</span>
				</nav>
			</main>,
		);

		await expectNoViolations(baseElement, withContrast);
	});

	// Proves the rule actually runs here, so the guard above cannot silently
	// no-op: a genuinely low-contrast colour (`text-gray-300` on white, ~1.5:1)
	// must be reported.
	it("flags a genuinely low-contrast colour", async () => {
		const { baseElement } = render(
			<main className="bg-white p-4">
				<p className="text-gray-300">Barely visible text</p>
			</main>,
		);

		await expect(expectNoViolations(baseElement, withContrast)).rejects.toThrow(
			/color-contrast/,
		);
	});
});

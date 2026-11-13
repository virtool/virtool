import { FieldError } from "@base/Field";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoViolations } from "../axe";

describe("expectNoViolations", () => {
	it("passes an accessible tree", async () => {
		const { container } = render(
			<main>
				<h1>Samples</h1>
				<button type="button">Create</button>
				<label>
					Name
					<input type="text" />
				</label>
			</main>,
		);

		await expectNoViolations(container);
	});

	it("rejects when a barrier is present", async () => {
		// An input with no associated label is a well-known axe barrier.
		const { container } = render(<input type="text" />);

		await expect(expectNoViolations(container)).rejects.toThrow(
			/expected no accessibility violations, found \d+/,
		);
	});
});

describe("colour contrast", () => {
	// Guards WCAG AA text contrast: muted `text-gray-500` on white, the red
	// `FieldError` message, and white nav text on the teal `bg-virtool` bar. A
	// lower-contrast token turns this test red.
	it("passes the fixed WCAG AA text colours", async () => {
		const { baseElement } = render(
			<main className="bg-white p-4">
				<h1>Samples</h1>
				<p className="text-gray-500">No samples found.</p>
				<FieldError>Name is required.</FieldError>
				<nav aria-label="Primary" className="bg-virtool p-2 text-white">
					<span>Samples</span>
				</nav>
			</main>,
		);

		await expectNoViolations(baseElement);
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

		await expect(expectNoViolations(baseElement)).rejects.toThrow(
			/color-contrast/,
		);
	});
});

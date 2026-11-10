import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import { expectNoViolations } from "../axe";

describe("expectNoViolations", () => {
	it("passes an accessible tree", async () => {
		const { container } = renderWithProviders(
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
		const { container } = renderWithProviders(<input type="text" />);

		await expect(expectNoViolations(container)).rejects.toThrow(
			/expected no accessibility violations, found \d+/,
		);
	});

	it("does not flag colour contrast, which jsdom cannot compute", async () => {
		const { container } = renderWithProviders(
			<main>
				<h1>Low contrast heading</h1>
				<p style={{ color: "#eee", background: "#fff" }}>Barely visible</p>
			</main>,
		);

		await expectNoViolations(container);
	});
});

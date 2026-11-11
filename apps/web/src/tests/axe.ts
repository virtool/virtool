import axe, { type Result, type RunOptions } from "axe-core";

/** Render axe violations into a readable, indented block for the failure message. */
export function formatViolations(violations: Result[]): string {
	return violations
		.map((violation) => {
			const nodes = violation.nodes
				.map((node) => {
					const summary = node.failureSummary
						? `\n    ${node.failureSummary.replace(/\n/g, "\n    ")}`
						: "";
					return `  - ${node.html}${summary}`;
				})
				.join("\n");

			return `${violation.id} (${violation.impact ?? "unknown"}): ${violation.help}\n  ${violation.helpUrl}\n${nodes}`;
		})
		.join("\n\n");
}

/**
 * Assert that `container` has no axe-core accessibility violations.
 *
 * Opt-in per test rather than run automatically inside `renderWithProviders`,
 * so adding the harness does not fail every existing test at once and each
 * barrier can be fixed incrementally. Pass the element returned by a render
 * helper — usually `baseElement` — or any subtree to scope the check.
 *
 * Every rule runs, `color-contrast` included, because the tests render in
 * Chromium with the app stylesheet. `options` passes through to `axe.run`.
 */
export async function expectNoViolations(
	container: Element,
	options: RunOptions = {},
): Promise<void> {
	const { violations } = await axe.run(container, options);

	if (violations.length > 0) {
		throw new Error(
			`expected no accessibility violations, found ${violations.length}:\n\n${formatViolations(violations)}`,
		);
	}
}

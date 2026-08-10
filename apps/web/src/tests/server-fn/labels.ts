import type { Label } from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/labels/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so any test rendering a view that lists
 * labels can stub them without per-file `vi.mock` boilerplate.
 */
export const labelServerFnMocks = {
	createLabelFn: vi.fn(),
	deleteLabelFn: vi.fn(),
	findLabelsFn: vi.fn(),
	getLabelFn: vi.fn(),
	updateLabelFn: vi.fn(),
};

/** Sets up findLabels to resolve with the given labels. */
export function mockFindLabels(labels: Label[]): Mock {
	labelServerFnMocks.findLabelsFn.mockResolvedValue(labels);
	return labelServerFnMocks.findLabelsFn;
}

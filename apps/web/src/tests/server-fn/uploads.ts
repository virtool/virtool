import type { Upload } from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/uploads/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so any test rendering a view that lists or
 * deletes uploads can stub them without per-file `vi.mock` boilerplate.
 *
 * Uploading itself is not a server function — it posts to the `/uploads` route
 * through an `XMLHttpRequest` wrapper in `@uploads/uploader` — so tests that
 * exercise uploading mock `@uploads/uploader` directly.
 */
export const uploadServerFnMocks = {
	deleteUploadFn: vi.fn(),
	findUploadsFn: vi.fn(),
};

/** Sets up findUploads to resolve with a single page of the given uploads. */
export function mockFindUploads(files: Upload[]): Mock {
	uploadServerFnMocks.findUploadsFn.mockResolvedValue({
		items: files,
		foundCount: files.length,
		totalCount: files.length,
		page: 1,
		pageCount: 1,
		perPage: 25,
	});
	return uploadServerFnMocks.findUploadsFn;
}

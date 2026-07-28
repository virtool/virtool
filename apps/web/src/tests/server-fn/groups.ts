import type { Group } from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/groups/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so any test importing this helper can stub
 * the groups server functions without per-file `vi.mock` boilerplate.
 */
export const groupServerFnMocks = {
	listGroupsFn: vi.fn(),
	findGroupsFn: vi.fn(),
	getGroupFn: vi.fn(),
	createGroupFn: vi.fn(),
	updateGroupFn: vi.fn(),
	deleteGroupFn: vi.fn(),
};

/** Sets up the listGroups server fn to resolve with the provided groups. */
export function mockListGroups(groups: Group[]): Mock {
	groupServerFnMocks.listGroupsFn.mockResolvedValue(groups);
	return groupServerFnMocks.listGroupsFn;
}

/** Sets up the getGroup server fn to resolve with the provided group. */
export function mockGetGroup(group: Group): Mock {
	groupServerFnMocks.getGroupFn.mockImplementation(
		async ({ data }: { data: { groupId: number } }) => {
			if (data.groupId === group.id) {
				return group;
			}
			throw new Error(`unexpected groupId in mockGetGroup: ${data.groupId}`);
		},
	);
	return groupServerFnMocks.getGroupFn;
}

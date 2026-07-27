import type { Account } from "@account/types";
import type { AdministratorRole } from "@administration/types";
import type { User, UserNested } from "@users/types";
import { expect, type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/users/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so any test importing this helper can stub
 * the users server functions without per-file `vi.mock` boilerplate.
 */
export const userServerFnMocks = {
	findUsersFn: vi.fn(),
	searchUsersFn: vi.fn(),
	listUsersFn: vi.fn(),
	getAccountFn: vi.fn(),
	getUserFn: vi.fn(),
	createUserFn: vi.fn(),
	updateUserFn: vi.fn(),
	updateAccountHandleFn: vi.fn(),
	setAdministratorRoleFn: vi.fn(),
	listAdministratorRolesFn: vi.fn(),
};

/** Sets up findUsers to resolve with a single page containing the given users. */
export function mockFindUsers(users: User[]): Mock {
	userServerFnMocks.findUsersFn.mockResolvedValue({
		items: users,
		foundCount: users.length,
		page: 1,
		pageCount: 1,
		perPage: 25,
		totalCount: users.length,
	});
	return userServerFnMocks.findUsersFn;
}

/** Sets up searchUsers to resolve with a single page containing the given users. */
export function mockSearchUsers(users: User[]): Mock {
	userServerFnMocks.searchUsersFn.mockResolvedValue({
		items: users,
		foundCount: users.length,
		page: 1,
		pageCount: 1,
		perPage: 25,
		totalCount: users.length,
	});
	return userServerFnMocks.searchUsersFn;
}

/** Sets up listUsers to resolve with the given users, reduced to id and handle. */
export function mockListUsers(users: UserNested[]): Mock {
	userServerFnMocks.listUsersFn.mockResolvedValue(
		users.map(({ handle, id }) => ({ handle, id })),
	);
	return userServerFnMocks.listUsersFn;
}

/** Sets up getAccount to resolve with the given account. */
export function mockGetAccount(account: Account): Mock {
	userServerFnMocks.getAccountFn.mockResolvedValue(account);
	return userServerFnMocks.getAccountFn;
}

/**
 * Sets up getAccount to reject the way it does for an anonymous caller.
 *
 * The global authentication middleware rejects an unauthenticated call with
 * `UnauthorizedError`, and the route guards on `/login` and `/_authenticated`
 * read that rejection as "nobody is signed in".
 */
export function mockGetAccountUnauthorized(): Mock {
	const error = new Error("Unauthorized");
	error.name = "UnauthorizedError";

	userServerFnMocks.getAccountFn.mockRejectedValue(error);

	return userServerFnMocks.getAccountFn;
}

/** Sets up getUser to resolve with the given user when matched by id. */
export function mockGetUser(userId: number, user: User): Mock {
	userServerFnMocks.getUserFn.mockImplementation(
		async ({ data }: { data: { userId: number } }) => {
			if (data.userId === userId) {
				return user;
			}
			throw new Error(`unexpected userId in mockGetUser: ${data.userId}`);
		},
	);
	return userServerFnMocks.getUserFn;
}

/** Sets up createUser to resolve with the given user (or reject on a 4xx code). */
export function mockCreateUser(
	user?: User,
	statusCode = 201,
	message = "User already exists.",
): Mock {
	if (statusCode >= 400) {
		userServerFnMocks.createUserFn.mockRejectedValue(new Error(message));
	} else {
		userServerFnMocks.createUserFn.mockResolvedValue(user ?? {});
	}
	return userServerFnMocks.createUserFn;
}

/** Sets up updateUser to resolve with the merged user (or reject on a 4xx code). */
export function mockUpdateUser(
	_userId: number | string,
	statusCode: number,
	update: Record<string, unknown>,
	user?: User,
): Mock {
	if (statusCode >= 400) {
		const message =
			typeof update.message === "string" ? update.message : "Bad request.";
		userServerFnMocks.updateUserFn.mockRejectedValue(new Error(message));
	} else {
		userServerFnMocks.updateUserFn.mockResolvedValue({ ...user, ...update });
	}
	return userServerFnMocks.updateUserFn;
}

/**
 * Sets up updateAccountHandle to resolve with the updated user (or reject on a
 * 4xx code, e.g. 409 for a duplicate handle).
 *
 * When `expectedHandle` is given, the resolved variant also asserts the payload
 * carried the expected handle so callers can verify the value actually sent.
 */
export function mockUpdateAccountHandle(
	user?: User,
	statusCode = 200,
	message = "User already exists.",
	expectedHandle?: string,
): Mock {
	if (statusCode >= 400) {
		userServerFnMocks.updateAccountHandleFn.mockRejectedValue(
			new Error(message),
		);
	} else {
		userServerFnMocks.updateAccountHandleFn.mockImplementation(
			async ({ data }: { data: { handle: string } }) => {
				if (expectedHandle !== undefined) {
					expect(data.handle).toBe(expectedHandle);
				}
				return user ?? {};
			},
		);
	}
	return userServerFnMocks.updateAccountHandleFn;
}

/** Sets up listAdministratorRoles to resolve with the given roles. */
export function mockListAdministratorRoles(roles: AdministratorRole[]): Mock {
	userServerFnMocks.listAdministratorRolesFn.mockResolvedValue(roles);
	return userServerFnMocks.listAdministratorRolesFn;
}

/** Sets up setAdministratorRole to resolve with the given user. */
export function mockSetAdministratorRole(user: User): Mock {
	userServerFnMocks.setAdministratorRoleFn.mockResolvedValue(user);
	return userServerFnMocks.setAdministratorRoleFn;
}

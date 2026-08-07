import { faker } from "@faker-js/faker";
import type { User } from "@users/types";
import type { UserNested } from "@virtool/contracts";
import { createFakeGroupMinimal } from "./groups";
import { createFakePermissions } from "./permissions";

/**
 * Returns a UserNested object populated with fake data
 *
 * @returns a UserNested object with fake data
 */
export function createFakeUserNested(): UserNested {
	return {
		id: faker.number.int(),
		handle: faker.internet.username(),
	};
}

/**
 * Returns a User object populated with fake data
 *
 * @param overrides values to override the default automatically generated values
 * @returns a User object with fake data
 */
export function createFakeUser(overrides?: Partial<User>): User {
	const {
		groups: overrideGroups,
		permissions,
		primaryGroup,
		...rest
	} = overrides || {};
	const groups = overrideGroups ?? [createFakeGroupMinimal()];

	return {
		...createFakeUserNested(),
		active: true,
		administratorRole: null,
		forceReset: false,
		groups,
		lastPasswordChange: faker.date.past(),
		permissions: createFakePermissions(permissions),
		primaryGroup:
			primaryGroup === undefined ? (groups[0] ?? null) : primaryGroup,
		...rest,
	};
}

/**
 * Returns an array of User objects populated with fake data
 *
 * @param count - the number of users to create
 * @returns An array of User objects populated with fake data
 */
export function createFakeUsers(count: number): Array<User> {
	return Array.from({ length: count || 1 }, createFakeUser);
}

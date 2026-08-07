import { faker } from "@faker-js/faker";
import type { Group, GroupMinimal } from "@virtool/contracts";
import { createFakePermissions } from "./permissions";

/**
 * Create a GroupMinimal object with fake data.
 *
 * @param overrides values to override the default automatically generated values
 * @returns GroupMinimal object with fake data
 */
export function createFakeGroupMinimal(
	overrides?: Partial<GroupMinimal>,
): GroupMinimal {
	const defaultGroupMinimal = {
		id: faker.number.int(),
		name: `${faker.person.jobType()}s`,
		legacyId: null,
	};

	return { ...defaultGroupMinimal, ...overrides };
}

/**
 * Create Group object with fake data.
 *
 * @param overrides values to override the default automatically generated values
 * @returns Group object with fake data
 */
export function createFakeGroup(overrides?: Partial<Group>): Group {
	const { permissions, users, ...props } = overrides || {};
	return {
		...createFakeGroupMinimal(props),
		permissions: createFakePermissions(permissions),
		users: users || [],
	};
}

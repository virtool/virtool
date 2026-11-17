import { faker } from "@faker-js/faker";
import type { User, UserNested } from "@virtool/contracts";
import { createFakeGroupMinimal } from "./groups";
import { createFakePermissions } from "./permissions";

/** A user who has accepted their invitation and has a username. */
export type FakeNormalUser = Extract<User, { lifecycleState: "normal" }>;

/** A user who has not accepted their invitation yet. */
type FakePendingUser = Extract<User, { lifecycleState: "pending" }>;

type FakeUserFields = Omit<
	FakeNormalUser,
	"id" | "lifecycleState" | "username"
>;

/**
 * Returns a UserNested object populated with fake data
 *
 * @returns a UserNested object with fake data
 */
export function createFakeUserNested(): UserNested {
	return {
		id: faker.number.int(),
		username: faker.internet.username().toLowerCase(),
	};
}

function createFakeUserFields(
	overrides?: Partial<FakeUserFields>,
): FakeUserFields {
	const {
		groups: overrideGroups,
		permissions,
		primaryGroup,
		...rest
	} = overrides || {};
	const groups = overrideGroups ?? [createFakeGroupMinimal()];

	return {
		active: true,
		administratorRole: null,
		groups,
		lastPasswordChange: faker.date.past(),
		permissions: createFakePermissions(permissions),
		primaryGroup:
			primaryGroup === undefined ? (groups[0] ?? null) : primaryGroup,
		...rest,
	};
}

/**
 * Returns a set-up User object populated with fake data
 *
 * @param overrides values to override the default automatically generated values
 * @returns a User object with fake data
 */
export function createFakeUser(
	overrides?: Partial<Omit<FakeNormalUser, "lifecycleState">>,
): FakeNormalUser {
	const { id, username, ...fields } = overrides || {};
	const nested = createFakeUserNested();

	return {
		...createFakeUserFields(fields),
		id: id ?? nested.id,
		lifecycleState: "normal",
		username: username ?? nested.username,
	};
}

/**
 * Returns a pending User object, which has no username, populated with fake data
 *
 * @param overrides values to override the default automatically generated values
 * @returns a pending User object with fake data
 */
export function createFakePendingUser(
	overrides?: Partial<Omit<FakePendingUser, "lifecycleState" | "username">>,
): FakePendingUser {
	const { id, ...fields } = overrides || {};

	return {
		...createFakeUserFields(fields),
		id: id ?? faker.number.int(),
		lifecycleState: "pending",
		username: null,
	};
}

/**
 * Returns an array of set-up User objects populated with fake data
 *
 * @param count - the number of users to create
 * @returns An array of User objects populated with fake data
 */
export function createFakeUsers(count: number): Array<FakeNormalUser> {
	return Array.from({ length: count || 1 }, () => createFakeUser());
}

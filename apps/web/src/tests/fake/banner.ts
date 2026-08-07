import type { Banner } from "@banner/types";
import { faker } from "@faker-js/faker";
import { createFakeUserNested } from "./user";

/**
 * Create a fake banner.
 *
 * @param overrides - optional properties for creating a fake banner with specific values
 */
export function createFakeBanner(overrides?: Partial<Banner>): Banner {
	return {
		active: true,
		color: "red",
		createdAt: faker.date.past(),
		id: faker.number.int(),
		message: faker.lorem.sentence(),
		updatedAt: faker.date.past(),
		user: createFakeUserNested(),
		...overrides,
	};
}

import { faker } from "@faker-js/faker";
import type { JobNested, ServerJobMinimal } from "@jobs/types";
import type { JobState, JobWorkflow } from "@virtool/contracts";
import { createFakeUserNested } from "./user";

/**
 * Creates a fake job minimal object in server response shape.
 * Use this for HTTP mocks.
 */
export function createFakeServerJobMinimal(
	overrides?: Partial<ServerJobMinimal>,
): ServerJobMinimal {
	return {
		id: faker.number.int(),
		createdAt: faker.date.past().toISOString(),
		progress: faker.number.int({ min: 0, max: 100 }),
		state: faker.helpers.arrayElement<JobState>([
			"cancelled",
			"failed",
			"pending",
			"running",
			"succeeded",
		]),
		user: createFakeUserNested(),
		workflow: "pathoscope",
		...overrides,
	};
}

/**
 * Creates a fake nested job object in client shape (transformed).
 * Use this for components that expect the transformed JobNested type.
 */
export function createFakeJobNested(overrides?: Partial<JobNested>): JobNested {
	return {
		createdAt: faker.date.past(),
		id: faker.number.int(),
		progress: faker.number.int({ min: 0, max: 100 }),
		state: faker.helpers.arrayElement<JobState>([
			"cancelled",
			"failed",
			"pending",
			"running",
			"succeeded",
		]),
		user: {
			handle: faker.internet.username(),
			id: faker.number.int(),
		},
		workflow: faker.helpers.arrayElement<JobWorkflow>([
			"build_index",
			"create_sample",
			"create_subtraction",
			"nuvs",
			"pathoscope",
		]),
		...overrides,
	};
}

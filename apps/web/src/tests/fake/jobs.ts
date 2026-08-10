import { faker } from "@faker-js/faker";
import type {
	JobMinimal,
	JobNested,
	JobState,
	JobWorkflow,
} from "@virtool/contracts";
import { createFakeUserNested } from "./user";

/** Creates a fake job as it appears in a page of search results. */
export function createFakeJobMinimal(
	overrides?: Partial<JobMinimal>,
): JobMinimal {
	return {
		id: faker.number.int(),
		createdAt: faker.date.past(),
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

/** Creates a fake job as a parent resource embeds it. */
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

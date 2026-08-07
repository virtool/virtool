import { faker } from "@faker-js/faker";
import type { Task } from "@tasks/types";

/**
 * Create a fake task
 *
 * @param overrides - optional properties for creating a fake task with specific values
 */
export function createFakeTask(overrides?: Partial<Task>): Task {
	return {
		complete: faker.datatype.boolean(),
		createdAt: faker.date.past(),
		error: null,
		id: faker.number.int(),
		progress: faker.number.int({ min: 0, max: 100 }),
		step: faker.word.noun(),
		type: faker.word.noun(),
		...overrides,
	};
}

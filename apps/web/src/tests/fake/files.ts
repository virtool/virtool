import { faker } from "@faker-js/faker";
import type { Upload } from "@virtool/contracts";
import { createFakeUserNested } from "./user";

/**
 * Create a File object with fake data.
 */
export function createFakeFile(overrides?: Partial<Upload>): Upload {
	const name = overrides?.name ?? `sample_${faker.number.int()}.fastq.gz`;

	return {
		id: faker.number.int(),
		createdAt: faker.date.past(),
		name,
		ready: true,
		removed: false,
		removedAt: null,
		reserved: false,
		size: faker.number.int(),
		type: "reads",
		uploadedAt: faker.date.past(),
		user: createFakeUserNested(),
		...overrides,
	};
}

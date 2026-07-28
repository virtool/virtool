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
		created_at: faker.date.past().toISOString(),
		name,
		ready: true,
		removed: false,
		removed_at: null,
		reserved: false,
		size: faker.number.int(),
		type: "reads",
		uploaded_at: faker.date.past().toISOString(),
		user: createFakeUserNested(),
		...overrides,
	};
}

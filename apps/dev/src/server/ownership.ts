/** Ownership labels expected on every managed Docker resource. */
export type Ownership = {
	environmentId: string;
	generation: number;
	repositoryId: string;
};

/** Verify Docker labels before any destructive cleanup. */
export function validateOwnership(
	labels: Record<string, string>,
	expected: Ownership,
): void {
	const actual = {
		environmentId: labels["ca.virtool.dev.environment"],
		generation: Number(labels["ca.virtool.dev.generation"]),
		repositoryId: labels["ca.virtool.dev.repository"],
	};
	if (
		actual.repositoryId !== expected.repositoryId ||
		actual.environmentId !== expected.environmentId ||
		actual.generation !== expected.generation
	) {
		throw new Error(
			"Refusing cleanup because Docker ownership labels do not match",
		);
	}
}

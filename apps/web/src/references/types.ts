/**
 * A reference reduced to the fields embedded in other resources (OTUs, indexes,
 * analyses, jobs). These still come from the Python API, so this shape keeps its
 * snake_case `data_type` and is owned here rather than by the contract.
 */
export type ReferenceNested = {
	id: number;
	data_type: string;
	name: string;
};

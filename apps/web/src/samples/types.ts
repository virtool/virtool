/* A Sample with essential information */
export type SampleNested = {
	id: number;
	name: string;
};

/** The fields sent to the API to create a sample */
export type CreateSampleRequest = {
	files: number[];
	group: string | null;
	host: string;
	isolate: string;
	labels: number[];
	libraryType: string;
	locale: string;
	name: string;
	subtractions: number[];
};

/** Fields that can be changed when updating a sample */
export type SampleUpdate = {
	isolate?: string;
	labels?: number[];
	locale?: string;
	name?: string;
	notes?: string;
	subtractions?: number[];
};

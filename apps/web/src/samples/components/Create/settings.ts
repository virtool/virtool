import type { CreateSampleFormValues } from "@samples/utils";

/** The settings shared by every sample creation form. */
export type SampleSettingsValues = Required<
	Omit<CreateSampleFormValues, "name">
>;

export const sampleSettingsDefaults: SampleSettingsValues = {
	group: "",
	host: "",
	isolate: "",
	labels: [],
	libraryType: "normal",
	locale: "",
	subtractionIds: [],
};

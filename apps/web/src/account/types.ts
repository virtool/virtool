import type { User } from "@users/types";

export type QuickAnalyzeWorkflow = "nuvs" | "pathoscope";

export type AccountSettings = {
	quickAnalyzeWorkflow: QuickAnalyzeWorkflow;
	showIds: boolean;
	showVersions: boolean;
	skipQuickAnalyzeDialog: boolean;
};

export type Account = User & {
	settings: AccountSettings;
	email?: string;
};

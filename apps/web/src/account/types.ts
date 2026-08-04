import type { User } from "@users/types";

export type QuickAnalyzeWorkflow = "nuvs" | "pathoscope";

export type AccountSettings = {
	quick_analyze_workflow: QuickAnalyzeWorkflow;
	show_ids: boolean;
	show_versions: boolean;
	skip_quick_analyze_dialog: boolean;
};

export type Account = User & {
	settings: AccountSettings;
	email?: string;
};

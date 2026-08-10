import { z } from "zod";
import type { AdministratorRoleName } from "./administrators";
import type { GroupMinimal } from "./groups";
import type { Permissions } from "./permissions";
import type { SearchResult } from "./search";

/** A user reduced to the fields shown alongside another resource. */
export const UserNested = z.object({
	/** The unique identifier */
	id: z.number().int(),

	/** The user's handle or username */
	handle: z.string(),
});

export type UserNested = z.infer<typeof UserNested>;

/** A Virtool user, as the administration views read them. */
export type User = UserNested & {
	/** Their administrator role, defining what resources they can modify */
	administratorRole: AdministratorRoleName | null;

	/** Whether the user may sign in */
	active: boolean;

	/** Whether the user must reset their password on next login */
	forceReset: boolean;

	/** The groups they belong to */
	groups: GroupMinimal[];

	/** When they last changed their password */
	lastPasswordChange: Date;

	/** What they may do, their groups' grants folded in */
	permissions: Permissions;

	/** The group whose rights new resources of theirs inherit */
	primaryGroup: GroupMinimal | null;
};

/** The workflow the quick-analyze dialog runs by default. */
export type QuickAnalyzeWorkflow = "nuvs" | "pathoscope";

/**
 * A signed-in user's client-side preferences.
 *
 * Stored snake_case in the `users.settings` JSONB column, which Python also
 * writes — the data layer maps between the two spellings.
 */
export type AccountSettings = {
	quickAnalyzeWorkflow: QuickAnalyzeWorkflow;
	showIds: boolean;
	showVersions: boolean;
	skipQuickAnalyzeDialog: boolean;
};

/**
 * The signed-in user's own view of themselves.
 *
 * A {@link User} plus the two fields only the account holder may read.
 * `email` is never absent: the column is `NOT NULL` defaulting to `""`, and
 * clearing an address writes the empty string rather than a null.
 */
export type Account = User & {
	email: string;
	settings: AccountSettings;
};

/** A page of users. */
export type UserSearchResult = SearchResult & {
	items: User[];
};

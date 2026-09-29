import { z } from "zod";
import type { AdministratorRoleName } from "./administrators";
import { ADMINISTRATOR_ROLE_NAMES } from "./administrators";
import type { GroupMinimal } from "./groups";
import type { Permissions } from "./permissions";
import type { SearchResult } from "./search";
import type { AccountLifecycleState } from "./setup";

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

	/**
	 * Whether the account is usable as an application account yet.
	 *
	 * Separate from {@link User.active}: a `pending` account has a role and
	 * group memberships but no credential. Its handle is empty until acceptance.
	 * A deactivated account
	 * is unusable whatever this says.
	 */
	lifecycleState: AccountLifecycleState;

	/** What they may do, their groups' grants folded in */
	permissions: Permissions;

	/** The group whose rights new resources of theirs inherit */
	primaryGroup: GroupMinimal | null;
};

/** A user as the administrator detail view reads them. */
export type AdministeredUserDetail = User & {
	/** Whether they have confirmed a TOTP enrollment */
	twoFactorEnabled: boolean;
};

/** The workflow the quick-analyze dialog runs by default. */
export type QuickAnalyzeWorkflow = "nuvs" | "pathoscope";

/** The placement of the naming columns in a copied Pathoscope table. */
export type PathoscopeColumnOrder = "name-first" | "name-last";

/**
 * A signed-in user's client-side preferences.
 *
 * Stored snake_case in the `users.settings` JSONB column — the data layer maps
 * between the two spellings.
 */
export type AccountSettings = {
	/** Whether Pathoscope copies put the naming columns before or after the metrics */
	pathoscopeColumnOrder: PathoscopeColumnOrder;
	/** Whether pathoscope exports name an OTU by its acronym, when it has one */
	preferAcronym: boolean;
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

/**
 * The account states the user administration list can filter by.
 *
 * `invited` is an active account still waiting on its invitation. A
 * deactivated account is `deactivated` whatever its lifecycle state.
 */
export const USER_STATUSES = ["active", "invited", "deactivated"] as const;

/** An account state as the user administration list shows it. */
export type UserStatus = (typeof USER_STATUSES)[number];

/** The role filters of the user administration list: each role, or none. */
export const USER_ROLE_FILTERS = [...ADMINISTRATOR_ROLE_NAMES, "none"] as const;

/** A role filter of the user administration list. */
export type UserRoleFilter = (typeof USER_ROLE_FILTERS)[number];

/** The columns the user administration list can be sorted by. */
export const USER_SORT_FIELDS = ["handle", "email", "role", "status"] as const;

/** A column the user administration list can be sorted by. */
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

/** A user as the user administration list reads them, with their email. */
export type AdministeredUser = User & {
	email: string;
};

/** A page of the user administration list. */
export type AdministeredUserSearchResult = SearchResult & {
	items: AdministeredUser[];
};

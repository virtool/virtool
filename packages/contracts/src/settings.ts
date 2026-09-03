/**
 * The group-access policies a newly created sample can be assigned.
 *
 * `settings.sample_group` is a `text` column closed by the
 * `ck_settings_sample_group` CHECK constraint; this is the one declaration of
 * what that constraint admits, imported by the schema mirror rather than
 * restated there.
 */
export const sampleGroups = [
	"none",
	"force_choice",
	"users_primary_group",
] as const;

/** The group-access policy applied to a newly created sample. */
export type SampleGroup = (typeof sampleGroups)[number];

/**
 * Whether the stored NCBI API key can be used.
 *
 * `configuration_error` means a key is stored but the encryption key this
 * instance runs with cannot decrypt it. GenBank lookups fall back to the
 * anonymous rate limit, so the state is reported rather than thrown.
 */
export type NcbiAvailability = "unconfigured" | "ready" | "configuration_error";

/**
 * The instance settings singleton, as an administration client reads it.
 *
 * Every stored setting except the NCBI API key, which is a credential:
 * `hasNcbiApiKey` reports only whether one is configured, `ncbiAvailability`
 * whether it can be decrypted, and the key itself never crosses the wire in
 * either form. A client writes a new key or clears it, and never reads one
 * back. `apps/web`'s settings server functions do that narrowing.
 *
 * Distinct from {@link WorkflowSettings}, which is what the jobs API serves to
 * a workflow and carries no NCBI field at all.
 */
export type Settings = {
	/**
	 * The object-storage budget, in bytes, the LRU cache eviction task keeps the
	 * cache store under.
	 */
	cacheStorageBudget: number;
	defaultSourceTypes: string[];
	enableSentry: boolean;
	hasNcbiApiKey: boolean;
	minimumPasswordLength: number;
	ncbiAvailability: NcbiAvailability;
	sampleAllRead: boolean;
	sampleAllWrite: boolean;
	sampleGroup: SampleGroup;
	sampleGroupRead: boolean;
	sampleGroupWrite: boolean;
};

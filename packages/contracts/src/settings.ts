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
 * The instance settings singleton, as an administration client reads it.
 *
 * Every stored setting except the NCBI API key, which is a credential:
 * `hasNcbiApiKey` reports only whether one is configured, and the key itself
 * never crosses the wire. A client writes a new key or clears it, and never
 * reads one back. `apps/web`'s settings server functions do that narrowing.
 *
 * Distinct from {@link WorkflowSettings}, which is what the jobs API serves to
 * a workflow and carries no NCBI field at all.
 */
export type Settings = {
	defaultSourceTypes: string[];
	enableSentry: boolean;
	hasNcbiApiKey: boolean;
	minimumPasswordLength: number;
	sampleAllRead: boolean;
	sampleAllWrite: boolean;
	sampleGroup: SampleGroup;
	sampleGroupRead: boolean;
	sampleGroupWrite: boolean;
};

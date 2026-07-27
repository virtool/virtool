/** A group reduced to the fields embedded in other resources. */
export type GroupMinimal = {
	/** The unique identifier */
	id: number;

	/** The Mongo-era string id, or null for a Postgres-native group */
	legacy_id: string | null;

	/** The display name */
	name: string;
};

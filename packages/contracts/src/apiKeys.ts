import type { Permissions } from "./permissions";

/** An account API key as returned to the API-key management UI. */
export type ApiKey = {
	id: number;
	createdAt: Date;
	name: string;
	permissions: Permissions;
};

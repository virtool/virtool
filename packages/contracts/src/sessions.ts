/** A safe, display-only summary of one live browser session. */
export type ActiveBrowserSession = {
	/** Non-authenticating database identity used only for session management. */
	managementId: number;
	browser: string;
	operatingSystem: string;
	ipAddress: string | null;
	createdAt: Date;
	/** The last time Better Auth refreshed the rolling session. */
	lastActivityAt: Date;
	expiresAt: Date;
	isCurrent: boolean;
};

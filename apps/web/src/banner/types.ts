import type { BannerColor, UserNested } from "@virtool/contracts";

/** Tailwind background-color class for each banner color. */
export const bannerColorClasses: Record<BannerColor, string> = {
	red: "bg-red-500",
	orange: "bg-orange-500",
	yellow: "bg-yellow-500",
	blue: "bg-blue-500",
	purple: "bg-purple-500",
	grey: "bg-gray-500",
};

/** An administrative banner displayed to all logged-in users. */
export type Banner = {
	active: boolean;
	color: BannerColor;

	/** When the banner was written, or null if the row does not record it. */
	createdAt: Date | null;

	id: number;
	message: string;

	/** When the banner was last changed, or null if the row does not record it. */
	updatedAt: Date | null;

	user: UserNested;
};

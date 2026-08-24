import { cn } from "@app/cn";
import Tooltip from "@base/Tooltip";
import type { IconColor } from "@base/types";
import type { LucideIcon } from "lucide-react";
import { iconButtonVariants } from "./iconButtonVariants";

export type IconLinkProps = {
	/** Accessible name for the link. Defaults to ``tip``. */
	ariaLabel?: string;
	className?: string;
	color?: IconColor;
	/** Save the target instead of navigating to it, named as given. */
	download?: boolean | string;
	href: string;
	IconComponent: LucideIcon;
	size?: number;
	tip: string;
	tipPlacement?: "top" | "right" | "bottom" | "left";
};

/**
 * A styled icon anchor with a tooltip describing its action, sharing
 * `IconButton`'s treatment so the two sit together in a row of controls.
 *
 * This is an anchor rather than a button because the browser has to make the
 * request itself: a download's `Content-Disposition` only reaches the user
 * through a real navigation, not a fetch. `href` is therefore a plain URL, not
 * a `<Link>` — these targets are responses, not routes.
 */
export default function IconLink({
	ariaLabel,
	className,
	color,
	download,
	href,
	IconComponent,
	size,
	tip,
	tipPlacement,
}: IconLinkProps) {
	return (
		<Tooltip position={tipPlacement || "top"} tip={tip}>
			<a
				aria-label={ariaLabel ?? tip}
				className={cn(
					iconButtonVariants({ color }),
					"inline-flex justify-center",
					className,
				)}
				download={download}
				href={href}
			>
				<IconComponent size={size ?? "1.2em"} />
			</a>
		</Tooltip>
	);
}

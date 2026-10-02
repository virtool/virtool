import { accountQueryOptions } from "@account/account";
import { cn } from "@app/cn";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import InitialIcon from "./InitialIcon";

type UserAvatarProps = {
	className?: string;

	/** The handle of the user the avatar represents */
	handle: string;

	size: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
};

/**
 * A user's avatar image, or their initial icon when they have no image.
 *
 * The image stays hidden until it loads, so a 404 leaves the initials showing.
 */
export default function UserAvatar({
	className,
	handle,
	size,
}: UserAvatarProps) {
	const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

	// The signed-in user's avatar source goes in the URL, so changing it fetches
	// a new image at once instead of reusing the cached one.
	const { data: avatarSource } = useQuery({
		...accountQueryOptions(),
		enabled: false,
		select: (account) =>
			account.handle === handle ? account.settings.avatarSource : null,
	});

	const src = `/avatars/${encodeURIComponent(handle)}${avatarSource ? `?source=${avatarSource}` : ""}`;

	// An image that loads before hydration fires its load event before React
	// listens for it.
	function checkLoaded(image: HTMLImageElement | null) {
		if (image?.complete && image.naturalWidth > 0) {
			setLoadedSrc(src);
		}
	}

	return (
		<span className={cn("relative inline-flex shrink-0", className)}>
			<InitialIcon handle={handle} size={size} />
			{handle ? (
				<img
					key={src}
					ref={checkLoaded}
					alt=""
					aria-hidden
					className={cn(
						"absolute inset-0 size-full rounded-full",
						loadedSrc !== src && "invisible",
					)}
					onLoad={() => setLoadedSrc(src)}
					src={src}
				/>
			) : null}
		</span>
	);
}

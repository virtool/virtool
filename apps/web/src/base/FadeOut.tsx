import { cn } from "@app/cn";
import { TRANSIENT_FADE_DURATION } from "@app/timing";
import { type ReactNode, useEffect, useState } from "react";

type FadeOutProps = {
	/** The content to show. An empty value fades out whatever was last shown. */
	children: ReactNode;

	className?: string;

	/** The live region role to announce the content under, if any. */
	role?: "alert" | "status";
};

/**
 * Shows its content and fades it out once `children` goes empty, holding the
 * last content mounted until the fade finishes so the fade has something to
 * act on. The content is dropped afterwards so the surrounding layout reflows.
 *
 * The wrapper stays mounted while empty so a live region exists before the
 * first message lands; a region added and filled in the same commit is missed
 * by some screen readers.
 */
export default function FadeOut({ children, className, role }: FadeOutProps) {
	const [shown, setShown] = useState<ReactNode>(null);
	const visible = Boolean(children);

	useEffect(() => {
		if (children) {
			setShown(children);
		}
	}, [children]);

	// Clocked rather than driven by `transitionend`, which never fires when the
	// user has asked for reduced motion.
	useEffect(() => {
		if (visible) {
			return;
		}

		const timeout = setTimeout(() => setShown(null), TRANSIENT_FADE_DURATION);

		return () => clearTimeout(timeout);
	}, [visible]);

	return (
		<div
			className={cn(
				"transition-opacity duration-300",
				visible ? "opacity-100" : "opacity-0",
				className,
			)}
			role={role}
		>
			{shown}
		</div>
	);
}

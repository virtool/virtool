import { cn } from "@app/cn";
import type { ReactNode } from "react";

type SectionHeaderProps = {
	children: ReactNode;
	className?: string;
	/** The heading level rendered inside the section header. */
	level?: 2 | 3;
};

export default function SectionHeader({
	children,
	className = "",
	level = 2,
}: SectionHeaderProps) {
	return (
		<header
			className={cn(
				level === 2
					? ["mb-5", "[&_h2]:mb-1.5", "[&_h2]:text-2xl", "[&_p]:text-base"]
					: ["mb-4", "[&_h3]:mb-1", "[&_h3]:text-lg", "[&_p]:text-sm"],
				"[&_p]:text-gray-600",
				"[&_p]:font-medium",
				className,
			)}
		>
			{children}
		</header>
	);
}
